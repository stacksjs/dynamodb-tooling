import type { ModelRegistry } from '../src/model-parser/types'
import { describe, expect, it } from 'bun:test'
import { defaultConfig } from '../src/config'
import {
  formatSchemaSummary,
  generateSchemaFromRegistry,
} from '../src/migrations/AutoSchemaGenerator'
import {
  createMigrationState,
  diffSchemas,
  formatDiffSummary,
} from '../src/migrations/SchemaDiffer'

// Use default config with test table name
const testConfig = { ...defaultConfig, defaultTableName: 'TestTable' }

// Test model registry
const testRegistry: ModelRegistry = {
  models: new Map([
    ['User', {
      name: 'User',
      entityType: 'USER',
      primaryKey: 'id',
      attributes: [
        { name: 'id', dynamoDbType: 'S', required: true, unique: true, fillable: false, nullable: false, hidden: false },
        { name: 'email', dynamoDbType: 'S', required: true, unique: true, fillable: true, nullable: false, hidden: false },
        { name: 'name', dynamoDbType: 'S', required: true, unique: false, fillable: true, nullable: false, hidden: false },
      ],
      relationships: [
        { type: 'hasMany', relatedModel: 'Post', foreignKey: 'userId', localKey: 'id', requiresGsi: true, gsiIndex: 2 },
      ],
      keyPatterns: { pk: 'USER#{id}', sk: 'USER#{id}' },
      accessPatterns: [],
      hasTimestamps: true,
      hasSoftDeletes: false,
      hasVersioning: false,
      hasUuid: true,
      hasTtl: false,
      traits: { useTimestamps: true, useSoftDeletes: false, useUuid: true, useTtl: false, useVersioning: false },
      original: { name: 'User', table: 'users', primaryKey: 'id', attributes: {}, traits: { useTimestamps: true, useSoftDeletes: false, useUuid: true, useTtl: false, useVersioning: false } },
    }],
    ['Post', {
      name: 'Post',
      entityType: 'POST',
      primaryKey: 'id',
      attributes: [
        { name: 'id', dynamoDbType: 'S', required: true, unique: true, fillable: false, nullable: false, hidden: false },
        { name: 'title', dynamoDbType: 'S', required: true, unique: false, fillable: true, nullable: false, hidden: false },
        { name: 'userId', dynamoDbType: 'S', required: true, unique: false, fillable: true, nullable: false, hidden: false },
      ],
      relationships: [
        { type: 'belongsTo', relatedModel: 'User', foreignKey: 'userId', localKey: 'id', requiresGsi: true, gsiIndex: 2 },
      ],
      keyPatterns: { pk: 'POST#{id}', sk: 'POST#{id}' },
      accessPatterns: [],
      hasTimestamps: true,
      hasSoftDeletes: false,
      hasVersioning: false,
      hasUuid: true,
      hasTtl: false,
      traits: { useTimestamps: true, useSoftDeletes: false, useUuid: true, useTtl: false, useVersioning: false },
      original: { name: 'Post', table: 'posts', primaryKey: 'id', attributes: {}, traits: { useTimestamps: true, useSoftDeletes: false, useUuid: true, useTtl: false, useVersioning: false } },
    }],
  ]),
  accessPatterns: [],
  gsiAssignments: new Map<string, number>(),
  warnings: [],
}

describe('Migration System', () => {
  describe('AutoSchemaGenerator', () => {
    it('should generate schema from registry', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)

      expect(schema).toBeDefined()
      expect(schema.createTableInput).toBeDefined()
      expect(schema.createTableInput.tableName).toBe('TestTable')
    })

    it('should include primary key definition', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)

      expect(schema.createTableInput.keySchema).toBeDefined()
      expect(schema.createTableInput.keySchema).toContainEqual({
        attributeName: 'pk',
        keyType: 'HASH',
      })
      expect(schema.createTableInput.keySchema).toContainEqual({
        attributeName: 'sk',
        keyType: 'RANGE',
      })
    })

    it('should include attribute definitions', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)

      expect(schema.createTableInput.attributeDefinitions).toBeDefined()

      const pkAttr = schema.createTableInput.attributeDefinitions.find(a => a.attributeName === 'pk')
      expect(pkAttr).toBeDefined()
      expect(pkAttr?.attributeType).toBe('S')
    })

    it('should set billing mode', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)

      expect(schema.createTableInput.billingMode).toBe('PAY_PER_REQUEST')
    })

    it('should format schema summary', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)
      const summary = formatSchemaSummary(schema)

      expect(summary).toContain('TestTable')
      expect(summary).toContain('pk')
      expect(summary).toContain('sk')
    })

    it('should track models in schema', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)

      // Schema is generated from models
      expect(schema.createTableInput).toBeDefined()
      expect(schema.createTableInput.tableName).toBe('TestTable')
    })

    it('should generate GSIs for relationships', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)

      // Should have at least one GSI for relationships
      expect(schema.createTableInput.globalSecondaryIndexes).toBeDefined()
    })
  })

  describe('SchemaDiffer', () => {
    it('should detect when there are no previous migrations', () => {
      const diff = diffSchemas(testRegistry, null, testConfig)

      expect(diff).toBeDefined()
      expect(diff.hasChanges).toBe(true)
    })

    it('should create migration state from schema', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)
      const state = createMigrationState(schema)

      expect(state).toBeDefined()
      expect(state.version).toBeDefined()
      expect(state.schemaHash).toBeDefined()
      expect(state.entityTypes).toContain('User')
      expect(state.entityTypes).toContain('Post')
    })

    it('should detect no changes when state matches', () => {
      const schema = generateSchemaFromRegistry(testRegistry, testConfig)
      const state = createMigrationState(schema)
      const diff = diffSchemas(testRegistry, state, testConfig)

      expect(diff.hasChanges).toBe(false)
    })

    it('should detect new entity types', () => {
      // Create initial state with only User
      const initialRegistry: ModelRegistry = {
        models: new Map([
          ['User', testRegistry.models.get('User')!],
        ]),
        accessPatterns: [],
        gsiAssignments: new Map<string, number>(),
        warnings: [],
      }

      const initialSchema = generateSchemaFromRegistry(initialRegistry, testConfig)
      const state = createMigrationState(initialSchema)

      // Now diff with both User and Post
      const diff = diffSchemas(testRegistry, state, testConfig)

      expect(diff.hasChanges).toBe(true)
    })

    it('should format diff summary', () => {
      const diff = diffSchemas(testRegistry, null, testConfig)
      const summary = formatDiffSummary(diff)

      expect(summary).toBeDefined()
      expect(summary.length).toBeGreaterThan(0)
    })

    it('should generate migration plan', () => {
      const diff = diffSchemas(testRegistry, null, testConfig)

      expect(diff.migrationPlan).toBeDefined()
      expect(diff.migrationPlan.length).toBeGreaterThan(0)
    })
  })
})
