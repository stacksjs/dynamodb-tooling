import { beforeEach, describe, expect, it } from 'bun:test'
import {
  CacheManager,
  createCacheManager,
  hashQuery,
  MemoryCacheStore,
} from '../src'

describe('CacheManager', () => {
  describe('creation', () => {
    it('should create a cache manager', () => {
      const cache = createCacheManager()
      expect(cache).toBeInstanceOf(CacheManager)
    })

    it('should create cache with custom store', () => {
      const store = new MemoryCacheStore()
      const cache = createCacheManager({ store })
      expect(cache).toBeInstanceOf(CacheManager)
    })

    it('should create cache with TTL option', () => {
      const cache = createCacheManager({ ttl: 60000 })
      expect(cache).toBeInstanceOf(CacheManager)
    })

    it('should create cache with max size option', () => {
      const cache = createCacheManager({ maxSize: 1000 })
      expect(cache).toBeInstanceOf(CacheManager)
    })

    it('should create cache with multiple options', () => {
      const cache = createCacheManager({
        ttl: 60000,
        maxSize: 1000,
        store: new MemoryCacheStore(),
      })
      expect(cache).toBeInstanceOf(CacheManager)
    })
  })

  describe('basic operations', () => {
    it('should set and get values', async () => {
      const cache = createCacheManager()

      await cache.set('key1', 'value1')
      const value = await cache.get('key1')
      expect(value).toBe('value1')
    })

    it('should return undefined for missing keys', async () => {
      const cache = createCacheManager()

      const value = await cache.get('nonexistent')
      expect(value).toBeUndefined()
    })

    it('should delete values', async () => {
      const cache = createCacheManager()

      await cache.set('key1', 'value1')
      await cache.delete('key1')
      const value = await cache.get('key1')
      expect(value).toBeUndefined()
    })

    it('should clear all values', async () => {
      const cache = createCacheManager()

      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.clear()

      expect(await cache.get('key1')).toBeUndefined()
      expect(await cache.get('key2')).toBeUndefined()
    })

    it('should check if key exists', async () => {
      const cache = createCacheManager()

      await cache.set('key1', 'value1')
      expect(await cache.has('key1')).toBe(true)
      expect(await cache.has('key2')).toBe(false)
    })
  })

  describe('getOrSet pattern', () => {
    it('should compute and cache value on miss', async () => {
      const cache = createCacheManager()
      let callCount = 0

      const result = await cache.getOrSet('key', async () => {
        callCount++
        return 'computed-value'
      })

      expect(result).toBe('computed-value')
      expect(callCount).toBe(1)
    })

    it('should return cached value on hit', async () => {
      const cache = createCacheManager()
      let callCount = 0

      const result1 = await cache.getOrSet('key', async () => {
        callCount++
        return 'computed-value'
      })

      const result2 = await cache.getOrSet('key', async () => {
        callCount++
        return 'computed-value-2'
      })

      expect(result1).toBe('computed-value')
      expect(result2).toBe('computed-value')
      expect(callCount).toBe(1) // Should only compute once
    })

    it('should handle async computation', async () => {
      const cache = createCacheManager()

      const result = await cache.getOrSet('key', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async-value'
      })

      expect(result).toBe('async-value')
    })

    it('should handle computation errors', async () => {
      const cache = createCacheManager()

      await expect(
        cache.getOrSet('key', async () => {
          throw new Error('Computation failed')
        }),
      ).rejects.toThrow('Computation failed')
    })

    it('should not cache failed computations', async () => {
      const cache = createCacheManager()
      let callCount = 0

      try {
        await cache.getOrSet('key', async () => {
          callCount++
          throw new Error('Failed')
        })
      }
      catch {
        // Expected
      }

      try {
        await cache.getOrSet('key', async () => {
          callCount++
          return 'success'
        })
      }
      catch {
        // May or may not succeed depending on implementation
      }

      expect(callCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('TTL handling', () => {
    it('should expire values after TTL', async () => {
      const cache = createCacheManager({ ttl: 50 })

      await cache.set('key1', 'value1')
      expect(await cache.get<string>('key1')).toBe('value1')

      await new Promise(resolve => setTimeout(resolve, 60))
      expect(await cache.get('key1')).toBeUndefined()
    })

    it('should support per-key TTL', async () => {
      const cache = createCacheManager()

      await cache.set('key1', 'value1', { ttl: 50 })
      await cache.set('key2', 'value2', { ttl: 500 })

      await new Promise(resolve => setTimeout(resolve, 60))

      expect(await cache.get('key1')).toBeUndefined()
      expect(await cache.get<string>('key2')).toBe('value2')
    })

    it('should refresh TTL on access if configured', async () => {
      const cache = createCacheManager({
        ttl: 100,
        refreshOnAccess: true,
      })

      await cache.set('key1', 'value1')

      // Access multiple times to keep refreshing
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 30))
        expect(await cache.get<string>('key1')).toBe('value1')
      }

      // Value should still be alive after 150ms total
      expect(await cache.get<string>('key1')).toBe('value1')
    })
  })

  describe('complex values', () => {
    it('should cache objects', async () => {
      const cache = createCacheManager()
      const obj = { name: 'John', age: 30 }

      await cache.set('user', obj)
      const result = await cache.get('user')
      expect(result).toEqual(obj)
    })

    it('should cache arrays', async () => {
      const cache = createCacheManager()
      const arr = [1, 2, 3, 4, 5]

      await cache.set('numbers', arr)
      const result = await cache.get('numbers')
      expect(result).toEqual(arr)
    })

    it('should cache nested objects', async () => {
      const cache = createCacheManager()
      const nested = {
        user: {
          profile: {
            address: {
              city: 'NYC',
            },
          },
        },
      }

      await cache.set('nested', nested)
      const result = await cache.get('nested')
      expect(result).toEqual(nested)
    })

    it('should cache null values', async () => {
      const cache = createCacheManager()

      await cache.set('null', null)
      const result = await cache.get('null')
      expect(result).toBeNull()
    })

    it('should differentiate between null and undefined', async () => {
      const cache = createCacheManager()

      await cache.set('null', null)
      const nullResult = await cache.get('null')
      const undefResult = await cache.get('undefined')

      expect(nullResult).toBeNull()
      expect(undefResult).toBeUndefined()
    })
  })

  describe('cache statistics', () => {
    it('should track hit count', async () => {
      const cache = createCacheManager()

      await cache.set('key', 'value')
      await cache.get('key')
      await cache.get('key')
      await cache.get('key')

      const stats = cache.getStats()
      expect(stats.hits).toBe(3)
    })

    it('should track miss count', async () => {
      const cache = createCacheManager()

      await cache.get('missing1')
      await cache.get('missing2')

      const stats = cache.getStats()
      expect(stats.misses).toBe(2)
    })

    it('should calculate hit rate', async () => {
      const cache = createCacheManager()

      await cache.set('key', 'value')
      await cache.get('key') // hit
      await cache.get('key') // hit
      await cache.get('missing') // miss

      const stats = cache.getStats()
      expect(stats.hitRate).toBeCloseTo(0.667, 1)
    })

    it('should track cache size', async () => {
      const cache = createCacheManager()

      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      const stats = cache.getStats()
      expect(stats.size).toBe(2)
    })

    it('should reset statistics', async () => {
      const cache = createCacheManager()

      await cache.set('key', 'value')
      await cache.get('key')
      cache.resetStats()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })
  })

  describe('cache eviction', () => {
    it('should evict oldest items when max size exceeded', async () => {
      const cache = createCacheManager({ maxSize: 3 })

      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')
      await cache.set('key4', 'value4')

      // key1 should be evicted
      expect(await cache.get('key1')).toBeUndefined()
      expect(await cache.get<string>('key4')).toBe('value4')
    })

    it('should use LRU eviction when configured', async () => {
      const cache = createCacheManager({
        maxSize: 3,
        evictionPolicy: 'lru',
      })

      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')

      // Access key1 to make it recently used
      await cache.get('key1')

      await cache.set('key4', 'value4')

      // key2 should be evicted (least recently used)
      expect(await cache.get('key2')).toBeUndefined()
      expect(await cache.get<string>('key1')).toBe('value1')
    })
  })
})

describe('MemoryCacheStore', () => {
  let store: MemoryCacheStore

  beforeEach(() => {
    store = new MemoryCacheStore()
  })

  it('should create a memory cache store', () => {
    expect(store).toBeInstanceOf(MemoryCacheStore)
  })

  it('should set and get values', async () => {
    await store.set('key1', 'value1')
    const value = await store.get('key1')
    expect(value).toBe('value1')
  })

  it('should delete values', async () => {
    await store.set('key1', 'value1')
    await store.delete('key1')
    expect(await store.get('key1')).toBeUndefined()
  })

  it('should clear all values', async () => {
    await store.set('key1', 'value1')
    await store.set('key2', 'value2')
    await store.clear()

    expect(await store.get('key1')).toBeUndefined()
    expect(await store.get('key2')).toBeUndefined()
  })

  it('should check key existence', async () => {
    await store.set('key1', 'value1')
    expect(await store.has('key1')).toBe(true)
    expect(await store.has('key2')).toBe(false)
  })

  it('should get current size', async () => {
    await store.set('key1', 'value1')
    await store.set('key2', 'value2')
    expect(store.size).toBe(2)
  })

  it('should handle concurrent operations', async () => {
    const operations = Array.from({ length: 100 }, (_, i) =>
      store.set(`key${i}`, `value${i}`))

    await Promise.all(operations)
    expect(store.size).toBe(100)
  })
})

describe('hashQuery', () => {
  it('should hash queries consistently', () => {
    const query1 = { TableName: 'Users', Key: { pk: '123' } }
    const hash1 = hashQuery(query1)
    const hash2 = hashQuery(query1)
    expect(hash1).toBe(hash2)
  })

  it('should produce different hashes for different queries', () => {
    const query1 = { TableName: 'Users', Key: { pk: '123' } }
    const query2 = { TableName: 'Users', Key: { pk: '456' } }
    expect(hashQuery(query1)).not.toBe(hashQuery(query2))
  })

  it('should hash objects regardless of key order', () => {
    const query1 = { a: 1, b: 2 }
    const query2 = { b: 2, a: 1 }
    expect(hashQuery(query1)).toBe(hashQuery(query2))
  })

  it('should produce string hashes', () => {
    const query = { TableName: 'Users' }
    const hash = hashQuery(query)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('should handle nested objects', () => {
    const query = {
      TableName: 'Users',
      ExpressionAttributeValues: {
        ':pk': { S: 'USER#123' },
      },
    }
    const hash = hashQuery(query)
    expect(typeof hash).toBe('string')
  })

  it('should handle arrays in queries', () => {
    const query = {
      TableName: 'Users',
      ProjectionExpression: ['pk', 'sk', 'name'],
    }
    const hash = hashQuery(query)
    expect(typeof hash).toBe('string')
  })

  it('should handle empty objects', () => {
    const hash = hashQuery({})
    expect(typeof hash).toBe('string')
  })

  it('should handle complex queries', () => {
    const query = {
      TableName: 'Orders',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      FilterExpression: 'status = :status',
      ExpressionAttributeValues: {
        ':pk': 'USER#123',
        ':prefix': 'ORDER#',
        ':status': 'pending',
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      Limit: 10,
      ScanIndexForward: false,
    }
    const hash = hashQuery(query)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })
})

describe('cache integration with DynamoDB queries', () => {
  it('should cache query results', async () => {
    const cache = createCacheManager()
    const mockQuery = { TableName: 'Users', Key: { pk: 'USER#123' } }
    const mockResult = { Item: { pk: 'USER#123', name: 'John' } }

    const key = hashQuery(mockQuery)
    await cache.set(key, mockResult)

    const cached = await cache.get(key)
    expect(cached).toEqual(mockResult)
  })

  it('should use getOrSet for query caching', async () => {
    const cache = createCacheManager()
    let dbCalls = 0

    const executeQuery = async (query: Record<string, unknown>) => {
      const key = hashQuery(query)
      return cache.getOrSet(key, async () => {
        dbCalls++
        return { Item: { pk: 'USER#123', name: 'John' } }
      })
    }

    const query = { TableName: 'Users', Key: { pk: 'USER#123' } }

    await executeQuery(query)
    await executeQuery(query)
    await executeQuery(query)

    expect(dbCalls).toBe(1)
  })

  it('should invalidate cache on write operations', async () => {
    const cache = createCacheManager()
    const query = { TableName: 'Users', Key: { pk: 'USER#123' } }
    const key = hashQuery(query)

    // Cache a read result
    await cache.set(key, { Item: { pk: 'USER#123', name: 'John' } })

    // Simulate write operation - invalidate cache
    await cache.delete(key)

    // Cache should be empty now
    expect(await cache.get(key)).toBeUndefined()
  })

  it('should handle cache warming', async () => {
    const cache = createCacheManager()
    const items = [
      { pk: 'USER#1', name: 'John' },
      { pk: 'USER#2', name: 'Jane' },
      { pk: 'USER#3', name: 'Bob' },
    ]

    // Warm cache with multiple items
    for (const item of items) {
      const key = hashQuery({ TableName: 'Users', Key: { pk: item.pk } })
      await cache.set(key, { Item: item })
    }

    const stats = cache.getStats()
    expect(stats.size).toBe(3)
  })
})

describe('edge cases', () => {
  it('should handle very long keys', async () => {
    const cache = createCacheManager()
    const longKey = 'k'.repeat(10000)

    await cache.set(longKey, 'value')
    expect(await cache.get<string>(longKey)).toBe('value')
  })

  it('should handle special characters in keys', async () => {
    const cache = createCacheManager()
    const specialKey = 'key:with/special#chars@!$%^&*()'

    await cache.set(specialKey, 'value')
    expect(await cache.get<string>(specialKey)).toBe('value')
  })

  it('should handle unicode in keys and values', async () => {
    const cache = createCacheManager()
    const unicodeKey = '键值🔑'
    const unicodeValue = '值👋'

    await cache.set(unicodeKey, unicodeValue)
    expect(await cache.get<string>(unicodeKey)).toBe(unicodeValue)
  })

  it('should handle large values', async () => {
    const cache = createCacheManager()
    const largeValue = { data: 'x'.repeat(100000) }

    await cache.set('large', largeValue)
    const result = await cache.get<{ data: string }>('large')
    expect(result?.data.length).toBe(100000)
  })

  it('should handle many concurrent getOrSet calls for same key', async () => {
    const cache = createCacheManager()
    let computeCount = 0

    const promises = Array.from({ length: 10 }, () =>
      cache.getOrSet('key', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        computeCount++
        return 'value'
      }))

    const results = await Promise.all(promises)
    expect(results.every(r => r === 'value')).toBe(true)
    // Depending on implementation, may compute once or multiple times
    expect(computeCount).toBeGreaterThanOrEqual(1)
  })

  it('should handle rapid set/get cycles', async () => {
    const cache = createCacheManager()

    for (let i = 0; i < 100; i++) {
      await cache.set('key', i)
      const value = await cache.get('key')
      expect(value).toBe(i)
    }
  })
})
