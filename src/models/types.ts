// ============================================================================
// Model System Types
// ============================================================================

import type { JSObject } from '../single-table/EntityTransformer'

/**
 * Model constructor type
 */
export type ModelConstructor<T extends Model = Model> = new (attributes?: JSObject) => T

/**
 * Model query result
 */
export interface QueryResult<T> {
  items: T[]
  count: number
  lastEvaluatedKey?: { pk: string, sk: string }
  consumedCapacity?: {
    tableName: string
    capacityUnits: number
    readCapacityUnits?: number
    writeCapacityUnits?: number
  }
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number
  cursor?: string | { pk: string, sk: string }
  consistentRead?: boolean
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Where clause operator
 */
export type WhereOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'begins_with' | 'contains' | 'between' | 'in'

/**
 * Where clause condition
 */
export interface WhereCondition {
  key: string
  operator: WhereOperator
  value: unknown
  secondValue?: unknown // For 'between' operator
}

/**
 * Model attribute definition
 */
export interface ModelAttribute {
  name: string
  type?: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'list' | 'map' | 'set' | 'binary'
  fillable?: boolean
  guarded?: boolean
  hidden?: boolean
  cast?: string
  default?: unknown | (() => unknown)
  required?: boolean
  unique?: boolean
  validation?: string | string[]
}

/**
 * Model relationship definition
 */
export interface ModelRelationship {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'
  model: string | ModelConstructor
  foreignKey?: string
  localKey?: string
  pivotEntity?: string
}

/**
 * Model lifecycle hook type
 */
export type ModelHookType =
  | 'creating'
  | 'created'
  | 'updating'
  | 'updated'
  | 'deleting'
  | 'deleted'
  | 'saving'
  | 'saved'
  | 'restoring'
  | 'restored'
  | 'forceDeleting'
  | 'forceDeleted'

/**
 * Model hook callback
 */
export type ModelHook<T extends Model = Model> = (model: T) => void | Promise<void> | boolean | Promise<boolean>

/**
 * Model scope function
 */
export type ModelScope<T extends Model = Model> = (query: ModelQueryBuilder<T>, ...args: unknown[]) => ModelQueryBuilder<T>

/**
 * Cast type definition
 */
export interface CastDefinition {
  get?: (value: unknown, key: string, model: Model) => unknown
  set?: (value: unknown, key: string, model: Model) => unknown
}

/**
 * Model metadata for registration
 */
export interface ModelMetadata {
  tableName: string
  entityType: string
  primaryKey: string
  pkPrefix: string
  skPrefix: string
  attributes: Map<string, ModelAttribute>
  relationships: Map<string, ModelRelationship>
  hooks: Map<ModelHookType, ModelHook[]>
  scopes: Map<string, ModelScope>
  casts: Map<string, string | CastDefinition>
  timestamps: boolean
  softDeletes: boolean
  versioning: boolean
  uuid: boolean
  ttl: boolean
}

/**
 * Model query builder interface
 */
export interface ModelQueryBuilder<T extends Model = Model> {
  // Selection
  select: (...columns: string[]) => this

  // Conditions
  where: ((key: string, value: unknown) => this) & ((key: string, operator: WhereOperator, value: unknown) => this) & ((conditions: Record<string, unknown>) => this)
  andWhere: ((key: string, value: unknown) => this) & ((key: string, operator: WhereOperator, value: unknown) => this)
  orWhere: ((key: string, value: unknown) => this) & ((key: string, operator: WhereOperator, value: unknown) => this)
  whereIn: (key: string, values: unknown[]) => this
  whereNotIn: (key: string, values: unknown[]) => this
  whereBetween: (key: string, min: unknown, max: unknown) => this
  whereNull: (key: string) => this
  whereNotNull: (key: string) => this
  whereBeginsWith: (key: string, prefix: string) => this
  whereContains: (key: string, value: string) => this

  // Soft deletes
  withTrashed: () => this
  onlyTrashed: () => this

  // Ordering
  orderBy: (key: string, direction?: SortDirection) => this
  orderByDesc: (key: string) => this
  latest: (key?: string) => this
  oldest: (key?: string) => this

  // Limiting
  limit: (count: number) => this
  take: (count: number) => this

  // Pagination
  paginate: (perPage?: number) => Promise<QueryResult<T>>
  cursorPaginate: (cursor?: string, perPage?: number) => Promise<QueryResult<T>>

  // Eager loading
  with: (...relationships: string[]) => this
  withCount: (...relationships: string[]) => this

  // Relationship existence
  has: (relationship: string) => this
  doesntHave: (relationship: string) => this
  whereHas: (relationship: string, callback?: (query: ModelQueryBuilder) => void) => this

  // Scopes
  scope: (name: string, ...args: unknown[]) => this

  // Index selection
  useIndex: (indexName: string) => this

  // Execution
  get: () => Promise<T[]>
  first: () => Promise<T | null>
  firstOrFail: () => Promise<T>
  find: (pk: string | number, sk?: string | number) => Promise<T | null>
  findOrFail: (pk: string | number, sk?: string | number) => Promise<T>
  findMany: (keys: Array<{ pk: string | number, sk?: string | number }>) => Promise<T[]>
  count: () => Promise<number>
  exists: () => Promise<boolean>
  doesntExist: () => Promise<boolean>

  // Aggregations
  sum: (column: string) => Promise<number>
  avg: (column: string) => Promise<number>
  min: (column: string) => Promise<number | null>
  max: (column: string) => Promise<number | null>

  // Mutations
  insert: (data: Partial<T>) => Promise<T>
  insertMany: (data: Array<Partial<T>>) => Promise<T[]>
  update: (data: Partial<T>) => Promise<number>
  delete: () => Promise<number>
  forceDelete: () => Promise<number>

  // Chunking
  chunk: (size: number, callback: (items: T[]) => void | Promise<void>) => Promise<void>
  chunkById: (size: number, callback: (items: T[]) => void | Promise<void>) => Promise<void>

  // Raw access
  toQuery: () => { operation: string, params: Record<string, unknown> }
}

/**
 * Base Model class interface
 */
export abstract class Model {
  // Static properties
  static table: string
  static primaryKey: string
  static pkPrefix: string
  static skPrefix: string
  static timestamps: boolean
  static softDeletes: boolean
  static versioning: boolean
  static uuid: boolean
  static ttl: boolean
  static connection?: string

  // Instance properties
  protected _attributes: JSObject = {}
  protected _original: JSObject = {}
  protected _relations: Map<string, Model | Model[] | null> = new Map()
  protected _exists: boolean = false
  protected _wasRecentlyCreated: boolean = false

  // Abstract methods to be implemented by concrete models
  abstract get attributes(): Record<string, ModelAttribute>
  abstract get relationships(): Record<string, ModelRelationship>

  // Constructor
  constructor(attributes?: JSObject) {
    if (attributes) {
      this.fill(attributes)
    }
  }

  // Attribute access
  getAttribute(key: string): unknown {
    return this._attributes[key]
  }

  setAttribute(key: string, value: unknown): this {
    this._attributes[key] = value
    return this
  }

  fill(attributes: JSObject): this {
    for (const [key, value] of Object.entries(attributes)) {
      this.setAttribute(key, value)
    }
    return this
  }

  // Dirty tracking
  isDirty(key?: string): boolean {
    if (key) {
      return this._attributes[key] !== this._original[key]
    }
    return Object.keys(this._attributes).some(k => this._attributes[k] !== this._original[k])
  }

  isClean(key?: string): boolean {
    return !this.isDirty(key)
  }

  getDirty(): JSObject {
    const dirty: JSObject = {}
    for (const [key, value] of Object.entries(this._attributes)) {
      if (value !== this._original[key]) {
        dirty[key] = value
      }
    }
    return dirty
  }

  getOriginal(key?: string): unknown | JSObject {
    if (key) {
      return this._original[key]
    }
    return { ...this._original }
  }

  // Existence
  get exists(): boolean {
    return this._exists
  }

  get wasRecentlyCreated(): boolean {
    return this._wasRecentlyCreated
  }

  // Serialization
  toJSON(): JSObject {
    const result: JSObject = {}
    const hiddenAttrs = this.getHiddenAttributes()

    for (const [key, value] of Object.entries(this._attributes)) {
      if (!hiddenAttrs.includes(key)) {
        result[key] = value
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

  toArray(): JSObject {
    return this.toJSON()
  }

  only(...keys: string[]): JSObject {
    const result: JSObject = {}
    for (const key of keys) {
      if (key in this._attributes) {
        result[key] = this._attributes[key]
      }
    }
    return result
  }

  except(...keys: string[]): JSObject {
    const result: JSObject = {}
    for (const [key, value] of Object.entries(this._attributes)) {
      if (!keys.includes(key)) {
        result[key] = value
      }
    }
    return result
  }

  // Helper methods
  protected getHiddenAttributes(): string[] {
    const hidden: string[] = []
    for (const [name, attr] of Object.entries(this.attributes)) {
      if (attr.hidden) {
        hidden.push(name)
      }
    }
    return hidden
  }

  protected getFillableAttributes(): string[] {
    const fillable: string[] = []
    for (const [name, attr] of Object.entries(this.attributes)) {
      if (attr.fillable !== false && attr.guarded !== true) {
        fillable.push(name)
      }
    }
    return fillable
  }

  protected getGuardedAttributes(): string[] {
    const guarded: string[] = []
    for (const [name, attr] of Object.entries(this.attributes)) {
      if (attr.guarded === true) {
        guarded.push(name)
      }
    }
    return guarded
  }

  // Sync original state
  syncOriginal(): this {
    this._original = { ...this._attributes }
    return this
  }

  // Clone
  replicate(): Model {
    const Constructor = this.constructor as ModelConstructor
    const clone = new Constructor(this._attributes)
    return clone
  }

  // Refresh from database (to be implemented by concrete class)
  abstract refresh(): Promise<this>

  // Save (to be implemented by concrete class)
  abstract save(): Promise<boolean>

  // Update (to be implemented by concrete class)
  abstract update(attributes: JSObject): Promise<boolean>

  // Delete (to be implemented by concrete class)
  abstract delete(): Promise<boolean>

  // Force delete (for soft deletes)
  abstract forceDelete(): Promise<boolean>

  // Restore (for soft deletes)
  abstract restore(): Promise<boolean>

  // Static methods (to be implemented by concrete class)
  static query<T extends Model>(this: ModelConstructor<T>): ModelQueryBuilder<T> {
    throw new Error('query() must be implemented by concrete model class')
  }

  static find<T extends Model>(
    this: ModelConstructor<T>,
    pk: string | number,
    sk?: string | number,
  ): Promise<T | null> {
    throw new Error('find() must be implemented by concrete model class')
  }

  static findOrFail<T extends Model>(
    this: ModelConstructor<T>,
    pk: string | number,
    sk?: string | number,
  ): Promise<T> {
    throw new Error('findOrFail() must be implemented by concrete model class')
  }

  static findMany<T extends Model>(
    this: ModelConstructor<T>,
    keys: Array<{ pk: string | number, sk?: string | number }>,
  ): Promise<T[]> {
    throw new Error('findMany() must be implemented by concrete model class')
  }

  static create<T extends Model>(
    this: ModelConstructor<T>,
    attributes: JSObject,
  ): Promise<T> {
    throw new Error('create() must be implemented by concrete model class')
  }

  static all<T extends Model>(this: ModelConstructor<T>): Promise<T[]> {
    throw new Error('all() must be implemented by concrete model class')
  }
}

/**
 * Model not found error
 */
export class ModelNotFoundError extends Error {
  public model: string
  public keys: { pk?: string | number, sk?: string | number }

  constructor(model: string, keys: { pk?: string | number, sk?: string | number }) {
    super(`${model} not found with keys: ${JSON.stringify(keys)}`)
    this.name = 'ModelNotFoundError'
    this.model = model
    this.keys = keys
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  public model: string
  public errors: Record<string, string[]>

  constructor(model: string, errors: Record<string, string[]>) {
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ')
    super(`Validation failed for ${model}: ${messages}`)
    this.name = 'ValidationError'
    this.model = model
    this.errors = errors
  }
}

/**
 * Conditional check failed error (optimistic locking)
 */
export class ConditionalCheckFailedError extends Error {
  public model: string
  public expectedVersion?: number
  public actualVersion?: number

  constructor(model: string, expectedVersion?: number, actualVersion?: number) {
    super(`Conditional check failed for ${model}. Expected version: ${expectedVersion}, Actual: ${actualVersion}`)
    this.name = 'ConditionalCheckFailedError'
    this.model = model
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }
}
