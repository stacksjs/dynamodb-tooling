// ============================================================================
// Metrics - DynamoDB Operation Metrics Collection
// ============================================================================

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary'

/**
 * Metric labels
 */
export type MetricLabels = Record<string, string>

/**
 * Histogram buckets
 */
export type HistogramBuckets = number[]

/**
 * Metric definition
 */
export interface MetricDefinition {
  /** Metric name */
  name: string
  /** Description */
  description: string
  /** Metric type */
  type: MetricType
  /** Labels */
  labels?: string[]
  /** Histogram buckets (for histogram type) */
  buckets?: HistogramBuckets
}

/**
 * Metric value
 */
export interface MetricValue {
  /** Metric name */
  name: string
  /** Labels */
  labels: MetricLabels
  /** Value */
  value: number
  /** Timestamp */
  timestamp: Date
}

/**
 * Histogram value
 */
export interface HistogramValue {
  /** Bucket counts */
  buckets: Map<number, number>
  /** Sum of all values */
  sum: number
  /** Count of all values */
  count: number
}

/**
 * Summary value
 */
export interface SummaryValue {
  /** Quantile values */
  quantiles: Map<number, number>
  /** Sum of all values */
  sum: number
  /** Count of all values */
  count: number
}

/**
 * Built-in DynamoDB metric definitions
 */
export interface DynamoDBMetricDefinitions {
  operationDuration: MetricDefinition
  operationTotal: MetricDefinition
  operationErrors: MetricDefinition
  consumedReadCapacity: MetricDefinition
  consumedWriteCapacity: MetricDefinition
  itemsReturned: MetricDefinition
  itemsWritten: MetricDefinition
  itemSize: MetricDefinition
  throttledRequests: MetricDefinition
  retries: MetricDefinition
  batchSize: MetricDefinition
  unprocessedItems: MetricDefinition
  transactionSize: MetricDefinition
  activeConnections: MetricDefinition
}

/**
 * Built-in DynamoDB metrics
 */
export const DynamoDBMetrics: DynamoDBMetricDefinitions = {
  // Operation metrics
  operationDuration: {
    name: 'dynamodb_operation_duration_ms',
    description: 'Duration of DynamoDB operations in milliseconds',
    type: 'histogram',
    labels: ['operation', 'table', 'status'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  },
  operationTotal: {
    name: 'dynamodb_operations_total',
    description: 'Total number of DynamoDB operations',
    type: 'counter',
    labels: ['operation', 'table', 'status'],
  },
  operationErrors: {
    name: 'dynamodb_operation_errors_total',
    description: 'Total number of DynamoDB operation errors',
    type: 'counter',
    labels: ['operation', 'table', 'error_code'],
  },

  // Capacity metrics
  consumedReadCapacity: {
    name: 'dynamodb_consumed_read_capacity_units',
    description: 'Consumed read capacity units',
    type: 'counter',
    labels: ['table', 'index'],
  },
  consumedWriteCapacity: {
    name: 'dynamodb_consumed_write_capacity_units',
    description: 'Consumed write capacity units',
    type: 'counter',
    labels: ['table', 'index'],
  },

  // Item metrics
  itemsReturned: {
    name: 'dynamodb_items_returned_total',
    description: 'Total number of items returned from queries/scans',
    type: 'counter',
    labels: ['operation', 'table'],
  },
  itemsWritten: {
    name: 'dynamodb_items_written_total',
    description: 'Total number of items written',
    type: 'counter',
    labels: ['operation', 'table'],
  },
  itemSize: {
    name: 'dynamodb_item_size_bytes',
    description: 'Size of items in bytes',
    type: 'histogram',
    labels: ['operation', 'table'],
    buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 400000],
  },

  // Throttling metrics
  throttledRequests: {
    name: 'dynamodb_throttled_requests_total',
    description: 'Total number of throttled requests',
    type: 'counter',
    labels: ['operation', 'table'],
  },
  retries: {
    name: 'dynamodb_retries_total',
    description: 'Total number of request retries',
    type: 'counter',
    labels: ['operation', 'table', 'attempt'],
  },

  // Batch metrics
  batchSize: {
    name: 'dynamodb_batch_size',
    description: 'Size of batch operations',
    type: 'histogram',
    labels: ['operation', 'table'],
    buckets: [1, 5, 10, 15, 20, 25],
  },
  unprocessedItems: {
    name: 'dynamodb_unprocessed_items_total',
    description: 'Total number of unprocessed items in batch operations',
    type: 'counter',
    labels: ['operation', 'table'],
  },

  // Transaction metrics
  transactionSize: {
    name: 'dynamodb_transaction_size',
    description: 'Number of items in transactions',
    type: 'histogram',
    labels: ['operation'],
    buckets: [1, 5, 10, 15, 20, 25, 50, 100],
  },

  // Connection metrics
  activeConnections: {
    name: 'dynamodb_active_connections',
    description: 'Number of active DynamoDB connections',
    type: 'gauge',
    labels: ['region'],
  },
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  /** Collector name */
  name: string
  /** Collect and return current metrics */
  collect: () => MetricValue[]
}

/**
 * Metrics exporter interface
 */
export interface MetricsExporter {
  /** Exporter name */
  name: string
  /** Export metrics */
  export: (metrics: MetricValue[]) => unknown | Promise<unknown>
}

/**
 * Prometheus-compatible metrics exporter
 */
export class PrometheusExporter implements MetricsExporter {
  name = 'prometheus'

  export(metrics: MetricValue[]): string {
    const lines: string[] = []

    for (const metric of metrics) {
      const labelStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')

      const name = metric.name.replace(/-/g, '_')
      lines.push(`${name}{${labelStr}} ${metric.value}`)
    }

    return lines.join('\n')
  }

  /**
   * Get Prometheus-formatted output
   */
  format(metrics: MetricValue[]): string {
    return this.export(metrics)
  }
}

/**
 * CloudWatch-compatible metrics exporter
 */
export class CloudWatchExporter implements MetricsExporter {
  name = 'cloudwatch'
  private namespace: string

  constructor(namespace: string = 'DynamoDB/Custom') {
    this.namespace = namespace
  }

  export(metrics: MetricValue[]): {
    Namespace: string
    MetricData: Array<{
      MetricName: string
      Dimensions: Array<{ Name: string, Value: string }>
      Value: number
      Timestamp: Date
      Unit: string
    }>
  } {
    return {
      Namespace: this.namespace,
      MetricData: metrics.map(metric => ({
        MetricName: metric.name,
        Dimensions: Object.entries(metric.labels).map(([Name, Value]) => ({
          Name,
          Value,
        })),
        Value: metric.value,
        Timestamp: metric.timestamp,
        Unit: this.inferUnit(metric.name),
      })),
    }
  }

  private inferUnit(metricName: string): string {
    if (metricName.includes('duration') || metricName.includes('_ms'))
      return 'Milliseconds'
    if (metricName.includes('bytes') || metricName.includes('size'))
      return 'Bytes'
    if (metricName.includes('total') || metricName.includes('count'))
      return 'Count'
    return 'None'
  }
}

/**
 * Metrics registry
 */
export class MetricsRegistry {
  private counters: Map<string, Map<string, number>> = new Map()
  private gauges: Map<string, Map<string, number>> = new Map()
  private histograms: Map<string, Map<string, HistogramValue>> = new Map()
  private definitions: Map<string, MetricDefinition> = new Map()

  constructor() {
    // Register built-in metrics
    for (const metric of Object.values(DynamoDBMetrics)) {
      this.register(metric)
    }
  }

  /**
   * Register a metric definition
   */
  register(definition: MetricDefinition): this {
    this.definitions.set(definition.name, definition)
    return this
  }

  /**
   * Increment a counter
   */
  increment(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels)
    let counters = this.counters.get(name)
    if (!counters) {
      counters = new Map()
      this.counters.set(name, counters)
    }
    const current = counters.get(key) || 0
    counters.set(key, current + value)
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, labels: MetricLabels = {}): void {
    const key = this.labelsToKey(labels)
    let gauges = this.gauges.get(name)
    if (!gauges) {
      gauges = new Map()
      this.gauges.set(name, gauges)
    }
    gauges.set(key, value)
  }

  /**
   * Observe a histogram value
   */
  observe(name: string, value: number, labels: MetricLabels = {}): void {
    const key = this.labelsToKey(labels)
    let histograms = this.histograms.get(name)
    if (!histograms) {
      histograms = new Map()
      this.histograms.set(name, histograms)
    }

    let histogram = histograms.get(key)
    if (!histogram) {
      const def = this.definitions.get(name)
      const buckets = def?.buckets || [10, 50, 100, 500, 1000]
      histogram = {
        buckets: new Map(buckets.map(b => [b, 0])),
        sum: 0,
        count: 0,
      }
      histograms.set(key, histogram)
    }

    histogram.sum += value
    histogram.count++

    for (const [bucket, count] of histogram.buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, count + 1)
      }
    }
  }

  /**
   * Record operation duration
   */
  recordOperation(
    operation: string,
    table: string,
    durationMs: number,
    success: boolean,
    options?: {
      readCapacity?: number
      writeCapacity?: number
      itemCount?: number
      errorCode?: string
    },
  ): void {
    const status = success ? 'success' : 'error'

    // Duration histogram
    this.observe(DynamoDBMetrics.operationDuration.name, durationMs, {
      operation,
      table,
      status,
    })

    // Operation counter
    this.increment(DynamoDBMetrics.operationTotal.name, {
      operation,
      table,
      status,
    })

    // Error counter
    if (!success && options?.errorCode) {
      this.increment(DynamoDBMetrics.operationErrors.name, {
        operation,
        table,
        error_code: options.errorCode,
      })
    }

    // Capacity counters
    if (options?.readCapacity) {
      this.increment(DynamoDBMetrics.consumedReadCapacity.name, {
        table,
        index: 'table',
      }, options.readCapacity)
    }

    if (options?.writeCapacity) {
      this.increment(DynamoDBMetrics.consumedWriteCapacity.name, {
        table,
        index: 'table',
      }, options.writeCapacity)
    }

    // Item count
    if (options?.itemCount && success) {
      if (operation.includes('Get') || operation.includes('Query') || operation.includes('Scan')) {
        this.increment(DynamoDBMetrics.itemsReturned.name, {
          operation,
          table,
        }, options.itemCount)
      }
      else {
        this.increment(DynamoDBMetrics.itemsWritten.name, {
          operation,
          table,
        }, options.itemCount)
      }
    }
  }

  /**
   * Record throttled request
   */
  recordThrottle(operation: string, table: string): void {
    this.increment(DynamoDBMetrics.throttledRequests.name, {
      operation,
      table,
    })
  }

  /**
   * Record retry attempt
   */
  recordRetry(operation: string, table: string, attempt: number): void {
    this.increment(DynamoDBMetrics.retries.name, {
      operation,
      table,
      attempt: String(attempt),
    })
  }

  /**
   * Collect all metrics
   */
  collect(): MetricValue[] {
    const now = new Date()
    const values: MetricValue[] = []

    // Collect counters
    for (const [name, counters] of this.counters) {
      for (const [key, value] of counters) {
        values.push({
          name,
          labels: this.keyToLabels(key),
          value,
          timestamp: now,
        })
      }
    }

    // Collect gauges
    for (const [name, gauges] of this.gauges) {
      for (const [key, value] of gauges) {
        values.push({
          name,
          labels: this.keyToLabels(key),
          value,
          timestamp: now,
        })
      }
    }

    // Collect histograms (as multiple metrics)
    for (const [name, histograms] of this.histograms) {
      for (const [key, histogram] of histograms) {
        const labels = this.keyToLabels(key)

        // Sum
        values.push({
          name: `${name}_sum`,
          labels,
          value: histogram.sum,
          timestamp: now,
        })

        // Count
        values.push({
          name: `${name}_count`,
          labels,
          value: histogram.count,
          timestamp: now,
        })

        // Buckets
        for (const [bucket, count] of histogram.buckets) {
          values.push({
            name: `${name}_bucket`,
            labels: { ...labels, le: String(bucket) },
            value: count,
            timestamp: now,
          })
        }
      }
    }

    return values
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }

  /**
   * Get a specific counter value
   */
  getCounter(name: string, labels: MetricLabels = {}): number {
    const counters = this.counters.get(name)
    if (!counters)
      return 0
    return counters.get(this.labelsToKey(labels)) || 0
  }

  /**
   * Get a specific gauge value
   */
  getGauge(name: string, labels: MetricLabels = {}): number | undefined {
    const gauges = this.gauges.get(name)
    if (!gauges)
      return undefined
    return gauges.get(this.labelsToKey(labels))
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string, labels: MetricLabels = {}): {
    count: number
    sum: number
    avg: number
    buckets: Record<number, number>
  } | undefined {
    const histograms = this.histograms.get(name)
    if (!histograms)
      return undefined

    const histogram = histograms.get(this.labelsToKey(labels))
    if (!histogram)
      return undefined

    return {
      count: histogram.count,
      sum: histogram.sum,
      avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
      buckets: Object.fromEntries(histogram.buckets),
    }
  }

  private labelsToKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
  }

  private keyToLabels(key: string): MetricLabels {
    if (!key)
      return {}
    const labels: MetricLabels = {}
    for (const part of key.split(',')) {
      const [k, v] = part.split('=')
      if (k && v !== undefined) {
        labels[k] = v
      }
    }
    return labels
  }
}

/**
 * Create a metrics registry
 */
export function createMetricsRegistry(): MetricsRegistry {
  return new MetricsRegistry()
}

/**
 * Default metrics registry
 */
export const defaultMetrics: MetricsRegistry = createMetricsRegistry()
