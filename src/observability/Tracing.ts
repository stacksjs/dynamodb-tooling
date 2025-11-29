// ============================================================================
// Tracing - Distributed Tracing for DynamoDB Operations
// ============================================================================

/**
 * Span status
 */
export type SpanStatus = 'OK' | 'ERROR' | 'UNSET'

/**
 * Span kind
 */
export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER'

/**
 * Span attributes
 */
export interface SpanAttributes {
  [key: string]: string | number | boolean | string[] | number[] | boolean[]
}

/**
 * Span event
 */
export interface SpanEvent {
  /** Event name */
  name: string
  /** Timestamp */
  timestamp: Date
  /** Attributes */
  attributes?: SpanAttributes
}

/**
 * Span link
 */
export interface SpanLink {
  /** Trace ID */
  traceId: string
  /** Span ID */
  spanId: string
  /** Attributes */
  attributes?: SpanAttributes
}

/**
 * Span data
 */
export interface SpanData {
  /** Trace ID */
  traceId: string
  /** Span ID */
  spanId: string
  /** Parent span ID */
  parentSpanId?: string
  /** Operation name */
  name: string
  /** Span kind */
  kind: SpanKind
  /** Start time */
  startTime: Date
  /** End time */
  endTime?: Date
  /** Duration in milliseconds */
  durationMs?: number
  /** Status */
  status: SpanStatus
  /** Status message (for errors) */
  statusMessage?: string
  /** Attributes */
  attributes: SpanAttributes
  /** Events */
  events: SpanEvent[]
  /** Links to other spans */
  links: SpanLink[]
}

/**
 * DynamoDB-specific span attributes
 */
export const DynamoDBSpanAttributes = {
  // Common attributes
  DB_SYSTEM: 'db.system',
  DB_NAME: 'db.name',
  DB_OPERATION: 'db.operation',
  DB_STATEMENT: 'db.statement',

  // DynamoDB-specific
  AWS_DYNAMODB_TABLE_NAMES: 'aws.dynamodb.table_names',
  AWS_DYNAMODB_CONSUMED_CAPACITY: 'aws.dynamodb.consumed_capacity',
  AWS_DYNAMODB_ITEM_COLLECTION_METRICS: 'aws.dynamodb.item_collection_metrics',
  AWS_DYNAMODB_PROVISIONED_READ_CAPACITY: 'aws.dynamodb.provisioned_read_capacity',
  AWS_DYNAMODB_PROVISIONED_WRITE_CAPACITY: 'aws.dynamodb.provisioned_write_capacity',
  AWS_DYNAMODB_CONSISTENT_READ: 'aws.dynamodb.consistent_read',
  AWS_DYNAMODB_PROJECTION: 'aws.dynamodb.projection',
  AWS_DYNAMODB_LIMIT: 'aws.dynamodb.limit',
  AWS_DYNAMODB_SCAN_FORWARD: 'aws.dynamodb.scan_forward',
  AWS_DYNAMODB_INDEX_NAME: 'aws.dynamodb.index_name',
  AWS_DYNAMODB_SELECT: 'aws.dynamodb.select',
  AWS_DYNAMODB_SCANNED_COUNT: 'aws.dynamodb.scanned_count',
  AWS_DYNAMODB_COUNT: 'aws.dynamodb.count',

  // Custom attributes
  DYNAMODB_ENTITY_TYPE: 'dynamodb.entity_type',
  DYNAMODB_PARTITION_KEY: 'dynamodb.partition_key',
  DYNAMODB_SORT_KEY: 'dynamodb.sort_key',
  DYNAMODB_TENANT_ID: 'dynamodb.tenant_id',
  DYNAMODB_RETRY_COUNT: 'dynamodb.retry_count',
  DYNAMODB_THROTTLED: 'dynamodb.throttled',
}

/**
 * Span interface
 */
export interface Span {
  /** Get span data */
  getData(): SpanData
  /** Set attribute */
  setAttribute(key: string, value: string | number | boolean | string[] | number[] | boolean[]): this
  /** Set multiple attributes */
  setAttributes(attributes: SpanAttributes): this
  /** Add event */
  addEvent(name: string, attributes?: SpanAttributes): this
  /** Add link */
  addLink(traceId: string, spanId: string, attributes?: SpanAttributes): this
  /** Set status */
  setStatus(status: SpanStatus, message?: string): this
  /** Record exception */
  recordException(error: Error): this
  /** End the span */
  end(): void
  /** Check if span is recording */
  isRecording(): boolean
}

/**
 * Span implementation
 */
class SpanImpl implements Span {
  private data: SpanData
  private recording: boolean = true

  constructor(
    name: string,
    options: {
      traceId?: string
      parentSpanId?: string
      kind?: SpanKind
      attributes?: SpanAttributes
    } = {},
  ) {
    this.data = {
      traceId: options.traceId || this.generateId(32),
      spanId: this.generateId(16),
      parentSpanId: options.parentSpanId,
      name,
      kind: options.kind || 'INTERNAL',
      startTime: new Date(),
      status: 'UNSET',
      attributes: {
        [DynamoDBSpanAttributes.DB_SYSTEM]: 'dynamodb',
        ...options.attributes,
      },
      events: [],
      links: [],
    }
  }

  getData(): SpanData {
    return { ...this.data }
  }

  setAttribute(key: string, value: string | number | boolean | string[] | number[] | boolean[]): this {
    if (this.recording) {
      this.data.attributes[key] = value
    }
    return this
  }

  setAttributes(attributes: SpanAttributes): this {
    if (this.recording) {
      Object.assign(this.data.attributes, attributes)
    }
    return this
  }

  addEvent(name: string, attributes?: SpanAttributes): this {
    if (this.recording) {
      this.data.events.push({
        name,
        timestamp: new Date(),
        attributes,
      })
    }
    return this
  }

  addLink(traceId: string, spanId: string, attributes?: SpanAttributes): this {
    if (this.recording) {
      this.data.links.push({ traceId, spanId, attributes })
    }
    return this
  }

  setStatus(status: SpanStatus, message?: string): this {
    if (this.recording) {
      this.data.status = status
      if (message) {
        this.data.statusMessage = message
      }
    }
    return this
  }

  recordException(error: Error): this {
    if (this.recording) {
      this.addEvent('exception', {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack || '',
      })
      this.setStatus('ERROR', error.message)
    }
    return this
  }

  end(): void {
    if (this.recording) {
      this.data.endTime = new Date()
      this.data.durationMs = this.data.endTime.getTime() - this.data.startTime.getTime()
      this.recording = false
    }
  }

  isRecording(): boolean {
    return this.recording
  }

  private generateId(length: number): string {
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }
}

/**
 * Trace context for propagation
 */
export interface TraceContext {
  /** Trace ID */
  traceId: string
  /** Span ID */
  spanId: string
  /** Trace flags */
  traceFlags?: number
  /** Trace state */
  traceState?: string
}

/**
 * Span exporter interface
 */
export interface SpanExporter {
  /** Exporter name */
  name: string
  /** Export spans */
  export(spans: SpanData[]): void | Promise<void>
  /** Shutdown exporter */
  shutdown?(): void | Promise<void>
}

/**
 * Console span exporter (for debugging)
 */
export class ConsoleSpanExporter implements SpanExporter {
  name = 'console'

  export(spans: SpanData[]): void {
    for (const span of spans) {
      console.log(`[TRACE] ${span.name}`)
      console.log(`  TraceId: ${span.traceId}`)
      console.log(`  SpanId: ${span.spanId}`)
      if (span.parentSpanId) {
        console.log(`  ParentSpanId: ${span.parentSpanId}`)
      }
      console.log(`  Duration: ${span.durationMs}ms`)
      console.log(`  Status: ${span.status}`)
      if (Object.keys(span.attributes).length > 0) {
        console.log(`  Attributes:`, span.attributes)
      }
      if (span.events.length > 0) {
        console.log(`  Events:`, span.events)
      }
    }
  }
}

/**
 * OTLP-compatible span exporter
 */
export class OTLPSpanExporter implements SpanExporter {
  name = 'otlp'
  private endpoint: string
  private headers: Record<string, string>

  constructor(options: { endpoint: string, headers?: Record<string, string> }) {
    this.endpoint = options.endpoint
    this.headers = options.headers || {}
  }

  async export(spans: SpanData[]): Promise<void> {
    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'dynamodb-tooling' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'dynamodb-tooling' },
              spans: spans.map(span => this.convertSpan(span)),
            },
          ],
        },
      ],
    }

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(payload),
      })
    }
    catch (error) {
      console.error('Failed to export spans to OTLP:', error)
    }
  }

  private convertSpan(span: SpanData): Record<string, unknown> {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: this.convertKind(span.kind),
      startTimeUnixNano: span.startTime.getTime() * 1_000_000,
      endTimeUnixNano: span.endTime ? span.endTime.getTime() * 1_000_000 : undefined,
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: this.convertValue(value),
      })),
      events: span.events.map(event => ({
        name: event.name,
        timeUnixNano: event.timestamp.getTime() * 1_000_000,
        attributes: event.attributes
          ? Object.entries(event.attributes).map(([key, value]) => ({
              key,
              value: this.convertValue(value),
            }))
          : [],
      })),
      status: {
        code: span.status === 'OK' ? 1 : span.status === 'ERROR' ? 2 : 0,
        message: span.statusMessage,
      },
    }
  }

  private convertKind(kind: SpanKind): number {
    const kinds: Record<SpanKind, number> = {
      INTERNAL: 1,
      SERVER: 2,
      CLIENT: 3,
      PRODUCER: 4,
      CONSUMER: 5,
    }
    return kinds[kind] || 0
  }

  private convertValue(value: string | number | boolean | string[] | number[] | boolean[]): Record<string, unknown> {
    if (typeof value === 'string') return { stringValue: value }
    if (typeof value === 'number') return Number.isInteger(value) ? { intValue: value } : { doubleValue: value }
    if (typeof value === 'boolean') return { boolValue: value }
    if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map(v => this.convertValue(v)),
        },
      }
    }
    return { stringValue: String(value) }
  }
}

/**
 * Tracer for creating spans
 */
export class Tracer {
  private exporters: SpanExporter[] = []
  private activeSpans: Map<string, Span> = new Map()
  private completedSpans: SpanData[] = []
  private batchSize: number
  private flushInterval: ReturnType<typeof setInterval> | null = null

  constructor(options?: {
    exporters?: SpanExporter[]
    batchSize?: number
    flushIntervalMs?: number
  }) {
    this.exporters = options?.exporters || []
    this.batchSize = options?.batchSize || 100

    if (options?.flushIntervalMs) {
      this.flushInterval = setInterval(() => this.flush(), options.flushIntervalMs)
    }
  }

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    options?: {
      parent?: Span | TraceContext
      kind?: SpanKind
      attributes?: SpanAttributes
    },
  ): Span {
    let traceId: string | undefined
    let parentSpanId: string | undefined

    if (options?.parent) {
      if ('getData' in options.parent) {
        const parentData = options.parent.getData()
        traceId = parentData.traceId
        parentSpanId = parentData.spanId
      }
      else {
        traceId = options.parent.traceId
        parentSpanId = options.parent.spanId
      }
    }

    const span = new SpanImpl(name, {
      traceId,
      parentSpanId,
      kind: options?.kind,
      attributes: options?.attributes,
    })

    this.activeSpans.set(span.getData().spanId, span)

    return span
  }

  /**
   * Start a DynamoDB operation span
   */
  startDynamoDBSpan(
    operation: string,
    options: {
      tableName?: string
      indexName?: string
      partitionKey?: string
      sortKey?: string
      entityType?: string
      tenantId?: string
      parent?: Span | TraceContext
    } = {},
  ): Span {
    const attributes: SpanAttributes = {
      [DynamoDBSpanAttributes.DB_OPERATION]: operation,
    }

    if (options.tableName) {
      attributes[DynamoDBSpanAttributes.AWS_DYNAMODB_TABLE_NAMES] = [options.tableName]
    }
    if (options.indexName) {
      attributes[DynamoDBSpanAttributes.AWS_DYNAMODB_INDEX_NAME] = options.indexName
    }
    if (options.partitionKey) {
      attributes[DynamoDBSpanAttributes.DYNAMODB_PARTITION_KEY] = options.partitionKey
    }
    if (options.sortKey) {
      attributes[DynamoDBSpanAttributes.DYNAMODB_SORT_KEY] = options.sortKey
    }
    if (options.entityType) {
      attributes[DynamoDBSpanAttributes.DYNAMODB_ENTITY_TYPE] = options.entityType
    }
    if (options.tenantId) {
      attributes[DynamoDBSpanAttributes.DYNAMODB_TENANT_ID] = options.tenantId
    }

    return this.startSpan(`DynamoDB.${operation}`, {
      parent: options.parent,
      kind: 'CLIENT',
      attributes,
    })
  }

  /**
   * End a span and queue for export
   */
  endSpan(span: Span): void {
    span.end()
    const data = span.getData()
    this.activeSpans.delete(data.spanId)
    this.completedSpans.push(data)

    if (this.completedSpans.length >= this.batchSize) {
      this.flush()
    }
  }

  /**
   * Add an exporter
   */
  addExporter(exporter: SpanExporter): this {
    this.exporters.push(exporter)
    return this
  }

  /**
   * Flush completed spans to exporters
   */
  async flush(): Promise<void> {
    if (this.completedSpans.length === 0) return

    const spans = this.completedSpans.splice(0, this.completedSpans.length)

    await Promise.all(
      this.exporters.map(exporter => exporter.export(spans)),
    )
  }

  /**
   * Shutdown the tracer
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    await this.flush()

    await Promise.all(
      this.exporters.map(exporter => exporter.shutdown?.()),
    )
  }

  /**
   * Extract trace context from headers (W3C Trace Context)
   */
  static extractContext(headers: Record<string, string | undefined>): TraceContext | null {
    const traceparent = headers.traceparent || headers['traceparent']
    if (!traceparent) return null

    const match = traceparent.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/)
    if (!match) return null

    return {
      traceId: match[1],
      spanId: match[2],
      traceFlags: Number.parseInt(match[3], 16),
      traceState: headers.tracestate || headers['tracestate'],
    }
  }

  /**
   * Inject trace context into headers (W3C Trace Context)
   */
  static injectContext(span: Span, headers: Record<string, string>): void {
    const data = span.getData()
    headers['traceparent'] = `00-${data.traceId}-${data.spanId}-01`
    // Could also inject tracestate if needed
  }
}

/**
 * Create a tracer instance
 */
export function createTracer(options?: {
  exporters?: SpanExporter[]
  batchSize?: number
  flushIntervalMs?: number
}): Tracer {
  return new Tracer(options)
}

/**
 * Default tracer instance
 */
export const defaultTracer: Tracer = createTracer()
