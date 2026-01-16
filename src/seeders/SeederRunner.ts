// ============================================================================
// Seeder Runner for DynamoDB
// ============================================================================

import type { Config } from '../types'
import type {
  FactoryDefinition,
  FactoryInstance,
  Seeder,
  SeederContext,
  SeederDatabaseClient,
  SeederResult,
  SeederRunResult,
} from './Seeder'
import { getConfig } from '../config'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for running seeders
 */
export interface SeederRunnerOptions {
  /**
   * Only run specific seeders by name
   */
  only?: string[]
  /**
   * Skip specific seeders by name
   */
  skip?: string[]
  /**
   * Run in dry mode (don't persist)
   */
  dryRun?: boolean
  /**
   * Verbose output
   */
  verbose?: boolean
  /**
   * Progress callback
   */
  onProgress?: (seeder: string, result: SeederResult) => void
}

/**
 * Seeder class constructor type
 */
export type SeederConstructor = new () => Seeder

// ============================================================================
// Factory Implementation
// ============================================================================

/**
 * Create a factory instance for generating test data
 */
function createFactory<T extends Record<string, unknown>>(
  entityType: string,
  definition: FactoryDefinition<T>,
  db: SeederDatabaseClient,
  tableName: string,
  config: Config,
  dryRun: boolean,
): FactoryInstance<T> {
  let _count = 1
  let _state: string | undefined
  let _overrides: Partial<T> = {}

  const instance: FactoryInstance<T> = {
    count(n: number) {
      _count = n
      return instance
    },
    state(name: string) {
      _state = name
      return instance
    },
    override(attributes: Partial<T>) {
      _overrides = { ..._overrides, ...attributes }
      return instance
    },
    make() {
      const items: T[] = []

      for (let i = 0; i < _count; i++) {
        // Get base attributes
        let attrs: T
        if (typeof definition.attributes === 'function') {
          attrs = definition.attributes()
        }
        else {
          attrs = { ...definition.attributes }
        }

        // Apply state if specified
        if (_state && definition.states?.[_state]) {
          const stateAttrs = definition.states[_state]
          const resolvedState = typeof stateAttrs === 'function' ? stateAttrs() : stateAttrs
          attrs = { ...attrs, ...resolvedState }
        }

        // Apply overrides
        attrs = { ...attrs, ..._overrides } as T

        // Add pk/sk based on entity type
        const delimiter = config.singleTableDesign.keyDelimiter
        const pkAttr = config.singleTableDesign.partitionKeyName
        const skAttr = config.singleTableDesign.sortKeyName
        const etAttr = config.singleTableDesign.entityTypeAttribute

        // Use id if present, otherwise generate
        const id = (attrs as Record<string, unknown>).id ?? crypto.randomUUID()

        const item = {
          ...attrs,
          [pkAttr]: `${entityType}${delimiter}${id}`,
          [skAttr]: `${entityType}${delimiter}${id}`,
          [etAttr]: entityType,
        } as T

        items.push(item)
      }

      return items
    },
    async create() {
      const items = instance.make()

      if (dryRun) {
        return items
      }

      // Batch write items (chunks of 25)
      const batchSize = 25
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await db.batchWrite(
          tableName,
          batch.map(item => ({ type: 'put', item })),
        )
      }

      return items
    },
  }

  return instance
}

// ============================================================================
// Seeder Runner Implementation
// ============================================================================

/**
 * Run seeders
 */
export async function runSeeders(
  seeders: SeederConstructor[],
  db: SeederDatabaseClient,
  options: SeederRunnerOptions = {},
  config?: Config,
): Promise<SeederRunResult> {
  const startTime = Date.now()
  const resolvedConfig = config ?? await getConfig()
  const tableName = `${resolvedConfig.tableNamePrefix}${resolvedConfig.defaultTableName}${resolvedConfig.tableNameSuffix}`
  const { only, skip, dryRun = false, verbose = false, onProgress } = options

  const results: SeederResult[] = []
  const errors: Array<{ seeder: string, error: string }> = []
  let totalItemsCreated = 0

  // Sort seeders by order
  const sortedSeeders = [...seeders].sort((a, b) => {
    const orderA = (a as unknown as { order?: number }).order ?? 100
    const orderB = (b as unknown as { order?: number }).order ?? 100
    return orderA - orderB
  })

  // Filter seeders
  const filteredSeeders = sortedSeeders.filter((SeederClass) => {
    const name = SeederClass.name

    if (only && only.length > 0 && !only.includes(name)) {
      return false
    }

    if (skip && skip.includes(name)) {
      return false
    }

    return true
  })

  if (verbose) {
    console.log(`Running ${filteredSeeders.length} seeder(s)...`)
    if (dryRun) {
      console.log('[DRY RUN] No data will be persisted')
    }
    console.log('')
  }

  // Track items created for this run
  let itemsCreatedThisRun = 0

  // Create seeder context
  const ctx: SeederContext = {
    db,
    config: resolvedConfig,
    tableName,
    factory: <T extends Record<string, unknown>>(
      entityType: string,
      definition: FactoryDefinition<T>,
    ) => {
      const factory = createFactory(entityType, definition, db, tableName, resolvedConfig, dryRun)

      // Wrap create to track items
      const originalCreate = factory.create.bind(factory)
      factory.create = async () => {
        const items = await originalCreate()
        itemsCreatedThisRun += items.length
        return items
      }

      return factory
    },
  }

  // Run each seeder
  for (const SeederClass of filteredSeeders) {
    const name = SeederClass.name
    const seederStart = Date.now()
    itemsCreatedThisRun = 0

    if (verbose) {
      console.log(`Running ${name}...`)
    }

    try {
      const seeder = new SeederClass()
      await seeder.run(ctx)

      const result: SeederResult = {
        name,
        success: true,
        durationMs: Date.now() - seederStart,
        itemsCreated: itemsCreatedThisRun,
      }

      results.push(result)
      totalItemsCreated += itemsCreatedThisRun

      if (verbose) {
        console.log(`  ✓ ${name} completed (${result.itemsCreated} items, ${result.durationMs}ms)`)
      }

      onProgress?.(name, result)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      const result: SeederResult = {
        name,
        success: false,
        durationMs: Date.now() - seederStart,
        itemsCreated: itemsCreatedThisRun,
        error: errorMessage,
      }

      results.push(result)
      errors.push({ seeder: name, error: errorMessage })

      if (verbose) {
        console.log(`  ✗ ${name} failed: ${errorMessage}`)
      }

      onProgress?.(name, result)
    }
  }

  const durationMs = Date.now() - startTime

  if (verbose) {
    console.log('')
    console.log(`Seeding completed in ${durationMs}ms`)
    console.log(`Total items created: ${totalItemsCreated}`)
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`)
    }
  }

  return {
    success: errors.length === 0,
    durationMs,
    totalItemsCreated,
    results,
    errors,
  }
}

/**
 * Discover seeders from a directory
 */
export async function discoverSeeders(seedersPath: string): Promise<SeederConstructor[]> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const seeders: SeederConstructor[] = []

  try {
    const files = await fs.readdir(seedersPath)

    for (const file of files) {
      // Only process .ts and .js files
      if (!file.endsWith('.ts') && !file.endsWith('.js')) {
        continue
      }

      // Skip index files
      if (file.startsWith('index.')) {
        continue
      }

      try {
        const filePath = path.join(seedersPath, file)
        const module = await import(filePath)

        // Look for exported seeder classes
        for (const exportName of Object.keys(module)) {
          const exported = module[exportName]

          // Check if it's a class that extends Seeder (has run method)
          if (
            typeof exported === 'function'
            && exported.prototype
            && typeof exported.prototype.run === 'function'
          ) {
            seeders.push(exported as SeederConstructor)
          }
        }
      }
      catch (err) {
        console.warn(`Warning: Could not load seeder from ${file}:`, err)
      }
    }
  }
  catch {
    // Directory doesn't exist or can't be read
    console.warn(`Warning: Could not read seeders directory: ${seedersPath}`)
  }

  return seeders
}

// ============================================================================
// Format Functions
// ============================================================================

/**
 * Format seeder run result for display
 */
export function formatSeederResult(result: SeederRunResult): string {
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push('Seeder Results')
  lines.push('='.repeat(60))
  lines.push('')

  lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`)
  lines.push(`Duration: ${result.durationMs}ms`)
  lines.push(`Total Items Created: ${result.totalItemsCreated}`)
  lines.push('')

  lines.push('Seeders:')
  for (const seederResult of result.results) {
    const status = seederResult.success ? '✓' : '✗'
    lines.push(`  ${status} ${seederResult.name}`)
    lines.push(`    Items: ${seederResult.itemsCreated}`)
    lines.push(`    Duration: ${seederResult.durationMs}ms`)
    if (seederResult.error) {
      lines.push(`    Error: ${seederResult.error}`)
    }
  }

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    for (const error of result.errors) {
      lines.push(`  - ${error.seeder}: ${error.error}`)
    }
  }

  lines.push('')
  lines.push('='.repeat(60))

  return lines.join('\n')
}
