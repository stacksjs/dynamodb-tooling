// ============================================================================
// DynamoDB Error Types - Discriminated Union
// ============================================================================

/**
 * Base DynamoDB error with discriminant
 */
export interface BaseDynamoDBError {
  readonly name: string
  readonly message: string
  readonly code: string
  readonly statusCode?: number
  readonly requestId?: string
  readonly retryable: boolean
}

// ============================================================================
// Error Code Union
// ============================================================================

/**
 * All possible DynamoDB error codes
 */
export type DynamoDBErrorCode =
  | 'ItemNotFound'
  | 'ValidationError'
  | 'ConditionalCheckFailed'
  | 'TransactionCancelled'
  | 'ProvisionedThroughputExceeded'
  | 'ResourceNotFound'
  | 'ResourceInUse'
  | 'ItemCollectionSizeLimitExceeded'
  | 'RequestLimitExceeded'
  | 'InternalServerError'
  | 'ServiceUnavailable'
  | 'ThrottlingError'
  | 'UnknownError'

// ============================================================================
// Specific Error Types
// ============================================================================

/**
 * Item not found error - includes model type
 */
export class ItemNotFoundError<TModel extends string = string> extends Error {
  readonly code = 'ItemNotFound' as const
  readonly model: TModel
  readonly keys: { pk: string, sk?: string }
  readonly retryable = false
  readonly statusCode = 404

  constructor(model: TModel, keys: { pk: string, sk?: string }) {
    super(`${model} not found with keys: pk=${keys.pk}${keys.sk ? `, sk=${keys.sk}` : ''}`)
    this.name = 'ItemNotFoundError'
    this.model = model
    this.keys = keys
  }
}

/**
 * Validation error with typed field errors
 */
export class DynamoDBValidationError extends Error {
  readonly code = 'ValidationError' as const
  readonly model: string
  readonly fieldErrors: Record<string, string[]>
  readonly retryable = false
  readonly statusCode = 400

  constructor(model: string, fieldErrors: Record<string, string[]>) {
    const messages = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
      .join('; ')
    super(`Validation failed for ${model}: ${messages}`)
    this.name = 'DynamoDBValidationError'
    this.model = model
    this.fieldErrors = fieldErrors
  }

  /**
   * Check if a specific field has errors
   */
  hasFieldError(field: string): boolean {
    return field in this.fieldErrors && this.fieldErrors[field].length > 0
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(field: string): string[] {
    return this.fieldErrors[field] || []
  }

  /**
   * Get all field names with errors
   */
  getErrorFields(): string[] {
    return Object.keys(this.fieldErrors)
  }
}

/**
 * Conditional check failed error (optimistic locking)
 */
export class ConditionalCheckFailedError extends Error {
  readonly code = 'ConditionalCheckFailed' as const
  readonly model: string
  readonly condition?: string
  readonly expectedVersion?: number
  readonly actualVersion?: number
  readonly retryable = false
  readonly statusCode = 409

  constructor(
    model: string,
    options?: {
      condition?: string
      expectedVersion?: number
      actualVersion?: number
    },
  ) {
    const message = options?.expectedVersion
      ? `Conditional check failed for ${model}. Expected version: ${options.expectedVersion}, Actual: ${options.actualVersion}`
      : `Conditional check failed for ${model}${options?.condition ? `: ${options.condition}` : ''}`

    super(message)
    this.name = 'ConditionalCheckFailedError'
    this.model = model
    this.condition = options?.condition
    this.expectedVersion = options?.expectedVersion
    this.actualVersion = options?.actualVersion
  }
}

/**
 * Transaction cancellation reason
 */
export interface TransactionCancellationReason {
  Code: 'None' | 'ConditionalCheckFailed' | 'ItemCollectionSizeLimitExceeded' | 'TransactionConflict' | 'ProvisionedThroughputExceeded' | 'ThrottlingError' | 'ValidationError'
  Message?: string
  Item?: Record<string, unknown>
}

/**
 * Transaction cancelled error with per-item reasons
 */
export class TransactionCancelledError extends Error {
  readonly code = 'TransactionCancelled' as const
  readonly cancellationReasons: TransactionCancellationReason[]
  readonly retryable: boolean
  readonly statusCode = 400

  constructor(cancellationReasons: TransactionCancellationReason[]) {
    const failedReasons = cancellationReasons.filter(r => r.Code !== 'None')
    const summary = failedReasons.map((r, i) => `Item ${i}: ${r.Code}${r.Message ? ` - ${r.Message}` : ''}`).join('; ')
    super(`Transaction cancelled: ${summary || 'Unknown reason'}`)
    this.name = 'TransactionCancelledError'
    this.cancellationReasons = cancellationReasons

    // Retryable if any reason is transient
    this.retryable = cancellationReasons.some(r =>
      r.Code === 'ProvisionedThroughputExceeded'
      || r.Code === 'ThrottlingError'
      || r.Code === 'TransactionConflict',
    )
  }

  /**
   * Get items that failed due to conditional check
   */
  getConditionalCheckFailures(): number[] {
    return this.cancellationReasons
      .map((r, i) => (r.Code === 'ConditionalCheckFailed' ? i : -1))
      .filter(i => i >= 0)
  }

  /**
   * Check if transaction failed due to conflict
   */
  isConflict(): boolean {
    return this.cancellationReasons.some(r => r.Code === 'TransactionConflict')
  }
}

/**
 * Provisioned throughput exceeded error
 */
export class ProvisionedThroughputExceededError extends Error {
  readonly code = 'ProvisionedThroughputExceeded' as const
  readonly tableName: string
  readonly retryable = true
  readonly statusCode = 400
  readonly retryAfterMs?: number

  constructor(tableName: string, retryAfterMs?: number) {
    super(`Provisioned throughput exceeded for table: ${tableName}`)
    this.name = 'ProvisionedThroughputExceededError'
    this.tableName = tableName
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Resource not found error (table doesn't exist)
 */
export class ResourceNotFoundError extends Error {
  readonly code = 'ResourceNotFound' as const
  readonly resourceType: 'Table' | 'Index' | 'Backup'
  readonly resourceName: string
  readonly retryable = false
  readonly statusCode = 404

  constructor(resourceType: 'Table' | 'Index' | 'Backup', resourceName: string) {
    super(`${resourceType} not found: ${resourceName}`)
    this.name = 'ResourceNotFoundError'
    this.resourceType = resourceType
    this.resourceName = resourceName
  }
}

/**
 * Resource in use error (table being created/deleted)
 */
export class ResourceInUseError extends Error {
  readonly code = 'ResourceInUse' as const
  readonly resourceName: string
  readonly status: string
  readonly retryable = true
  readonly statusCode = 400

  constructor(resourceName: string, status: string) {
    super(`Resource in use: ${resourceName} (status: ${status})`)
    this.name = 'ResourceInUseError'
    this.resourceName = resourceName
    this.status = status
  }
}

/**
 * Item collection size limit exceeded error
 */
export class ItemCollectionSizeLimitExceededError extends Error {
  readonly code = 'ItemCollectionSizeLimitExceeded' as const
  readonly tableName: string
  readonly partitionKey: string
  readonly retryable = false
  readonly statusCode = 400

  constructor(tableName: string, partitionKey: string) {
    super(`Item collection size limit exceeded for partition: ${partitionKey} in table: ${tableName}`)
    this.name = 'ItemCollectionSizeLimitExceededError'
    this.tableName = tableName
    this.partitionKey = partitionKey
  }
}

/**
 * Request limit exceeded error
 */
export class RequestLimitExceededError extends Error {
  readonly code = 'RequestLimitExceeded' as const
  readonly retryable = true
  readonly statusCode = 400
  readonly retryAfterMs?: number

  constructor(retryAfterMs?: number) {
    super('Request limit exceeded. Too many requests in flight.')
    this.name = 'RequestLimitExceededError'
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Throttling error
 */
export class ThrottlingError extends Error {
  readonly code = 'ThrottlingError' as const
  readonly retryable = true
  readonly statusCode = 400
  readonly retryAfterMs?: number

  constructor(message?: string, retryAfterMs?: number) {
    super(message || 'Request throttled')
    this.name = 'ThrottlingError'
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Internal server error
 */
export class DynamoDBInternalError extends Error {
  readonly code = 'InternalServerError' as const
  readonly retryable = true
  readonly statusCode = 500
  readonly requestId?: string

  constructor(message?: string, requestId?: string) {
    super(message || 'Internal server error')
    this.name = 'DynamoDBInternalError'
    this.requestId = requestId
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends Error {
  readonly code = 'ServiceUnavailable' as const
  readonly retryable = true
  readonly statusCode = 503
  readonly retryAfterMs?: number

  constructor(retryAfterMs?: number) {
    super('DynamoDB service temporarily unavailable')
    this.name = 'ServiceUnavailableError'
    this.retryAfterMs = retryAfterMs
  }
}

// ============================================================================
// Discriminated Union Type
// ============================================================================

/**
 * Union of all DynamoDB errors
 */
export type DynamoDBError =
  | ItemNotFoundError
  | DynamoDBValidationError
  | ConditionalCheckFailedError
  | TransactionCancelledError
  | ProvisionedThroughputExceededError
  | ResourceNotFoundError
  | ResourceInUseError
  | ItemCollectionSizeLimitExceededError
  | RequestLimitExceededError
  | ThrottlingError
  | DynamoDBInternalError
  | ServiceUnavailableError

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is an ItemNotFoundError
 */
export function isItemNotFoundError<T extends string = string>(
  error: unknown,
): error is ItemNotFoundError<T> {
  return error instanceof ItemNotFoundError
}

/**
 * Check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is DynamoDBValidationError {
  return error instanceof DynamoDBValidationError
}

/**
 * Check if error is a ConditionalCheckFailedError
 */
export function isConditionalCheckFailedError(error: unknown): error is ConditionalCheckFailedError {
  return error instanceof ConditionalCheckFailedError
}

/**
 * Check if error is a TransactionCancelledError
 */
export function isTransactionCancelledError(error: unknown): error is TransactionCancelledError {
  return error instanceof TransactionCancelledError
}

/**
 * Check if error is a ProvisionedThroughputExceededError
 */
export function isProvisionedThroughputExceededError(
  error: unknown,
): error is ProvisionedThroughputExceededError {
  return error instanceof ProvisionedThroughputExceededError
}

/**
 * Check if error is a ResourceNotFoundError
 */
export function isResourceNotFoundError(error: unknown): error is ResourceNotFoundError {
  return error instanceof ResourceNotFoundError
}

/**
 * Check if error is a ResourceInUseError
 */
export function isResourceInUseError(error: unknown): error is ResourceInUseError {
  return error instanceof ResourceInUseError
}

/**
 * Check if error is a ThrottlingError
 */
export function isThrottlingError(error: unknown): error is ThrottlingError {
  return error instanceof ThrottlingError
}

/**
 * Check if error is any DynamoDB error
 */
export function isDynamoDBError(error: unknown): error is DynamoDBError {
  return (
    isItemNotFoundError(error)
    || isValidationError(error)
    || isConditionalCheckFailedError(error)
    || isTransactionCancelledError(error)
    || isProvisionedThroughputExceededError(error)
    || isResourceNotFoundError(error)
    || isResourceInUseError(error)
    || error instanceof ItemCollectionSizeLimitExceededError
    || error instanceof RequestLimitExceededError
    || isThrottlingError(error)
    || error instanceof DynamoDBInternalError
    || error instanceof ServiceUnavailableError
  )
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isDynamoDBError(error)) {
    return error.retryable
  }
  return false
}

/**
 * Get retry delay from error (if applicable)
 */
export function getRetryDelayMs(error: unknown): number | undefined {
  if (error instanceof ProvisionedThroughputExceededError)
    return error.retryAfterMs
  if (error instanceof RequestLimitExceededError)
    return error.retryAfterMs
  if (error instanceof ThrottlingError)
    return error.retryAfterMs
  if (error instanceof ServiceUnavailableError)
    return error.retryAfterMs
  return undefined
}

// ============================================================================
// Error Factory
// ============================================================================

/**
 * Create appropriate error from AWS error response
 */
export function createDynamoDBError(
  awsError: { name?: string, code?: string, message?: string, $metadata?: { httpStatusCode?: number, requestId?: string } },
): DynamoDBError | Error {
  const code = awsError.code || awsError.name || ''
  const message = awsError.message || 'Unknown error'
  const statusCode = awsError.$metadata?.httpStatusCode
  const requestId = awsError.$metadata?.requestId

  switch (code) {
    case 'ConditionalCheckFailedException':
      return new ConditionalCheckFailedError('Unknown', { condition: message })

    case 'TransactionCanceledException':
      return new TransactionCancelledError([{ Code: 'None', Message: message }])

    case 'ProvisionedThroughputExceededException':
      return new ProvisionedThroughputExceededError('Unknown')

    case 'ResourceNotFoundException':
      return new ResourceNotFoundError('Table', 'Unknown')

    case 'ResourceInUseException':
      return new ResourceInUseError('Unknown', 'Unknown')

    case 'ItemCollectionSizeLimitExceededException':
      return new ItemCollectionSizeLimitExceededError('Unknown', 'Unknown')

    case 'RequestLimitExceeded':
      return new RequestLimitExceededError()

    case 'ThrottlingException':
    case 'Throttling':
      return new ThrottlingError(message)

    case 'InternalServerError':
      return new DynamoDBInternalError(message, requestId)

    case 'ServiceUnavailable':
      return new ServiceUnavailableError()

    case 'ValidationException':
      return new DynamoDBValidationError('Unknown', { _general: [message] })

    default:
      // Return a generic error for unknown codes
      const error = new Error(message)
      error.name = code || 'UnknownDynamoDBError'
      return error
  }
}
