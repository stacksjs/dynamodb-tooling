// ============================================================================
// Audit - Audit Logging for DynamoDB Operations
// ============================================================================

/**
 * Audit event type
 */
export type AuditEventType =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'QUERY'
  | 'SCAN'
  | 'BATCH_WRITE'
  | 'BATCH_READ'
  | 'TRANSACTION'
  | 'ACCESS_DENIED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'KEY_ROTATION'
  | 'SCHEMA_CHANGE'

/**
 * Audit event status
 */
export type AuditEventStatus = 'SUCCESS' | 'FAILURE' | 'DENIED'

/**
 * Audit event
 */
export interface AuditEvent {
  /** Event ID */
  id: string
  /** Event type */
  type: AuditEventType
  /** Event status */
  status: AuditEventStatus
  /** Timestamp */
  timestamp: Date
  /** Actor (who performed the action) */
  actor: {
    /** User ID */
    userId?: string
    /** Tenant ID */
    tenantId?: string
    /** IP address */
    ipAddress?: string
    /** User agent */
    userAgent?: string
    /** Session ID */
    sessionId?: string
    /** Roles */
    roles?: string[]
  }
  /** Target (what was affected) */
  target: {
    /** Table name */
    tableName?: string
    /** Entity type */
    entityType?: string
    /** Primary key */
    pk?: string
    /** Sort key */
    sk?: string
    /** Item count */
    itemCount?: number
  }
  /** Operation details */
  operation: {
    /** Operation name */
    name: string
    /** Duration in milliseconds */
    durationMs?: number
    /** Consumed capacity */
    consumedCapacity?: {
      readUnits?: number
      writeUnits?: number
    }
  }
  /** Changes made */
  changes?: {
    /** Before state */
    before?: Record<string, unknown>
    /** After state */
    after?: Record<string, unknown>
    /** Changed attributes */
    changedAttributes?: string[]
  }
  /** Error details (if failed) */
  error?: {
    code?: string
    message: string
  }
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Request ID (for correlation) */
  requestId?: string
  /** Trace ID (for distributed tracing) */
  traceId?: string
}

/**
 * Audit storage interface
 */
export interface AuditStorage {
  /** Storage name */
  name: string
  /** Store audit event */
  store(event: AuditEvent): unknown | Promise<unknown>
  /** Query audit events */
  query?(options: AuditQueryOptions): Promise<AuditQueryResult>
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  /** Filter by event type */
  type?: AuditEventType | AuditEventType[]
  /** Filter by status */
  status?: AuditEventStatus
  /** Filter by actor user ID */
  userId?: string
  /** Filter by tenant ID */
  tenantId?: string
  /** Filter by table name */
  tableName?: string
  /** Filter by entity type */
  entityType?: string
  /** Start time */
  startTime?: Date
  /** End time */
  endTime?: Date
  /** Maximum results */
  limit?: number
  /** Pagination token */
  nextToken?: string
}

/**
 * Audit query result
 */
export interface AuditQueryResult {
  /** Events */
  events: AuditEvent[]
  /** Pagination token */
  nextToken?: string
  /** Total count (if available) */
  totalCount?: number
}

/**
 * In-memory audit storage (for testing/development)
 */
export class InMemoryAuditStorage implements AuditStorage {
  name = 'in-memory'
  private events: AuditEvent[] = []
  private maxEvents: number

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents
  }

  store(event: AuditEvent): void {
    this.events.push(event)

    // Trim if exceeds max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
  }

  async query(options: AuditQueryOptions): Promise<AuditQueryResult> {
    let filtered = [...this.events]

    // Apply filters
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type]
      filtered = filtered.filter(e => types.includes(e.type))
    }

    if (options.status) {
      filtered = filtered.filter(e => e.status === options.status)
    }

    if (options.userId) {
      filtered = filtered.filter(e => e.actor.userId === options.userId)
    }

    if (options.tenantId) {
      filtered = filtered.filter(e => e.actor.tenantId === options.tenantId)
    }

    if (options.tableName) {
      filtered = filtered.filter(e => e.target.tableName === options.tableName)
    }

    if (options.entityType) {
      filtered = filtered.filter(e => e.target.entityType === options.entityType)
    }

    if (options.startTime) {
      filtered = filtered.filter(e => e.timestamp >= options.startTime!)
    }

    if (options.endTime) {
      filtered = filtered.filter(e => e.timestamp <= options.endTime!)
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Pagination
    const startIndex = options.nextToken ? Number.parseInt(options.nextToken, 10) : 0
    const limit = options.limit || 100
    const page = filtered.slice(startIndex, startIndex + limit)
    const nextToken = startIndex + limit < filtered.length
      ? String(startIndex + limit)
      : undefined

    return {
      events: page,
      nextToken,
      totalCount: filtered.length,
    }
  }

  /**
   * Get all events (for testing)
   */
  getAll(): AuditEvent[] {
    return [...this.events]
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = []
  }
}

/**
 * DynamoDB audit storage
 */
export class DynamoDBCommandAuditStorage implements AuditStorage {
  name = 'dynamodb'
  private tableName: string

  constructor(tableName: string) {
    this.tableName = tableName
  }

  /**
   * Generate put command for audit event
   */
  store(event: AuditEvent): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: Record<string, unknown>
    }
  } {
    return {
      command: 'PutItem',
      input: {
        TableName: this.tableName,
        Item: {
          pk: { S: `AUDIT#${event.timestamp.toISOString().split('T')[0]}` },
          sk: { S: `${event.timestamp.toISOString()}#${event.id}` },
          id: { S: event.id },
          type: { S: event.type },
          status: { S: event.status },
          timestamp: { S: event.timestamp.toISOString() },
          actor: { M: this.serializeActor(event.actor) },
          target: { M: this.serializeTarget(event.target) },
          operation: { M: this.serializeOperation(event.operation) },
          ...(event.changes && { changes: { S: JSON.stringify(event.changes) } }),
          ...(event.error && { error: { M: { code: { S: event.error.code || '' }, message: { S: event.error.message } } } }),
          ...(event.metadata && { metadata: { S: JSON.stringify(event.metadata) } }),
          ...(event.requestId && { requestId: { S: event.requestId } }),
          ...(event.traceId && { traceId: { S: event.traceId } }),
          _ttl: { N: String(Math.floor(event.timestamp.getTime() / 1000) + 90 * 24 * 60 * 60) }, // 90 days TTL
        },
      },
    }
  }

  private serializeActor(actor: AuditEvent['actor']): Record<string, { S: string } | { SS: string[] }> {
    const result: Record<string, { S: string } | { SS: string[] }> = {}
    if (actor.userId) result.userId = { S: actor.userId }
    if (actor.tenantId) result.tenantId = { S: actor.tenantId }
    if (actor.ipAddress) result.ipAddress = { S: actor.ipAddress }
    if (actor.userAgent) result.userAgent = { S: actor.userAgent }
    if (actor.sessionId) result.sessionId = { S: actor.sessionId }
    if (actor.roles) result.roles = { SS: actor.roles }
    return result
  }

  private serializeTarget(target: AuditEvent['target']): Record<string, { S: string } | { N: string }> {
    const result: Record<string, { S: string } | { N: string }> = {}
    if (target.tableName) result.tableName = { S: target.tableName }
    if (target.entityType) result.entityType = { S: target.entityType }
    if (target.pk) result.pk = { S: target.pk }
    if (target.sk) result.sk = { S: target.sk }
    if (target.itemCount !== undefined) result.itemCount = { N: String(target.itemCount) }
    return result
  }

  private serializeOperation(operation: AuditEvent['operation']): Record<string, { S: string } | { N: string }> {
    const result: Record<string, { S: string } | { N: string }> = {
      name: { S: operation.name },
    }
    if (operation.durationMs !== undefined) {
      result.durationMs = { N: String(operation.durationMs) }
    }
    if (operation.consumedCapacity) {
      if (operation.consumedCapacity.readUnits !== undefined) {
        result.readUnits = { N: String(operation.consumedCapacity.readUnits) }
      }
      if (operation.consumedCapacity.writeUnits !== undefined) {
        result.writeUnits = { N: String(operation.consumedCapacity.writeUnits) }
      }
    }
    return result
  }
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  /** Enable audit logging */
  enabled: boolean
  /** Storage backends */
  storage: AuditStorage[]
  /** Events to log */
  events?: AuditEventType[]
  /** Events to exclude */
  excludeEvents?: AuditEventType[]
  /** Include item data in logs */
  includeItemData?: boolean
  /** Redact sensitive fields */
  redactFields?: string[]
  /** Async logging (don't wait for storage) */
  async?: boolean
}

/**
 * Audit logger
 */
export class AuditLogger {
  private config: AuditLoggerConfig
  private idCounter = 0

  constructor(config: AuditLoggerConfig) {
    this.config = {
      includeItemData: false,
      redactFields: ['password', 'secret', 'token', 'apiKey', 'creditCard'],
      async: true,
      ...config,
    }
  }

  /**
   * Log an audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    if (!this.config.enabled) {
      return ''
    }

    // Check if this event type should be logged
    if (this.config.events && !this.config.events.includes(event.type)) {
      return ''
    }
    if (this.config.excludeEvents?.includes(event.type)) {
      return ''
    }

    const fullEvent: AuditEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
      changes: event.changes ? this.redactChanges(event.changes) : undefined,
    }

    if (this.config.async) {
      // Fire and forget
      Promise.all(
        this.config.storage.map(storage => storage.store(fullEvent)),
      ).catch(err => console.error('Audit logging failed:', err))
    }
    else {
      await Promise.all(
        this.config.storage.map(storage => storage.store(fullEvent)),
      )
    }

    return fullEvent.id
  }

  /**
   * Log a create operation
   */
  create(
    tableName: string,
    item: Record<string, unknown>,
    actor: AuditEvent['actor'],
    options?: { entityType?: string, durationMs?: number, requestId?: string },
  ): Promise<string> {
    return this.log({
      type: 'CREATE',
      status: 'SUCCESS',
      actor,
      target: {
        tableName,
        entityType: options?.entityType || (item._et as string),
        pk: item.pk as string,
        sk: item.sk as string,
        itemCount: 1,
      },
      operation: {
        name: 'PutItem',
        durationMs: options?.durationMs,
      },
      changes: this.config.includeItemData
        ? { after: item }
        : undefined,
      requestId: options?.requestId,
    })
  }

  /**
   * Log an update operation
   */
  update(
    tableName: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    actor: AuditEvent['actor'],
    options?: { entityType?: string, durationMs?: number, requestId?: string },
  ): Promise<string> {
    const changedAttributes = this.getChangedAttributes(before, after)

    return this.log({
      type: 'UPDATE',
      status: 'SUCCESS',
      actor,
      target: {
        tableName,
        entityType: options?.entityType || (after._et as string),
        pk: after.pk as string,
        sk: after.sk as string,
        itemCount: 1,
      },
      operation: {
        name: 'UpdateItem',
        durationMs: options?.durationMs,
      },
      changes: {
        before: this.config.includeItemData ? before : undefined,
        after: this.config.includeItemData ? after : undefined,
        changedAttributes,
      },
      requestId: options?.requestId,
    })
  }

  /**
   * Log a delete operation
   */
  delete(
    tableName: string,
    item: Record<string, unknown>,
    actor: AuditEvent['actor'],
    options?: { entityType?: string, durationMs?: number, requestId?: string },
  ): Promise<string> {
    return this.log({
      type: 'DELETE',
      status: 'SUCCESS',
      actor,
      target: {
        tableName,
        entityType: options?.entityType || (item._et as string),
        pk: item.pk as string,
        sk: item.sk as string,
        itemCount: 1,
      },
      operation: {
        name: 'DeleteItem',
        durationMs: options?.durationMs,
      },
      changes: this.config.includeItemData
        ? { before: item }
        : undefined,
      requestId: options?.requestId,
    })
  }

  /**
   * Log an access denied event
   */
  accessDenied(
    action: string,
    tableName: string,
    actor: AuditEvent['actor'],
    reason: string,
    options?: { pk?: string, sk?: string, requestId?: string },
  ): Promise<string> {
    return this.log({
      type: 'ACCESS_DENIED',
      status: 'DENIED',
      actor,
      target: {
        tableName,
        pk: options?.pk,
        sk: options?.sk,
      },
      operation: {
        name: action,
      },
      error: {
        code: 'ACCESS_DENIED',
        message: reason,
      },
      requestId: options?.requestId,
    })
  }

  /**
   * Query audit logs
   */
  async query(options: AuditQueryOptions): Promise<AuditQueryResult> {
    // Find first storage that supports querying
    for (const storage of this.config.storage) {
      if (storage.query) {
        return storage.query(options)
      }
    }

    return { events: [] }
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36)
    const counter = (this.idCounter++).toString(36).padStart(4, '0')
    const random = Math.random().toString(36).substring(2, 6)
    return `${timestamp}-${counter}-${random}`
  }

  private redactChanges(changes: AuditEvent['changes']): AuditEvent['changes'] {
    if (!changes) return changes

    return {
      before: changes.before ? this.redactObject(changes.before) : undefined,
      after: changes.after ? this.redactObject(changes.after) : undefined,
      changedAttributes: changes.changedAttributes,
    }
  }

  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (this.config.redactFields?.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        result[key] = '[REDACTED]'
      }
      else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.redactObject(value as Record<string, unknown>)
      }
      else {
        result[key] = value
      }
    }

    return result
  }

  private getChangedAttributes(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): string[] {
    const changed: string[] = []
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed.push(key)
      }
    }

    return changed
  }
}

/**
 * Create an audit logger
 */
export function createAuditLogger(config: AuditLoggerConfig): AuditLogger {
  return new AuditLogger(config)
}
