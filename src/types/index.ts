// ============================================================================
// Type Safety Module - Comprehensive Type Exports
// ============================================================================

// Branded/Opaque Types for Keys (Phase 14.1)
export * from './branded'

// Model Type Inference (Phase 14.2)
export * from './inference'

// Query Builder Type Narrowing (Phase 14.3, 14.4, 14.5, 14.6, 14.7)
export * from './query-builder'

// DynamoDB-Specific Types (Phase 14.8)
export * from './dynamodb'

// Error Types (Phase 14.11)
export * from './errors'

// Validation & Type Utilities (Phase 14.12-14.17)
export * from './validation'

// Re-export main config types
export type {
  Config,
  UserConfig,
  DeepPartial,
  AWSCredentials,
  HttpOptions,
  RetryMode,
  SingleTableDesignConfig,
  QueryBuilderConfig,
  CapacityConfig,
  StreamsConfig,
  TTLConfig,
  LocalConfig,
  MultiTenancyConfig,
  GSIDefinition,
  LSIDefinition,
  BillingMode,
  TableClass,
  StreamViewType,
  ProjectionType,
  EntityMappingStrategy,
  TimestampFormat,
  LaunchOptions,
  ConfigValidationError,
  ConfigValidationResult,
} from '../types'

// Re-export model types
export type {
  Model,
  ModelAttribute,
  ModelRelationship,
  ModelQueryBuilder,
  QueryResult,
  PaginationOptions,
  SortDirection,
  WhereCondition,
  ModelHookType,
  ModelHook,
  ModelScope,
  CastDefinition,
  ModelMetadata,
  ModelConstructor,
} from '../models/types'

// Re-export model errors
export {
  ModelNotFoundError,
  ValidationError,
  ConditionalCheckFailedError as ModelConditionalCheckFailedError,
} from '../models/types'

// Re-export parser types
export type {
  StacksModel,
  ParsedModel,
  ParsedAttribute,
  ParsedRelationship,
  ModelRegistry,
  KeyPattern,
  AccessPattern,
  ModelTraits,
  AttributeDefinition,
  ValidationRule,
  DynamoDbAttributeType,
  RelationshipType,
} from '../model-parser/types'
