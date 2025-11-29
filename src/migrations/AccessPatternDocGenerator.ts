// ============================================================================
// Access Pattern Documentation Generator
// ============================================================================

import type { ModelRegistry, ParsedModel, ParsedRelationship } from '../model-parser/types'
import type { Config } from '../types'
import type { AccessPatternSummary, GlobalSecondaryIndexInput, SchemaGenerationResult } from './AutoSchemaGenerator'
import { getConfig } from '../config'
import { getModelRegistry } from '../model-parser/StacksModelParser'
import {

  generateSchemaFromRegistry,

} from './AutoSchemaGenerator'

// ============================================================================
// Types
// ============================================================================

/**
 * Complete access pattern documentation
 */
export interface AccessPatternDocumentation {
  /**
   * Document title
   */
  title: string
  /**
   * Generated timestamp
   */
  generatedAt: string
  /**
   * Table information
   */
  table: TableInfo
  /**
   * Entity type documentation
   */
  entities: EntityDocumentation[]
  /**
   * Access patterns grouped by operation type
   */
  accessPatterns: AccessPatternGroup[]
  /**
   * Index documentation
   */
  indexes: IndexDocumentation[]
  /**
   * Example queries
   */
  examples: QueryExample[]
}

/**
 * Table information
 */
export interface TableInfo {
  name: string
  partitionKey: string
  sortKey: string
  billingMode: string
  gsiCount: number
  lsiCount: number
}

/**
 * Entity type documentation
 */
export interface EntityDocumentation {
  name: string
  entityType: string
  pkPattern: string
  skPattern: string
  attributes: AttributeDocumentation[]
  relationships: RelationshipDocumentation[]
  traits: string[]
}

/**
 * Attribute documentation
 */
export interface AttributeDocumentation {
  name: string
  type: string
  required: boolean
  indexed: boolean
  unique: boolean
  description?: string
}

/**
 * Relationship documentation
 */
export interface RelationshipDocumentation {
  name: string
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'
  relatedEntity: string
  foreignKey: string
  accessPattern: string
  indexUsed?: string
}

/**
 * Access pattern group
 */
export interface AccessPatternGroup {
  operation: 'GetItem' | 'Query' | 'Scan' | 'BatchGet'
  patterns: DetailedAccessPattern[]
}

/**
 * Detailed access pattern
 */
export interface DetailedAccessPattern {
  name: string
  description: string
  entityType: string
  operation: 'GetItem' | 'Query' | 'Scan' | 'BatchGet'
  index: string
  pkPattern: string
  skPattern?: string
  filterExpression?: string
  projectionExpression?: string
  estimatedCost: 'Low' | 'Medium' | 'High'
  bestPractices: string[]
  warnings?: string[]
}

/**
 * Index documentation
 */
export interface IndexDocumentation {
  name: string
  type: 'Primary' | 'GSI' | 'LSI'
  partitionKey: string
  sortKey?: string
  projection: string
  accessPatterns: string[]
  estimatedSize?: string
}

/**
 * Query example
 */
export interface QueryExample {
  title: string
  description: string
  entityType: string
  operation: string
  code: string
  notes?: string[]
}

// ============================================================================
// Documentation Generator Implementation
// ============================================================================

/**
 * Generate complete access pattern documentation
 */
export async function generateAccessPatternDoc(
  config?: Config,
): Promise<AccessPatternDocumentation> {
  const resolvedConfig = config ?? await getConfig()
  const registry = await getModelRegistry(resolvedConfig)
  const schema = generateSchemaFromRegistry(registry, resolvedConfig)

  return generateDocFromRegistry(registry, schema, resolvedConfig)
}

/**
 * Generate documentation from an existing registry and schema
 */
export function generateDocFromRegistry(
  registry: ModelRegistry,
  schema: SchemaGenerationResult,
  config: Config,
): AccessPatternDocumentation {
  const std = config.singleTableDesign
  const _delimiter = std.keyDelimiter

  // Build table info
  const table: TableInfo = {
    name: schema.summary.tableName,
    partitionKey: std.partitionKeyName,
    sortKey: std.sortKeyName,
    billingMode: schema.summary.billingMode,
    gsiCount: schema.summary.gsiCount,
    lsiCount: schema.summary.lsiCount,
  }

  // Build entity documentation
  const entities = buildEntityDocumentation(registry, config)

  // Build access patterns grouped by operation
  const accessPatterns = buildAccessPatternGroups(schema, registry, config)

  // Build index documentation
  const indexes = buildIndexDocumentation(schema, config)

  // Build examples
  const examples = buildQueryExamples(registry, config)

  return {
    title: `Access Pattern Documentation for ${table.name}`,
    generatedAt: new Date().toISOString(),
    table,
    entities,
    accessPatterns,
    indexes,
    examples,
  }
}

/**
 * Build entity documentation from registry
 */
function buildEntityDocumentation(
  registry: ModelRegistry,
  config: Config,
): EntityDocumentation[] {
  const docs: EntityDocumentation[] = []
  const delimiter = config.singleTableDesign.keyDelimiter

  for (const [_, model] of registry.models) {
    const attributes: AttributeDocumentation[] = Object.entries(model.attributes).map(
      ([name, attr]) => ({
        name,
        type: attr.dynamoDbType,
        required: attr.required,
        indexed: attr.unique ?? false, // Use unique as a proxy for indexed
        unique: attr.unique ?? false,
        description: undefined, // Could be added from model definition
      }),
    )

    const relationships: RelationshipDocumentation[] = model.relationships.map(rel => ({
      // Derive name from relationship type and related model
      name: deriveRelationshipName(rel),
      type: rel.type,
      relatedEntity: rel.relatedModel,
      foreignKey: rel.foreignKey,
      accessPattern: getRelationshipAccessPattern(rel, model, config),
      indexUsed: rel.gsiIndex ? `GSI${rel.gsiIndex}` : undefined,
    }))

    const traits: string[] = []
    if (model.hasTimestamps)
      traits.push('timestamps')
    if (model.hasSoftDeletes)
      traits.push('softDeletes')
    if (model.hasUuid)
      traits.push('uuid')
    if (model.hasTtl)
      traits.push('ttl')
    if (model.hasVersioning)
      traits.push('versioning')

    docs.push({
      name: model.name,
      entityType: model.entityType,
      pkPattern: `${model.entityType}${delimiter}{${model.primaryKey}}`,
      skPattern: `${model.entityType}${delimiter}{${model.primaryKey}}`,
      attributes,
      relationships,
      traits,
    })
  }

  return docs
}

/**
 * Derive a name for a relationship based on its type and related model
 */
function deriveRelationshipName(rel: ParsedRelationship): string {
  const relatedModelLower = rel.relatedModel.charAt(0).toLowerCase() + rel.relatedModel.slice(1)

  switch (rel.type) {
    case 'hasOne':
      return relatedModelLower
    case 'hasMany':
      return `${relatedModelLower}s` // Simple pluralization
    case 'belongsTo':
      return relatedModelLower
    case 'belongsToMany':
      return `${relatedModelLower}s`
    default:
      return relatedModelLower
  }
}

/**
 * Get access pattern description for a relationship
 */
function getRelationshipAccessPattern(
  rel: ParsedRelationship,
  model: ParsedModel,
  config: Config,
): string {
  const delimiter = config.singleTableDesign.keyDelimiter

  switch (rel.type) {
    case 'hasOne':
      return `Query: pk=${model.entityType}${delimiter}{id}, sk begins_with ${rel.relatedModel}${delimiter}`
    case 'hasMany':
      return `Query: pk=${model.entityType}${delimiter}{id}, sk begins_with ${rel.relatedModel}${delimiter}`
    case 'belongsTo':
      return `GetItem: pk=${rel.relatedModel}${delimiter}{${rel.foreignKey}}`
    case 'belongsToMany':
      return `Query GSI for adjacency list items`
    default:
      return 'Unknown pattern'
  }
}

/**
 * Build access pattern groups from schema
 */
function buildAccessPatternGroups(
  schema: SchemaGenerationResult,
  registry: ModelRegistry,
  config: Config,
): AccessPatternGroup[] {
  const delimiter = config.singleTableDesign.keyDelimiter
  const groups: Map<string, DetailedAccessPattern[]> = new Map([
    ['GetItem', []],
    ['Query', []],
    ['Scan', []],
    ['BatchGet', []],
  ])

  // Add patterns from schema
  for (const pattern of schema.supportedAccessPatterns) {
    const detailed = enrichAccessPattern(pattern, registry, config)
    const existing = groups.get(pattern.operation) ?? []
    existing.push(detailed)
    groups.set(pattern.operation, existing)
  }

  // Add common patterns for each entity
  for (const [_, model] of registry.models) {
    // Get by ID
    groups.get('GetItem')!.push({
      name: `Get ${model.name} by ID`,
      description: `Retrieve a single ${model.name} record by its unique identifier`,
      entityType: model.entityType,
      operation: 'GetItem',
      index: 'Main Table',
      pkPattern: `${model.entityType}${delimiter}{id}`,
      skPattern: `${model.entityType}${delimiter}{id}`,
      estimatedCost: 'Low',
      bestPractices: [
        'Use consistent reads only when necessary',
        'Consider eventual consistency for read-heavy workloads',
      ],
    })

    // List all of entity type
    groups.get('Query')!.push({
      name: `List all ${model.name}s`,
      description: `Query all ${model.name} entities using GSI`,
      entityType: model.entityType,
      operation: 'Query',
      index: 'GSI1 (Entity Type Index)',
      pkPattern: model.entityType,
      estimatedCost: 'Medium',
      bestPractices: [
        'Use pagination for large result sets',
        'Consider projection expressions to reduce data transfer',
        'Use ScanIndexForward for ordering',
      ],
    })

    // Batch get
    groups.get('BatchGet')!.push({
      name: `Batch Get ${model.name}s`,
      description: `Retrieve multiple ${model.name} records in a single operation`,
      entityType: model.entityType,
      operation: 'BatchGet',
      index: 'Main Table',
      pkPattern: `${model.entityType}${delimiter}{id}`,
      skPattern: `${model.entityType}${delimiter}{id}`,
      estimatedCost: 'Low',
      bestPractices: [
        'Batch size limit is 100 items',
        'Handle UnprocessedKeys for retries',
        'Group items by partition key when possible',
      ],
    })
  }

  // Convert to array
  return Array.from(groups.entries())
    .filter(([_, patterns]) => patterns.length > 0)
    .map(([operation, patterns]) => ({
      operation: operation as 'GetItem' | 'Query' | 'Scan' | 'BatchGet',
      patterns,
    }))
}

/**
 * Enrich an access pattern with additional details
 */
function enrichAccessPattern(
  pattern: AccessPatternSummary,
  _registry: ModelRegistry,
  _config: Config,
): DetailedAccessPattern {
  const bestPractices: string[] = []
  const warnings: string[] = []

  switch (pattern.operation) {
    case 'GetItem':
      bestPractices.push('Most efficient operation - O(1) lookup')
      bestPractices.push('Consider caching frequently accessed items')
      break
    case 'Query':
      bestPractices.push('Use key conditions to narrow results')
      bestPractices.push('Use filter expressions sparingly - they don\'t reduce RCU consumption')
      break
    case 'Scan':
      warnings.push('Scan operations read every item in the table')
      warnings.push('Consider using Query with GSI instead')
      bestPractices.push('Use parallel scans for large datasets')
      break
  }

  return {
    name: pattern.name,
    description: pattern.description,
    entityType: pattern.entityType,
    operation: pattern.operation,
    index: pattern.index,
    pkPattern: pattern.keyPattern.split(',')[0] ?? pattern.keyPattern,
    skPattern: pattern.keyPattern.split(',')[1],
    estimatedCost: pattern.operation === 'Scan' ? 'High' : pattern.operation === 'Query' ? 'Medium' : 'Low',
    bestPractices,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Build index documentation
 */
function buildIndexDocumentation(
  schema: SchemaGenerationResult,
  config: Config,
): IndexDocumentation[] {
  const docs: IndexDocumentation[] = []
  const std = config.singleTableDesign

  // Primary key
  docs.push({
    name: 'Primary Key',
    type: 'Primary',
    partitionKey: std.partitionKeyName,
    sortKey: std.sortKeyName,
    projection: 'ALL (All attributes)',
    accessPatterns: [
      'GetItem by pk + sk',
      'Query items with same pk',
      'Query with sk begins_with',
    ],
  })

  // GSIs
  for (const gsi of schema.createTableInput.globalSecondaryIndexes ?? []) {
    const pk = gsi.keySchema.find(k => k.keyType === 'HASH')!
    const sk = gsi.keySchema.find(k => k.keyType === 'RANGE')

    docs.push({
      name: gsi.indexName,
      type: 'GSI',
      partitionKey: pk.attributeName,
      sortKey: sk?.attributeName,
      projection: gsi.projection.projectionType,
      accessPatterns: findGSIAccessPatterns(gsi, schema.supportedAccessPatterns),
    })
  }

  // LSIs
  for (const lsi of schema.createTableInput.localSecondaryIndexes ?? []) {
    const sk = lsi.keySchema.find(k => k.keyType === 'RANGE')!

    docs.push({
      name: lsi.indexName,
      type: 'LSI',
      partitionKey: std.partitionKeyName,
      sortKey: sk.attributeName,
      projection: lsi.projection.projectionType,
      accessPatterns: [
        `Query with alternative sort order by ${sk.attributeName}`,
      ],
    })
  }

  return docs
}

/**
 * Find access patterns that use a specific GSI
 */
function findGSIAccessPatterns(
  gsi: GlobalSecondaryIndexInput,
  patterns: AccessPatternSummary[],
): string[] {
  return patterns
    .filter(p => p.index.includes(gsi.indexName) || p.index === gsi.indexName)
    .map(p => p.name)
}

/**
 * Build query examples
 */
function buildQueryExamples(
  registry: ModelRegistry,
  config: Config,
): QueryExample[] {
  const examples: QueryExample[] = []
  const delimiter = config.singleTableDesign.keyDelimiter

  // Get first model for examples
  const firstModel = Array.from(registry.models.values())[0]
  if (!firstModel)
    return examples

  // GetItem example
  examples.push({
    title: `Get ${firstModel.name} by ID`,
    description: `Retrieve a single ${firstModel.name} using GetItem`,
    entityType: firstModel.entityType,
    operation: 'GetItem',
    code: `const ${firstModel.name.toLowerCase()} = await ${firstModel.name}.find('123')

// Or using the query builder:
const ${firstModel.name.toLowerCase()} = await db
  .from('${firstModel.entityType}')
  .where('pk', '${firstModel.entityType}${delimiter}123')
  .where('sk', '${firstModel.entityType}${delimiter}123')
  .first()`,
    notes: [
      'Returns null if item not found',
      'Use findOrFail() to throw an exception if not found',
    ],
  })

  // Query example
  examples.push({
    title: `List ${firstModel.name}s`,
    description: `Query multiple ${firstModel.name}s with filtering`,
    entityType: firstModel.entityType,
    operation: 'Query',
    code: `// Using the model
const ${firstModel.name.toLowerCase()}s = await ${firstModel.name}.all()

// With conditions
const active${firstModel.name}s = await ${firstModel.name}
  .query()
  .where('status', 'active')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get()`,
    notes: [
      'Queries are paginated automatically',
      'Use .paginate() for explicit pagination control',
    ],
  })

  // Relationship example
  const firstRelationship = firstModel.relationships[0]
  if (firstRelationship) {
    const relName = deriveRelationshipName(firstRelationship)
    examples.push({
      title: `Get ${firstRelationship.relatedModel}s for ${firstModel.name}`,
      description: `Load related ${firstRelationship.relatedModel}s using the relationship`,
      entityType: firstModel.entityType,
      operation: 'Query',
      code: `// Eager load with the model
const ${firstModel.name.toLowerCase()} = await ${firstModel.name}
  .with('${relName}')
  .find('123')

// Access the relationship
const ${relName} = ${firstModel.name.toLowerCase()}.${relName}

// Or load separately
const ${firstModel.name.toLowerCase()} = await ${firstModel.name}.find('123')
const ${relName} = await ${firstModel.name.toLowerCase()}.${relName}().get()`,
    })
  }

  // Batch example
  examples.push({
    title: `Batch Get ${firstModel.name}s`,
    description: `Retrieve multiple ${firstModel.name}s in a single operation`,
    entityType: firstModel.entityType,
    operation: 'BatchGet',
    code: `const ${firstModel.name.toLowerCase()}s = await ${firstModel.name}.findMany([
  '123',
  '456',
  '789',
])`,
    notes: [
      'Maximum 100 items per batch',
      'More efficient than individual GetItem calls',
    ],
  })

  return examples
}

// ============================================================================
// Output Formatters
// ============================================================================

/**
 * Format documentation as Markdown
 */
export function formatAsMarkdown(doc: AccessPatternDocumentation): string {
  const lines: string[] = []

  // Header
  lines.push(`# ${doc.title}`)
  lines.push('')
  lines.push(`> Generated: ${doc.generatedAt}`)
  lines.push('')

  // Table of Contents
  lines.push('## Table of Contents')
  lines.push('')
  lines.push('1. [Table Overview](#table-overview)')
  lines.push('2. [Entity Types](#entity-types)')
  lines.push('3. [Access Patterns](#access-patterns)')
  lines.push('4. [Indexes](#indexes)')
  lines.push('5. [Query Examples](#query-examples)')
  lines.push('')

  // Table Overview
  lines.push('## Table Overview')
  lines.push('')
  lines.push('| Property | Value |')
  lines.push('|----------|-------|')
  lines.push(`| Table Name | \`${doc.table.name}\` |`)
  lines.push(`| Partition Key | \`${doc.table.partitionKey}\` (String) |`)
  lines.push(`| Sort Key | \`${doc.table.sortKey}\` (String) |`)
  lines.push(`| Billing Mode | ${doc.table.billingMode} |`)
  lines.push(`| GSI Count | ${doc.table.gsiCount} |`)
  lines.push(`| LSI Count | ${doc.table.lsiCount} |`)
  lines.push('')

  // Entity Types
  lines.push('## Entity Types')
  lines.push('')

  for (const entity of doc.entities) {
    lines.push(`### ${entity.name}`)
    lines.push('')
    lines.push(`- **Entity Type**: \`${entity.entityType}\``)
    lines.push(`- **PK Pattern**: \`${entity.pkPattern}\``)
    lines.push(`- **SK Pattern**: \`${entity.skPattern}\``)

    if (entity.traits.length > 0) {
      lines.push(`- **Traits**: ${entity.traits.join(', ')}`)
    }
    lines.push('')

    // Attributes
    if (entity.attributes.length > 0) {
      lines.push('#### Attributes')
      lines.push('')
      lines.push('| Name | Type | Required | Indexed | Unique |')
      lines.push('|------|------|----------|---------|--------|')
      for (const attr of entity.attributes) {
        lines.push(`| ${attr.name} | ${attr.type} | ${attr.required ? 'Yes' : 'No'} | ${attr.indexed ? 'Yes' : 'No'} | ${attr.unique ? 'Yes' : 'No'} |`)
      }
      lines.push('')
    }

    // Relationships
    if (entity.relationships.length > 0) {
      lines.push('#### Relationships')
      lines.push('')
      for (const rel of entity.relationships) {
        lines.push(`- **${rel.name}** (${rel.type})`)
        lines.push(`  - Related Entity: ${rel.relatedEntity}`)
        lines.push(`  - Foreign Key: ${rel.foreignKey}`)
        lines.push(`  - Access Pattern: \`${rel.accessPattern}\``)
        if (rel.indexUsed) {
          lines.push(`  - Index Used: ${rel.indexUsed}`)
        }
      }
      lines.push('')
    }
  }

  // Access Patterns
  lines.push('## Access Patterns')
  lines.push('')

  for (const group of doc.accessPatterns) {
    lines.push(`### ${group.operation} Operations`)
    lines.push('')

    for (const pattern of group.patterns) {
      lines.push(`#### ${pattern.name}`)
      lines.push('')
      lines.push(`${pattern.description}`)
      lines.push('')
      lines.push('| Property | Value |')
      lines.push('|----------|-------|')
      lines.push(`| Entity | ${pattern.entityType} |`)
      lines.push(`| Index | ${pattern.index} |`)
      lines.push(`| PK Pattern | \`${pattern.pkPattern}\` |`)
      if (pattern.skPattern) {
        lines.push(`| SK Pattern | \`${pattern.skPattern}\` |`)
      }
      lines.push(`| Estimated Cost | ${pattern.estimatedCost} |`)
      lines.push('')

      if (pattern.bestPractices.length > 0) {
        lines.push('**Best Practices:**')
        for (const practice of pattern.bestPractices) {
          lines.push(`- ${practice}`)
        }
        lines.push('')
      }

      if (pattern.warnings && pattern.warnings.length > 0) {
        lines.push('**Warnings:**')
        for (const warning of pattern.warnings) {
          lines.push(`- ⚠️ ${warning}`)
        }
        lines.push('')
      }
    }
  }

  // Indexes
  lines.push('## Indexes')
  lines.push('')

  for (const index of doc.indexes) {
    lines.push(`### ${index.name}`)
    lines.push('')
    lines.push(`- **Type**: ${index.type}`)
    lines.push(`- **Partition Key**: \`${index.partitionKey}\``)
    if (index.sortKey) {
      lines.push(`- **Sort Key**: \`${index.sortKey}\``)
    }
    lines.push(`- **Projection**: ${index.projection}`)
    lines.push('')

    if (index.accessPatterns.length > 0) {
      lines.push('**Supported Access Patterns:**')
      for (const pattern of index.accessPatterns) {
        lines.push(`- ${pattern}`)
      }
      lines.push('')
    }
  }

  // Query Examples
  lines.push('## Query Examples')
  lines.push('')

  for (const example of doc.examples) {
    lines.push(`### ${example.title}`)
    lines.push('')
    lines.push(example.description)
    lines.push('')
    lines.push('```typescript')
    lines.push(example.code)
    lines.push('```')
    lines.push('')

    if (example.notes && example.notes.length > 0) {
      lines.push('**Notes:**')
      for (const note of example.notes) {
        lines.push(`- ${note}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Format documentation as JSON
 */
export function formatAsJSON(doc: AccessPatternDocumentation): string {
  return JSON.stringify(doc, null, 2)
}

/**
 * Format documentation as a simple text summary
 */
export function formatAsSummary(doc: AccessPatternDocumentation): string {
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push(doc.title)
  lines.push('='.repeat(60))
  lines.push('')

  lines.push(`Table: ${doc.table.name}`)
  lines.push(`Keys: ${doc.table.partitionKey} (PK), ${doc.table.sortKey} (SK)`)
  lines.push(`Indexes: ${doc.table.gsiCount} GSIs, ${doc.table.lsiCount} LSIs`)
  lines.push('')

  lines.push(`Entity Types (${doc.entities.length}):`)
  for (const entity of doc.entities) {
    lines.push(`  - ${entity.name} (${entity.entityType})`)
  }
  lines.push('')

  const totalPatterns = doc.accessPatterns.reduce((sum, g) => sum + g.patterns.length, 0)
  lines.push(`Access Patterns (${totalPatterns}):`)
  for (const group of doc.accessPatterns) {
    lines.push(`  ${group.operation}: ${group.patterns.length} patterns`)
  }
  lines.push('')

  lines.push('='.repeat(60))

  return lines.join('\n')
}
