import { describe, expect, it } from 'bun:test'
import {
  createDataGenerator,
  createQueryAnalyzer,
  DataGenerator,
  entityGenerator,
  generators,
  QueryAnalyzer,
} from '../src'

describe('DataGenerator', () => {
  describe('creation', () => {
    it('should create a data generator with schema', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        email: () => generators.email(),
      })
      expect(generator).toBeInstanceOf(DataGenerator)
    })

    it('should create generator with empty schema', () => {
      const generator = createDataGenerator({})
      expect(generator).toBeInstanceOf(DataGenerator)
    })

    it('should create generator with complex nested schema', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        profile: () => ({
          name: generators.string({ length: 10 }),
          age: generators.integer({ min: 18, max: 100 }),
        }),
      })
      expect(generator).toBeInstanceOf(DataGenerator)
    })
  })

  describe('built-in generators', () => {
    it('should generate UUIDs', () => {
      const uuid = generators.uuid()
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('should generate unique UUIDs each time', () => {
      const uuids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        uuids.add(generators.uuid())
      }
      expect(uuids.size).toBe(100)
    })

    it('should generate emails', () => {
      const email = generators.email()
      expect(email).toContain('@')
      expect(email).toContain('.')
    })

    it('should generate emails with custom domain', () => {
      const email = generators.email({ domain: 'test.com' })
      expect(email).toContain('@test.com')
    })

    it('should have all built-in generators defined', () => {
      expect(generators.uuid).toBeDefined()
      expect(generators.email).toBeDefined()
      expect(generators.string).toBeDefined()
      expect(generators.integer).toBeDefined()
      expect(generators.boolean).toBeDefined()
      expect(generators.date).toBeDefined()
    })

    it('should generate strings with default length', () => {
      const str = generators.string()
      expect(typeof str).toBe('string')
      expect(str.length).toBeGreaterThan(0)
    })

    it('should generate strings with custom length', () => {
      const str = generators.string({ length: 20 })
      expect(str.length).toBe(20)
    })

    it('should generate integers within range', () => {
      const num = generators.integer({ min: 10, max: 20 })
      expect(num).toBeGreaterThanOrEqual(10)
      expect(num).toBeLessThanOrEqual(20)
    })

    it('should generate integers with default range', () => {
      const num = generators.integer()
      expect(Number.isInteger(num)).toBe(true)
    })

    it('should generate booleans', () => {
      const bool = generators.boolean()
      expect(typeof bool).toBe('boolean')
    })

    it('should generate dates', () => {
      const date = generators.date()
      expect(date).toBeInstanceOf(Date)
    })

    it('should generate dates within range', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2020-12-31')
      const date = generators.date({ start, end })
      expect(date.getTime()).toBeGreaterThanOrEqual(start.getTime())
      expect(date.getTime()).toBeLessThanOrEqual(end.getTime())
    })
  })

  describe('entity generator builder', () => {
    it('should build entity generators', () => {
      const userGenerator = entityGenerator('User')
        .uuid('id')
        .email('email')
        .string('name')
        .build()

      const user = userGenerator.generate()
      expect(user.id).toBeDefined()
      expect(user.email).toContain('@')
      expect(user.name).toBeDefined()
      expect(user.pk).toBeDefined() // Auto-generated pk
    })

    it('should support integer fields', () => {
      const personGenerator = entityGenerator('Person')
        .uuid('id')
        .integer('age', { min: 18, max: 100 })
        .build()

      const person = personGenerator.generate()
      expect(person.age).toBeGreaterThanOrEqual(18)
      expect(person.age).toBeLessThanOrEqual(100)
    })

    it('should support boolean fields', () => {
      const itemGenerator = entityGenerator('Item')
        .uuid('id')
        .boolean('active')
        .build()

      const item = itemGenerator.generate()
      expect(typeof item.active).toBe('boolean')
    })

    it('should support date fields', () => {
      const eventGenerator = entityGenerator('Event')
        .uuid('id')
        .date('createdAt')
        .build()

      const event = eventGenerator.generate()
      expect(event.createdAt).toBeInstanceOf(Date)
    })

    it('should support custom fields', () => {
      const productGenerator = entityGenerator('Product')
        .uuid('id')
        .custom('status', () => ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)])
        .build()

      const product = productGenerator.generate()
      expect(['active', 'inactive', 'pending']).toContain(product.status)
    })
  })

  describe('generating items', () => {
    it('should generate a single item', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        name: () => generators.string({ length: 5 }),
      })

      const item = generator.generate()
      expect(item.id).toBeDefined()
      expect(item.name).toBeDefined()
    })

    it('should generate multiple items', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        name: () => generators.string({ length: 5 }),
      })

      const items = generator.generateMany(5)
      expect(items).toHaveLength(5)
      expect(items[0].id).toBeDefined()
    })

    it('should generate many unique items', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
      })

      const items = generator.generateMany(100)
      const uniqueIds = new Set(items.map(i => i.id))
      expect(uniqueIds.size).toBe(100)
    })

    it('should generate zero items when count is zero', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
      })

      const items = generator.generateMany(0)
      expect(items).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle generators that return undefined', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        optional: () => undefined,
      })

      const item = generator.generate()
      expect(item.id).toBeDefined()
      expect(item.optional).toBeUndefined()
    })

    it('should handle generators that return null', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        nullable: () => null,
      })

      const item = generator.generate()
      expect(item.nullable).toBeNull()
    })

    it('should handle generators returning arrays', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        tags: () => ['tag1', 'tag2', 'tag3'],
      })

      const item = generator.generate()
      expect(item.tags).toEqual(['tag1', 'tag2', 'tag3'])
    })

    it('should handle nested object generators', () => {
      const generator = createDataGenerator({
        id: generators.uuid,
        address: () => ({
          street: generators.string({ length: 10 }),
          city: generators.string({ length: 8 }),
          zip: generators.string({ length: 5 }),
        }),
      })

      const item = generator.generate()
      expect(item.address).toBeDefined()
      expect(item.address.street).toBeDefined()
      expect(item.address.city).toBeDefined()
      expect(item.address.zip).toBeDefined()
    })
  })
})

describe('QueryAnalyzer', () => {
  describe('creation', () => {
    it('should create a query analyzer', () => {
      const analyzer = createQueryAnalyzer()
      expect(analyzer).toBeInstanceOf(QueryAnalyzer)
    })

    it('should create analyzer with custom options', () => {
      const analyzer = createQueryAnalyzer({
        warnOnScan: true,
        warnOnMissingIndex: true,
      })
      expect(analyzer).toBeInstanceOf(QueryAnalyzer)
    })
  })

  describe('analyze', () => {
    it('should analyze Query operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Query',
        tableName: 'Users',
        keyConditionExpression: 'pk = :pk',
        expressionAttributeValues: { ':pk': 'USER#123' },
      })

      expect(analysis).toBeDefined()
      expect(analysis.operation).toBe('Query')
      expect(analysis.score).toBeDefined()
      expect(analysis.characteristics).toBeDefined()
    })

    it('should analyze GetItem operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'GetItem',
        tableName: 'Users',
        key: { pk: 'USER#123', sk: 'PROFILE' },
      })

      expect(analysis.operation).toBe('GetItem')
      expect(analysis.characteristics.isPointRead).toBe(true)
    })

    it('should analyze PutItem operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'PutItem',
        tableName: 'Users',
        item: { pk: 'USER#123', sk: 'PROFILE', name: 'John' },
      })

      expect(analysis.operation).toBe('PutItem')
      expect(analysis.characteristics.isWrite).toBe(true)
    })

    it('should analyze UpdateItem operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'UpdateItem',
        tableName: 'Users',
        key: { pk: 'USER#123', sk: 'PROFILE' },
        updateExpression: 'SET #name = :name',
      })

      expect(analysis.operation).toBe('UpdateItem')
      expect(analysis.characteristics.isWrite).toBe(true)
    })

    it('should analyze DeleteItem operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'DeleteItem',
        tableName: 'Users',
        key: { pk: 'USER#123', sk: 'PROFILE' },
      })

      expect(analysis.operation).toBe('DeleteItem')
      expect(analysis.characteristics.isWrite).toBe(true)
    })
  })

  describe('detecting issues', () => {
    it('should detect full table scans', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Scan',
        tableName: 'Users',
      })

      expect(analysis.characteristics.isFullScan).toBe(true)
      expect(analysis.issues.some(i => i.code === 'FULL_TABLE_SCAN')).toBe(true)
    })

    it('should detect scans with filter expressions', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Scan',
        tableName: 'Users',
        filterExpression: 'status = :status',
        expressionAttributeValues: { ':status': 'active' },
      })

      expect(analysis.characteristics.isFullScan).toBe(true)
      expect(analysis.characteristics.hasFilter).toBe(true)
    })

    it('should detect missing GSI usage', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Scan',
        tableName: 'Users',
        filterExpression: 'email = :email',
        expressionAttributeValues: { ':email': 'test@test.com' },
      })

      expect(analysis.issues.some(i => i.code === 'FILTER_INSTEAD_OF_GSI' || i.code === 'FULL_TABLE_SCAN')).toBe(true)
    })

    it('should detect queries without sort key', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Query',
        tableName: 'Users',
        keyConditionExpression: 'pk = :pk',
        expressionAttributeValues: { ':pk': 'USER#123' },
      })

      expect(analysis.characteristics.usesSortKey).toBe(false)
    })

    it('should detect queries with sort key', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Query',
        tableName: 'Users',
        keyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        expressionAttributeValues: { ':pk': 'USER#123', ':prefix': 'ORDER#' },
      })

      expect(analysis.characteristics.usesSortKey).toBe(true)
    })
  })

  describe('scoring', () => {
    it('should give high score to point reads', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'GetItem',
        tableName: 'Users',
        key: { pk: 'USER#123', sk: 'PROFILE' },
      })

      expect(analysis.score).toBeGreaterThanOrEqual(90)
    })

    it('should give low score to full table scans', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Scan',
        tableName: 'Users',
      })

      expect(analysis.score).toBeLessThanOrEqual(50)
    })

    it('should give medium score to queries', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Query',
        tableName: 'Users',
        keyConditionExpression: 'pk = :pk',
        expressionAttributeValues: { ':pk': 'USER#123' },
      })

      expect(analysis.score).toBeGreaterThanOrEqual(60)
      expect(analysis.score).toBeLessThanOrEqual(95)
    })
  })

  describe('explain', () => {
    it('should explain queries', () => {
      const analyzer = createQueryAnalyzer()

      const explanation = analyzer.explain({
        operation: 'Query',
        tableName: 'Users',
        keyConditionExpression: 'pk = :pk',
      })

      expect(explanation).toContain('Operation: Query')
      expect(explanation).toContain('Table: Users')
    })

    it('should explain scans with warnings', () => {
      const analyzer = createQueryAnalyzer()

      const explanation = analyzer.explain({
        operation: 'Scan',
        tableName: 'Users',
      })

      expect(explanation).toContain('Operation: Scan')
      expect(explanation.toLowerCase()).toContain('scan')
    })

    it('should explain GetItem operations', () => {
      const analyzer = createQueryAnalyzer()

      const explanation = analyzer.explain({
        operation: 'GetItem',
        tableName: 'Users',
        key: { pk: 'USER#123', sk: 'PROFILE' },
      })

      expect(explanation).toContain('Operation: GetItem')
      expect(explanation).toContain('Table: Users')
    })
  })

  describe('edge cases', () => {
    it('should handle empty key condition expression', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'Query',
        tableName: 'Users',
        keyConditionExpression: '',
      })

      expect(analysis).toBeDefined()
    })

    it('should handle BatchGetItem operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'BatchGetItem',
        requestItems: {
          Users: {
            Keys: [
              { pk: 'USER#1', sk: 'PROFILE' },
              { pk: 'USER#2', sk: 'PROFILE' },
            ],
          },
        },
      })

      expect(analysis.operation).toBe('BatchGetItem')
    })

    it('should handle BatchWriteItem operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'BatchWriteItem',
        requestItems: {
          Users: [
            { PutRequest: { Item: { pk: 'USER#1', sk: 'PROFILE' } } },
          ],
        },
      })

      expect(analysis.operation).toBe('BatchWriteItem')
      expect(analysis.characteristics.isWrite).toBe(true)
    })

    it('should handle TransactGetItems operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'TransactGetItems',
        transactItems: [
          { Get: { TableName: 'Users', Key: { pk: 'USER#1', sk: 'PROFILE' } } },
        ],
      })

      expect(analysis.operation).toBe('TransactGetItems')
    })

    it('should handle TransactWriteItems operations', () => {
      const analyzer = createQueryAnalyzer()

      const analysis = analyzer.analyze({
        operation: 'TransactWriteItems',
        transactItems: [
          { Put: { TableName: 'Users', Item: { pk: 'USER#1', sk: 'PROFILE' } } },
        ],
      })

      expect(analysis.operation).toBe('TransactWriteItems')
      expect(analysis.characteristics.isWrite).toBe(true)
    })
  })
})
