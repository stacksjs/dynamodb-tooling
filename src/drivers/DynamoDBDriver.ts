// ============================================================================
// DynamoDB Driver Implementation
// ============================================================================

import type { DynamoDBItem } from '../single-table/EntityTransformer'
import type {
  AttributeValue,
  BatchGetItemInput,
  BatchGetItemOutput,
  BatchWriteItemInput,
  BatchWriteItemOutput,
  ConsumedCapacity,
  CreateTableInput,
  DeleteItemInput,
  DriverCapabilities,
  DriverConnectionOptions,
  DriverPlugin,
  GetItemInput,
  PutItemInput,
  QueryInput,
  QueryOutput,
  ScanInput,
  TableDescription,
  TransactGetItemsInput,
  TransactGetItemsOutput,
  TransactWriteItemsInput,
  UpdateItemInput,
  UpdateTableInput,
} from './types'
import { unmarshallItem, marshallItem } from './utils'

/**
 * AWS SDK v3 style signing - simplified implementation
 * In production, this would use the actual AWS SDK
 */
async function signRequest(
  request: Request,
  credentials: { accessKeyId: string, secretAccessKey: string, sessionToken?: string },
  region: string,
  service: string,
): Promise<Request> {
  // This is a placeholder - in real implementation, use AWS Signature V4
  const headers = new Headers(request.headers)
  headers.set('X-Amz-Date', new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''))
  headers.set('Authorization', `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/...`)
  if (credentials.sessionToken) {
    headers.set('X-Amz-Security-Token', credentials.sessionToken)
  }
  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
  })
}

/**
 * DynamoDB Driver Implementation
 *
 * Provides a complete implementation of the DriverPlugin interface
 * for interacting with AWS DynamoDB.
 */
export class DynamoDBDriver implements DriverPlugin {
  name = 'dynamodb'
  version = '1.0.0'

  private options: DriverConnectionOptions = {}
  private connected = false
  private endpoint: string = 'https://dynamodb.us-east-1.amazonaws.com'

  constructor(options?: DriverConnectionOptions) {
    if (options) {
      this.options = options
      this.endpoint = options.endpoint ?? `https://dynamodb.${options.region ?? 'us-east-1'}.amazonaws.com`
    }
  }

  getCapabilities(): DriverCapabilities {
    return {
      transactions: true,
      batch: true,
      streams: true,
      gsi: true,
      lsi: true,
      partiql: true,
      ttl: true,
      consistentRead: true,
      conditionalWrites: true,
      atomicCounters: true,
      maxBatchWriteItems: 25,
      maxBatchReadItems: 100,
      maxTransactionItems: 100,
    }
  }

  validateConfig(options: DriverConnectionOptions): { valid: boolean, errors: string[] } {
    const errors: string[] = []

    if (options.credentials) {
      if (!options.credentials.accessKeyId) {
        errors.push('credentials.accessKeyId is required when credentials are provided')
      }
      if (!options.credentials.secretAccessKey) {
        errors.push('credentials.secretAccessKey is required when credentials are provided')
      }
    }

    if (options.maxRetries !== undefined && options.maxRetries < 0) {
      errors.push('maxRetries must be a non-negative number')
    }

    if (options.timeout !== undefined && options.timeout < 0) {
      errors.push('timeout must be a non-negative number')
    }

    return { valid: errors.length === 0, errors }
  }

  async connect(options: DriverConnectionOptions): Promise<void> {
    const validation = this.validateConfig(options)
    if (!validation.valid) {
      throw new Error(`Invalid driver configuration: ${validation.errors.join(', ')}`)
    }

    this.options = options
    this.endpoint = options.endpoint ?? `https://dynamodb.${options.region ?? 'us-east-1'}.amazonaws.com`
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async healthCheck(): Promise<{ healthy: boolean, latencyMs: number, error?: string }> {
    const start = Date.now()
    try {
      await this.listTables({ limit: 1 })
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      }
    }
    catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  // ---- Internal Request Helper ----

  private async makeRequest<T>(action: string, params: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify(params)
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': `DynamoDB_20120810.${action}`,
    }

    let request = new Request(this.endpoint, {
      method: 'POST',
      headers,
      body,
    })

    // Sign request if credentials are provided
    if (this.options.credentials) {
      request = await signRequest(
        request,
        this.options.credentials,
        this.options.region ?? 'us-east-1',
        'dynamodb',
      )
    }

    const response = await fetch(request)

    if (!response.ok) {
      const errorBody = await response.text()
      let errorMessage = `DynamoDB ${action} failed: ${response.status} ${response.statusText}`
      try {
        const parsed = JSON.parse(errorBody)
        errorMessage = parsed.__type ?? parsed.message ?? errorMessage
      }
      catch {
        // Use default error message
      }
      throw new Error(errorMessage)
    }

    return response.json() as Promise<T>
  }

  // ---- Item Operations ----

  async getItem(input: GetItemInput): Promise<DynamoDBItem | null> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
      Key: input.key,
    }

    if (input.projectionExpression) {
      params.ProjectionExpression = input.projectionExpression
    }
    if (input.expressionAttributeNames) {
      params.ExpressionAttributeNames = input.expressionAttributeNames
    }
    if (input.consistentRead !== undefined) {
      params.ConsistentRead = input.consistentRead
    }
    if (input.returnConsumedCapacity) {
      params.ReturnConsumedCapacity = input.returnConsumedCapacity
    }

    const result = await this.makeRequest<{ Item?: Record<string, AttributeValue> }>('GetItem', params)
    return result.Item ? unmarshallItem(result.Item) : null
  }

  async putItem(input: PutItemInput): Promise<{ attributes?: DynamoDBItem, consumedCapacity?: ConsumedCapacity }> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
      Item: input.item,
    }

    if (input.conditionExpression) {
      params.ConditionExpression = input.conditionExpression
    }
    if (input.expressionAttributeNames) {
      params.ExpressionAttributeNames = input.expressionAttributeNames
    }
    if (input.expressionAttributeValues) {
      params.ExpressionAttributeValues = input.expressionAttributeValues
    }
    if (input.returnValues) {
      params.ReturnValues = input.returnValues
    }
    if (input.returnConsumedCapacity) {
      params.ReturnConsumedCapacity = input.returnConsumedCapacity
    }

    const result = await this.makeRequest<{
      Attributes?: Record<string, AttributeValue>
      ConsumedCapacity?: ConsumedCapacity
    }>('PutItem', params)

    return {
      attributes: result.Attributes ? unmarshallItem(result.Attributes) : undefined,
      consumedCapacity: result.ConsumedCapacity,
    }
  }

  async updateItem(input: UpdateItemInput): Promise<{ attributes?: DynamoDBItem, consumedCapacity?: ConsumedCapacity }> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
      Key: input.key,
      UpdateExpression: input.updateExpression,
    }

    if (input.conditionExpression) {
      params.ConditionExpression = input.conditionExpression
    }
    if (input.expressionAttributeNames) {
      params.ExpressionAttributeNames = input.expressionAttributeNames
    }
    if (input.expressionAttributeValues) {
      params.ExpressionAttributeValues = input.expressionAttributeValues
    }
    if (input.returnValues) {
      params.ReturnValues = input.returnValues
    }
    if (input.returnConsumedCapacity) {
      params.ReturnConsumedCapacity = input.returnConsumedCapacity
    }

    const result = await this.makeRequest<{
      Attributes?: Record<string, AttributeValue>
      ConsumedCapacity?: ConsumedCapacity
    }>('UpdateItem', params)

    return {
      attributes: result.Attributes ? unmarshallItem(result.Attributes) : undefined,
      consumedCapacity: result.ConsumedCapacity,
    }
  }

  async deleteItem(input: DeleteItemInput): Promise<{ attributes?: DynamoDBItem, consumedCapacity?: ConsumedCapacity }> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
      Key: input.key,
    }

    if (input.conditionExpression) {
      params.ConditionExpression = input.conditionExpression
    }
    if (input.expressionAttributeNames) {
      params.ExpressionAttributeNames = input.expressionAttributeNames
    }
    if (input.expressionAttributeValues) {
      params.ExpressionAttributeValues = input.expressionAttributeValues
    }
    if (input.returnValues) {
      params.ReturnValues = input.returnValues
    }
    if (input.returnConsumedCapacity) {
      params.ReturnConsumedCapacity = input.returnConsumedCapacity
    }

    const result = await this.makeRequest<{
      Attributes?: Record<string, AttributeValue>
      ConsumedCapacity?: ConsumedCapacity
    }>('DeleteItem', params)

    return {
      attributes: result.Attributes ? unmarshallItem(result.Attributes) : undefined,
      consumedCapacity: result.ConsumedCapacity,
    }
  }

  // ---- Query Operations ----

  async query(input: QueryInput): Promise<QueryOutput> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
      KeyConditionExpression: input.keyConditionExpression,
    }

    if (input.indexName) params.IndexName = input.indexName
    if (input.filterExpression) params.FilterExpression = input.filterExpression
    if (input.projectionExpression) params.ProjectionExpression = input.projectionExpression
    if (input.expressionAttributeNames) params.ExpressionAttributeNames = input.expressionAttributeNames
    if (input.expressionAttributeValues) params.ExpressionAttributeValues = input.expressionAttributeValues
    if (input.limit !== undefined) params.Limit = input.limit
    if (input.exclusiveStartKey) params.ExclusiveStartKey = input.exclusiveStartKey
    if (input.scanIndexForward !== undefined) params.ScanIndexForward = input.scanIndexForward
    if (input.consistentRead !== undefined) params.ConsistentRead = input.consistentRead
    if (input.select) params.Select = input.select
    if (input.returnConsumedCapacity) params.ReturnConsumedCapacity = input.returnConsumedCapacity

    const result = await this.makeRequest<{
      Items?: Array<Record<string, AttributeValue>>
      Count?: number
      ScannedCount?: number
      LastEvaluatedKey?: Record<string, AttributeValue>
      ConsumedCapacity?: ConsumedCapacity
    }>('Query', params)

    return {
      items: (result.Items ?? []).map(item => unmarshallItem(item)),
      count: result.Count ?? 0,
      scannedCount: result.ScannedCount,
      lastEvaluatedKey: result.LastEvaluatedKey,
      consumedCapacity: result.ConsumedCapacity,
    }
  }

  async scan(input: ScanInput): Promise<QueryOutput> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
    }

    if (input.indexName) params.IndexName = input.indexName
    if (input.filterExpression) params.FilterExpression = input.filterExpression
    if (input.projectionExpression) params.ProjectionExpression = input.projectionExpression
    if (input.expressionAttributeNames) params.ExpressionAttributeNames = input.expressionAttributeNames
    if (input.expressionAttributeValues) params.ExpressionAttributeValues = input.expressionAttributeValues
    if (input.limit !== undefined) params.Limit = input.limit
    if (input.exclusiveStartKey) params.ExclusiveStartKey = input.exclusiveStartKey
    if (input.consistentRead !== undefined) params.ConsistentRead = input.consistentRead
    if (input.select) params.Select = input.select
    if (input.segment !== undefined) params.Segment = input.segment
    if (input.totalSegments !== undefined) params.TotalSegments = input.totalSegments
    if (input.returnConsumedCapacity) params.ReturnConsumedCapacity = input.returnConsumedCapacity

    const result = await this.makeRequest<{
      Items?: Array<Record<string, AttributeValue>>
      Count?: number
      ScannedCount?: number
      LastEvaluatedKey?: Record<string, AttributeValue>
      ConsumedCapacity?: ConsumedCapacity
    }>('Scan', params)

    return {
      items: (result.Items ?? []).map(item => unmarshallItem(item)),
      count: result.Count ?? 0,
      scannedCount: result.ScannedCount,
      lastEvaluatedKey: result.LastEvaluatedKey,
      consumedCapacity: result.ConsumedCapacity,
    }
  }

  // ---- Batch Operations ----

  async batchGetItem(input: BatchGetItemInput): Promise<BatchGetItemOutput> {
    const result = await this.makeRequest<{
      Responses?: Record<string, Array<Record<string, AttributeValue>>>
      UnprocessedKeys?: Record<string, { Keys: Array<Record<string, AttributeValue>> }>
      ConsumedCapacity?: ConsumedCapacity[]
    }>('BatchGetItem', {
      RequestItems: input.requestItems,
      ReturnConsumedCapacity: input.returnConsumedCapacity,
    })

    const responses: Record<string, DynamoDBItem[]> = {}
    if (result.Responses) {
      for (const [tableName, items] of Object.entries(result.Responses)) {
        responses[tableName] = items.map(item => unmarshallItem(item))
      }
    }

    return {
      responses,
      unprocessedKeys: result.UnprocessedKeys ? Object.fromEntries(
        Object.entries(result.UnprocessedKeys).map(([table, data]) => [
          table,
          { keys: data.Keys },
        ]),
      ) : undefined,
      consumedCapacity: result.ConsumedCapacity,
    }
  }

  async batchWriteItem(input: BatchWriteItemInput): Promise<BatchWriteItemOutput> {
    const result = await this.makeRequest<{
      UnprocessedItems?: Record<string, Array<{
        PutRequest?: { Item: Record<string, AttributeValue> }
        DeleteRequest?: { Key: Record<string, AttributeValue> }
      }>>
      ConsumedCapacity?: ConsumedCapacity[]
      ItemCollectionMetrics?: Record<string, Array<{
        ItemCollectionKey: Record<string, AttributeValue>
        SizeEstimateRangeGB: [number, number]
      }>>
    }>('BatchWriteItem', {
      RequestItems: input.requestItems,
      ReturnConsumedCapacity: input.returnConsumedCapacity,
      ReturnItemCollectionMetrics: input.returnItemCollectionMetrics,
    })

    return {
      unprocessedItems: result.UnprocessedItems ? Object.fromEntries(
        Object.entries(result.UnprocessedItems).map(([table, items]) => [
          table,
          items.map(item => ({
            putRequest: item.PutRequest ? { item: item.PutRequest.Item } : undefined,
            deleteRequest: item.DeleteRequest ? { key: item.DeleteRequest.Key } : undefined,
          })),
        ]),
      ) : undefined,
      consumedCapacity: result.ConsumedCapacity,
      itemCollectionMetrics: result.ItemCollectionMetrics ? Object.fromEntries(
        Object.entries(result.ItemCollectionMetrics).map(([table, metrics]) => [
          table,
          metrics.map(m => ({
            itemCollectionKey: m.ItemCollectionKey,
            sizeEstimateRangeGB: m.SizeEstimateRangeGB,
          })),
        ]),
      ) : undefined,
    }
  }

  // ---- Transaction Operations ----

  async transactWriteItems(input: TransactWriteItemsInput): Promise<{ consumedCapacity?: ConsumedCapacity[] }> {
    const transactItems = input.transactItems.map((item) => {
      if (item.put) {
        return {
          Put: {
            TableName: item.put.tableName,
            Item: item.put.item,
            ConditionExpression: item.put.conditionExpression,
            ExpressionAttributeNames: item.put.expressionAttributeNames,
            ExpressionAttributeValues: item.put.expressionAttributeValues,
          },
        }
      }
      if (item.update) {
        return {
          Update: {
            TableName: item.update.tableName,
            Key: item.update.key,
            UpdateExpression: item.update.updateExpression,
            ConditionExpression: item.update.conditionExpression,
            ExpressionAttributeNames: item.update.expressionAttributeNames,
            ExpressionAttributeValues: item.update.expressionAttributeValues,
          },
        }
      }
      if (item.delete) {
        return {
          Delete: {
            TableName: item.delete.tableName,
            Key: item.delete.key,
            ConditionExpression: item.delete.conditionExpression,
            ExpressionAttributeNames: item.delete.expressionAttributeNames,
            ExpressionAttributeValues: item.delete.expressionAttributeValues,
          },
        }
      }
      if (item.conditionCheck) {
        return {
          ConditionCheck: {
            TableName: item.conditionCheck.tableName,
            Key: item.conditionCheck.key,
            ConditionExpression: item.conditionCheck.conditionExpression,
            ExpressionAttributeNames: item.conditionCheck.expressionAttributeNames,
            ExpressionAttributeValues: item.conditionCheck.expressionAttributeValues,
          },
        }
      }
      return {}
    })

    const result = await this.makeRequest<{
      ConsumedCapacity?: ConsumedCapacity[]
    }>('TransactWriteItems', {
      TransactItems: transactItems,
      ClientRequestToken: input.clientRequestToken,
      ReturnConsumedCapacity: input.returnConsumedCapacity,
      ReturnItemCollectionMetrics: input.returnItemCollectionMetrics,
    })

    return { consumedCapacity: result.ConsumedCapacity }
  }

  async transactGetItems(input: TransactGetItemsInput): Promise<TransactGetItemsOutput> {
    const transactItems = input.transactItems.map(item => ({
      Get: {
        TableName: item.get.tableName,
        Key: item.get.key,
        ProjectionExpression: item.get.projectionExpression,
        ExpressionAttributeNames: item.get.expressionAttributeNames,
      },
    }))

    const result = await this.makeRequest<{
      Responses?: Array<{ Item?: Record<string, AttributeValue> }>
      ConsumedCapacity?: ConsumedCapacity[]
    }>('TransactGetItems', {
      TransactItems: transactItems,
      ReturnConsumedCapacity: input.returnConsumedCapacity,
    })

    return {
      responses: (result.Responses ?? []).map(r => ({
        item: r.Item ? unmarshallItem(r.Item) : undefined,
      })),
      consumedCapacity: result.ConsumedCapacity,
    }
  }

  // ---- Table Operations ----

  async createTable(input: CreateTableInput): Promise<TableDescription> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
      KeySchema: input.keySchema.map(k => ({
        AttributeName: k.attributeName,
        KeyType: k.keyType,
      })),
      AttributeDefinitions: input.attributeDefinitions.map(a => ({
        AttributeName: a.attributeName,
        AttributeType: a.attributeType,
      })),
    }

    if (input.billingMode) params.BillingMode = input.billingMode
    if (input.provisionedThroughput) {
      params.ProvisionedThroughput = {
        ReadCapacityUnits: input.provisionedThroughput.readCapacityUnits,
        WriteCapacityUnits: input.provisionedThroughput.writeCapacityUnits,
      }
    }
    if (input.globalSecondaryIndexes) {
      params.GlobalSecondaryIndexes = input.globalSecondaryIndexes.map(gsi => ({
        IndexName: gsi.indexName,
        KeySchema: gsi.keySchema.map(k => ({
          AttributeName: k.attributeName,
          KeyType: k.keyType,
        })),
        Projection: {
          ProjectionType: gsi.projection.projectionType,
          NonKeyAttributes: gsi.projection.nonKeyAttributes,
        },
        ProvisionedThroughput: gsi.provisionedThroughput ? {
          ReadCapacityUnits: gsi.provisionedThroughput.readCapacityUnits,
          WriteCapacityUnits: gsi.provisionedThroughput.writeCapacityUnits,
        } : undefined,
      }))
    }
    if (input.localSecondaryIndexes) {
      params.LocalSecondaryIndexes = input.localSecondaryIndexes.map(lsi => ({
        IndexName: lsi.indexName,
        KeySchema: lsi.keySchema.map(k => ({
          AttributeName: k.attributeName,
          KeyType: k.keyType,
        })),
        Projection: {
          ProjectionType: lsi.projection.projectionType,
          NonKeyAttributes: lsi.projection.nonKeyAttributes,
        },
      }))
    }
    if (input.streamSpecification) {
      params.StreamSpecification = {
        StreamEnabled: input.streamSpecification.streamEnabled,
        StreamViewType: input.streamSpecification.streamViewType,
      }
    }
    if (input.tags) {
      params.Tags = input.tags.map(t => ({ Key: t.key, Value: t.value }))
    }
    if (input.tableClass) params.TableClass = input.tableClass
    if (input.deletionProtectionEnabled !== undefined) {
      params.DeletionProtectionEnabled = input.deletionProtectionEnabled
    }

    const result = await this.makeRequest<{
      TableDescription: Record<string, unknown>
    }>('CreateTable', params)

    return this.parseTableDescription(result.TableDescription)
  }

  async deleteTable(tableName: string): Promise<void> {
    await this.makeRequest<unknown>('DeleteTable', { TableName: tableName })
  }

  async describeTable(tableName: string): Promise<TableDescription> {
    const result = await this.makeRequest<{
      Table: Record<string, unknown>
    }>('DescribeTable', { TableName: tableName })

    return this.parseTableDescription(result.Table)
  }

  async listTables(options?: { limit?: number, exclusiveStartTableName?: string }): Promise<{
    tableNames: string[]
    lastEvaluatedTableName?: string
  }> {
    const params: Record<string, unknown> = {}
    if (options?.limit) params.Limit = options.limit
    if (options?.exclusiveStartTableName) params.ExclusiveStartTableName = options.exclusiveStartTableName

    const result = await this.makeRequest<{
      TableNames?: string[]
      LastEvaluatedTableName?: string
    }>('ListTables', params)

    return {
      tableNames: result.TableNames ?? [],
      lastEvaluatedTableName: result.LastEvaluatedTableName,
    }
  }

  async updateTable(input: UpdateTableInput): Promise<TableDescription> {
    const params: Record<string, unknown> = {
      TableName: input.tableName,
    }

    if (input.attributeDefinitions) {
      params.AttributeDefinitions = input.attributeDefinitions.map(a => ({
        AttributeName: a.attributeName,
        AttributeType: a.attributeType,
      }))
    }
    if (input.billingMode) params.BillingMode = input.billingMode
    if (input.provisionedThroughput) {
      params.ProvisionedThroughput = {
        ReadCapacityUnits: input.provisionedThroughput.readCapacityUnits,
        WriteCapacityUnits: input.provisionedThroughput.writeCapacityUnits,
      }
    }
    if (input.globalSecondaryIndexUpdates) {
      params.GlobalSecondaryIndexUpdates = input.globalSecondaryIndexUpdates.map((update) => {
        if (update.create) {
          return {
            Create: {
              IndexName: update.create.indexName,
              KeySchema: update.create.keySchema.map(k => ({
                AttributeName: k.attributeName,
                KeyType: k.keyType,
              })),
              Projection: {
                ProjectionType: update.create.projection.projectionType,
                NonKeyAttributes: update.create.projection.nonKeyAttributes,
              },
              ProvisionedThroughput: update.create.provisionedThroughput ? {
                ReadCapacityUnits: update.create.provisionedThroughput.readCapacityUnits,
                WriteCapacityUnits: update.create.provisionedThroughput.writeCapacityUnits,
              } : undefined,
            },
          }
        }
        if (update.update) {
          return {
            Update: {
              IndexName: update.update.indexName,
              ProvisionedThroughput: {
                ReadCapacityUnits: update.update.provisionedThroughput.readCapacityUnits,
                WriteCapacityUnits: update.update.provisionedThroughput.writeCapacityUnits,
              },
            },
          }
        }
        if (update.delete) {
          return {
            Delete: {
              IndexName: update.delete.indexName,
            },
          }
        }
        return {}
      })
    }
    if (input.streamSpecification) {
      params.StreamSpecification = {
        StreamEnabled: input.streamSpecification.streamEnabled,
        StreamViewType: input.streamSpecification.streamViewType,
      }
    }
    if (input.tableClass) params.TableClass = input.tableClass
    if (input.deletionProtectionEnabled !== undefined) {
      params.DeletionProtectionEnabled = input.deletionProtectionEnabled
    }

    const result = await this.makeRequest<{
      TableDescription: Record<string, unknown>
    }>('UpdateTable', params)

    return this.parseTableDescription(result.TableDescription)
  }

  async waitForTableActive(
    tableName: string,
    options?: { maxWaitTime?: number, checkInterval?: number },
  ): Promise<void> {
    const maxWaitTime = options?.maxWaitTime ?? 300000 // 5 minutes
    const checkInterval = options?.checkInterval ?? 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const description = await this.describeTable(tableName)
      if (description.tableStatus === 'ACTIVE') {
        return
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }

    throw new Error(`Table ${tableName} did not become active within ${maxWaitTime}ms`)
  }

  async waitForTableDeleted(
    tableName: string,
    options?: { maxWaitTime?: number, checkInterval?: number },
  ): Promise<void> {
    const maxWaitTime = options?.maxWaitTime ?? 300000 // 5 minutes
    const checkInterval = options?.checkInterval ?? 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        await this.describeTable(tableName)
        // Table still exists, wait and try again
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
      catch (error) {
        // Table not found means it's deleted
        if (error instanceof Error && error.message.includes('ResourceNotFoundException')) {
          return
        }
        throw error
      }
    }

    throw new Error(`Table ${tableName} was not deleted within ${maxWaitTime}ms`)
  }

  // ---- PartiQL Operations ----

  async executeStatement(statement: string, parameters?: AttributeValue[]): Promise<{
    items: DynamoDBItem[]
    nextToken?: string
  }> {
    const params: Record<string, unknown> = {
      Statement: statement,
    }
    if (parameters) {
      params.Parameters = parameters
    }

    const result = await this.makeRequest<{
      Items?: Array<Record<string, AttributeValue>>
      NextToken?: string
    }>('ExecuteStatement', params)

    return {
      items: (result.Items ?? []).map(item => unmarshallItem(item)),
      nextToken: result.NextToken,
    }
  }

  async batchExecuteStatement(statements: Array<{ statement: string, parameters?: AttributeValue[] }>): Promise<Array<{ item?: DynamoDBItem, error?: string }>> {
    const result = await this.makeRequest<{
      Responses?: Array<{
        Item?: Record<string, AttributeValue>
        Error?: { Code?: string, Message?: string }
      }>
    }>('BatchExecuteStatement', {
      Statements: statements.map(s => ({
        Statement: s.statement,
        Parameters: s.parameters,
      })),
    })

    return (result.Responses ?? []).map(r => ({
      item: r.Item ? unmarshallItem(r.Item) : undefined,
      error: r.Error?.Message,
    }))
  }

  async executeTransaction(statements: Array<{ statement: string, parameters?: AttributeValue[] }>): Promise<{
    responses: Array<{ item?: DynamoDBItem }>
  }> {
    const result = await this.makeRequest<{
      Responses?: Array<{ Item?: Record<string, AttributeValue> }>
    }>('ExecuteTransaction', {
      TransactStatements: statements.map(s => ({
        Statement: s.statement,
        Parameters: s.parameters,
      })),
    })

    return {
      responses: (result.Responses ?? []).map(r => ({
        item: r.Item ? unmarshallItem(r.Item) : undefined,
      })),
    }
  }

  // ---- Helper Methods ----

  private parseTableDescription(data: Record<string, unknown>): TableDescription {
    return {
      tableName: data.TableName as string,
      tableStatus: data.TableStatus as TableDescription['tableStatus'],
      keySchema: (data.KeySchema as Array<{ AttributeName: string, KeyType: string }>)?.map(k => ({
        attributeName: k.AttributeName,
        keyType: k.KeyType as 'HASH' | 'RANGE',
      })) ?? [],
      attributeDefinitions: (data.AttributeDefinitions as Array<{ AttributeName: string, AttributeType: string }>)?.map(a => ({
        attributeName: a.AttributeName,
        attributeType: a.AttributeType as 'S' | 'N' | 'B',
      })) ?? [],
      globalSecondaryIndexes: (data.GlobalSecondaryIndexes as Array<Record<string, unknown>>)?.map(gsi => ({
        indexName: gsi.IndexName as string,
        keySchema: (gsi.KeySchema as Array<{ AttributeName: string, KeyType: string }>)?.map(k => ({
          attributeName: k.AttributeName,
          keyType: k.KeyType as 'HASH' | 'RANGE',
        })) ?? [],
        projection: {
          projectionType: (gsi.Projection as { ProjectionType: string })?.ProjectionType as 'ALL' | 'KEYS_ONLY' | 'INCLUDE',
          nonKeyAttributes: (gsi.Projection as { NonKeyAttributes?: string[] })?.NonKeyAttributes,
        },
        indexStatus: gsi.IndexStatus as 'CREATING' | 'UPDATING' | 'DELETING' | 'ACTIVE' | undefined,
        provisionedThroughput: gsi.ProvisionedThroughput ? {
          readCapacityUnits: (gsi.ProvisionedThroughput as { ReadCapacityUnits: number }).ReadCapacityUnits,
          writeCapacityUnits: (gsi.ProvisionedThroughput as { WriteCapacityUnits: number }).WriteCapacityUnits,
        } : undefined,
      })),
      localSecondaryIndexes: (data.LocalSecondaryIndexes as Array<Record<string, unknown>>)?.map(lsi => ({
        indexName: lsi.IndexName as string,
        keySchema: (lsi.KeySchema as Array<{ AttributeName: string, KeyType: string }>)?.map(k => ({
          attributeName: k.AttributeName,
          keyType: k.KeyType as 'HASH' | 'RANGE',
        })) ?? [],
        projection: {
          projectionType: (lsi.Projection as { ProjectionType: string })?.ProjectionType as 'ALL' | 'KEYS_ONLY' | 'INCLUDE',
          nonKeyAttributes: (lsi.Projection as { NonKeyAttributes?: string[] })?.NonKeyAttributes,
        },
      })),
      billingModeSummary: data.BillingModeSummary ? {
        billingMode: (data.BillingModeSummary as { BillingMode: string }).BillingMode as 'PROVISIONED' | 'PAY_PER_REQUEST',
      } : undefined,
      provisionedThroughput: data.ProvisionedThroughput ? {
        readCapacityUnits: (data.ProvisionedThroughput as { ReadCapacityUnits: number }).ReadCapacityUnits,
        writeCapacityUnits: (data.ProvisionedThroughput as { WriteCapacityUnits: number }).WriteCapacityUnits,
      } : undefined,
      tableArn: data.TableArn as string | undefined,
      itemCount: data.ItemCount as number | undefined,
      tableSizeBytes: data.TableSizeBytes as number | undefined,
      creationDateTime: data.CreationDateTime ? new Date(data.CreationDateTime as string) : undefined,
      streamSpecification: data.StreamSpecification ? {
        streamEnabled: (data.StreamSpecification as { StreamEnabled: boolean }).StreamEnabled,
        streamViewType: (data.StreamSpecification as { StreamViewType?: string }).StreamViewType as 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES' | undefined,
      } : undefined,
      ttlDescription: data.TTLDescription ? {
        attributeName: (data.TTLDescription as { AttributeName?: string }).AttributeName,
        status: (data.TTLDescription as { TimeToLiveStatus?: string }).TimeToLiveStatus as 'ENABLING' | 'DISABLING' | 'ENABLED' | 'DISABLED' | undefined,
      } : undefined,
    }
  }
}

/**
 * Create a DynamoDB driver instance
 */
export function createDynamoDBDriver(options?: DriverConnectionOptions): DriverPlugin {
  return new DynamoDBDriver(options)
}
