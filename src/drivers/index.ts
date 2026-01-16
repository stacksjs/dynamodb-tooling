// ============================================================================
// Driver Plugin System Exports
// ============================================================================

// DynamoDB Driver
export { createDynamoDBDriver, DynamoDBDriver } from './DynamoDBDriver'

// Registry
export {
  clearDriverRegistry,
  createActiveDriver,
  getActiveDriver,
  getDefaultDriverName,
  getDriver,
  getDriverFactory,
  getDriverRegistryStats,
  getRegisteredDrivers,
  hasDriver,
  registerDriver,
  setActiveDriver,
  setDefaultDriver,
  unregisterDriver,
} from './registry'

// Types - Use Driver prefix to avoid conflicts with other modules
export type {
  BatchGetItemInput,
  BatchGetItemOutput,
  BatchWriteItemInput,
  BatchWriteItemOutput,
  DeleteItemInput,
  AttributeValue as DriverAttributeValue,
  DriverCapabilities,
  DriverConnectionOptions,
  ConsumedCapacity as DriverConsumedCapacity,
  CreateTableInput as DriverCreateTableInput,
  DriverFactory,
  DriverPlugin,
  QueryInput as DriverQueryInput,
  QueryOutput as DriverQueryOutput,
  TableDescription as DriverTableDescription,
  GetItemInput,
  PutItemInput,
  ScanInput,
  TransactGetItemsInput,
  TransactGetItemsOutput,
  TransactWriteItemsInput,
  UpdateItemInput,
  UpdateTableInput,
} from './types'

// Utilities - Use driver prefix to avoid conflicts
export {
  buildFilterExpression as buildDriverFilterExpression,
  buildKeyConditionExpression as buildDriverKeyConditionExpression,
  buildProjectionExpression as buildDriverProjectionExpression,
  buildUpdateExpression as buildDriverUpdateExpression,
  marshallItem as driverMarshallItem,
  marshallValue as driverMarshallValue,
  unmarshallItem as driverUnmarshallItem,
  unmarshallValue as driverUnmarshallValue,
  escapeAttributeName,
  isReservedWord,
  mergeExpressionAttributeNames,
  mergeExpressionAttributeValues,
} from './utils'
