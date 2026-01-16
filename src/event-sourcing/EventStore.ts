// ============================================================================
// Event Store - Event Sourcing for DynamoDB
// ============================================================================

/**
 * DynamoDB AttributeValue types for event items
 */
export interface AttributeValue {
  S?: string
  N?: string
  B?: string
  BOOL?: boolean
  NULL?: boolean
  M?: Record<string, AttributeValue>
  L?: AttributeValue[]
  SS?: string[]
  NS?: string[]
  BS?: string[]
}

/**
 * Event item in DynamoDB format
 */
export interface EventItem {
  pk: { S: string }
  sk: { S: string }
  eventId: { S: string }
  eventType: { S: string }
  aggregateId: { S: string }
  aggregateType: { S: string }
  version: { N: string }
  data: { S: string }
  metadata: { S: string } | { NULL: boolean }
  timestamp: { S: string }
  correlationId: { S: string } | { NULL: boolean }
  causationId: { S: string } | { NULL: boolean }
  _et: { S: string }
  [key: string]: AttributeValue
}

/**
 * Domain event
 */
export interface DomainEvent<T = unknown> {
  /** Event ID */
  eventId: string
  /** Event type */
  eventType: string
  /** Aggregate ID */
  aggregateId: string
  /** Aggregate type */
  aggregateType: string
  /** Event version (sequence number) */
  version: number
  /** Event data */
  data: T
  /** Event metadata */
  metadata?: Record<string, unknown>
  /** Timestamp */
  timestamp: Date
  /** Correlation ID */
  correlationId?: string
  /** Causation ID */
  causationId?: string
}

/**
 * Event stream
 */
export interface EventStream {
  /** Aggregate ID */
  aggregateId: string
  /** Aggregate type */
  aggregateType: string
  /** Current version */
  version: number
  /** Events in the stream */
  events: DomainEvent[]
}

/**
 * Event store options
 */
export interface EventStoreOptions {
  /** Table name */
  tableName: string
  /** Snapshot table name (optional) */
  snapshotTableName?: string
  /** Snapshot frequency (every N events) */
  snapshotFrequency?: number
  /** Event TTL in seconds (optional) */
  eventTTL?: number
  /** Partition strategy (optional) */
  partitionStrategy?: 'aggregate' | 'time' | 'hybrid'
}

/**
 * Snapshot
 */
export interface Snapshot<T = unknown> {
  /** Aggregate ID */
  aggregateId: string
  /** Aggregate type */
  aggregateType: string
  /** Version at snapshot */
  version: number
  /** State data */
  state: T
  /** Timestamp */
  timestamp: Date
}

/**
 * Event handler
 */
export type EventHandler<T = unknown> = (event: DomainEvent<T>) => void | Promise<void>

/**
 * Resolved event store options with defaults applied
 */
type ResolvedEventStoreOptions = Required<Pick<EventStoreOptions, 'tableName' | 'snapshotTableName' | 'snapshotFrequency'>> & {
  eventTTL?: number
  partitionStrategy?: 'aggregate' | 'time' | 'hybrid'
}

/**
 * Event store for DynamoDB
 */
export class EventStore {
  private options: ResolvedEventStoreOptions
  private handlers: Map<string, EventHandler[]> = new Map()

  constructor(options: EventStoreOptions) {
    this.options = {
      snapshotTableName: `${options.tableName}-snapshots`,
      snapshotFrequency: 100,
      ...options,
    }
  }

  /**
   * Generate append event command
   */
  appendEvent<T>(event: Omit<DomainEvent<T>, 'eventId' | 'timestamp'>): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: EventItem
      ConditionExpression: string
      ExpressionAttributeNames: Record<string, string>
    }
  } {
    const eventId = this.generateEventId()
    const timestamp = new Date()

    return {
      command: 'PutItem',
      input: {
        TableName: this.options.tableName,
        Item: {
          pk: { S: `AGG#${event.aggregateType}#${event.aggregateId}` },
          sk: { S: `EVENT#${String(event.version).padStart(10, '0')}` },
          eventId: { S: eventId },
          eventType: { S: event.eventType },
          aggregateId: { S: event.aggregateId },
          aggregateType: { S: event.aggregateType },
          version: { N: String(event.version) },
          data: { S: JSON.stringify(event.data) },
          metadata: event.metadata ? { S: JSON.stringify(event.metadata) } : { NULL: true },
          timestamp: { S: timestamp.toISOString() },
          correlationId: event.correlationId ? { S: event.correlationId } : { NULL: true },
          causationId: event.causationId ? { S: event.causationId } : { NULL: true },
          _et: { S: 'Event' },
        },
        ConditionExpression: 'attribute_not_exists(#pk)',
        ExpressionAttributeNames: {
          '#pk': 'pk',
        },
      },
    }
  }

  /**
   * Generate query command to get events for an aggregate
   */
  getEventsCommand(
    aggregateType: string,
    aggregateId: string,
    options?: number | {
      fromVersion?: number
      toVersion?: number
      limit?: number
      ascending?: boolean
    },
  ): {
      command: 'Query'
      input: {
        TableName: string
        KeyConditionExpression: string
        ExpressionAttributeNames: Record<string, string>
        ExpressionAttributeValues: Record<string, unknown>
        ScanIndexForward: boolean
        Limit?: number
      }
    } {
    // Handle backward compatibility: number = fromVersion
    const opts = typeof options === 'number'
      ? { fromVersion: options }
      : options ?? {}

    const fromVersion = opts.fromVersion
    const skCondition = fromVersion
      ? '#sk >= :skStart'
      : 'begins_with(#sk, :skPrefix)'

    const skValue = fromVersion
      ? { S: `EVENT#${String(fromVersion).padStart(10, '0')}` }
      : { S: 'EVENT#' }

    const input: {
      TableName: string
      KeyConditionExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
      ScanIndexForward: boolean
      Limit?: number
    } = {
      TableName: this.options.tableName,
      KeyConditionExpression: `#pk = :pk AND ${skCondition}`,
      ExpressionAttributeNames: {
        '#pk': 'pk',
        '#sk': 'sk',
      },
      ExpressionAttributeValues: {
        ':pk': { S: `AGG#${aggregateType}#${aggregateId}` },
        [fromVersion ? ':skStart' : ':skPrefix']: skValue,
      },
      ScanIndexForward: opts.ascending ?? true,
    }

    if (opts.limit) {
      input.Limit = opts.limit
    }

    return {
      command: 'Query',
      input,
    }
  }

  /**
   * Parse events from DynamoDB response
   */
  parseEvents<T = unknown>(items: Record<string, unknown>[]): DomainEvent<T>[] {
    return items.map((item) => {
      const _pk = (item.pk as { S: string }).S
      const data = (item.data as { S: string }).S

      return {
        eventId: (item.eventId as { S: string }).S,
        eventType: (item.eventType as { S: string }).S,
        aggregateId: (item.aggregateId as { S: string }).S,
        aggregateType: (item.aggregateType as { S: string }).S,
        version: Number((item.version as { N: string }).N),
        data: JSON.parse(data) as T,
        metadata: item.metadata && 'S' in (item.metadata as object)
          ? JSON.parse((item.metadata as { S: string }).S)
          : undefined,
        timestamp: new Date((item.timestamp as { S: string }).S),
        correlationId: item.correlationId && 'S' in (item.correlationId as object)
          ? (item.correlationId as { S: string }).S
          : undefined,
        causationId: item.causationId && 'S' in (item.causationId as object)
          ? (item.causationId as { S: string }).S
          : undefined,
      }
    })
  }

  /**
   * Generate save snapshot command
   */
  saveSnapshotCommand<T>(snapshot: Omit<Snapshot<T>, 'timestamp'>): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: Record<string, unknown>
    }
  } {
    return {
      command: 'PutItem',
      input: {
        TableName: this.options.snapshotTableName,
        Item: {
          pk: { S: `SNAP#${snapshot.aggregateType}#${snapshot.aggregateId}` },
          sk: { S: `VERSION#${String(snapshot.version).padStart(10, '0')}` },
          aggregateId: { S: snapshot.aggregateId },
          aggregateType: { S: snapshot.aggregateType },
          version: { N: String(snapshot.version) },
          state: { S: JSON.stringify(snapshot.state) },
          timestamp: { S: new Date().toISOString() },
          _et: { S: 'Snapshot' },
        },
      },
    }
  }

  /**
   * Generate get latest snapshot command
   */
  getLatestSnapshotCommand(
    aggregateType: string,
    aggregateId: string,
  ): {
      command: 'Query'
      input: {
        TableName: string
        KeyConditionExpression: string
        ExpressionAttributeNames: Record<string, string>
        ExpressionAttributeValues: Record<string, unknown>
        ScanIndexForward: boolean
        Limit: number
      }
    } {
    return {
      command: 'Query',
      input: {
        TableName: this.options.snapshotTableName,
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skPrefix)',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          '#sk': 'sk',
        },
        ExpressionAttributeValues: {
          ':pk': { S: `SNAP#${aggregateType}#${aggregateId}` },
          ':skPrefix': { S: 'VERSION#' },
        },
        ScanIndexForward: false, // Latest first
        Limit: 1,
      },
    }
  }

  /**
   * Parse snapshot from DynamoDB response
   */
  parseSnapshot<T = unknown>(item: Record<string, unknown>): Snapshot<T> {
    return {
      aggregateId: (item.aggregateId as { S: string }).S,
      aggregateType: (item.aggregateType as { S: string }).S,
      version: Number((item.version as { N: string }).N),
      state: JSON.parse((item.state as { S: string }).S) as T,
      timestamp: new Date((item.timestamp as { S: string }).S),
    }
  }

  /**
   * Check if snapshot should be taken
   */
  shouldSnapshot(currentVersion: number): boolean {
    return currentVersion % this.options.snapshotFrequency === 0
  }

  /**
   * Register event handler
   */
  on<T>(eventType: string, handler: EventHandler<T>): this {
    const handlers = this.handlers.get(eventType) || []
    handlers.push(handler as EventHandler)
    this.handlers.set(eventType, handlers)
    return this
  }

  /**
   * Dispatch event to handlers
   */
  async dispatch<T>(event: DomainEvent<T>): Promise<void> {
    // Type-specific handlers
    const typeHandlers = this.handlers.get(event.eventType) || []
    for (const handler of typeHandlers) {
      await handler(event)
    }

    // Wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || []
    for (const handler of wildcardHandlers) {
      await handler(event)
    }
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.options.tableName
  }

  /**
   * Get snapshot table name
   */
  getSnapshotTableName(): string {
    return this.options.snapshotTableName
  }

  /**
   * Alias for getLatestSnapshotCommand
   */
  getSnapshotCommand(aggregateType: string, aggregateId: string): ReturnType<EventStore['getLatestSnapshotCommand']> {
    return this.getLatestSnapshotCommand(aggregateType, aggregateId)
  }

  /**
   * Append event with optimistic locking
   */
  appendEventWithLock<T>(
    event: Omit<DomainEvent<T>, 'eventId' | 'timestamp'>,
    expectedVersion: number,
  ): {
      command: 'PutItem'
      input: {
        TableName: string
        Item: EventItem
        ConditionExpression: string
        ExpressionAttributeNames: Record<string, string>
        ExpressionAttributeValues: Record<string, unknown>
      }
    } {
    const cmd = this.appendEvent(event)
    return {
      command: cmd.command,
      input: {
        TableName: cmd.input.TableName,
        Item: cmd.input.Item,
        ConditionExpression: 'attribute_not_exists(#pk) OR #version < :expectedVersion',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          '#version': 'version',
        },
        ExpressionAttributeValues: {
          ':expectedVersion': { N: String(expectedVersion) },
        },
      },
    }
  }

  /**
   * Create a projection query
   */
  createProjectionQuery(
    aggregateType: string,
    options?: { eventTypes?: string[], fromTimestamp?: Date },
  ): {
      command: 'Scan'
      input: {
        TableName: string
        FilterExpression: string
        ExpressionAttributeValues: Record<string, unknown>
      }
    } {
    const filterExpressions: string[] = []
    const expressionAttributeValues: Record<string, unknown> = {
      ':pkPrefix': { S: `AGG#${aggregateType}#` },
    }

    if (options?.eventTypes?.length) {
      const typeConditions = options.eventTypes.map((_, i) => `:eventType${i}`)
      filterExpressions.push(`eventType IN (${typeConditions.join(', ')})`)
      options.eventTypes.forEach((type, i) => {
        expressionAttributeValues[`:eventType${i}`] = { S: type }
      })
    }

    if (options?.fromTimestamp) {
      filterExpressions.push('timestamp >= :fromTimestamp')
      expressionAttributeValues[':fromTimestamp'] = { S: options.fromTimestamp.toISOString() }
    }

    const filterExpression: string = filterExpressions.length > 0
      ? `begins_with(pk, :pkPrefix) AND ${filterExpressions.join(' AND ')}`
      : 'begins_with(pk, :pkPrefix)'

    return {
      command: 'Scan',
      input: {
        TableName: this.options.tableName,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      },
    }
  }

  private generateEventId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`
  }
}

/**
 * Create an event store
 */
export function createEventStore(options: EventStoreOptions): EventStore {
  return new EventStore(options)
}

/**
 * Aggregate root base class
 */
export class AggregateRoot<TState = unknown> {
  public id: string
  protected type: string
  public version: number = 0
  protected state: TState
  protected uncommittedEvents: DomainEvent[] = []

  constructor(id: string, type?: string, initialState?: TState) {
    this.id = id
    this.type = type ?? this.constructor.name
    this.state = initialState ?? {} as TState
  }

  /**
   * Apply an event
   */
  protected apply<T>(eventType: string, data: T, metadata?: Record<string, unknown>): void {
    this.version++

    const event: DomainEvent<T> = {
      eventId: '',
      eventType,
      aggregateId: this.id,
      aggregateType: this.type,
      version: this.version,
      data,
      metadata,
      timestamp: new Date(),
    }

    this.uncommittedEvents.push(event)
    this.mutate(event)
  }

  /**
   * Mutate state based on event (override in subclass)
   * Default implementation does nothing - override to handle events
   */
  protected mutate(_event: DomainEvent): void {
    // Default no-op - subclasses should override
  }

  /**
   * Replay events to rebuild state
   */
  replay(events: DomainEvent[]): void {
    for (const event of events) {
      this.mutate(event)
      this.version = event.version
    }
  }

  /**
   * Load from snapshot
   */
  loadFromSnapshot(snapshot: Snapshot<TState>): void {
    this.state = snapshot.state
    this.version = snapshot.version
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents]
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this.uncommittedEvents = []
  }

  /**
   * Alias for markEventsAsCommitted
   */
  markChangesAsCommitted(): void {
    this.markEventsAsCommitted()
  }

  /**
   * Raise an event (public alias for apply)
   */
  raiseEvent<T>(eventType: string, data: T, metadata?: Record<string, unknown>): void {
    this.apply(eventType, data, metadata)
  }

  /**
   * Load from history (alias for replay)
   */
  loadFromHistory(events: DomainEvent[]): void {
    this.replay(events)
  }

  /**
   * Get aggregate ID
   */
  getId(): string {
    return this.id
  }

  /**
   * Get current version
   */
  getVersion(): number {
    return this.version
  }

  /**
   * Get current state
   */
  getState(): TState {
    return this.state
  }

  /**
   * Create snapshot
   */
  createSnapshot(): Omit<Snapshot<TState>, 'timestamp'> {
    return {
      aggregateId: this.id,
      aggregateType: this.type,
      version: this.version,
      state: this.state,
    }
  }
}
