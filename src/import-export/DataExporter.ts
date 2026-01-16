// ============================================================================
// Data Exporter - Export DynamoDB Data
// ============================================================================

/**
 * Export format
 */
export type ExportFormat = 'json' | 'jsonl' | 'csv' | 'dynamodb-json'

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat
  /** Include metadata */
  includeMetadata?: boolean
  /** Attributes to export (undefined = all) */
  attributes?: string[]
  /** Filter expression */
  filterExpression?: string
  /** Expression attribute names */
  expressionAttributeNames?: Record<string, string>
  /** Expression attribute values */
  expressionAttributeValues?: Record<string, unknown>
  /** Batch size for scanning */
  batchSize?: number
  /** Limit for scanning */
  limit?: number
  /** Segment for parallel scan */
  segment?: number
  /** Total segments for parallel scan */
  totalSegments?: number
}

/**
 * Exporter creation options
 */
export interface ExporterOptions {
  /** Default batch size */
  batchSize?: number
  /** Include metadata by default */
  includeMetadata?: boolean
}

/**
 * Export result
 */
export interface ExportResult {
  /** Exported data */
  data: string
  /** Number of items exported */
  itemCount: number
  /** Export metadata */
  metadata: {
    tableName: string
    format: ExportFormat
    exportedAt: string
    attributes?: string[]
    itemCount?: number
  }
}

/**
 * Data exporter for DynamoDB tables
 */
export class DataExporter {
  /**
   * Export items to string
   */
  export(items: Record<string, unknown>[], options: ExportOptions): ExportResult {
    const { format, attributes, includeMetadata = true } = options

    // Filter attributes if specified
    let exportItems = items
    if (attributes && attributes.length > 0) {
      exportItems = items.map((item) => {
        const filtered: Record<string, unknown> = {}
        for (const attr of attributes) {
          if (attr in item) {
            filtered[attr] = item[attr]
          }
        }
        return filtered
      })
    }

    let data: string

    switch (format) {
      case 'json':
        data = this.toJSON(exportItems, includeMetadata)
        break
      case 'jsonl':
        data = this.toJSONL(exportItems)
        break
      case 'csv':
        data = this.toCSV(exportItems)
        break
      case 'dynamodb-json':
        data = this.toDynamoDBJSON(exportItems)
        break
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }

    return {
      data,
      itemCount: exportItems.length,
      metadata: {
        tableName: '',
        format,
        exportedAt: new Date().toISOString(),
        attributes,
        itemCount: exportItems.length,
      },
    }
  }

  /**
   * Create scan command for export
   */
  createScanCommand(
    tableName: string,
    options: ExportOptions,
  ): {
      command: 'Scan'
      input: {
        TableName: string
        ProjectionExpression?: string
        FilterExpression?: string
        ExpressionAttributeNames?: Record<string, string>
        ExpressionAttributeValues?: Record<string, unknown>
        Limit?: number
        Segment?: number
        TotalSegments?: number
      }
    } {
    const input: {
      TableName: string
      ProjectionExpression?: string
      FilterExpression?: string
      ExpressionAttributeNames?: Record<string, string>
      ExpressionAttributeValues?: Record<string, unknown>
      Limit?: number
      Segment?: number
      TotalSegments?: number
    } = {
      TableName: tableName,
    }

    if (options.attributes && options.attributes.length > 0) {
      input.ProjectionExpression = options.attributes.join(', ')
    }

    if (options.filterExpression) {
      input.FilterExpression = options.filterExpression
    }

    if (options.expressionAttributeNames) {
      input.ExpressionAttributeNames = options.expressionAttributeNames
    }

    if (options.expressionAttributeValues) {
      input.ExpressionAttributeValues = options.expressionAttributeValues
    }

    if (options.limit) {
      input.Limit = options.limit
    }
    else if (options.batchSize) {
      input.Limit = options.batchSize
    }

    if (options.segment !== undefined && options.totalSegments) {
      input.Segment = options.segment
      input.TotalSegments = options.totalSegments
    }

    return {
      command: 'Scan',
      input,
    }
  }

  private toJSON(items: Record<string, unknown>[], includeMetadata: boolean): string {
    if (includeMetadata) {
      return JSON.stringify({
        metadata: {
          exportedAt: new Date().toISOString(),
          itemCount: items.length,
        },
        items,
      }, null, 2)
    }
    return JSON.stringify(items, null, 2)
  }

  private toJSONL(items: Record<string, unknown>[]): string {
    return items.map(item => JSON.stringify(item)).join('\n')
  }

  private toCSV(items: Record<string, unknown>[]): string {
    if (items.length === 0)
      return ''

    // Get all unique keys
    const keys = new Set<string>()
    for (const item of items) {
      for (const key of Object.keys(item)) {
        keys.add(key)
      }
    }

    const headers = Array.from(keys)
    const lines: string[] = []

    // Header row
    lines.push(headers.map(h => this.escapeCSV(h)).join(','))

    // Data rows
    for (const item of items) {
      const row = headers.map((header) => {
        const value = item[header]
        if (value === undefined || value === null)
          return ''
        if (typeof value === 'object')
          return this.escapeCSV(JSON.stringify(value))
        return this.escapeCSV(String(value))
      })
      lines.push(row.join(','))
    }

    return lines.join('\n')
  }

  private toDynamoDBJSON(items: Record<string, unknown>[]): string {
    const dynamoItems = items.map(item => this.marshallItem(item))
    return JSON.stringify(dynamoItems, null, 2)
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  private marshallItem(item: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(item)) {
      result[key] = this.marshallValue(value)
    }

    return result
  }

  private marshallValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return { NULL: true }
    }
    if (typeof value === 'string') {
      return { S: value }
    }
    if (typeof value === 'number') {
      return { N: String(value) }
    }
    if (typeof value === 'boolean') {
      return { BOOL: value }
    }
    if (Array.isArray(value)) {
      return { L: value.map(v => this.marshallValue(v)) }
    }
    if (typeof value === 'object') {
      const m: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        m[k] = this.marshallValue(v)
      }
      return { M: m }
    }
    return { S: String(value) }
  }
}

/**
 * Create a data exporter
 */
export function createDataExporter(_options?: ExporterOptions): DataExporter {
  return new DataExporter()
}
