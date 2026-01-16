// Backup & Restore (Phase 17)
export {
  type BackupDetails,
  BackupManager,
  type BackupStatus,
  type BackupType,
  createBackupManager,
  type CreateBackupOptions,
  type ListBackupsOptions,
  type PITRDescription,
  type PITRStatus,
  type RestoreOptions,
  type ScheduledBackupConfig,
} from './backup'
// Caching Integration (Phase 24)
export {
  cached,
  type CacheEntry,
  CacheManager,
  type CacheOptions,
  type CacheStats,
  type CacheStore,
  createCacheManager,
  hashQuery,
  MemoryCacheStore,
} from './caching'

// Configuration
export * from './config'

// Driver Plugin System (Phase 3-6)
export * from './drivers'

// DynamoDB Local
export * from './dynamodb'

// Event Sourcing (Phase 26)
export {
  AggregateRoot,
  createEventStore,
  type DomainEvent,
  type EventHandler,
  EventStore,
  type EventStoreOptions,
  type EventStream,
  type Snapshot,
} from './event-sourcing'

// Factory System
export * from './factories'

// Global Tables (Phase 17)
export {
  type AWSRegion,
  createGlobalTableManager,
  type GlobalTableDescription,
  GlobalTableManager,
  type GlobalTableStatus,
  type ReplicaAutoScalingSettings,
  type ReplicaDescription,
  type ReplicaSettings,
  type ReplicaStatus,
} from './global-tables'

// GraphQL Integration (Phase 27)
export {
  createGraphQLSchemaBuilder,
  type GraphQLFieldDef,
  type ModelDefinition as GraphQLModelDefinition,
  type GraphQLMutationDef,
  type GraphQLQueryDef,
  type GraphQLScalarType,
  GraphQLSchemaBuilder,
  type GraphQLTypeDef,
  type SchemaBuilderOptions,
} from './graphql'

// Import/Export (Phase 23)
export {
  type BatchWriteCommand,
  createDataExporter,
  createDataImporter,
  DataExporter,
  DataImporter,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type ImportOptions,
  type ImportResult,
} from './import-export'

// Migration System
export * from './migrations'

// Model Parser (Stacks Model Integration)
export * from './model-parser'

// Model System (Laravel/Stacks Style ORM)
export * from './models'

export {
  createTenantCapacityManager,
  type TenantCapacityConfig,
  // Capacity management
  TenantCapacityManager,
  type TenantCapacityStats,
} from './multi-tenancy/TenantCapacityManager'

export {
  type AttributeIsolationStrategy,
  createAttributeIsolation,
  createPrefixIsolation,
  createTablePerTenantIsolation,
  type IsolationStrategy,
  type PrefixIsolationStrategy,
  type TablePerTenantStrategy,
  // Tenant isolation strategies
  TenantIsolation,
} from './multi-tenancy/TenantIsolation'

// Multi-Tenancy Support (Phase 16)
export {
  clearTenantContext,
  createTenantManager,
  CrossTenantAccessError,
  getTenantContext,
  setTenantContext,
  TenantContext,
  type TenantContextData,
  // Tenant management
  TenantManager,
  type TenantManagerConfig,
  TenantNotFoundError,
  type TenantResolver,
  withTenant,
} from './multi-tenancy/TenantManager'

export {
  createTenantQueryInterceptor,
  type InterceptedQuery,
  // Query interceptor
  TenantQueryInterceptor,
  type TenantQueryInterceptorOptions,
} from './multi-tenancy/TenantQueryInterceptor'

// Observability & Monitoring (Phase 18)
export {
  CloudWatchExporter,
  ConsoleSpanExporter,
  ConsoleTransport,
  createLogger,
  createMetricsRegistry,
  createTracer,
  defaultLogger,
  defaultMetrics,
  defaultTracer,
  DynamoDBMetrics,
  DynamoDBSpanAttributes,
  FileTransport,
  type HistogramBuckets,
  type HistogramValue,
  type LogEntry,
  Logger,
  type LoggerConfig,
  type LogLevel,
  type LogTransport,
  type MetricDefinition,
  type MetricLabels,
  type MetricsCollector,
  type MetricsExporter,
  MetricsRegistry,
  type MetricType,
  type MetricValue,
  OTLPSpanExporter,
  PrometheusExporter,
  type Span,
  type SpanAttributes,
  type SpanData,
  type SpanEvent,
  type SpanExporter,
  type SpanKind,
  type SpanLink,
  type SpanStatus,
  type SummaryValue,
  type TraceContext,
  Tracer,
} from './observability'

// PartiQL Query Builder (Phase 17)
export {
  type BatchStatementConfig,
  type BatchStatementResult,
  buildBatchStatements,
  deleteFrom,
  insertInto,
  type OrderDirection,
  partiql,
  PartiQLBuilder,
  type PartiQLParameter,
  type PartiQLQuery,
  type PartiQLStatementType,
  selectFrom,
  type SelectProjection,
  updateTable,
  type WhereCondition,
} from './partiql'

// Performance & Optimization (Phase 15)
export * from './performance'

// Polymorphic Relationships (Phase 25)
export {
  buildPolymorphicGSIKey,
  createPolymorphicManager,
  type Morphable,
  morphMany,
  morphTo,
  parsePolymorphicGSIKey,
  type PolymorphicConfig,
  PolymorphicRelationshipManager,
  type PolymorphicResult,
  type PolymorphicTypeMap,
} from './relationships'

// Security (Phase 19)
export {
  type AccessCheckResult,
  type AccessCondition,
  type AccessContext,
  AccessControlManager,
  type AuditEvent,
  type AuditEventStatus,
  type AuditEventType,
  AuditLogger,
  type AuditLoggerConfig,
  type AuditQueryOptions,
  type AuditQueryResult,
  type AuditStorage,
  BuiltInRoles,
  createAccessControlManager,
  createAuditLogger,
  createEncryptionManager,
  createKeyRotationManager,
  DynamoDBCommandAuditStorage,
  type EncryptedAttribute,
  type EncryptedFieldMetadata,
  type EncryptionAlgorithm,
  type EncryptionConfig,
  EncryptionManager,
  type EncryptionResult,
  InMemoryAuditStorage,
  type KeyDerivationFunction,
  type KeyRotationConfig,
  KeyRotationManager,
  type Permission,
  type PermissionAction,
  type PermissionResource,
  type Role,
} from './security'

// Seeding System
export * from './seeders'

// Serverless Integration (Phase 22)
export {
  type APIGatewayEvent,
  type APIGatewayResponse,
  APIHandler,
  type CORSConfig,
  createAPIHandler,
  createStreamHandler as createLambdaStreamHandler,
  createSQSHandler,
  type DynamoDBStreamEvent,
  getHeader,
  getPathParams,
  getQueryParams,
  type HandlerResult,
  type LambdaContext,
  StreamHandler as LambdaStreamHandler,
  parseBody,
  type RouteDefinition,
  type SQSEvent,
  SQSHandler,
} from './serverless'

// Single-Table Design Utilities
export * from './single-table'

// DynamoDB Streams Processing (Phase 17)
export {
  type ChangeDataCapture,
  createStreamProcessor,
  type EntityHandler,
  type StreamEvent,
  type StreamEventType,
  type StreamHandler,
  StreamProcessor,
  type StreamProcessorConfig,
  type StreamProcessorStats,
  type StreamRecord,
} from './streams'

// DynamoDB Toolbox Integration
export * from './toolbox'

// Developer Tooling (Phase 20)
export {
  createDataGenerator,
  createQueryAnalyzer,
  DataGenerator,
  entityGenerator,
  EntityGeneratorBuilder,
  type FieldGenerator,
  type GeneratorFn,
  generators,
  type GeneratorSchema,
  type QueryAnalysis,
  QueryAnalyzer,
  type QueryCharacteristics,
  type QueryInput,
  type QueryIssue,
  type QueryOperationType,
  type QueryRecommendation,
  type TableMetadata,
} from './tooling'

export * from './types'

// Advanced Type Safety (Phase 14) - Explicit exports to avoid conflicts
export {
  // Branded types
  type Branded,
  type CompositeKeyFormat,
  compositeSk,
  type EntityType,
  type ExtractEntityFromPK,
  type ExtractEntityFromSK,
  extractEntityType,
  extractId,
  type ExtractIdFromKey,
  type FullKeySet,
  type GSI1PK,
  gsi1pk,
  type GSI1SK,
  gsi1sk,
  type GSI2PK,
  type GSI2SK,
  type GSI3PK,
  type GSI3SK,
  type GSI4PK,
  type GSI4SK,
  type GSI5PK,
  type GSI5SK,
  type GSIKeyFormat,
  isEntityKey,
  isValidCompositeFormat,
  isValidPKFormat,
  isValidSKFormat,
  KeyBuilder,
  keyBuilder,
  type KeyPair,
  type PartitionKey,
  pk,
  type PKFormat,
  sk,
  type SKFormat,
  type SortKey,
} from './types/branded'

export {
  type AttributeValue,
  type AttributeValueToJS,
  type BatchWriteRequest,
  type BinaryAttributeValue,
  type BinarySetAttributeValue,
  type BooleanAttributeValue,
  type FilterExpression,
  isBinarySetValue,
  isBinaryValue,
  isBooleanValue,
  isListValue,
  isMapValue,
  isNullValue,
  isNumberSetValue,
  isNumberValue,
  isStringSetValue,
  isStringValue,
  type JSToAttributeValue,
  type KeyConditionExpression,
  type ListAttributeValue,
  type MapAttributeValue,
  type Marshall,
  type NullAttributeValue,
  type NumberAttributeValue,
  type NumberSetAttributeValue,
  type ProjectionExpression,
  type ReturnConsumedCapacityOption,
  type ReturnItemCollectionMetricsOption,
  type ReturnValue,
  // DynamoDB types
  type StringAttributeValue,
  type StringSetAttributeValue,
  type TransactGetItem,
  type TransactWriteItem,
  type TypedBatchGetInput,
  type TypedBatchWriteInput,
  type TypedDeleteItemInput,
  type TypedDynamoDBItem,
  type TypedPutItemInput,
  type TypedQueryInput,
  type TypedQueryOutput,
  type TypedScanInput,
  type TypedTransactGetInput,
  type TypedTransactWriteInput,
  type TypedUpdateItemInput,
  type Unmarshall,
  type UpdateExpression,
  type UpdateExpressionAction,
} from './types/dynamodb'

export {
  // Error types
  type BaseDynamoDBError,
  createDynamoDBError,
  ConditionalCheckFailedError as DynamoDBConditionalCheckFailedError,
  type DynamoDBError,
  type DynamoDBErrorCode,
  DynamoDBInternalError,
  DynamoDBValidationError,
  getRetryDelayMs,
  isConditionalCheckFailedError,
  isDynamoDBError,
  isItemNotFoundError,
  isProvisionedThroughputExceededError,
  isResourceInUseError,
  isResourceNotFoundError,
  isRetryableError,
  isThrottlingError,
  isTransactionCancelledError,
  isValidationError,
  ItemCollectionSizeLimitExceededError,
  ItemNotFoundError,
  ProvisionedThroughputExceededError,
  RequestLimitExceededError,
  ResourceInUseError,
  ResourceNotFoundError,
  ServiceUnavailableError,
  ThrottlingError,
  type TransactionCancellationReason,
  TransactionCancelledError,
} from './types/errors'

export {
  type AttributeNames,
  type Attributes,
  // Type inference
  type AttributeTypeMap,
  type BuiltInCasts,
  type CastResultType,
  type CreateInput,
  type EntityUnion,
  type ExtractEntity,
  type ExtractRelationships,
  type FillableAttributeNames,
  type FillableAttributes,
  type GuardedAttributeNames,
  type GuardedAttributes,
  type HiddenAttributeNames,
  type HiddenAttributes,
  type InferModel,
  type InferModelAttributes,
  type MapAttributeType,
  type ModelInstance,
  type OptionalAttributeNames,
  type OptionalAttributes,
  type RelationshipNames,
  type RelationshipTypes,
  type RequiredAttributeNames,
  type RequiredAttributes,
  type SerializedModel,
  type UpdateInput,
  type VisibleAttributeNames,
  type VisibleAttributes,
  type WithCasts,
} from './types/inference'

export type {
  DecrementableAttribute,
  DefaultState,
  IncrementableAttribute,
  NumericAttribute,
  NumericOrStringAttribute,
  PaginatedResult,
  // Query builder types
  QueryBuilderState,
  SortableAttribute,
  StringAttribute,
  TypedQueryBuilder,
} from './types/query-builder'

export {
  type Assert,
  type AssertEqual,
  type AssertNever,
  assertNever,
  type AssertNotNever,
  type DeepReadonly,
  type Exhaustive,
  type ForModel,
  type Immutable,
  type InsertFn,
  type KeysOfType,
  type ModelLike,
  type Mutable,
  type OmitByType,
  type OptionalKeys,
  type PickByType,
  type RequireKeys,
  type StrictInput,
  type UpdateFn,
  type ValidateBatchGetSize,
  type ValidateBatchWriteSize,
  type ValidateGSIExists,
  type ValidateNestedRelationship,
  type ValidateNoReadonlyFields,
  // Validation utilities
  type ValidateQueryHasPK,
  type ValidateRelationship,
  type ValidateRequiredFields,
  type ValidateSKOperator,
  type ValidateTransactionSize,
} from './types/validation'

// Utilities
export * from './utils'

export {
  type AsyncFullValidationResult,
  type AsyncValidationContext,
  type AsyncValidationRule,
  type AsyncValidationRuleDefinition,
  // Async validation
  AsyncValidator,
  type AsyncValidatorOptions,
  cachedAsync,
  createAsyncValidator,
  debouncedAsync,
  existsAsync,
  uniqueAsync,
} from './validation/AsyncValidator'

export {
  createModelValidator,
  ModelValidationError,
  type ModelValidationOptions,
  type ModelValidationResult,
  // Model validation
  ModelValidator,
  validateModel,
} from './validation/ModelValidator'

export {
  alpha,
  alphaDash,
  alphaNumeric,
  array as arrayRule,
  between,
  boolean as booleanRule,
  confirmed,
  custom,
  date as dateRule,
  different,
  email as emailRule,
  endsWith,
  integer,
  max,
  maxLength,
  min,
  minLength,
  negative,
  nullable,
  number as numberRule,
  object as objectRule,
  oneOf,
  pattern,
  positive,
  required,
  // Built-in rules
  rules,
  same,
  sometimes,
  startsWith,
  string as stringRule,
  unique,
  url as urlRule,
  uuid as uuidRule,
} from './validation/rules'

export {
  createTsValidationRule,
  tsValidation,
  type TsValidationRuleName,
  type TsValidationRuleOptions,
  // ts-validation integration
  TsValidationRules,
} from './validation/TsValidationIntegration'

// Validation System (Async Rules & ts-validation Integration)
export {
  createValidator,
  type FullValidationResult,
  type ValidationContext,
  ValidationFailedError,
  type ValidationResult,
  type ValidationRule,
  type ValidationRuleDefinition,
  // Core validation
  Validator,
  type ValidatorOptions,
} from './validation/Validator'
