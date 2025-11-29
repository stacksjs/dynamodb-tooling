import type { KeyPattern, ParsedModel } from '../model-parser/types'
import type { Config } from '../types'
import { toEntityType } from '../model-parser/StacksModelParser'

// ============================================================================
// Key Pattern Types
// ============================================================================

/**
 * Generated key value with resolved placeholders
 */
export interface ResolvedKey {
  pk: string
  sk: string
  gsi1pk?: string
  gsi1sk?: string
  gsi2pk?: string
  gsi2sk?: string
  gsi3pk?: string
  gsi3sk?: string
  gsi4pk?: string
  gsi4sk?: string
  gsi5pk?: string
  gsi5sk?: string
}

/**
 * Key pattern template with placeholders
 */
export interface KeyPatternTemplate {
  /**
   * Pattern name for documentation
   */
  name: string
  /**
   * Description of when this pattern is used
   */
  description: string
  /**
   * The key pattern
   */
  pattern: KeyPattern
  /**
   * Example values
   */
  example: ResolvedKey
}

/**
 * Validation result for key patterns
 */
export interface KeyPatternValidation {
  valid: boolean
  conflicts: string[]
  warnings: string[]
}

// ============================================================================
// Key Pattern Generator
// ============================================================================

/**
 * Generate key patterns for a model
 */
export function generateKeyPatternsForModel(
  model: ParsedModel,
  config: Config,
): KeyPatternTemplate {
  const delimiter = config.singleTableDesign.keyDelimiter
  const entityType = model.entityType

  // Base pattern: pk = ENTITY#{id}, sk = ENTITY#{id}
  const pattern: KeyPattern = {
    pk: `${entityType}${delimiter}{${model.primaryKey}}`,
    sk: `${entityType}${delimiter}{${model.primaryKey}}`,
  }

  // Add GSI patterns based on relationships
  const gsiPatterns = generateGSIPatternsForRelationships(model, config)
  Object.assign(pattern, gsiPatterns)

  return {
    name: `${model.name} Base Pattern`,
    description: `Key pattern for ${model.name} entity items`,
    pattern,
    example: {
      pk: `${entityType}${delimiter}123`,
      sk: `${entityType}${delimiter}123`,
      ...resolveGSIExamples(gsiPatterns, delimiter),
    },
  }
}

/**
 * Generate GSI patterns for model relationships
 */
function generateGSIPatternsForRelationships(
  model: ParsedModel,
  config: Config,
): Partial<KeyPattern> {
  const result: Partial<KeyPattern> = {}
  const delimiter = config.singleTableDesign.keyDelimiter
  let gsiIndex = 1

  for (const rel of model.relationships) {
    if (!rel.requiresGsi)
      continue

    const relatedEntityType = toEntityType(rel.relatedModel)

    switch (rel.type) {
      case 'belongsTo':
        // GSI for "get all X belonging to Y"
        // GSIPK = PARENT#{parentId}, GSISK = CHILD#{childId}
        assignGSIPattern(result, gsiIndex, {
          pk: `${relatedEntityType}${delimiter}{${rel.foreignKey}}`,
          sk: `${model.entityType}${delimiter}{${model.primaryKey}}`,
        })
        gsiIndex++
        break

      case 'hasOne':
        // GSI for "get parent from child" (reverse lookup)
        // Similar to belongsTo but from the parent's perspective
        assignGSIPattern(result, gsiIndex, {
          pk: `${model.entityType}${delimiter}{${model.primaryKey}}`,
          sk: `${relatedEntityType}${delimiter}{${relatedEntityType.toLowerCase()}Id}`,
        })
        gsiIndex++
        break

      case 'belongsToMany':
        // GSI for adjacency list queries
        // GSIPK = RELATED#{relatedId}, GSISK = ENTITY#{entityId}
        assignGSIPattern(result, gsiIndex, {
          pk: `${relatedEntityType}${delimiter}{${rel.foreignKey}}`,
          sk: `${model.entityType}${delimiter}{${model.primaryKey}}`,
        })
        gsiIndex++
        break
    }

    // Don't exceed 5 GSIs (we only define 5 in the config)
    if (gsiIndex > 5)
      break
  }

  // Add GSI patterns for unique attributes
  for (const attr of model.attributes) {
    if (attr.unique && gsiIndex <= 5) {
      assignGSIPattern(result, gsiIndex, {
        pk: `${attr.name.toUpperCase()}${delimiter}{${attr.name}}`,
        sk: `${model.entityType}${delimiter}{${model.primaryKey}}`,
      })
      gsiIndex++
    }
  }

  return result
}

/**
 * Assign a GSI pattern to the result object
 */
function assignGSIPattern(
  result: Partial<KeyPattern>,
  index: number,
  pattern: { pk: string, sk: string },
): void {
  switch (index) {
    case 1:
      result.gsi1pk = pattern.pk
      result.gsi1sk = pattern.sk
      break
    case 2:
      result.gsi2pk = pattern.pk
      result.gsi2sk = pattern.sk
      break
    case 3:
      result.gsi3pk = pattern.pk
      result.gsi3sk = pattern.sk
      break
    case 4:
      result.gsi4pk = pattern.pk
      result.gsi4sk = pattern.sk
      break
    case 5:
      result.gsi5pk = pattern.pk
      result.gsi5sk = pattern.sk
      break
  }
}

/**
 * Resolve GSI examples from patterns
 */
function resolveGSIExamples(
  patterns: Partial<KeyPattern>,
  delimiter: string,
): Partial<ResolvedKey> {
  const result: Partial<ResolvedKey> = {}

  if (patterns.gsi1pk) {
    result.gsi1pk = patterns.gsi1pk.replace(/\{[^}]+\}/g, '123')
    result.gsi1sk = patterns.gsi1sk?.replace(/\{[^}]+\}/g, '456')
  }
  if (patterns.gsi2pk) {
    result.gsi2pk = patterns.gsi2pk.replace(/\{[^}]+\}/g, 'example@email.com')
    result.gsi2sk = patterns.gsi2sk?.replace(/\{[^}]+\}/g, '789')
  }
  if (patterns.gsi3pk) {
    result.gsi3pk = patterns.gsi3pk.replace(/\{[^}]+\}/g, '111')
    result.gsi3sk = patterns.gsi3sk?.replace(/\{[^}]+\}/g, '222')
  }
  if (patterns.gsi4pk) {
    result.gsi4pk = patterns.gsi4pk.replace(/\{[^}]+\}/g, '333')
    result.gsi4sk = patterns.gsi4sk?.replace(/\{[^}]+\}/g, '444')
  }
  if (patterns.gsi5pk) {
    result.gsi5pk = patterns.gsi5pk.replace(/\{[^}]+\}/g, '555')
    result.gsi5sk = patterns.gsi5sk?.replace(/\{[^}]+\}/g, '666')
  }

  return result
}

/**
 * Generate hierarchical key pattern for nested entities
 * E.g., USER#123#ORDER#456
 */
export function generateHierarchicalKey(
  parentEntity: string,
  parentId: string,
  childEntity: string,
  childId: string,
  config: Config,
): { pk: string, sk: string } {
  const delimiter = config.singleTableDesign.keyDelimiter

  return {
    pk: `${parentEntity.toUpperCase()}${delimiter}${parentId}`,
    sk: `${childEntity.toUpperCase()}${delimiter}${childId}`,
  }
}

/**
 * Generate a collection key pattern for fetching all children
 * Uses sk begins_with pattern
 */
export function generateCollectionKeyPattern(
  parentEntity: string,
  parentId: string,
  childEntity: string,
  config: Config,
): { pk: string, skPrefix: string } {
  const delimiter = config.singleTableDesign.keyDelimiter

  return {
    pk: `${parentEntity.toUpperCase()}${delimiter}${parentId}`,
    skPrefix: `${childEntity.toUpperCase()}${delimiter}`,
  }
}

/**
 * Resolve a key pattern template with actual values
 */
export function resolveKeyPattern(
  pattern: KeyPattern,
  values: Record<string, string | number>,
): ResolvedKey {
  const resolve = (template: string): string => {
    return template.replace(/\{([^}]+)\}/g, (_, key) => {
      return String(values[key] ?? key)
    })
  }

  const result: ResolvedKey = {
    pk: resolve(pattern.pk),
    sk: resolve(pattern.sk),
  }

  if (pattern.gsi1pk)
    result.gsi1pk = resolve(pattern.gsi1pk)
  if (pattern.gsi1sk)
    result.gsi1sk = resolve(pattern.gsi1sk)
  if (pattern.gsi2pk)
    result.gsi2pk = resolve(pattern.gsi2pk)
  if (pattern.gsi2sk)
    result.gsi2sk = resolve(pattern.gsi2sk)
  if (pattern.gsi3pk)
    result.gsi3pk = resolve(pattern.gsi3pk)
  if (pattern.gsi3sk)
    result.gsi3sk = resolve(pattern.gsi3sk)
  if (pattern.gsi4pk)
    result.gsi4pk = resolve(pattern.gsi4pk)
  if (pattern.gsi4sk)
    result.gsi4sk = resolve(pattern.gsi4sk)
  if (pattern.gsi5pk)
    result.gsi5pk = resolve(pattern.gsi5pk)
  if (pattern.gsi5sk)
    result.gsi5sk = resolve(pattern.gsi5sk)

  return result
}

/**
 * Validate key patterns don't conflict across entities
 */
export function validateKeyPatterns(
  models: ParsedModel[],
  config: Config,
): KeyPatternValidation {
  const conflicts: string[] = []
  const warnings: string[] = []
  const pkPatterns = new Map<string, string>()

  for (const model of models) {
    const pattern = model.keyPatterns

    // Check for pk pattern conflicts
    const pkBase = pattern.pk.split('{')[0]
    if (pkPatterns.has(pkBase)) {
      const existing = pkPatterns.get(pkBase)!
      if (existing !== model.name) {
        conflicts.push(
          `PK pattern conflict: ${model.name} and ${existing} both use prefix "${pkBase}"`,
        )
      }
    }
    else {
      pkPatterns.set(pkBase, model.name)
    }
  }

  // Check for GSI overloading issues
  const gsiUsage = new Map<number, string[]>()
  for (const model of models) {
    for (const rel of model.relationships) {
      if (rel.gsiIndex) {
        const existing = gsiUsage.get(rel.gsiIndex) ?? []
        existing.push(`${model.name}.${rel.type}(${rel.relatedModel})`)
        gsiUsage.set(rel.gsiIndex, existing)
      }
    }
  }

  // Warn about heavily overloaded GSIs
  for (const [gsi, usages] of gsiUsage) {
    if (usages.length > 5) {
      warnings.push(
        `GSI${gsi} is heavily overloaded with ${usages.length} access patterns. Consider optimizing.`,
      )
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
    warnings,
  }
}

/**
 * Generate documentation for key patterns
 */
export function generateKeyPatternDocumentation(
  models: ParsedModel[],
  config: Config,
): string {
  const delimiter = config.singleTableDesign.keyDelimiter
  const lines: string[] = []

  lines.push('# Key Pattern Documentation')
  lines.push('')
  lines.push('## Entity Key Patterns')
  lines.push('')

  for (const model of models) {
    lines.push(`### ${model.name}`)
    lines.push('')
    lines.push('| Key | Pattern | Example |')
    lines.push('|-----|---------|---------|')
    lines.push(`| PK | \`${model.keyPatterns.pk}\` | \`${model.entityType}${delimiter}123\` |`)
    lines.push(`| SK | \`${model.keyPatterns.sk}\` | \`${model.entityType}${delimiter}123\` |`)

    if (model.keyPatterns.gsi1pk) {
      lines.push(`| GSI1PK | \`${model.keyPatterns.gsi1pk}\` | \`${model.keyPatterns.gsi1pk.replace(/\{[^}]+\}/g, '456')}\` |`)
      lines.push(`| GSI1SK | \`${model.keyPatterns.gsi1sk}\` | \`${model.keyPatterns.gsi1sk?.replace(/\{[^}]+\}/g, '123')}\` |`)
    }
    if (model.keyPatterns.gsi2pk) {
      lines.push(`| GSI2PK | \`${model.keyPatterns.gsi2pk}\` | \`${model.keyPatterns.gsi2pk.replace(/\{[^}]+\}/g, 'value')}\` |`)
      lines.push(`| GSI2SK | \`${model.keyPatterns.gsi2sk}\` | \`${model.keyPatterns.gsi2sk?.replace(/\{[^}]+\}/g, '123')}\` |`)
    }

    lines.push('')
  }

  lines.push('## Access Patterns')
  lines.push('')

  for (const model of models) {
    if (model.accessPatterns.length > 0) {
      lines.push(`### ${model.name} Access Patterns`)
      lines.push('')
      lines.push('| Pattern | Operation | Index | Key Condition |')
      lines.push('|---------|-----------|-------|---------------|')

      for (const ap of model.accessPatterns) {
        lines.push(`| ${ap.name} | ${ap.operation} | ${ap.index} | \`${ap.keyCondition}\` |`)
      }

      lines.push('')
    }
  }

  return lines.join('\n')
}
