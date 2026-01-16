// ============================================================================
// Query Builder Type Narrowing
// ============================================================================

import type { Model, ModelAttribute, ModelRelationship, SortDirection } from '../models/types'
import type { Attributes, FillableAttributes, RelationshipNames } from './inference'

// ============================================================================
// Query Builder State Tracking
// ============================================================================

/**
 * Query builder state for type narrowing
 */
export interface QueryBuilderState {
  selected: string[] | '*'
  withRelations: string[]
  withCounts: string[]
  hasConditions: boolean
}

/**
 * Default query builder state
 */
export interface DefaultState extends QueryBuilderState {
  selected: '*'
  withRelations: []
  withCounts: []
  hasConditions: false
}

// ============================================================================
// Typed Query Builder
// ============================================================================

/**
 * Type-safe query builder with state tracking
 * @template TModel - The model type
 * @template TSelected - Selected columns (or '*' for all)
 * @template TWith - Eagerly loaded relationships
 */
export interface TypedQueryBuilder<
  TModel extends { attributes: Record<string, ModelAttribute>, relationships?: Record<string, ModelRelationship> },
  TSelected extends keyof Attributes<TModel> | '*' = '*',
  TWith extends string[] = [],
> {
  // ============================================================================
  // Selection Methods
  // ============================================================================

  /**
   * Select specific columns - returns type narrowed to selected columns
   */
  select: <K extends keyof Attributes<TModel>>(
    ...columns: K[]
  ) => TypedQueryBuilder<TModel, K, TWith>

  // ============================================================================
  // Where Conditions
  // ============================================================================

  /**
   * Add where condition - only accepts valid attribute keys
   */
  where: (<K extends keyof Attributes<TModel>>(
    key: K,
    value: Attributes<TModel>[K],
  ) => TypedQueryBuilder<TModel, TSelected, TWith>) & (<K extends keyof Attributes<TModel>>(
    key: K,
    operator: WhereOperator,
    value: Attributes<TModel>[K],
  ) => TypedQueryBuilder<TModel, TSelected, TWith>) & ((
    conditions: Partial<Attributes<TModel>>,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>)

  /**
   * Add AND where condition
   */
  andWhere: (<K extends keyof Attributes<TModel>>(
    key: K,
    value: Attributes<TModel>[K],
  ) => TypedQueryBuilder<TModel, TSelected, TWith>) & (<K extends keyof Attributes<TModel>>(
    key: K,
    operator: WhereOperator,
    value: Attributes<TModel>[K],
  ) => TypedQueryBuilder<TModel, TSelected, TWith>)

  /**
   * Add OR where condition
   */
  orWhere: (<K extends keyof Attributes<TModel>>(
    key: K,
    value: Attributes<TModel>[K],
  ) => TypedQueryBuilder<TModel, TSelected, TWith>) & (<K extends keyof Attributes<TModel>>(
    key: K,
    operator: WhereOperator,
    value: Attributes<TModel>[K],
  ) => TypedQueryBuilder<TModel, TSelected, TWith>)

  /**
   * Where in array - value type matches attribute type
   */
  whereIn: <K extends keyof Attributes<TModel>>(
    key: K,
    values: Array<Attributes<TModel>[K]>,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Where not in array
   */
  whereNotIn: <K extends keyof Attributes<TModel>>(
    key: K,
    values: Array<Attributes<TModel>[K]>,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Where between - only for number/string attributes
   */
  whereBetween: <K extends NumericOrStringAttribute<TModel>>(
    key: K,
    min: Attributes<TModel>[K],
    max: Attributes<TModel>[K],
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Where null
   */
  whereNull: <K extends keyof Attributes<TModel>>(
    key: K,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Where not null
   */
  whereNotNull: <K extends keyof Attributes<TModel>>(
    key: K,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Where begins with - only for string attributes
   */
  whereBeginsWith: <K extends StringAttribute<TModel>>(
    key: K,
    prefix: string,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Where contains - only for string attributes
   */
  whereContains: <K extends StringAttribute<TModel>>(
    key: K,
    value: string,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  // ============================================================================
  // Ordering
  // ============================================================================

  /**
   * Order by - only accepts sortable attributes
   */
  orderBy: <K extends SortableAttribute<TModel>>(
    key: K,
    direction?: SortDirection,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Order by descending
   */
  orderByDesc: <K extends SortableAttribute<TModel>>(
    key: K,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Order by latest (createdAt desc)
   */
  latest: (key?: string) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Order by oldest (createdAt asc)
   */
  oldest: (key?: string) => TypedQueryBuilder<TModel, TSelected, TWith>

  // ============================================================================
  // Limiting
  // ============================================================================

  limit: (count: number) => TypedQueryBuilder<TModel, TSelected, TWith>
  take: (count: number) => TypedQueryBuilder<TModel, TSelected, TWith>

  // ============================================================================
  // Eager Loading
  // ============================================================================

  /**
   * Eager load relationships - adds to return type
   */
  with: <R extends RelationshipNames<TModel> & string>(
    ...relationships: R[]
  ) => TypedQueryBuilder<TModel, TSelected, [...TWith, R]>

  /**
   * Eager load with count - adds {relation}Count to return type
   */
  withCount: <R extends RelationshipNames<TModel> & string>(
    ...relationships: R[]
  ) => TypedQueryBuilder<TModel, TSelected, TWith> & { _countFields: R }

  // ============================================================================
  // Relationship Existence
  // ============================================================================

  /**
   * Filter by relationship existence
   */
  has: <R extends RelationshipNames<TModel> & string>(
    relationship: R,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Filter by relationship non-existence
   */
  doesntHave: <R extends RelationshipNames<TModel> & string>(
    relationship: R,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  /**
   * Filter by relationship with conditions
   */
  whereHas: <R extends RelationshipNames<TModel> & string>(
    relationship: R,
    callback?: (query: TypedQueryBuilder<RelatedModel<TModel, R>, '*', []>) => void,
  ) => TypedQueryBuilder<TModel, TSelected, TWith>

  // ============================================================================
  // Soft Deletes
  // ============================================================================

  withTrashed: () => TypedQueryBuilder<TModel, TSelected, TWith>
  onlyTrashed: () => TypedQueryBuilder<TModel, TSelected, TWith>

  // ============================================================================
  // Scopes
  // ============================================================================

  scope: (name: string, ...args: unknown[]) => TypedQueryBuilder<TModel, TSelected, TWith>

  // ============================================================================
  // Index Selection
  // ============================================================================

  useIndex: (indexName: string) => TypedQueryBuilder<TModel, TSelected, TWith>

  // ============================================================================
  // Execution Methods - Return correctly typed results
  // ============================================================================

  /**
   * Get all results
   */
  get: () => Promise<Array<QueryResult<TModel, TSelected, TWith>>>

  /**
   * Get first result or null
   */
  first: () => Promise<QueryResult<TModel, TSelected, TWith> | null>

  /**
   * Get first result or throw
   */
  firstOrFail: () => Promise<QueryResult<TModel, TSelected, TWith>>

  /**
   * Find by primary key
   */
  find: (pk: string | number, sk?: string | number) => Promise<QueryResult<TModel, TSelected, TWith> | null>

  /**
   * Find or throw
   */
  findOrFail: (pk: string | number, sk?: string | number) => Promise<QueryResult<TModel, TSelected, TWith>>

  /**
   * Find multiple by keys
   */
  findMany: (keys: Array<{ pk: string | number, sk?: string | number }>) => Promise<Array<QueryResult<TModel, TSelected, TWith>>>

  // ============================================================================
  // Aggregations
  // ============================================================================

  count: () => Promise<number>
  exists: () => Promise<boolean>
  doesntExist: () => Promise<boolean>

  /**
   * Sum - only for numeric attributes
   */
  sum: <K extends NumericAttribute<TModel>>(column: K) => Promise<number>

  /**
   * Average - only for numeric attributes
   */
  avg: <K extends NumericAttribute<TModel>>(column: K) => Promise<number>

  /**
   * Min - only for numeric/string attributes
   */
  min: <K extends NumericOrStringAttribute<TModel>>(column: K) => Promise<Attributes<TModel>[K] | null>

  /**
   * Max - only for numeric/string attributes
   */
  max: <K extends NumericOrStringAttribute<TModel>>(column: K) => Promise<Attributes<TModel>[K] | null>

  // ============================================================================
  // Pagination
  // ============================================================================

  paginate: (perPage?: number) => Promise<PaginatedResult<QueryResult<TModel, TSelected, TWith>>>
  cursorPaginate: (cursor?: string, perPage?: number) => Promise<PaginatedResult<QueryResult<TModel, TSelected, TWith>>>

  // ============================================================================
  // Chunking
  // ============================================================================

  chunk: (
    size: number,
    callback: (items: Array<QueryResult<TModel, TSelected, TWith>>) => void | Promise<void>,
  ) => Promise<void>

  chunkById: (
    size: number,
    callback: (items: Array<QueryResult<TModel, TSelected, TWith>>) => void | Promise<void>,
  ) => Promise<void>

  // ============================================================================
  // Mutations
  // ============================================================================

  /**
   * Insert - requires fillable attributes
   */
  insert: (data: FillableAttributes<TModel>) => Promise<QueryResult<TModel, '*', []>>

  /**
   * Insert many
   */
  insertMany: (data: Array<FillableAttributes<TModel>>) => Promise<Array<QueryResult<TModel, '*', []>>>

  /**
   * Update - only accepts fillable attributes
   */
  update: (data: Partial<FillableAttributes<TModel>>) => Promise<number>

  /**
   * Delete
   */
  delete: () => Promise<number>

  /**
   * Force delete (bypass soft deletes)
   */
  forceDelete: () => Promise<number>

  // ============================================================================
  // Result Transformations
  // ============================================================================

  /**
   * Pluck a single attribute
   */
  pluck: <K extends keyof Attributes<TModel>>(column: K) => Promise<Array<Attributes<TModel>[K]>>

  /**
   * Get single value
   */
  value: <K extends keyof Attributes<TModel>>(column: K) => Promise<Attributes<TModel>[K] | null>

  /**
   * Map results
   */
  map: <R>(callback: (item: QueryResult<TModel, TSelected, TWith>) => R) => Promise<R[]>

  // ============================================================================
  // Debug
  // ============================================================================

  toQuery: () => { operation: string, params: Record<string, unknown> }
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Where clause operators
 */
export type WhereOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'begins_with' | 'contains' | 'between' | 'in'

/**
 * Operators valid for all types
 */
export type UniversalOperator = '=' | '!=' | 'in'

/**
 * Operators valid for ordered types (number, string)
 */
export type OrderedOperator = '<' | '<=' | '>' | '>=' | 'between'

/**
 * Operators valid for string types
 */
export type StringOperator = 'begins_with' | 'contains'

/**
 * Valid operator for attribute type
 */
export type ValidOperatorFor<T> = T extends number | string
  ? UniversalOperator | OrderedOperator | (T extends string ? StringOperator : never)
  : UniversalOperator

// ============================================================================
// Attribute Type Filters
// ============================================================================

/**
 * Extract numeric attribute names
 */
export type NumericAttribute<TModel extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof Attributes<TModel>]: Attributes<TModel>[K] extends number ? K : never
}[keyof Attributes<TModel>]

/**
 * Extract string attribute names
 */
export type StringAttribute<TModel extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof Attributes<TModel>]: Attributes<TModel>[K] extends string ? K : never
}[keyof Attributes<TModel>]

/**
 * Extract numeric or string attribute names (sortable)
 */
export type NumericOrStringAttribute<TModel extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof Attributes<TModel>]: Attributes<TModel>[K] extends number | string ? K : never
}[keyof Attributes<TModel>]

/**
 * Sortable attributes (numeric or string)
 */
export type SortableAttribute<TModel extends { attributes: Record<string, ModelAttribute> }> =
  NumericOrStringAttribute<TModel>

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Query result type based on selection and eager loading
 */
export type QueryResult<
  TModel extends { attributes: Record<string, ModelAttribute>, relationships?: Record<string, ModelRelationship> },
  TSelected extends keyof Attributes<TModel> | '*',
  TWith extends string[],
> =
  & (TSelected extends '*' ? Attributes<TModel> : Pick<Attributes<TModel>, TSelected & keyof Attributes<TModel>>)
  & WithRelations<TModel, TWith>
  & { pk: string, sk: string, _et: string }

/**
 * Add relationship types based on with() calls
 */
export type WithRelations<
  TModel extends { relationships?: Record<string, ModelRelationship> },
  TWith extends string[],
> = TWith extends []
  ? object
  : {
      [K in TWith[number] as K extends keyof NonNullable<TModel['relationships']>
        ? K
        : never]: K extends keyof NonNullable<TModel['relationships']>
        ? RelationshipResultType<NonNullable<TModel['relationships']>[K]>
        : never
    }

/**
 * Get related model type from relationship name
 */
export type RelatedModel<
  TModel extends { relationships?: Record<string, ModelRelationship> },
  R extends string,
> = R extends keyof NonNullable<TModel['relationships']>
  ? NonNullable<TModel['relationships']>[R] extends { model: infer M }
    ? M extends { attributes: Record<string, ModelAttribute> }
      ? M
      : never
    : never
  : never

/**
 * Relationship result type based on relationship type
 */
export type RelationshipResultType<R extends ModelRelationship> = R extends { type: 'hasOne' | 'belongsTo' }
  ? Model | null
  : R extends { type: 'hasMany' | 'belongsToMany' }
    ? Model[]
    : never

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Paginated result structure
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  hasMorePages: boolean
  cursor?: string
  nextCursor?: string
}

// ============================================================================
// Increment/Decrement Type Safety
// ============================================================================

/**
 * Increment operation - only for numeric attributes
 */
export type IncrementableAttribute<TModel extends { attributes: Record<string, ModelAttribute> }> =
  NumericAttribute<TModel>

/**
 * Decrement operation - only for numeric attributes
 */
export type DecrementableAttribute<TModel extends { attributes: Record<string, ModelAttribute> }> =
  NumericAttribute<TModel>
