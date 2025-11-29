import type { Config, LSIDefinition } from '../types'
import type { ModelRegistry, ParsedAttribute, ParsedModel } from '../model-parser/types'

// ============================================================================
// LSI Derivation Types
// ============================================================================

/**
 * LSI usage information
 */
export interface LSIUsage {
  /**
   * LSI name
   */
  name: string
  /**
   * Model that uses this LSI
   */
  modelName: string
  /**
   * Sort key attribute
   */
  sortKey: string
  /**
   * Description of the access pattern
   */
  description: string
  /**
   * Attributes commonly queried with this LSI
   */
  projectedAttributes: string[]
}

/**
 * LSI derivation result
 */
export interface LSIDerivationResult {
  /**
   * Derived LSI definitions
   */
  lsiDefinitions: LSIDefinition[]
  /**
   * LSI usage information
   */
  lsiUsages: LSIUsage[]
  /**
   * Warnings about LSI design
   */
  warnings: string[]
}

// ============================================================================
// LSI Deriver Implementation
// ============================================================================

/**
 * Derive LSI definitions from model attributes
 *
 * LSIs are useful when you need to:
 * 1. Query items with the same partition key but different sort order
 * 2. Support alternative sort keys within the same partition
 *
 * Note: LSIs must be defined at table creation time and cannot be added later
 */
export function deriveLSIsFromModels(
  registry: ModelRegistry,
  config: Config,
): LSIDerivationResult {
  const result: LSIDerivationResult = {
    lsiDefinitions: [],
    lsiUsages: [],
    warnings: [],
  }

  const MAX_LSIs = 5 // DynamoDB limit
  let lsiCount = 0

  for (const [, model] of registry.models) {
    // Find attributes that could benefit from LSI
    const lsiCandidates = findLSICandidates(model)

    for (const candidate of lsiCandidates) {
      if (lsiCount >= MAX_LSIs) {
        result.warnings.push(
          `Cannot create LSI for ${model.name}.${candidate.name} - exceeded max LSI count of ${MAX_LSIs}`,
        )
        continue
      }

      const lsiName = `${model.name}By${capitalize(candidate.name)}LSI`

      result.lsiDefinitions.push({
        name: lsiName,
        sortKey: candidate.name,
        projection: {
          type: candidate.projectionType ?? 'ALL',
          attributes: candidate.projectedAttributes,
        },
      })

      result.lsiUsages.push({
        name: lsiName,
        modelName: model.name,
        sortKey: candidate.name,
        description: `Query ${model.name} items sorted by ${candidate.name}`,
        projectedAttributes: candidate.projectedAttributes ?? [],
      })

      lsiCount++
    }
  }

  // Warn about LSI partition size limit
  if (result.lsiDefinitions.length > 0) {
    result.warnings.push(
      'Note: LSIs have a 10GB partition limit. Monitor partition sizes to avoid hitting this limit.',
    )
  }

  return result
}

/**
 * Candidate attribute for LSI
 */
interface LSICandidate {
  name: string
  projectionType?: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
  projectedAttributes?: string[]
}

/**
 * Find attributes that are good candidates for LSI
 */
function findLSICandidates(model: ParsedModel): LSICandidate[] {
  const candidates: LSICandidate[] = []

  // Look for timestamp attributes (good for time-based sorting)
  const timestampAttrs = model.attributes.filter(a =>
    a.cast === 'datetime'
    || a.name.toLowerCase().includes('date')
    || a.name.toLowerCase().includes('time')
    || a.name === 'createdAt'
    || a.name === 'updatedAt',
  )

  for (const attr of timestampAttrs) {
    // Skip the primary key
    if (attr.name === model.primaryKey) continue
    // Skip deletedAt (use sparse index instead)
    if (attr.name === 'deletedAt') continue

    candidates.push({
      name: attr.name,
      projectionType: 'ALL',
    })
  }

  // Look for explicitly indexed attributes in the model
  if (model.original.indexes) {
    for (const index of model.original.indexes) {
      if (index.type === 'lsi' && index.columns.length > 0) {
        candidates.push({
          name: index.columns[0], // LSI can only have one sort key
          projectionType: 'ALL',
        })
      }
    }
  }

  // Limit to reasonable number per model
  return candidates.slice(0, 2)
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Generate LSI documentation
 */
export function generateLSIDocumentation(result: LSIDerivationResult): string {
  const lines: string[] = []

  lines.push('# LSI Design Documentation')
  lines.push('')
  lines.push('## Overview')
  lines.push('')
  lines.push(`Total LSIs defined: ${result.lsiDefinitions.length}`)
  lines.push('Maximum LSIs per table: 5')
  lines.push('')

  if (result.lsiDefinitions.length > 0) {
    lines.push('## LSI Definitions')
    lines.push('')
    lines.push('| LSI Name | Sort Key | Projection |')
    lines.push('|----------|----------|------------|')

    for (const lsi of result.lsiDefinitions) {
      lines.push(`| ${lsi.name} | ${lsi.sortKey} | ${lsi.projection.type} |`)
    }

    lines.push('')
    lines.push('## Usage Patterns')
    lines.push('')

    for (const usage of result.lsiUsages) {
      lines.push(`### ${usage.name}`)
      lines.push('')
      lines.push(`- **Model:** ${usage.modelName}`)
      lines.push(`- **Sort Key:** ${usage.sortKey}`)
      lines.push(`- **Description:** ${usage.description}`)
      lines.push('')
    }
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
