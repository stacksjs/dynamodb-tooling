// ============================================================================
// Driver Plugin Architecture Types
// ============================================================================

import type { DynamoDBItem } from '../single-table/EntityTransformer'

/**
 * Driver capabilities - what features the driver supports
 */
export interface DriverCapabilities {
  /** Supports transactional operations */
  transactions: boolean
  /** Supports batch read/write operations */
  batch: boolean
  /** Supports DynamoDB Streams */
  streams: boolean
  /** Supports Global Secondary Indexes */
  gsi: boolean
  /** Supports Local Secondary Indexes */
  lsi: boolean
  /** Supports PartiQL queries */
  partiql: boolean
  /** Supports Time-to-Live */
  ttl: boolean
  /** Supports consistent reads */
  consistentRead: boolean
  /** Supports conditional writes */
  conditionalWrites: boolean
  /** Supports atomic counters */
  atomicCounters: boolean
  /** Maximum items per batch write */
  maxBatchWriteItems: number
  /** Maximum items per batch read */
  maxBatchReadItems: number
  /** Maximum items per transaction */
  maxTransactionItems: number
}

/**
 * Driver connection options
 */
export interface DriverConnectionOptions {
  /** AWS Region */
  region?: string
  /** Custom endpoint URL (for local development) */
  endpoint?: string
  /** AWS credentials */
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  /** AWS profile name */
  profile?: string
  /** Maximum retries for failed requests */
  maxRetries?: number
  /** Retry mode */
  retryMode?: 'standard' | 'adaptive'
  /** HTTP request timeout in milliseconds */
  timeout?: number
  /** Keep-alive configuration */
  keepAlive?: boolean
  /** Keep-alive timeout in milliseconds */
  keepAliveTimeout?: number
}

/**
 * Query input parameters
 */
export interface QueryInput {
  tableName: string
  indexName?: string
  keyConditionExpression: string
  filterExpression?: string
  projectionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, AttributeValue>
  limit?: number
  exclusiveStartKey?: Record<string, AttributeValue>
  scanIndexForward?: boolean
  consistentRead?: boolean
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * Scan input parameters
 */
export interface ScanInput {
  tableName: string
  indexName?: string
  filterExpression?: string
  projectionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, AttributeValue>
  limit?: number
  exclusiveStartKey?: Record<string, AttributeValue>
  consistentRead?: boolean
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
  segment?: number
  totalSegments?: number
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * Query/Scan output
 */
export interface QueryOutput {
  items: DynamoDBItem[]
  count: number
  scannedCount?: number
  lastEvaluatedKey?: Record<string, AttributeValue>
  consumedCapacity?: ConsumedCapacity
}

/**
 * GetItem input
 */
export interface GetItemInput {
  tableName: string
  key: Record<string, AttributeValue>
  projectionExpression?: string
  expressionAttributeNames?: Record<string, string>
  consistentRead?: boolean
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * PutItem input
 */
export interface PutItemInput {
  tableName: string
  item: Record<string, AttributeValue>
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, AttributeValue>
  returnValues?: 'NONE' | 'ALL_OLD'
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * UpdateItem input
 */
export interface UpdateItemInput {
  tableName: string
  key: Record<string, AttributeValue>
  updateExpression: string
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, AttributeValue>
  returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW'
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * DeleteItem input
 */
export interface DeleteItemInput {
  tableName: string
  key: Record<string, AttributeValue>
  conditionExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, AttributeValue>
  returnValues?: 'NONE' | 'ALL_OLD'
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * BatchGetItem input
 */
export interface BatchGetItemInput {
  requestItems: Record<string, {
    keys: Array<Record<string, AttributeValue>>
    projectionExpression?: string
    expressionAttributeNames?: Record<string, string>
    consistentRead?: boolean
  }>
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * BatchGetItem output
 */
export interface BatchGetItemOutput {
  responses: Record<string, DynamoDBItem[]>
  unprocessedKeys?: Record<string, {
    keys: Array<Record<string, AttributeValue>>
  }>
  consumedCapacity?: ConsumedCapacity[]
}

/**
 * BatchWriteItem input
 */
export interface BatchWriteItemInput {
  requestItems: Record<string, Array<{
    putRequest?: { item: Record<string, AttributeValue> }
    deleteRequest?: { key: Record<string, AttributeValue> }
  }>>
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
  returnItemCollectionMetrics?: 'SIZE' | 'NONE'
}

/**
 * BatchWriteItem output
 */
export interface BatchWriteItemOutput {
  unprocessedItems?: Record<string, Array<{
    putRequest?: { item: Record<string, AttributeValue> }
    deleteRequest?: { key: Record<string, AttributeValue> }
  }>>
  consumedCapacity?: ConsumedCapacity[]
  itemCollectionMetrics?: Record<string, Array<{
    itemCollectionKey: Record<string, AttributeValue>
    sizeEstimateRangeGB: [number, number]
  }>>
}

/**
 * TransactWriteItems input
 */
export interface TransactWriteItemsInput {
  transactItems: Array<{
    put?: {
      tableName: string
      item: Record<string, AttributeValue>
      conditionExpression?: string
      expressionAttributeNames?: Record<string, string>
      expressionAttributeValues?: Record<string, AttributeValue>
    }
    update?: {
      tableName: string
      key: Record<string, AttributeValue>
      updateExpression: string
      conditionExpression?: string
      expressionAttributeNames?: Record<string, string>
      expressionAttributeValues?: Record<string, AttributeValue>
    }
    delete?: {
      tableName: string
      key: Record<string, AttributeValue>
      conditionExpression?: string
      expressionAttributeNames?: Record<string, string>
      expressionAttributeValues?: Record<string, AttributeValue>
    }
    conditionCheck?: {
      tableName: string
      key: Record<string, AttributeValue>
      conditionExpression: string
      expressionAttributeNames?: Record<string, string>
      expressionAttributeValues?: Record<string, AttributeValue>
    }
  }>
  clientRequestToken?: string
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
  returnItemCollectionMetrics?: 'SIZE' | 'NONE'
}

/**
 * TransactGetItems input
 */
export interface TransactGetItemsInput {
  transactItems: Array<{
    get: {
      tableName: string
      key: Record<string, AttributeValue>
      projectionExpression?: string
      expressionAttributeNames?: Record<string, string>
    }
  }>
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * TransactGetItems output
 */
export interface TransactGetItemsOutput {
  responses: Array<{ item?: DynamoDBItem }>
  consumedCapacity?: ConsumedCapacity[]
}

/**
 * Table description
 */
export interface TableDescription {
  tableName: string
  tableStatus: 'CREATING' | 'UPDATING' | 'DELETING' | 'ACTIVE' | 'INACCESSIBLE_ENCRYPTION_CREDENTIALS' | 'ARCHIVING' | 'ARCHIVED'
  keySchema: Array<{
    attributeName: string
    keyType: 'HASH' | 'RANGE'
  }>
  attributeDefinitions: Array<{
    attributeName: string
    attributeType: 'S' | 'N' | 'B'
  }>
  globalSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
    projection: {
      projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
      nonKeyAttributes?: string[]
    }
    indexStatus?: 'CREATING' | 'UPDATING' | 'DELETING' | 'ACTIVE'
    provisionedThroughput?: {
      readCapacityUnits: number
      writeCapacityUnits: number
    }
  }>
  localSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
    projection: {
      projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
      nonKeyAttributes?: string[]
    }
  }>
  billingModeSummary?: {
    billingMode: 'PROVISIONED' | 'PAY_PER_REQUEST'
  }
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  tableArn?: string
  itemCount?: number
  tableSizeBytes?: number
  creationDateTime?: Date
  streamSpecification?: {
    streamEnabled: boolean
    streamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
  }
  ttlDescription?: {
    attributeName?: string
    status?: 'ENABLING' | 'DISABLING' | 'ENABLED' | 'DISABLED'
  }
}

/**
 * Create table input
 */
export interface CreateTableInput {
  tableName: string
  keySchema: Array<{
    attributeName: string
    keyType: 'HASH' | 'RANGE'
  }>
  attributeDefinitions: Array<{
    attributeName: string
    attributeType: 'S' | 'N' | 'B'
  }>
  billingMode?: 'PROVISIONED' | 'PAY_PER_REQUEST'
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  globalSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
    projection: {
      projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
      nonKeyAttributes?: string[]
    }
    provisionedThroughput?: {
      readCapacityUnits: number
      writeCapacityUnits: number
    }
  }>
  localSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
    projection: {
      projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
      nonKeyAttributes?: string[]
    }
  }>
  streamSpecification?: {
    streamEnabled: boolean
    streamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
  }
  tags?: Array<{ key: string, value: string }>
  tableClass?: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'
  deletionProtectionEnabled?: boolean
}

/**
 * Update table input
 */
export interface UpdateTableInput {
  tableName: string
  attributeDefinitions?: Array<{
    attributeName: string
    attributeType: 'S' | 'N' | 'B'
  }>
  billingMode?: 'PROVISIONED' | 'PAY_PER_REQUEST'
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  globalSecondaryIndexUpdates?: Array<{
    create?: {
      indexName: string
      keySchema: Array<{
        attributeName: string
        keyType: 'HASH' | 'RANGE'
      }>
      projection: {
        projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
        nonKeyAttributes?: string[]
      }
      provisionedThroughput?: {
        readCapacityUnits: number
        writeCapacityUnits: number
      }
    }
    update?: {
      indexName: string
      provisionedThroughput: {
        readCapacityUnits: number
        writeCapacityUnits: number
      }
    }
    delete?: {
      indexName: string
    }
  }>
  streamSpecification?: {
    streamEnabled: boolean
    streamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
  }
  tableClass?: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'
  deletionProtectionEnabled?: boolean
}

/**
 * DynamoDB attribute value types
 */
export interface AttributeValue {
  S?: string
  N?: string
  B?: Uint8Array | string
  SS?: string[]
  NS?: string[]
  BS?: Array<Uint8Array | string>
  M?: Record<string, AttributeValue>
  L?: AttributeValue[]
  NULL?: boolean
  BOOL?: boolean
}

/**
 * Consumed capacity information
 */
export interface ConsumedCapacity {
  tableName?: string
  capacityUnits?: number
  readCapacityUnits?: number
  writeCapacityUnits?: number
  table?: {
    capacityUnits?: number
    readCapacityUnits?: number
    writeCapacityUnits?: number
  }
  localSecondaryIndexes?: Record<string, {
    capacityUnits?: number
    readCapacityUnits?: number
    writeCapacityUnits?: number
  }>
  globalSecondaryIndexes?: Record<string, {
    capacityUnits?: number
    readCapacityUnits?: number
    writeCapacityUnits?: number
  }>
}

/**
 * Driver plugin interface - implement this to create a custom driver
 */
export interface DriverPlugin {
  /** Driver name (e.g., 'dynamodb', 'dynamodb-local') */
  name: string

  /** Driver version */
  version: string

  /** Get driver capabilities */
  getCapabilities: () => DriverCapabilities

  /** Validate driver-specific configuration */
  validateConfig: (options: DriverConnectionOptions) => { valid: boolean, errors: string[] }

  /** Connect to the database */
  connect: (options: DriverConnectionOptions) => Promise<void>

  /** Disconnect from the database */
  disconnect: () => Promise<void>

  /** Check connection health */
  healthCheck: () => Promise<{ healthy: boolean, latencyMs: number, error?: string }>

  /** Check if connected */
  isConnected: () => boolean

  // ---- Item Operations ----

  /** Get a single item */
  getItem: (input: GetItemInput) => Promise<DynamoDBItem | null>

  /** Put a single item */
  putItem: (input: PutItemInput) => Promise<{ attributes?: DynamoDBItem, consumedCapacity?: ConsumedCapacity }>

  /** Update a single item */
  updateItem: (input: UpdateItemInput) => Promise<{ attributes?: DynamoDBItem, consumedCapacity?: ConsumedCapacity }>

  /** Delete a single item */
  deleteItem: (input: DeleteItemInput) => Promise<{ attributes?: DynamoDBItem, consumedCapacity?: ConsumedCapacity }>

  // ---- Query Operations ----

  /** Query items */
  query: (input: QueryInput) => Promise<QueryOutput>

  /** Scan items */
  scan: (input: ScanInput) => Promise<QueryOutput>

  // ---- Batch Operations ----

  /** Batch get items */
  batchGetItem: (input: BatchGetItemInput) => Promise<BatchGetItemOutput>

  /** Batch write items */
  batchWriteItem: (input: BatchWriteItemInput) => Promise<BatchWriteItemOutput>

  // ---- Transaction Operations ----

  /** Transactional write */
  transactWriteItems: (input: TransactWriteItemsInput) => Promise<{ consumedCapacity?: ConsumedCapacity[] }>

  /** Transactional get */
  transactGetItems: (input: TransactGetItemsInput) => Promise<TransactGetItemsOutput>

  // ---- Table Operations ----

  /** Create a table */
  createTable: (input: CreateTableInput) => Promise<TableDescription>

  /** Delete a table */
  deleteTable: (tableName: string) => Promise<void>

  /** Describe a table */
  describeTable: (tableName: string) => Promise<TableDescription>

  /** List tables */
  listTables: (options?: { limit?: number, exclusiveStartTableName?: string }) => Promise<{ tableNames: string[], lastEvaluatedTableName?: string }>

  /** Update a table */
  updateTable: (input: UpdateTableInput) => Promise<TableDescription>

  /** Wait for table to become active */
  waitForTableActive: (tableName: string, options?: { maxWaitTime?: number, checkInterval?: number }) => Promise<void>

  /** Wait for table to be deleted */
  waitForTableDeleted: (tableName: string, options?: { maxWaitTime?: number, checkInterval?: number }) => Promise<void>

  // ---- PartiQL Operations (optional) ----

  /** Execute a PartiQL statement */
  executeStatement?: (statement: string, parameters?: AttributeValue[]) => Promise<{ items: DynamoDBItem[], nextToken?: string }>

  /** Execute multiple PartiQL statements in a batch */
  batchExecuteStatement?: (statements: Array<{ statement: string, parameters?: AttributeValue[] }>) => Promise<Array<{ item?: DynamoDBItem, error?: string }>>

  /** Execute PartiQL statements in a transaction */
  executeTransaction?: (statements: Array<{ statement: string, parameters?: AttributeValue[] }>) => Promise<{ responses: Array<{ item?: DynamoDBItem }> }>
}

/**
 * Driver factory function type
 */
export type DriverFactory = (_options?: DriverConnectionOptions) => DriverPlugin
