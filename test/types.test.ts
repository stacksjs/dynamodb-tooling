import type { GSI1PK, GSI1SK, PartitionKey, SortKey } from '../src/types/branded'
import { describe, expect, it } from 'bun:test'
import {
  compositeSk,
  extractEntityType,
  extractId,
  gsi1pk,

  gsi1sk,

  isEntityKey,
  isValidCompositeFormat,
  isValidPKFormat,
  isValidSKFormat,
  keyBuilder,

  pk,
  sk,

} from '../src/types/branded'
import {
  isBooleanValue,
  isListValue,
  isMapValue,
  isNullValue,
  isNumberSetValue,
  isNumberValue,
  isStringSetValue,
  isStringValue,
} from '../src/types/dynamodb'
import {
  ConditionalCheckFailedError,
  createDynamoDBError,
  DynamoDBValidationError,
  isConditionalCheckFailedError,
  isItemNotFoundError,
  isRetryableError,
  isTransactionCancelledError,
  isValidationError,
  ItemNotFoundError,
  ProvisionedThroughputExceededError,
  ResourceNotFoundError,
  ThrottlingError,
  TransactionCancelledError,
} from '../src/types/errors'
import { assertNever } from '../src/types/validation'

describe('Type System', () => {
  describe('Branded Key Types', () => {
    it('should create partition keys', () => {
      const userPk: PartitionKey<'USER'> = pk('USER', '123')
      expect(userPk as string).toBe('USER#123')
    })

    it('should create sort keys', () => {
      const userSk: SortKey<'USER'> = sk('USER', '456')
      expect(userSk as string).toBe('USER#456')
    })

    it('should create composite sort keys', () => {
      const compositeSortKey: SortKey<string> = compositeSk(['USER', '123'], ['ORDER', '456'])
      expect(compositeSortKey as string).toBe('USER#123#ORDER#456')
    })

    it('should create GSI keys', () => {
      const gsiPk: GSI1PK<'TEAM'> = gsi1pk('TEAM', '789')
      const gsiSk: GSI1SK<'USER'> = gsi1sk('USER', '123')
      expect(gsiPk as string).toBe('TEAM#789')
      expect(gsiSk as string).toBe('USER#123')
    })

    it('should extract entity type from key', () => {
      expect(extractEntityType('USER#123')).toBe('USER')
      expect(extractEntityType('POST#456')).toBe('POST')
      expect(extractEntityType('invalid')).toBe('')
    })

    it('should extract ID from key', () => {
      expect(extractId('USER#123')).toBe('123')
      expect(extractId('POST#456')).toBe('456')
      expect(extractId('invalid')).toBe('')
    })

    it('should check if key matches entity type', () => {
      expect(isEntityKey('USER#123', 'USER')).toBe(true)
      expect(isEntityKey('USER#123', 'POST')).toBe(false)
    })

    it('should validate pk format', () => {
      expect(isValidPKFormat('USER#123')).toBe(true)
      expect(isValidPKFormat('POST#abc')).toBe(true)
      expect(isValidPKFormat('invalid')).toBe(false)
      expect(isValidPKFormat('')).toBe(false)
    })

    it('should validate sk format', () => {
      expect(isValidSKFormat('USER#123')).toBe(true)
      expect(isValidSKFormat('invalid')).toBe(false)
    })

    it('should validate composite format', () => {
      expect(isValidCompositeFormat('USER#123#ORDER#456')).toBe(true)
      expect(isValidCompositeFormat('USER#123')).toBe(false)
    })
  })

  describe('KeyBuilder', () => {
    it('should build keys with entity type', () => {
      const userKeys = keyBuilder('USER')

      expect(userKeys.pk('123') as string).toBe('USER#123')
      expect(userKeys.sk('123') as string).toBe('USER#123')
    })

    it('should build key pairs', () => {
      const userKeys = keyBuilder('USER')
      const pair = userKeys.keyPair('123')

      expect(pair.pk as string).toBe('USER#123')
      expect(pair.sk as string).toBe('USER#123')
    })

    it('should build GSI keys', () => {
      const userKeys = keyBuilder('USER')
      const gsi = userKeys.gsi1('team123', 'user456')

      expect(gsi.gsi1pk as string).toBe('USER#team123')
      expect(gsi.gsi1sk as string).toBe('USER#user456')
    })

    it('should support custom delimiter', () => {
      const userKeys = keyBuilder('USER', '|')

      expect(userKeys.pk('123') as string).toBe('USER|123')
      expect(userKeys.sk('456') as string).toBe('USER|456')
    })
  })

  describe('DynamoDB Attribute Value Type Guards', () => {
    it('should identify string values', () => {
      expect(isStringValue({ S: 'hello' })).toBe(true)
      expect(isStringValue({ N: '123' })).toBe(false)
    })

    it('should identify number values', () => {
      expect(isNumberValue({ N: '123' })).toBe(true)
      expect(isNumberValue({ S: 'hello' })).toBe(false)
    })

    it('should identify boolean values', () => {
      expect(isBooleanValue({ BOOL: true })).toBe(true)
      expect(isBooleanValue({ BOOL: false })).toBe(true)
      expect(isBooleanValue({ S: 'true' })).toBe(false)
    })

    it('should identify null values', () => {
      expect(isNullValue({ NULL: true })).toBe(true)
      expect(isNullValue({ S: 'null' })).toBe(false)
    })

    it('should identify map values', () => {
      expect(isMapValue({ M: { name: { S: 'John' } } })).toBe(true)
      expect(isMapValue({ L: [] })).toBe(false)
    })

    it('should identify list values', () => {
      expect(isListValue({ L: [{ S: 'a' }] })).toBe(true)
      expect(isListValue({ M: {} })).toBe(false)
    })

    it('should identify string set values', () => {
      expect(isStringSetValue({ SS: ['a', 'b'] })).toBe(true)
      expect(isStringSetValue({ NS: ['1', '2'] })).toBe(false)
    })

    it('should identify number set values', () => {
      expect(isNumberSetValue({ NS: ['1', '2'] })).toBe(true)
      expect(isNumberSetValue({ SS: ['a', 'b'] })).toBe(false)
    })
  })

  describe('Error Types', () => {
    describe('ItemNotFoundError', () => {
      it('should create with model and keys', () => {
        const error = new ItemNotFoundError('User', { pk: 'USER#123' })
        expect(error.model).toBe('User')
        expect(error.keys.pk).toBe('USER#123')
        expect(error.code).toBe('ItemNotFound')
        expect(error.retryable).toBe(false)
      })

      it('should include sk in message if provided', () => {
        const error = new ItemNotFoundError('Post', { pk: 'POST#123', sk: 'POST#123' })
        expect(error.message).toContain('sk=POST#123')
      })
    })

    describe('DynamoDBValidationError', () => {
      it('should create with field errors', () => {
        const error = new DynamoDBValidationError('User', {
          email: ['Invalid email format'],
          name: ['Required', 'Too short'],
        })
        expect(error.model).toBe('User')
        expect(error.fieldErrors.email).toEqual(['Invalid email format'])
        expect(error.fieldErrors.name).toEqual(['Required', 'Too short'])
      })

      it('should check for field errors', () => {
        const error = new DynamoDBValidationError('User', { email: ['Invalid'] })
        expect(error.hasFieldError('email')).toBe(true)
        expect(error.hasFieldError('name')).toBe(false)
      })

      it('should get field errors', () => {
        const error = new DynamoDBValidationError('User', { email: ['Invalid'] })
        expect(error.getFieldErrors('email')).toEqual(['Invalid'])
        expect(error.getFieldErrors('name')).toEqual([])
      })

      it('should get error fields', () => {
        const error = new DynamoDBValidationError('User', {
          email: ['Invalid'],
          name: ['Required'],
        })
        expect(error.getErrorFields()).toEqual(['email', 'name'])
      })
    })

    describe('ConditionalCheckFailedError', () => {
      it('should create with version info', () => {
        const error = new ConditionalCheckFailedError('User', {
          expectedVersion: 5,
          actualVersion: 3,
        })
        expect(error.expectedVersion).toBe(5)
        expect(error.actualVersion).toBe(3)
        expect(error.message).toContain('Expected version: 5')
      })

      it('should create with condition info', () => {
        const error = new ConditionalCheckFailedError('User', {
          condition: 'attribute_exists(pk)',
        })
        expect(error.condition).toBe('attribute_exists(pk)')
      })
    })

    describe('TransactionCancelledError', () => {
      it('should create with cancellation reasons', () => {
        const error = new TransactionCancelledError([
          { Code: 'ConditionalCheckFailed', Message: 'Item exists' },
          { Code: 'None' },
        ])
        expect(error.cancellationReasons).toHaveLength(2)
        expect(error.retryable).toBe(false)
      })

      it('should be retryable for transient errors', () => {
        const error = new TransactionCancelledError([
          { Code: 'ThrottlingError' },
        ])
        expect(error.retryable).toBe(true)
      })

      it('should get conditional check failures', () => {
        const error = new TransactionCancelledError([
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' },
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' },
        ])
        expect(error.getConditionalCheckFailures()).toEqual([1, 3])
      })

      it('should detect conflicts', () => {
        const error1 = new TransactionCancelledError([
          { Code: 'TransactionConflict' },
        ])
        const error2 = new TransactionCancelledError([
          { Code: 'ConditionalCheckFailed' },
        ])
        expect(error1.isConflict()).toBe(true)
        expect(error2.isConflict()).toBe(false)
      })
    })

    describe('ProvisionedThroughputExceededError', () => {
      it('should be retryable', () => {
        const error = new ProvisionedThroughputExceededError('TestTable')
        expect(error.retryable).toBe(true)
        expect(error.tableName).toBe('TestTable')
      })

      it('should include retry delay if provided', () => {
        const error = new ProvisionedThroughputExceededError('TestTable', 1000)
        expect(error.retryAfterMs).toBe(1000)
      })
    })

    describe('ResourceNotFoundError', () => {
      it('should identify resource type and name', () => {
        const error = new ResourceNotFoundError('Table', 'MyTable')
        expect(error.resourceType).toBe('Table')
        expect(error.resourceName).toBe('MyTable')
        expect(error.retryable).toBe(false)
      })
    })

    describe('ThrottlingError', () => {
      it('should be retryable', () => {
        const error = new ThrottlingError('Too many requests', 500)
        expect(error.retryable).toBe(true)
        expect(error.retryAfterMs).toBe(500)
      })
    })
  })

  describe('Error Type Guards', () => {
    it('should identify ItemNotFoundError', () => {
      const error = new ItemNotFoundError('User', { pk: 'USER#123' })
      expect(isItemNotFoundError(error)).toBe(true)
      expect(isItemNotFoundError(new Error('test'))).toBe(false)
    })

    it('should identify ValidationError', () => {
      const error = new DynamoDBValidationError('User', { email: ['Invalid'] })
      expect(isValidationError(error)).toBe(true)
      expect(isValidationError(new Error('test'))).toBe(false)
    })

    it('should identify ConditionalCheckFailedError', () => {
      const error = new ConditionalCheckFailedError('User')
      expect(isConditionalCheckFailedError(error)).toBe(true)
      expect(isConditionalCheckFailedError(new Error('test'))).toBe(false)
    })

    it('should identify TransactionCancelledError', () => {
      const error = new TransactionCancelledError([{ Code: 'None' }])
      expect(isTransactionCancelledError(error)).toBe(true)
      expect(isTransactionCancelledError(new Error('test'))).toBe(false)
    })

    it('should identify retryable errors', () => {
      expect(isRetryableError(new ThrottlingError())).toBe(true)
      expect(isRetryableError(new ProvisionedThroughputExceededError('T'))).toBe(true)
      expect(isRetryableError(new ItemNotFoundError('U', { pk: 'X' }))).toBe(false)
      expect(isRetryableError(new Error('test'))).toBe(false)
    })
  })

  describe('Error Factory', () => {
    it('should create ConditionalCheckFailedError from AWS error', () => {
      const error = createDynamoDBError({
        name: 'ConditionalCheckFailedException',
        message: 'Condition failed',
      })
      expect(error).toBeInstanceOf(ConditionalCheckFailedError)
    })

    it('should create ThrottlingError from AWS error', () => {
      const error = createDynamoDBError({
        code: 'ThrottlingException',
        message: 'Rate exceeded',
      })
      expect(error).toBeInstanceOf(ThrottlingError)
    })

    it('should create ResourceNotFoundError from AWS error', () => {
      const error = createDynamoDBError({
        name: 'ResourceNotFoundException',
        message: 'Table not found',
      })
      expect(error).toBeInstanceOf(ResourceNotFoundError)
    })

    it('should create generic error for unknown codes', () => {
      const error = createDynamoDBError({
        name: 'SomeUnknownError',
        message: 'Unknown error',
      })
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('SomeUnknownError')
    })
  })

  describe('Validation Utilities', () => {
    it('should throw for unexpected values in assertNever', () => {
      // This tests the runtime behavior - type checking is done at compile time
      expect(() => {
        assertNever('unexpected' as any as never)
      }).toThrow('Unexpected value')
    })
  })
})
