// Configuration
export * from './config'
// DynamoDB Local
export * from './dynamodb'

// Driver Plugin System (Phase 3-6)
export * from './drivers'

// Factory System
export * from './factories'

// Migration System
export * from './migrations'

// Model Parser (Stacks Model Integration)
export * from './model-parser'

// Model System (Laravel/Stacks Style ORM)
export * from './models'

// Seeding System
export * from './seeders'

// Single-Table Design Utilities
export * from './single-table'

// DynamoDB Toolbox Integration
export * from './toolbox'

export * from './types'

// Advanced Type Safety (Phase 14) - Explicit exports to avoid conflicts
export {
  // Branded types
  type Branded,
  type PartitionKey,
  type SortKey,
  type GSI1PK,
  type GSI1SK,
  type GSI2PK,
  type GSI2SK,
  type GSI3PK,
  type GSI3SK,
  type GSI4PK,
  type GSI4SK,
  type GSI5PK,
  type GSI5SK,
  type EntityType,
  type PKFormat,
  type SKFormat,
  type GSIKeyFormat,
  type CompositeKeyFormat,
  type ExtractEntityFromPK,
  type ExtractEntityFromSK,
  type ExtractIdFromKey,
  type KeyPair,
  type FullKeySet,
  pk,
  sk,
  compositeSk,
  gsi1pk,
  gsi1sk,
  extractEntityType,
  extractId,
  isEntityKey,
  isValidPKFormat,
  isValidSKFormat,
  isValidCompositeFormat,
  KeyBuilder,
  keyBuilder,
} from './types/branded'

export {
  // Type inference
  type AttributeTypeMap,
  type MapAttributeType,
  type AttributeNames,
  type Attributes,
  type RequiredAttributeNames,
  type OptionalAttributeNames,
  type RequiredAttributes,
  type OptionalAttributes,
  type FillableAttributeNames,
  type FillableAttributes,
  type GuardedAttributeNames,
  type GuardedAttributes,
  type HiddenAttributeNames,
  type HiddenAttributes,
  type VisibleAttributeNames,
  type VisibleAttributes,
  type RelationshipTypes,
  type ExtractRelationships,
  type RelationshipNames,
  type CreateInput,
  type UpdateInput,
  type ModelInstance,
  type SerializedModel,
  type InferModel,
  type InferModelAttributes,
  type BuiltInCasts,
  type CastResultType,
  type WithCasts,
  type EntityUnion,
  type ExtractEntity,
} from './types/inference'

export type {
  // Query builder types
  QueryBuilderState,
  DefaultState,
  TypedQueryBuilder,
  PaginatedResult,
  NumericAttribute,
  StringAttribute,
  NumericOrStringAttribute,
  SortableAttribute,
  IncrementableAttribute,
  DecrementableAttribute,
} from './types/query-builder'

export {
  // DynamoDB types
  type StringAttributeValue,
  type NumberAttributeValue,
  type BinaryAttributeValue,
  type BooleanAttributeValue,
  type NullAttributeValue,
  type MapAttributeValue,
  type ListAttributeValue,
  type StringSetAttributeValue,
  type NumberSetAttributeValue,
  type BinarySetAttributeValue,
  type AttributeValue,
  type TypedDynamoDBItem,
  type JSToAttributeValue,
  type AttributeValueToJS,
  type Marshall,
  type Unmarshall,
  type KeyConditionExpression,
  type FilterExpression,
  type UpdateExpressionAction,
  type UpdateExpression,
  type ProjectionExpression,
  type TypedQueryInput,
  type TypedScanInput,
  type TypedQueryOutput,
  type TypedPutItemInput,
  type TypedUpdateItemInput,
  type TypedDeleteItemInput,
  type BatchWriteRequest,
  type TypedBatchWriteInput,
  type TypedBatchGetInput,
  type TransactWriteItem,
  type TransactGetItem,
  type TypedTransactWriteInput,
  type TypedTransactGetInput,
  type ReturnValue,
  type ReturnConsumedCapacityOption,
  type ReturnItemCollectionMetricsOption,
  isStringValue,
  isNumberValue,
  isBinaryValue,
  isBooleanValue,
  isNullValue,
  isMapValue,
  isListValue,
  isStringSetValue,
  isNumberSetValue,
  isBinarySetValue,
} from './types/dynamodb'

export {
  // Error types
  type BaseDynamoDBError,
  type DynamoDBErrorCode,
  type DynamoDBError,
  type TransactionCancellationReason,
  ItemNotFoundError,
  DynamoDBValidationError,
  ConditionalCheckFailedError as DynamoDBConditionalCheckFailedError,
  TransactionCancelledError,
  ProvisionedThroughputExceededError,
  ResourceNotFoundError,
  ResourceInUseError,
  ItemCollectionSizeLimitExceededError,
  RequestLimitExceededError,
  ThrottlingError,
  DynamoDBInternalError,
  ServiceUnavailableError,
  isItemNotFoundError,
  isValidationError,
  isConditionalCheckFailedError,
  isTransactionCancelledError,
  isProvisionedThroughputExceededError,
  isResourceNotFoundError,
  isResourceInUseError,
  isThrottlingError,
  isDynamoDBError,
  isRetryableError,
  getRetryDelayMs,
  createDynamoDBError,
} from './types/errors'

export {
  // Validation utilities
  type ValidateQueryHasPK,
  type ValidateSKOperator,
  type ValidateGSIExists,
  type ValidateTransactionSize,
  type ValidateBatchWriteSize,
  type ValidateBatchGetSize,
  type ValidateRequiredFields,
  type ValidateNoReadonlyFields,
  type StrictInput,
  type ValidateRelationship,
  type ValidateNestedRelationship,
  type Assert,
  type AssertEqual,
  type AssertNever,
  type AssertNotNever,
  type InsertFn,
  type UpdateFn,
  type ModelLike,
  type ForModel,
  type RequireKeys,
  type OptionalKeys,
  type Mutable,
  type Immutable,
  type DeepReadonly,
  type KeysOfType,
  type OmitByType,
  type PickByType,
  type Exhaustive,
  assertNever,
} from './types/validation'

// Performance & Optimization (Phase 15)
export * from './performance'

// Multi-Tenancy Support (Phase 16)
export {
  // Tenant management
  TenantManager,
  createTenantManager,
  TenantContext,
  setTenantContext,
  getTenantContext,
  clearTenantContext,
  withTenant,
  TenantNotFoundError,
  CrossTenantAccessError,
  type TenantContextData,
  type TenantResolver,
  type TenantManagerConfig,
} from './multi-tenancy/TenantManager'

export {
  // Tenant isolation strategies
  TenantIsolation,
  createTablePerTenantIsolation,
  createPrefixIsolation,
  createAttributeIsolation,
  type IsolationStrategy,
  type TablePerTenantStrategy,
  type PrefixIsolationStrategy,
  type AttributeIsolationStrategy,
} from './multi-tenancy/TenantIsolation'

export {
  // Query interceptor
  TenantQueryInterceptor,
  createTenantQueryInterceptor,
  type InterceptedQuery,
  type TenantQueryInterceptorOptions,
} from './multi-tenancy/TenantQueryInterceptor'

export {
  // Capacity management
  TenantCapacityManager,
  createTenantCapacityManager,
  type TenantCapacityConfig,
  type TenantCapacityStats,
} from './multi-tenancy/TenantCapacityManager'

// Validation System (Async Rules & ts-validation Integration)
export {
  // Core validation
  Validator,
  createValidator,
  ValidationFailedError,
  type ValidationRule,
  type ValidationResult,
  type ValidationContext,
  type ValidatorOptions,
  type ValidationRuleDefinition,
  type FullValidationResult,
} from './validation/Validator'

export {
  // Async validation
  AsyncValidator,
  createAsyncValidator,
  uniqueAsync,
  existsAsync,
  debouncedAsync,
  cachedAsync,
  type AsyncValidationRule,
  type AsyncValidationContext,
  type AsyncValidationRuleDefinition,
  type AsyncValidatorOptions,
  type AsyncFullValidationResult,
} from './validation/AsyncValidator'

export {
  // ts-validation integration
  TsValidationRules,
  createTsValidationRule,
  tsValidation,
  type TsValidationRuleName,
  type TsValidationRuleOptions,
} from './validation/TsValidationIntegration'

export {
  // Model validation
  ModelValidator,
  createModelValidator,
  validateModel,
  ModelValidationError,
  type ModelValidationResult,
  type ModelValidationOptions,
} from './validation/ModelValidator'

export {
  // Built-in rules
  rules,
  required,
  string as stringRule,
  number as numberRule,
  boolean as booleanRule,
  email as emailRule,
  url as urlRule,
  uuid as uuidRule,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  oneOf,
  custom,
  unique,
  array as arrayRule,
  object as objectRule,
  date as dateRule,
  integer,
  positive,
  negative,
  between,
  confirmed,
  different,
  same,
  nullable,
  sometimes,
  alpha,
  alphaNumeric,
  alphaDash,
  startsWith,
  endsWith,
} from './validation/rules'

// DynamoDB Streams Processing (Phase 17)
export {
  StreamProcessor,
  createStreamProcessor,
  type StreamEvent,
  type StreamRecord,
  type StreamEventType,
  type StreamProcessorConfig,
  type StreamHandler,
  type ChangeDataCapture,
  type EntityHandler,
  type StreamProcessorStats,
} from './streams'

// PartiQL Query Builder (Phase 17)
export {
  PartiQLBuilder,
  partiql,
  selectFrom,
  insertInto,
  updateTable,
  deleteFrom,
  buildBatchStatements,
  type PartiQLStatementType,
  type PartiQLParameter,
  type PartiQLQuery,
  type WhereCondition,
  type SelectProjection,
  type OrderDirection,
  type BatchStatementConfig,
  type BatchStatementResult,
} from './partiql'

// Backup & Restore (Phase 17)
export {
  BackupManager,
  createBackupManager,
  type BackupStatus,
  type BackupType,
  type PITRStatus,
  type BackupDetails,
  type CreateBackupOptions,
  type ListBackupsOptions,
  type RestoreOptions,
  type PITRDescription,
  type ScheduledBackupConfig,
} from './backup'

// Global Tables (Phase 17)
export {
  GlobalTableManager,
  createGlobalTableManager,
  type GlobalTableStatus,
  type ReplicaStatus,
  type AWSRegion,
  type ReplicaDescription,
  type GlobalTableDescription,
  type ReplicaSettings,
  type ReplicaAutoScalingSettings,
} from './global-tables'

// Observability & Monitoring (Phase 18)
export {
  Logger,
  createLogger,
  defaultLogger,
  ConsoleTransport,
  FileTransport,
  type LogLevel,
  type LogEntry,
  type LogTransport,
  type LoggerConfig,
  MetricsRegistry,
  createMetricsRegistry,
  defaultMetrics,
  PrometheusExporter,
  CloudWatchExporter,
  DynamoDBMetrics,
  type MetricType,
  type MetricLabels,
  type HistogramBuckets,
  type MetricDefinition,
  type MetricValue,
  type HistogramValue,
  type SummaryValue,
  type MetricsCollector,
  type MetricsExporter,
  Tracer,
  createTracer,
  defaultTracer,
  ConsoleSpanExporter,
  OTLPSpanExporter,
  DynamoDBSpanAttributes,
  type SpanStatus,
  type SpanKind,
  type SpanAttributes,
  type SpanEvent,
  type SpanLink,
  type SpanData,
  type Span,
  type TraceContext,
  type SpanExporter,
} from './observability'

// Security (Phase 19)
export {
  EncryptionManager,
  createEncryptionManager,
  KeyRotationManager,
  createKeyRotationManager,
  type EncryptionAlgorithm,
  type KeyDerivationFunction,
  type EncryptedFieldMetadata,
  type EncryptionConfig,
  type EncryptionResult,
  type EncryptedAttribute,
  type KeyRotationConfig,
  AccessControlManager,
  createAccessControlManager,
  BuiltInRoles,
  type PermissionAction,
  type PermissionResource,
  type AccessCondition,
  type Permission,
  type Role,
  type AccessContext,
  type AccessCheckResult,
  AuditLogger,
  createAuditLogger,
  InMemoryAuditStorage,
  DynamoDBCommandAuditStorage,
  type AuditEventType,
  type AuditEventStatus,
  type AuditEvent,
  type AuditStorage,
  type AuditQueryOptions,
  type AuditQueryResult,
  type AuditLoggerConfig,
} from './security'

// Developer Tooling (Phase 20)
export {
  DataGenerator,
  createDataGenerator,
  EntityGeneratorBuilder,
  entityGenerator,
  generators,
  type GeneratorFn,
  type FieldGenerator,
  type GeneratorSchema,
  QueryAnalyzer,
  createQueryAnalyzer,
  type QueryOperationType,
  type QueryAnalysis,
  type QueryIssue,
  type QueryRecommendation,
  type QueryCharacteristics,
  type QueryInput,
  type TableMetadata,
} from './tooling'

// Serverless Integration (Phase 22)
export {
  APIHandler,
  StreamHandler as LambdaStreamHandler,
  SQSHandler,
  createAPIHandler,
  createStreamHandler as createLambdaStreamHandler,
  createSQSHandler,
  parseBody,
  getPathParams,
  getQueryParams,
  getHeader,
  type LambdaContext,
  type APIGatewayEvent,
  type APIGatewayResponse,
  type DynamoDBStreamEvent,
  type SQSEvent,
  type HandlerResult,
  type RouteDefinition,
  type CORSConfig,
} from './serverless'

// Import/Export (Phase 23)
export {
  DataExporter,
  createDataExporter,
  DataImporter,
  createDataImporter,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type ImportOptions,
  type ImportResult,
  type BatchWriteCommand,
} from './import-export'

// Caching Integration (Phase 24)
export {
  CacheManager,
  createCacheManager,
  MemoryCacheStore,
  cached,
  hashQuery,
  type CacheEntry,
  type CacheOptions,
  type CacheStats,
  type CacheStore,
} from './caching'

// Polymorphic Relationships (Phase 25)
export {
  PolymorphicRelationshipManager,
  createPolymorphicManager,
  morphTo,
  morphMany,
  buildPolymorphicGSIKey,
  parsePolymorphicGSIKey,
  type PolymorphicTypeMap,
  type PolymorphicConfig,
  type Morphable,
  type PolymorphicResult,
} from './relationships'

// Event Sourcing (Phase 26)
export {
  EventStore,
  createEventStore,
  AggregateRoot,
  type DomainEvent,
  type EventStream,
  type EventStoreOptions,
  type Snapshot,
  type EventHandler,
} from './event-sourcing'

// GraphQL Integration (Phase 27)
export {
  GraphQLSchemaBuilder,
  createGraphQLSchemaBuilder,
  type GraphQLScalarType,
  type GraphQLFieldDef,
  type GraphQLTypeDef,
  type GraphQLQueryDef,
  type GraphQLMutationDef,
  type ModelDefinition as GraphQLModelDefinition,
  type SchemaBuilderOptions,
} from './graphql'

// Utilities
export * from './utils'
