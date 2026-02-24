// ============================================================================
// Data Migrator for DynamoDB Backfills and Data Transformations
// ============================================================================

import type { Config } from '../types'
import { getConfig } from '../config'

// ============================================================================
// Types
// ============================================================================

/**
 * Generic item type for data migration
 * Using a different name to avoid conflict with single-table MigrationItem
 */
export type MigrationItem = Record<string, unknown>

/**
 * Data migration options
 */
export interface DataMigrationOptions {
  /**
   * If true, only show what would be done without executing
   */
  dryRun?: boolean
  /**
   * Batch size for write operations (max 25)
   */
  batchSize?: number
  /**
   * Number of parallel workers
   */
  parallelism?: number
  /**
   * Delay between batches in milliseconds (for rate limiting)
   */
  batchDelayMs?: number
  /**
   * Maximum items to process (for testing)
   */
  maxItems?: number
  /**
   * Callback for progress updates
   */
  onProgress?: (progress: MigrationProgress) => void
  /**
   * Callback for errors
   */
  onError?: (error: MigrationItemError) => void
  /**
   * Whether to continue on errors
   */
  continueOnError?: boolean
  /**
   * Custom filter function to select items
   */
  filter?: (item: MigrationItem) => boolean
}

/**
 * Migration progress information
 */
export interface MigrationProgress {
  /**
   * Total items scanned
   */
  scanned: number
  /**
   * Items that matched filter
   */
  matched: number
  /**
   * Items successfully migrated
   */
  migrated: number
  /**
   * Items skipped
   */
  skipped: number
  /**
   * Items with errors
   */
  errors: number
  /**
   * Estimated progress percentage
   */
  percentComplete: number
  /**
   * Current batch number
   */
  currentBatch: number
  /**
   * Elapsed time in milliseconds
   */
  elapsedMs: number
  /**
   * Estimated time remaining in milliseconds
   */
  estimatedRemainingMs?: number
  /**
   * Items per second
   */
  itemsPerSecond: number
}

/**
 * Error information for a single item
 */
export interface MigrationItemError {
  /**
   * The item that failed
   */
  item: MigrationItem
  /**
   * Error message
   */
  message: string
  /**
   * Error details
   */
  details?: unknown
}

/**
 * Data migration result
 */
export interface DataMigrationResult {
  /**
   * Whether the migration was successful
   */
  success: boolean
  /**
   * Whether this was a dry run
   */
  dryRun: boolean
  /**
   * Final progress
   */
  progress: MigrationProgress
  /**
   * All errors encountered
   */
  errors: MigrationItemError[]
  /**
   * Start time
   */
  startedAt: string
  /**
   * End time
   */
  completedAt: string
  /**
   * Summary message
   */
  summary: string
}

/**
 * Data transformation function
 */
export type TransformFunction = (_item: MigrationItem, _config: Config) => MigrationItem | null

/**
 * Backfill specification for a GSI
 */
export interface GSIBackfillSpec {
  /**
   * GSI name
   */
  indexName: string
  /**
   * PK attribute name
   */
  pkAttribute: string
  /**
   * SK attribute name (optional)
   */
  skAttribute?: string
  /**
   * Function to compute PK value from item
   */
  computePk: (item: MigrationItem, config: Config) => string | null
  /**
   * Function to compute SK value from item (optional)
   */
  computeSk?: (item: MigrationItem, config: Config) => string | null
}

/**
 * Data migration client interface
 */
export interface DataMigrationClient {
  /**
   * Scan all items from a table
   */
  scan: (tableName: string, options?: {
    limit?: number
    startKey?: MigrationItem
    filter?: string
    filterValues?: Record<string, unknown>
  }) => Promise<{ items: MigrationItem[], lastEvaluatedKey?: MigrationItem }>
  /**
   * Write a batch of items
   */
  batchWrite: (tableName: string, items: Array<{
    type: 'put' | 'delete'
    item: MigrationItem
  }>) => Promise<{ unprocessedItems: MigrationItem[] }>
  /**
   * Update a single item
   */
  updateItem: (tableName: string, key: MigrationItem, updates: Record<string, unknown>) => Promise<void>
}

// ============================================================================
// Data Migrator Implementation
// ============================================================================

/**
 * Migrate data by applying a transformation to all items
 */
export async function migrateData(
  client: DataMigrationClient,
  tableName: string,
  transform: TransformFunction,
  options: DataMigrationOptions = {},
): Promise<DataMigrationResult> {
  const startTime = Date.now()
  const startedAt = new Date().toISOString()
  const {
    dryRun = false,
    batchSize = 25,
    batchDelayMs = 0,
    maxItems,
    onProgress,
    onError,
    continueOnError = false,
    filter,
  } = options

  const config = await getConfig()
  const progress: MigrationProgress = {
    scanned: 0,
    matched: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    percentComplete: 0,
    currentBatch: 0,
    elapsedMs: 0,
    itemsPerSecond: 0,
  }
  const errors: MigrationItemError[] = []

  let lastEvaluatedKey: MigrationItem | undefined
  let itemsToWrite: MigrationItem[] = []
  let shouldContinue = true

  while (shouldContinue) {
    // Scan a batch of items
    const scanResult = await client.scan(tableName, {
      limit: maxItems ? Math.min(1000, maxItems - progress.scanned) : 1000,
      startKey: lastEvaluatedKey,
    })

    for (const item of scanResult.items) {
      progress.scanned++

      // Check max items limit
      if (maxItems && progress.scanned > maxItems) {
        shouldContinue = false
        break
      }

      // Apply filter
      if (filter && !filter(item)) {
        progress.skipped++
        continue
      }

      progress.matched++

      try {
        // Apply transformation
        const transformedItem = transform(item, config)

        if (transformedItem === null) {
          progress.skipped++
          continue
        }

        // Check if item actually changed
        if (!hasChanges(item, transformedItem)) {
          progress.skipped++
          continue
        }

        itemsToWrite.push(transformedItem)

        // Write batch when full
        if (itemsToWrite.length >= batchSize) {
          progress.currentBatch++

          if (!dryRun) {
            await writeBatch(client, tableName, itemsToWrite, errors, onError)
          }

          progress.migrated += itemsToWrite.length - errors.length
          progress.errors = errors.length
          itemsToWrite = []

          // Update progress
          updateProgress(progress, startTime)
          onProgress?.(progress)

          // Rate limiting delay
          if (batchDelayMs > 0) {
            await delay(batchDelayMs)
          }
        }
      }
      catch (error) {
        const errorInfo: MigrationItemError = {
          item,
          message: error instanceof Error ? error.message : String(error),
          details: error,
        }
        errors.push(errorInfo)
        progress.errors++
        onError?.(errorInfo)

        if (!continueOnError) {
          shouldContinue = false
          break
        }
      }
    }

    // Check for more items
    lastEvaluatedKey = scanResult.lastEvaluatedKey
    if (!lastEvaluatedKey) {
      shouldContinue = false
    }
  }

  // Write remaining items
  if (itemsToWrite.length > 0) {
    progress.currentBatch++

    if (!dryRun) {
      await writeBatch(client, tableName, itemsToWrite, errors, onError)
    }

    progress.migrated += itemsToWrite.length
  }

  // Final progress update
  updateProgress(progress, startTime)
  progress.percentComplete = 100
  onProgress?.(progress)

  const completedAt = new Date().toISOString()

  return {
    success: errors.length === 0,
    dryRun,
    progress,
    errors,
    startedAt,
    completedAt,
    summary: formatSummary(progress, dryRun),
  }
}

/**
 * Backfill GSI attributes for existing items
 */
export async function backfillGSI(
  client: DataMigrationClient,
  tableName: string,
  spec: GSIBackfillSpec,
  options: DataMigrationOptions = {},
): Promise<DataMigrationResult> {
  const _config = await getConfig()

  // Create a transform function that adds the GSI attributes
  const transform: TransformFunction = (item, cfg) => {
    const pkValue = spec.computePk(item, cfg)

    // Skip if we can't compute a valid PK
    if (!pkValue) {
      return null
    }

    // Skip if item already has the GSI attribute
    if (item[spec.pkAttribute] === pkValue) {
      return null
    }

    const updatedItem = { ...item }
    updatedItem[spec.pkAttribute] = pkValue

    if (spec.skAttribute && spec.computeSk) {
      const skValue = spec.computeSk(item, cfg)
      if (skValue) {
        updatedItem[spec.skAttribute] = skValue
      }
    }

    return updatedItem
  }

  return migrateData(client, tableName, transform, options)
}

/**
 * Backfill multiple GSIs at once
 */
export async function backfillMultipleGSIs(
  client: DataMigrationClient,
  tableName: string,
  specs: GSIBackfillSpec[],
  options: DataMigrationOptions = {},
): Promise<DataMigrationResult> {
  const transform: TransformFunction = (item, cfg) => {
    let modified = false
    const updatedItem = { ...item }

    for (const spec of specs) {
      const pkValue = spec.computePk(item, cfg)

      if (pkValue && item[spec.pkAttribute] !== pkValue) {
        updatedItem[spec.pkAttribute] = pkValue
        modified = true
      }

      if (spec.skAttribute && spec.computeSk) {
        const skValue = spec.computeSk(item, cfg)
        if (skValue && item[spec.skAttribute] !== skValue) {
          updatedItem[spec.skAttribute] = skValue
          modified = true
        }
      }
    }

    return modified ? updatedItem : null
  }

  return migrateData(client, tableName, transform, options)
}

/**
 * Clean up orphaned items (items with no valid entity type)
 */
export async function cleanupOrphanedItems(
  client: DataMigrationClient,
  tableName: string,
  validEntityTypes: string[],
  options: DataMigrationOptions = {},
): Promise<DataMigrationResult> {
  const config = await getConfig()
  const entityTypeAttr = config.singleTableDesign.entityTypeAttribute

  // Filter for items with invalid entity types
  const orphanFilter = (item: MigrationItem): boolean => {
    const entityType = item[entityTypeAttr] as string | undefined
    return !entityType || !validEntityTypes.includes(entityType)
  }

  // The transform returns the item unchanged - we're just identifying orphans
  // In a real cleanup, this would return null to delete the item
  const transform: TransformFunction = (item) => {
    // For safety, we don't auto-delete in this example
    // Return the item as-is to count it
    return item
  }

  return migrateData(client, tableName, transform, {
    ...options,
    filter: orphanFilter,
  })
}

/**
 * Add entity type attribute to items missing it
 */
export async function addMissingEntityTypes(
  client: DataMigrationClient,
  tableName: string,
  entityTypeResolver: (item: MigrationItem) => string | null,
  options: DataMigrationOptions = {},
): Promise<DataMigrationResult> {
  const config = await getConfig()
  const entityTypeAttr = config.singleTableDesign.entityTypeAttribute

  // Filter for items missing entity type
  const missingFilter = (item: MigrationItem): boolean => {
    return !item[entityTypeAttr]
  }

  const transform: TransformFunction = (item) => {
    const entityType = entityTypeResolver(item)
    if (!entityType) {
      return null
    }

    return {
      ...item,
      [entityTypeAttr]: entityType,
    }
  }

  return migrateData(client, tableName, transform, {
    ...options,
    filter: missingFilter,
  })
}

/**
 * Migrate entity type prefixes (e.g., from "User" to "USER")
 */
export async function migrateEntityTypePrefixes(
  client: DataMigrationClient,
  tableName: string,
  prefixMapping: Record<string, string>,
  options: DataMigrationOptions = {},
): Promise<DataMigrationResult> {
  const config = await getConfig()
  const entityTypeAttr = config.singleTableDesign.entityTypeAttribute
  const pkAttr = config.singleTableDesign.partitionKeyName
  const skAttr = config.singleTableDesign.sortKeyName
  const _delimiter = config.singleTableDesign.keyDelimiter

  const transform: TransformFunction = (item) => {
    const entityType = item[entityTypeAttr] as string | undefined
    if (!entityType)
      return null

    const newPrefix = prefixMapping[entityType]
    if (!newPrefix)
      return null

    // Update pk and sk with new prefix
    const pk = item[pkAttr] as string | undefined
    const sk = item[skAttr] as string | undefined

    if (!pk || !sk)
      return null

    const updatedItem = { ...item }
    updatedItem[entityTypeAttr] = newPrefix
    updatedItem[pkAttr] = pk.replace(entityType, newPrefix)
    updatedItem[skAttr] = sk.replace(entityType, newPrefix)

    return updatedItem
  }

  return migrateData(client, tableName, transform, options)
}

/**
 * Add timestamps to items missing them
 */
export async function addMissingTimestamps(
  client: DataMigrationClient,
  tableName: string,
  entityTypes: string[],
  options: DataMigrationOptions = {},
): Promise<DataMigrationResult> {
  const config = await getConfig()
  const entityTypeAttr = config.singleTableDesign.entityTypeAttribute
  const createdAtAttr = config.queryBuilder.createdAtAttribute
  const updatedAtAttr = config.queryBuilder.updatedAtAttribute

  // Filter for matching entity types missing timestamps
  const filter = (item: MigrationItem): boolean => {
    const entityType = item[entityTypeAttr] as string | undefined
    if (!entityType || !entityTypes.includes(entityType))
      return false
    return !item[createdAtAttr] || !item[updatedAtAttr]
  }

  const now = new Date().toISOString()

  const transform: TransformFunction = (item) => {
    const updatedItem = { ...item }

    if (!item[createdAtAttr]) {
      updatedItem[createdAtAttr] = now
    }

    if (!item[updatedAtAttr]) {
      updatedItem[updatedAtAttr] = now
    }

    return updatedItem
  }

  return migrateData(client, tableName, transform, {
    ...options,
    filter,
  })
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Write a batch of items
 */
async function writeBatch(
  client: DataMigrationClient,
  tableName: string,
  items: MigrationItem[],
  errors: MigrationItemError[],
  onError?: (error: MigrationItemError) => void,
): Promise<void> {
  const result = await client.batchWrite(
    tableName,
    items.map(item => ({ type: 'put' as const, item })),
  )

  // Handle unprocessed items
  for (const unprocessed of result.unprocessedItems) {
    const errorInfo: MigrationItemError = {
      item: unprocessed,
      message: 'Item was not processed (rate limited or capacity exceeded)',
    }
    errors.push(errorInfo)
    onError?.(errorInfo)
  }
}

/**
 * Check if an item has changes
 */
function hasChanges(original: MigrationItem, transformed: MigrationItem): boolean {
  const originalKeys = Object.keys(original)
  const transformedKeys = Object.keys(transformed)

  if (originalKeys.length !== transformedKeys.length) {
    return true
  }

  for (const key of transformedKeys) {
    if (original[key] !== transformed[key]) {
      return true
    }
  }

  return false
}

/**
 * Update progress statistics
 */
function updateProgress(progress: MigrationProgress, startTime: number): void {
  progress.elapsedMs = Date.now() - startTime
  progress.itemsPerSecond = progress.elapsedMs > 0
    ? (progress.migrated / progress.elapsedMs) * 1000
    : 0

  // Estimate remaining time based on current rate
  if (progress.itemsPerSecond > 0 && progress.scanned > progress.migrated) {
    const remainingItems = progress.matched - progress.migrated
    progress.estimatedRemainingMs = (remainingItems / progress.itemsPerSecond) * 1000
  }
}

/**
 * Format summary message
 */
function formatSummary(progress: MigrationProgress, dryRun: boolean): string {
  const prefix = dryRun ? '[DRY RUN] ' : ''
  return `${prefix}Scanned ${progress.scanned} items, matched ${progress.matched}, `
    + `migrated ${progress.migrated}, skipped ${progress.skipped}, `
    + `errors ${progress.errors} in ${(progress.elapsedMs / 1000).toFixed(1)}s`
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format migration result for display
 */
export function formatMigrationResult(result: DataMigrationResult): string {
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push(result.dryRun ? 'Data Migration Preview (Dry Run)' : 'Data Migration Result')
  lines.push('='.repeat(60))
  lines.push('')

  lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`)
  lines.push(`Started: ${result.startedAt}`)
  lines.push(`Completed: ${result.completedAt}`)
  lines.push('')

  lines.push('Progress:')
  lines.push(`  Scanned: ${result.progress.scanned}`)
  lines.push(`  Matched: ${result.progress.matched}`)
  lines.push(`  Migrated: ${result.progress.migrated}`)
  lines.push(`  Skipped: ${result.progress.skipped}`)
  lines.push(`  Errors: ${result.progress.errors}`)
  lines.push(`  Duration: ${(result.progress.elapsedMs / 1000).toFixed(1)}s`)
  lines.push(`  Rate: ${result.progress.itemsPerSecond.toFixed(1)} items/sec`)
  lines.push('')

  if (result.errors.length > 0) {
    lines.push('Errors (first 10):')
    for (const error of result.errors.slice(0, 10)) {
      lines.push(`  - ${error.message}`)
    }
    if (result.errors.length > 10) {
      lines.push(`  ... and ${result.errors.length - 10} more`)
    }
    lines.push('')
  }

  lines.push('Summary:')
  lines.push(`  ${result.summary}`)
  lines.push('')

  lines.push('='.repeat(60))

  return lines.join('\n')
}
