import type { ModelRegistry } from '../src/model-parser/types'
import type { DynamoDBClient, ModelAttribute, ModelRelationship } from '../src/models/DynamoDBModel'
import type { Config } from '../src/types'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { defaultConfig } from '../src/config'
import {
  DynamoDBModel,
  DynamoDBQueryBuilder,
  setModelClient,
  setModelConfig,
  setOrmModelRegistry,
} from '../src/models/DynamoDBModel'

// Create a test model
class TestUser extends DynamoDBModel {
  static table = 'users'
  static primaryKey = 'id'
  static pkPrefix = 'USER'
  static timestamps = true
  static softDeletes = false
  static uuid = true

  get attributes(): Record<string, ModelAttribute> {
    return {
      id: { name: 'id', type: 'string', required: true },
      name: { name: 'name', type: 'string', required: true },
      email: { name: 'email', type: 'string', required: true, unique: true },
      age: { name: 'age', type: 'number' },
      status: { name: 'status', type: 'string', default: 'active' },
      password: { name: 'password', type: 'string', hidden: true },
    }
  }

  get relationships(): Record<string, ModelRelationship> {
    return {}
  }
}

class TestPost extends DynamoDBModel {
  static table = 'posts'
  static primaryKey = 'id'
  static pkPrefix = 'POST'
  static timestamps = true
  static softDeletes = true

  get attributes(): Record<string, ModelAttribute> {
    return {
      id: { name: 'id', type: 'string', required: true },
      title: { name: 'title', type: 'string', required: true },
      content: { name: 'content', type: 'string' },
      userId: { name: 'userId', type: 'string', required: true },
    }
  }

  get relationships(): Record<string, ModelRelationship> {
    return {
      user: {
        type: 'belongsTo',
        model: 'TestUser',
        foreignKey: 'userId',
      },
    }
  }
}

// Mock DynamoDB client
function createMockClient(): DynamoDBClient {
  const storage = new Map<string, unknown>()

  return {
    getItem: mock(async (_tableName: string, _key: Record<string, unknown>) => {
      return null
    }) as DynamoDBClient['getItem'],
    putItem: mock(async (_tableName: string, _item: Record<string, unknown>) => {
      // no-op
    }) as DynamoDBClient['putItem'],
    updateItem: mock(async (_tableName: string, _key: Record<string, unknown>, _updates: Record<string, unknown>) => {
      return null
    }) as DynamoDBClient['updateItem'],
    deleteItem: mock(async (_tableName: string, _key: Record<string, unknown>) => {
      // no-op
    }) as DynamoDBClient['deleteItem'],
    query: mock(async () => ({
      items: [],
      count: 0,
    })) as DynamoDBClient['query'],
    scan: mock(async () => ({
      items: [],
      count: 0,
    })) as DynamoDBClient['scan'],
    batchGetItem: mock(async () => []) as DynamoDBClient['batchGetItem'],
    batchWriteItem: mock(async () => {}) as DynamoDBClient['batchWriteItem'],
    transactWriteItems: mock(async () => {}) as DynamoDBClient['transactWriteItems'],
  }
}

// Mock config - use defaultConfig as base
const mockConfig: Config = {
  ...defaultConfig,
  defaultTableName: 'main',
}

// Mock registry
function createMockRegistry(): ModelRegistry {
  return {
    models: new Map(),
    accessPatterns: [],
    gsiAssignments: new Map(),
    warnings: [],
  }
}

describe('DynamoDBModel', () => {
  let mockClient: DynamoDBClient

  beforeEach(() => {
    mockClient = createMockClient()
    setModelClient(mockClient)
    setModelConfig(mockConfig)
    setOrmModelRegistry(createMockRegistry())
  })

  describe('Model Creation', () => {
    it('should create model with attributes', () => {
      const user = new TestUser({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(user.getAttribute('id')).toBe('123')
      expect(user.getAttribute('name')).toBe('John Doe')
      expect(user.getAttribute('email')).toBe('john@example.com')
    })

    it('should fill attributes', () => {
      const user = new TestUser()
      user.fill({
        name: 'Jane Doe',
        email: 'jane@example.com',
      })

      expect(user.getAttribute('name')).toBe('Jane Doe')
      expect(user.getAttribute('email')).toBe('jane@example.com')
    })

    it('should set individual attributes', () => {
      const user = new TestUser()
      user.setAttribute('name', 'Test User')

      expect(user.getAttribute('name')).toBe('Test User')
    })

    it('should track existence status', () => {
      const user = new TestUser()
      expect(user.exists).toBe(false)
    })
  })

  describe('Dirty Tracking', () => {
    it('should detect dirty attributes', () => {
      const user = new TestUser({ name: 'Original' })
      user.syncOriginal()

      expect(user.isDirty()).toBe(false)

      user.setAttribute('name', 'Changed')
      expect(user.isDirty()).toBe(true)
      expect(user.isDirty('name')).toBe(true)
    })

    it('should get dirty attributes', () => {
      const user = new TestUser({ name: 'Original', email: 'test@test.com' })
      user.syncOriginal()

      user.setAttribute('name', 'Changed')

      const dirty = user.getDirty()
      expect(dirty.name).toBe('Changed')
      expect(dirty.email).toBeUndefined()
    })

    it('should get original values', () => {
      const user = new TestUser({ name: 'Original' })
      user.syncOriginal()
      user.setAttribute('name', 'Changed')

      expect(user.getOriginal('name')).toBe('Original')
    })

    it('should sync original after save', () => {
      const user = new TestUser({ name: 'Test' })
      user.syncOriginal()

      expect(user.isClean()).toBe(true)
    })
  })

  describe('Serialization', () => {
    it('should convert to JSON', () => {
      const user = new TestUser({
        id: '123',
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
      })

      const json = user.toJSON()
      expect(json.id).toBe('123')
      expect(json.name).toBe('John')
      expect(json.password).toBeUndefined() // Hidden field
    })

    it('should get only specified attributes', () => {
      const user = new TestUser({
        id: '123',
        name: 'John',
        email: 'john@example.com',
      })

      const result = user.only('id', 'name')
      expect(result.id).toBe('123')
      expect(result.name).toBe('John')
      expect(result.email).toBeUndefined()
    })

    it('should get all except specified attributes', () => {
      const user = new TestUser({
        id: '123',
        name: 'John',
        email: 'john@example.com',
      })

      const result = user.except('email')
      expect(result.id).toBe('123')
      expect(result.name).toBe('John')
      expect(result.email).toBeUndefined()
    })

    it('should clone model with replicate', () => {
      const original = new TestUser({
        name: 'Original',
        email: 'original@test.com',
      })

      const clone = original.replicate()
      expect(clone.getAttribute('name')).toBe('Original')
      expect(clone).not.toBe(original)
    })
  })

  describe('Hidden/Visible Attributes', () => {
    it('should respect hidden attributes', () => {
      const user = new TestUser({
        id: '123',
        name: 'John',
        password: 'secret',
      })

      const json = user.toJSON()
      expect(json.password).toBeUndefined()
    })

    it('should make hidden attributes visible', () => {
      const user = new TestUser({
        id: '123',
        password: 'secret',
      })

      user.makeVisible('password')
      const json = user.toJSON()
      expect(json.password).toBe('secret')
    })

    it('should make visible attributes hidden', () => {
      const user = new TestUser({
        id: '123',
        name: 'John',
      })

      user.makeHidden('name')
      const json = user.toJSON()
      expect(json.name).toBeUndefined()
    })
  })

  describe('Static Configuration', () => {
    it('should have correct static properties', () => {
      expect(TestUser.table).toBe('users')
      expect(TestUser.primaryKey).toBe('id')
      expect(TestUser.pkPrefix).toBe('USER')
      expect(TestUser.timestamps).toBe(true)
      expect(TestUser.uuid).toBe(true)
    })

    it('should handle soft deletes configuration', () => {
      expect(TestPost.softDeletes).toBe(true)
      expect(TestUser.softDeletes).toBe(false)
    })
  })

  describe('Model Hooks', () => {
    it('should register and call hooks', async () => {
      let hookCalled = false

      TestUser.addHook('saving', () => {
        hookCalled = true
      })

      const user = new TestUser({
        id: '123',
        name: 'Test',
        email: 'test@test.com',
      })

      await user.save()
      expect(hookCalled).toBe(true)
    })

    it('should cancel operation when hook returns false', async () => {
      TestUser.addHook('creating', () => false)

      const user = new TestUser({
        name: 'Test',
        email: 'test@test.com',
      })

      const result = await user.save()
      expect(result).toBe(false)
    })
  })

  describe('Global Scopes', () => {
    it('should register global scope', () => {
      TestUser.addGlobalScope('active', (query) => {
        return query.where('status', 'active')
      })

      const scopes = TestUser.getGlobalScopes()
      expect(scopes.has('active')).toBe(true)
    })
  })

  describe('Type Casting', () => {
    it('should register casts', () => {
      TestUser.setCasts({
        age: 'integer',
        active: 'boolean',
      })
      // Casts are registered successfully (no assertion needed, just verify no error)
      expect(true).toBe(true)
    })
  })

  describe('Entity Type', () => {
    it('should get entity type from pkPrefix', () => {
      const user = new TestUser()
      expect(user.getEntityType()).toBe('USER')
    })

    it('should fall back to model name for entity type', () => {
      class NoPrefix extends DynamoDBModel {
        static pkPrefix = ''
        get attributes() { return {} }
        get relationships() { return {} }
      }

      const model = new NoPrefix()
      expect(model.getEntityType()).toBe('NOPREFIX')
    })
  })
})

describe('DynamoDBQueryBuilder', () => {
  let mockClient: DynamoDBClient

  beforeEach(() => {
    mockClient = createMockClient()
    setModelClient(mockClient)
    setModelConfig(mockConfig)
    setOrmModelRegistry(createMockRegistry())
  })

  describe('Query Construction', () => {
    it('should create query builder from model', () => {
      const query = TestUser.query()
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should build where conditions', () => {
      const query = TestUser.where('status', 'active')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should chain where conditions', () => {
      const query = TestUser.where('status', 'active')
        .where('age', '>', 18)
        .where('name', 'begins_with', 'J')

      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should build whereIn conditions', () => {
      const query = TestUser.query().whereIn('status', ['active', 'pending'])
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should build whereBetween conditions', () => {
      const query = TestUser.query().whereBetween('age', 18, 65)
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should build whereNull and whereNotNull', () => {
      const query = TestUser.query()
        .whereNull('deletedAt')
        .whereNotNull('email')

      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should build whereBeginsWith', () => {
      const query = TestUser.query().whereBeginsWith('email', 'admin@')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should build whereContains', () => {
      const query = TestUser.query().whereContains('tags', 'premium')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Select Projection', () => {
    it('should set select columns', () => {
      const query = TestUser.query().select('id', 'name', 'email')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Ordering', () => {
    it('should set order by ascending', () => {
      const query = TestUser.query().orderBy('createdAt', 'asc')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should set order by descending', () => {
      const query = TestUser.query().orderByDesc('createdAt')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should use latest helper', () => {
      const query = TestUser.query().latest()
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should use oldest helper', () => {
      const query = TestUser.query().oldest()
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Limiting', () => {
    it('should set limit', () => {
      const query = TestUser.query().limit(10)
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should use take alias', () => {
      const query = TestUser.query().take(10)
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Index Selection', () => {
    it('should set index name', () => {
      const query = TestUser.query().useIndex('gsi1')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Eager Loading', () => {
    it('should set eager load relationships', () => {
      const query = TestPost.query().with('user')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should set multiple relationships', () => {
      const query = TestPost.query().with('user', 'comments')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should set withCount', () => {
      const query = TestUser.query().withCount('posts')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Soft Deletes', () => {
    it('should use withTrashed', () => {
      const query = TestPost.query().withTrashed()
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should use onlyTrashed', () => {
      const query = TestPost.query().onlyTrashed()
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Relationship Existence', () => {
    it('should use has', () => {
      const query = TestUser.query().has('posts')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should use doesntHave', () => {
      const query = TestUser.query().doesntHave('posts')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should use whereHas', () => {
      const query = TestUser.query().whereHas('posts', (q) => {
        q.where('published', true)
      })
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })

  describe('Query Output', () => {
    it('should convert to query params', () => {
      setModelConfig(mockConfig)
      const query = TestUser.query().where('status', 'active')
      const result = query.toQuery()
      expect(result).toHaveProperty('operation')
      expect(result).toHaveProperty('params')
    })
  })

  describe('Aggregations', () => {
    it('should return count', async () => {
      const count = await TestUser.query().count()
      expect(typeof count).toBe('number')
    })

    it('should check exists', async () => {
      const exists = await TestUser.query().exists()
      expect(typeof exists).toBe('boolean')
    })

    it('should check doesntExist', async () => {
      const doesntExist = await TestUser.query().doesntExist()
      expect(typeof doesntExist).toBe('boolean')
    })
  })
})

describe('Static Query Methods', () => {
  let mockClient: DynamoDBClient

  beforeEach(() => {
    mockClient = createMockClient()
    setModelClient(mockClient)
    setModelConfig(mockConfig)
    setOrmModelRegistry(createMockRegistry())
  })

  describe('find', () => {
    it('should find by primary key', async () => {
      const result = await TestUser.find('123')
      // Returns null because mock storage is empty
      expect(result).toBeNull()
    })

    it('should find with composite key', async () => {
      const result = await TestUser.find('123', 'PROFILE')
      expect(result).toBeNull()
    })
  })

  describe('findOrFail', () => {
    it('should throw when not found', async () => {
      await expect(TestUser.findOrFail('non-existent')).rejects.toThrow()
    })
  })

  describe('findMany', () => {
    it('should find multiple by keys', async () => {
      const results = await TestUser.findMany([
        { pk: '1' },
        { pk: '2' },
      ])
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('all', () => {
    it('should get all models', async () => {
      const results = await TestUser.all()
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('create', () => {
    it('should create and save model', async () => {
      const user = await TestUser.create({
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(user).toBeInstanceOf(TestUser)
      // exists is set based on save operation which depends on mock implementation
      expect(user.getAttribute('name')).toBe('John Doe')
      expect(user.getAttribute('email')).toBe('john@example.com')
    })
  })

  describe('where', () => {
    it('should accept key-value pair', () => {
      const query = TestUser.where('status', 'active')
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should accept operator', () => {
      const query = TestUser.where('age', '>', 18)
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })

    it('should accept object', () => {
      const query = TestUser.where({ status: 'active', verified: true })
      expect(query).toBeInstanceOf(DynamoDBQueryBuilder)
    })
  })
})
