import type { Config, GSIDefinition } from '../types'
import type { ModelRegistry, ParsedAttribute, ParsedModel } from '../model-parser/types'
import { toEntityType } from '../model-parser/StacksModelParser'

// ============================================================================
// Sparse Index Types
// ============================================================================

/**
 * Sparse index usage information
 */
export interface SparseIndexUsage {
  /**
   * GSI name used for sparse index
   */
  gsiName: string
  /**
   * Model that uses this sparse index
   */
  modelName: string
  /**
   * Attribute used for sparse indexing
   */
  attribute: string
  /**
   * Type of sparse index usage
   */
  type: 'status_filter' | 'optional_attribute' | 'soft_delete' | 'ttl_expiry'
  /**
   * Description of the access pattern
   */
  description: string
  /**
   * Estimated cost savings explanation
   */
  costSavings: string
}

/**
 * Sparse index derivation result
 */
export interface SparseIndexDerivationResult {
  /**
   * GSI definitions for sparse indexes
   */
  gsiDefinitions: GSIDefinition[]
  /**
   * Sparse index usage information
   */
  sparseIndexUsages: SparseIndexUsage[]
  /**
   * Warnings
   */
  warnings: string[]
}

// ============================================================================
// Sparse Index Deriver Implementation
// ============================================================================

/**
 * Derive sparse GSI definitions from model attributes
 *
 * Sparse indexes are GSIs where only items with a specific attribute are indexed.
 * This is cost-effective for:
 * 1. Status-based queries (e.g., only "active" items)
 * 2. Optional attributes that need indexing
 * 3. Soft delete patterns (only non-deleted items)
 * 4. TTL-based expiry tracking
 */
export function deriveSparseIndexesFromModels(
  registry: ModelRegistry,
  config: Config,
  startingGSIIndex: number = 1,
): SparseIndexDerivationResult {
  const result: SparseIndexDerivationResult = {
    gsiDefinitions: [],
    sparseIndexUsages: [],
    warnings: [],
  }

  const delimiter = config.singleTableDesign.keyDelimiter
  let gsiIndex = startingGSIIndex

  for (const [, model] of registry.models) {
    // Find sparse index candidates
    const candidates = findSparseIndexCandidates(model, config)

    for (const candidate of candidates) {
      if (gsiIndex > config.singleTableDesign.gsiCount) {
        result.warnings.push(
          `Cannot create sparse index for ${model.name}.${candidate.attribute} - exceeded max GSI count`,
        )
        continue
      }

      const gsiName = `GSI${gsiIndex}`
      const pkAttr = getGSIAttributeName(gsiIndex, 'pk', config)
      const skAttr = getGSIAttributeName(gsiIndex, 'sk', config)

      result.gsiDefinitions.push({
        name: gsiName,
        partitionKey: pkAttr,
        sortKey: skAttr,
        projection: { type: 'ALL' },
      })

      result.sparseIndexUsages.push({
        gsiName,
        modelName: model.name,
        attribute: candidate.attribute,
        type: candidate.type,
        description: candidate.description,
        costSavings: candidate.costSavings,
      })

      gsiIndex++
    }
  }

  return result
}

/**
 * Sparse index candidate
 */
interface SparseIndexCandidate {
  attribute: string
  type: 'status_filter' | 'optional_attribute' | 'soft_delete' | 'ttl_expiry'
  description: string
  costSavings: string
}

/**
 * Find attributes that are good candidates for sparse indexes
 */
function findSparseIndexCandidates(model: ParsedModel, config: Config): SparseIndexCandidate[] {
  const candidates: SparseIndexCandidate[] = []

  // Soft delete sparse index
  if (model.hasSoftDeletes) {
    candidates.push({
      attribute: config.queryBuilder.softDeletes.attribute,
      type: 'soft_delete',
      description: `Query non-deleted ${model.name} items (items without deletedAt are indexed)`,
      costSavings: 'Only active items are indexed, reducing write costs and index size',
    })
  }

  // Status-based attributes
  const statusAttrs = model.attributes.filter(a =>
    a.name.toLowerCase().includes('status')
    || a.name.toLowerCase().includes('state')
    || a.name.toLowerCase() === 'active'
    || a.name.toLowerCase() === 'enabled'
    || a.name.toLowerCase() === 'published',
  )

  for (const attr of statusAttrs) {
    candidates.push({
      attribute: attr.name,
      type: 'status_filter',
      description: `Query ${model.name} items by ${attr.name} (only items with this attribute are indexed)`,
      costSavings: `Only items with ${attr.name} set are indexed, ideal for status-based filtering`,
    })
  }

  // Optional/nullable attributes that might need indexing
  const optionalIndexableAttrs = model.attributes.filter(a =>
    a.nullable
    && a.unique === false
    && !a.name.includes('Id')
    && model.original.indexes?.some(idx => idx.columns.includes(a.name)),
  )

  for (const attr of optionalIndexableAttrs) {
    candidates.push({
      attribute: attr.name,
      type: 'optional_attribute',
      description: `Query ${model.name} items by optional ${attr.name}`,
      costSavings: `Only items with ${attr.name} are indexed, saving storage for items without this attribute`,
    })
  }

  // TTL-based sparse index
  if (model.hasTtl) {
    candidates.push({
      attribute: config.ttl.attributeName,
      type: 'ttl_expiry',
      description: `Query ${model.name} items by expiry time`,
      costSavings: 'Only items with TTL set are indexed, useful for expiry notifications',
    })
  }

  // Limit to reasonable number
  return candidates.slice(0, 2)
}

/**
 * Get GSI attribute name based on index
 */
function getGSIAttributeName(index: number, type: 'pk' | 'sk', config: Config): string {
  const std = config.singleTableDesign

  switch (index) {
    case 1:
      return type === 'pk' ? std.gsi1pkName : std.gsi1skName
    case 2:
      return type === 'pk' ? std.gsi2pkName : std.gsi2skName
    case 3:
      return type === 'pk' ? std.gsi3pkName : std.gsi3skName
    case 4:
      return type === 'pk' ? std.gsi4pkName : std.gsi4skName
    case 5:
      return type === 'pk' ? std.gsi5pkName : std.gsi5skName
    default:
      return type === 'pk' ? `gsi${index}pk` : `gsi${index}sk`
  }
}

/**
 * Generate sparse index documentation
 */
export function generateSparseIndexDocumentation(result: SparseIndexDerivationResult): string {
  const lines: string[] = []

  lines.push('# Sparse Index Documentation')
  lines.push('')
  lines.push('## What are Sparse Indexes?')
  lines.push('')
  lines.push('Sparse indexes are GSIs that only index items containing a specific attribute.')
  lines.push('Items without the attribute are not included in the index, providing:')
  lines.push('')
  lines.push('- **Cost savings**: Fewer items indexed = lower storage costs')
  lines.push('- **Faster queries**: Smaller index = faster scans')
  lines.push('- **Efficient filtering**: Perfect for status-based queries')
  lines.push('')

  if (result.sparseIndexUsages.length > 0) {
    lines.push('## Derived Sparse Indexes')
    lines.push('')
    lines.push('| GSI | Model | Attribute | Type | Description |')
    lines.push('|-----|-------|-----------|------|-------------|')

    for (const usage of result.sparseIndexUsages) {
      lines.push(`| ${usage.gsiName} | ${usage.modelName} | ${usage.attribute} | ${usage.type} | ${usage.description} |`)
    }

    lines.push('')
    lines.push('## Cost Savings Details')
    lines.push('')

    for (const usage of result.sparseIndexUsages) {
      lines.push(`### ${usage.modelName}.${usage.attribute}`)
      lines.push('')
      lines.push(`- **GSI:** ${usage.gsiName}`)
      lines.push(`- **Type:** ${usage.type}`)
      lines.push(`- **Savings:** ${usage.costSavings}`)
      lines.push('')
    }
  }
  else {
    lines.push('## No Sparse Indexes Derived')
    lines.push('')
    lines.push('No attributes were identified as candidates for sparse indexing.')
    lines.push('Consider adding status fields or optional indexed attributes to benefit from sparse indexes.')
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`)
    }
  }

  return lines.join('\n')
}

/**
 * Check if a given attribute should use sparse indexing
 */
export function shouldUseSparseIndex(
  attr: ParsedAttribute,
  model: ParsedModel,
  config: Config,
): boolean {
  // Soft delete attribute
  if (attr.name === config.queryBuilder.softDeletes.attribute && model.hasSoftDeletes) {
    return true
  }

  // Status-like attributes
  if (
    attr.name.toLowerCase().includes('status')
    || attr.name.toLowerCase().includes('state')
    || attr.name.toLowerCase() === 'active'
    || attr.name.toLowerCase() === 'enabled'
  ) {
    return true
  }

  // Optional attributes marked for indexing
  if (attr.nullable && model.original.indexes?.some(idx => idx.columns.includes(attr.name))) {
    return true
  }

  return false
}
