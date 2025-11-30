import { describe, expect, it } from 'bun:test'
import {
  createDataExporter,
  createDataImporter,
  DataExporter,
  DataImporter,
} from '../src'

describe('DataExporter', () => {
  describe('creation', () => {
    it('should create a data exporter', () => {
      const exporter = createDataExporter()
      expect(exporter).toBeInstanceOf(DataExporter)
    })

    it('should create exporter with custom options', () => {
      const exporter = createDataExporter({
        batchSize: 100,
        includeMetadata: true,
      })
      expect(exporter).toBeInstanceOf(DataExporter)
    })
  })

  describe('JSON export', () => {
    it('should export to JSON', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', name: 'John' },
        { pk: 'USER#2', name: 'Jane' },
      ]

      const result = exporter.export(items, { format: 'json' })
      expect(result.itemCount).toBe(2)
      expect(result.data).toContain('John')
      expect(result.metadata.format).toBe('json')
    })

    it('should export with proper JSON formatting', () => {
      const exporter = createDataExporter()
      const items = [{ pk: 'USER#1', name: 'John' }]

      const result = exporter.export(items, { format: 'json' })
      const parsed = JSON.parse(result.data)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0].pk).toBe('USER#1')
    })

    it('should handle nested objects in JSON', () => {
      const exporter = createDataExporter()
      const items = [
        {
          pk: 'USER#1',
          profile: {
            name: 'John',
            address: { city: 'NYC' },
          },
        },
      ]

      const result = exporter.export(items, { format: 'json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].profile.address.city).toBe('NYC')
    })

    it('should handle arrays in JSON export', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', tags: ['admin', 'active'] },
      ]

      const result = exporter.export(items, { format: 'json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].tags).toEqual(['admin', 'active'])
    })

    it('should handle empty arrays', () => {
      const exporter = createDataExporter()
      const items: any[] = []

      const result = exporter.export(items, { format: 'json' })
      expect(result.itemCount).toBe(0)
      const parsed = JSON.parse(result.data)
      expect(parsed).toEqual([])
    })
  })

  describe('CSV export', () => {
    it('should export to CSV', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', name: 'John' },
        { pk: 'USER#2', name: 'Jane' },
      ]

      const result = exporter.export(items, { format: 'csv' })
      expect(result.data).toContain('pk,name')
      expect(result.data).toContain('USER#1')
    })

    it('should handle CSV headers correctly', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', name: 'John', age: 30 },
      ]

      const result = exporter.export(items, { format: 'csv' })
      const lines = result.data.split('\n')
      expect(lines[0]).toContain('pk')
      expect(lines[0]).toContain('name')
      expect(lines[0]).toContain('age')
    })

    it('should escape CSV special characters', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', name: 'John, Jr.' },
      ]

      const result = exporter.export(items, { format: 'csv' })
      expect(result.data).toContain('"John, Jr."')
    })

    it('should escape quotes in CSV', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', quote: 'He said "Hello"' },
      ]

      const result = exporter.export(items, { format: 'csv' })
      expect(result.data).toContain('""Hello""')
    })

    it('should handle newlines in CSV fields', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', bio: 'Line 1\nLine 2' },
      ]

      const result = exporter.export(items, { format: 'csv' })
      expect(result.data).toContain('"Line 1\nLine 2"')
    })

    it('should handle empty CSV export', () => {
      const exporter = createDataExporter()
      const items: any[] = []

      const result = exporter.export(items, { format: 'csv' })
      expect(result.itemCount).toBe(0)
    })
  })

  describe('DynamoDB JSON export', () => {
    it('should export to DynamoDB JSON format', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', name: 'John', age: 30 },
      ]

      const result = exporter.export(items, { format: 'dynamodb-json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].pk.S).toBe('USER#1')
      expect(parsed[0].name.S).toBe('John')
      expect(parsed[0].age.N).toBe('30')
    })

    it('should handle boolean types in DynamoDB JSON', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', active: true },
      ]

      const result = exporter.export(items, { format: 'dynamodb-json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].active.BOOL).toBe(true)
    })

    it('should handle list types in DynamoDB JSON', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', tags: ['a', 'b'] },
      ]

      const result = exporter.export(items, { format: 'dynamodb-json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].tags.L).toBeDefined()
    })

    it('should handle map types in DynamoDB JSON', () => {
      const exporter = createDataExporter()
      const items = [
        { pk: 'USER#1', profile: { name: 'John' } },
      ]

      const result = exporter.export(items, { format: 'dynamodb-json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].profile.M).toBeDefined()
    })
  })

  describe('scan command generation', () => {
    it('should create scan command', () => {
      const exporter = createDataExporter()
      const command = exporter.createScanCommand('TestTable', { format: 'json' })

      expect(command.command).toBe('Scan')
      expect(command.input.TableName).toBe('TestTable')
    })

    it('should create scan command with projection', () => {
      const exporter = createDataExporter()
      const command = exporter.createScanCommand('TestTable', {
        format: 'json',
        attributes: ['pk', 'sk', 'name'],
      })

      expect(command.input.ProjectionExpression).toBeDefined()
    })

    it('should create scan command with filter', () => {
      const exporter = createDataExporter()
      const command = exporter.createScanCommand('TestTable', {
        format: 'json',
        filterExpression: 'status = :status',
        expressionAttributeValues: { ':status': 'active' },
      })

      expect(command.input.FilterExpression).toBe('status = :status')
    })

    it('should create scan command with limit', () => {
      const exporter = createDataExporter()
      const command = exporter.createScanCommand('TestTable', {
        format: 'json',
        limit: 100,
      })

      expect(command.input.Limit).toBe(100)
    })
  })

  describe('metadata', () => {
    it('should include export timestamp', () => {
      const exporter = createDataExporter()
      const items = [{ pk: 'USER#1' }]

      const result = exporter.export(items, { format: 'json' })
      expect(result.metadata.exportedAt).toBeDefined()
    })

    it('should include item count in metadata', () => {
      const exporter = createDataExporter()
      const items = [{ pk: 'USER#1' }, { pk: 'USER#2' }]

      const result = exporter.export(items, { format: 'json' })
      expect(result.metadata.itemCount).toBe(2)
    })

    it('should include format in metadata', () => {
      const exporter = createDataExporter()
      const items = [{ pk: 'USER#1' }]

      const result = exporter.export(items, { format: 'csv' })
      expect(result.metadata.format).toBe('csv')
    })
  })

  describe('edge cases', () => {
    it('should handle null values', () => {
      const exporter = createDataExporter()
      const items = [{ pk: 'USER#1', nullField: null }]

      const result = exporter.export(items, { format: 'json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].nullField).toBeNull()
    })

    it('should handle undefined values', () => {
      const exporter = createDataExporter()
      const items = [{ pk: 'USER#1', undef: undefined }]

      const result = exporter.export(items, { format: 'json' })
      const parsed = JSON.parse(result.data)
      expect(parsed[0].undef).toBeUndefined()
    })

    it('should handle special characters in values', () => {
      const exporter = createDataExporter()
      const items = [{ pk: 'USER#1', emoji: '👋🌍' }]

      const result = exporter.export(items, { format: 'json' })
      expect(result.data).toContain('👋🌍')
    })

    it('should handle large datasets', () => {
      const exporter = createDataExporter()
      const items = Array.from({ length: 1000 }, (_, i) => ({
        pk: `USER#${i}`,
        name: `User ${i}`,
      }))

      const result = exporter.export(items, { format: 'json' })
      expect(result.itemCount).toBe(1000)
    })
  })
})

describe('DataImporter', () => {
  describe('creation', () => {
    it('should create a data importer', () => {
      const importer = createDataImporter()
      expect(importer).toBeInstanceOf(DataImporter)
    })

    it('should create importer with custom options', () => {
      const importer = createDataImporter({
        batchSize: 25,
        validateItems: true,
      })
      expect(importer).toBeInstanceOf(DataImporter)
    })
  })

  describe('JSON import', () => {
    it('should parse JSON data', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: 'USER#1', name: 'John' },
        { pk: 'USER#2', name: 'Jane' },
      ])

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(items).toHaveLength(2)
      expect(items[0].name).toBe('John')
    })

    it('should handle nested JSON objects', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        {
          pk: 'USER#1',
          profile: { name: 'John', city: 'NYC' },
        },
      ])

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(items[0].profile.city).toBe('NYC')
    })

    it('should handle arrays in JSON', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: 'USER#1', tags: ['a', 'b', 'c'] },
      ])

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(items[0].tags).toEqual(['a', 'b', 'c'])
    })

    it('should handle empty JSON array', () => {
      const importer = createDataImporter()
      const data = '[]'

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(items).toHaveLength(0)
    })
  })

  describe('CSV import', () => {
    it('should parse CSV data', () => {
      const importer = createDataImporter()
      const data = 'pk,name\nUSER#1,John\nUSER#2,Jane'

      const items = importer.parse(data, { format: 'csv', tableName: 'Test' })
      expect(items).toHaveLength(2)
      expect(items[0].pk).toBe('USER#1')
      expect(items[0].name).toBe('John')
    })

    it('should handle quoted CSV fields', () => {
      const importer = createDataImporter()
      const data = 'pk,name\nUSER#1,"John, Jr."'

      const items = importer.parse(data, { format: 'csv', tableName: 'Test' })
      expect(items[0].name).toBe('John, Jr.')
    })

    it('should handle escaped quotes in CSV', () => {
      const importer = createDataImporter()
      const data = 'pk,quote\nUSER#1,"He said ""Hello"""'

      const items = importer.parse(data, { format: 'csv', tableName: 'Test' })
      expect(items[0].quote).toBe('He said "Hello"')
    })

    it('should handle empty CSV', () => {
      const importer = createDataImporter()
      const data = 'pk,name'

      const items = importer.parse(data, { format: 'csv', tableName: 'Test' })
      expect(items).toHaveLength(0)
    })

    it('should handle CSV with different delimiters', () => {
      const importer = createDataImporter()
      const data = 'pk;name\nUSER#1;John'

      const items = importer.parse(data, {
        format: 'csv',
        tableName: 'Test',
        delimiter: ';',
      })
      expect(items[0].pk).toBe('USER#1')
    })
  })

  describe('DynamoDB JSON import', () => {
    it('should parse DynamoDB JSON format', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: { S: 'USER#1' }, name: { S: 'John' }, age: { N: '30' } },
      ])

      const items = importer.parse(data, { format: 'dynamodb-json', tableName: 'Test' })
      expect(items[0].pk).toBe('USER#1')
      expect(items[0].name).toBe('John')
      expect(items[0].age).toBe(30)
    })

    it('should handle boolean types', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: { S: 'USER#1' }, active: { BOOL: true } },
      ])

      const items = importer.parse(data, { format: 'dynamodb-json', tableName: 'Test' })
      expect(items[0].active).toBe(true)
    })

    it('should handle list types', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: { S: 'USER#1' }, tags: { L: [{ S: 'a' }, { S: 'b' }] } },
      ])

      const items = importer.parse(data, { format: 'dynamodb-json', tableName: 'Test' })
      expect(items[0].tags).toEqual(['a', 'b'])
    })

    it('should handle map types', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: { S: 'USER#1' }, profile: { M: { name: { S: 'John' } } } },
      ])

      const items = importer.parse(data, { format: 'dynamodb-json', tableName: 'Test' })
      expect(items[0].profile.name).toBe('John')
    })

    it('should handle null types', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: { S: 'USER#1' }, nullField: { NULL: true } },
      ])

      const items = importer.parse(data, { format: 'dynamodb-json', tableName: 'Test' })
      expect(items[0].nullField).toBeNull()
    })
  })

  describe('batch write commands', () => {
    it('should create batch write commands', () => {
      const importer = createDataImporter()
      const items = [
        { pk: 'USER#1', name: 'John' },
        { pk: 'USER#2', name: 'Jane' },
      ]

      const commands = importer.createBatchWriteCommands(items, { format: 'json', tableName: 'Test' })
      expect(commands).toHaveLength(1)
      expect(commands[0].command).toBe('BatchWriteItem')
      expect(commands[0].input.RequestItems.Test).toHaveLength(2)
    })

    it('should split into multiple batches when exceeding 25 items', () => {
      const importer = createDataImporter()
      const items = Array.from({ length: 30 }, (_, i) => ({
        pk: `USER#${i}`,
        name: `User ${i}`,
      }))

      const commands = importer.createBatchWriteCommands(items, { format: 'json', tableName: 'Test' })
      expect(commands.length).toBeGreaterThan(1)
    })

    it('should handle custom batch size', () => {
      const importer = createDataImporter({ batchSize: 10 })
      const items = Array.from({ length: 25 }, (_, i) => ({
        pk: `USER#${i}`,
      }))

      const commands = importer.createBatchWriteCommands(items, { format: 'json', tableName: 'Test' })
      expect(commands.length).toBe(3) // 10 + 10 + 5
    })

    it('should handle empty items array', () => {
      const importer = createDataImporter()
      const items: any[] = []

      const commands = importer.createBatchWriteCommands(items, { format: 'json', tableName: 'Test' })
      expect(commands).toHaveLength(0)
    })
  })

  describe('validation', () => {
    it('should validate required primary key', () => {
      const importer = createDataImporter({ validateItems: true })
      const data = JSON.stringify([
        { name: 'John' }, // Missing pk
      ])

      expect(() => {
        importer.parse(data, { format: 'json', tableName: 'Test', primaryKey: 'pk' })
      }).toThrow()
    })

    it('should validate required sort key', () => {
      const importer = createDataImporter({ validateItems: true })
      const data = JSON.stringify([
        { pk: 'USER#1' }, // Missing sk
      ])

      expect(() => {
        importer.parse(data, {
          format: 'json',
          tableName: 'Test',
          primaryKey: 'pk',
          sortKey: 'sk',
        })
      }).toThrow()
    })

    it('should skip validation when disabled', () => {
      const importer = createDataImporter({ validateItems: false })
      const data = JSON.stringify([
        { name: 'John' }, // Missing pk
      ])

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(items).toHaveLength(1)
    })
  })

  describe('transformation', () => {
    it('should apply transform function', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: 'USER#1', name: 'john' },
      ])

      const items = importer.parse(data, {
        format: 'json',
        tableName: 'Test',
        transform: (item) => ({
          ...item,
          name: item.name.toUpperCase(),
        }),
      })
      expect(items[0].name).toBe('JOHN')
    })

    it('should filter items during transform', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: 'USER#1', active: true },
        { pk: 'USER#2', active: false },
      ])

      const items = importer.parse(data, {
        format: 'json',
        tableName: 'Test',
        filter: (item) => item.active === true,
      })
      expect(items).toHaveLength(1)
      expect(items[0].pk).toBe('USER#1')
    })
  })

  describe('edge cases', () => {
    it('should handle invalid JSON', () => {
      const importer = createDataImporter()
      const data = 'not valid json'

      expect(() => {
        importer.parse(data, { format: 'json', tableName: 'Test' })
      }).toThrow()
    })

    it('should handle special characters', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: 'USER#1', emoji: '👋🌍' },
      ])

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(items[0].emoji).toBe('👋🌍')
    })

    it('should handle very large items', () => {
      const importer = createDataImporter()
      const data = JSON.stringify([
        { pk: 'USER#1', data: 'x'.repeat(100000) },
      ])

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(items[0].data.length).toBe(100000)
    })

    it('should handle items with many attributes', () => {
      const importer = createDataImporter()
      const item: Record<string, string> = { pk: 'USER#1' }
      for (let i = 0; i < 100; i++) {
        item[`attr${i}`] = `value${i}`
      }
      const data = JSON.stringify([item])

      const items = importer.parse(data, { format: 'json', tableName: 'Test' })
      expect(Object.keys(items[0]).length).toBe(101)
    })
  })
})
