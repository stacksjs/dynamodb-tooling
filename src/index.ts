// Configuration
export * from './config'
// DynamoDB Local
export * from './dynamodb'

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

// Utilities
export * from './utils'
