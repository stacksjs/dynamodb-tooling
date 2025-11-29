// ============================================================================
// DynamoDB-Specific Type Safety
// ============================================================================

// ============================================================================
// DynamoDB Attribute Value Types
// ============================================================================

/**
 * String attribute value
 */
export interface StringAttributeValue {
  S: string
}

/**
 * Number attribute value (stored as string in DynamoDB)
 */
export interface NumberAttributeValue {
  N: string
}

/**
 * Binary attribute value
 */
export interface BinaryAttributeValue {
  B: Uint8Array | string
}

/**
 * Boolean attribute value
 */
export interface BooleanAttributeValue {
  BOOL: boolean
}

/**
 * Null attribute value
 */
export interface NullAttributeValue {
  NULL: true
}

/**
 * Map attribute value (nested object)
 */
export interface MapAttributeValue {
  M: Record<string, AttributeValue>
}

/**
 * List attribute value
 */
export interface ListAttributeValue {
  L: AttributeValue[]
}

/**
 * String set attribute value
 */
export interface StringSetAttributeValue {
  SS: string[]
}

/**
 * Number set attribute value
 */
export interface NumberSetAttributeValue {
  NS: string[]
}

/**
 * Binary set attribute value
 */
export interface BinarySetAttributeValue {
  BS: Array<Uint8Array | string>
}

/**
 * Discriminated union of all DynamoDB attribute value types
 */
export type AttributeValue =
  | StringAttributeValue
  | NumberAttributeValue
  | BinaryAttributeValue
  | BooleanAttributeValue
  | NullAttributeValue
  | MapAttributeValue
  | ListAttributeValue
  | StringSetAttributeValue
  | NumberSetAttributeValue
  | BinarySetAttributeValue

// ============================================================================
// Type Guards for Attribute Values
// ============================================================================

/**
 * Check if attribute value is a string
 */
export function isStringValue(value: AttributeValue): value is StringAttributeValue {
  return 'S' in value
}

/**
 * Check if attribute value is a number
 */
export function isNumberValue(value: AttributeValue): value is NumberAttributeValue {
  return 'N' in value
}

/**
 * Check if attribute value is binary
 */
export function isBinaryValue(value: AttributeValue): value is BinaryAttributeValue {
  return 'B' in value
}

/**
 * Check if attribute value is a boolean
 */
export function isBooleanValue(value: AttributeValue): value is BooleanAttributeValue {
  return 'BOOL' in value
}

/**
 * Check if attribute value is null
 */
export function isNullValue(value: AttributeValue): value is NullAttributeValue {
  return 'NULL' in value
}

/**
 * Check if attribute value is a map
 */
export function isMapValue(value: AttributeValue): value is MapAttributeValue {
  return 'M' in value
}

/**
 * Check if attribute value is a list
 */
export function isListValue(value: AttributeValue): value is ListAttributeValue {
  return 'L' in value
}

/**
 * Check if attribute value is a string set
 */
export function isStringSetValue(value: AttributeValue): value is StringSetAttributeValue {
  return 'SS' in value
}

/**
 * Check if attribute value is a number set
 */
export function isNumberSetValue(value: AttributeValue): value is NumberSetAttributeValue {
  return 'NS' in value
}

/**
 * Check if attribute value is a binary set
 */
export function isBinarySetValue(value: AttributeValue): value is BinarySetAttributeValue {
  return 'BS' in value
}

// ============================================================================
// DynamoDB Item Types
// ============================================================================

/**
 * Raw DynamoDB item (marshalled format)
 */
export type DynamoDBItem = Record<string, AttributeValue>

/**
 * Type-safe DynamoDB item with known schema
 */
export type TypedDynamoDBItem<T extends Record<string, unknown>> = {
  [K in keyof T]: JSToAttributeValue<T[K]>
}

// ============================================================================
// Marshalling Types
// ============================================================================

/**
 * Map JavaScript type to AttributeValue type
 */
export type JSToAttributeValue<T> = T extends string
  ? StringAttributeValue
  : T extends number
    ? NumberAttributeValue
    : T extends boolean
      ? BooleanAttributeValue
      : T extends null
        ? NullAttributeValue
        : T extends Uint8Array
          ? BinaryAttributeValue
          : T extends Set<string>
            ? StringSetAttributeValue
            : T extends Set<number>
              ? NumberSetAttributeValue
              : T extends Set<Uint8Array>
                ? BinarySetAttributeValue
                : T extends Array<infer U>
                  ? ListAttributeValue & { L: Array<JSToAttributeValue<U>> }
                  : T extends Record<string, unknown>
                    ? MapAttributeValue
                    : never

/**
 * Map AttributeValue type back to JavaScript type
 */
export type AttributeValueToJS<V extends AttributeValue> = V extends StringAttributeValue
  ? string
  : V extends NumberAttributeValue
    ? number
    : V extends BooleanAttributeValue
      ? boolean
      : V extends NullAttributeValue
        ? null
        : V extends BinaryAttributeValue
          ? Uint8Array
          : V extends StringSetAttributeValue
            ? Set<string>
            : V extends NumberSetAttributeValue
              ? Set<number>
              : V extends BinarySetAttributeValue
                ? Set<Uint8Array>
                : V extends ListAttributeValue
                  ? unknown[]
                  : V extends MapAttributeValue
                    ? Record<string, unknown>
                    : never

// ============================================================================
// Type-Safe Marshall/Unmarshall
// ============================================================================

/**
 * Type-safe marshall function signature
 */
export type Marshall<T extends Record<string, unknown>> = (obj: T) => TypedDynamoDBItem<T>

/**
 * Type-safe unmarshall function signature
 */
export type Unmarshall<T extends Record<string, unknown>> = (item: TypedDynamoDBItem<T>) => T

// ============================================================================
// Expression Builder Types
// ============================================================================

/**
 * Key condition expression with type-safe attribute references
 */
export interface KeyConditionExpression<T extends Record<string, unknown>> {
  expression: string
  attributeNames: Record<string, keyof T>
  attributeValues: Partial<TypedDynamoDBItem<T>>
}

/**
 * Filter expression with type-safe attribute references
 */
export interface FilterExpression<T extends Record<string, unknown>> {
  expression: string
  attributeNames: Record<string, keyof T>
  attributeValues: Partial<TypedDynamoDBItem<T>>
}

/**
 * Update expression types
 */
export type UpdateExpressionAction = 'SET' | 'REMOVE' | 'ADD' | 'DELETE'

/**
 * Type-safe update expression
 */
export interface UpdateExpression<T extends Record<string, unknown>> {
  expression: string
  attributeNames: Record<string, keyof T>
  attributeValues: Partial<TypedDynamoDBItem<T>>
  action: UpdateExpressionAction
}

/**
 * Projection expression from select()
 */
export interface ProjectionExpression<T extends Record<string, unknown>, K extends keyof T = keyof T> {
  expression: string
  attributeNames: Record<string, K>
}

// ============================================================================
// Query/Scan Input Types
// ============================================================================

/**
 * Type-safe Query input
 */
export interface TypedQueryInput<T extends Record<string, unknown>> {
  TableName: string
  IndexName?: string
  KeyConditionExpression: string
  FilterExpression?: string
  ProjectionExpression?: string
  ExpressionAttributeNames?: Record<string, keyof T & string>
  ExpressionAttributeValues?: Partial<TypedDynamoDBItem<T>>
  Limit?: number
  ExclusiveStartKey?: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>
  ScanIndexForward?: boolean
  ConsistentRead?: boolean
  Select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
}

/**
 * Type-safe Scan input
 */
export interface TypedScanInput<T extends Record<string, unknown>> {
  TableName: string
  IndexName?: string
  FilterExpression?: string
  ProjectionExpression?: string
  ExpressionAttributeNames?: Record<string, keyof T & string>
  ExpressionAttributeValues?: Partial<TypedDynamoDBItem<T>>
  Limit?: number
  ExclusiveStartKey?: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>
  ConsistentRead?: boolean
  Select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
  Segment?: number
  TotalSegments?: number
}

/**
 * Type-safe Query output
 */
export interface TypedQueryOutput<T extends Record<string, unknown>> {
  Items?: Array<TypedDynamoDBItem<T>>
  Count?: number
  ScannedCount?: number
  LastEvaluatedKey?: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>
  ConsumedCapacity?: {
    TableName: string
    CapacityUnits: number
    ReadCapacityUnits?: number
    WriteCapacityUnits?: number
    Table?: { CapacityUnits: number }
    GlobalSecondaryIndexes?: Record<string, { CapacityUnits: number }>
    LocalSecondaryIndexes?: Record<string, { CapacityUnits: number }>
  }
}

// ============================================================================
// Write Operation Types
// ============================================================================

/**
 * Type-safe PutItem input
 */
export interface TypedPutItemInput<T extends Record<string, unknown>> {
  TableName: string
  Item: TypedDynamoDBItem<T>
  ConditionExpression?: string
  ExpressionAttributeNames?: Record<string, keyof T & string>
  ExpressionAttributeValues?: Partial<TypedDynamoDBItem<T>>
  ReturnValues?: 'NONE' | 'ALL_OLD'
}

/**
 * Type-safe UpdateItem input
 */
export interface TypedUpdateItemInput<T extends Record<string, unknown>> {
  TableName: string
  Key: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>
  UpdateExpression: string
  ConditionExpression?: string
  ExpressionAttributeNames?: Record<string, keyof T & string>
  ExpressionAttributeValues?: Partial<TypedDynamoDBItem<T>>
  ReturnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW'
}

/**
 * Type-safe DeleteItem input
 */
export interface TypedDeleteItemInput<T extends Record<string, unknown>> {
  TableName: string
  Key: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>
  ConditionExpression?: string
  ExpressionAttributeNames?: Record<string, keyof T & string>
  ExpressionAttributeValues?: Partial<TypedDynamoDBItem<T>>
  ReturnValues?: 'NONE' | 'ALL_OLD'
}

// ============================================================================
// Batch Operation Types
// ============================================================================

/**
 * Batch write request item
 */
export interface BatchWriteRequest<T extends Record<string, unknown>> {
  PutRequest?: { Item: TypedDynamoDBItem<T> }
  DeleteRequest?: { Key: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'> }
}

/**
 * Type-safe BatchWriteItem input
 */
export interface TypedBatchWriteInput<T extends Record<string, unknown>> {
  RequestItems: Record<string, Array<BatchWriteRequest<T>>>
}

/**
 * Type-safe BatchGetItem input
 */
export interface TypedBatchGetInput<T extends Record<string, unknown>> {
  RequestItems: Record<string, {
    Keys: Array<Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>>
    ProjectionExpression?: string
    ExpressionAttributeNames?: Record<string, keyof T & string>
    ConsistentRead?: boolean
  }>
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction write item types
 */
export interface TransactWriteItem<T extends Record<string, unknown>> {
  Put?: TypedPutItemInput<T>
  Update?: TypedUpdateItemInput<T>
  Delete?: TypedDeleteItemInput<T>
  ConditionCheck?: {
    TableName: string
    Key: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>
    ConditionExpression: string
    ExpressionAttributeNames?: Record<string, keyof T & string>
    ExpressionAttributeValues?: Partial<TypedDynamoDBItem<T>>
  }
}

/**
 * Transaction get item
 */
export interface TransactGetItem<T extends Record<string, unknown>> {
  Get: {
    TableName: string
    Key: Pick<TypedDynamoDBItem<T>, 'pk' | 'sk'>
    ProjectionExpression?: string
    ExpressionAttributeNames?: Record<string, keyof T & string>
  }
}

/**
 * Type-safe TransactWriteItems input (max 100 items enforced at type level)
 */
export interface TypedTransactWriteInput<T extends Record<string, unknown>> {
  TransactItems: Array<TransactWriteItem<T>> & { length: ValidTransactionLength }
  ClientRequestToken?: string
}

/**
 * Type-safe TransactGetItems input (max 100 items enforced at type level)
 */
export interface TypedTransactGetInput<T extends Record<string, unknown>> {
  TransactItems: Array<TransactGetItem<T>> & { length: ValidTransactionLength }
}

/**
 * Valid transaction length (1-100)
 */
type ValidTransactionLength =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30
  | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40
  | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50
  | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60
  | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70
  | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79 | 80
  | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90
  | 91 | 92 | 93 | 94 | 95 | 96 | 97 | 98 | 99 | 100

/**
 * Valid batch write length (1-25)
 */
type ValidBatchWriteLength =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25

/**
 * Valid batch get length (1-100)
 */
type ValidBatchGetLength = ValidTransactionLength

// ============================================================================
// Return Value Types
// ============================================================================

/**
 * Return values for write operations
 */
export type ReturnValue = 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW'

/**
 * Return consumed capacity options
 */
export type ReturnConsumedCapacityOption = 'NONE' | 'TOTAL' | 'INDEXES'

/**
 * Return item collection metrics options
 */
export type ReturnItemCollectionMetricsOption = 'NONE' | 'SIZE'
