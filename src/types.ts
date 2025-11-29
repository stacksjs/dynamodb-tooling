// ============================================================================
// AWS Credential Types
// ============================================================================

/**
 * AWS credentials for DynamoDB authentication
 */
export interface AWSCredentials {
  /**
   * AWS Access Key ID
   */
  accessKeyId: string
  /**
   * AWS Secret Access Key
   */
  secretAccessKey: string
  /**
   * Optional session token for temporary credentials (STS)
   */
  sessionToken?: string
}

/**
 * HTTP options for the DynamoDB client
 */
export interface HttpOptions {
  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number
  /**
   * Connection timeout in milliseconds
   * @default 5000
   */
  connectTimeout?: number
  /**
   * Enable HTTP keep-alive for connection reuse
   * @default true
   */
  keepAlive?: boolean
  /**
   * Keep-alive timeout in milliseconds
   * @default 60000
   */
  keepAliveTimeout?: number
}

/**
 * Retry configuration for DynamoDB operations
 */
export type RetryMode = 'standard' | 'adaptive'

// ============================================================================
// Single-Table Design Types
// ============================================================================

/**
 * Configuration for single-table design patterns (Alex DeBrie style)
 */
export interface SingleTableDesignConfig {
  /**
   * Enable single-table design mode
   * @default true
   */
  enabled: boolean
  /**
   * Name of the partition key attribute
   * @default 'pk'
   */
  partitionKeyName: string
  /**
   * Name of the sort key attribute
   * @default 'sk'
   */
  sortKeyName: string
  /**
   * Name of GSI1 partition key attribute
   * @default 'gsi1pk'
   */
  gsi1pkName: string
  /**
   * Name of GSI1 sort key attribute
   * @default 'gsi1sk'
   */
  gsi1skName: string
  /**
   * Name of GSI2 partition key attribute
   * @default 'gsi2pk'
   */
  gsi2pkName: string
  /**
   * Name of GSI2 sort key attribute
   * @default 'gsi2sk'
   */
  gsi2skName: string
  /**
   * Name of GSI3 partition key attribute
   * @default 'gsi3pk'
   */
  gsi3pkName: string
  /**
   * Name of GSI3 sort key attribute
   * @default 'gsi3sk'
   */
  gsi3skName: string
  /**
   * Name of GSI4 partition key attribute
   * @default 'gsi4pk'
   */
  gsi4pkName: string
  /**
   * Name of GSI4 sort key attribute
   * @default 'gsi4sk'
   */
  gsi4skName: string
  /**
   * Name of GSI5 partition key attribute
   * @default 'gsi5pk'
   */
  gsi5pkName: string
  /**
   * Name of GSI5 sort key attribute
   * @default 'gsi5sk'
   */
  gsi5skName: string
  /**
   * Attribute name for storing entity type
   * @default '_et'
   */
  entityTypeAttribute: string
  /**
   * Attribute name for storing entity data (if using data packing)
   * @default '_d'
   */
  dataAttribute: string
  /**
   * Default partition key prefix format (e.g., 'USER#', 'TEAM#')
   * Use {ENTITY} as placeholder for entity name
   * @default '{ENTITY}#'
   */
  pkPrefix: string
  /**
   * Default sort key prefix format
   * Use {ENTITY} as placeholder for entity name
   * @default '{ENTITY}#'
   */
  skPrefix: string
  /**
   * Number of GSIs to configure (1-20, but 2-5 recommended)
   * @default 2
   */
  gsiCount: number
  /**
   * Delimiter used in composite keys
   * @default '#'
   */
  keyDelimiter: string
}

// ============================================================================
// Query Builder Types
// ============================================================================

/**
 * Entity mapping strategy for single-table design
 */
export type EntityMappingStrategy = 'prefix' | 'attribute' | 'composite'

/**
 * Timestamp format for date/time storage
 */
export type TimestampFormat = 'iso' | 'unix' | 'unixMs'

/**
 * Soft delete configuration
 */
export interface SoftDeletesConfig {
  /**
   * Enable soft deletes
   * @default false
   */
  enabled: boolean
  /**
   * Attribute name for storing deletion timestamp
   * @default 'deletedAt'
   */
  attribute: string
}

/**
 * Model lifecycle hook types
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

/**
 * Hook callback function type
 */
export type HookCallback<T = unknown> = (model: T) => void | Promise<void>

/**
 * Hooks configuration for model lifecycle events
 */
export interface HooksConfig {
  /**
   * Global hooks applied to all models
   */
  global?: Partial<Record<ModelHookType, HookCallback[]>>
  /**
   * Model-specific hooks by entity name
   */
  models?: Record<string, Partial<Record<ModelHookType, HookCallback[]>>>
}

/**
 * Query caching configuration
 */
export interface CachingConfig {
  /**
   * Enable query caching
   * @default false
   */
  enabled: boolean
  /**
   * Default TTL for cached queries in milliseconds
   * @default 60000 (1 minute)
   */
  ttlMs: number
  /**
   * Maximum number of cached queries (LRU eviction)
   * @default 1000
   */
  maxSize: number
  /**
   * Cache key prefix for namespacing
   * @default 'ddb:'
   */
  keyPrefix: string
}

/**
 * Query builder integration configuration
 */
export interface QueryBuilderConfig {
  /**
   * Path to Stacks model definitions for auto-discovery
   * @default './app/models'
   */
  modelsPath: string
  /**
   * Strategy for mapping entities to DynamoDB items
   * - 'prefix': Use pk/sk prefixes (e.g., USER#123)
   * - 'attribute': Use separate entity type attribute
   * - 'composite': Combine both strategies
   * @default 'prefix'
   */
  entityMappingStrategy: EntityMappingStrategy
  /**
   * Format for storing timestamps
   * - 'iso': ISO 8601 string (e.g., '2024-01-15T10:30:00.000Z')
   * - 'unix': Unix timestamp in seconds
   * - 'unixMs': Unix timestamp in milliseconds
   * @default 'iso'
   */
  timestampFormat: TimestampFormat
  /**
   * Soft delete configuration
   */
  softDeletes: SoftDeletesConfig
  /**
   * Lifecycle hooks configuration
   */
  hooks: HooksConfig
  /**
   * Query result caching configuration
   */
  caching: CachingConfig
  /**
   * Attribute name for createdAt timestamp
   * @default 'createdAt'
   */
  createdAtAttribute: string
  /**
   * Attribute name for updatedAt timestamp
   * @default 'updatedAt'
   */
  updatedAtAttribute: string
  /**
   * Attribute name for version tracking (optimistic locking)
   * @default '_v'
   */
  versionAttribute: string
}

// ============================================================================
// Capacity & Performance Types
// ============================================================================

/**
 * DynamoDB billing mode
 */
export type BillingMode = 'PAY_PER_REQUEST' | 'PROVISIONED'

/**
 * Auto-scaling configuration for read or write capacity
 */
export interface AutoScalingCapacityConfig {
  /**
   * Minimum capacity units
   * @default 5
   */
  min: number
  /**
   * Maximum capacity units
   * @default 100
   */
  max: number
  /**
   * Target utilization percentage (20-90)
   * @default 70
   */
  targetUtilization: number
}

/**
 * Auto-scaling configuration
 */
export interface AutoScalingConfig {
  /**
   * Enable auto-scaling
   * @default false
   */
  enabled: boolean
  /**
   * Read capacity auto-scaling settings
   */
  read: AutoScalingCapacityConfig
  /**
   * Write capacity auto-scaling settings
   */
  write: AutoScalingCapacityConfig
  /**
   * Scale-in cooldown in seconds
   * @default 60
   */
  scaleInCooldown: number
  /**
   * Scale-out cooldown in seconds
   * @default 60
   */
  scaleOutCooldown: number
}

/**
 * Capacity and performance configuration
 */
export interface CapacityConfig {
  /**
   * Billing mode for the table
   * - 'PAY_PER_REQUEST': On-demand mode (default, recommended for most workloads)
   * - 'PROVISIONED': Provisioned capacity mode
   * @default 'PAY_PER_REQUEST'
   */
  billingMode: BillingMode
  /**
   * Read capacity units (only for PROVISIONED mode)
   * @default 5
   */
  read: number
  /**
   * Write capacity units (only for PROVISIONED mode)
   * @default 5
   */
  write: number
  /**
   * Auto-scaling configuration (only for PROVISIONED mode)
   */
  autoScaling: AutoScalingConfig
}

// ============================================================================
// Streams & TTL Types
// ============================================================================

/**
 * DynamoDB Streams view type
 */
export type StreamViewType = 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'

/**
 * DynamoDB Streams configuration
 */
export interface StreamsConfig {
  /**
   * Enable DynamoDB Streams
   * @default false
   */
  enabled: boolean
  /**
   * What data to include in the stream
   * - 'KEYS_ONLY': Only the key attributes
   * - 'NEW_IMAGE': The entire item after modification
   * - 'OLD_IMAGE': The entire item before modification
   * - 'NEW_AND_OLD_IMAGES': Both new and old images
   * @default 'NEW_AND_OLD_IMAGES'
   */
  viewType: StreamViewType
}

/**
 * Time-to-Live (TTL) configuration
 */
export interface TTLConfig {
  /**
   * Enable TTL
   * @default false
   */
  enabled: boolean
  /**
   * Attribute name for TTL (must contain Unix timestamp in seconds)
   * @default 'ttl'
   */
  attributeName: string
}

// ============================================================================
// Table Class & Advanced Types
// ============================================================================

/**
 * DynamoDB table storage class
 */
export type TableClass = 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'

/**
 * Return consumed capacity mode
 */
export type ReturnConsumedCapacity = 'NONE' | 'TOTAL' | 'INDEXES'

/**
 * Return item collection metrics mode
 */
export type ReturnItemCollectionMetrics = 'NONE' | 'SIZE'

/**
 * Resource tags for AWS resources
 */
export type Tags = Record<string, string>

/**
 * Contributor Insights configuration
 */
export interface ContributorInsightsConfig {
  /**
   * Enable CloudWatch Contributor Insights
   * @default false
   */
  enabled: boolean
}

// ============================================================================
// GSI/LSI Configuration Types
// ============================================================================

/**
 * Projection type for indexes
 */
export type ProjectionType = 'ALL' | 'KEYS_ONLY' | 'INCLUDE'

/**
 * GSI projection configuration
 */
export interface IndexProjection {
  /**
   * Projection type
   * - 'ALL': Project all attributes
   * - 'KEYS_ONLY': Only key attributes
   * - 'INCLUDE': Specified attributes only
   * @default 'ALL'
   */
  type: ProjectionType
  /**
   * Attributes to include (only for 'INCLUDE' projection type)
   */
  attributes?: string[]
}

/**
 * Global Secondary Index definition
 */
export interface GSIDefinition {
  /**
   * Name of the GSI
   */
  name: string
  /**
   * Partition key attribute name
   */
  partitionKey: string
  /**
   * Sort key attribute name (optional)
   */
  sortKey?: string
  /**
   * Projection configuration
   */
  projection: IndexProjection
  /**
   * Read capacity units (only for PROVISIONED tables)
   */
  readCapacity?: number
  /**
   * Write capacity units (only for PROVISIONED tables)
   */
  writeCapacity?: number
}

/**
 * Local Secondary Index definition
 */
export interface LSIDefinition {
  /**
   * Name of the LSI
   */
  name: string
  /**
   * Sort key attribute name (partition key is inherited from table)
   */
  sortKey: string
  /**
   * Projection configuration
   */
  projection: IndexProjection
}

// ============================================================================
// Local Development Types
// ============================================================================

/**
 * Local DynamoDB development configuration
 */
export interface LocalConfig {
  /**
   * Port for local DynamoDB instance
   * @default 8000
   */
  port: number
  /**
   * Path for persistent database storage (empty string for in-memory)
   * @default '' (in-memory)
   */
  dbPath: string
  /**
   * Run DynamoDB Local in detached mode
   * @default false
   */
  detached: boolean
  /**
   * Additional CLI arguments for DynamoDB Local
   * @default ['-sharedDb']
   */
  additionalArgs: string[]
  /**
   * Java options for DynamoDB Local process
   * @default ''
   */
  javaOpts: string
  /**
   * Installation path for DynamoDB Local JAR
   * @default 'dynamodb-local'
   */
  installPath: string
  /**
   * Download URL for DynamoDB Local archive
   * @default 'https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz'
   */
  downloadUrl: string
}

// ============================================================================
// Multi-Tenancy Types
// ============================================================================

/**
 * Multi-tenancy isolation strategy
 */
export type TenantIsolationStrategy = 'table' | 'prefix' | 'attribute'

/**
 * Tenant resolver function type
 */
export type TenantResolver = () => string | Promise<string>

/**
 * Multi-tenancy configuration
 */
export interface MultiTenancyConfig {
  /**
   * Enable multi-tenancy support
   * @default false
   */
  enabled: boolean
  /**
   * Isolation strategy
   * - 'table': Separate table per tenant
   * - 'prefix': Tenant ID in pk prefix (TENANT#123#USER#456)
   * - 'attribute': Tenant ID as separate attribute with GSI
   * @default 'prefix'
   */
  strategy: TenantIsolationStrategy
  /**
   * Attribute name for tenant ID (for 'attribute' strategy)
   * @default 'tenantId'
   */
  tenantIdAttribute: string
  /**
   * Function to resolve current tenant ID
   */
  tenantResolver?: TenantResolver
}

// ============================================================================
// Main Configuration Type
// ============================================================================

/**
 * Complete DynamoDB Tooling configuration
 */
export interface Config {
  // ---- AWS Connection ----
  /**
   * AWS region
   * @default 'us-east-1'
   */
  region: string
  /**
   * Custom endpoint URL (for local development or custom endpoints)
   * @default undefined (use AWS default)
   */
  endpoint?: string
  /**
   * AWS credentials (if not using environment/profile)
   */
  credentials?: AWSCredentials
  /**
   * AWS credential profile name
   * @default undefined (use default profile)
   */
  profile?: string

  // ---- Retry & HTTP ----
  /**
   * Maximum number of retries for failed requests
   * @default 3
   */
  maxRetries: number
  /**
   * Retry mode
   * - 'standard': Standard retry with exponential backoff
   * - 'adaptive': Adaptive retry with rate limiting
   * @default 'standard'
   */
  retryMode: RetryMode
  /**
   * HTTP client options
   */
  httpOptions: HttpOptions

  // ---- Table Naming ----
  /**
   * Default table name for single-table design
   * @default 'MainTable'
   */
  defaultTableName: string
  /**
   * Prefix to add to all table names (e.g., 'dev_', 'prod_')
   * @default ''
   */
  tableNamePrefix: string
  /**
   * Suffix to add to all table names (e.g., '_v1', '_test')
   * @default ''
   */
  tableNameSuffix: string

  // ---- Single-Table Design ----
  /**
   * Single-table design configuration
   */
  singleTableDesign: SingleTableDesignConfig

  // ---- Query Builder ----
  /**
   * Query builder integration configuration
   */
  queryBuilder: QueryBuilderConfig

  // ---- Capacity & Performance ----
  /**
   * Capacity and billing configuration
   */
  capacity: CapacityConfig

  // ---- Streams & TTL ----
  /**
   * DynamoDB Streams configuration
   */
  streams: StreamsConfig
  /**
   * TTL configuration
   */
  ttl: TTLConfig

  // ---- Table Settings ----
  /**
   * Table storage class
   * - 'STANDARD': Standard storage class
   * - 'STANDARD_INFREQUENT_ACCESS': Lower cost for infrequent access
   * @default 'STANDARD'
   */
  tableClass: TableClass
  /**
   * Enable deletion protection to prevent accidental table deletion
   * @default false
   */
  deletionProtection: boolean
  /**
   * CloudWatch Contributor Insights configuration
   */
  contributorInsights: ContributorInsightsConfig
  /**
   * Resource tags applied to the table
   */
  tags: Tags

  // ---- Default Operation Settings ----
  /**
   * Default setting for returning consumed capacity
   * @default 'NONE'
   */
  returnConsumedCapacity: ReturnConsumedCapacity
  /**
   * Default setting for returning item collection metrics
   * @default 'NONE'
   */
  returnItemCollectionMetrics: ReturnItemCollectionMetrics
  /**
   * Default setting for consistent reads
   * @default false
   */
  consistentRead: boolean

  // ---- Local Development ----
  /**
   * Local DynamoDB configuration
   */
  local: LocalConfig

  // ---- Multi-Tenancy ----
  /**
   * Multi-tenancy configuration
   */
  multiTenancy: MultiTenancyConfig

  // ---- GSI/LSI Definitions ----
  /**
   * Global Secondary Index definitions
   * @default [] (auto-generated from single-table config)
   */
  globalSecondaryIndexes: GSIDefinition[]
  /**
   * Local Secondary Index definitions
   * @default []
   */
  localSecondaryIndexes: LSIDefinition[]
}

// ============================================================================
// Launch Options (for DynamoDB Local)
// ============================================================================

/**
 * Options for launching DynamoDB Local
 */
export type LaunchOptions = Partial<Pick<LocalConfig, 'port' | 'dbPath' | 'detached' | 'additionalArgs' | 'javaOpts'>> & {
  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean
}

// ============================================================================
// Partial Config Types (for user configuration)
// ============================================================================

/**
 * Deep partial type helper
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

/**
 * User-provided configuration (all fields optional)
 */
export type UserConfig = DeepPartial<Config>

// ============================================================================
// Validation Error Types
// ============================================================================

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  /**
   * Path to the invalid config property (e.g., 'singleTableDesign.gsiCount')
   */
  path: string
  /**
   * Error message
   */
  message: string
  /**
   * Invalid value that was provided
   */
  value?: unknown
  /**
   * Suggested fix
   */
  suggestion?: string
}

/**
 * Result of configuration validation
 */
export interface ConfigValidationResult {
  /**
   * Whether the configuration is valid
   */
  valid: boolean
  /**
   * List of validation errors (empty if valid)
   */
  errors: ConfigValidationError[]
}
