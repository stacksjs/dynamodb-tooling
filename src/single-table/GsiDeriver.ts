import type { ModelRegistry } from '../model-parser/types'
import type { Config, GSIDefinition } from '../types'
import { toEntityType } from '../model-parser/StacksModelParser'

// ============================================================================
// GSI Derivation Types
// ============================================================================

/**
 * GSI usage information for optimization
 */
export interface GSIUsage {
  /**
   * GSI index (1-5 for GSI1-GSI5, or higher for additional GSIs)
   */
  index: number
  /**
   * GSI name (e.g., 'GSI1')
   */
  name: string
  /**
   * Access patterns using this GSI
   */
  accessPatterns: GSIAccessPattern[]
  /**
   * Is this GSI overloaded (multiple access patterns)?
   */
  overloaded: boolean
  /**
   * Estimated query load (for optimization hints)
   */
  estimatedLoad: 'low' | 'medium' | 'high'
}

/**
 * Access pattern that uses a GSI
 */
export interface GSIAccessPattern {
  /**
   * Model name
   */
  modelName: string
  /**
   * Relationship or attribute that uses this GSI
   */
  source: string
  /**
   * Type of access pattern
   */
  type: 'relationship' | 'unique_attribute' | 'query'
  /**
   * PK attribute pattern
   */
  pkPattern: string
  /**
   * SK attribute pattern
   */
  skPattern: string
  /**
   * Description of the access pattern
   */
  description: string
}

/**
 * GSI optimization suggestion
 */
export interface GSIOptimization {
  /**
   * Type of optimization
   */
  type: 'consolidate' | 'split' | 'remove' | 'add'
  /**
   * Description of the optimization
   */
  description: string
  /**
   * Affected GSIs
   */
  affectedGSIs: number[]
  /**
   * Expected benefit
   */
  benefit: string
}

/**
 * Complete GSI derivation result
 */
export interface GSIDerivationResult {
  /**
   * Derived GSI definitions
   */
  gsiDefinitions: GSIDefinition[]
  /**
   * GSI usage information
   */
  gsiUsages: GSIUsage[]
  /**
   * Optimization suggestions
   */
  optimizations: GSIOptimization[]
  /**
   * Warnings about GSI design
   */
  warnings: string[]
}

// ============================================================================
// GSI Deriver Implementation
// ============================================================================

/**
 * Derive GSI definitions from model relationships
 */
export function deriveGSIsFromModels(
  registry: ModelRegistry,
  config: Config,
): GSIDerivationResult {
  const result: GSIDerivationResult = {
    gsiDefinitions: [],
    gsiUsages: [],
    optimizations: [],
    warnings: [],
  }

  const delimiter = config.singleTableDesign.keyDelimiter
  const maxGSIs = config.singleTableDesign.gsiCount
  const gsiAccessPatterns = new Map<number, GSIAccessPattern[]>()

  // Initialize GSI access pattern map
  for (let i = 1; i <= maxGSIs; i++) {
    gsiAccessPatterns.set(i, [])
  }

  let currentGSI = 1

  // Process each model's relationships
  for (const [, model] of registry.models) {
    // Process belongsTo relationships
    for (const rel of model.relationships.filter(r => r.type === 'belongsTo')) {
      if (currentGSI > maxGSIs) {
        result.warnings.push(
          `Cannot assign GSI for ${model.name}.belongsTo(${rel.relatedModel}) - exceeded max GSI count of ${maxGSIs}`,
        )
        continue
      }

      const relatedEntityType = toEntityType(rel.relatedModel)
      const pattern: GSIAccessPattern = {
        modelName: model.name,
        source: `belongsTo(${rel.relatedModel})`,
        type: 'relationship',
        pkPattern: `${relatedEntityType}${delimiter}{${rel.foreignKey}}`,
        skPattern: `${model.entityType}${delimiter}{${model.primaryKey}}`,
        description: `Get all ${model.name}s belonging to a ${rel.relatedModel}`,
      }

      // Try to consolidate with existing patterns
      const existingGSI = findConsolidatableGSI(pattern, gsiAccessPatterns, config)
      if (existingGSI) {
        gsiAccessPatterns.get(existingGSI)!.push(pattern)
        rel.gsiIndex = existingGSI
      }
      else {
        gsiAccessPatterns.get(currentGSI)!.push(pattern)
        rel.gsiIndex = currentGSI
        currentGSI++
      }
    }

    // Process belongsToMany relationships
    for (const rel of model.relationships.filter(r => r.type === 'belongsToMany')) {
      if (currentGSI > maxGSIs) {
        result.warnings.push(
          `Cannot assign GSI for ${model.name}.belongsToMany(${rel.relatedModel}) - exceeded max GSI count of ${maxGSIs}`,
        )
        continue
      }

      const relatedEntityType = toEntityType(rel.relatedModel)
      const pattern: GSIAccessPattern = {
        modelName: model.name,
        source: `belongsToMany(${rel.relatedModel})`,
        type: 'relationship',
        pkPattern: `${relatedEntityType}${delimiter}{${rel.foreignKey}}`,
        skPattern: `${model.entityType}${delimiter}{${model.primaryKey}}`,
        description: `Get all ${model.name}s associated with a ${rel.relatedModel} (many-to-many)`,
      }

      const existingGSI = findConsolidatableGSI(pattern, gsiAccessPatterns, config)
      if (existingGSI) {
        gsiAccessPatterns.get(existingGSI)!.push(pattern)
        rel.gsiIndex = existingGSI
      }
      else {
        gsiAccessPatterns.get(currentGSI)!.push(pattern)
        rel.gsiIndex = currentGSI
        currentGSI++
      }
    }

    // Process unique attributes
    for (const attr of model.attributes.filter(a => a.unique)) {
      if (currentGSI > maxGSIs) {
        result.warnings.push(
          `Cannot assign GSI for unique attribute ${model.name}.${attr.name} - exceeded max GSI count of ${maxGSIs}`,
        )
        continue
      }

      const pattern: GSIAccessPattern = {
        modelName: model.name,
        source: `unique:${attr.name}`,
        type: 'unique_attribute',
        pkPattern: `${attr.name.toUpperCase()}${delimiter}{${attr.name}}`,
        skPattern: `${model.entityType}${delimiter}{${model.primaryKey}}`,
        description: `Get ${model.name} by unique ${attr.name}`,
      }

      // Unique lookups generally shouldn't be consolidated
      gsiAccessPatterns.get(currentGSI)!.push(pattern)
      currentGSI++
    }
  }

  // Generate GSI definitions
  for (let i = 1; i <= maxGSIs; i++) {
    const patterns = gsiAccessPatterns.get(i) ?? []
    if (patterns.length === 0)
      continue

    const gsiName = getGSIAttributeName(i, 'name', config)
    const gsiPK = getGSIAttributeName(i, 'pk', config)
    const gsiSK = getGSIAttributeName(i, 'sk', config)

    result.gsiDefinitions.push({
      name: gsiName,
      partitionKey: gsiPK,
      sortKey: gsiSK,
      projection: { type: 'ALL' },
    })

    result.gsiUsages.push({
      index: i,
      name: gsiName,
      accessPatterns: patterns,
      overloaded: patterns.length > 1,
      estimatedLoad: patterns.length > 3 ? 'high' : patterns.length > 1 ? 'medium' : 'low',
    })
  }

  // Generate optimization suggestions
  result.optimizations = analyzeGSIOptimizations(result.gsiUsages, config)

  return result
}

/**
 * Find an existing GSI that can be consolidated with the given pattern
 */
function findConsolidatableGSI(
  pattern: GSIAccessPattern,
  gsiAccessPatterns: Map<number, GSIAccessPattern[]>,
  _config: Config,
): number | null {
  // Check each existing GSI for consolidation opportunities
  for (const [gsi, patterns] of gsiAccessPatterns) {
    if (patterns.length === 0)
      continue

    // Check if the pk pattern prefix matches (allows overloading)
    const existingPattern = patterns[0]
    const existingPKPrefix = existingPattern.pkPattern.split('{')[0]
    const newPKPrefix = pattern.pkPattern.split('{')[0]

    // If the prefixes are different, we can potentially overload
    // This is the essence of single-table design GSI overloading
    if (existingPKPrefix !== newPKPrefix && patterns.length < 5) {
      return gsi
    }
  }

  return null
}

/**
 * Get GSI attribute name based on index
 */
function getGSIAttributeName(index: number, type: 'name' | 'pk' | 'sk', config: Config): string {
  const std = config.singleTableDesign

  switch (index) {
    case 1:
      return type === 'name' ? 'GSI1' : type === 'pk' ? std.gsi1pkName : std.gsi1skName
    case 2:
      return type === 'name' ? 'GSI2' : type === 'pk' ? std.gsi2pkName : std.gsi2skName
    case 3:
      return type === 'name' ? 'GSI3' : type === 'pk' ? std.gsi3pkName : std.gsi3skName
    case 4:
      return type === 'name' ? 'GSI4' : type === 'pk' ? std.gsi4pkName : std.gsi4skName
    case 5:
      return type === 'name' ? 'GSI5' : type === 'pk' ? std.gsi5pkName : std.gsi5skName
    default:
      return type === 'name' ? `GSI${index}` : type === 'pk' ? `gsi${index}pk` : `gsi${index}sk`
  }
}

/**
 * Analyze GSI usage and generate optimization suggestions
 */
function analyzeGSIOptimizations(usages: GSIUsage[], config: Config): GSIOptimization[] {
  const optimizations: GSIOptimization[] = []

  // Check for underutilized GSIs that could be consolidated
  const underutilized = usages.filter(u => u.accessPatterns.length === 1)
  if (underutilized.length >= 2) {
    optimizations.push({
      type: 'consolidate',
      description: `GSIs ${underutilized.map(u => u.name).join(', ')} each have only one access pattern and could potentially be consolidated`,
      affectedGSIs: underutilized.map(u => u.index),
      benefit: 'Reduce GSI count and associated costs',
    })
  }

  // Check for heavily overloaded GSIs
  const overloaded = usages.filter(u => u.accessPatterns.length > 5)
  for (const gsi of overloaded) {
    optimizations.push({
      type: 'split',
      description: `${gsi.name} has ${gsi.accessPatterns.length} access patterns which may cause hot partition issues`,
      affectedGSIs: [gsi.index],
      benefit: 'Reduce risk of throttling and improve query performance',
    })
  }

  // Check for unused GSI slots
  const maxGSIs = config.singleTableDesign.gsiCount
  const usedGSIs = usages.length
  if (usedGSIs < maxGSIs && usages.some(u => u.estimatedLoad === 'high')) {
    optimizations.push({
      type: 'split',
      description: `You have ${maxGSIs - usedGSIs} unused GSI slots. Consider splitting high-load GSIs for better performance.`,
      affectedGSIs: usages.filter(u => u.estimatedLoad === 'high').map(u => u.index),
      benefit: 'Better load distribution and query performance',
    })
  }

  return optimizations
}

/**
 * Generate GSI documentation
 */
export function generateGSIDocumentation(result: GSIDerivationResult, config: Config): string {
  const lines: string[] = []

  lines.push('# GSI Design Documentation')
  lines.push('')
  lines.push('## Overview')
  lines.push('')
  lines.push(`Total GSIs defined: ${result.gsiDefinitions.length}`)
  lines.push(`Max configured GSIs: ${config.singleTableDesign.gsiCount}`)
  lines.push('')

  lines.push('## GSI Definitions')
  lines.push('')
  lines.push('| GSI Name | PK Attribute | SK Attribute | Projection |')
  lines.push('|----------|--------------|--------------|------------|')

  for (const gsi of result.gsiDefinitions) {
    lines.push(`| ${gsi.name} | ${gsi.partitionKey} | ${gsi.sortKey ?? 'N/A'} | ${gsi.projection.type} |`)
  }

  lines.push('')
  lines.push('## Access Patterns by GSI')
  lines.push('')

  for (const usage of result.gsiUsages) {
    lines.push(`### ${usage.name}`)
    lines.push('')
    lines.push(`- **Overloaded:** ${usage.overloaded ? 'Yes' : 'No'}`)
    lines.push(`- **Estimated Load:** ${usage.estimatedLoad}`)
    lines.push('')
    lines.push('| Model | Source | PK Pattern | SK Pattern | Description |')
    lines.push('|-------|--------|------------|------------|-------------|')

    for (const pattern of usage.accessPatterns) {
      lines.push(`| ${pattern.modelName} | ${pattern.source} | ${pattern.pkPattern} | ${pattern.skPattern} | ${pattern.description} |`)
    }

    lines.push('')
  }

  if (result.optimizations.length > 0) {
    lines.push('## Optimization Suggestions')
    lines.push('')

    for (const opt of result.optimizations) {
      lines.push(`### ${opt.type.charAt(0).toUpperCase() + opt.type.slice(1)}`)
      lines.push('')
      lines.push(`- **Description:** ${opt.description}`)
      lines.push(`- **Affected GSIs:** ${opt.affectedGSIs.map(i => `GSI${i}`).join(', ')}`)
      lines.push(`- **Benefit:** ${opt.benefit}`)
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

/**
 * Validate GSI design against DynamoDB limits
 */
export function validateGSIDesign(result: GSIDerivationResult): { valid: boolean, errors: string[] } {
  const errors: string[] = []

  // Check GSI count limit (20 max for DynamoDB)
  if (result.gsiDefinitions.length > 20) {
    errors.push(`Too many GSIs: ${result.gsiDefinitions.length} (max 20)`)
  }

  // Check for duplicate GSI names
  const names = result.gsiDefinitions.map(g => g.name)
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
  if (duplicates.length > 0) {
    errors.push(`Duplicate GSI names: ${[...new Set(duplicates)].join(', ')}`)
  }

  // Check for duplicate PK/SK combinations
  const combos = result.gsiDefinitions.map(g => `${g.partitionKey}:${g.sortKey}`)
  const dupCombos = combos.filter((c, i) => combos.indexOf(c) !== i)
  if (dupCombos.length > 0) {
    errors.push(`Duplicate PK/SK combinations across GSIs: ${[...new Set(dupCombos)].join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
