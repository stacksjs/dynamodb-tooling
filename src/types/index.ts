// ============================================================================
// Type Safety Module - Comprehensive Type Exports
// ============================================================================

// Re-export parser types
export type {
  AccessPattern,
  AttributeDefinition,
  DynamoDbAttributeType,
  KeyPattern,
  ModelRegistry,
  ModelTraits,
  ParsedAttribute,
  ParsedModel,
  ParsedRelationship,
  RelationshipType,
  StacksModel,
  ValidationRule,
} from '../model-parser/types'

// Re-export model types
export type {
  CastDefinition,
  Model,
  ModelAttribute,
  ModelConstructor,
  ModelHook,
  ModelHookType,
  ModelMetadata,
  ModelQueryBuilder,
  ModelRelationship,
  ModelScope,
  PaginationOptions,
  QueryResult,
  SortDirection,
  WhereCondition,
} from '../models/types'

// Re-export model errors
export {
  ConditionalCheckFailedError as ModelConditionalCheckFailedError,
  ModelNotFoundError,
  ValidationError,
} from '../models/types'

// Re-export main config types
export type {
  AWSCredentials,
  BillingMode,
  CapacityConfig,
  Config,
  ConfigValidationError,
  ConfigValidationResult,
  DeepPartial,
  EntityMappingStrategy,
  GSIDefinition,
  HttpOptions,
  LaunchOptions,
  LocalConfig,
  LSIDefinition,
  MultiTenancyConfig,
  ProjectionType,
  QueryBuilderConfig,
  RetryMode,
  SingleTableDesignConfig,
  StreamsConfig,
  StreamViewType,
  TableClass,
  TimestampFormat,
  TTLConfig,
  UserConfig,
} from '../types'

// Branded/Opaque Types for Keys (Phase 14.1)
export * from './branded'

// DynamoDB-Specific Types (Phase 14.8)
export * from './dynamodb'

// Error Types (Phase 14.11)
export * from './errors'

// Model Type Inference (Phase 14.2)
export * from './inference'

// Query Builder Type Narrowing (Phase 14.3, 14.4, 14.5, 14.6, 14.7)
export * from './query-builder'

// Validation & Type Utilities (Phase 14.12-14.17)
export * from './validation'
