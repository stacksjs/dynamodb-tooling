import type { Config } from '../types'
import type { ModelRegistry, ParsedModel, ParsedRelationship } from '../model-parser/types'
import type { DynamoDBItem, JSObject } from './EntityTransformer'
import { toModelInstance, unmarshallItem } from './EntityTransformer'

// ============================================================================
// Relationship Resolution Types
// ============================================================================

/**
 * Eager loading specification
 */
export interface EagerLoadSpec {
  /**
   * Relationship name to load
   */
  relationship: string
  /**
   * Nested relationships (e.g., 'posts.comments')
   */
  nested?: EagerLoadSpec[]
  /**
   * Query constraints for the relationship
   */
  constraints?: {
    limit?: number
    where?: Array<{ key: string, value: unknown }>
    orderBy?: { key: string, direction: 'asc' | 'desc' }
  }
}

/**
 * Resolved relationship data
 */
export interface ResolvedRelationship<T = JSObject> {
  /**
   * Relationship name
   */
  name: string
  /**
   * Relationship type
   */
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'
  /**
   * Resolved data (null for hasOne/belongsTo if not found)
   */
  data: T | T[] | null
  /**
   * Whether the relationship was loaded
   */
  loaded: boolean
  /**
   * Count of related items (for withCount)
   */
  count?: number
}

/**
 * Query builder interface for relationship queries
 */
export interface RelationshipQueryBuilder {
  /**
   * Execute a GetItem operation
   */
  getItem: (tableName: string, key: { pk: string, sk: string }) => Promise<DynamoDBItem | null>
  /**
   * Execute a Query operation
   */
  query: (tableName: string, params: QueryParams) => Promise<DynamoDBItem[]>
  /**
   * Execute a BatchGetItem operation
   */
  batchGet: (tableName: string, keys: Array<{ pk: string, sk: string }>) => Promise<DynamoDBItem[]>
}

/**
 * Query parameters for relationship queries
 */
export interface QueryParams {
  indexName?: string
  keyCondition: string
  keyValues: Record<string, string>
  limit?: number
  scanIndexForward?: boolean
  filterExpression?: string
  filterValues?: Record<string, unknown>
}

/**
 * Request scope cache for relationship data
 */
export class RelationshipCache {
  private cache = new Map<string, JSObject | JSObject[]>()

  set(key: string, data: JSObject | JSObject[]): void {
    this.cache.set(key, data)
  }

  get(key: string): JSObject | JSObject[] | undefined {
    return this.cache.get(key)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

// ============================================================================
// Relationship Resolver Implementation
// ============================================================================

/**
 * Resolve a single relationship for a model instance
 */
export async function resolveRelationship(
  model: ParsedModel,
  instance: JSObject,
  relationshipName: string,
  registry: ModelRegistry,
  config: Config,
  queryBuilder: RelationshipQueryBuilder,
  cache?: RelationshipCache,
): Promise<ResolvedRelationship> {
  const relationship = model.relationships.find(r => r.relatedModel === relationshipName)

  if (!relationship) {
    return {
      name: relationshipName,
      type: 'hasOne',
      data: null,
      loaded: false,
    }
  }

  const relatedModel = registry.models.get(relationship.relatedModel)
  if (!relatedModel) {
    return {
      name: relationshipName,
      type: relationship.type,
      data: null,
      loaded: false,
    }
  }

  const cacheKey = `${model.name}:${instance[model.primaryKey]}:${relationshipName}`

  // Check cache
  if (cache?.has(cacheKey)) {
    const cachedData = cache.get(cacheKey)
    return {
      name: relationshipName,
      type: relationship.type,
      data: cachedData ?? null,
      loaded: true,
    }
  }

  const delimiter = config.singleTableDesign.keyDelimiter
  const tableName = `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`
  let data: JSObject | JSObject[] | null = null

  switch (relationship.type) {
    case 'hasOne': {
      // Get single related item
      // In single-table design, hasOne might be stored in the same partition
      const pk = `${model.entityType}${delimiter}${instance[model.primaryKey]}`
      const sk = `${relatedModel.entityType}${delimiter}`

      const items = await queryBuilder.query(tableName, {
        keyCondition: 'pk = :pk AND begins_with(sk, :sk)',
        keyValues: { ':pk': pk, ':sk': sk },
        limit: 1,
      })

      if (items.length > 0) {
        const result = toModelInstance(relatedModel, items[0], config)
        data = result.data
      }
      break
    }

    case 'hasMany': {
      // Get all related items using pk/sk pattern
      const pk = `${model.entityType}${delimiter}${instance[model.primaryKey]}`
      const sk = `${relatedModel.entityType}${delimiter}`

      const items = await queryBuilder.query(tableName, {
        keyCondition: 'pk = :pk AND begins_with(sk, :sk)',
        keyValues: { ':pk': pk, ':sk': sk },
      })

      data = items.map(item => toModelInstance(relatedModel, item, config).data)
      break
    }

    case 'belongsTo': {
      // Get parent item
      const foreignKeyValue = instance[relationship.foreignKey]
      if (!foreignKeyValue) {
        data = null
        break
      }

      const pk = `${relatedModel.entityType}${delimiter}${foreignKeyValue}`
      const sk = pk // In single-table design, base entity has pk = sk

      const item = await queryBuilder.getItem(tableName, { pk, sk })
      if (item) {
        data = toModelInstance(relatedModel, item, config).data
      }
      break
    }

    case 'belongsToMany': {
      // Get related items through adjacency list pattern
      // First query the pivot items, then batch get the actual related items
      if (relationship.gsiIndex) {
        const gsiPkAttr = getGSIAttributeName(relationship.gsiIndex, 'pk', config)
        const pk = `${model.entityType}${delimiter}${instance[model.primaryKey]}`

        // Query the GSI for pivot items
        const pivotItems = await queryBuilder.query(tableName, {
          indexName: `GSI${relationship.gsiIndex}`,
          keyCondition: `${gsiPkAttr} = :pk`,
          keyValues: { ':pk': pk },
        })

        if (pivotItems.length > 0) {
          // Extract related entity IDs from pivot items
          const relatedKeys = pivotItems.map((item) => {
            const sk = (item[config.singleTableDesign.sortKeyName] as { S: string })?.S ?? ''
            // Extract ID from sk pattern like "ROLE#123"
            const parts = sk.split(delimiter)
            const id = parts[1]
            return {
              pk: `${relatedModel.entityType}${delimiter}${id}`,
              sk: `${relatedModel.entityType}${delimiter}${id}`,
            }
          })

          // Batch get the actual related items
          const relatedItems = await queryBuilder.batchGet(tableName, relatedKeys)
          data = relatedItems.map(item => toModelInstance(relatedModel, item, config).data)
        }
        else {
          data = []
        }
      }
      break
    }
  }

  // Cache the result
  if (cache && data !== null) {
    cache.set(cacheKey, data)
  }

  return {
    name: relationshipName,
    type: relationship.type,
    data,
    loaded: true,
  }
}

/**
 * Eagerly load multiple relationships for a model instance
 */
export async function eagerLoad(
  model: ParsedModel,
  instance: JSObject,
  specs: EagerLoadSpec[],
  registry: ModelRegistry,
  config: Config,
  queryBuilder: RelationshipQueryBuilder,
  cache?: RelationshipCache,
): Promise<JSObject> {
  const result = { ...instance }
  const requestCache = cache ?? new RelationshipCache()

  for (const spec of specs) {
    const resolved = await resolveRelationship(
      model,
      instance,
      spec.relationship,
      registry,
      config,
      queryBuilder,
      requestCache,
    )

    if (resolved.loaded && resolved.data !== null) {
      result[spec.relationship] = resolved.data

      // Handle nested eager loading
      if (spec.nested && spec.nested.length > 0 && resolved.data) {
        const relatedModel = registry.models.get(spec.relationship)
        if (relatedModel) {
          if (Array.isArray(resolved.data)) {
            // Load nested for each item
            result[spec.relationship] = await Promise.all(
              resolved.data.map(item =>
                eagerLoad(relatedModel, item, spec.nested!, registry, config, queryBuilder, requestCache),
              ),
            )
          }
          else {
            // Load nested for single item
            result[spec.relationship] = await eagerLoad(
              relatedModel,
              resolved.data,
              spec.nested,
              registry,
              config,
              queryBuilder,
              requestCache,
            )
          }
        }
      }
    }
  }

  return result
}

/**
 * Eagerly load relationships for multiple instances (batch optimization)
 */
export async function eagerLoadMany(
  model: ParsedModel,
  instances: JSObject[],
  specs: EagerLoadSpec[],
  registry: ModelRegistry,
  config: Config,
  queryBuilder: RelationshipQueryBuilder,
): Promise<JSObject[]> {
  if (instances.length === 0) return []

  const cache = new RelationshipCache()

  // Group instances by their foreign keys for batch loading
  for (const spec of specs) {
    const relationship = model.relationships.find(r => r.relatedModel === spec.relationship)
    if (!relationship) continue

    const relatedModel = registry.models.get(relationship.relatedModel)
    if (!relatedModel) continue

    // Pre-fetch related data for all instances
    await prefetchRelationshipData(
      model,
      instances,
      relationship,
      relatedModel,
      registry,
      config,
      queryBuilder,
      cache,
    )
  }

  // Now load each instance with the cached data
  return Promise.all(
    instances.map(instance =>
      eagerLoad(model, instance, specs, registry, config, queryBuilder, cache),
    ),
  )
}

/**
 * Prefetch relationship data for multiple instances
 */
async function prefetchRelationshipData(
  model: ParsedModel,
  instances: JSObject[],
  relationship: ParsedRelationship,
  relatedModel: ParsedModel,
  registry: ModelRegistry,
  config: Config,
  queryBuilder: RelationshipQueryBuilder,
  cache: RelationshipCache,
): Promise<void> {
  const delimiter = config.singleTableDesign.keyDelimiter
  const tableName = `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

  switch (relationship.type) {
    case 'belongsTo': {
      // Collect all unique foreign key values
      const foreignKeys = new Set<string>()
      for (const instance of instances) {
        const fk = instance[relationship.foreignKey]
        if (fk) foreignKeys.add(String(fk))
      }

      if (foreignKeys.size > 0) {
        // Batch get all parent items
        const keys = Array.from(foreignKeys).map(fk => ({
          pk: `${relatedModel.entityType}${delimiter}${fk}`,
          sk: `${relatedModel.entityType}${delimiter}${fk}`,
        }))

        const items = await queryBuilder.batchGet(tableName, keys)

        // Cache each result
        for (const item of items) {
          const pk = (item[config.singleTableDesign.partitionKeyName] as { S: string })?.S ?? ''
          const id = pk.split(delimiter)[1]
          const data = toModelInstance(relatedModel, item, config).data

          // Cache for each instance that references this parent
          for (const instance of instances) {
            if (String(instance[relationship.foreignKey]) === id) {
              cache.set(`${model.name}:${instance[model.primaryKey]}:${relationship.relatedModel}`, data)
            }
          }
        }
      }
      break
    }

    case 'hasMany': {
      // For hasMany, we need to query each parent's children
      // This can be optimized with parallel queries
      const queries = instances.map(async (instance) => {
        const pk = `${model.entityType}${delimiter}${instance[model.primaryKey]}`
        const sk = `${relatedModel.entityType}${delimiter}`

        const items = await queryBuilder.query(tableName, {
          keyCondition: 'pk = :pk AND begins_with(sk, :sk)',
          keyValues: { ':pk': pk, ':sk': sk },
        })

        const data = items.map(item => toModelInstance(relatedModel, item, config).data)
        cache.set(`${model.name}:${instance[model.primaryKey]}:${relationship.relatedModel}`, data)
      })

      await Promise.all(queries)
      break
    }
  }
}

/**
 * Get relationship count without loading full data
 */
export async function getRelationshipCount(
  model: ParsedModel,
  instance: JSObject,
  relationshipName: string,
  registry: ModelRegistry,
  config: Config,
  queryBuilder: RelationshipQueryBuilder,
): Promise<number> {
  const relationship = model.relationships.find(r => r.relatedModel === relationshipName)
  if (!relationship) return 0

  const relatedModel = registry.models.get(relationship.relatedModel)
  if (!relatedModel) return 0

  const delimiter = config.singleTableDesign.keyDelimiter
  const tableName = `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

  switch (relationship.type) {
    case 'hasMany':
    case 'hasOne': {
      const pk = `${model.entityType}${delimiter}${instance[model.primaryKey]}`
      const sk = `${relatedModel.entityType}${delimiter}`

      // Query with Select: 'COUNT' would be ideal, but we simulate with limit
      const items = await queryBuilder.query(tableName, {
        keyCondition: 'pk = :pk AND begins_with(sk, :sk)',
        keyValues: { ':pk': pk, ':sk': sk },
      })

      return items.length
    }

    default:
      return 0
  }
}

/**
 * Check if a relationship exists
 */
export async function hasRelationship(
  model: ParsedModel,
  instance: JSObject,
  relationshipName: string,
  registry: ModelRegistry,
  config: Config,
  queryBuilder: RelationshipQueryBuilder,
): Promise<boolean> {
  const count = await getRelationshipCount(
    model,
    instance,
    relationshipName,
    registry,
    config,
    queryBuilder,
  )
  return count > 0
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
