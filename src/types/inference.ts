// ============================================================================
// Model Type Inference from Schema
// ============================================================================

import type { Model, ModelAttribute, ModelRelationship } from '../models/types'

// ============================================================================
// Attribute Type Mapping
// ============================================================================

/**
 * Map attribute type string to TypeScript type
 */
export interface AttributeTypeMap {
  string: string
  number: number
  boolean: boolean
  date: Date
  json: Record<string, unknown>
  list: unknown[]
  map: Record<string, unknown>
  set: Set<unknown>
  binary: Uint8Array
}

/**
 * Get TypeScript type from attribute type string
 */
export type MapAttributeType<T extends keyof AttributeTypeMap> = AttributeTypeMap[T]

// ============================================================================
// Model Attribute Inference
// ============================================================================

/**
 * Extract all attribute names from a model
 */
export type AttributeNames<M extends { attributes: Record<string, ModelAttribute> }> = keyof M['attributes']

/**
 * Infer attributes type from model definition
 */
export type Attributes<M extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof M['attributes']]: M['attributes'][K] extends { type: infer T extends keyof AttributeTypeMap }
    ? AttributeTypeMap[T]
    : unknown
}

/**
 * Extract required attributes from model
 */
export type RequiredAttributeNames<M extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof M['attributes']]: M['attributes'][K] extends { required: true } ? K : never
}[keyof M['attributes']]

/**
 * Extract optional attributes from model
 */
export type OptionalAttributeNames<M extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof M['attributes']]: M['attributes'][K] extends { required: true } ? never : K
}[keyof M['attributes']]

/**
 * Required attributes type
 */
export type RequiredAttributes<M extends { attributes: Record<string, ModelAttribute> }> = Pick<
  Attributes<M>,
  RequiredAttributeNames<M>
>

/**
 * Optional attributes type
 */
export type OptionalAttributes<M extends { attributes: Record<string, ModelAttribute> }> = Partial<
  Pick<Attributes<M>, OptionalAttributeNames<M>>
>

// ============================================================================
// Fillable/Guarded Attribute Inference
// ============================================================================

/**
 * Extract fillable attribute names
 */
export type FillableAttributeNames<M extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof M['attributes']]: M['attributes'][K] extends { fillable: false } | { guarded: true }
    ? never
    : K
}[keyof M['attributes']]

/**
 * Fillable attributes type
 */
export type FillableAttributes<M extends { attributes: Record<string, ModelAttribute> }> = Pick<
  Attributes<M>,
  FillableAttributeNames<M>
>

/**
 * Extract guarded attribute names
 */
export type GuardedAttributeNames<M extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof M['attributes']]: M['attributes'][K] extends { guarded: true } ? K : never
}[keyof M['attributes']]

/**
 * Guarded attributes type
 */
export type GuardedAttributes<M extends { attributes: Record<string, ModelAttribute> }> = Pick<
  Attributes<M>,
  GuardedAttributeNames<M>
>

// ============================================================================
// Hidden Attribute Inference
// ============================================================================

/**
 * Extract hidden attribute names
 */
export type HiddenAttributeNames<M extends { attributes: Record<string, ModelAttribute> }> = {
  [K in keyof M['attributes']]: M['attributes'][K] extends { hidden: true } ? K : never
}[keyof M['attributes']]

/**
 * Hidden attributes type
 */
export type HiddenAttributes<M extends { attributes: Record<string, ModelAttribute> }> = Pick<
  Attributes<M>,
  HiddenAttributeNames<M>
>

/**
 * Visible attributes (not hidden)
 */
export type VisibleAttributeNames<M extends { attributes: Record<string, ModelAttribute> }> = Exclude<
  keyof M['attributes'],
  HiddenAttributeNames<M>
>

/**
 * Visible attributes type
 */
export type VisibleAttributes<M extends { attributes: Record<string, ModelAttribute> }> = Pick<
  Attributes<M>,
  VisibleAttributeNames<M>
>

// ============================================================================
// Relationship Type Inference
// ============================================================================

/**
 * Relationship type definitions
 */
export interface RelationshipTypes<M extends { relationships?: Record<string, ModelRelationship> }> {
  hasOne: ExtractRelationships<M, 'hasOne'>
  hasMany: ExtractRelationships<M, 'hasMany'>
  belongsTo: ExtractRelationships<M, 'belongsTo'>
  belongsToMany: ExtractRelationships<M, 'belongsToMany'>
}

/**
 * Extract relationships of a specific type
 */
export type ExtractRelationships<
  M extends { relationships?: Record<string, ModelRelationship> },
  T extends ModelRelationship['type'],
> = M['relationships'] extends Record<string, ModelRelationship>
  ? {
      [K in keyof M['relationships']]: M['relationships'][K] extends { type: T } ? K : never
    }[keyof M['relationships']]
  : never

/**
 * Get relationship names
 */
export type RelationshipNames<M extends { relationships?: Record<string, ModelRelationship> }> =
  M['relationships'] extends Record<string, ModelRelationship>
    ? keyof M['relationships']
    : never

// ============================================================================
// Create/Update Input Types
// ============================================================================

/**
 * Input type for creating a model instance
 * - Required fields must be present
 * - Optional fields are optional
 * - Guarded fields are excluded
 */
export type CreateInput<M extends { attributes: Record<string, ModelAttribute> }> =
  & Pick<FillableAttributes<M>, Extract<RequiredAttributeNames<M>, FillableAttributeNames<M>>>
  & Partial<Pick<FillableAttributes<M>, Extract<OptionalAttributeNames<M>, FillableAttributeNames<M>>>>

/**
 * Input type for updating a model instance
 * - All fields are optional
 * - Guarded fields are excluded
 */
export type UpdateInput<M extends { attributes: Record<string, ModelAttribute> }> = Partial<FillableAttributes<M>>

// ============================================================================
// Model Instance Type
// ============================================================================

/**
 * Full model instance type with all attributes
 */
export type ModelInstance<M extends { attributes: Record<string, ModelAttribute> }> = Attributes<M> & {
  pk: string
  sk: string
  _et: string
  createdAt?: string | Date
  updatedAt?: string | Date
  deletedAt?: string | Date | null
}

/**
 * Serialized model output (without hidden fields)
 */
export type SerializedModel<M extends { attributes: Record<string, ModelAttribute> }> = VisibleAttributes<M>

// ============================================================================
// Infer Model Type from Class
// ============================================================================

/**
 * Infer model type from a model class
 */
export type InferModel<T extends typeof Model> = T extends { prototype: infer P } ? P : never

/**
 * Infer attributes from a model class
 */
export type InferModelAttributes<T extends typeof Model> =
  InferModel<T> extends { attributes: infer A extends Record<string, ModelAttribute> }
    ? Attributes<{ attributes: A }>
    : never

// ============================================================================
// Cast Type Inference
// ============================================================================

/**
 * Built-in cast types
 */
export type BuiltInCasts = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'array' | 'object'

/**
 * Cast result type mapping
 */
export type CastResultType<C extends string> = C extends 'string'
  ? string
  : C extends 'number'
    ? number
    : C extends 'boolean'
      ? boolean
      : C extends 'date' | 'datetime'
        ? Date
        : C extends 'json' | 'array' | 'object'
          ? Record<string, unknown> | unknown[]
          : unknown

/**
 * Apply casts to attributes
 */
export type WithCasts<
  M extends { attributes: Record<string, ModelAttribute> },
  Casts extends Record<string, string>,
> = {
  [K in keyof Attributes<M>]: K extends keyof Casts
    ? CastResultType<Casts[K]>
    : Attributes<M>[K]
}

// ============================================================================
// Discriminated Union for Entity Types
// ============================================================================

/**
 * Create a discriminated union from multiple entity types
 */
export type EntityUnion<Entities extends Record<string, { attributes: Record<string, ModelAttribute> }>> = {
  [K in keyof Entities]: Attributes<Entities[K]> & { _et: K }
}[keyof Entities]

/**
 * Extract specific entity type from union
 */
export type ExtractEntity<
  Union extends { _et: string },
  EntityType extends Union['_et'],
> = Extract<Union, { _et: EntityType }>
