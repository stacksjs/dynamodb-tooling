// ============================================================================
// Event Store - Event Sourcing for DynamoDB
// ============================================================================

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
 * Event store for DynamoDB
 */
export class EventStore {
  private options: Required<EventStoreOptions>
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
      Item: Record<string, unknown>
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
    fromVersion?: number,
  ): {
    command: 'Query'
    input: {
      TableName: string
      KeyConditionExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
      ScanIndexForward: boolean
    }
  } {
    const skCondition = fromVersion
      ? '#sk >= :skStart'
      : 'begins_with(#sk, :skPrefix)'

    const skValue = fromVersion
      ? { S: `EVENT#${String(fromVersion).padStart(10, '0')}` }
      : { S: 'EVENT#' }

    return {
      command: 'Query',
      input: {
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
        ScanIndexForward: true,
      },
    }
  }

  /**
   * Parse events from DynamoDB response
   */
  parseEvents<T = unknown>(items: Record<string, unknown>[]): DomainEvent<T>[] {
    return items.map((item) => {
      const pk = (item.pk as { S: string }).S
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
export abstract class AggregateRoot<TState = unknown> {
  protected id: string
  protected type: string
  protected version: number = 0
  protected state: TState
  protected uncommittedEvents: DomainEvent[] = []

  constructor(id: string, type: string, initialState: TState) {
    this.id = id
    this.type = type
    this.state = initialState
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
   * Mutate state based on event (implement in subclass)
   */
  protected abstract mutate(event: DomainEvent): void

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
   * Get current state
   */
  getState(): TState {
    return this.state
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
