import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import {
  registerDriver,
  unregisterDriver,
  getDriver,
  getDriverFactory,
  getRegisteredDrivers,
  hasDriver,
  getDefaultDriverName,
  setDefaultDriver,
  clearDriverRegistry,
  createActiveDriver,
  getActiveDriver,
  setActiveDriver,
  getDriverRegistryStats,
  createDynamoDBDriver,
  DynamoDBDriver,
  driverMarshallItem,
  driverMarshallValue,
  driverUnmarshallItem,
  driverUnmarshallValue,
  buildDriverUpdateExpression,
  buildDriverKeyConditionExpression,
  buildDriverFilterExpression,
  buildDriverProjectionExpression,
  isReservedWord,
  escapeAttributeName,
  mergeExpressionAttributeNames,
  mergeExpressionAttributeValues,
  type DriverPlugin,
  type DriverConnectionOptions,
} from '../src/drivers'

describe('Driver Registry', () => {
  beforeEach(() => {
    clearDriverRegistry()
  })

  afterEach(() => {
    clearDriverRegistry()
  })

  describe('registerDriver', () => {
    it('should register a driver', () => {
      registerDriver('test-driver', createDynamoDBDriver)
      expect(hasDriver('test-driver')).toBe(true)
    })

    it('should set first registered driver as default', () => {
      registerDriver('first-driver', createDynamoDBDriver)
      expect(getDefaultDriverName()).toBe('first-driver')
    })

    it('should not change default when registering additional drivers', () => {
      registerDriver('first-driver', createDynamoDBDriver)
      registerDriver('second-driver', createDynamoDBDriver)
      expect(getDefaultDriverName()).toBe('first-driver')
    })

    it('should set as default when explicitly requested', () => {
      registerDriver('first-driver', createDynamoDBDriver)
      registerDriver('second-driver', createDynamoDBDriver, true)
      expect(getDefaultDriverName()).toBe('second-driver')
    })
  })

  describe('unregisterDriver', () => {
    it('should unregister a driver', () => {
      registerDriver('test-driver', createDynamoDBDriver)
      expect(unregisterDriver('test-driver')).toBe(true)
      expect(hasDriver('test-driver')).toBe(false)
    })

    it('should return false for non-existent driver', () => {
      expect(unregisterDriver('non-existent')).toBe(false)
    })

    it('should update default when current default is unregistered', () => {
      registerDriver('first-driver', createDynamoDBDriver)
      registerDriver('second-driver', createDynamoDBDriver)
      unregisterDriver('first-driver')
      expect(getDefaultDriverName()).toBe('second-driver')
    })

    it('should set default to null when last driver is unregistered', () => {
      registerDriver('only-driver', createDynamoDBDriver)
      unregisterDriver('only-driver')
      expect(getDefaultDriverName()).toBe(null)
    })
  })

  describe('getDriver', () => {
    it('should return driver instance by name', () => {
      registerDriver('test-driver', createDynamoDBDriver)
      const driver = getDriver('test-driver')
      expect(driver).toBeInstanceOf(DynamoDBDriver)
    })

    it('should return default driver when no name provided', () => {
      registerDriver('default-driver', createDynamoDBDriver)
      const driver = getDriver()
      expect(driver).toBeInstanceOf(DynamoDBDriver)
    })

    it('should return undefined for non-existent driver', () => {
      expect(getDriver('non-existent')).toBeUndefined()
    })

    it('should pass options to driver factory', () => {
      registerDriver('test-driver', (options) => {
        const driver = createDynamoDBDriver(options)
        return driver
      })
      const options: DriverConnectionOptions = { region: 'us-west-2' }
      const driver = getDriver('test-driver', options)
      expect(driver).toBeDefined()
    })
  })

  describe('getDriverFactory', () => {
    it('should return factory function', () => {
      registerDriver('test-driver', createDynamoDBDriver)
      const factory = getDriverFactory('test-driver')
      expect(typeof factory).toBe('function')
    })

    it('should return undefined for non-existent driver', () => {
      expect(getDriverFactory('non-existent')).toBeUndefined()
    })
  })

  describe('getRegisteredDrivers', () => {
    it('should return empty array when no drivers registered', () => {
      expect(getRegisteredDrivers()).toEqual([])
    })

    it('should return all registered driver names', () => {
      registerDriver('driver1', createDynamoDBDriver)
      registerDriver('driver2', createDynamoDBDriver)
      registerDriver('driver3', createDynamoDBDriver)
      expect(getRegisteredDrivers()).toEqual(['driver1', 'driver2', 'driver3'])
    })
  })

  describe('setDefaultDriver', () => {
    it('should set the default driver', () => {
      registerDriver('driver1', createDynamoDBDriver)
      registerDriver('driver2', createDynamoDBDriver)
      setDefaultDriver('driver2')
      expect(getDefaultDriverName()).toBe('driver2')
    })

    it('should throw for non-existent driver', () => {
      expect(() => setDefaultDriver('non-existent')).toThrow()
    })
  })

  describe('active driver management', () => {
    it('should create and set active driver', async () => {
      registerDriver('test-driver', createDynamoDBDriver)
      const driver = await createActiveDriver('test-driver')
      expect(driver).toBeDefined()
      expect(getActiveDriver()).toBe(driver)
    })

    it('should throw when creating non-existent driver', async () => {
      await expect(createActiveDriver('non-existent')).rejects.toThrow()
    })

    it('should set active driver directly', () => {
      const driver = createDynamoDBDriver()
      setActiveDriver(driver)
      expect(getActiveDriver()).toBe(driver)
    })

    it('should clear active driver', () => {
      const driver = createDynamoDBDriver()
      setActiveDriver(driver)
      setActiveDriver(null)
      expect(getActiveDriver()).toBeNull()
    })
  })

  describe('getDriverRegistryStats', () => {
    it('should return correct stats', () => {
      registerDriver('driver1', createDynamoDBDriver)
      registerDriver('driver2', createDynamoDBDriver)
      const driver = createDynamoDBDriver()
      setActiveDriver(driver)

      const stats = getDriverRegistryStats()
      expect(stats.registeredCount).toBe(2)
      expect(stats.defaultDriver).toBe('driver1')
      expect(stats.hasActiveDriver).toBe(true)
      expect(stats.activeDriverName).toBe('dynamodb')
    })
  })
})

describe('DynamoDBDriver', () => {
  let driver: DriverPlugin

  beforeEach(() => {
    driver = createDynamoDBDriver()
  })

  describe('capabilities', () => {
    it('should report correct capabilities', () => {
      const caps = driver.getCapabilities()
      expect(caps.transactions).toBe(true)
      expect(caps.batch).toBe(true)
      expect(caps.streams).toBe(true)
      expect(caps.gsi).toBe(true)
      expect(caps.lsi).toBe(true)
      expect(caps.partiql).toBe(true)
      expect(caps.ttl).toBe(true)
      expect(caps.consistentRead).toBe(true)
      expect(caps.conditionalWrites).toBe(true)
      expect(caps.atomicCounters).toBe(true)
      expect(caps.maxBatchWriteItems).toBe(25)
      expect(caps.maxBatchReadItems).toBe(100)
      expect(caps.maxTransactionItems).toBe(100)
    })
  })

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const result = driver.validateConfig({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject missing accessKeyId when credentials provided', () => {
      const result = driver.validateConfig({
        credentials: {
          accessKeyId: '',
          secretAccessKey: 'test-secret',
        },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject negative maxRetries', () => {
      const result = driver.validateConfig({
        maxRetries: -1,
      })
      expect(result.valid).toBe(false)
    })

    it('should reject negative timeout', () => {
      const result = driver.validateConfig({
        timeout: -1,
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('connection', () => {
    it('should connect successfully', async () => {
      expect(driver.isConnected()).toBe(false)
      await driver.connect({ region: 'us-east-1' })
      expect(driver.isConnected()).toBe(true)
    })

    it('should disconnect successfully', async () => {
      await driver.connect({ region: 'us-east-1' })
      await driver.disconnect()
      expect(driver.isConnected()).toBe(false)
    })
  })

  describe('driver info', () => {
    it('should have correct name', () => {
      expect(driver.name).toBe('dynamodb')
    })

    it('should have version', () => {
      expect(driver.version).toBeDefined()
      expect(typeof driver.version).toBe('string')
    })
  })
})

describe('Driver Utilities', () => {
  describe('marshallValue', () => {
    it('should marshall string', () => {
      expect(driverMarshallValue('hello')).toEqual({ S: 'hello' })
    })

    it('should marshall number', () => {
      expect(driverMarshallValue(42)).toEqual({ N: '42' })
    })

    it('should marshall boolean', () => {
      expect(driverMarshallValue(true)).toEqual({ BOOL: true })
      expect(driverMarshallValue(false)).toEqual({ BOOL: false })
    })

    it('should marshall null', () => {
      expect(driverMarshallValue(null)).toEqual({ NULL: true })
    })

    it('should marshall array', () => {
      const result = driverMarshallValue([1, 'two', true])
      expect(result).toHaveProperty('L')
      expect((result as { L: unknown[] }).L).toHaveLength(3)
    })

    it('should marshall string set', () => {
      expect(driverMarshallValue(new Set(['a', 'b', 'c']))).toEqual({ SS: ['a', 'b', 'c'] })
    })

    it('should marshall number set', () => {
      expect(driverMarshallValue(new Set([1, 2, 3]))).toEqual({ NS: ['1', '2', '3'] })
    })

    it('should marshall object as map', () => {
      const result = driverMarshallValue({ foo: 'bar' })
      expect(result).toHaveProperty('M')
    })

    it('should return undefined for undefined', () => {
      expect(driverMarshallValue(undefined)).toBeUndefined()
    })
  })

  describe('unmarshallValue', () => {
    it('should unmarshall string', () => {
      expect(driverUnmarshallValue({ S: 'hello' })).toBe('hello')
    })

    it('should unmarshall number', () => {
      expect(driverUnmarshallValue({ N: '42' })).toBe(42)
    })

    it('should unmarshall boolean', () => {
      expect(driverUnmarshallValue({ BOOL: true })).toBe(true)
    })

    it('should unmarshall null', () => {
      expect(driverUnmarshallValue({ NULL: true })).toBe(null)
    })

    it('should unmarshall list', () => {
      const result = driverUnmarshallValue({ L: [{ S: 'a' }, { N: '1' }] })
      expect(result).toEqual(['a', 1])
    })

    it('should unmarshall map', () => {
      const result = driverUnmarshallValue({ M: { foo: { S: 'bar' } } })
      expect(result).toEqual({ foo: 'bar' })
    })

    it('should unmarshall string set', () => {
      const result = driverUnmarshallValue({ SS: ['a', 'b', 'c'] })
      expect(result).toEqual(new Set(['a', 'b', 'c']))
    })

    it('should unmarshall number set', () => {
      const result = driverUnmarshallValue({ NS: ['1', '2', '3'] })
      expect(result).toEqual(new Set([1, 2, 3]))
    })
  })

  describe('marshallItem', () => {
    it('should marshall complete item', () => {
      const item = {
        id: '123',
        name: 'Test',
        count: 42,
        active: true,
        tags: ['a', 'b'],
      }
      const result = driverMarshallItem(item)
      expect(result.id).toEqual({ S: '123' })
      expect(result.name).toEqual({ S: 'Test' })
      expect(result.count).toEqual({ N: '42' })
      expect(result.active).toEqual({ BOOL: true })
      expect(result.tags).toHaveProperty('L')
    })

    it('should skip undefined values', () => {
      const result = driverMarshallItem({ foo: 'bar', baz: undefined })
      expect(result.foo).toBeDefined()
      expect(result.baz).toBeUndefined()
    })
  })

  describe('unmarshallItem', () => {
    it('should unmarshall complete item', () => {
      const item = {
        id: { S: '123' },
        count: { N: '42' },
        active: { BOOL: true },
      }
      const result = driverUnmarshallItem(item)
      expect(result).toBeDefined()
    })
  })

  describe('buildDriverUpdateExpression', () => {
    it('should build SET expression', () => {
      const result = buildDriverUpdateExpression({
        name: 'John',
        age: 30,
      })
      expect(result.updateExpression).toContain('SET')
      expect(Object.keys(result.expressionAttributeNames)).toHaveLength(2)
      expect(Object.keys(result.expressionAttributeValues)).toHaveLength(2)
    })

    it('should handle REMOVE attributes', () => {
      const result = buildDriverUpdateExpression(
        { name: 'John' },
        { removeAttributes: ['oldField'] },
      )
      expect(result.updateExpression).toContain('REMOVE')
    })

    it('should handle ADD attributes', () => {
      const result = buildDriverUpdateExpression(
        {},
        { addAttributes: { count: 1 } },
      )
      expect(result.updateExpression).toContain('ADD')
    })

    it('should handle DELETE from set', () => {
      const result = buildDriverUpdateExpression(
        {},
        { deleteAttributes: { tags: ['obsolete'] } },
      )
      expect(result.updateExpression).toContain('DELETE')
    })
  })

  describe('buildDriverKeyConditionExpression', () => {
    it('should build equality condition', () => {
      const result = buildDriverKeyConditionExpression([
        { attribute: 'pk', operator: '=', value: 'USER#123' },
      ])
      expect(result.keyConditionExpression).toContain('=')
    })

    it('should build BETWEEN condition', () => {
      const result = buildDriverKeyConditionExpression([
        { attribute: 'sk', operator: 'BETWEEN', value: 'A', value2: 'Z' },
      ])
      expect(result.keyConditionExpression).toContain('BETWEEN')
    })

    it('should build begins_with condition', () => {
      const result = buildDriverKeyConditionExpression([
        { attribute: 'sk', operator: 'begins_with', value: 'ORDER#' },
      ])
      expect(result.keyConditionExpression).toContain('begins_with')
    })

    it('should combine multiple conditions', () => {
      const result = buildDriverKeyConditionExpression([
        { attribute: 'pk', operator: '=', value: 'USER#123' },
        { attribute: 'sk', operator: '>', value: '2024-01-01' },
      ])
      expect(result.keyConditionExpression).toContain('AND')
    })
  })

  describe('buildDriverFilterExpression', () => {
    it('should build comparison operators', () => {
      const result = buildDriverFilterExpression([
        { attribute: 'status', operator: '=', value: 'active' },
        { attribute: 'count', operator: '>', value: 10 },
      ])
      expect(result.filterExpression).toContain('AND')
    })

    it('should build IN condition', () => {
      const result = buildDriverFilterExpression([
        { attribute: 'status', operator: 'IN', values: ['active', 'pending'] },
      ])
      expect(result.filterExpression).toContain('IN')
    })

    it('should build contains condition', () => {
      const result = buildDriverFilterExpression([
        { attribute: 'name', operator: 'contains', value: 'test' },
      ])
      expect(result.filterExpression).toContain('contains')
    })

    it('should build attribute_exists condition', () => {
      const result = buildDriverFilterExpression([
        { attribute: 'email', operator: 'attribute_exists' },
      ])
      expect(result.filterExpression).toContain('attribute_exists')
    })

    it('should build attribute_not_exists condition', () => {
      const result = buildDriverFilterExpression([
        { attribute: 'deletedAt', operator: 'attribute_not_exists' },
      ])
      expect(result.filterExpression).toContain('attribute_not_exists')
    })

    it('should use OR logical operator', () => {
      const result = buildDriverFilterExpression(
        [
          { attribute: 'status', operator: '=', value: 'active' },
          { attribute: 'status', operator: '=', value: 'pending' },
        ],
        'OR',
      )
      expect(result.filterExpression).toContain('OR')
    })
  })

  describe('buildDriverProjectionExpression', () => {
    it('should build projection for single attribute', () => {
      const result = buildDriverProjectionExpression(['id'])
      expect(result.projectionExpression).toBe('#p0')
      expect(result.expressionAttributeNames['#p0']).toBe('id')
    })

    it('should build projection for multiple attributes', () => {
      const result = buildDriverProjectionExpression(['id', 'name', 'email'])
      expect(result.projectionExpression).toBe('#p0, #p1, #p2')
      expect(Object.keys(result.expressionAttributeNames)).toHaveLength(3)
    })
  })

  describe('isReservedWord', () => {
    it('should identify reserved words', () => {
      expect(isReservedWord('name')).toBe(true)
      expect(isReservedWord('status')).toBe(true)
      expect(isReservedWord('count')).toBe(true)
      expect(isReservedWord('value')).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(isReservedWord('NAME')).toBe(true)
      expect(isReservedWord('Name')).toBe(true)
    })

    it('should return false for non-reserved words', () => {
      expect(isReservedWord('userId')).toBe(false)
      expect(isReservedWord('customField')).toBe(false)
    })
  })

  describe('escapeAttributeName', () => {
    it('should escape reserved words', () => {
      expect(escapeAttributeName('name')).toBe('#name')
      expect(escapeAttributeName('status')).toBe('#status')
    })

    it('should not escape non-reserved words', () => {
      expect(escapeAttributeName('userId')).toBe('userId')
    })
  })

  describe('mergeExpressionAttributeNames', () => {
    it('should merge multiple maps', () => {
      const result = mergeExpressionAttributeNames(
        { '#a': 'fieldA' },
        { '#b': 'fieldB' },
        { '#c': 'fieldC' },
      )
      expect(result).toEqual({
        '#a': 'fieldA',
        '#b': 'fieldB',
        '#c': 'fieldC',
      })
    })

    it('should handle undefined inputs', () => {
      const result = mergeExpressionAttributeNames(
        { '#a': 'fieldA' },
        undefined,
        { '#b': 'fieldB' },
      )
      expect(result).toEqual({
        '#a': 'fieldA',
        '#b': 'fieldB',
      })
    })
  })

  describe('mergeExpressionAttributeValues', () => {
    it('should merge multiple maps', () => {
      const result = mergeExpressionAttributeValues(
        { ':a': { S: 'valueA' } },
        { ':b': { N: '42' } },
      )
      expect(result).toEqual({
        ':a': { S: 'valueA' },
        ':b': { N: '42' },
      })
    })
  })
})
