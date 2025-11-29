import type { Config } from '../types'
import type {
  AccessPattern,
  DynamoDbAttributeType,
  KeyPattern,
  ModelRegistry,
  ParsedAttribute,
  ParsedModel,
  ParsedRelationship,
  StacksModel,
} from './types'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getConfig } from '../config'

// ============================================================================
// Model Parser Cache
// ============================================================================

let cachedRegistry: ModelRegistry | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 60000 // 1 minute cache

/**
 * Clear the model parser cache
 */
export function clearModelCache(): void {
  cachedRegistry = null
  cacheTimestamp = 0
}

// ============================================================================
// Stacks Model Parser
// ============================================================================

/**
 * Parse all Stacks models from the configured models path
 */
export async function parseModels(config?: Config): Promise<ModelRegistry> {
  const cfg = config ?? await getConfig()

  // Check cache
  if (cachedRegistry && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRegistry
  }

  const modelsPath = path.resolve(cfg.queryBuilder.modelsPath)
  const registry: ModelRegistry = {
    models: new Map(),
    accessPatterns: [],
    gsiAssignments: new Map(),
    warnings: [],
  }

  // Check if models directory exists
  if (!fs.existsSync(modelsPath)) {
    registry.warnings.push(`Models directory not found: ${modelsPath}`)
    return registry
  }

  // Discover model files
  const modelFiles = await discoverModelFiles(modelsPath)

  // Parse each model
  for (const modelFile of modelFiles) {
    try {
      const model = await loadModel(modelFile)
      if (model) {
        const parsedModel = parseModel(model, cfg)
        registry.models.set(parsedModel.name, parsedModel)
      }
    }
    catch (error) {
      registry.warnings.push(`Failed to parse model ${modelFile}: ${error}`)
    }
  }

  // Derive relationships and GSI assignments
  deriveRelationships(registry, cfg)

  // Generate access patterns
  generateAccessPatterns(registry, cfg)

  // Assign GSIs to relationships
  assignGSIs(registry, cfg)

  // Cache the result
  cachedRegistry = registry
  cacheTimestamp = Date.now()

  return registry
}

/**
 * Discover all model files in the models directory
 */
async function discoverModelFiles(modelsPath: string): Promise<string[]> {
  const files: string[] = []

  const entries = await fs.promises.readdir(modelsPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      // Skip index files and test files
      if (entry.name === 'index.ts' || entry.name === 'index.js' || entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        continue
      }
      files.push(path.join(modelsPath, entry.name))
    }
  }

  return files
}

/**
 * Load a model from a file
 */
async function loadModel(filePath: string): Promise<StacksModel | null> {
  try {
    // Dynamic import the model
    const module = await import(filePath)

    // Models can be default export or named export
    const model = module.default ?? module.model ?? module

    // Validate it's a valid model
    if (!model || typeof model !== 'object' || !model.name) {
      return null
    }

    return model as StacksModel
  }
  catch {
    return null
  }
}

/**
 * Parse a single Stacks model into our internal representation
 */
export function parseModel(model: StacksModel, config: Config): ParsedModel {
  const entityType = toEntityType(model.name)
  const primaryKey = model.primaryKey ?? 'id'
  const traits = model.traits ?? {}

  // Parse attributes
  const attributes = parseAttributes(model.attributes, traits)

  // Parse relationships (initial pass, will be refined later)
  const relationships = parseRelationships(model, primaryKey)

  // Generate key patterns
  const keyPatterns = generateKeyPatterns(entityType, primaryKey, config)

  return {
    name: model.name,
    entityType,
    primaryKey,
    attributes,
    relationships,
    keyPatterns,
    accessPatterns: [], // Will be filled in later
    traits,
    hasTimestamps: traits.useTimestamps ?? false,
    hasSoftDeletes: traits.useSoftDeletes ?? false,
    hasUuid: traits.useUuid ?? false,
    hasTtl: traits.useTtl ?? false,
    hasVersioning: traits.useVersioning ?? false,
    factory: model.factory,
    original: model,
  }
}

/**
 * Convert model name to entity type (e.g., 'User' -> 'USER')
 */
export function toEntityType(modelName: string): string {
  return modelName.toUpperCase()
}

/**
 * Convert model name to entity prefix (e.g., 'User' -> 'USER#')
 */
export function toEntityPrefix(modelName: string, delimiter: string = '#'): string {
  return `${toEntityType(modelName)}${delimiter}`
}

/**
 * Parse attributes from model definition
 */
function parseAttributes(
  attributes: Record<string, unknown>,
  traits: StacksModel['traits'],
): ParsedAttribute[] {
  const result: ParsedAttribute[] = []

  for (const [name, def] of Object.entries(attributes)) {
    const attrDef = (typeof def === 'object' && def !== null ? def : { fillable: true }) as Record<string, unknown>

    result.push({
      name,
      fillable: Boolean(attrDef.fillable ?? true),
      required: Boolean(attrDef.required ?? false),
      nullable: Boolean(attrDef.nullable ?? true),
      unique: Boolean(attrDef.unique ?? false),
      hidden: Boolean(attrDef.hidden ?? false),
      cast: attrDef.cast as string | undefined,
      defaultValue: attrDef.default,
      validationRules: parseValidationRules(attrDef.validation),
      dynamoDbType: inferDynamoDbType(attrDef),
    })
  }

  // Add timestamp attributes if trait is enabled
  if (traits?.useTimestamps) {
    if (!result.find(a => a.name === 'createdAt')) {
      result.push({
        name: 'createdAt',
        fillable: false,
        required: true,
        nullable: false,
        unique: false,
        hidden: false,
        cast: 'datetime',
        dynamoDbType: 'S',
      })
    }
    if (!result.find(a => a.name === 'updatedAt')) {
      result.push({
        name: 'updatedAt',
        fillable: false,
        required: true,
        nullable: false,
        unique: false,
        hidden: false,
        cast: 'datetime',
        dynamoDbType: 'S',
      })
    }
  }

  // Add soft delete attribute if trait is enabled
  if (traits?.useSoftDeletes) {
    if (!result.find(a => a.name === 'deletedAt')) {
      result.push({
        name: 'deletedAt',
        fillable: false,
        required: false,
        nullable: true,
        unique: false,
        hidden: false,
        cast: 'datetime',
        dynamoDbType: 'S',
      })
    }
  }

  return result
}

/**
 * Parse validation rules into array format
 */
function parseValidationRules(validation: unknown): string[] | undefined {
  if (!validation)
    return undefined

  if (typeof validation === 'string') {
    return validation.split('|')
  }

  if (Array.isArray(validation)) {
    return validation.map(v => (typeof v === 'string' ? v : (v as { rule: string }).rule))
  }

  if (typeof validation === 'object' && validation !== null && 'rule' in validation) {
    return [(validation as { rule: string }).rule]
  }

  return undefined
}

/**
 * Infer DynamoDB attribute type from attribute definition
 */
function inferDynamoDbType(attrDef: Record<string, unknown>): DynamoDbAttributeType {
  const cast = attrDef.cast as string | undefined
  const validation = attrDef.validation

  // Check cast type first
  if (cast) {
    switch (cast.toLowerCase()) {
      case 'integer':
      case 'int':
      case 'float':
      case 'double':
      case 'number':
      case 'decimal':
        return 'N'
      case 'boolean':
      case 'bool':
        return 'BOOL'
      case 'array':
      case 'list':
        return 'L'
      case 'object':
      case 'json':
      case 'map':
        return 'M'
      case 'set':
        return 'SS' // Default to string set
      case 'binary':
        return 'B'
      default:
        return 'S'
    }
  }

  // Check validation rules for type hints
  if (validation) {
    const rules = typeof validation === 'string' ? validation : JSON.stringify(validation)
    if (rules.includes('integer') || rules.includes('numeric')) {
      return 'N'
    }
    if (rules.includes('boolean')) {
      return 'BOOL'
    }
    if (rules.includes('array')) {
      return 'L'
    }
  }

  // Default to string
  return 'S'
}

/**
 * Parse relationships from model definition
 */
function parseRelationships(model: StacksModel, primaryKey: string): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = []

  // Parse hasOne relationships
  if (model.hasOne) {
    for (const related of model.hasOne) {
      relationships.push({
        type: 'hasOne',
        relatedModel: related,
        foreignKey: `${model.name.toLowerCase()}Id`,
        localKey: primaryKey,
        requiresGsi: true, // Need GSI for reverse lookup (get parent from child)
      })
    }
  }

  // Parse hasMany relationships
  if (model.hasMany) {
    for (const related of model.hasMany) {
      relationships.push({
        type: 'hasMany',
        relatedModel: related,
        foreignKey: `${model.name.toLowerCase()}Id`,
        localKey: primaryKey,
        requiresGsi: false, // Use sk begins_with in same partition
      })
    }
  }

  // Parse belongsTo relationships
  if (model.belongsTo) {
    for (const related of model.belongsTo) {
      relationships.push({
        type: 'belongsTo',
        relatedModel: related,
        foreignKey: `${related.toLowerCase()}Id`,
        localKey: primaryKey,
        requiresGsi: true, // Need GSI for "get all X belonging to Y"
      })
    }
  }

  // Parse belongsToMany relationships
  if (model.belongsToMany) {
    for (const related of model.belongsToMany) {
      const pivotName = [model.name, related].sort().join('')
      relationships.push({
        type: 'belongsToMany',
        relatedModel: related,
        foreignKey: `${related.toLowerCase()}Id`,
        localKey: primaryKey,
        pivotEntity: pivotName,
        requiresGsi: true, // Need GSI for adjacency list queries
      })
    }
  }

  return relationships
}

/**
 * Generate key patterns for an entity
 */
function generateKeyPatterns(
  entityType: string,
  primaryKey: string,
  config: Config,
): KeyPattern {
  const _delimiter = config.singleTableDesign.keyDelimiter
  const pkPrefix = config.singleTableDesign.pkPrefix.replace('{ENTITY}', entityType)
  const skPrefix = config.singleTableDesign.skPrefix.replace('{ENTITY}', entityType)

  return {
    pk: `${pkPrefix}{${primaryKey}}`,
    sk: `${skPrefix}{${primaryKey}}`,
    // GSI patterns will be filled in during relationship derivation
  }
}

/**
 * Derive relationships across all models and validate them
 */
function deriveRelationships(registry: ModelRegistry, config: Config): void {
  for (const [, model] of registry.models) {
    for (const relationship of model.relationships) {
      // Validate that related model exists
      const relatedModel = registry.models.get(relationship.relatedModel)
      if (!relatedModel) {
        registry.warnings.push(
          `Model ${model.name} references unknown model ${relationship.relatedModel} in ${relationship.type} relationship`,
        )
        continue
      }

      // Update key patterns based on relationships
      updateKeyPatternsForRelationship(model, relationship, relatedModel, config)
    }
  }
}

/**
 * Update key patterns based on relationship type
 */
function updateKeyPatternsForRelationship(
  model: ParsedModel,
  relationship: ParsedRelationship,
  relatedModel: ParsedModel,
  config: Config,
): void {
  const delimiter = config.singleTableDesign.keyDelimiter

  switch (relationship.type) {
    case 'belongsTo':
      // For belongsTo, we might store the parent reference in a GSI
      // GSI1PK = PARENT#{parentId}, GSI1SK = CHILD#{childId}
      if (!model.keyPatterns.gsi1pk) {
        model.keyPatterns.gsi1pk = `${relatedModel.entityType}${delimiter}{${relationship.foreignKey}}`
        model.keyPatterns.gsi1sk = `${model.entityType}${delimiter}{${model.primaryKey}}`
      }
      break

    case 'hasMany':
      // For hasMany, children are stored with pk = PARENT#{parentId}, sk = CHILD#{childId}
      // This is handled in the child's pk pattern when it belongsTo this parent
      break

    case 'belongsToMany':
      // For belongsToMany, we create adjacency list items
      // These are separate items with specific pk/sk patterns
      break
  }
}

/**
 * Generate access patterns for all models
 */
function generateAccessPatterns(registry: ModelRegistry, _config: Config): void {
  for (const [, model] of registry.models) {
    const patterns: AccessPattern[] = []

    // Pattern 1: Get entity by ID
    patterns.push({
      name: `Get ${model.name} by ID`,
      description: `Retrieve a single ${model.name} by its primary key`,
      entityType: model.entityType,
      operation: 'get',
      index: 'main',
      keyCondition: `pk = ${model.entityType}#{id} AND sk = ${model.entityType}#{id}`,
      examplePk: `${model.entityType}#123`,
      exampleSk: `${model.entityType}#123`,
      efficient: true,
    })

    // Pattern 2: List all entities (scan - inefficient but available)
    patterns.push({
      name: `List all ${model.name}s`,
      description: `Retrieve all ${model.name} entities (requires scan with filter)`,
      entityType: model.entityType,
      operation: 'scan',
      index: 'scan',
      keyCondition: `_et = ${model.name}`,
      examplePk: 'N/A (scan)',
      efficient: false,
    })

    // Generate patterns for relationships
    for (const relationship of model.relationships) {
      const relatedModel = registry.models.get(relationship.relatedModel)
      if (!relatedModel)
        continue

      switch (relationship.type) {
        case 'hasMany':
          patterns.push({
            name: `Get ${relationship.relatedModel}s for ${model.name}`,
            description: `Query all ${relationship.relatedModel} items belonging to a ${model.name}`,
            entityType: relatedModel.entityType,
            operation: 'query',
            index: 'main',
            keyCondition: `pk = ${model.entityType}#{id} AND sk begins_with ${relatedModel.entityType}#`,
            examplePk: `${model.entityType}#123`,
            exampleSk: `${relatedModel.entityType}#`,
            efficient: true,
          })
          break

        case 'belongsTo':
          patterns.push({
            name: `Get ${model.name}s by ${relationship.relatedModel}`,
            description: `Query all ${model.name} items belonging to a ${relationship.relatedModel}`,
            entityType: model.entityType,
            operation: 'query',
            index: 'GSI1',
            keyCondition: `gsi1pk = ${relatedModel.entityType}#{id}`,
            examplePk: `${relatedModel.entityType}#456`,
            efficient: true,
          })
          break
      }
    }

    // Generate patterns for unique attributes
    for (const attr of model.attributes) {
      if (attr.unique) {
        patterns.push({
          name: `Get ${model.name} by ${attr.name}`,
          description: `Retrieve a ${model.name} by unique ${attr.name}`,
          entityType: model.entityType,
          operation: 'query',
          index: 'GSI2', // Assuming unique lookups use GSI2
          keyCondition: `gsi2pk = ${attr.name.toUpperCase()}#{value}`,
          examplePk: `${attr.name.toUpperCase()}#example@email.com`,
          efficient: true,
        })
      }
    }

    model.accessPatterns = patterns
    registry.accessPatterns.push(...patterns)
  }
}

/**
 * Assign GSIs to relationships that require them
 */
function assignGSIs(registry: ModelRegistry, config: Config): void {
  let gsiCounter = 1
  const maxGsis = config.singleTableDesign.gsiCount

  for (const [, model] of registry.models) {
    for (const relationship of model.relationships) {
      if (relationship.requiresGsi && !relationship.gsiIndex) {
        if (gsiCounter > maxGsis) {
          registry.warnings.push(
            `Exceeded configured GSI count (${maxGsis}). Relationship ${model.name}.${relationship.type}(${relationship.relatedModel}) may not have efficient index support.`,
          )
          continue
        }

        relationship.gsiIndex = gsiCounter
        registry.gsiAssignments.set(`${model.name}:${relationship.relatedModel}`, gsiCounter)
        gsiCounter++
      }
    }

    // Also assign GSIs for unique attributes
    for (const attr of model.attributes) {
      if (attr.unique) {
        if (gsiCounter > maxGsis) {
          registry.warnings.push(
            `Exceeded configured GSI count (${maxGsis}). Unique attribute ${model.name}.${attr.name} may not have efficient index support.`,
          )
          continue
        }
        registry.gsiAssignments.set(`${model.name}:unique:${attr.name}`, gsiCounter)
        gsiCounter++
      }
    }
  }
}

/**
 * Get a parsed model by name
 */
export async function getModel(modelName: string, config?: Config): Promise<ParsedModel | undefined> {
  const registry = await parseModels(config)
  return registry.models.get(modelName)
}

/**
 * Get all parsed models
 */
export async function getAllModels(config?: Config): Promise<ParsedModel[]> {
  const registry = await parseModels(config)
  return Array.from(registry.models.values())
}

/**
 * Get all access patterns
 */
export async function getAccessPatterns(config?: Config): Promise<AccessPattern[]> {
  const registry = await parseModels(config)
  return registry.accessPatterns
}

/**
 * Get the model registry
 */
export async function getModelRegistry(config?: Config): Promise<ModelRegistry> {
  return parseModels(config)
}
