// ============================================================================
// DynamoDB Model Implementation
// ============================================================================

import type { ModelRegistry, ModelTraits, ParsedAttribute, ParsedModel, ParsedRelationship } from '../model-parser/types'
import type { DynamoDBItem, JSObject } from '../single-table/EntityTransformer'
import type { EagerLoadSpec, RelationshipQueryBuilder } from '../single-table/RelationshipResolver'
import type { Config } from '../types'
import type {
  ModelAttribute,
  ModelHookType,
  ModelRelationship,
  QueryResult,
  SortDirection,
  WhereCondition,
  WhereOperator,
} from './types'
import { getConfig } from '../config'
import {
  buildUpdateData,
  marshallObject,
  marshallValue,
  toDynamoDBItem,
  toModelInstance,
} from '../single-table/EntityTransformer'
import {
  eagerLoadMany,
  resolveRelationship,
} from '../single-table/RelationshipResolver'
import { ModelNotFoundError } from './types'

// Re-export types for test files
export type { ModelAttribute, ModelRelationship } from './types'

// ============================================================================
// DynamoDB Model Types
// ============================================================================

/**
 * Model constructor type for DynamoDBModel
 */
export type DynamoDBModelConstructor<T extends DynamoDBModel = DynamoDBModel> = new (attributes?: JSObject) => T

/**
 * DynamoDB Model hook callback
 */
export type DynamoDBModelHook<T extends DynamoDBModel = DynamoDBModel> = (model: T) => void | Promise<void> | boolean | Promise<boolean>

/**
 * DynamoDB Model scope function
 */
export type DynamoDBModelScope<T extends DynamoDBModel = DynamoDBModel> = (query: DynamoDBQueryBuilder<T>, ...args: unknown[]) => DynamoDBQueryBuilder<T>

/**
 * DynamoDB Cast definition for attribute type casting
 */
export interface DynamoDBCastDefinition {
  get?: (value: unknown, key: string, model: DynamoDBModel) => unknown
  set?: (value: unknown, key: string, model: DynamoDBModel) => unknown
}

// ============================================================================
// DynamoDB Client Interface
// ============================================================================

/**
 * DynamoDB client interface for model operations
 * This abstracts the actual DynamoDB client so models work with any client implementation
 */
export interface DynamoDBClient {
  getItem: (tableName: string, key: Record<string, DynamoDBItem[string]>) => Promise<DynamoDBItem | null>
  putItem: (tableName: string, item: DynamoDBItem, options?: PutItemOptions) => Promise<void>
  updateItem: (tableName: string, key: Record<string, DynamoDBItem[string]>, updates: DynamoDBItem, options?: UpdateItemOptions) => Promise<DynamoDBItem | null>
  deleteItem: (tableName: string, key: Record<string, DynamoDBItem[string]>, options?: DeleteItemOptions) => Promise<void>
  query: (tableName: string, params: QueryParameters) => Promise<QueryResponse>
  scan: (tableName: string, params?: ScanParameters) => Promise<QueryResponse>
  batchGetItem: (tableName: string, keys: Array<Record<string, DynamoDBItem[string]>>) => Promise<DynamoDBItem[]>
  batchWriteItem: (tableName: string, operations: BatchWriteOperation[]) => Promise<void>
  transactWriteItems: (operations: TransactWriteOperation[]) => Promise<void>
}

export interface PutItemOptions {
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, DynamoDBItem[string]>
  returnValues?: 'NONE' | 'ALL_OLD'
}

export interface UpdateItemOptions {
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, DynamoDBItem[string]>
  returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW'
}

export interface DeleteItemOptions {
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, DynamoDBItem[string]>
}

export interface QueryParameters {
  indexName?: string
  keyConditionExpression: string
  filterExpression?: string
  projectionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, DynamoDBItem[string]>
  limit?: number
  scanIndexForward?: boolean
  exclusiveStartKey?: Record<string, DynamoDBItem[string]>
  consistentRead?: boolean
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
}

export interface ScanParameters {
  filterExpression?: string
  projectionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, DynamoDBItem[string]>
  limit?: number
  exclusiveStartKey?: Record<string, DynamoDBItem[string]>
  consistentRead?: boolean
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
}

export interface QueryResponse {
  items: DynamoDBItem[]
  count: number
  lastEvaluatedKey?: Record<string, DynamoDBItem[string]>
  consumedCapacity?: {
    tableName: string
    capacityUnits: number
    readCapacityUnits?: number
    writeCapacityUnits?: number
  }
}

export interface BatchWriteOperation {
  type: 'put' | 'delete'
  item?: DynamoDBItem
  key?: Record<string, DynamoDBItem[string]>
}

export interface TransactWriteOperation {
  type: 'put' | 'update' | 'delete' | 'conditionCheck'
  tableName: string
  item?: DynamoDBItem
  key?: Record<string, DynamoDBItem[string]>
  updateExpression?: string
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, DynamoDBItem[string]>
}

// ============================================================================
// Model Registry and Client Storage
// ============================================================================

let globalClient: DynamoDBClient | null = null
let globalRegistry: ModelRegistry | null = null
let globalConfig: Config | null = null

/**
 * Set the global DynamoDB client for all models
 */
export function setModelClient(client: DynamoDBClient): void {
  globalClient = client
}

/**
 * Get the global DynamoDB client
 */
export function getModelClient(): DynamoDBClient {
  if (!globalClient) {
    throw new Error('DynamoDB client not configured. Call setModelClient() first.')
  }
  return globalClient
}

/**
 * Set the global model registry for the ORM
 */
export function setOrmModelRegistry(registry: ModelRegistry): void {
  globalRegistry = registry
}

/**
 * Get the global model registry for the ORM
 */
export function getOrmModelRegistry(): ModelRegistry {
  if (!globalRegistry) {
    throw new Error('Model registry not configured. Call setOrmModelRegistry() first.')
  }
  return globalRegistry
}

/**
 * Set the global config
 */
export function setModelConfig(config: Config): void {
  globalConfig = config
}

/**
 * Get the global config
 */
export async function getModelConfig(): Promise<Config> {
  if (!globalConfig) {
    globalConfig = await getConfig()
  }
  return globalConfig
}

// ============================================================================
// DynamoDBModel Base Class
// ============================================================================

/**
 * Base DynamoDB Model class implementing Laravel/Eloquent-style ORM patterns
 * for DynamoDB with single-table design.
 *
 * This is a standalone implementation optimized for DynamoDB single-table design,
 * providing a Laravel/Eloquent-like API for DynamoDB operations.
 */
export abstract class DynamoDBModel {
  // ---- Static Configuration ----
  static table: string = ''
  static primaryKey: string = 'id'
  static pkPrefix: string = ''
  static skPrefix: string = ''
  static timestamps: boolean = true
  static softDeletes: boolean = false
  static versioning: boolean = false
  static uuid: boolean = false
  static ttl: boolean = false
  static connection?: string

  // ---- Instance Properties ----
  /** @internal */
  _attributes: JSObject = {}
  protected _original: JSObject = {}
  /** @internal */
  _relations: Map<string, DynamoDBModel | DynamoDBModel[] | null> = new Map()
  /** @internal */
  _exists: boolean = false
  protected _wasRecentlyCreated: boolean = false
  protected _trashed: boolean = false

  // ---- Static Hooks Registry ----
  private static _hooks: Map<string, Map<ModelHookType, DynamoDBModelHook[]>> = new Map()
  /** @internal */
  static _globalScopes: Map<string, Map<string, DynamoDBModelScope>> = new Map()
  private static _casts: Map<string, Map<string, string | DynamoDBCastDefinition>> = new Map()

  // ---- Abstract Properties (to be defined by concrete models) ----
  abstract get attributes(): Record<string, ModelAttribute>
  abstract get relationships(): Record<string, ModelRelationship>

  // ---- Constructor ----
  constructor(attributes?: JSObject) {
    if (attributes) {
      this.fill(attributes)
    }
  }

  // ============================================================================
  // Attribute Access Methods
  // ============================================================================

  /**
   * Get an attribute value
   */
  getAttribute(key: string): unknown {
    return this._attributes[key]
  }

  /**
   * Set an attribute value
   */
  setAttribute(key: string, value: unknown): this {
    this._attributes[key] = value
    return this
  }

  /**
   * Fill model with attributes
   */
  fill(attributes: JSObject): this {
    for (const [key, value] of Object.entries(attributes)) {
      this.setAttribute(key, value)
    }
    return this
  }

  // ============================================================================
  // Dirty Tracking Methods
  // ============================================================================

  /**
   * Check if a specific attribute or any attribute is dirty
   */
  isDirty(key?: string): boolean {
    if (key) {
      return this._attributes[key] !== this._original[key]
    }
    return Object.keys(this._attributes).some(k => this._attributes[k] !== this._original[k])
  }

  /**
   * Check if a specific attribute or all attributes are clean
   */
  isClean(key?: string): boolean {
    return !this.isDirty(key)
  }

  /**
   * Get all dirty attributes
   */
  getDirty(): JSObject {
    const dirty: JSObject = {}
    for (const [key, value] of Object.entries(this._attributes)) {
      if (value !== this._original[key]) {
        dirty[key] = value
      }
    }
    return dirty
  }

  /**
   * Get original attribute value(s)
   */
  getOriginal(key?: string): unknown | JSObject {
    if (key) {
      return this._original[key]
    }
    return { ...this._original }
  }

  /**
   * Sync original state with current attributes
   */
  syncOriginal(): this {
    this._original = { ...this._attributes }
    return this
  }

  // ============================================================================
  // Existence Properties
  // ============================================================================

  /**
   * Check if the model exists in the database
   */
  get exists(): boolean {
    return this._exists
  }

  /**
   * Check if the model was recently created
   */
  get wasRecentlyCreated(): boolean {
    return this._wasRecentlyCreated
  }

  // ============================================================================
  // Serialization Methods
  // ============================================================================

  /**
   * Convert model to JSON object (respects hidden attributes)
   */
  toJSON(): JSObject {
    const result: JSObject = {}
    const hidden = this.getEffectiveHiddenAttributes()

    for (const [key, value] of Object.entries(this._attributes)) {
      if (!hidden.includes(key)) {
        result[key] = this.getCastAttribute(key, value)
      }
    }

    // Include loaded relationships
    for (const [name, relation] of this._relations) {
      if (relation !== null) {
        if (Array.isArray(relation)) {
          result[name] = relation.map(r => r.toJSON())
        }
        else {
          result[name] = relation.toJSON()
        }
      }
    }

    return result
  }

  /**
   * Convert model to array (alias for toJSON)
   */
  toArray(): JSObject {
    return this.toJSON()
  }

  /**
   * Get only specified attributes
   */
  only(...keys: string[]): JSObject {
    const result: JSObject = {}
    for (const key of keys) {
      if (key in this._attributes) {
        result[key] = this._attributes[key]
      }
    }
    return result
  }

  /**
   * Get all attributes except specified ones
   */
  except(...keys: string[]): JSObject {
    const result: JSObject = {}
    for (const [key, value] of Object.entries(this._attributes)) {
      if (!keys.includes(key)) {
        result[key] = value
      }
    }
    return result
  }

  /**
   * Clone the model
   */
  replicate(): DynamoDBModel {
    const Constructor = this.constructor as DynamoDBModelConstructor
    const clone = new Constructor(this._attributes)
    return clone
  }

  // ============================================================================
  // Helper Methods for Serialization
  // ============================================================================

  /**
   * Get hidden attributes from model definition
   */
  protected getHiddenAttributes(): string[] {
    const hidden: string[] = []
    for (const [name, attr] of Object.entries(this.attributes)) {
      if (attr.hidden) {
        hidden.push(name)
      }
    }
    return hidden
  }

  /**
   * Get fillable attributes from model definition
   */
  protected getFillableAttributes(): string[] {
    const fillable: string[] = []
    for (const [name, attr] of Object.entries(this.attributes)) {
      if (attr.fillable !== false && attr.guarded !== true) {
        fillable.push(name)
      }
    }
    return fillable
  }

  /**
   * Get guarded attributes from model definition
   */
  protected getGuardedAttributes(): string[] {
    const guarded: string[] = []
    for (const [name, attr] of Object.entries(this.attributes)) {
      if (attr.guarded === true) {
        guarded.push(name)
      }
    }
    return guarded
  }

  /**
   * Get effective hidden attributes (considering overrides)
   */
  private getEffectiveHiddenAttributes(): string[] {
    const hidden = this.getHiddenAttributes()
    const visibleOverrides = (this as unknown as { _visibleOverrides?: string[] })._visibleOverrides ?? []
    const hiddenOverrides = (this as unknown as { _hiddenOverrides?: string[] })._hiddenOverrides ?? []

    return [
      ...hidden.filter(h => !visibleOverrides.includes(h)),
      ...hiddenOverrides,
    ]
  }

  /**
   * Make hidden attributes visible temporarily
   */
  makeVisible(...keys: string[]): this {
    const visibleOverrides = (this as unknown as { _visibleOverrides?: string[] })._visibleOverrides ?? []
    ;(this as unknown as { _visibleOverrides: string[] })._visibleOverrides = [...visibleOverrides, ...keys]
    return this
  }

  /**
   * Make attributes hidden temporarily
   */
  makeHidden(...keys: string[]): this {
    const hiddenOverrides = (this as unknown as { _hiddenOverrides?: string[] })._hiddenOverrides ?? []
    ;(this as unknown as { _hiddenOverrides: string[] })._hiddenOverrides = [...hiddenOverrides, ...keys]
    return this
  }

  /**
   * Check if the model was changed after the last save
   */
  wasChanged(key?: string): boolean {
    return this.isDirty(key)
  }

  /**
   * Get the changes made after last save
   */
  getChanges(): JSObject {
    return this.getDirty()
  }

  // ============================================================================
  // Static Query Methods
  // ============================================================================

  /**
   * Create a new query builder for this model
   */
  static query<T extends DynamoDBModel>(this: DynamoDBModelConstructor<T>): DynamoDBQueryBuilder<T> {
    return new DynamoDBQueryBuilder<T>(this)
  }

  /**
   * Find a model by its primary key
   */
  static async find<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    pk: string | number,
    sk?: string | number,
  ): Promise<T | null> {
    const query = new DynamoDBQueryBuilder<T>(this)
    return query.find(pk, sk)
  }

  /**
   * Find a model by its primary key or throw
   */
  static async findOrFail<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    pk: string | number,
    sk?: string | number,
  ): Promise<T> {
    const query = new DynamoDBQueryBuilder<T>(this)
    return query.findOrFail(pk, sk)
  }

  /**
   * Find multiple models by their keys
   */
  static async findMany<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    keys: Array<{ pk: string | number, sk?: string | number }>,
  ): Promise<T[]> {
    const query = new DynamoDBQueryBuilder<T>(this)
    return query.findMany(keys)
  }

  /**
   * Create a new model instance and persist it
   */
  static async create<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    attributes: JSObject,
  ): Promise<T> {
    const model = new this(attributes)
    await model.save()
    return model
  }

  /**
   * Get all models of this type
   */
  static async all<T extends DynamoDBModel>(this: DynamoDBModelConstructor<T>): Promise<T[]> {
    const query = new DynamoDBQueryBuilder<T>(this)
    return query.get()
  }

  /**
   * Start a where query
   */
  static where<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    key: string | Record<string, unknown>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown,
  ): DynamoDBQueryBuilder<T> {
    const query = new DynamoDBQueryBuilder<T>(this)
    if (typeof key === 'object') {
      return query.where(key)
    }
    if (value === undefined) {
      return query.where(key, operatorOrValue as unknown)
    }
    return query.where(key, operatorOrValue as WhereOperator, value)
  }

  // ============================================================================
  // Instance CRUD Methods
  // ============================================================================

  /**
   * Save the model (insert or update)
   */
  async save(): Promise<boolean> {
    const config = await getModelConfig()
    const client = getModelClient()

    // Run saving hooks
    if (await this.runHooks('saving') === false)
      return false

    if (this._exists) {
      // Update existing
      if (await this.runHooks('updating') === false)
        return false

      const { changes, hasChanges } = buildUpdateData(
        this.getParsedModel(),
        this._original,
        this._attributes,
        config,
      )

      if (hasChanges) {
        const keys = this.getKeys(config)
        const tableName = this.getTableName(config)

        // Build update expression
        const updateExpression = this.buildUpdateExpression(changes, config)
        const marshalledKey = {
          [config.singleTableDesign.partitionKeyName]: marshallValue(keys.pk)!,
          [config.singleTableDesign.sortKeyName]: marshallValue(keys.sk)!,
        }

        const result = await client.updateItem(
          tableName,
          marshalledKey,
          marshallObject(changes),
          {
            returnValues: 'ALL_NEW',
            ...(this.getVersionCondition(config)),
          },
        )

        if (result) {
          const transformed = toModelInstance(this.getParsedModel(), result, config)
          this._attributes = transformed.data
        }

        this.syncOriginal()
      }

      await this.runHooks('updated')
    }
    else {
      // Insert new
      if (await this.runHooks('creating') === false)
        return false

      // Generate ID if using UUID
      if ((this.constructor as typeof DynamoDBModel).uuid && !this._attributes[this.getPrimaryKeyName()]) {
        this._attributes[this.getPrimaryKeyName()] = crypto.randomUUID()
      }

      const transformed = toDynamoDBItem(
        this.getParsedModel(),
        this._attributes,
        config,
      )

      const tableName = this.getTableName(config)

      await client.putItem(tableName, transformed.data, {
        conditionExpression: 'attribute_not_exists(pk)', // Prevent overwrite
      })

      this._exists = true
      this._wasRecentlyCreated = true
      this.syncOriginal()

      await this.runHooks('created')
    }

    await this.runHooks('saved')
    return true
  }

  /**
   * Update the model with new attributes
   */
  async update(attributes: JSObject): Promise<boolean> {
    this.fill(attributes)
    return this.save()
  }

  /**
   * Delete the model
   */
  async delete(): Promise<boolean> {
    if (!this._exists)
      return false

    const config = await getModelConfig()
    const client = getModelClient()

    // Check for soft deletes
    if ((this.constructor as typeof DynamoDBModel).softDeletes) {
      return this.softDelete()
    }

    if (await this.runHooks('deleting') === false)
      return false

    const keys = this.getKeys(config)
    const tableName = this.getTableName(config)

    const marshalledKey = {
      [config.singleTableDesign.partitionKeyName]: marshallValue(keys.pk)!,
      [config.singleTableDesign.sortKeyName]: marshallValue(keys.sk)!,
    }

    await client.deleteItem(tableName, marshalledKey)

    this._exists = false
    await this.runHooks('deleted')

    return true
  }

  /**
   * Soft delete the model
   */
  private async softDelete(): Promise<boolean> {
    const config = await getModelConfig()

    if (await this.runHooks('deleting') === false)
      return false

    this._attributes[config.queryBuilder.softDeletes.attribute] = new Date().toISOString()
    this._trashed = true

    await this.save()
    await this.runHooks('deleted')

    return true
  }

  /**
   * Force delete the model (bypass soft deletes)
   */
  async forceDelete(): Promise<boolean> {
    if (!this._exists)
      return false

    const config = await getModelConfig()
    const client = getModelClient()

    if (await this.runHooks('forceDeleting') === false)
      return false

    const keys = this.getKeys(config)
    const tableName = this.getTableName(config)

    const marshalledKey = {
      [config.singleTableDesign.partitionKeyName]: marshallValue(keys.pk)!,
      [config.singleTableDesign.sortKeyName]: marshallValue(keys.sk)!,
    }

    await client.deleteItem(tableName, marshalledKey)

    this._exists = false
    await this.runHooks('forceDeleted')

    return true
  }

  /**
   * Restore a soft-deleted model
   */
  async restore(): Promise<boolean> {
    if (!(this.constructor as typeof DynamoDBModel).softDeletes)
      return false

    const config = await getModelConfig()

    if (await this.runHooks('restoring') === false)
      return false

    this._attributes[config.queryBuilder.softDeletes.attribute] = null
    this._trashed = false

    await this.save()
    await this.runHooks('restored')

    return true
  }

  /**
   * Refresh the model from the database
   */
  async refresh(): Promise<this> {
    if (!this._exists)
      return this

    const config = await getModelConfig()
    const client = getModelClient()

    const keys = this.getKeys(config)
    const tableName = this.getTableName(config)

    const marshalledKey = {
      [config.singleTableDesign.partitionKeyName]: marshallValue(keys.pk)!,
      [config.singleTableDesign.sortKeyName]: marshallValue(keys.sk)!,
    }

    const item = await client.getItem(tableName, marshalledKey)

    if (item) {
      const transformed = toModelInstance(this.getParsedModel(), item, config)
      this._attributes = transformed.data
      this.syncOriginal()
    }

    return this
  }

  // ============================================================================
  // Relationship Methods
  // ============================================================================

  /**
   * Define a hasOne relationship
   */
  protected hasOne<T extends DynamoDBModel>(
    related: DynamoDBModelConstructor<T>,
    foreignKey?: string,
    localKey?: string,
  ): Promise<T | null> {
    return this.loadRelationship(related, 'hasOne', foreignKey, localKey) as Promise<T | null>
  }

  /**
   * Define a hasMany relationship
   */
  protected hasMany<T extends DynamoDBModel>(
    related: DynamoDBModelConstructor<T>,
    foreignKey?: string,
    localKey?: string,
  ): Promise<T[]> {
    return this.loadRelationship(related, 'hasMany', foreignKey, localKey) as Promise<T[]>
  }

  /**
   * Define a belongsTo relationship
   */
  protected belongsTo<T extends DynamoDBModel>(
    related: DynamoDBModelConstructor<T>,
    foreignKey?: string,
    ownerKey?: string,
  ): Promise<T | null> {
    return this.loadRelationship(related, 'belongsTo', foreignKey, ownerKey) as Promise<T | null>
  }

  /**
   * Define a belongsToMany relationship
   */
  protected belongsToMany<T extends DynamoDBModel>(
    related: DynamoDBModelConstructor<T>,
    pivotEntity?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
  ): Promise<T[]> {
    return this.loadRelationship(related, 'belongsToMany', foreignPivotKey, relatedPivotKey, pivotEntity) as Promise<T[]>
  }

  /**
   * Load a relationship
   */
  private async loadRelationship<T extends DynamoDBModel>(
    related: DynamoDBModelConstructor<T>,
    type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany',
    foreignKey?: string,
    localKey?: string,
    pivotEntity?: string,
  ): Promise<T | T[] | null> {
    const relationName = related.name

    // Check if already loaded
    if (this._relations.has(relationName)) {
      return this._relations.get(relationName) as T | T[] | null
    }

    const config = await getModelConfig()
    const registry = getOrmModelRegistry()

    const queryBuilder = this.createRelationshipQueryBuilder()

    const resolved = await resolveRelationship(
      this.getParsedModel(),
      this._attributes,
      relationName,
      registry,
      config,
      queryBuilder,
    )

    if (resolved.loaded && resolved.data) {
      // Convert JSObjects to model instances
      if (Array.isArray(resolved.data)) {
        const instances = resolved.data.map((data) => {
          const instance = new related(data)
          instance._exists = true
          instance.syncOriginal()
          return instance
        })
        this._relations.set(relationName, instances as unknown as DynamoDBModel[])
        return instances
      }
      else {
        const instance = new related(resolved.data)
        instance._exists = true
        instance.syncOriginal()
        this._relations.set(relationName, instance as unknown as DynamoDBModel)
        return instance
      }
    }

    return type === 'hasMany' || type === 'belongsToMany' ? [] : null
  }

  /**
   * Create a relationship query builder adapter
   * @internal
   */
  createRelationshipQueryBuilder(): RelationshipQueryBuilder {
    const client = getModelClient()

    return {
      getItem: async (tableName, key) => {
        return client.getItem(tableName, {
          pk: marshallValue(key.pk)!,
          sk: marshallValue(key.sk)!,
        })
      },
      query: async (tableName, params) => {
        const response = await client.query(tableName, {
          indexName: params.indexName,
          keyConditionExpression: params.keyCondition,
          expressionAttributeValues: Object.fromEntries(
            Object.entries(params.keyValues).map(([k, v]) => [k, marshallValue(v)!]),
          ),
          limit: params.limit,
          scanIndexForward: params.scanIndexForward,
        })
        return response.items
      },
      batchGet: async (tableName, keys) => {
        const marshalledKeys = keys.map(key => ({
          pk: marshallValue(key.pk)!,
          sk: marshallValue(key.sk)!,
        }))
        return client.batchGetItem(tableName, marshalledKeys)
      },
    }
  }

  // ============================================================================
  // Hook System
  // ============================================================================

  /**
   * Register a hook for this model
   */
  static addHook<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    event: ModelHookType,
    callback: DynamoDBModelHook<T>,
  ): void {
    const modelName = this.name
    if (!DynamoDBModel._hooks.has(modelName)) {
      DynamoDBModel._hooks.set(modelName, new Map())
    }

    const modelHooks = DynamoDBModel._hooks.get(modelName)!
    if (!modelHooks.has(event)) {
      modelHooks.set(event, [])
    }

    modelHooks.get(event)!.push(callback as DynamoDBModelHook)
  }

  /**
   * Run hooks for an event
   */
  protected async runHooks(event: ModelHookType): Promise<boolean> {
    const modelName = this.constructor.name
    const modelHooks = DynamoDBModel._hooks.get(modelName)

    if (!modelHooks)
      return true

    const hooks = modelHooks.get(event) ?? []

    for (const hook of hooks) {
      const result = await hook(this)
      if (result === false)
        return false
    }

    return true
  }

  // ============================================================================
  // Scope System
  // ============================================================================

  /**
   * Register a global scope for this model
   */
  static addGlobalScope<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    name: string,
    scope: DynamoDBModelScope<T>,
  ): void {
    const modelName = this.name
    if (!DynamoDBModel._globalScopes.has(modelName)) {
      DynamoDBModel._globalScopes.set(modelName, new Map())
    }

    DynamoDBModel._globalScopes.get(modelName)!.set(name, scope as unknown as DynamoDBModelScope)
  }

  /**
   * Get global scopes for a model
   */
  static getGlobalScopes<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
  ): Map<string, DynamoDBModelScope> {
    return DynamoDBModel._globalScopes.get(this.name) ?? new Map()
  }

  // ============================================================================
  // Cast System
  // ============================================================================

  /**
   * Register attribute casts for this model
   */
  static setCasts<T extends DynamoDBModel>(
    this: DynamoDBModelConstructor<T>,
    casts: Record<string, string | DynamoDBCastDefinition>,
  ): void {
    const modelName = this.name
    if (!DynamoDBModel._casts.has(modelName)) {
      DynamoDBModel._casts.set(modelName, new Map())
    }

    const modelCasts = DynamoDBModel._casts.get(modelName)!
    for (const [key, cast] of Object.entries(casts)) {
      modelCasts.set(key, cast)
    }
  }

  /**
   * Get a cast attribute value
   */
  protected getCastAttribute(key: string, value: unknown): unknown {
    const modelCasts = DynamoDBModel._casts.get(this.constructor.name)
    if (!modelCasts)
      return value

    const cast = modelCasts.get(key)
    if (!cast)
      return value

    if (typeof cast === 'string') {
      return this.castValue(value, cast)
    }

    if (cast.get) {
      return cast.get(value, key, this)
    }

    return value
  }

  /**
   * Set a cast attribute value
   */
  protected setCastAttribute(key: string, value: unknown): unknown {
    const modelCasts = DynamoDBModel._casts.get(this.constructor.name)
    if (!modelCasts)
      return value

    const cast = modelCasts.get(key)
    if (!cast)
      return value

    if (typeof cast === 'object' && cast.set) {
      return cast.set(value, key, this)
    }

    return value
  }

  /**
   * Cast a value to a type
   */
  private castValue(value: unknown, type: string): unknown {
    switch (type.toLowerCase()) {
      case 'int':
      case 'integer':
        return typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
      case 'float':
      case 'double':
      case 'number':
        return Number(value)
      case 'bool':
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1'
        }
        return Boolean(value)
      case 'string':
        return String(value)
      case 'date':
      case 'datetime':
        return value instanceof Date ? value : new Date(value as string | number)
      case 'json':
      case 'array':
      case 'object':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value)
          }
          catch {
            return value
          }
        }
        return value
      default:
        return value
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the table name for this model
   */
  protected getTableName(config: Config): string {
    return `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`
  }

  /**
   * Get the primary key name
   */
  protected getPrimaryKeyName(): string {
    return (this.constructor as typeof DynamoDBModel).primaryKey || 'id'
  }

  /**
   * Get the entity type for this model
   * @internal
   */
  getEntityType(): string {
    const modelClass = this.constructor as typeof DynamoDBModel
    return modelClass.pkPrefix || modelClass.name.toUpperCase()
  }

  /**
   * Get pk/sk keys for this model instance
   */
  protected getKeys(config: Config): { pk: string, sk: string } {
    const delimiter = config.singleTableDesign.keyDelimiter
    const entityType = this.getEntityType()
    const id = this._attributes[this.getPrimaryKeyName()]

    return {
      pk: `${entityType}${delimiter}${id}`,
      sk: `${entityType}${delimiter}${id}`,
    }
  }

  /**
   * Get the parsed model definition
   * @internal
   */
  getParsedModel(): ParsedModel {
    const modelClass = this.constructor as typeof DynamoDBModel
    const registry = getOrmModelRegistry()

    const parsedModel = registry.models.get(modelClass.name)
    if (!parsedModel) {
      // Create a minimal parsed model for models not in registry
      const attributes: ParsedAttribute[] = Object.entries(this.attributes).map(([name, attr]) => ({
        name,
        dynamoDbType: this.mapTypeToDynamoDB(attr.type ?? 'string') as 'S' | 'N' | 'B' | 'BOOL' | 'NULL' | 'M' | 'L' | 'SS' | 'NS' | 'BS',
        required: attr.required ?? false,
        unique: attr.unique ?? false,
        fillable: attr.fillable ?? true,
        nullable: true,
        hidden: attr.hidden ?? false,
        cast: attr.cast,
      }))

      const relationships: ParsedRelationship[] = Object.entries(this.relationships).map(([, rel]) => ({
        type: rel.type,
        relatedModel: typeof rel.model === 'string' ? rel.model : rel.model.name,
        foreignKey: rel.foreignKey ?? '',
        localKey: rel.localKey ?? this.getPrimaryKeyName(),
        requiresGsi: rel.type === 'belongsTo' || rel.type === 'belongsToMany',
      }))

      const traits: ModelTraits = {
        useTimestamps: modelClass.timestamps,
        useSoftDeletes: modelClass.softDeletes,
        useUuid: modelClass.uuid,
        useTtl: modelClass.ttl,
        useVersioning: modelClass.versioning,
      }

      return {
        name: modelClass.name,
        entityType: this.getEntityType(),
        primaryKey: this.getPrimaryKeyName(),
        attributes,
        relationships,
        keyPatterns: {
          pk: `${this.getEntityType()}#{${this.getPrimaryKeyName()}}`,
          sk: `${this.getEntityType()}#{${this.getPrimaryKeyName()}}`,
        },
        accessPatterns: [],
        hasTimestamps: modelClass.timestamps,
        hasSoftDeletes: modelClass.softDeletes,
        hasVersioning: modelClass.versioning,
        hasUuid: modelClass.uuid,
        hasTtl: modelClass.ttl,
        traits,
        original: {
          name: modelClass.name,
          table: modelClass.table,
          primaryKey: this.getPrimaryKeyName(),
          attributes: {},
          traits,
        },
      }
    }

    return parsedModel
  }

  /**
   * Map attribute type to DynamoDB type
   */
  private mapTypeToDynamoDB(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'S',
      number: 'N',
      boolean: 'BOOL',
      date: 'S',
      json: 'M',
      list: 'L',
      map: 'M',
      set: 'SS',
      binary: 'B',
    }
    return typeMap[type] ?? 'S'
  }

  /**
   * Build update expression from changes
   */
  private buildUpdateExpression(changes: JSObject, config: Config): string {
    const setParts: string[] = []

    for (const key of Object.keys(changes)) {
      setParts.push(`#${key} = :${key}`)
    }

    return `SET ${setParts.join(', ')}`
  }

  /**
   * Get version condition for optimistic locking
   */
  private getVersionCondition(config: Config): Partial<UpdateItemOptions> {
    if (!(this.constructor as typeof DynamoDBModel).versioning) {
      return {}
    }

    const versionAttr = config.queryBuilder.versionAttribute
    const currentVersion = this._original[versionAttr] as number | undefined

    if (currentVersion === undefined) {
      return {}
    }

    return {
      conditionExpression: `#v = :v`,
      expressionAttributeNames: { '#v': versionAttr },
      expressionAttributeValues: { ':v': marshallValue(currentVersion)! },
    }
  }

  /**
   * Check if model is trashed (soft deleted)
   */
  get trashed(): boolean {
    return this._trashed
  }
}

// ============================================================================
// Query Builder Implementation
// ============================================================================

/**
 * DynamoDB Query Builder with Laravel-style fluent API
 */
export class DynamoDBQueryBuilder<T extends DynamoDBModel> {
  private modelClass: DynamoDBModelConstructor<T>
  private _select: string[] = []
  private _where: WhereCondition[] = []
  private _orderBy: { key: string, direction: SortDirection }[] = []
  private _limit?: number
  private _indexName?: string
  private _with: EagerLoadSpec[] = []
  private _withCount: string[] = []
  private _withTrashed: boolean = false
  private _onlyTrashed: boolean = false
  private _withoutGlobalScopes: string[] = []
  private _consistentRead: boolean = false

  constructor(modelClass: DynamoDBModelConstructor<T>) {
    this.modelClass = modelClass
  }

  // ---- Selection ----

  select(...columns: string[]): this {
    this._select = columns
    return this
  }

  // ---- Conditions ----

  where(key: string, value: unknown): this
  where(key: string, operator: WhereOperator, value: unknown): this
  where(conditions: Record<string, unknown>): this
  where(
    keyOrConditions: string | Record<string, unknown>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown,
  ): this {
    if (typeof keyOrConditions === 'object') {
      for (const [k, v] of Object.entries(keyOrConditions)) {
        this._where.push({ key: k, operator: '=', value: v })
      }
    }
    else if (value === undefined) {
      this._where.push({ key: keyOrConditions, operator: '=', value: operatorOrValue })
    }
    else {
      this._where.push({ key: keyOrConditions, operator: operatorOrValue as WhereOperator, value })
    }
    return this
  }

  andWhere(key: string, value: unknown): this
  andWhere(key: string, operator: WhereOperator, value: unknown): this
  andWhere(key: string, operatorOrValue: WhereOperator | unknown, value?: unknown): this {
    return value === undefined
      ? this.where(key, operatorOrValue)
      : this.where(key, operatorOrValue as WhereOperator, value)
  }

  orWhere(key: string, value: unknown): this
  orWhere(key: string, operator: WhereOperator, value: unknown): this
  orWhere(key: string, operatorOrValue: WhereOperator | unknown, value?: unknown): this {
    // DynamoDB doesn't support OR in key conditions, only in filter expressions
    // We'll handle this in filter expression building
    return value === undefined
      ? this.where(key, operatorOrValue)
      : this.where(key, operatorOrValue as WhereOperator, value)
  }

  whereIn(key: string, values: unknown[]): this {
    this._where.push({ key, operator: 'in', value: values })
    return this
  }

  whereNotIn(key: string, values: unknown[]): this {
    // Handled as filter expression with NOT IN
    this._where.push({ key, operator: '!=', value: values })
    return this
  }

  whereBetween(key: string, min: unknown, max: unknown): this {
    this._where.push({ key, operator: 'between', value: min, secondValue: max })
    return this
  }

  whereNull(key: string): this {
    this._where.push({ key, operator: '=', value: null })
    return this
  }

  whereNotNull(key: string): this {
    this._where.push({ key, operator: '!=', value: null })
    return this
  }

  whereBeginsWith(key: string, prefix: string): this {
    this._where.push({ key, operator: 'begins_with', value: prefix })
    return this
  }

  whereContains(key: string, value: string): this {
    this._where.push({ key, operator: 'contains', value })
    return this
  }

  // ---- Soft Deletes ----

  withTrashed(): this {
    this._withTrashed = true
    return this
  }

  onlyTrashed(): this {
    this._onlyTrashed = true
    return this
  }

  // ---- Ordering ----

  orderBy(key: string, direction: SortDirection = 'asc'): this {
    this._orderBy.push({ key, direction })
    return this
  }

  orderByDesc(key: string): this {
    return this.orderBy(key, 'desc')
  }

  latest(key: string = 'createdAt'): this {
    return this.orderByDesc(key)
  }

  oldest(key: string = 'createdAt'): this {
    return this.orderBy(key, 'asc')
  }

  // ---- Limiting ----

  limit(count: number): this {
    this._limit = count
    return this
  }

  take(count: number): this {
    return this.limit(count)
  }

  // ---- Pagination ----

  async paginate(perPage: number = 15): Promise<QueryResult<T>> {
    this._limit = perPage
    const items = await this.get()
    return {
      items,
      count: items.length,
      // Note: lastEvaluatedKey would come from actual query response
    }
  }

  async cursorPaginate(cursor?: string, perPage: number = 15): Promise<QueryResult<T>> {
    this._limit = perPage
    // Parse cursor as base64 encoded LastEvaluatedKey
    const items = await this.get()
    return {
      items,
      count: items.length,
    }
  }

  // ---- Eager Loading ----

  with(...relationships: string[]): this {
    for (const rel of relationships) {
      const parts = rel.split('.')
      if (parts.length === 1) {
        this._with.push({ relationship: rel })
      }
      else {
        // Handle nested relationships
        this._with.push({
          relationship: parts[0],
          nested: [{ relationship: parts.slice(1).join('.') }],
        })
      }
    }
    return this
  }

  withCount(...relationships: string[]): this {
    this._withCount.push(...relationships)
    return this
  }

  // ---- Relationship Existence ----

  has(relationship: string): this {
    // Add filter for relationship existence
    return this
  }

  doesntHave(relationship: string): this {
    // Add filter for relationship non-existence
    return this
  }

  whereHas(relationship: string, callback?: (query: DynamoDBQueryBuilder<DynamoDBModel>) => void): this {
    // Apply callback constraints to relationship query
    return this
  }

  // ---- Scopes ----

  scope(name: string, ...args: unknown[]): this {
    const scopes = DynamoDBModel._globalScopes.get(this.modelClass.name) ?? new Map()
    const scope = scopes.get(name)
    if (scope) {
      scope(this as DynamoDBQueryBuilder<DynamoDBModel>, ...args)
    }
    return this
  }

  // ---- Index Selection ----

  useIndex(indexName: string): this {
    this._indexName = indexName
    return this
  }

  // ---- Execution ----

  async get(): Promise<T[]> {
    const config = await getModelConfig()
    const client = getModelClient()

    const tableName = this.getTableName(config)
    const modelInstance = new this.modelClass()
    const entityType = modelInstance.getEntityType()

    // Build query/scan parameters
    const { keyCondition, filterExpression, expressionAttributeNames, expressionAttributeValues }
      = this.buildExpressions(config, entityType)

    let items: DynamoDBItem[]

    if (keyCondition) {
      // Use Query
      const response = await client.query(tableName, {
        indexName: this._indexName,
        keyConditionExpression: keyCondition,
        filterExpression: filterExpression || undefined,
        expressionAttributeNames,
        expressionAttributeValues,
        limit: this._limit,
        scanIndexForward: this._orderBy[0]?.direction !== 'desc',
        consistentRead: this._consistentRead,
      })
      items = response.items
    }
    else {
      // Use Scan
      const response = await client.scan(tableName, {
        filterExpression: filterExpression || undefined,
        expressionAttributeNames,
        expressionAttributeValues,
        limit: this._limit,
        consistentRead: this._consistentRead,
      })
      items = response.items
    }

    // Transform to model instances
    const parsedModel = modelInstance.getParsedModel()
    let instances = items.map((item) => {
      const transformed = toModelInstance(parsedModel, item, config)
      const instance = new this.modelClass(transformed.data)
      ;(instance as DynamoDBModel)._exists = true
      ;(instance as DynamoDBModel).syncOriginal()
      return instance
    })

    // Apply eager loading
    if (this._with.length > 0) {
      const registry = getOrmModelRegistry()
      const queryBuilder = modelInstance.createRelationshipQueryBuilder()

      const loadedData = await eagerLoadMany(
        parsedModel,
        instances.map(i => i._attributes),
        this._with,
        registry,
        config,
        queryBuilder,
      )

      // Merge loaded relationships back into instances
      instances = instances.map((instance, index) => {
        const data = loadedData[index]
        for (const spec of this._with) {
          if (data[spec.relationship]) {
            (instance as DynamoDBModel)._relations.set(
              spec.relationship,
              data[spec.relationship] as DynamoDBModel | DynamoDBModel[],
            )
          }
        }
        return instance
      })
    }

    return instances
  }

  async first(): Promise<T | null> {
    this._limit = 1
    const results = await this.get()
    return results[0] ?? null
  }

  async firstOrFail(): Promise<T> {
    const result = await this.first()
    if (!result) {
      throw new ModelNotFoundError(this.modelClass.name, {})
    }
    return result
  }

  async find(pk: string | number, sk?: string | number): Promise<T | null> {
    const config = await getModelConfig()
    const client = getModelClient()

    const tableName = this.getTableName(config)
    const modelInstance = new this.modelClass()
    const entityType = modelInstance.getEntityType()
    const delimiter = config.singleTableDesign.keyDelimiter

    const pkValue = `${entityType}${delimiter}${pk}`
    const skValue = sk ? `${entityType}${delimiter}${sk}` : pkValue

    const marshalledKey = {
      [config.singleTableDesign.partitionKeyName]: marshallValue(pkValue)!,
      [config.singleTableDesign.sortKeyName]: marshallValue(skValue)!,
    }

    const item = await client.getItem(tableName, marshalledKey)

    if (!item)
      return null

    const parsedModel = modelInstance.getParsedModel()
    const transformed = toModelInstance(parsedModel, item, config)
    const instance = new this.modelClass(transformed.data)
    ;(instance as DynamoDBModel)._exists = true
    ;(instance as DynamoDBModel).syncOriginal()

    return instance
  }

  async findOrFail(pk: string | number, sk?: string | number): Promise<T> {
    const result = await this.find(pk, sk)
    if (!result) {
      throw new ModelNotFoundError(this.modelClass.name, { pk, sk })
    }
    return result
  }

  async findMany(keys: Array<{ pk: string | number, sk?: string | number }>): Promise<T[]> {
    const config = await getModelConfig()
    const client = getModelClient()

    const tableName = this.getTableName(config)
    const modelInstance = new this.modelClass()
    const entityType = modelInstance.getEntityType()
    const delimiter = config.singleTableDesign.keyDelimiter

    const marshalledKeys = keys.map((key) => {
      const pkValue = `${entityType}${delimiter}${key.pk}`
      const skValue = key.sk ? `${entityType}${delimiter}${key.sk}` : pkValue
      return {
        [config.singleTableDesign.partitionKeyName]: marshallValue(pkValue)!,
        [config.singleTableDesign.sortKeyName]: marshallValue(skValue)!,
      }
    })

    const items = await client.batchGetItem(tableName, marshalledKeys)

    const parsedModel = modelInstance.getParsedModel()
    return items.map((item) => {
      const transformed = toModelInstance(parsedModel, item, config)
      const instance = new this.modelClass(transformed.data)
      ;(instance as DynamoDBModel)._exists = true
      ;(instance as DynamoDBModel).syncOriginal()
      return instance
    })
  }

  async count(): Promise<number> {
    const config = await getModelConfig()
    const client = getModelClient()

    const tableName = this.getTableName(config)
    const modelInstance = new this.modelClass()
    const entityType = modelInstance.getEntityType()

    const { keyCondition, filterExpression, expressionAttributeNames, expressionAttributeValues }
      = this.buildExpressions(config, entityType)

    if (keyCondition) {
      const response = await client.query(tableName, {
        keyConditionExpression: keyCondition,
        filterExpression: filterExpression || undefined,
        expressionAttributeNames,
        expressionAttributeValues,
        select: 'COUNT',
      })
      return response.count
    }
    else {
      const response = await client.scan(tableName, {
        filterExpression: filterExpression || undefined,
        expressionAttributeNames,
        expressionAttributeValues,
        select: 'COUNT',
      })
      return response.count
    }
  }

  async exists(): Promise<boolean> {
    return (await this.count()) > 0
  }

  async doesntExist(): Promise<boolean> {
    return (await this.count()) === 0
  }

  // ---- Aggregations ----

  async sum(column: string): Promise<number> {
    const items = await this.get()
    return items.reduce((acc, item) => {
      const value = (item as DynamoDBModel)._attributes[column]
      return acc + (typeof value === 'number' ? value : 0)
    }, 0)
  }

  async avg(column: string): Promise<number> {
    const items = await this.get()
    if (items.length === 0)
      return 0
    const sum = await this.sum(column)
    return sum / items.length
  }

  async min(column: string): Promise<number | null> {
    const items = await this.get()
    if (items.length === 0)
      return null
    return Math.min(
      ...items.map((item) => {
        const value = (item as DynamoDBModel)._attributes[column]
        return typeof value === 'number' ? value : Infinity
      }),
    )
  }

  async max(column: string): Promise<number | null> {
    const items = await this.get()
    if (items.length === 0)
      return null
    return Math.max(
      ...items.map((item) => {
        const value = (item as DynamoDBModel)._attributes[column]
        return typeof value === 'number' ? value : -Infinity
      }),
    )
  }

  // ---- Mutations ----

  async insert(data: Partial<T>): Promise<T> {
    const model = new this.modelClass(data as JSObject)
    await model.save()
    return model
  }

  async insertMany(data: Array<Partial<T>>): Promise<T[]> {
    const config = await getModelConfig()
    const client = getModelClient()

    const modelInstance = new this.modelClass()
    const parsedModel = modelInstance.getParsedModel()
    const tableName = this.getTableName(config)

    // Transform all items
    const operations: BatchWriteOperation[] = data.map((item) => {
      const transformed = toDynamoDBItem(parsedModel, item as JSObject, config)
      return { type: 'put' as const, item: transformed.data }
    })

    // Batch write in chunks of 25
    for (let i = 0; i < operations.length; i += 25) {
      const chunk = operations.slice(i, i + 25)
      await client.batchWriteItem(tableName, chunk)
    }

    // Return model instances
    return data.map((item) => {
      const instance = new this.modelClass(item as JSObject)
      ;(instance as DynamoDBModel)._exists = true
      ;(instance as DynamoDBModel).syncOriginal()
      return instance
    })
  }

  async update(data: Partial<T>): Promise<number> {
    const items = await this.get()
    let count = 0

    for (const item of items) {
      await (item as DynamoDBModel).update(data as JSObject)
      count++
    }

    return count
  }

  async delete(): Promise<number> {
    const items = await this.get()
    let count = 0

    for (const item of items) {
      await (item as DynamoDBModel).delete()
      count++
    }

    return count
  }

  async forceDelete(): Promise<number> {
    const items = await this.get()
    let count = 0

    for (const item of items) {
      await (item as DynamoDBModel).forceDelete()
      count++
    }

    return count
  }

  // ---- Chunking ----

  async chunk(size: number, callback: (items: T[]) => void | Promise<void>): Promise<void> {
    const config = await getModelConfig()
    const client = getModelClient()

    const tableName = this.getTableName(config)
    const modelInstance = new this.modelClass()
    const entityType = modelInstance.getEntityType()
    const parsedModel = modelInstance.getParsedModel()

    const { keyCondition, filterExpression, expressionAttributeNames, expressionAttributeValues }
      = this.buildExpressions(config, entityType)

    let lastEvaluatedKey: Record<string, DynamoDBItem[string]> | undefined

    do {
      const response = keyCondition
        ? await client.query(tableName, {
          keyConditionExpression: keyCondition,
          filterExpression: filterExpression || undefined,
          expressionAttributeNames,
          expressionAttributeValues,
          limit: size,
          exclusiveStartKey: lastEvaluatedKey,
        })
        : await client.scan(tableName, {
          filterExpression: filterExpression || undefined,
          expressionAttributeNames,
          expressionAttributeValues,
          limit: size,
          exclusiveStartKey: lastEvaluatedKey,
        })

      const instances = response.items.map((item) => {
        const transformed = toModelInstance(parsedModel, item, config)
        const instance = new this.modelClass(transformed.data)
        ;(instance as DynamoDBModel)._exists = true
        ;(instance as DynamoDBModel).syncOriginal()
        return instance
      })

      await callback(instances)
      lastEvaluatedKey = response.lastEvaluatedKey
    } while (lastEvaluatedKey)
  }

  async chunkById(size: number, callback: (items: T[]) => void | Promise<void>): Promise<void> {
    // Same as chunk for DynamoDB since we use cursor-based pagination
    return this.chunk(size, callback)
  }

  // ---- Raw Query Access ----

  toQuery(): { operation: string, params: Record<string, unknown> } {
    const config = globalConfig
    if (!config) {
      return { operation: 'unknown', params: {} }
    }

    const modelInstance = new this.modelClass()
    const entityType = modelInstance.getEntityType()

    const { keyCondition, filterExpression, expressionAttributeNames, expressionAttributeValues }
      = this.buildExpressions(config, entityType)

    return {
      operation: keyCondition ? 'query' : 'scan',
      params: {
        tableName: this.getTableName(config),
        indexName: this._indexName,
        keyConditionExpression: keyCondition,
        filterExpression,
        expressionAttributeNames,
        expressionAttributeValues,
        limit: this._limit,
      },
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getTableName(config: Config): string {
    return `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`
  }

  private buildExpressions(
    config: Config,
    entityType: string,
  ): {
      keyCondition: string | null
      filterExpression: string | null
      expressionAttributeNames: Record<string, string>
      expressionAttributeValues: Record<string, DynamoDBItem[string]>
    } {
    const names: Record<string, string> = {}
    const values: Record<string, DynamoDBItem[string]> = {}
    const keyParts: string[] = []
    const filterParts: string[] = []

    const pkName = config.singleTableDesign.partitionKeyName
    const skName = config.singleTableDesign.sortKeyName
    const etAttr = config.singleTableDesign.entityTypeAttribute

    // Always filter by entity type
    names['#et'] = etAttr
    values[':et'] = marshallValue(entityType.replace(config.singleTableDesign.keyDelimiter, ''))!
    filterParts.push('#et = :et')

    // Handle soft deletes
    const modelClass = this.modelClass as unknown as typeof DynamoDBModel
    if (modelClass.softDeletes && !this._withTrashed) {
      const deletedAtAttr = config.queryBuilder.softDeletes.attribute
      names['#da'] = deletedAtAttr

      if (this._onlyTrashed) {
        filterParts.push('attribute_exists(#da)')
      }
      else {
        filterParts.push('attribute_not_exists(#da)')
      }
    }

    // Process where conditions
    let valueIndex = 0
    for (const condition of this._where) {
      const nameKey = `#a${valueIndex}`
      const valueKey = `:v${valueIndex}`

      names[nameKey] = condition.key

      // Check if this is a key condition (pk or sk)
      if (condition.key === pkName || condition.key === 'pk') {
        values[valueKey] = marshallValue(condition.value)!
        keyParts.push(`${nameKey} = ${valueKey}`)
      }
      else if (condition.key === skName || condition.key === 'sk') {
        switch (condition.operator) {
          case 'begins_with':
            values[valueKey] = marshallValue(condition.value)!
            keyParts.push(`begins_with(${nameKey}, ${valueKey})`)
            break
          case 'between':
            values[`:v${valueIndex}a`] = marshallValue(condition.value)!
            values[`:v${valueIndex}b`] = marshallValue(condition.secondValue)!
            keyParts.push(`${nameKey} BETWEEN :v${valueIndex}a AND :v${valueIndex}b`)
            break
          default:
            values[valueKey] = marshallValue(condition.value)!
            keyParts.push(`${nameKey} ${condition.operator} ${valueKey}`)
        }
      }
      else {
        // Filter expression
        switch (condition.operator) {
          case 'begins_with':
            values[valueKey] = marshallValue(condition.value)!
            filterParts.push(`begins_with(${nameKey}, ${valueKey})`)
            break
          case 'contains':
            values[valueKey] = marshallValue(condition.value)!
            filterParts.push(`contains(${nameKey}, ${valueKey})`)
            break
          case 'between':
            values[`:v${valueIndex}a`] = marshallValue(condition.value)!
            values[`:v${valueIndex}b`] = marshallValue(condition.secondValue)!
            filterParts.push(`${nameKey} BETWEEN :v${valueIndex}a AND :v${valueIndex}b`)
            break
          case 'in':
            const inValues = condition.value as unknown[]
            const inKeys = inValues.map((v, i) => {
              const k = `:v${valueIndex}_${i}`
              values[k] = marshallValue(v)!
              return k
            })
            filterParts.push(`${nameKey} IN (${inKeys.join(', ')})`)
            break
          case '!=':
            if (condition.value === null) {
              filterParts.push(`attribute_exists(${nameKey})`)
            }
            else {
              values[valueKey] = marshallValue(condition.value)!
              filterParts.push(`${nameKey} <> ${valueKey}`)
            }
            break
          case '=':
            if (condition.value === null) {
              filterParts.push(`attribute_not_exists(${nameKey})`)
            }
            else {
              values[valueKey] = marshallValue(condition.value)!
              filterParts.push(`${nameKey} = ${valueKey}`)
            }
            break
          default:
            values[valueKey] = marshallValue(condition.value)!
            filterParts.push(`${nameKey} ${condition.operator} ${valueKey}`)
        }
      }

      valueIndex++
    }

    return {
      keyCondition: keyParts.length > 0 ? keyParts.join(' AND ') : null,
      filterExpression: filterParts.length > 0 ? filterParts.join(' AND ') : null,
      expressionAttributeNames: names,
      expressionAttributeValues: values,
    }
  }
}
