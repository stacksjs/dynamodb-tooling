// ============================================================================
// Automatic Migration Runner for DynamoDB Single-Table Design
// ============================================================================

import type { Config } from '../types'
import type { CreateTableInput, SchemaGenerationResult } from './AutoSchemaGenerator'
import type { MigrationState, MigrationStep, SchemaDiffResult } from './SchemaDiffer'
import { getConfig } from '../config'
import { getModelRegistry } from '../model-parser/StacksModelParser'
import {

  generateSchemaFromRegistry,

} from './AutoSchemaGenerator'
import {
  createMigrationState,
  diffSchemas,
  formatDiffSummary,

} from './SchemaDiffer'

// ============================================================================
// Types
// ============================================================================

/**
 * Migration execution options
 */
export interface MigrationOptions {
  /**
   * If true, only show what would be done without executing
   */
  dryRun?: boolean
  /**
   * If true, skip confirmation prompts
   */
  force?: boolean
  /**
   * If true, output verbose logging
   */
  verbose?: boolean
  /**
   * Callback for progress updates
   */
  onProgress?: (message: string, step?: number, total?: number) => void
  /**
   * Callback for confirmations
   */
  onConfirm?: (message: string) => Promise<boolean>
}

/**
 * Result of a migration execution
 */
export interface MigrationResult {
  /**
   * Whether the migration was successful
   */
  success: boolean
  /**
   * Whether this was a dry run
   */
  dryRun: boolean
  /**
   * Number of steps executed
   */
  stepsExecuted: number
  /**
   * Total number of steps
   */
  totalSteps: number
  /**
   * Steps that were executed
   */
  executedSteps: ExecutedStep[]
  /**
   * Any errors that occurred
   */
  errors: MigrationError[]
  /**
   * The diff that was applied
   */
  diff: SchemaDiffResult
  /**
   * The new migration state (if successful)
   */
  newState?: MigrationState
  /**
   * Execution duration in milliseconds
   */
  durationMs: number
}

/**
 * An executed migration step
 */
export interface ExecutedStep {
  step: MigrationStep
  success: boolean
  durationMs: number
  error?: string
}

/**
 * Migration error
 */
export interface MigrationError {
  step: number
  operation: string
  message: string
  details?: unknown
}

/**
 * DynamoDB client interface (minimal interface for migration operations)
 */
export interface MigrationDynamoDBClient {
  createTable: (params: CreateTableInput) => Promise<void>
  updateTable: (params: Record<string, unknown>) => Promise<void>
  deleteTable: (tableName: string) => Promise<void>
  describeTable: (tableName: string) => Promise<TableDescription | null>
  updateTimeToLive: (params: Record<string, unknown>) => Promise<void>
  waitForTableActive: (tableName: string, timeoutMs?: number) => Promise<boolean>
  waitForTableDeleted: (tableName: string, timeoutMs?: number) => Promise<boolean>
}

/**
 * Table description from describeTable
 */
export interface TableDescription {
  tableName: string
  tableStatus: 'CREATING' | 'ACTIVE' | 'DELETING' | 'UPDATING'
  itemCount: number
  tableSizeBytes: number
  creationDateTime: Date
  globalSecondaryIndexes?: Array<{
    indexName: string
    indexStatus: 'CREATING' | 'ACTIVE' | 'DELETING' | 'UPDATING'
  }>
}

/**
 * Migration state storage interface
 */
export interface MigrationStateStore {
  /**
   * Get the current migration state
   */
  getState: () => Promise<MigrationState | null>
  /**
   * Save a new migration state
   */
  saveState: (state: MigrationState) => Promise<void>
  /**
   * Get migration history
   */
  getHistory: () => Promise<MigrationState[]>
}

// ============================================================================
// In-Memory State Store (for testing/local development)
// ============================================================================

/**
 * In-memory migration state store
 */
export class InMemoryMigrationStateStore implements MigrationStateStore {
  private history: MigrationState[] = []

  async getState(): Promise<MigrationState | null> {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null
  }

  async saveState(state: MigrationState): Promise<void> {
    this.history.push(state)
  }

  async getHistory(): Promise<MigrationState[]> {
    return [...this.history]
  }

  clear(): void {
    this.history = []
  }
}

// ============================================================================
// DynamoDB-Based State Store
// ============================================================================

/**
 * DynamoDB-based migration state store
 * Stores migration state as an item in the same table being managed
 */
export class DynamoDBMigrationStateStore implements MigrationStateStore {
  private client: MigrationDynamoDBClient
  private tableName: string
  private migrationItemPk: string
  private migrationItemSk: string

  constructor(
    client: MigrationDynamoDBClient,
    tableName: string,
    config: Config,
  ) {
    this.client = client
    this.tableName = tableName
    // Use a special pk/sk for the migration state item
    const delimiter = config.singleTableDesign.keyDelimiter
    this.migrationItemPk = `_MIGRATION${delimiter}STATE`
    this.migrationItemSk = `_MIGRATION${delimiter}CURRENT`
  }

  async getState(): Promise<MigrationState | null> {
    // This would be implemented using the DynamoDB client
    // For now, return null (initial state)
    // In a real implementation, this would do a GetItem
    return null
  }

  async saveState(_state: MigrationState): Promise<void> {
    // This would be implemented using the DynamoDB client
    // In a real implementation, this would do a PutItem
  }

  async getHistory(): Promise<MigrationState[]> {
    // This would be implemented using a Query on the migration items
    return []
  }
}

// ============================================================================
// Migration Runner Implementation
// ============================================================================

/**
 * Run migrations automatically based on current models
 *
 * This is the main entry point for running migrations. It:
 * 1. Parses all Stacks models
 * 2. Generates the optimal schema
 * 3. Compares against previous migration state
 * 4. Executes necessary changes
 *
 * @param client - DynamoDB client for executing operations
 * @param stateStore - Store for migration state
 * @param options - Migration options
 * @param config - Optional config (uses default if not provided)
 * @returns Migration result
 */
export async function runMigrations(
  client: MigrationDynamoDBClient,
  stateStore: MigrationStateStore,
  options: MigrationOptions = {},
  config?: Config,
): Promise<MigrationResult> {
  const startTime = Date.now()
  const resolvedConfig = config ?? await getConfig()
  const { dryRun = false, verbose = false, force = false, onProgress, onConfirm } = options

  const log = (msg: string, step?: number, total?: number) => {
    if (verbose || onProgress) {
      onProgress?.(msg, step, total)
    }
  }

  try {
    // 1. Parse models and generate schema
    log('Parsing models...')
    const registry = await getModelRegistry(resolvedConfig)
    const schema = generateSchemaFromRegistry(registry, resolvedConfig)

    // 2. Get previous migration state
    log('Loading migration state...')
    const previousState = await stateStore.getState()

    // 3. Diff schemas
    log('Comparing schemas...')
    const diff = diffSchemas(registry, previousState, resolvedConfig)

    // 4. Check if there are any changes
    if (!diff.hasChanges) {
      log('No changes detected')
      return {
        success: true,
        dryRun,
        stepsExecuted: 0,
        totalSteps: 0,
        executedSteps: [],
        errors: [],
        diff,
        durationMs: Date.now() - startTime,
      }
    }

    // 5. Display diff summary
    if (verbose) {
      log(formatDiffSummary(diff))
    }

    // 6. Confirm breaking changes
    if (diff.hasBreakingChanges && !force && !dryRun) {
      const confirmed = onConfirm
        ? await onConfirm('This migration contains breaking changes. Continue?')
        : false

      if (!confirmed) {
        return {
          success: false,
          dryRun,
          stepsExecuted: 0,
          totalSteps: diff.migrationPlan.length,
          executedSteps: [],
          errors: [{ step: 0, operation: 'confirm', message: 'Migration cancelled by user' }],
          diff,
          durationMs: Date.now() - startTime,
        }
      }
    }

    // 7. Execute migration plan
    const executedSteps: ExecutedStep[] = []
    const errors: MigrationError[] = []
    let stepsExecuted = 0

    for (const step of diff.migrationPlan) {
      log(`Step ${step.order}/${diff.migrationPlan.length}: ${step.description}`, step.order, diff.migrationPlan.length)

      if (dryRun) {
        executedSteps.push({
          step,
          success: true,
          durationMs: 0,
        })
        stepsExecuted++
        continue
      }

      const stepStart = Date.now()

      try {
        await executeStep(client, step, schema, resolvedConfig)

        executedSteps.push({
          step,
          success: true,
          durationMs: Date.now() - stepStart,
        })
        stepsExecuted++
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        executedSteps.push({
          step,
          success: false,
          durationMs: Date.now() - stepStart,
          error: errorMessage,
        })

        errors.push({
          step: step.order,
          operation: step.operation,
          message: errorMessage,
          details: error,
        })

        // Stop on first error
        break
      }
    }

    // 8. Save new migration state if successful
    let newState: MigrationState | undefined
    if (errors.length === 0 && !dryRun) {
      newState = createMigrationState(schema)
      await stateStore.saveState(newState)
      log('Migration state saved')
    }

    return {
      success: errors.length === 0,
      dryRun,
      stepsExecuted,
      totalSteps: diff.migrationPlan.length,
      executedSteps,
      errors,
      diff,
      newState,
      durationMs: Date.now() - startTime,
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      dryRun,
      stepsExecuted: 0,
      totalSteps: 0,
      executedSteps: [],
      errors: [{ step: 0, operation: 'setup', message: errorMessage, details: error }],
      diff: {
        hasChanges: false,
        hasBreakingChanges: false,
        requiresDataMigration: false,
        changes: [],
        changesBySeverity: { info: [], low: [], medium: [], high: [], critical: [] },
        changesByType: {
          table_create: [],
          table_settings: [],
          gsi_add: [],
          gsi_remove: [],
          gsi_modify: [],
          lsi_add: [],
          lsi_remove: [],
          entity_add: [],
          entity_remove: [],
          entity_modify: [],
          attribute_add: [],
          capacity_change: [],
          stream_change: [],
          ttl_change: [],
        },
        summary: {
          totalChanges: 0,
          gsiAdditions: 0,
          gsiRemovals: 0,
          entityAdditions: 0,
          entityRemovals: 0,
          breakingChanges: 0,
          migrationRequired: false,
        },
        migrationPlan: [],
      },
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Execute a single migration step
 */
async function executeStep(
  client: MigrationDynamoDBClient,
  step: MigrationStep,
  schema: SchemaGenerationResult,
  _config: Config,
): Promise<void> {
  switch (step.operation) {
    case 'create_table':
      await client.createTable(schema.createTableInput)
      break

    case 'update_table':
      if (step.params) {
        await client.updateTable(step.params)
      }
      break

    case 'delete_table':
      await client.deleteTable(schema.createTableInput.tableName)
      break

    case 'create_gsi':
      if (step.params) {
        await client.updateTable(step.params)
      }
      break

    case 'delete_gsi':
      if (step.params) {
        await client.updateTable(step.params)
      }
      break

    case 'update_ttl':
      if (step.params) {
        await client.updateTimeToLive(step.params)
      }
      break

    case 'update_stream':
      if (step.params) {
        await client.updateTable(step.params)
      }
      break

    case 'wait': {
      // Wait for table to become active
      const success = await client.waitForTableActive(
        schema.createTableInput.tableName,
        300000, // 5 minutes timeout
      )
      if (!success) {
        throw new Error('Timeout waiting for table to become active')
      }
      break
    }
    case 'backfill_data':
      // Data backfill is handled separately by DataMigrator
      // This is a placeholder for the migration plan
      break

    default:
      throw new Error(`Unknown operation: ${step.operation}`)
  }
}

// ============================================================================
// Migration Status Functions
// ============================================================================

/**
 * Get the current migration status
 */
export async function getMigrationStatus(
  stateStore: MigrationStateStore,
  config?: Config,
): Promise<MigrationStatusResult> {
  const resolvedConfig = config ?? await getConfig()
  const registry = await getModelRegistry(resolvedConfig)
  const currentState = await stateStore.getState()
  const diff = diffSchemas(registry, currentState, resolvedConfig)

  return {
    currentVersion: currentState?.version ?? null,
    appliedAt: currentState?.appliedAt ?? null,
    entityTypes: currentState?.entityTypes ?? [],
    gsiCount: currentState?.gsiNames.length ?? 0,
    lsiCount: currentState?.lsiNames.length ?? 0,
    pendingChanges: diff.hasChanges,
    pendingChangeCount: diff.summary.totalChanges,
    hasBreakingChanges: diff.hasBreakingChanges,
    diff,
  }
}

/**
 * Migration status result
 */
export interface MigrationStatusResult {
  currentVersion: string | null
  appliedAt: string | null
  entityTypes: string[]
  gsiCount: number
  lsiCount: number
  pendingChanges: boolean
  pendingChangeCount: number
  hasBreakingChanges: boolean
  diff: SchemaDiffResult
}

/**
 * Preview migration without executing
 */
export async function previewMigration(
  stateStore: MigrationStateStore,
  config?: Config,
): Promise<MigrationPreview> {
  const resolvedConfig = config ?? await getConfig()
  const registry = await getModelRegistry(resolvedConfig)
  const schema = generateSchemaFromRegistry(registry, resolvedConfig)
  const currentState = await stateStore.getState()
  const diff = diffSchemas(registry, currentState, resolvedConfig)

  return {
    schema,
    diff,
    formattedSummary: formatDiffSummary(diff),
  }
}

/**
 * Migration preview result
 */
export interface MigrationPreview {
  schema: SchemaGenerationResult
  diff: SchemaDiffResult
  formattedSummary: string
}

// ============================================================================
// Rollback Support
// ============================================================================

/**
 * Rollback to a previous migration state
 * Note: This is limited in DynamoDB - we can't truly "rollback" table structure
 * changes, we can only re-apply a previous schema configuration
 */
export async function rollbackMigration(
  client: MigrationDynamoDBClient,
  stateStore: MigrationStateStore,
  targetVersion: string,
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const history = await stateStore.getHistory()
  const targetState = history.find(s => s.version === targetVersion)

  if (!targetState) {
    throw new Error(`Migration version '${targetVersion}' not found in history`)
  }

  // Create a temporary registry from the target state
  // This is a simplified approach - in reality, we'd need to recreate
  // the full registry from the stored schema
  const _config = await getConfig()

  // For now, just return an error indicating rollback limitations
  return {
    success: false,
    dryRun: options.dryRun ?? false,
    stepsExecuted: 0,
    totalSteps: 0,
    executedSteps: [],
    errors: [{
      step: 0,
      operation: 'rollback',
      message: 'Rollback is not fully implemented. DynamoDB schema changes are not easily reversible.',
    }],
    diff: {
      hasChanges: false,
      hasBreakingChanges: false,
      requiresDataMigration: false,
      changes: [],
      changesBySeverity: { info: [], low: [], medium: [], high: [], critical: [] },
      changesByType: {
        table_create: [],
        table_settings: [],
        gsi_add: [],
        gsi_remove: [],
        gsi_modify: [],
        lsi_add: [],
        lsi_remove: [],
        entity_add: [],
        entity_remove: [],
        entity_modify: [],
        attribute_add: [],
        capacity_change: [],
        stream_change: [],
        ttl_change: [],
      },
      summary: {
        totalChanges: 0,
        gsiAdditions: 0,
        gsiRemovals: 0,
        entityAdditions: 0,
        entityRemovals: 0,
        breakingChanges: 0,
        migrationRequired: false,
      },
      migrationPlan: [],
    },
    durationMs: 0,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format migration result for human-readable output
 */
export function formatMigrationResult(result: MigrationResult): string {
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push(result.dryRun ? 'Migration Preview (Dry Run)' : 'Migration Result')
  lines.push('='.repeat(60))
  lines.push('')

  if (result.success) {
    lines.push(`Status: SUCCESS`)
  }
  else {
    lines.push(`Status: FAILED`)
  }

  lines.push(`Steps: ${result.stepsExecuted}/${result.totalSteps}`)
  lines.push(`Duration: ${result.durationMs}ms`)
  lines.push('')

  if (result.executedSteps.length > 0) {
    lines.push('Executed Steps:')
    for (const executed of result.executedSteps) {
      const status = executed.success ? '✓' : '✗'
      lines.push(`  ${status} ${executed.step.description} (${executed.durationMs}ms)`)
      if (executed.error) {
        lines.push(`    Error: ${executed.error}`)
      }
    }
    lines.push('')
  }

  if (result.errors.length > 0) {
    lines.push('Errors:')
    for (const error of result.errors) {
      lines.push(`  Step ${error.step} [${error.operation}]: ${error.message}`)
    }
    lines.push('')
  }

  if (result.newState) {
    lines.push(`New Version: ${result.newState.version}`)
    lines.push(`Schema Hash: ${result.newState.schemaHash}`)
  }

  lines.push('='.repeat(60))

  return lines.join('\n')
}
