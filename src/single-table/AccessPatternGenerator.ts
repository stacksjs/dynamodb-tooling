import type { AccessPattern, ModelRegistry } from '../model-parser/types'
import type { Config } from '../types'

// ============================================================================
// Access Pattern Types
// ============================================================================

/**
 * Access pattern category
 */
export type AccessPatternCategory =
  | 'entity_by_id'
  | 'entity_list'
  | 'relationship_parent_to_child'
  | 'relationship_child_to_parent'
  | 'unique_lookup'
  | 'status_filter'
  | 'time_range'
  | 'collection'

/**
 * Extended access pattern with additional metadata
 */
export interface ExtendedAccessPattern extends AccessPattern {
  /**
   * Pattern category
   */
  category: AccessPatternCategory
  /**
   * Required input parameters
   */
  requiredParams: string[]
  /**
   * Optional input parameters
   */
  optionalParams: string[]
  /**
   * Example query code
   */
  exampleCode: string
  /**
   * Performance notes
   */
  performanceNotes: string[]
}

/**
 * Access pattern matrix (entity x operation)
 */
export interface AccessPatternMatrix {
  /**
   * Entity name
   */
  entity: string
  /**
   * Pattern availability by operation
   */
  operations: {
    getById: boolean
    listAll: boolean
    queryByParent: string[]
    queryChildren: string[]
    uniqueLookups: string[]
  }
  /**
   * Efficient patterns count
   */
  efficientPatterns: number
  /**
   * Inefficient patterns count (scans)
   */
  inefficientPatterns: number
}

/**
 * Complete access pattern report
 */
export interface AccessPatternReport {
  /**
   * All access patterns
   */
  patterns: ExtendedAccessPattern[]
  /**
   * Access pattern matrix
   */
  matrix: AccessPatternMatrix[]
  /**
   * Missing patterns (common patterns that couldn't be derived)
   */
  missingPatterns: string[]
  /**
   * Optimization suggestions
   */
  suggestions: string[]
}

// ============================================================================
// Access Pattern Generator Implementation
// ============================================================================

/**
 * Generate comprehensive access patterns from model registry
 */
export function generateAccessPatterns(
  registry: ModelRegistry,
  config: Config,
): AccessPatternReport {
  const patterns: ExtendedAccessPattern[] = []
  const matrix: AccessPatternMatrix[] = []
  const missingPatterns: string[] = []
  const suggestions: string[] = []

  const delimiter = config.singleTableDesign.keyDelimiter

  for (const [, model] of registry.models) {
    const modelPatterns: ExtendedAccessPattern[] = []
    const matrixEntry: AccessPatternMatrix = {
      entity: model.name,
      operations: {
        getById: true,
        listAll: true,
        queryByParent: [],
        queryChildren: [],
        uniqueLookups: [],
      },
      efficientPatterns: 0,
      inefficientPatterns: 0,
    }

    // Pattern 1: Get entity by ID (always efficient)
    modelPatterns.push({
      name: `Get ${model.name} by ID`,
      description: `Retrieve a single ${model.name} by its primary key`,
      entityType: model.entityType,
      operation: 'get',
      index: 'main',
      keyCondition: `pk = ${model.entityType}${delimiter}{id} AND sk = ${model.entityType}${delimiter}{id}`,
      examplePk: `${model.entityType}${delimiter}123`,
      exampleSk: `${model.entityType}${delimiter}123`,
      efficient: true,
      category: 'entity_by_id',
      requiredParams: [model.primaryKey],
      optionalParams: [],
      exampleCode: `await ${model.name}.find('123')`,
      performanceNotes: ['Single item read - very efficient', 'Consumes 0.5 RCU for items up to 4KB'],
    })
    matrixEntry.efficientPatterns++

    // Pattern 2: List all entities (scan - inefficient)
    modelPatterns.push({
      name: `List all ${model.name}s`,
      description: `Retrieve all ${model.name} entities (requires scan with filter)`,
      entityType: model.entityType,
      operation: 'scan',
      index: 'scan',
      keyCondition: `Scan with filter: ${config.singleTableDesign.entityTypeAttribute} = '${model.name}'`,
      examplePk: 'N/A (full table scan)',
      efficient: false,
      category: 'entity_list',
      requiredParams: [],
      optionalParams: ['limit', 'cursor'],
      exampleCode: `await ${model.name}.all()`,
      performanceNotes: [
        'WARNING: Full table scan required',
        'Consider using a GSI with entity type as partition key for large datasets',
        'Use pagination to limit memory usage',
      ],
    })
    matrixEntry.inefficientPatterns++

    // Generate relationship patterns
    for (const rel of model.relationships) {
      const relatedModel = registry.models.get(rel.relatedModel)
      if (!relatedModel)
        continue

      switch (rel.type) {
        case 'hasMany':
          // Get children of a parent
          modelPatterns.push({
            name: `Get ${rel.relatedModel}s for ${model.name}`,
            description: `Query all ${rel.relatedModel} items belonging to a ${model.name}`,
            entityType: relatedModel.entityType,
            operation: 'query',
            index: 'main',
            keyCondition: `pk = ${model.entityType}${delimiter}{${model.primaryKey}} AND sk begins_with ${relatedModel.entityType}${delimiter}`,
            examplePk: `${model.entityType}${delimiter}123`,
            exampleSk: `${relatedModel.entityType}${delimiter}`,
            efficient: true,
            category: 'relationship_parent_to_child',
            requiredParams: [model.primaryKey],
            optionalParams: ['limit', 'sortDirection'],
            exampleCode: `await user.posts() // or User.find('123').with('posts')`,
            performanceNotes: [
              'Efficient query using pk/sk pattern',
              'Results are sorted by sort key',
            ],
          })
          matrixEntry.operations.queryChildren.push(rel.relatedModel)
          matrixEntry.efficientPatterns++
          break

        case 'belongsTo':
          // Get items by parent
          if (rel.gsiIndex) {
            modelPatterns.push({
              name: `Get ${model.name}s by ${rel.relatedModel}`,
              description: `Query all ${model.name} items belonging to a ${rel.relatedModel}`,
              entityType: model.entityType,
              operation: 'query',
              index: `GSI${rel.gsiIndex}` as 'GSI1' | 'GSI2' | 'GSI3' | 'GSI4' | 'GSI5',
              keyCondition: `gsi${rel.gsiIndex}pk = ${relatedModel.entityType}${delimiter}{${rel.foreignKey}}`,
              examplePk: `${relatedModel.entityType}${delimiter}456`,
              efficient: true,
              category: 'relationship_child_to_parent',
              requiredParams: [rel.foreignKey],
              optionalParams: ['limit', 'sortDirection'],
              exampleCode: `await ${model.name}.where('${rel.foreignKey}', '456').get()`,
              performanceNotes: [
                `Uses GSI${rel.gsiIndex} for efficient query`,
                'Returns all children for the given parent',
              ],
            })
            matrixEntry.operations.queryByParent.push(rel.relatedModel)
            matrixEntry.efficientPatterns++
          }
          else {
            missingPatterns.push(
              `${model.name}.belongsTo(${rel.relatedModel}) - No GSI assigned for reverse lookup`,
            )
          }
          break

        case 'belongsToMany':
          // Get related items through pivot
          if (rel.gsiIndex) {
            modelPatterns.push({
              name: `Get ${rel.relatedModel}s for ${model.name} (many-to-many)`,
              description: `Query all ${rel.relatedModel} items associated with a ${model.name}`,
              entityType: relatedModel.entityType,
              operation: 'query',
              index: `GSI${rel.gsiIndex}` as 'GSI1' | 'GSI2' | 'GSI3' | 'GSI4' | 'GSI5',
              keyCondition: `gsi${rel.gsiIndex}pk = ${model.entityType}${delimiter}{${model.primaryKey}}`,
              examplePk: `${model.entityType}${delimiter}123`,
              efficient: true,
              category: 'collection',
              requiredParams: [model.primaryKey],
              optionalParams: ['limit'],
              exampleCode: `await user.roles() // many-to-many through pivot`,
              performanceNotes: [
                'Uses adjacency list pattern',
                'May require BatchGet for full related items',
              ],
            })
            matrixEntry.efficientPatterns++
          }
          break
      }
    }

    // Generate unique attribute lookup patterns
    for (const attr of model.attributes) {
      if (attr.unique) {
        const gsiIndex = registry.gsiAssignments.get(`${model.name}:unique:${attr.name}`)
        if (gsiIndex) {
          modelPatterns.push({
            name: `Get ${model.name} by ${attr.name}`,
            description: `Retrieve a ${model.name} by unique ${attr.name}`,
            entityType: model.entityType,
            operation: 'query',
            index: `GSI${gsiIndex}` as 'GSI1' | 'GSI2' | 'GSI3' | 'GSI4' | 'GSI5',
            keyCondition: `gsi${gsiIndex}pk = ${attr.name.toUpperCase()}${delimiter}{${attr.name}}`,
            examplePk: `${attr.name.toUpperCase()}${delimiter}example@email.com`,
            efficient: true,
            category: 'unique_lookup',
            requiredParams: [attr.name],
            optionalParams: [],
            exampleCode: `await ${model.name}.findBy('${attr.name}', 'value')`,
            performanceNotes: [
              'Efficient unique lookup using GSI',
              'Returns at most one item',
            ],
          })
          matrixEntry.operations.uniqueLookups.push(attr.name)
          matrixEntry.efficientPatterns++
        }
        else {
          missingPatterns.push(
            `${model.name}.${attr.name} (unique) - No GSI assigned for unique lookup`,
          )
        }
      }
    }

    // Add soft delete pattern if applicable
    if (model.hasSoftDeletes) {
      modelPatterns.push({
        name: `Get active ${model.name}s`,
        description: `Query all non-deleted ${model.name} entities`,
        entityType: model.entityType,
        operation: 'scan',
        index: 'scan',
        keyCondition: `Scan with filter: ${config.singleTableDesign.entityTypeAttribute} = '${model.name}' AND attribute_not_exists(${config.queryBuilder.softDeletes.attribute})`,
        examplePk: 'N/A (filtered scan)',
        efficient: false,
        category: 'status_filter',
        requiredParams: [],
        optionalParams: ['limit', 'cursor'],
        exampleCode: `await ${model.name}.whereNull('deletedAt').get()`,
        performanceNotes: [
          'Consider using a sparse GSI for better performance',
          'Filter expression applied after scan',
        ],
      })
      matrixEntry.inefficientPatterns++

      suggestions.push(
        `Consider adding a sparse GSI for ${model.name} soft delete filtering to improve query performance`,
      )
    }

    // Store patterns
    patterns.push(...modelPatterns)
    matrix.push(matrixEntry)
  }

  // Generate overall suggestions
  if (missingPatterns.length > 0) {
    suggestions.push(
      `${missingPatterns.length} access patterns lack efficient index support. Consider increasing gsiCount in config.`,
    )
  }

  const totalInefficient = matrix.reduce((sum, m) => sum + m.inefficientPatterns, 0)
  if (totalInefficient > 0) {
    suggestions.push(
      `${totalInefficient} patterns require table scans. Review access patterns and consider adding GSIs.`,
    )
  }

  return {
    patterns,
    matrix,
    missingPatterns,
    suggestions,
  }
}

/**
 * Generate markdown documentation for access patterns
 */
export function generateAccessPatternDocumentation(report: AccessPatternReport): string {
  const lines: string[] = []

  lines.push('# Access Pattern Documentation')
  lines.push('')
  lines.push('## Overview')
  lines.push('')

  const totalPatterns = report.patterns.length
  const efficientPatterns = report.patterns.filter(p => p.efficient).length
  const inefficientPatterns = totalPatterns - efficientPatterns

  lines.push(`- **Total Access Patterns:** ${totalPatterns}`)
  lines.push(`- **Efficient Patterns:** ${efficientPatterns} (${Math.round(efficientPatterns / totalPatterns * 100)}%)`)
  lines.push(`- **Inefficient Patterns:** ${inefficientPatterns} (require scan)`)
  lines.push('')

  // Access Pattern Matrix
  lines.push('## Access Pattern Matrix')
  lines.push('')
  lines.push('| Entity | Get by ID | List All | Query by Parent | Query Children | Unique Lookups |')
  lines.push('|--------|-----------|----------|-----------------|----------------|----------------|')

  for (const m of report.matrix) {
    lines.push(`| ${m.entity} | ${m.operations.getById ? 'Yes' : 'No'} | ${m.operations.listAll ? 'Yes (scan)' : 'No'} | ${m.operations.queryByParent.join(', ') || '-'} | ${m.operations.queryChildren.join(', ') || '-'} | ${m.operations.uniqueLookups.join(', ') || '-'} |`)
  }

  lines.push('')

  // Detailed patterns by category
  lines.push('## Patterns by Category')
  lines.push('')

  const categories = new Map<AccessPatternCategory, ExtendedAccessPattern[]>()
  for (const pattern of report.patterns) {
    const existing = categories.get(pattern.category) ?? []
    existing.push(pattern)
    categories.set(pattern.category, existing)
  }

  for (const [category, categoryPatterns] of categories) {
    lines.push(`### ${formatCategoryName(category)}`)
    lines.push('')

    for (const pattern of categoryPatterns) {
      lines.push(`#### ${pattern.name}`)
      lines.push('')
      lines.push(`- **Operation:** ${pattern.operation}`)
      lines.push(`- **Index:** ${pattern.index}`)
      lines.push(`- **Efficient:** ${pattern.efficient ? 'Yes' : 'No'}`)
      lines.push(`- **Key Condition:** \`${pattern.keyCondition}\``)
      lines.push(`- **Example PK:** \`${pattern.examplePk}\``)
      if (pattern.exampleSk) {
        lines.push(`- **Example SK:** \`${pattern.exampleSk}\``)
      }
      lines.push('')
      lines.push('**Example Code:**')
      lines.push('```typescript')
      lines.push(pattern.exampleCode)
      lines.push('```')
      lines.push('')
      if (pattern.performanceNotes.length > 0) {
        lines.push('**Performance Notes:**')
        for (const note of pattern.performanceNotes) {
          lines.push(`- ${note}`)
        }
        lines.push('')
      }
    }
  }

  // Missing patterns
  if (report.missingPatterns.length > 0) {
    lines.push('## Missing Patterns')
    lines.push('')
    lines.push('The following access patterns could not be efficiently supported:')
    lines.push('')
    for (const missing of report.missingPatterns) {
      lines.push(`- ${missing}`)
    }
    lines.push('')
  }

  // Suggestions
  if (report.suggestions.length > 0) {
    lines.push('## Optimization Suggestions')
    lines.push('')
    for (const suggestion of report.suggestions) {
      lines.push(`- ${suggestion}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format category name for display
 */
function formatCategoryName(category: AccessPatternCategory): string {
  const names: Record<AccessPatternCategory, string> = {
    entity_by_id: 'Entity by ID',
    entity_list: 'Entity Listing',
    relationship_parent_to_child: 'Parent to Child Queries',
    relationship_child_to_parent: 'Child to Parent Queries',
    unique_lookup: 'Unique Attribute Lookups',
    status_filter: 'Status Filtering',
    time_range: 'Time Range Queries',
    collection: 'Collection Queries',
  }
  return names[category] ?? category
}
