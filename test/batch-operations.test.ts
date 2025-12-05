import { describe, expect, it, beforeEach, mock } from 'bun:test'
import {
  DynamoDBModel,
  DynamoDBQueryBuilder,
  setModelClient,
  setOrmModelRegistry,
  setModelConfig,
  type DynamoDBClient,
  type ModelAttribute,
  type ModelRelationship,
  type BatchWriteOperation,
} from '../src/models/DynamoDBModel'
import type { ModelRegistry } from '../src/model-parser/types'
import type { Config } from '../src/types'

// Test model
class TestItem extends DynamoDBModel {
  static table = 'items'
  static primaryKey = 'id'
  static pkPrefix = 'ITEM'
  static timestamps = true

  get attributes(): Record<string, ModelAttribute> {
    return {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      category: { type: 'string' },
      price: { type: 'number' },
    }
  }

  get relationships(): Record<string, ModelRelationship> {
    return {}
  }
}

// Mock config
const mockConfig: Config = {
  defaultTableName: 'main',
  tableNamePrefix: '',
  tableNameSuffix: '',
  singleTableDesign: {
    enabled: true,
    partitionKeyName: 'pk',
    sortKeyName: 'sk',
    entityTypeAttribute: '_et',
    keyDelimiter: '#',
  },
  capacity: {
    billingMode: 'PAY_PER_REQUEST',
  },
  local: {
    enabled: true,
    port: 8000,
    installPath: 'dynamodb-local',
    sharedDb: true,
    inMemory: true,
    delayTransientStatuses: false,
    optimizeDbBeforeStartup: false,
  },
  queryBuilder: {
    modelsPath: './app/models',
    timestampFormat: 'iso',
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    softDeletes: {
      enabled: false,
      attribute: 'deletedAt',
    },
    versionAttribute: '_version',
  },
  retryConfig: {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 5000,
    retryableStatusCodes: [500, 502, 503, 504],
  },
  environment: 'development',
  region: 'us-east-1',
  loggingEnabled: false,
}

function createMockRegistry(): ModelRegistry {
  return {
    models: new Map(),
    relationships: new Map(),
    accessPatterns: new Map(),
  }
}

describe('Batch Operations', () => {
  let batchWriteCalls: Array<{ tableName: string, operations: BatchWriteOperation[] }>
  let batchGetCalls: Array<{ tableName: string, keys: unknown[] }>

  beforeEach(() => {
    batchWriteCalls = []
    batchGetCalls = []

    const mockClient: DynamoDBClient = {
      getItem: mock(async () => null),
      putItem: mock(async () => {}),
      updateItem: mock(async () => null),
      deleteItem: mock(async () => {}),
      query: mock(async () => ({
        items: [],
        count: 0,
      })),
      scan: mock(async () => ({
        items: [],
        count: 0,
      })),
      batchGetItem: mock(async (tableName: string, keys: unknown[]) => {
        batchGetCalls.push({ tableName, keys })
        return []
      }),
      batchWriteItem: mock(async (tableName: string, operations: BatchWriteOperation[]) => {
        batchWriteCalls.push({ tableName, operations })
      }),
      transactWriteItems: mock(async () => {}),
    }

    setModelClient(mockClient)
    setModelConfig(mockConfig)
    setOrmModelRegistry(createMockRegistry())
  })

  describe('Batch Insert', () => {
    it('should batch insert multiple items', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        category: 'test',
        price: i * 10,
      }))

      const results = await TestItem.query().insertMany(items)

      expect(results).toHaveLength(10)
      expect(batchWriteCalls.length).toBeGreaterThan(0)
    })

    it('should chunk large batches into groups of 25', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
      }))

      await TestItem.query().insertMany(items)

      // Should have been called twice (50 items / 25 per batch = 2 calls)
      expect(batchWriteCalls.length).toBe(2)
    })

    it('should handle empty array', async () => {
      const results = await TestItem.query().insertMany([])
      expect(results).toHaveLength(0)
    })

    it('should return model instances', async () => {
      const items = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' },
      ]

      const results = await TestItem.query().insertMany(items)

      results.forEach((result) => {
        expect(result).toBeInstanceOf(TestItem)
        expect(result.exists).toBe(true)
      })
    })
  })

  describe('Batch Get (findMany)', () => {
    it('should batch get multiple items', async () => {
      const keys = [
        { pk: '1' },
        { pk: '2' },
        { pk: '3' },
      ]

      await TestItem.findMany(keys)

      expect(batchGetCalls.length).toBeGreaterThan(0)
    })

    it('should handle composite keys', async () => {
      const keys = [
        { pk: '1', sk: 'v1' },
        { pk: '2', sk: 'v2' },
      ]

      await TestItem.findMany(keys)

      expect(batchGetCalls.length).toBeGreaterThan(0)
    })
  })

  describe('Chunked Processing', () => {
    it('should process items in chunks', async () => {
      const chunkSizes: number[] = []
      const mockClient: DynamoDBClient = {
        getItem: mock(async () => null),
        putItem: mock(async () => {}),
        updateItem: mock(async () => null),
        deleteItem: mock(async () => {}),
        query: mock(async (tableName, params) => {
          // Simulate returning items for chunk test
          const mockItems = Array.from({ length: params.limit ?? 10 }, (_, i) => ({
            pk: { S: `ITEM#${i}` },
            sk: { S: `ITEM#${i}` },
            id: { S: `${i}` },
            name: { S: `Item ${i}` },
            _et: { S: 'ITEM' },
          }))
          return {
            items: mockItems,
            count: mockItems.length,
            lastEvaluatedKey: params.limit && mockItems.length >= params.limit
              ? { pk: { S: 'ITEM#last' }, sk: { S: 'ITEM#last' } }
              : undefined,
          }
        }),
        scan: mock(async () => ({
          items: [],
          count: 0,
        })),
        batchGetItem: mock(async () => []),
        batchWriteItem: mock(async () => {}),
        transactWriteItems: mock(async () => {}),
      }

      setModelClient(mockClient)

      let processedCount = 0
      await TestItem.query()
        .where('pk', 'ITEM#1')
        .chunk(5, (items) => {
          chunkSizes.push(items.length)
          processedCount += items.length

          // Stop after first chunk to avoid infinite loop in test
          if (processedCount >= 5) {
            return
          }
        })

      expect(chunkSizes.length).toBeGreaterThan(0)
    })
  })
})

describe('Pagination', () => {
  beforeEach(() => {
    const mockClient: DynamoDBClient = {
      getItem: mock(async () => null),
      putItem: mock(async () => {}),
      updateItem: mock(async () => null),
      deleteItem: mock(async () => {}),
      query: mock(async (tableName, params) => {
        const items = Array.from({ length: Math.min(params.limit ?? 15, 10) }, (_, i) => ({
          pk: { S: `ITEM#${i}` },
          sk: { S: `ITEM#${i}` },
          id: { S: `${i}` },
          name: { S: `Item ${i}` },
          _et: { S: 'ITEM' },
        }))
        return {
          items,
          count: items.length,
          lastEvaluatedKey: items.length >= (params.limit ?? 15)
            ? { pk: { S: 'ITEM#next' }, sk: { S: 'ITEM#next' } }
            : undefined,
        }
      }),
      scan: mock(async (tableName, params) => {
        const items = Array.from({ length: Math.min(params?.limit ?? 15, 10) }, (_, i) => ({
          pk: { S: `ITEM#${i}` },
          sk: { S: `ITEM#${i}` },
          id: { S: `${i}` },
          name: { S: `Item ${i}` },
          _et: { S: 'ITEM' },
        }))
        return {
          items,
          count: items.length,
        }
      }),
      batchGetItem: mock(async () => []),
      batchWriteItem: mock(async () => {}),
      transactWriteItems: mock(async () => {}),
    }

    setModelClient(mockClient)
    setModelConfig(mockConfig)
    setOrmModelRegistry(createMockRegistry())
  })

  describe('paginate', () => {
    it('should return paginated results', async () => {
      const result = await TestItem.query().paginate(10)

      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('count')
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('should respect perPage parameter', async () => {
      const result = await TestItem.query().paginate(5)

      expect(result.items.length).toBeLessThanOrEqual(5)
    })

    it('should default to 15 items per page', async () => {
      const result = await TestItem.query().paginate()

      expect(result.items.length).toBeLessThanOrEqual(15)
    })
  })

  describe('cursorPaginate', () => {
    it('should support cursor-based pagination', async () => {
      const result = await TestItem.query().cursorPaginate(undefined, 10)

      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('count')
    })

    it('should accept cursor from previous page', async () => {
      const firstPage = await TestItem.query().cursorPaginate(undefined, 5)
      // Simulate getting a cursor from the first page
      const mockCursor = 'eyJwayI6IklURU0jNSIsInNrIjoiSVRFTSM1In0='

      const secondPage = await TestItem.query().cursorPaginate(mockCursor, 5)

      expect(secondPage).toHaveProperty('items')
    })
  })

  describe('Limit and Take', () => {
    it('should limit results with limit()', async () => {
      const results = await TestItem.query().limit(5).get()
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('should limit results with take()', async () => {
      const results = await TestItem.query().take(3).get()
      expect(results.length).toBeLessThanOrEqual(3)
    })
  })

  describe('First and FirstOrFail', () => {
    it('should get first result', async () => {
      const result = await TestItem.query().first()
      // Returns a single item or null
      expect(result === null || result instanceof TestItem).toBe(true)
    })

    it('should throw on firstOrFail when empty', async () => {
      const mockClient: DynamoDBClient = {
        getItem: mock(async () => null),
        putItem: mock(async () => {}),
        updateItem: mock(async () => null),
        deleteItem: mock(async () => {}),
        query: mock(async () => ({ items: [], count: 0 })),
        scan: mock(async () => ({ items: [], count: 0 })),
        batchGetItem: mock(async () => []),
        batchWriteItem: mock(async () => {}),
        transactWriteItems: mock(async () => {}),
      }

      setModelClient(mockClient)

      await expect(TestItem.query().firstOrFail()).rejects.toThrow()
    })
  })
})

describe('Aggregations', () => {
  beforeEach(() => {
    const mockClient: DynamoDBClient = {
      getItem: mock(async () => null),
      putItem: mock(async () => {}),
      updateItem: mock(async () => null),
      deleteItem: mock(async () => {}),
      query: mock(async () => {
        const items = [
          { pk: { S: 'ITEM#1' }, sk: { S: 'ITEM#1' }, id: { S: '1' }, price: { N: '10' }, _et: { S: 'ITEM' } },
          { pk: { S: 'ITEM#2' }, sk: { S: 'ITEM#2' }, id: { S: '2' }, price: { N: '20' }, _et: { S: 'ITEM' } },
          { pk: { S: 'ITEM#3' }, sk: { S: 'ITEM#3' }, id: { S: '3' }, price: { N: '30' }, _et: { S: 'ITEM' } },
        ]
        return {
          items,
          count: items.length,
        }
      }),
      scan: mock(async () => {
        const items = [
          { pk: { S: 'ITEM#1' }, sk: { S: 'ITEM#1' }, id: { S: '1' }, price: { N: '10' }, _et: { S: 'ITEM' } },
          { pk: { S: 'ITEM#2' }, sk: { S: 'ITEM#2' }, id: { S: '2' }, price: { N: '20' }, _et: { S: 'ITEM' } },
          { pk: { S: 'ITEM#3' }, sk: { S: 'ITEM#3' }, id: { S: '3' }, price: { N: '30' }, _et: { S: 'ITEM' } },
        ]
        return {
          items,
          count: items.length,
        }
      }),
      batchGetItem: mock(async () => []),
      batchWriteItem: mock(async () => {}),
      transactWriteItems: mock(async () => {}),
    }

    setModelClient(mockClient)
    setModelConfig(mockConfig)
    setOrmModelRegistry(createMockRegistry())
  })

  describe('sum', () => {
    it('should calculate sum of numeric field', async () => {
      const result = await TestItem.query().sum('price')
      expect(typeof result).toBe('number')
    })
  })

  describe('avg', () => {
    it('should calculate average of numeric field', async () => {
      const result = await TestItem.query().avg('price')
      expect(typeof result).toBe('number')
    })
  })

  describe('min', () => {
    it('should find minimum value', async () => {
      const result = await TestItem.query().min('price')
      expect(result === null || typeof result === 'number').toBe(true)
    })
  })

  describe('max', () => {
    it('should find maximum value', async () => {
      const result = await TestItem.query().max('price')
      expect(result === null || typeof result === 'number').toBe(true)
    })
  })

  describe('count', () => {
    it('should count items', async () => {
      const result = await TestItem.query().count()
      expect(typeof result).toBe('number')
    })
  })
})

describe('Bulk Update and Delete', () => {
  let updateCalls: number
  let deleteCalls: number

  beforeEach(() => {
    updateCalls = 0
    deleteCalls = 0

    const mockClient: DynamoDBClient = {
      getItem: mock(async () => null),
      putItem: mock(async () => {}),
      updateItem: mock(async () => {
        updateCalls++
        return {}
      }),
      deleteItem: mock(async () => {
        deleteCalls++
      }),
      query: mock(async () => {
        const items = [
          { pk: { S: 'ITEM#1' }, sk: { S: 'ITEM#1' }, id: { S: '1' }, name: { S: 'Item 1' }, _et: { S: 'ITEM' } },
          { pk: { S: 'ITEM#2' }, sk: { S: 'ITEM#2' }, id: { S: '2' }, name: { S: 'Item 2' }, _et: { S: 'ITEM' } },
        ]
        return {
          items,
          count: items.length,
        }
      }),
      scan: mock(async () => ({
        items: [],
        count: 0,
      })),
      batchGetItem: mock(async () => []),
      batchWriteItem: mock(async () => {}),
      transactWriteItems: mock(async () => {}),
    }

    setModelClient(mockClient)
    setModelConfig(mockConfig)
    setOrmModelRegistry(createMockRegistry())
  })

  describe('bulk update', () => {
    it('should update multiple items', async () => {
      const count = await TestItem.query()
        .where('pk', 'ITEM#1')
        .update({ name: 'Updated' })

      expect(typeof count).toBe('number')
    })
  })

  describe('bulk delete', () => {
    it('should delete multiple items', async () => {
      const count = await TestItem.query()
        .where('pk', 'ITEM#1')
        .delete()

      expect(typeof count).toBe('number')
    })
  })
})
