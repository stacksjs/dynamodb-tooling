// ============================================================================
// Driver Plugin System Exports
// ============================================================================

// Types - Use Driver prefix to avoid conflicts with other modules
export type {
  AttributeValue as DriverAttributeValue,
  BatchGetItemInput,
  BatchGetItemOutput,
  BatchWriteItemInput,
  BatchWriteItemOutput,
  ConsumedCapacity as DriverConsumedCapacity,
  CreateTableInput as DriverCreateTableInput,
  DeleteItemInput,
  DriverCapabilities,
  DriverConnectionOptions,
  DriverFactory,
  DriverPlugin,
  GetItemInput,
  PutItemInput,
  QueryInput as DriverQueryInput,
  QueryOutput as DriverQueryOutput,
  ScanInput,
  TableDescription as DriverTableDescription,
  TransactGetItemsInput,
  TransactGetItemsOutput,
  TransactWriteItemsInput,
  UpdateItemInput,
  UpdateTableInput,
} from './types'

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

// DynamoDB Driver
export { createDynamoDBDriver, DynamoDBDriver } from './DynamoDBDriver'

// Utilities - Use driver prefix to avoid conflicts
export {
  buildFilterExpression as buildDriverFilterExpression,
  buildKeyConditionExpression as buildDriverKeyConditionExpression,
  buildProjectionExpression as buildDriverProjectionExpression,
  buildUpdateExpression as buildDriverUpdateExpression,
  escapeAttributeName,
  isReservedWord,
  marshallItem as driverMarshallItem,
  marshallValue as driverMarshallValue,
  mergeExpressionAttributeNames,
  mergeExpressionAttributeValues,
  unmarshallItem as driverUnmarshallItem,
  unmarshallValue as driverUnmarshallValue,
} from './utils'
