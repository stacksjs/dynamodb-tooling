// ============================================================================
// Data Importer - Import Data into DynamoDB
// ============================================================================

import type { ExportFormat } from './DataExporter'

/**
 * Import options
 */
export interface ImportOptions {
  /** Import format */
  format: ExportFormat
  /** Table name */
  tableName: string
  /** Transform items before import */
  transform?: (item: Record<string, unknown>) => Record<string, unknown>
  /** Validate items before import */
  validate?: (item: Record<string, unknown>) => boolean
  /** Skip invalid items */
  skipInvalid?: boolean
  /** Batch size for writes */
  batchSize?: number
  /** Overwrite existing items */
  overwrite?: boolean
  /** CSV delimiter */
  delimiter?: string
  /** Primary key for conflict detection */
  primaryKey?: string
  /** Sort key for conflict detection */
  sortKey?: string
  /** Filter function for items */
  filter?: (item: Record<string, unknown>) => boolean
}

/**
 * Importer creation options
 */
export interface ImporterOptions {
  /** Default batch size */
  batchSize?: number
  /** Validate items before import */
  validateItems?: boolean
}

/**
 * Import result
 */
export interface ImportResult {
  /** Total items processed */
  totalItems: number
  /** Successfully imported items */
  importedItems: number
  /** Skipped items */
  skippedItems: number
  /** Failed items */
  failedItems: number
  /** Error details */
  errors: Array<{
    index: number
    item?: Record<string, unknown>
    error: string
  }>
}

/**
 * Batch write command
 */
export interface BatchWriteCommand {
  command: 'BatchWriteItem'
  input: {
    RequestItems: Record<string, Array<{
      PutRequest: {
        Item: Record<string, unknown>
      }
    }>>
  }
}

/**
 * Data importer for DynamoDB tables
 */
export class DataImporter {
  /**
   * Parse import data
   */
  parse(data: string, options: ImportOptions): Record<string, unknown>[] {
    const { format } = options

    let items: Record<string, unknown>[]

    switch (format) {
      case 'json':
        items = this.parseJSON(data)
        break
      case 'jsonl':
        items = this.parseJSONL(data)
        break
      case 'csv':
        items = this.parseCSV(data)
        break
      case 'dynamodb-json':
        items = this.parseDynamoDBJSON(data)
        break
      default:
        throw new Error(`Unsupported import format: ${format}`)
    }

    // Apply transform
    if (options.transform) {
      items = items.map(options.transform)
    }

    // Apply validation
    if (options.validate && options.skipInvalid) {
      items = items.filter(options.validate)
    }

    return items
  }

  /**
   * Create batch write commands for import
   */
  createBatchWriteCommands(
    items: Record<string, unknown>[],
    options: ImportOptions,
  ): BatchWriteCommand[] {
    const { tableName, batchSize = 25 } = options
    const commands: BatchWriteCommand[] = []

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      commands.push({
        command: 'BatchWriteItem',
        input: {
          RequestItems: {
            [tableName]: batch.map(item => ({
              PutRequest: {
                Item: item,
              },
            })),
          },
        },
      })
    }

    return commands
  }

  /**
   * Validate items before import
   */
  validateItems(
    items: Record<string, unknown>[],
    options: ImportOptions,
  ): ImportResult {
    const result: ImportResult = {
      totalItems: items.length,
      importedItems: 0,
      skippedItems: 0,
      failedItems: 0,
      errors: [],
    }

    if (!options.validate) {
      result.importedItems = items.length
      return result
    }

    items.forEach((item, index) => {
      try {
        if (options.validate!(item)) {
          result.importedItems++
        }
        else {
          result.skippedItems++
          result.errors.push({
            index,
            item,
            error: 'Validation failed',
          })
        }
      }
      catch (error) {
        result.failedItems++
        result.errors.push({
          index,
          item,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    return result
  }

  private parseJSON(data: string): Record<string, unknown>[] {
    const parsed = JSON.parse(data)

    // Handle wrapped format
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed.items
    }

    // Handle direct array
    if (Array.isArray(parsed)) {
      return parsed
    }

    throw new Error('Invalid JSON format: expected array or object with items array')
  }

  private parseJSONL(data: string): Record<string, unknown>[] {
    const lines = data.split('\n').filter(line => line.trim())
    return lines.map((line, index) => {
      try {
        return JSON.parse(line)
      }
      catch {
        throw new Error(`Invalid JSON on line ${index + 1}`)
      }
    })
  }

  private parseCSV(data: string): Record<string, unknown>[] {
    const lines = data.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = this.parseCSVLine(lines[0])
    const items: Record<string, unknown>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i])
      const item: Record<string, unknown> = {}

      headers.forEach((header, index) => {
        const value = values[index]
        if (value !== undefined && value !== '') {
          // Try to parse as JSON for complex types
          try {
            item[header] = JSON.parse(value)
          }
          catch {
            // Keep as string if not valid JSON
            item[header] = value
          }
        }
      })

      items.push(item)
    }

    return items
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        }
        else {
          inQuotes = !inQuotes
        }
      }
      else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      }
      else {
        current += char
      }
    }

    values.push(current)
    return values
  }

  private parseDynamoDBJSON(data: string): Record<string, unknown>[] {
    const parsed = JSON.parse(data)
    const items = Array.isArray(parsed) ? parsed : [parsed]

    return items.map(item => this.unmarshallItem(item))
  }

  private unmarshallItem(item: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(item)) {
      result[key] = this.unmarshallValue(value)
    }

    return result
  }

  private unmarshallValue(value: unknown): unknown {
    if (typeof value !== 'object' || value === null) {
      return value
    }

    const obj = value as Record<string, unknown>

    if ('S' in obj) return obj.S
    if ('N' in obj) return Number(obj.N)
    if ('BOOL' in obj) return obj.BOOL
    if ('NULL' in obj) return null
    if ('L' in obj) {
      return (obj.L as unknown[]).map(v => this.unmarshallValue(v))
    }
    if ('M' in obj) {
      return this.unmarshallItem(obj.M as Record<string, unknown>)
    }
    if ('SS' in obj) return obj.SS
    if ('NS' in obj) return (obj.NS as string[]).map(Number)
    if ('BS' in obj) return obj.BS

    // Not DynamoDB format, return as-is
    return value
  }
}

/**
 * Create a data importer
 */
export function createDataImporter(_options?: ImporterOptions): DataImporter {
  return new DataImporter()
}
