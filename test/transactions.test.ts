import type { DriverPlugin, TransactGetItemsInput, TransactWriteItemsInput } from '../src/drivers'
import { beforeEach, describe, expect, it } from 'bun:test'
import {
  createDynamoDBDriver,

} from '../src/drivers'

describe('Transaction Operations', () => {
  let driver: DriverPlugin

  beforeEach(() => {
    driver = createDynamoDBDriver({
      endpoint: 'http://localhost:8000',
      region: 'local',
    })
  })

  describe('TransactWriteItems Input Building', () => {
    it('should build transact write input with Put operation', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            put: {
              tableName: 'TestTable',
              item: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
                name: { S: 'John Doe' },
              },
            },
          },
        ],
      }

      expect(input.transactItems).toHaveLength(1)
      expect(input.transactItems[0].put).toBeDefined()
      expect(input.transactItems[0].put?.tableName).toBe('TestTable')
    })

    it('should build transact write input with Update operation', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            update: {
              tableName: 'TestTable',
              key: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
              },
              updateExpression: 'SET #name = :name',
              expressionAttributeNames: { '#name': 'name' },
              expressionAttributeValues: { ':name': { S: 'Jane Doe' } },
            },
          },
        ],
      }

      expect(input.transactItems[0].update).toBeDefined()
      expect(input.transactItems[0].update?.updateExpression).toContain('SET')
    })

    it('should build transact write input with Delete operation', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            delete: {
              tableName: 'TestTable',
              key: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
              },
            },
          },
        ],
      }

      expect(input.transactItems[0].delete).toBeDefined()
    })

    it('should build transact write input with ConditionCheck operation', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            conditionCheck: {
              tableName: 'TestTable',
              key: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
              },
              conditionExpression: 'attribute_exists(pk)',
            },
          },
        ],
      }

      expect(input.transactItems[0].conditionCheck).toBeDefined()
      expect(input.transactItems[0].conditionCheck?.conditionExpression).toContain('attribute_exists')
    })

    it('should build complex transaction with multiple operations', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            put: {
              tableName: 'Orders',
              item: {
                pk: { S: 'ORDER#456' },
                sk: { S: 'ORDER#456' },
                status: { S: 'pending' },
              },
              conditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            update: {
              tableName: 'Users',
              key: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
              },
              updateExpression: 'SET orderCount = orderCount + :inc',
              expressionAttributeValues: { ':inc': { N: '1' } },
            },
          },
          {
            update: {
              tableName: 'Products',
              key: {
                pk: { S: 'PROD#789' },
                sk: { S: 'PROD#789' },
              },
              updateExpression: 'SET stock = stock - :qty',
              conditionExpression: 'stock >= :qty',
              expressionAttributeValues: {
                ':qty': { N: '1' },
              },
            },
          },
        ],
        clientRequestToken: 'unique-request-id',
        returnConsumedCapacity: 'TOTAL',
      }

      expect(input.transactItems).toHaveLength(3)
      expect(input.clientRequestToken).toBe('unique-request-id')
    })

    it('should support conditional puts for idempotency', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            put: {
              tableName: 'TestTable',
              item: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
                email: { S: 'test@example.com' },
              },
              conditionExpression: 'attribute_not_exists(pk)',
            },
          },
        ],
      }

      expect(input.transactItems[0].put?.conditionExpression).toBe('attribute_not_exists(pk)')
    })
  })

  describe('TransactGetItems Input Building', () => {
    it('should build transact get input for single item', () => {
      const input: TransactGetItemsInput = {
        transactItems: [
          {
            get: {
              tableName: 'TestTable',
              key: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
              },
            },
          },
        ],
      }

      expect(input.transactItems).toHaveLength(1)
      expect(input.transactItems[0].get.tableName).toBe('TestTable')
    })

    it('should build transact get input with projection', () => {
      const input: TransactGetItemsInput = {
        transactItems: [
          {
            get: {
              tableName: 'TestTable',
              key: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
              },
              projectionExpression: '#name, #email',
              expressionAttributeNames: {
                '#name': 'name',
                '#email': 'email',
              },
            },
          },
        ],
      }

      expect(input.transactItems[0].get.projectionExpression).toContain('#name')
    })

    it('should build transact get for multiple items', () => {
      const input: TransactGetItemsInput = {
        transactItems: [
          {
            get: {
              tableName: 'Users',
              key: { pk: { S: 'USER#1' }, sk: { S: 'USER#1' } },
            },
          },
          {
            get: {
              tableName: 'Orders',
              key: { pk: { S: 'ORDER#1' }, sk: { S: 'ORDER#1' } },
            },
          },
          {
            get: {
              tableName: 'Products',
              key: { pk: { S: 'PROD#1' }, sk: { S: 'PROD#1' } },
            },
          },
        ],
        returnConsumedCapacity: 'TOTAL',
      }

      expect(input.transactItems).toHaveLength(3)
    })
  })

  describe('Transaction Patterns', () => {
    it('should support atomic counter pattern', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            update: {
              tableName: 'Counters',
              key: {
                pk: { S: 'COUNTER#views' },
                sk: { S: 'COUNTER#views' },
              },
              updateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc',
              expressionAttributeNames: { '#count': 'count' },
              expressionAttributeValues: {
                ':zero': { N: '0' },
                ':inc': { N: '1' },
              },
            },
          },
        ],
      }

      expect(input.transactItems[0].update?.updateExpression).toContain('if_not_exists')
    })

    it('should support pessimistic locking pattern', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            update: {
              tableName: 'Items',
              key: {
                pk: { S: 'ITEM#123' },
                sk: { S: 'ITEM#123' },
              },
              updateExpression: 'SET #status = :locked, #lockedBy = :user, #lockedAt = :now',
              conditionExpression: 'attribute_not_exists(#lockedBy) OR #lockedAt < :expiry',
              expressionAttributeNames: {
                '#status': 'status',
                '#lockedBy': 'lockedBy',
                '#lockedAt': 'lockedAt',
              },
              expressionAttributeValues: {
                ':locked': { S: 'locked' },
                ':user': { S: 'user123' },
                ':now': { S: new Date().toISOString() },
                ':expiry': { S: new Date(Date.now() - 300000).toISOString() }, // 5 min ago
              },
            },
          },
        ],
      }

      expect(input.transactItems[0].update?.conditionExpression).toContain('attribute_not_exists')
    })

    it('should support optimistic locking with version', () => {
      const currentVersion = 5
      const input: TransactWriteItemsInput = {
        transactItems: [
          {
            update: {
              tableName: 'Items',
              key: {
                pk: { S: 'ITEM#123' },
                sk: { S: 'ITEM#123' },
              },
              updateExpression: 'SET #data = :data, #version = :newVersion',
              conditionExpression: '#version = :currentVersion',
              expressionAttributeNames: {
                '#data': 'data',
                '#version': 'version',
              },
              expressionAttributeValues: {
                ':data': { S: 'updated data' },
                ':currentVersion': { N: String(currentVersion) },
                ':newVersion': { N: String(currentVersion + 1) },
              },
            },
          },
        ],
      }

      expect(input.transactItems[0].update?.conditionExpression).toContain('#version = :currentVersion')
    })

    it('should support saga pattern with compensation', () => {
      // Saga step 1: Create order
      // Saga step 2: Reserve inventory
      // Saga step 3: Process payment
      // All must succeed or all fail

      const sagaTransaction: TransactWriteItemsInput = {
        transactItems: [
          // Step 1: Create order
          {
            put: {
              tableName: 'Orders',
              item: {
                pk: { S: 'ORDER#new-order' },
                sk: { S: 'ORDER#new-order' },
                status: { S: 'pending' },
                amount: { N: '100' },
              },
              conditionExpression: 'attribute_not_exists(pk)',
            },
          },
          // Step 2: Reserve inventory
          {
            update: {
              tableName: 'Inventory',
              key: {
                pk: { S: 'INV#product-1' },
                sk: { S: 'INV#product-1' },
              },
              updateExpression: 'SET #reserved = #reserved + :qty',
              conditionExpression: '#available >= :qty',
              expressionAttributeNames: {
                '#reserved': 'reserved',
                '#available': 'available',
              },
              expressionAttributeValues: {
                ':qty': { N: '1' },
              },
            },
          },
          // Step 3: Create payment record
          {
            put: {
              tableName: 'Payments',
              item: {
                pk: { S: 'PAY#new-payment' },
                sk: { S: 'PAY#new-payment' },
                orderId: { S: 'ORDER#new-order' },
                status: { S: 'pending' },
              },
              conditionExpression: 'attribute_not_exists(pk)',
            },
          },
        ],
        clientRequestToken: 'saga-unique-id',
      }

      expect(sagaTransaction.transactItems).toHaveLength(3)
    })

    it('should support cross-table referential integrity', () => {
      // When deleting a user, ensure they have no active orders
      const input: TransactWriteItemsInput = {
        transactItems: [
          // Check no active orders exist
          {
            conditionCheck: {
              tableName: 'Orders',
              key: {
                pk: { S: 'USER#123#ORDERS' },
                sk: { S: 'ACTIVE' },
              },
              conditionExpression: 'attribute_not_exists(pk) OR #count = :zero',
              expressionAttributeNames: { '#count': 'count' },
              expressionAttributeValues: { ':zero': { N: '0' } },
            },
          },
          // Delete the user
          {
            delete: {
              tableName: 'Users',
              key: {
                pk: { S: 'USER#123' },
                sk: { S: 'USER#123' },
              },
            },
          },
        ],
      }

      expect(input.transactItems[0].conditionCheck).toBeDefined()
      expect(input.transactItems[1].delete).toBeDefined()
    })
  })

  describe('Transaction Limits', () => {
    it('should respect max 100 items limit', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        put: {
          tableName: 'TestTable',
          item: {
            pk: { S: `ITEM#${i}` },
            sk: { S: `ITEM#${i}` },
          },
        },
      }))

      const input: TransactWriteItemsInput = {
        transactItems: items,
      }

      expect(input.transactItems.length).toBeLessThanOrEqual(100)
    })

    it('should handle mixed operation types', () => {
      const input: TransactWriteItemsInput = {
        transactItems: [
          { put: { tableName: 'T1', item: { pk: { S: '1' }, sk: { S: '1' } } } },
          { update: { tableName: 'T2', key: { pk: { S: '2' }, sk: { S: '2' } }, updateExpression: 'SET a = :a', expressionAttributeValues: { ':a': { S: 'b' } } } },
          { delete: { tableName: 'T3', key: { pk: { S: '3' }, sk: { S: '3' } } } },
          { conditionCheck: { tableName: 'T4', key: { pk: { S: '4' }, sk: { S: '4' } }, conditionExpression: 'attribute_exists(pk)' } },
        ],
      }

      const operationTypes = input.transactItems.map((item) => {
        if (item.put)
          return 'put'
        if (item.update)
          return 'update'
        if (item.delete)
          return 'delete'
        if (item.conditionCheck)
          return 'conditionCheck'
        return 'unknown'
      })

      expect(operationTypes).toContain('put')
      expect(operationTypes).toContain('update')
      expect(operationTypes).toContain('delete')
      expect(operationTypes).toContain('conditionCheck')
    })
  })

  describe('Driver Capabilities', () => {
    it('should report transaction support', () => {
      const caps = driver.getCapabilities()
      expect(caps.transactions).toBe(true)
      expect(caps.maxTransactionItems).toBe(100)
    })
  })
})
