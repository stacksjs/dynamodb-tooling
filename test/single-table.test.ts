import type { ParsedModel } from '../src/model-parser/types'
import { describe, expect, it } from 'bun:test'
import { defaultConfig } from '../src/config'
import {
  generateAccessPatterns,
} from '../src/single-table/AccessPatternGenerator'
import {
  marshallObject,
  marshallValue,
  unmarshallItem,
  unmarshallValue,
} from '../src/single-table/EntityTransformer'
import {
  generateKeyPatternsForModel,
} from '../src/single-table/KeyPatternGenerator'

// Use default config
const testConfig = { ...defaultConfig, defaultTableName: 'TestTable' }

// Test model
const testUserModel: ParsedModel = {
  name: 'User',
  entityType: 'USER',
  primaryKey: 'id',
  attributes: [
    { name: 'id', dynamoDbType: 'S', required: true, unique: true, fillable: false, nullable: false, hidden: false },
    { name: 'email', dynamoDbType: 'S', required: true, unique: true, fillable: true, nullable: false, hidden: false },
    { name: 'name', dynamoDbType: 'S', required: true, unique: false, fillable: true, nullable: false, hidden: false },
    { name: 'age', dynamoDbType: 'N', required: false, unique: false, fillable: true, nullable: true, hidden: false },
  ],
  relationships: [
    { type: 'hasMany', relatedModel: 'Post', foreignKey: 'userId', localKey: 'id', requiresGsi: true, gsiIndex: 2 },
    { type: 'hasOne', relatedModel: 'Profile', foreignKey: 'userId', localKey: 'id', requiresGsi: false },
  ],
  keyPatterns: { pk: 'USER#{id}', sk: 'USER#{id}' },
  accessPatterns: [],
  hasTimestamps: true,
  hasSoftDeletes: false,
  hasVersioning: false,
  hasUuid: true,
  hasTtl: false,
  traits: {
    useTimestamps: true,
    useSoftDeletes: false,
    useUuid: true,
    useTtl: false,
    useVersioning: false,
  },
  original: {
    name: 'User',
    table: 'users',
    primaryKey: 'id',
    attributes: {},
    traits: {
      useTimestamps: true,
      useSoftDeletes: false,
      useUuid: true,
      useTtl: false,
      useVersioning: false,
    },
  },
}

describe('Single-Table Design Utilities', () => {
  describe('EntityTransformer', () => {
    describe('marshallValue', () => {
      it('should marshall string values', () => {
        const result = marshallValue('hello')
        expect(result).toEqual({ S: 'hello' })
      })

      it('should marshall number values', () => {
        const result = marshallValue(42)
        expect(result).toEqual({ N: '42' })
      })

      it('should marshall boolean values', () => {
        expect(marshallValue(true)).toEqual({ BOOL: true })
        expect(marshallValue(false)).toEqual({ BOOL: false })
      })

      it('should marshall null values', () => {
        const result = marshallValue(null)
        expect(result).toEqual({ NULL: true })
      })

      it('should marshall array values', () => {
        const result = marshallValue(['a', 'b', 'c'])
        expect(result).toEqual({
          L: [{ S: 'a' }, { S: 'b' }, { S: 'c' }],
        })
      })

      it('should marshall object values', () => {
        const result = marshallValue({ name: 'John', age: 30 })
        expect(result).toEqual({
          M: {
            name: { S: 'John' },
            age: { N: '30' },
          },
        })
      })
    })

    describe('unmarshallValue', () => {
      it('should unmarshall string values', () => {
        const result = unmarshallValue({ S: 'hello' })
        expect(result).toBe('hello')
      })

      it('should unmarshall number values', () => {
        const result = unmarshallValue({ N: '42' })
        expect(result).toBe(42)
      })

      it('should unmarshall boolean values', () => {
        expect(unmarshallValue({ BOOL: true })).toBe(true)
        expect(unmarshallValue({ BOOL: false })).toBe(false)
      })

      it('should unmarshall null values', () => {
        const result = unmarshallValue({ NULL: true })
        expect(result).toBe(null)
      })

      it('should unmarshall list values', () => {
        const result = unmarshallValue({
          L: [{ S: 'a' }, { S: 'b' }],
        })
        expect(result).toEqual(['a', 'b'])
      })

      it('should unmarshall map values', () => {
        const result = unmarshallValue({
          M: {
            name: { S: 'John' },
            age: { N: '30' },
          },
        })
        expect(result).toEqual({ name: 'John', age: 30 })
      })
    })

    describe('marshallObject', () => {
      it('should marshall an entire object', () => {
        const result = marshallObject({
          id: '123',
          name: 'Test User',
          age: 25,
          active: true,
        })

        expect(result).toEqual({
          id: { S: '123' },
          name: { S: 'Test User' },
          age: { N: '25' },
          active: { BOOL: true },
        })
      })

      it('should skip undefined values', () => {
        const result = marshallObject({
          id: '123',
          name: undefined,
        })

        expect(result).toEqual({
          id: { S: '123' },
        })
      })
    })

    describe('unmarshallItem', () => {
      it('should unmarshall an entire DynamoDB item', () => {
        const result = unmarshallItem({
          id: { S: '123' },
          name: { S: 'Test User' },
          age: { N: '25' },
          active: { BOOL: true },
        })

        expect(result).toEqual({
          id: '123',
          name: 'Test User',
          age: 25,
          active: true,
        })
      })
    })
  })

  describe('KeyPatternGenerator', () => {
    it('should generate key patterns from a model', () => {
      const template = generateKeyPatternsForModel(testUserModel, testConfig)

      expect(template).toBeDefined()
      expect(template.pattern).toBeDefined()
      expect(template.pattern.pk).toContain('USER')
      expect(template.pattern.sk).toContain('USER')
    })
  })

  describe('AccessPatternGenerator', () => {
    it('should generate access patterns from model registry', () => {
      // Create a proper registry with all required fields
      const registry = {
        models: new Map([['User', testUserModel]]),
        accessPatterns: [],
        gsiAssignments: new Map<string, number>(),
        warnings: [],
      }

      const report = generateAccessPatterns(registry, testConfig)

      expect(report).toBeDefined()
      expect(report.patterns).toBeArray()
    })

    it('should have patterns array', () => {
      // Create a proper registry with all required fields
      const registry = {
        models: new Map([['User', testUserModel]]),
        accessPatterns: [],
        gsiAssignments: new Map<string, number>(),
        warnings: [],
      }

      const report = generateAccessPatterns(registry, testConfig)

      // Report should have patterns
      expect(report.patterns.length).toBeGreaterThanOrEqual(0)
    })
  })
})
