// ============================================================================
// Stream Processor - DynamoDB Streams Processing
// ============================================================================

/**
 * Stream event types
 */
export type StreamEventType = 'INSERT' | 'MODIFY' | 'REMOVE'

/**
 * Stream record (individual change)
 */
export interface StreamRecord {
  /** Event type */
  eventType: StreamEventType
  /** Table name */
  tableName: string
  /** Entity type (from _et attribute) */
  entityType?: string
  /** Key attributes */
  keys: {
    pk: string
    sk?: string
  }
  /** New item (for INSERT and MODIFY) */
  newImage?: Record<string, unknown>
  /** Old item (for MODIFY and REMOVE) */
  oldImage?: Record<string, unknown>
  /** Approximate creation timestamp */
  timestamp: number
  /** Sequence number */
  sequenceNumber: string
  /** Stream ARN */
  streamArn?: string
  /** Event ID */
  eventId?: string
}

/**
 * Batch of stream events
 */
export interface StreamEvent {
  /** Records in this batch */
  records: StreamRecord[]
  /** Source ARN */
  sourceArn?: string
  /** Shard ID */
  shardId?: string
  /** Starting sequence number */
  startingSequenceNumber?: string
  /** Ending sequence number */
  endingSequenceNumber?: string
}

/**
 * Stream handler function
 */
export type StreamHandler = (record: StreamRecord) => void | Promise<void>

/**
 * Entity-specific handler configuration
 */
export interface EntityHandler {
  /** Entity type to match (e.g., 'User', 'Order') */
  entityType: string
  /** Handler for INSERT events */
  onInsert?: StreamHandler
  /** Handler for MODIFY events */
  onModify?: StreamHandler
  /** Handler for REMOVE events */
  onRemove?: StreamHandler
  /** Handler for all events */
  onAny?: StreamHandler
}

/**
 * Stream processor configuration
 */
export interface StreamProcessorConfig {
  /** Maximum concurrent handlers */
  concurrency?: number
  /** Error handling mode */
  errorMode?: 'throw' | 'skip' | 'log'
  /** Retry configuration */
  retry?: {
    enabled: boolean
    maxRetries: number
    backoffMs: number
  }
  /** Filter predicate */
  filter?: (record: StreamRecord) => boolean
  /** Transform records before processing */
  transform?: (record: StreamRecord) => StreamRecord
  /** Enable metrics collection */
  metrics?: boolean
}

/**
 * Change data capture result
 */
export interface ChangeDataCapture {
  /** Event type */
  type: StreamEventType
  /** Entity type */
  entityType?: string
  /** Primary key */
  pk: string
  /** Sort key */
  sk?: string
  /** Changed attributes (for MODIFY) */
  changedAttributes?: string[]
  /** Old values of changed attributes */
  oldValues?: Record<string, unknown>
  /** New values of changed attributes */
  newValues?: Record<string, unknown>
  /** Full old image */
  before?: Record<string, unknown>
  /** Full new image */
  after?: Record<string, unknown>
  /** Timestamp */
  timestamp: number
}

/**
 * Stream processor statistics
 */
export interface StreamProcessorStats {
  /** Total records processed */
  totalProcessed: number
  /** Records by event type */
  byEventType: Record<StreamEventType, number>
  /** Records by entity type */
  byEntityType: Record<string, number>
  /** Errors encountered */
  errors: number
  /** Processing time statistics */
  processingTime: {
    total: number
    average: number
    min: number
    max: number
  }
  /** Last processed timestamp */
  lastProcessedAt?: number
}

/**
 * DynamoDB Streams processor
 */
export class StreamProcessor {
  private config: Required<StreamProcessorConfig>
  private handlers: StreamHandler[] = []
  private entityHandlers: Map<string, EntityHandler> = new Map()
  private stats: StreamProcessorStats

  constructor(config?: StreamProcessorConfig) {
    this.config = {
      concurrency: 10,
      errorMode: 'log',
      retry: {
        enabled: true,
        maxRetries: 3,
        backoffMs: 100,
      },
      filter: () => true,
      transform: r => r,
      metrics: true,
      ...config,
    }

    this.stats = {
      totalProcessed: 0,
      byEventType: { INSERT: 0, MODIFY: 0, REMOVE: 0 },
      byEntityType: {},
      errors: 0,
      processingTime: {
        total: 0,
        average: 0,
        min: Infinity,
        max: 0,
      },
    }
  }

  /**
   * Add a global handler for all events
   */
  addHandler(handler: StreamHandler): this {
    this.handlers.push(handler)
    return this
  }

  /**
   * Add entity-specific handlers
   */
  addEntityHandler(config: EntityHandler): this {
    this.entityHandlers.set(config.entityType, config)
    return this
  }

  /**
   * Add handler for specific event type
   */
  on(eventType: StreamEventType, handler: StreamHandler): this {
    this.handlers.push((record) => {
      if (record.eventType === eventType) {
        return handler(record)
      }
    })
    return this
  }

  /**
   * Add handler for INSERT events
   */
  onInsert(handler: StreamHandler): this {
    return this.on('INSERT', handler)
  }

  /**
   * Add handler for MODIFY events
   */
  onModify(handler: StreamHandler): this {
    return this.on('MODIFY', handler)
  }

  /**
   * Add handler for REMOVE events
   */
  onRemove(handler: StreamHandler): this {
    return this.on('REMOVE', handler)
  }

  /**
   * Process a stream event (batch of records)
   */
  async processEvent(event: StreamEvent): Promise<void> {
    const { records } = event

    for (let i = 0; i < records.length; i += this.config.concurrency) {
      const batch = records.slice(i, i + this.config.concurrency)
      await Promise.all(batch.map(record => this.processRecord(record)))
    }
  }

  /**
   * Process a single record
   */
  async processRecord(record: StreamRecord): Promise<void> {
    const startTime = Date.now()

    try {
      if (!this.config.filter(record)) {
        return
      }

      const transformedRecord = this.config.transform(record)

      for (const handler of this.handlers) {
        await this.executeHandler(handler, transformedRecord)
      }

      if (transformedRecord.entityType) {
        const entityHandler = this.entityHandlers.get(transformedRecord.entityType)
        if (entityHandler) {
          await this.executeEntityHandler(entityHandler, transformedRecord)
        }
      }

      this.updateStats(transformedRecord, Date.now() - startTime)
    }
    catch (error) {
      this.stats.errors++

      switch (this.config.errorMode) {
        case 'throw':
          throw error
        case 'log':
          console.error(`Stream processor error for record ${record.eventId}:`, error)
          break
        case 'skip':
          break
      }
    }
  }

  private async executeHandler(
    handler: StreamHandler,
    record: StreamRecord,
  ): Promise<void> {
    let lastError: Error | undefined
    const { retry } = this.config

    for (let attempt = 0; attempt <= (retry.enabled ? retry.maxRetries : 0); attempt++) {
      try {
        await handler(record)
        return
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (retry.enabled && attempt < retry.maxRetries) {
          await this.sleep(retry.backoffMs * 2 ** attempt)
        }
      }
    }

    throw lastError
  }

  private async executeEntityHandler(
    entityHandler: EntityHandler,
    record: StreamRecord,
  ): Promise<void> {
    switch (record.eventType) {
      case 'INSERT':
        if (entityHandler.onInsert) {
          await this.executeHandler(entityHandler.onInsert, record)
        }
        break
      case 'MODIFY':
        if (entityHandler.onModify) {
          await this.executeHandler(entityHandler.onModify, record)
        }
        break
      case 'REMOVE':
        if (entityHandler.onRemove) {
          await this.executeHandler(entityHandler.onRemove, record)
        }
        break
    }

    if (entityHandler.onAny) {
      await this.executeHandler(entityHandler.onAny, record)
    }
  }

  private updateStats(record: StreamRecord, processingTimeMs: number): void {
    if (!this.config.metrics)
      return

    this.stats.totalProcessed++
    this.stats.byEventType[record.eventType]++

    if (record.entityType) {
      this.stats.byEntityType[record.entityType] = (this.stats.byEntityType[record.entityType] || 0) + 1
    }

    this.stats.processingTime.total += processingTimeMs
    this.stats.processingTime.average = this.stats.processingTime.total / this.stats.totalProcessed
    this.stats.processingTime.min = Math.min(this.stats.processingTime.min, processingTimeMs)
    this.stats.processingTime.max = Math.max(this.stats.processingTime.max, processingTimeMs)
    this.stats.lastProcessedAt = Date.now()
  }

  getStats(): StreamProcessorStats {
    return { ...this.stats }
  }

  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      byEventType: { INSERT: 0, MODIFY: 0, REMOVE: 0 },
      byEntityType: {},
      errors: 0,
      processingTime: {
        total: 0,
        average: 0,
        min: Infinity,
        max: 0,
      },
    }
  }

  /**
   * Parse a Lambda DynamoDB stream event
   */
  static parseLambdaEvent(lambdaEvent: {
    Records?: Array<{
      eventID?: string
      eventName?: string
      eventSource?: string
      eventSourceARN?: string
      dynamodb?: {
        ApproximateCreationDateTime?: number
        Keys?: Record<string, { S?: string, N?: string }>
        NewImage?: Record<string, unknown>
        OldImage?: Record<string, unknown>
        SequenceNumber?: string
        StreamViewType?: string
      }
    }>
  }): StreamEvent {
    const records: StreamRecord[] = (lambdaEvent.Records || []).map((record) => {
      const dynamodb = record.dynamodb || {}

      const keys = {
        pk: dynamodb.Keys?.pk?.S || dynamodb.Keys?.pk?.N || '',
        sk: dynamodb.Keys?.sk?.S || dynamodb.Keys?.sk?.N,
      }

      const newImage = dynamodb.NewImage as Record<string, unknown> | undefined
      const oldImage = dynamodb.OldImage as Record<string, unknown> | undefined

      // Extract entity type from _et attribute, handling DynamoDB format
      const rawEntityType = newImage?._et || oldImage?._et
      let entityType: string | undefined
      if (rawEntityType) {
        // Handle DynamoDB format { S: "value" } or plain string
        if (typeof rawEntityType === 'object' && rawEntityType !== null && 'S' in rawEntityType) {
          entityType = (rawEntityType as { S: string }).S
        }
        else if (typeof rawEntityType === 'string') {
          entityType = rawEntityType
        }
      }

      return {
        eventType: record.eventName as StreamEventType,
        tableName: record.eventSourceARN?.split('/')[1] || '',
        entityType,
        keys,
        newImage,
        oldImage,
        timestamp: (dynamodb.ApproximateCreationDateTime || 0) * 1000,
        sequenceNumber: dynamodb.SequenceNumber || '',
        streamArn: record.eventSourceARN,
        eventId: record.eventID,
      }
    })

    return {
      records,
      sourceArn: lambdaEvent.Records?.[0]?.eventSourceARN,
    }
  }

  /**
   * Extract change data capture information from a record
   */
  static extractCDC(record: StreamRecord): ChangeDataCapture {
    const result: ChangeDataCapture = {
      type: record.eventType,
      entityType: record.entityType,
      pk: record.keys.pk,
      sk: record.keys.sk,
      timestamp: record.timestamp,
    }

    if (record.eventType === 'INSERT') {
      result.after = record.newImage
    }
    else if (record.eventType === 'REMOVE') {
      result.before = record.oldImage
    }
    else if (record.eventType === 'MODIFY') {
      result.before = record.oldImage
      result.after = record.newImage

      if (record.oldImage && record.newImage) {
        const changedAttributes: string[] = []
        const oldValues: Record<string, unknown> = {}
        const newValues: Record<string, unknown> = {}

        const allKeys = new Set([
          ...Object.keys(record.oldImage),
          ...Object.keys(record.newImage),
        ])

        for (const key of allKeys) {
          const oldVal = record.oldImage[key]
          const newVal = record.newImage[key]

          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changedAttributes.push(key)
            if (oldVal !== undefined)
              oldValues[key] = oldVal
            if (newVal !== undefined)
              newValues[key] = newVal
          }
        }

        result.changedAttributes = changedAttributes
        result.oldValues = oldValues
        result.newValues = newValues
      }
    }

    return result
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export function createStreamProcessor(config?: StreamProcessorConfig): StreamProcessor {
  return new StreamProcessor(config)
}
