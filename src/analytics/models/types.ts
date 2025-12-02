// ============================================================================
// Stacks Model Type Stub
// ============================================================================
// Local type definition for Stacks model compatibility
// This allows analytics models to work without the @stacksjs/types package

/**
 * Attribute validation configuration
 */
export interface AttributeValidation {
  rule: string
  min?: number
  max?: number
  message?: string | Record<string, string>
}

/**
 * Model attribute definition
 */
export interface ModelAttributeDefinition {
  required?: boolean
  unique?: boolean
  fillable?: boolean
  default?: unknown
  validation?: AttributeValidation
  cast?: string
  comment?: string
}

/**
 * Model traits configuration
 */
export interface ModelTraits {
  useUuid?: boolean
  useTtl?: boolean
  useTimestamps?: boolean
  useSoftDeletes?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KeyFunction = (item: any) => string

/**
 * DynamoDB key configuration for single-table design
 */
export interface DynamoDBKeyConfig {
  pk?: KeyFunction
  sk?: KeyFunction
  gsi1pk?: KeyFunction
  gsi1sk?: KeyFunction
  gsi2pk?: KeyFunction
  gsi2sk?: KeyFunction
  gsi3pk?: KeyFunction
  gsi3sk?: KeyFunction
}

/**
 * Stacks Model definition interface
 * Compatible with @stacksjs/types Model
 */
export interface Model {
  name: string
  table?: string
  primaryKey?: string | string[]
  autoIncrement?: boolean
  traits?: ModelTraits
  belongsTo?: string[]
  hasMany?: string[]
  hasOne?: string[]
  attributes: Record<string, ModelAttributeDefinition>
  dynamodb?: DynamoDBKeyConfig
}
