// ============================================================================
// Stacks Model Types
// ============================================================================

/**
 * Attribute validation rule
 */
export interface ValidationRule {
  rule: string
  message?: string
}

/**
 * Attribute definition in a Stacks model
 */
export interface AttributeDefinition {
  /**
   * Whether the attribute can be mass-assigned
   */
  fillable?: boolean
  /**
   * Validation rules for the attribute
   */
  validation?: ValidationRule | ValidationRule[] | string
  /**
   * Default value for the attribute
   */
  default?: unknown
  /**
   * Whether the attribute must be unique
   */
  unique?: boolean
  /**
   * Whether the attribute is required
   */
  required?: boolean
  /**
   * Whether the attribute is hidden in serialization
   */
  hidden?: boolean
  /**
   * Data type cast for the attribute
   */
  cast?: string
  /**
   * Whether the attribute is nullable
   */
  nullable?: boolean
  /**
   * Factory function for generating fake data
   */
  factory?: () => unknown
}

/**
 * Model traits for behavior configuration
 */
export interface ModelTraits {
  /**
   * Add createdAt and updatedAt timestamps
   */
  useTimestamps?: boolean
  /**
   * Add deletedAt for soft deletes
   */
  useSoftDeletes?: boolean
  /**
   * Generate UUID for primary key
   */
  useUuid?: boolean
  /**
   * Enable search integration
   */
  useSearch?: boolean
  /**
   * Enable seeding support
   */
  useSeeder?: boolean
  /**
   * Enable TTL for auto-expiring items
   */
  useTtl?: boolean
  /**
   * Enable version tracking for optimistic locking
   */
  useVersioning?: boolean
}

/**
 * Index definition in a Stacks model
 */
export interface ModelIndex {
  /**
   * Index name
   */
  name?: string
  /**
   * Columns/attributes to index
   */
  columns: string[]
  /**
   * Whether this is a unique index
   */
  unique?: boolean
  /**
   * Index type (for DynamoDB: GSI or LSI)
   */
  type?: 'gsi' | 'lsi'
}

/**
 * Factory function for generating test data
 */
export type FactoryFunction = () => Record<string, unknown>

/**
 * Stacks Model Definition
 */
export interface StacksModel {
  /**
   * Model name (e.g., 'User', 'Post')
   */
  name: string
  /**
   * Database table name (ignored in single-table design)
   */
  table?: string
  /**
   * Primary key attribute name
   * @default 'id'
   */
  primaryKey?: string
  /**
   * Attribute definitions
   */
  attributes: Record<string, AttributeDefinition>
  /**
   * Has-one relationships
   */
  hasOne?: string[]
  /**
   * Has-many relationships
   */
  hasMany?: string[]
  /**
   * Belongs-to relationships
   */
  belongsTo?: string[]
  /**
   * Belongs-to-many relationships (many-to-many)
   */
  belongsToMany?: string[]
  /**
   * Model traits for behavior
   */
  traits?: ModelTraits
  /**
   * Index definitions
   */
  indexes?: ModelIndex[]
  /**
   * Factory function for generating test data
   */
  factory?: FactoryFunction
  /**
   * Scopes for common queries
   */
  scopes?: Record<string, (...args: unknown[]) => unknown>
}

// ============================================================================
// Parsed Model Types (Internal Representation)
// ============================================================================

/**
 * Relationship type enum
 */
export type RelationshipType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'

/**
 * Parsed relationship definition
 */
export interface ParsedRelationship {
  /**
   * Type of relationship
   */
  type: RelationshipType
  /**
   * Related model name
   */
  relatedModel: string
  /**
   * Foreign key attribute (auto-derived or specified)
   */
  foreignKey: string
  /**
   * Local key attribute (usually primary key)
   */
  localKey: string
  /**
   * For belongsToMany: pivot entity name
   */
  pivotEntity?: string
  /**
   * Whether this relationship needs a GSI
   */
  requiresGsi: boolean
  /**
   * GSI assignment (if applicable)
   */
  gsiIndex?: number
}

/**
 * Parsed attribute with full type information
 */
export interface ParsedAttribute {
  /**
   * Attribute name
   */
  name: string
  /**
   * Whether fillable
   */
  fillable: boolean
  /**
   * Whether required
   */
  required: boolean
  /**
   * Whether nullable
   */
  nullable: boolean
  /**
   * Whether unique
   */
  unique: boolean
  /**
   * Whether hidden in serialization
   */
  hidden: boolean
  /**
   * Data type cast
   */
  cast?: string
  /**
   * Default value
   */
  defaultValue?: unknown
  /**
   * Validation rules (if any)
   */
  validationRules?: string[]
  /**
   * DynamoDB attribute type (S, N, B, BOOL, NULL, M, L, SS, NS, BS)
   */
  dynamoDbType: DynamoDbAttributeType
}

/**
 * DynamoDB attribute type
 */
export type DynamoDbAttributeType = 'S' | 'N' | 'B' | 'BOOL' | 'NULL' | 'M' | 'L' | 'SS' | 'NS' | 'BS'

/**
 * Key pattern definition
 */
export interface KeyPattern {
  /**
   * Partition key pattern (e.g., 'USER#{id}')
   */
  pk: string
  /**
   * Sort key pattern (e.g., 'USER#{id}' or 'PROFILE#{profileId}')
   */
  sk: string
  /**
   * GSI1 partition key pattern (if applicable)
   */
  gsi1pk?: string
  /**
   * GSI1 sort key pattern (if applicable)
   */
  gsi1sk?: string
  /**
   * GSI2 partition key pattern (if applicable)
   */
  gsi2pk?: string
  /**
   * GSI2 sort key pattern (if applicable)
   */
  gsi2sk?: string
  /**
   * GSI3 partition key pattern (if applicable)
   */
  gsi3pk?: string
  /**
   * GSI3 sort key pattern (if applicable)
   */
  gsi3sk?: string
  /**
   * GSI4 partition key pattern (if applicable)
   */
  gsi4pk?: string
  /**
   * GSI4 sort key pattern (if applicable)
   */
  gsi4sk?: string
  /**
   * GSI5 partition key pattern (if applicable)
   */
  gsi5pk?: string
  /**
   * GSI5 sort key pattern (if applicable)
   */
  gsi5sk?: string
}

/**
 * Access pattern definition
 */
export interface AccessPattern {
  /**
   * Pattern name (e.g., 'Get User by ID')
   */
  name: string
  /**
   * Description of the access pattern
   */
  description: string
  /**
   * Entity type this pattern applies to
   */
  entityType: string
  /**
   * Operation type
   */
  operation: 'get' | 'query' | 'scan'
  /**
   * Index used (main table, GSI1, GSI2, etc.)
   */
  index: 'main' | 'GSI1' | 'GSI2' | 'GSI3' | 'GSI4' | 'GSI5' | 'scan'
  /**
   * Key condition expression pattern
   */
  keyCondition: string
  /**
   * Example pk value
   */
  examplePk: string
  /**
   * Example sk value (if applicable)
   */
  exampleSk?: string
  /**
   * Whether this is an efficient query (vs scan)
   */
  efficient: boolean
}

/**
 * Fully parsed model with all derived information
 */
export interface ParsedModel {
  /**
   * Original model name
   */
  name: string
  /**
   * Entity type prefix (e.g., 'USER')
   */
  entityType: string
  /**
   * Primary key attribute name
   */
  primaryKey: string
  /**
   * Parsed attributes
   */
  attributes: ParsedAttribute[]
  /**
   * Parsed relationships
   */
  relationships: ParsedRelationship[]
  /**
   * Key patterns for this entity
   */
  keyPatterns: KeyPattern
  /**
   * Access patterns for this entity
   */
  accessPatterns: AccessPattern[]
  /**
   * Applied traits
   */
  traits: ModelTraits
  /**
   * Whether this model uses timestamps
   */
  hasTimestamps: boolean
  /**
   * Whether this model uses soft deletes
   */
  hasSoftDeletes: boolean
  /**
   * Whether this model uses UUID primary key
   */
  hasUuid: boolean
  /**
   * Whether this model uses TTL
   */
  hasTtl: boolean
  /**
   * Whether this model uses versioning
   */
  hasVersioning: boolean
  /**
   * Factory function (if defined)
   */
  factory?: FactoryFunction
  /**
   * Original model definition
   */
  original: StacksModel
}

/**
 * Model registry containing all parsed models
 */
export interface ModelRegistry {
  /**
   * Map of model name to parsed model
   */
  models: Map<string, ParsedModel>
  /**
   * All derived access patterns
   */
  accessPatterns: AccessPattern[]
  /**
   * GSI assignments (which relationships use which GSI)
   */
  gsiAssignments: Map<string, number>
  /**
   * Detected conflicts or warnings
   */
  warnings: string[]
}
