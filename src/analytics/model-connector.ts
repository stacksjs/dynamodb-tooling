/**
 * Analytics Model Connector
 *
 * Bridges analytics Stacks models with the dynamodb-tooling model parser
 * and single-table design generator. This allows the existing tooling
 * to work with analytics models.
 */

import {
  AggregatedStatsModel,
  analyticsModels,
  CampaignStatsModel,
  ConversionModel,
  CustomEventModel,
  DeviceStatsModel,
  EventStatsModel,
  GeoStatsModel,
  GoalModel,
  GoalStatsModel,
  PageStatsModel,
  PageViewModel,
  RealtimeStatsModel,
  ReferrerStatsModel,
  SessionModel,
  SiteModel,
} from './models'

// ============================================================================
// Types
// ============================================================================

/**
 * Stacks model definition (matches model-parser types)
 */
export interface StacksModelDefinition {
  name: string
  table?: string
  primaryKey?: string | string[]
  autoIncrement?: boolean
  attributes: Record<string, AttributeDefinition>
  hasOne?: string[]
  hasMany?: string[]
  belongsTo?: string[]
  belongsToMany?: string[]
  traits?: ModelTraits
  dynamodb?: DynamoDBKeyPatterns
  indexes?: IndexDefinition[]
}

export interface AttributeDefinition {
  required?: boolean
  unique?: boolean
  fillable?: boolean
  hidden?: boolean
  default?: unknown
  validation?: {
    rule?: string
    message?: Record<string, string>
  }
  cast?: string
  comment?: string
}

export interface ModelTraits {
  useUuid?: boolean
  useTimestamps?: boolean
  useSoftDeletes?: boolean
  useTtl?: boolean
  useVersioning?: boolean
}

export interface DynamoDBKeyPatterns {
  pk: (entity: Record<string, unknown>) => string
  sk: (entity: Record<string, unknown>) => string
  gsi1pk?: (entity: Record<string, unknown>) => string
  gsi1sk?: (entity: Record<string, unknown>) => string
  gsi2pk?: (entity: Record<string, unknown>) => string
  gsi2sk?: (entity: Record<string, unknown>) => string
}

export interface IndexDefinition {
  name: string
  columns: string[]
}

/**
 * Access pattern definition
 */
export interface AccessPattern {
  name: string
  description: string
  operation: 'Get' | 'Query' | 'Scan'
  index?: 'main' | 'GSI1' | 'GSI2'
  keyCondition: string
  filterExpression?: string
  example?: string
}

/**
 * Single-table design output
 */
export interface SingleTableDesign {
  tableName: string
  keySchema: {
    partitionKey: { name: string, type: 'S' | 'N' | 'B' }
    sortKey: { name: string, type: 'S' | 'N' | 'B' }
  }
  globalSecondaryIndexes: Array<{
    indexName: string
    partitionKey: { name: string, type: 'S' | 'N' | 'B' }
    sortKey: { name: string, type: 'S' | 'N' | 'B' }
    projection: 'ALL' | 'KEYS_ONLY' | string[]
  }>
  entities: EntityDesign[]
  accessPatterns: AccessPattern[]
}

export interface EntityDesign {
  name: string
  keyPattern: {
    pk: string
    sk: string
    gsi1pk?: string
    gsi1sk?: string
    gsi2pk?: string
    gsi2sk?: string
  }
  attributes: Array<{
    name: string
    type: string
    dynamoType: 'S' | 'N' | 'B' | 'BOOL' | 'L' | 'M' | 'SS' | 'NS' | 'BS'
    required: boolean
  }>
  relationships: Array<{
    type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'
    target: string
    foreignKey?: string
  }>
}

// ============================================================================
// Model Registry
// ============================================================================

/**
 * Map of all analytics models
 */
export const analyticsModelRegistry: Record<string, StacksModelDefinition> = {
  Site: SiteModel as unknown as StacksModelDefinition,
  PageView: PageViewModel as unknown as StacksModelDefinition,
  Session: SessionModel as unknown as StacksModelDefinition,
  CustomEvent: CustomEventModel as unknown as StacksModelDefinition,
  Goal: GoalModel as unknown as StacksModelDefinition,
  Conversion: ConversionModel as unknown as StacksModelDefinition,
  AggregatedStats: AggregatedStatsModel as unknown as StacksModelDefinition,
  PageStats: PageStatsModel as unknown as StacksModelDefinition,
  ReferrerStats: ReferrerStatsModel as unknown as StacksModelDefinition,
  GeoStats: GeoStatsModel as unknown as StacksModelDefinition,
  DeviceStats: DeviceStatsModel as unknown as StacksModelDefinition,
  CampaignStats: CampaignStatsModel as unknown as StacksModelDefinition,
  EventStats: EventStatsModel as unknown as StacksModelDefinition,
  GoalStats: GoalStatsModel as unknown as StacksModelDefinition,
  RealtimeStats: RealtimeStatsModel as unknown as StacksModelDefinition,
}

/**
 * Get all analytics model names
 */
export function getAnalyticsModelNames(): string[] {
  return [...analyticsModels]
}

/**
 * Get a specific analytics model
 */
export function getAnalyticsModel(name: string): StacksModelDefinition | undefined {
  return analyticsModelRegistry[name]
}

/**
 * Get all analytics models
 */
export function getAllAnalyticsModels(): StacksModelDefinition[] {
  return Object.values(analyticsModelRegistry)
}

// ============================================================================
// Single-Table Design Generator
// ============================================================================

/**
 * Generate single-table design from analytics models
 */
export function generateAnalyticsSingleTableDesign(
  tableName = 'analytics',
): SingleTableDesign {
  const entities: EntityDesign[] = []
  const accessPatterns: AccessPattern[] = []

  for (const [name, model] of Object.entries(analyticsModelRegistry)) {
    // Generate entity design
    const entity = generateEntityDesign(name, model)
    entities.push(entity)

    // Generate access patterns for this entity
    const patterns = generateAccessPatterns(name, model)
    accessPatterns.push(...patterns)
  }

  return {
    tableName,
    keySchema: {
      partitionKey: { name: 'pk', type: 'S' },
      sortKey: { name: 'sk', type: 'S' },
    },
    globalSecondaryIndexes: [
      {
        indexName: 'GSI1',
        partitionKey: { name: 'gsi1pk', type: 'S' },
        sortKey: { name: 'gsi1sk', type: 'S' },
        projection: 'ALL',
      },
      {
        indexName: 'GSI2',
        partitionKey: { name: 'gsi2pk', type: 'S' },
        sortKey: { name: 'gsi2sk', type: 'S' },
        projection: 'ALL',
      },
    ],
    entities,
    accessPatterns,
  }
}

/**
 * Generate entity design from model
 */
function generateEntityDesign(name: string, model: StacksModelDefinition): EntityDesign {
  const attributes = Object.entries(model.attributes || {}).map(([attrName, attr]) => ({
    name: attrName,
    type: attr.cast || inferType(attr),
    dynamoType: inferDynamoType(attr),
    required: attr.required || false,
  }))

  const relationships: EntityDesign['relationships'] = []

  if (model.hasOne) {
    relationships.push(...model.hasOne.map(target => ({
      type: 'hasOne' as const,
      target,
    })))
  }

  if (model.hasMany) {
    relationships.push(...model.hasMany.map(target => ({
      type: 'hasMany' as const,
      target,
    })))
  }

  if (model.belongsTo) {
    relationships.push(...model.belongsTo.map(target => ({
      type: 'belongsTo' as const,
      target,
      foreignKey: `${target.toLowerCase()}Id`,
    })))
  }

  // Extract key patterns from dynamodb config
  const keyPattern = extractKeyPatterns(name, model)

  return {
    name,
    keyPattern,
    attributes,
    relationships,
  }
}

/**
 * Extract key patterns from model's dynamodb config
 */
function extractKeyPatterns(
  name: string,
  model: StacksModelDefinition,
): EntityDesign['keyPattern'] {
  // Default patterns based on entity name
  const entityPrefix = name.toUpperCase()
  const defaultPatterns = {
    pk: `${entityPrefix}#{id}`,
    sk: `${entityPrefix}#{id}`,
  }

  // If model has dynamodb key functions, extract pattern descriptions
  if (model.dynamodb) {
    // These are functions, so we provide descriptive patterns
    // based on the analytics key pattern conventions
    return getAnalyticsKeyPatterns(name)
  }

  return defaultPatterns
}

/**
 * Get predefined key patterns for analytics entities
 */
function getAnalyticsKeyPatterns(entityName: string): EntityDesign['keyPattern'] {
  const patterns: Record<string, EntityDesign['keyPattern']> = {
    Site: {
      pk: 'SITE#{id}',
      sk: 'SITE#{id}',
      gsi1pk: 'OWNER#{ownerId}',
      gsi1sk: 'SITE#{id}',
    },
    PageView: {
      pk: 'SITE#{siteId}',
      sk: 'PV#{timestamp}#{id}',
      gsi1pk: 'SITE#{siteId}#DATE#{date}',
      gsi1sk: 'PATH#{path}#{id}',
      gsi2pk: 'SITE#{siteId}#VISITOR#{visitorId}',
      gsi2sk: 'PV#{timestamp}',
    },
    Session: {
      pk: 'SITE#{siteId}',
      sk: 'SESSION#{id}',
      gsi1pk: 'SITE#{siteId}#SESSIONS#{date}',
      gsi1sk: 'SESSION#{id}',
    },
    CustomEvent: {
      pk: 'SITE#{siteId}',
      sk: 'EVENT#{timestamp}#{id}',
      gsi1pk: 'SITE#{siteId}#EVENTNAME#{name}',
      gsi1sk: 'EVENT#{timestamp}',
    },
    Goal: {
      pk: 'SITE#{siteId}',
      sk: 'GOAL#{id}',
    },
    Conversion: {
      pk: 'SITE#{siteId}',
      sk: 'CONVERSION#{timestamp}#{id}',
      gsi1pk: 'SITE#{siteId}#GOAL#{goalId}',
      gsi1sk: 'CONVERSION#{timestamp}',
    },
    AggregatedStats: {
      pk: 'SITE#{siteId}',
      sk: 'STATS#{period}#{periodStart}',
    },
    PageStats: {
      pk: 'SITE#{siteId}',
      sk: 'PAGESTATS#{period}#{periodStart}#{path}',
      gsi1pk: 'SITE#{siteId}#PAGESTATS#{period}#{periodStart}',
      gsi1sk: 'PV#{pageViews}#{path}',
    },
    ReferrerStats: {
      pk: 'SITE#{siteId}',
      sk: 'REFSTATS#{period}#{periodStart}#{source}',
    },
    GeoStats: {
      pk: 'SITE#{siteId}',
      sk: 'GEOSTATS#{period}#{periodStart}#{country}',
    },
    DeviceStats: {
      pk: 'SITE#{siteId}',
      sk: 'DEVICESTATS#{period}#{periodStart}#{dimension}#{value}',
    },
    CampaignStats: {
      pk: 'SITE#{siteId}',
      sk: 'CAMPSTATS#{period}#{periodStart}#{utmSource}',
    },
    EventStats: {
      pk: 'SITE#{siteId}',
      sk: 'EVENTSTATS#{period}#{periodStart}#{eventName}',
    },
    GoalStats: {
      pk: 'SITE#{siteId}',
      sk: 'GOALSTATS#{goalId}#{period}#{periodStart}',
    },
    RealtimeStats: {
      pk: 'SITE#{siteId}',
      sk: 'REALTIME#{minute}',
    },
  }

  return patterns[entityName] || { pk: `${entityName.toUpperCase()}#{id}`, sk: `${entityName.toUpperCase()}#{id}` }
}

/**
 * Generate access patterns for an entity
 */
function generateAccessPatterns(name: string, model: StacksModelDefinition): AccessPattern[] {
  const patterns: AccessPattern[] = []
  const keyPattern = getAnalyticsKeyPatterns(name)

  // Get by primary key
  patterns.push({
    name: `Get${name}ById`,
    description: `Get a single ${name} by its primary key`,
    operation: 'Get',
    index: 'main',
    keyCondition: `pk = ${keyPattern.pk} AND sk = ${keyPattern.sk}`,
    example: `Get ${name} where id = "abc123"`,
  })

  // Query by partition key (list all with same pk)
  patterns.push({
    name: `List${name}sByPartition`,
    description: `List all ${name}s for a partition`,
    operation: 'Query',
    index: 'main',
    keyCondition: `pk = ${keyPattern.pk}`,
    example: `List all ${name}s for site`,
  })

  // GSI1 patterns
  if (keyPattern.gsi1pk) {
    patterns.push({
      name: `Query${name}ByGSI1`,
      description: `Query ${name}s using GSI1`,
      operation: 'Query',
      index: 'GSI1',
      keyCondition: `gsi1pk = ${keyPattern.gsi1pk}`,
      example: `Query ${name}s via secondary index`,
    })
  }

  // GSI2 patterns
  if (keyPattern.gsi2pk) {
    patterns.push({
      name: `Query${name}ByGSI2`,
      description: `Query ${name}s using GSI2`,
      operation: 'Query',
      index: 'GSI2',
      keyCondition: `gsi2pk = ${keyPattern.gsi2pk}`,
      example: `Query ${name}s via tertiary index`,
    })
  }

  // Relationship-based patterns
  if (model.belongsTo) {
    for (const parent of model.belongsTo) {
      patterns.push({
        name: `Get${name}sFor${parent}`,
        description: `Get all ${name}s belonging to a ${parent}`,
        operation: 'Query',
        index: 'main',
        keyCondition: `pk = ${parent.toUpperCase()}#{${parent.toLowerCase()}Id}`,
        example: `Get all ${name}s for ${parent} with id "xyz"`,
      })
    }
  }

  return patterns
}

/**
 * Infer TypeScript type from attribute definition
 */
function inferType(attr: AttributeDefinition): string {
  if (attr.cast) {
    const castMap: Record<string, string> = {
      integer: 'number',
      float: 'number',
      number: 'number',
      string: 'string',
      boolean: 'boolean',
      array: 'array',
      json: 'object',
      datetime: 'Date',
      date: 'Date',
    }
    return castMap[attr.cast] || 'string'
  }

  if (attr.validation?.rule) {
    const rule = attr.validation.rule
    if (rule.includes('number') || rule.includes('integer'))
      return 'number'
    if (rule.includes('boolean'))
      return 'boolean'
    if (rule.includes('array'))
      return 'array'
    if (rule.includes('date'))
      return 'Date'
  }

  return 'string'
}

/**
 * Infer DynamoDB type from attribute definition
 */
function inferDynamoType(attr: AttributeDefinition): 'S' | 'N' | 'B' | 'BOOL' | 'L' | 'M' | 'SS' | 'NS' | 'BS' {
  const type = inferType(attr)

  const typeMap: Record<string, 'S' | 'N' | 'B' | 'BOOL' | 'L' | 'M'> = {
    string: 'S',
    number: 'N',
    boolean: 'BOOL',
    array: 'L',
    object: 'M',
    Date: 'S', // Store dates as ISO strings
  }

  return typeMap[type] || 'S'
}

// ============================================================================
// Documentation Generator
// ============================================================================

/**
 * Generate markdown documentation for analytics single-table design
 */
export function generateAnalyticsDesignDoc(): string {
  const design = generateAnalyticsSingleTableDesign()

  let doc = `# Analytics Single-Table Design

## Table Schema

**Table Name:** \`${design.tableName}\`

### Key Schema
- **Partition Key (pk):** String
- **Sort Key (sk):** String

### Global Secondary Indexes

| Index | Partition Key | Sort Key | Projection |
|-------|--------------|----------|------------|
`

  for (const gsi of design.globalSecondaryIndexes) {
    doc += `| ${gsi.indexName} | ${gsi.partitionKey.name} | ${gsi.sortKey.name} | ${gsi.projection} |\n`
  }

  doc += `\n## Entities\n\n`

  for (const entity of design.entities) {
    doc += `### ${entity.name}\n\n`
    doc += `**Key Pattern:**\n`
    doc += `- pk: \`${entity.keyPattern.pk}\`\n`
    doc += `- sk: \`${entity.keyPattern.sk}\`\n`
    if (entity.keyPattern.gsi1pk) {
      doc += `- gsi1pk: \`${entity.keyPattern.gsi1pk}\`\n`
      doc += `- gsi1sk: \`${entity.keyPattern.gsi1sk}\`\n`
    }
    if (entity.keyPattern.gsi2pk) {
      doc += `- gsi2pk: \`${entity.keyPattern.gsi2pk}\`\n`
      doc += `- gsi2sk: \`${entity.keyPattern.gsi2sk}\`\n`
    }
    doc += `\n`

    if (entity.attributes.length > 0) {
      doc += `**Attributes:**\n\n`
      doc += `| Name | Type | DynamoDB | Required |\n`
      doc += `|------|------|----------|----------|\n`
      for (const attr of entity.attributes) {
        doc += `| ${attr.name} | ${attr.type} | ${attr.dynamoType} | ${attr.required ? 'Yes' : 'No'} |\n`
      }
      doc += `\n`
    }

    if (entity.relationships.length > 0) {
      doc += `**Relationships:**\n`
      for (const rel of entity.relationships) {
        doc += `- ${rel.type}: ${rel.target}${rel.foreignKey ? ` (FK: ${rel.foreignKey})` : ''}\n`
      }
      doc += `\n`
    }
  }

  doc += `## Access Patterns\n\n`
  doc += `| Pattern | Operation | Index | Key Condition |\n`
  doc += `|---------|-----------|-------|---------------|\n`

  for (const pattern of design.accessPatterns) {
    doc += `| ${pattern.name} | ${pattern.operation} | ${pattern.index || 'main'} | \`${pattern.keyCondition}\` |\n`
  }

  return doc
}

/**
 * Generate access pattern matrix
 */
export function generateAccessPatternMatrix(): string {
  const design = generateAnalyticsSingleTableDesign()

  let matrix = `# Analytics Access Pattern Matrix

| Entity | Get By ID | List | GSI1 Query | GSI2 Query | Notes |
|--------|-----------|------|------------|------------|-------|
`

  for (const entity of design.entities) {
    const hasGsi1 = !!entity.keyPattern.gsi1pk
    const hasGsi2 = !!entity.keyPattern.gsi2pk

    matrix += `| ${entity.name} | ✅ | ✅ | ${hasGsi1 ? '✅' : '❌'} | ${hasGsi2 ? '✅' : '❌'} | `

    const notes: string[] = []
    if (entity.keyPattern.pk.includes('siteId')) {
      notes.push('Site-scoped')
    }
    if (entity.keyPattern.sk.includes('timestamp')) {
      notes.push('Time-ordered')
    }

    matrix += `${notes.join(', ')} |\n`
  }

  return matrix
}
