// ============================================================================
// Automatic Schema Generator for DynamoDB Single-Table Design
// ============================================================================

import type { ModelRegistry } from '../model-parser/types'
import type { GSIOptimization } from '../single-table/GsiDeriver'
import type { Config, ProjectionType } from '../types'
import { getConfig } from '../config'
import { getModelRegistry } from '../model-parser/StacksModelParser'
import { deriveGSIsFromModels } from '../single-table/GsiDeriver'
import { deriveLSIsFromModels } from '../single-table/LsiDeriver'

// ============================================================================
// Types
// ============================================================================

/**
 * DynamoDB attribute definition for CreateTable
 */
export interface DynamoDBAttributeDefinition {
  attributeName: string
  attributeType: 'S' | 'N' | 'B'
}

/**
 * Key schema definition for primary key or index
 */
export interface KeySchemaElement {
  attributeName: string
  keyType: 'HASH' | 'RANGE'
}

/**
 * Provisioned throughput settings
 */
export interface ProvisionedThroughput {
  readCapacityUnits: number
  writeCapacityUnits: number
}

/**
 * Global Secondary Index definition for CreateTable
 */
export interface GlobalSecondaryIndexInput {
  indexName: string
  keySchema: KeySchemaElement[]
  projection: {
    projectionType: ProjectionType
    nonKeyAttributes?: string[]
  }
  provisionedThroughput?: ProvisionedThroughput
}

/**
 * Local Secondary Index definition for CreateTable
 */
export interface LocalSecondaryIndexInput {
  indexName: string
  keySchema: KeySchemaElement[]
  projection: {
    projectionType: ProjectionType
    nonKeyAttributes?: string[]
  }
}

/**
 * SSE (Server-Side Encryption) specification
 */
export interface SSESpecification {
  enabled: boolean
  sseType?: 'AES256' | 'KMS'
  kmsMasterKeyId?: string
}

/**
 * Stream specification for DynamoDB Streams
 */
export interface StreamSpecification {
  streamEnabled: boolean
  streamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
}

/**
 * TTL specification
 */
export interface TimeToLiveSpecification {
  enabled: boolean
  attributeName: string
}

/**
 * Complete CreateTable input parameters
 */
export interface CreateTableInput {
  tableName: string
  attributeDefinitions: DynamoDBAttributeDefinition[]
  keySchema: KeySchemaElement[]
  globalSecondaryIndexes?: GlobalSecondaryIndexInput[]
  localSecondaryIndexes?: LocalSecondaryIndexInput[]
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
  provisionedThroughput?: ProvisionedThroughput
  sseSpecification?: SSESpecification
  streamSpecification?: StreamSpecification
  tableClass?: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'
  deletionProtectionEnabled?: boolean
  tags?: Array<{ key: string, value: string }>
}

/**
 * Schema generation result
 */
export interface SchemaGenerationResult {
  /**
   * CreateTable input parameters ready for DynamoDB API
   */
  createTableInput: CreateTableInput
  /**
   * TTL specification (applied separately after table creation)
   */
  ttlSpecification?: TimeToLiveSpecification
  /**
   * Human-readable summary of the schema
   */
  summary: SchemaSummary
  /**
   * Optimization suggestions
   */
  optimizations: GSIOptimization[]
  /**
   * Access patterns that this schema supports
   */
  supportedAccessPatterns: AccessPatternSummary[]
}

/**
 * Human-readable schema summary
 */
export interface SchemaSummary {
  tableName: string
  billingMode: string
  primaryKey: string
  sortKey: string
  gsiCount: number
  lsiCount: number
  entityTypes: string[]
  hasTimestamps: boolean
  hasSoftDeletes: boolean
  hasTtl: boolean
  hasStreams: boolean
}

/**
 * Access pattern summary
 */
export interface AccessPatternSummary {
  name: string
  description: string
  entityType: string
  operation: 'GetItem' | 'Query' | 'Scan'
  index: string
  keyPattern: string
}

// ============================================================================
// Schema Generator Implementation
// ============================================================================

/**
 * Generate a complete DynamoDB table schema from parsed models
 *
 * This is the core function that takes Stacks models and automatically generates
 * an optimal single-table design with appropriate GSIs for all access patterns.
 *
 * @param config - Configuration options
 * @returns Complete schema generation result
 */
export async function generateSchema(config?: Config): Promise<SchemaGenerationResult> {
  const resolvedConfig = config ?? await getConfig()
  const registry = await getModelRegistry(resolvedConfig)

  return generateSchemaFromRegistry(registry, resolvedConfig)
}

/**
 * Generate schema from an existing model registry
 *
 * @param registry - Parsed model registry
 * @param config - Configuration options
 * @returns Complete schema generation result
 */
export function generateSchemaFromRegistry(
  registry: ModelRegistry,
  config: Config,
): SchemaGenerationResult {
  const std = config.singleTableDesign
  const tableName = `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

  // Collect all attribute definitions needed for the table
  const attributeDefinitions: DynamoDBAttributeDefinition[] = [
    { attributeName: std.partitionKeyName, attributeType: 'S' },
    { attributeName: std.sortKeyName, attributeType: 'S' },
  ]

  // Derive GSIs from model relationships
  const derivedGSIs = deriveGSIsFromModels(registry, config)
  const gsiInputs: GlobalSecondaryIndexInput[] = []

  // Add GSI attribute definitions and create GSI inputs
  for (const gsi of derivedGSIs.gsiDefinitions) {
    // Add pk attribute if not already present
    if (!attributeDefinitions.some(a => a.attributeName === gsi.partitionKey)) {
      attributeDefinitions.push({ attributeName: gsi.partitionKey, attributeType: 'S' })
    }

    // Add sk attribute if present and not already defined
    if (gsi.sortKey && !attributeDefinitions.some(a => a.attributeName === gsi.sortKey)) {
      attributeDefinitions.push({ attributeName: gsi.sortKey, attributeType: 'S' })
    }

    const gsiInput: GlobalSecondaryIndexInput = {
      indexName: gsi.name,
      keySchema: [
        { attributeName: gsi.partitionKey, keyType: 'HASH' },
      ],
      projection: {
        projectionType: gsi.projection.type,
        nonKeyAttributes: gsi.projection.attributes,
      },
    }

    if (gsi.sortKey) {
      gsiInput.keySchema.push({ attributeName: gsi.sortKey, keyType: 'RANGE' })
    }

    // Add provisioned throughput for provisioned mode
    if (config.capacity.billingMode === 'PROVISIONED') {
      gsiInput.provisionedThroughput = {
        readCapacityUnits: gsi.readCapacity ?? config.capacity.read,
        writeCapacityUnits: gsi.writeCapacity ?? config.capacity.write,
      }
    }

    gsiInputs.push(gsiInput)
  }

  // Also add any explicitly configured GSIs from config
  for (const configGSI of config.globalSecondaryIndexes) {
    if (!gsiInputs.some(g => g.indexName === configGSI.name)) {
      // Add attributes if not present
      if (!attributeDefinitions.some(a => a.attributeName === configGSI.partitionKey)) {
        attributeDefinitions.push({ attributeName: configGSI.partitionKey, attributeType: 'S' })
      }
      if (configGSI.sortKey && !attributeDefinitions.some(a => a.attributeName === configGSI.sortKey)) {
        attributeDefinitions.push({ attributeName: configGSI.sortKey, attributeType: 'S' })
      }

      const gsiInput: GlobalSecondaryIndexInput = {
        indexName: configGSI.name,
        keySchema: [
          { attributeName: configGSI.partitionKey, keyType: 'HASH' },
        ],
        projection: {
          projectionType: configGSI.projection.type,
          nonKeyAttributes: configGSI.projection.attributes,
        },
      }

      if (configGSI.sortKey) {
        gsiInput.keySchema.push({ attributeName: configGSI.sortKey, keyType: 'RANGE' })
      }

      if (config.capacity.billingMode === 'PROVISIONED') {
        gsiInput.provisionedThroughput = {
          readCapacityUnits: configGSI.readCapacity ?? config.capacity.read,
          writeCapacityUnits: configGSI.writeCapacity ?? config.capacity.write,
        }
      }

      gsiInputs.push(gsiInput)
    }
  }

  // Derive LSIs from models
  const derivedLSIs = deriveLSIsFromModels(registry, config)
  const lsiInputs: LocalSecondaryIndexInput[] = []

  for (const lsi of derivedLSIs.lsiDefinitions) {
    // Add sk attribute if not already present
    if (!attributeDefinitions.some(a => a.attributeName === lsi.sortKey)) {
      attributeDefinitions.push({ attributeName: lsi.sortKey, attributeType: 'S' })
    }

    lsiInputs.push({
      indexName: lsi.name,
      keySchema: [
        { attributeName: std.partitionKeyName, keyType: 'HASH' },
        { attributeName: lsi.sortKey, keyType: 'RANGE' },
      ],
      projection: {
        projectionType: lsi.projection.type,
        nonKeyAttributes: lsi.projection.attributes,
      },
    })
  }

  // Add configured LSIs
  for (const configLSI of config.localSecondaryIndexes) {
    if (!lsiInputs.some(l => l.indexName === configLSI.name)) {
      if (!attributeDefinitions.some(a => a.attributeName === configLSI.sortKey)) {
        attributeDefinitions.push({ attributeName: configLSI.sortKey, attributeType: 'S' })
      }

      lsiInputs.push({
        indexName: configLSI.name,
        keySchema: [
          { attributeName: std.partitionKeyName, keyType: 'HASH' },
          { attributeName: configLSI.sortKey, keyType: 'RANGE' },
        ],
        projection: {
          projectionType: configLSI.projection.type,
          nonKeyAttributes: configLSI.projection.attributes,
        },
      })
    }
  }

  // Build CreateTable input
  const createTableInput: CreateTableInput = {
    tableName,
    attributeDefinitions,
    keySchema: [
      { attributeName: std.partitionKeyName, keyType: 'HASH' },
      { attributeName: std.sortKeyName, keyType: 'RANGE' },
    ],
    billingMode: config.capacity.billingMode,
  }

  // Add GSIs if any
  if (gsiInputs.length > 0) {
    createTableInput.globalSecondaryIndexes = gsiInputs
  }

  // Add LSIs if any
  if (lsiInputs.length > 0) {
    createTableInput.localSecondaryIndexes = lsiInputs
  }

  // Add provisioned throughput for provisioned mode
  if (config.capacity.billingMode === 'PROVISIONED') {
    createTableInput.provisionedThroughput = {
      readCapacityUnits: config.capacity.read,
      writeCapacityUnits: config.capacity.write,
    }
  }

  // Add stream specification if enabled
  if (config.streams.enabled) {
    createTableInput.streamSpecification = {
      streamEnabled: true,
      streamViewType: config.streams.viewType,
    }
  }

  // Add table class
  if (config.tableClass) {
    createTableInput.tableClass = config.tableClass
  }

  // Add deletion protection
  if (config.deletionProtection) {
    createTableInput.deletionProtectionEnabled = true
  }

  // Add tags
  if (Object.keys(config.tags).length > 0) {
    createTableInput.tags = Object.entries(config.tags).map(([key, value]) => ({ key, value }))
  }

  // Determine if any model uses TTL
  const modelWithTtl = Array.from(registry.models.values()).find(m => m.hasTtl)
  const ttlSpecification = (config.ttl.enabled || modelWithTtl)
    ? {
        enabled: true,
        attributeName: config.ttl.attributeName,
      }
    : undefined

  // Build summary
  const entityTypes = Array.from(registry.models.keys())
  const hasTimestamps = Array.from(registry.models.values()).some(m => m.hasTimestamps)
  const hasSoftDeletes = Array.from(registry.models.values()).some(m => m.hasSoftDeletes)

  const summary: SchemaSummary = {
    tableName,
    billingMode: config.capacity.billingMode,
    primaryKey: std.partitionKeyName,
    sortKey: std.sortKeyName,
    gsiCount: gsiInputs.length,
    lsiCount: lsiInputs.length,
    entityTypes,
    hasTimestamps,
    hasSoftDeletes,
    hasTtl: !!ttlSpecification,
    hasStreams: config.streams.enabled,
  }

  // Collect access patterns
  const supportedAccessPatterns = collectAccessPatterns(registry, config, gsiInputs)

  return {
    createTableInput,
    ttlSpecification,
    summary,
    optimizations: derivedGSIs.optimizations,
    supportedAccessPatterns,
  }
}

/**
 * Collect all supported access patterns from the schema
 */
function collectAccessPatterns(
  registry: ModelRegistry,
  config: Config,
  gsiInputs: GlobalSecondaryIndexInput[],
): AccessPatternSummary[] {
  const patterns: AccessPatternSummary[] = []
  const std = config.singleTableDesign
  const delimiter = std.keyDelimiter

  for (const model of registry.models.values()) {
    // Get by ID (primary key)
    patterns.push({
      name: `Get ${model.name} by ID`,
      description: `Retrieve a single ${model.name} by its primary key`,
      entityType: model.entityType,
      operation: 'GetItem',
      index: 'Main Table',
      keyPattern: `pk=${model.entityType}${delimiter}{id}, sk=${model.entityType}${delimiter}{id}`,
    })

    // Query all of entity type
    patterns.push({
      name: `List all ${model.name}s`,
      description: `Query all ${model.name} entities`,
      entityType: model.entityType,
      operation: 'Query',
      index: 'GSI (entity type)',
      keyPattern: `gsi1pk=${model.entityType}, sk begins_with ${model.entityType}${delimiter}`,
    })

    // Relationship patterns
    for (const rel of model.relationships) {
      if (rel.type === 'hasMany') {
        patterns.push({
          name: `Get ${rel.relatedModel}s for ${model.name}`,
          description: `Query ${rel.relatedModel} entities belonging to a ${model.name}`,
          entityType: rel.relatedModel,
          operation: 'Query',
          index: 'Main Table',
          keyPattern: `pk=${model.entityType}${delimiter}{parentId}, sk begins_with ${rel.relatedModel}${delimiter}`,
        })
      }

      if (rel.type === 'belongsTo' && rel.gsiIndex) {
        const gsi = gsiInputs.find(g => g.indexName === `GSI${rel.gsiIndex}`)
        if (gsi) {
          patterns.push({
            name: `Get ${model.name}s by ${rel.foreignKey}`,
            description: `Query ${model.name} entities by their ${rel.foreignKey}`,
            entityType: model.entityType,
            operation: 'Query',
            index: gsi.indexName,
            keyPattern: `${gsi.keySchema[0].attributeName}={${rel.foreignKey}}`,
          })
        }
      }
    }
  }

  return patterns
}

/**
 * Generate a human-readable schema summary for display
 */
export function formatSchemaSummary(result: SchemaGenerationResult): string {
  const { summary, createTableInput, supportedAccessPatterns, optimizations } = result
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push('DynamoDB Single-Table Schema Summary')
  lines.push('='.repeat(60))
  lines.push('')

  // Table basics
  lines.push(`Table Name: ${summary.tableName}`)
  lines.push(`Billing Mode: ${summary.billingMode}`)
  lines.push(`Table Class: ${createTableInput.tableClass ?? 'STANDARD'}`)
  lines.push('')

  // Keys
  lines.push('Primary Key:')
  lines.push(`  Partition Key (HASH): ${summary.primaryKey} (String)`)
  lines.push(`  Sort Key (RANGE): ${summary.sortKey} (String)`)
  lines.push('')

  // GSIs
  if (createTableInput.globalSecondaryIndexes && createTableInput.globalSecondaryIndexes.length > 0) {
    lines.push(`Global Secondary Indexes (${createTableInput.globalSecondaryIndexes.length}):`)
    for (const gsi of createTableInput.globalSecondaryIndexes) {
      const pk = gsi.keySchema.find(k => k.keyType === 'HASH')!
      const sk = gsi.keySchema.find(k => k.keyType === 'RANGE')
      lines.push(`  ${gsi.indexName}:`)
      lines.push(`    PK: ${pk.attributeName}`)
      if (sk) {
        lines.push(`    SK: ${sk.attributeName}`)
      }
      lines.push(`    Projection: ${gsi.projection.projectionType}`)
    }
    lines.push('')
  }

  // LSIs
  if (createTableInput.localSecondaryIndexes && createTableInput.localSecondaryIndexes.length > 0) {
    lines.push(`Local Secondary Indexes (${createTableInput.localSecondaryIndexes.length}):`)
    for (const lsi of createTableInput.localSecondaryIndexes) {
      const sk = lsi.keySchema.find(k => k.keyType === 'RANGE')!
      lines.push(`  ${lsi.indexName}: SK=${sk.attributeName}`)
    }
    lines.push('')
  }

  // Entity types
  lines.push(`Entity Types (${summary.entityTypes.length}):`)
  for (const entity of summary.entityTypes) {
    lines.push(`  - ${entity}`)
  }
  lines.push('')

  // Features
  lines.push('Features:')
  lines.push(`  Timestamps: ${summary.hasTimestamps ? 'Yes' : 'No'}`)
  lines.push(`  Soft Deletes: ${summary.hasSoftDeletes ? 'Yes' : 'No'}`)
  lines.push(`  TTL: ${summary.hasTtl ? 'Yes' : 'No'}`)
  lines.push(`  Streams: ${summary.hasStreams ? 'Yes' : 'No'}`)
  lines.push('')

  // Access patterns
  if (supportedAccessPatterns.length > 0) {
    lines.push('Supported Access Patterns:')
    for (const pattern of supportedAccessPatterns) {
      lines.push(`  ${pattern.name}`)
      lines.push(`    ${pattern.operation} on ${pattern.index}`)
      lines.push(`    ${pattern.keyPattern}`)
    }
    lines.push('')
  }

  // Optimizations
  if (optimizations.length > 0) {
    lines.push('Optimization Suggestions:')
    for (const optimization of optimizations) {
      lines.push(`  [${optimization.type.toUpperCase()}] ${optimization.description}`)
      if (optimization.benefit) {
        lines.push(`    Benefit: ${optimization.benefit}`)
      }
    }
    lines.push('')
  }

  lines.push('='.repeat(60))

  return lines.join('\n')
}

/**
 * Export the schema as JSON for debugging or external tools
 */
export function exportSchemaAsJSON(result: SchemaGenerationResult): string {
  return JSON.stringify(result.createTableInput, null, 2)
}
