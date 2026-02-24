// ============================================================================
// Schema Differ for DynamoDB Single-Table Design
// ============================================================================

import type { ModelRegistry } from '../model-parser/types'
import type { Config } from '../types'
import type {
  CreateTableInput,
  GlobalSecondaryIndexInput,
  SchemaGenerationResult,
} from './AutoSchemaGenerator'
import { generateSchemaFromRegistry } from './AutoSchemaGenerator'

// ============================================================================
// Types
// ============================================================================

/**
 * Types of changes that can occur between schema versions
 */
export type ChangeType =
  | 'table_create' // New table needs to be created
  | 'table_settings' // Table-level settings changed (streams, TTL, etc.)
  | 'gsi_add' // New GSI needs to be added
  | 'gsi_remove' // GSI needs to be removed
  | 'gsi_modify' // GSI configuration changed (requires recreation)
  | 'lsi_add' // New LSI (only valid at table creation)
  | 'lsi_remove' // LSI removal (only valid by recreating table)
  | 'entity_add' // New entity type added (no schema change needed)
  | 'entity_remove' // Entity type removed (no schema change needed)
  | 'entity_modify' // Entity attributes changed (no schema change needed)
  | 'attribute_add' // New key attribute for indexes
  | 'capacity_change' // Billing mode or capacity changed
  | 'stream_change' // Stream configuration changed
  | 'ttl_change' // TTL configuration changed

/**
 * Severity of a schema change
 */
export type ChangeSeverity =
  | 'info' // No action required (schemaless additions)
  | 'low' // Safe change, can be applied automatically
  | 'medium' // Requires data migration or has cost implications
  | 'high' // Breaking change, requires careful planning
  | 'critical' // Destructive change, requires explicit confirmation

/**
 * A single schema change detected
 */
export interface SchemaChange {
  /**
   * Type of change
   */
  type: ChangeType
  /**
   * Severity of the change
   */
  severity: ChangeSeverity
  /**
   * Human-readable description
   */
  description: string
  /**
   * Affected component (table name, GSI name, entity type)
   */
  affectedComponent: string
  /**
   * Previous value (if applicable)
   */
  previousValue?: unknown
  /**
   * New value (if applicable)
   */
  newValue?: unknown
  /**
   * Additional details about the change
   */
  details?: string
  /**
   * Suggested action to take
   */
  suggestedAction?: string
  /**
   * Whether this change requires data migration
   */
  requiresDataMigration: boolean
  /**
   * Whether this change is breaking (may cause query failures)
   */
  isBreaking: boolean
  /**
   * Estimated time impact for the change
   */
  estimatedImpact?: string
}

/**
 * Result of comparing two schemas
 */
export interface SchemaDiffResult {
  /**
   * Whether there are any changes
   */
  hasChanges: boolean
  /**
   * Whether there are any breaking changes
   */
  hasBreakingChanges: boolean
  /**
   * Whether any changes require data migration
   */
  requiresDataMigration: boolean
  /**
   * All detected changes
   */
  changes: SchemaChange[]
  /**
   * Changes grouped by severity
   */
  changesBySeverity: Record<ChangeSeverity, SchemaChange[]>
  /**
   * Changes grouped by type
   */
  changesByType: Record<ChangeType, SchemaChange[]>
  /**
   * Summary of changes for display
   */
  summary: DiffSummary
  /**
   * Migration plan based on changes
   */
  migrationPlan: MigrationStep[]
}

/**
 * Summary of schema differences
 */
export interface DiffSummary {
  totalChanges: number
  gsiAdditions: number
  gsiRemovals: number
  entityAdditions: number
  entityRemovals: number
  breakingChanges: number
  migrationRequired: boolean
}

/**
 * A step in the migration plan
 */
export interface MigrationStep {
  /**
   * Order of execution
   */
  order: number
  /**
   * Type of operation
   */
  operation: 'create_table' | 'update_table' | 'delete_table' | 'create_gsi' | 'delete_gsi' | 'update_ttl' | 'update_stream' | 'backfill_data' | 'wait'
  /**
   * Description of the step
   */
  description: string
  /**
   * AWS API parameters for the operation
   */
  params?: Record<string, unknown>
  /**
   * Whether to wait for completion before next step
   */
  waitForCompletion: boolean
  /**
   * Estimated duration
   */
  estimatedDuration?: string
  /**
   * Dependencies (step orders that must complete first)
   */
  dependsOn: number[]
}

/**
 * Stored migration state for tracking applied changes
 */
export interface MigrationState {
  /**
   * Version identifier
   */
  version: string
  /**
   * Timestamp when last migration was applied
   */
  appliedAt: string
  /**
   * Hash of the schema at this version
   */
  schemaHash: string
  /**
   * The CreateTable input that was applied
   */
  appliedSchema: CreateTableInput
  /**
   * Entity types present in this version
   */
  entityTypes: string[]
  /**
   * GSI names present in this version
   */
  gsiNames: string[]
  /**
   * LSI names present in this version
   */
  lsiNames: string[]
}

// ============================================================================
// Schema Differ Implementation
// ============================================================================

/**
 * Compare current model registry against a previous migration state
 *
 * @param currentRegistry - Current parsed model registry
 * @param previousState - Previous migration state (null for initial migration)
 * @param config - Configuration options
 * @returns Detailed diff result with migration plan
 */
export function diffSchemas(
  currentRegistry: ModelRegistry,
  previousState: MigrationState | null,
  config: Config,
): SchemaDiffResult {
  const changes: SchemaChange[] = []

  // Generate current schema from models
  const currentSchema = generateSchemaFromRegistry(currentRegistry, config)

  // If no previous state, this is the initial table creation
  if (previousState === null) {
    changes.push({
      type: 'table_create',
      severity: 'low',
      description: `Create new DynamoDB table '${currentSchema.createTableInput.tableName}'`,
      affectedComponent: currentSchema.createTableInput.tableName,
      newValue: currentSchema.createTableInput,
      requiresDataMigration: false,
      isBreaking: false,
      estimatedImpact: 'Table creation takes 1-2 minutes',
    })

    // Add info about initial GSIs
    for (const gsi of currentSchema.createTableInput.globalSecondaryIndexes ?? []) {
      changes.push({
        type: 'gsi_add',
        severity: 'info',
        description: `GSI '${gsi.indexName}' will be created with the table`,
        affectedComponent: gsi.indexName,
        newValue: gsi,
        requiresDataMigration: false,
        isBreaking: false,
      })
    }

    // Add info about initial entity types
    for (const entityType of currentSchema.summary.entityTypes) {
      changes.push({
        type: 'entity_add',
        severity: 'info',
        description: `Entity type '${entityType}' configured`,
        affectedComponent: entityType,
        requiresDataMigration: false,
        isBreaking: false,
      })
    }

    return buildDiffResult(changes, currentSchema)
  }

  // Compare schemas
  const previousSchema = previousState.appliedSchema

  // 1. Compare GSIs
  diffGSIs(previousSchema, currentSchema.createTableInput, changes)

  // 2. Compare LSIs (can only be changed by recreating table)
  diffLSIs(previousSchema, currentSchema.createTableInput, changes)

  // 3. Compare entity types
  diffEntityTypes(previousState.entityTypes, currentSchema.summary.entityTypes, changes)

  // 4. Compare table settings
  diffTableSettings(previousSchema, currentSchema.createTableInput, changes)

  // 5. Compare TTL settings
  if (currentSchema.ttlSpecification) {
    diffTTL(previousState, currentSchema, changes)
  }

  // 6. Compare stream settings
  diffStreams(previousSchema, currentSchema.createTableInput, changes)

  // 7. Compare capacity settings
  diffCapacity(previousSchema, currentSchema.createTableInput, changes)

  return buildDiffResult(changes, currentSchema)
}

/**
 * Compare GSI definitions between schemas
 */
function diffGSIs(
  previous: CreateTableInput,
  current: CreateTableInput,
  changes: SchemaChange[],
): void {
  const previousGSIs = new Map(
    (previous.globalSecondaryIndexes ?? []).map(g => [g.indexName, g]),
  )
  const currentGSIs = new Map(
    (current.globalSecondaryIndexes ?? []).map(g => [g.indexName, g]),
  )

  // Find added GSIs
  for (const [name, gsi] of currentGSIs) {
    if (!previousGSIs.has(name)) {
      changes.push({
        type: 'gsi_add',
        severity: 'medium',
        description: `Add new GSI '${name}'`,
        affectedComponent: name,
        newValue: gsi,
        details: `PK: ${gsi.keySchema[0].attributeName}, SK: ${gsi.keySchema[1]?.attributeName ?? 'none'}`,
        suggestedAction: 'GSI creation is performed one at a time. Wait for ACTIVE status before creating next GSI.',
        requiresDataMigration: true,
        isBreaking: false,
        estimatedImpact: 'GSI creation can take minutes to hours depending on table size',
      })
    }
  }

  // Find removed GSIs
  for (const [name, gsi] of previousGSIs) {
    if (!currentGSIs.has(name)) {
      changes.push({
        type: 'gsi_remove',
        severity: 'high',
        description: `Remove GSI '${name}'`,
        affectedComponent: name,
        previousValue: gsi,
        details: 'Queries using this GSI will fail after removal',
        suggestedAction: 'Ensure no queries depend on this GSI before removal. Update application code first.',
        requiresDataMigration: false,
        isBreaking: true,
        estimatedImpact: 'GSI deletion is quick but queries will fail immediately',
      })
    }
  }

  // Find modified GSIs (key schema or projection changes require recreation)
  for (const [name, currentGSI] of currentGSIs) {
    const previousGSI = previousGSIs.get(name)
    if (previousGSI) {
      const pkChanged = previousGSI.keySchema[0].attributeName !== currentGSI.keySchema[0].attributeName
      const skChanged = (previousGSI.keySchema[1]?.attributeName ?? '') !== (currentGSI.keySchema[1]?.attributeName ?? '')
      const projectionChanged = previousGSI.projection.projectionType !== currentGSI.projection.projectionType

      if (pkChanged || skChanged || projectionChanged) {
        changes.push({
          type: 'gsi_modify',
          severity: 'high',
          description: `GSI '${name}' key schema or projection changed (requires recreation)`,
          affectedComponent: name,
          previousValue: previousGSI,
          newValue: currentGSI,
          details: 'GSI key schema cannot be modified in place. Must delete and recreate.',
          suggestedAction: 'Delete the existing GSI, wait for deletion, then create the new GSI.',
          requiresDataMigration: true,
          isBreaking: true,
          estimatedImpact: 'Recreation can take significant time. Plan for query downtime.',
        })
      }
    }
  }
}

/**
 * Compare LSI definitions between schemas
 * Note: LSIs can only be defined at table creation time
 */
function diffLSIs(
  previous: CreateTableInput,
  current: CreateTableInput,
  changes: SchemaChange[],
): void {
  const previousLSIs = new Set(
    (previous.localSecondaryIndexes ?? []).map(l => l.indexName),
  )
  const currentLSIs = new Set(
    (current.localSecondaryIndexes ?? []).map(l => l.indexName),
  )

  // Find added LSIs (critical - requires table recreation)
  for (const name of currentLSIs) {
    if (!previousLSIs.has(name)) {
      changes.push({
        type: 'lsi_add',
        severity: 'critical',
        description: `New LSI '${name}' requires table recreation`,
        affectedComponent: name,
        details: 'LSIs can only be created at table creation time.',
        suggestedAction: 'Create a new table with the LSI, migrate data, then switch over.',
        requiresDataMigration: true,
        isBreaking: true,
        estimatedImpact: 'Full table recreation and data migration required',
      })
    }
  }

  // Find removed LSIs (critical - requires table recreation)
  for (const name of previousLSIs) {
    if (!currentLSIs.has(name)) {
      changes.push({
        type: 'lsi_remove',
        severity: 'critical',
        description: `LSI '${name}' removal requires table recreation`,
        affectedComponent: name,
        details: 'LSIs cannot be removed from existing tables.',
        suggestedAction: 'Create a new table without the LSI, migrate data, then switch over.',
        requiresDataMigration: true,
        isBreaking: true,
        estimatedImpact: 'Full table recreation and data migration required',
      })
    }
  }
}

/**
 * Compare entity types between schema versions
 */
function diffEntityTypes(
  previousTypes: string[],
  currentTypes: string[],
  changes: SchemaChange[],
): void {
  const previous = new Set(previousTypes)
  const current = new Set(currentTypes)

  // Find added entity types (info only - DynamoDB is schemaless)
  for (const type of current) {
    if (!previous.has(type)) {
      changes.push({
        type: 'entity_add',
        severity: 'info',
        description: `New entity type '${type}' added`,
        affectedComponent: type,
        details: 'DynamoDB is schemaless. New entity types require no table changes.',
        requiresDataMigration: false,
        isBreaking: false,
      })
    }
  }

  // Find removed entity types (info only - data may still exist)
  for (const type of previous) {
    if (!current.has(type)) {
      changes.push({
        type: 'entity_remove',
        severity: 'low',
        description: `Entity type '${type}' removed from models`,
        affectedComponent: type,
        details: 'Existing items with this entity type will remain in the table.',
        suggestedAction: 'Consider cleaning up orphaned items if no longer needed.',
        requiresDataMigration: false,
        isBreaking: false,
      })
    }
  }
}

/**
 * Compare table-level settings
 */
function diffTableSettings(
  previous: CreateTableInput,
  current: CreateTableInput,
  changes: SchemaChange[],
): void {
  // Table class change
  if (previous.tableClass !== current.tableClass) {
    changes.push({
      type: 'table_settings',
      severity: 'low',
      description: `Table class changed from '${previous.tableClass ?? 'STANDARD'}' to '${current.tableClass ?? 'STANDARD'}'`,
      affectedComponent: 'tableClass',
      previousValue: previous.tableClass,
      newValue: current.tableClass,
      requiresDataMigration: false,
      isBreaking: false,
      estimatedImpact: 'Table class can be changed online',
    })
  }

  // Deletion protection change
  if (previous.deletionProtectionEnabled !== current.deletionProtectionEnabled) {
    changes.push({
      type: 'table_settings',
      severity: 'low',
      description: `Deletion protection ${current.deletionProtectionEnabled ? 'enabled' : 'disabled'}`,
      affectedComponent: 'deletionProtection',
      previousValue: previous.deletionProtectionEnabled,
      newValue: current.deletionProtectionEnabled,
      requiresDataMigration: false,
      isBreaking: false,
    })
  }
}

/**
 * Compare TTL settings
 */
function diffTTL(
  _previousState: MigrationState,
  currentSchema: SchemaGenerationResult,
  changes: SchemaChange[],
): void {
  // For simplicity, check if TTL config exists in current but not tracked in previous
  // A more complete implementation would track TTL state in MigrationState
  if (currentSchema.ttlSpecification?.enabled) {
    changes.push({
      type: 'ttl_change',
      severity: 'low',
      description: `TTL enabled on attribute '${currentSchema.ttlSpecification.attributeName}'`,
      affectedComponent: 'TTL',
      newValue: currentSchema.ttlSpecification,
      requiresDataMigration: false,
      isBreaking: false,
      estimatedImpact: 'TTL changes take up to one hour to propagate',
    })
  }
}

/**
 * Compare stream settings
 */
function diffStreams(
  previous: CreateTableInput,
  current: CreateTableInput,
  changes: SchemaChange[],
): void {
  const prevStream = previous.streamSpecification
  const currStream = current.streamSpecification

  const prevEnabled = prevStream?.streamEnabled ?? false
  const currEnabled = currStream?.streamEnabled ?? false

  if (prevEnabled !== currEnabled) {
    changes.push({
      type: 'stream_change',
      severity: 'low',
      description: `DynamoDB Streams ${currEnabled ? 'enabled' : 'disabled'}`,
      affectedComponent: 'streams',
      previousValue: prevStream,
      newValue: currStream,
      requiresDataMigration: false,
      isBreaking: !currEnabled, // Disabling streams may break stream consumers
    })
  }
  else if (prevEnabled && currEnabled && prevStream?.streamViewType !== currStream?.streamViewType) {
    changes.push({
      type: 'stream_change',
      severity: 'medium',
      description: `Stream view type changed from '${prevStream?.streamViewType}' to '${currStream?.streamViewType}'`,
      affectedComponent: 'streams',
      previousValue: prevStream,
      newValue: currStream,
      requiresDataMigration: false,
      isBreaking: true,
      details: 'Stream consumers may need to be updated to handle different record format',
    })
  }
}

/**
 * Compare capacity settings
 */
function diffCapacity(
  previous: CreateTableInput,
  current: CreateTableInput,
  changes: SchemaChange[],
): void {
  if (previous.billingMode !== current.billingMode) {
    const isToOnDemand = current.billingMode === 'PAY_PER_REQUEST'
    changes.push({
      type: 'capacity_change',
      severity: 'medium',
      description: `Billing mode changed from '${previous.billingMode}' to '${current.billingMode}'`,
      affectedComponent: 'billingMode',
      previousValue: previous.billingMode,
      newValue: current.billingMode,
      details: isToOnDemand
        ? 'Switching to on-demand removes capacity limits but may increase costs for predictable workloads'
        : 'Switching to provisioned requires capacity planning',
      requiresDataMigration: false,
      isBreaking: false,
    })
  }

  // Compare provisioned throughput if both use provisioned mode
  if (previous.billingMode === 'PROVISIONED' && current.billingMode === 'PROVISIONED') {
    const prevThroughput = previous.provisionedThroughput
    const currThroughput = current.provisionedThroughput

    if (prevThroughput && currThroughput) {
      if (prevThroughput.readCapacityUnits !== currThroughput.readCapacityUnits
        || prevThroughput.writeCapacityUnits !== currThroughput.writeCapacityUnits) {
        changes.push({
          type: 'capacity_change',
          severity: 'low',
          description: `Provisioned capacity changed: RCU ${prevThroughput.readCapacityUnits}→${currThroughput.readCapacityUnits}, WCU ${prevThroughput.writeCapacityUnits}→${currThroughput.writeCapacityUnits}`,
          affectedComponent: 'provisionedThroughput',
          previousValue: prevThroughput,
          newValue: currThroughput,
          requiresDataMigration: false,
          isBreaking: false,
        })
      }
    }
  }
}

/**
 * Build the complete diff result from changes
 */
function buildDiffResult(
  changes: SchemaChange[],
  currentSchema: SchemaGenerationResult,
): SchemaDiffResult {
  // Group changes by severity
  const changesBySeverity: Record<ChangeSeverity, SchemaChange[]> = {
    info: [],
    low: [],
    medium: [],
    high: [],
    critical: [],
  }

  // Group changes by type
  const changesByType: Record<ChangeType, SchemaChange[]> = {
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
  }

  for (const change of changes) {
    changesBySeverity[change.severity].push(change)
    changesByType[change.type].push(change)
  }

  // Calculate summary
  const summary: DiffSummary = {
    totalChanges: changes.length,
    gsiAdditions: changesByType.gsi_add.length,
    gsiRemovals: changesByType.gsi_remove.length,
    entityAdditions: changesByType.entity_add.length,
    entityRemovals: changesByType.entity_remove.length,
    breakingChanges: changes.filter(c => c.isBreaking).length,
    migrationRequired: changes.some(c => c.requiresDataMigration),
  }

  // Generate migration plan
  const migrationPlan = generateMigrationPlan(changes, currentSchema)

  return {
    hasChanges: changes.length > 0,
    hasBreakingChanges: summary.breakingChanges > 0,
    requiresDataMigration: summary.migrationRequired,
    changes,
    changesBySeverity,
    changesByType,
    summary,
    migrationPlan,
  }
}

/**
 * Generate an ordered migration plan from changes
 */
function generateMigrationPlan(
  changes: SchemaChange[],
  currentSchema: SchemaGenerationResult,
): MigrationStep[] {
  const steps: MigrationStep[] = []
  let order = 1

  // 1. Table creation (if needed)
  const tableCreate = changes.find(c => c.type === 'table_create')
  if (tableCreate) {
    steps.push({
      order: order++,
      operation: 'create_table',
      description: `Create table '${currentSchema.createTableInput.tableName}'`,
      params: currentSchema.createTableInput as unknown as Record<string, unknown>,
      waitForCompletion: true,
      estimatedDuration: '1-2 minutes',
      dependsOn: [],
    })

    // Wait for table to be active
    steps.push({
      order: order++,
      operation: 'wait',
      description: 'Wait for table to become ACTIVE',
      waitForCompletion: true,
      estimatedDuration: '1-2 minutes',
      dependsOn: [order - 2],
    })

    // Apply TTL if specified
    if (currentSchema.ttlSpecification?.enabled) {
      steps.push({
        order: order++,
        operation: 'update_ttl',
        description: `Enable TTL on attribute '${currentSchema.ttlSpecification.attributeName}'`,
        params: {
          TableName: currentSchema.createTableInput.tableName,
          TimeToLiveSpecification: currentSchema.ttlSpecification,
        },
        waitForCompletion: true,
        estimatedDuration: 'Up to 1 hour for full propagation',
        dependsOn: [order - 2],
      })
    }

    return steps
  }

  // 2. GSI removals first (to free up GSI slot limits)
  const gsiRemovals = changes.filter(c => c.type === 'gsi_remove')
  for (const removal of gsiRemovals) {
    steps.push({
      order: order++,
      operation: 'delete_gsi',
      description: `Delete GSI '${removal.affectedComponent}'`,
      params: {
        TableName: currentSchema.createTableInput.tableName,
        GlobalSecondaryIndexUpdates: [{
          Delete: { IndexName: removal.affectedComponent },
        }],
      },
      waitForCompletion: true,
      estimatedDuration: 'A few minutes',
      dependsOn: order > 1 ? [order - 2] : [],
    })

    // Wait for deletion
    steps.push({
      order: order++,
      operation: 'wait',
      description: `Wait for GSI '${removal.affectedComponent}' deletion`,
      waitForCompletion: true,
      estimatedDuration: 'A few minutes',
      dependsOn: [order - 2],
    })
  }

  // 3. GSI modifications (delete then add)
  const gsiModifications = changes.filter(c => c.type === 'gsi_modify')
  for (const mod of gsiModifications) {
    // Delete the old GSI
    steps.push({
      order: order++,
      operation: 'delete_gsi',
      description: `Delete modified GSI '${mod.affectedComponent}' (recreation step 1/2)`,
      params: {
        TableName: currentSchema.createTableInput.tableName,
        GlobalSecondaryIndexUpdates: [{
          Delete: { IndexName: mod.affectedComponent },
        }],
      },
      waitForCompletion: true,
      dependsOn: order > 1 ? [order - 2] : [],
    })

    steps.push({
      order: order++,
      operation: 'wait',
      description: `Wait for GSI '${mod.affectedComponent}' deletion`,
      waitForCompletion: true,
      dependsOn: [order - 2],
    })

    // Create the new GSI (will be done in GSI additions below)
  }

  // 4. GSI additions (one at a time, DynamoDB limitation)
  const gsiAdditions = changes.filter(c => c.type === 'gsi_add')
  // Also include GSIs that need recreation from modifications
  const gsiModNewValues = gsiModifications.map(m => m.newValue as GlobalSecondaryIndexInput).filter(Boolean)

  const allGSIsToAdd = [
    ...(currentSchema.createTableInput.globalSecondaryIndexes ?? []).filter(
      gsi => gsiAdditions.some(a => a.affectedComponent === gsi.indexName),
    ),
    ...gsiModNewValues,
  ]

  for (const gsi of allGSIsToAdd) {
    // Determine attribute definitions needed
    const attributeDefinitions = currentSchema.createTableInput.attributeDefinitions.filter(
      attr => gsi.keySchema.some(k => k.attributeName === attr.attributeName),
    )

    steps.push({
      order: order++,
      operation: 'create_gsi',
      description: `Create GSI '${gsi.indexName}'`,
      params: {
        TableName: currentSchema.createTableInput.tableName,
        AttributeDefinitions: attributeDefinitions,
        GlobalSecondaryIndexUpdates: [{
          Create: {
            IndexName: gsi.indexName,
            KeySchema: gsi.keySchema,
            Projection: gsi.projection,
            ProvisionedThroughput: gsi.provisionedThroughput,
          },
        }],
      },
      waitForCompletion: true,
      estimatedDuration: 'Minutes to hours depending on table size',
      dependsOn: order > 1 ? [order - 2] : [],
    })

    steps.push({
      order: order++,
      operation: 'wait',
      description: `Wait for GSI '${gsi.indexName}' to become ACTIVE`,
      waitForCompletion: true,
      dependsOn: [order - 2],
    })

    // Add backfill step if needed
    steps.push({
      order: order++,
      operation: 'backfill_data',
      description: `Backfill GSI attributes for '${gsi.indexName}'`,
      params: {
        indexName: gsi.indexName,
        pkAttribute: gsi.keySchema[0].attributeName,
        skAttribute: gsi.keySchema[1]?.attributeName,
      },
      waitForCompletion: true,
      estimatedDuration: 'Depends on data volume',
      dependsOn: [order - 2],
    })
  }

  // 5. Capacity changes
  const capacityChanges = changes.filter(c => c.type === 'capacity_change')
  for (const cap of capacityChanges) {
    steps.push({
      order: order++,
      operation: 'update_table',
      description: cap.description,
      params: {
        TableName: currentSchema.createTableInput.tableName,
        BillingMode: currentSchema.createTableInput.billingMode,
        ProvisionedThroughput: currentSchema.createTableInput.provisionedThroughput,
      },
      waitForCompletion: true,
      dependsOn: [],
    })
  }

  // 6. Stream changes
  const streamChanges = changes.filter(c => c.type === 'stream_change')
  for (const stream of streamChanges) {
    steps.push({
      order: order++,
      operation: 'update_stream',
      description: stream.description,
      params: {
        TableName: currentSchema.createTableInput.tableName,
        StreamSpecification: currentSchema.createTableInput.streamSpecification,
      },
      waitForCompletion: true,
      dependsOn: [],
    })
  }

  // 7. TTL changes
  const ttlChanges = changes.filter(c => c.type === 'ttl_change')
  for (const ttl of ttlChanges) {
    steps.push({
      order: order++,
      operation: 'update_ttl',
      description: ttl.description,
      params: {
        TableName: currentSchema.createTableInput.tableName,
        TimeToLiveSpecification: currentSchema.ttlSpecification,
      },
      waitForCompletion: true,
      estimatedDuration: 'Up to 1 hour for full propagation',
      dependsOn: [],
    })
  }

  return steps
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a hash of the schema for quick comparison
 */
export function generateSchemaHash(schema: CreateTableInput): string {
  const normalized = JSON.stringify({
    keySchema: schema.keySchema,
    gsis: (schema.globalSecondaryIndexes ?? [])
      .map(g => ({ name: g.indexName, keys: g.keySchema }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    lsis: (schema.localSecondaryIndexes ?? [])
      .map(l => ({ name: l.indexName, keys: l.keySchema }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })

  // Simple hash function
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Create a migration state from a schema generation result
 */
export function createMigrationState(
  schema: SchemaGenerationResult,
  version?: string,
): MigrationState {
  return {
    version: version ?? new Date().toISOString().replace(/[:.]/g, '-'),
    appliedAt: new Date().toISOString(),
    schemaHash: generateSchemaHash(schema.createTableInput),
    appliedSchema: schema.createTableInput,
    entityTypes: schema.summary.entityTypes,
    gsiNames: (schema.createTableInput.globalSecondaryIndexes ?? []).map(g => g.indexName),
    lsiNames: (schema.createTableInput.localSecondaryIndexes ?? []).map(l => l.indexName),
  }
}

/**
 * Format diff result for human-readable output
 */
export function formatDiffSummary(result: SchemaDiffResult): string {
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push('Schema Diff Summary')
  lines.push('='.repeat(60))
  lines.push('')

  if (!result.hasChanges) {
    lines.push('No changes detected. Schema is up to date.')
    return lines.join('\n')
  }

  // Summary
  lines.push(`Total changes: ${result.summary.totalChanges}`)
  lines.push(`  GSI additions: ${result.summary.gsiAdditions}`)
  lines.push(`  GSI removals: ${result.summary.gsiRemovals}`)
  lines.push(`  Entity additions: ${result.summary.entityAdditions}`)
  lines.push(`  Entity removals: ${result.summary.entityRemovals}`)
  lines.push(`  Breaking changes: ${result.summary.breakingChanges}`)
  lines.push(`  Migration required: ${result.summary.migrationRequired ? 'Yes' : 'No'}`)
  lines.push('')

  // Breaking changes warning
  if (result.hasBreakingChanges) {
    lines.push('⚠️  WARNING: Breaking changes detected!')
    lines.push('')
    for (const change of result.changes.filter(c => c.isBreaking)) {
      lines.push(`  [${change.severity.toUpperCase()}] ${change.description}`)
      if (change.suggestedAction) {
        lines.push(`    → ${change.suggestedAction}`)
      }
    }
    lines.push('')
  }

  // All changes by severity
  const severityOrder: ChangeSeverity[] = ['critical', 'high', 'medium', 'low', 'info']
  for (const severity of severityOrder) {
    const severityChanges = result.changesBySeverity[severity]
    if (severityChanges.length > 0) {
      lines.push(`${severity.toUpperCase()} Changes:`)
      for (const change of severityChanges) {
        lines.push(`  • ${change.description}`)
        if (change.details) {
          lines.push(`    ${change.details}`)
        }
      }
      lines.push('')
    }
  }

  // Migration plan
  if (result.migrationPlan.length > 0) {
    lines.push('-'.repeat(60))
    lines.push('Migration Plan:')
    lines.push('-'.repeat(60))
    for (const step of result.migrationPlan) {
      const deps = step.dependsOn.length > 0 ? ` (after step ${step.dependsOn.join(', ')})` : ''
      lines.push(`  ${step.order}. [${step.operation}] ${step.description}${deps}`)
      if (step.estimatedDuration) {
        lines.push(`     Duration: ${step.estimatedDuration}`)
      }
    }
    lines.push('')
  }

  lines.push('='.repeat(60))

  return lines.join('\n')
}
