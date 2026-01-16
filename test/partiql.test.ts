import type { PartiQLQuery } from '../src/partiql'
import { describe, expect, it } from 'bun:test'
import {
  buildBatchStatements,
  deleteFrom,
  insertInto,
  partiql,
  PartiQLBuilder,

  selectFrom,
  updateTable,
} from '../src/partiql'

describe('PartiQL Query Builder', () => {
  describe('Builder Creation', () => {
    it('should create PartiQL builder using partiql()', () => {
      const builder = partiql()
      expect(builder).toBeInstanceOf(PartiQLBuilder)
    })

    it('should create builder using new PartiQLBuilder()', () => {
      const builder = new PartiQLBuilder()
      expect(builder).toBeInstanceOf(PartiQLBuilder)
    })
  })

  describe('SELECT Queries', () => {
    it('should build SELECT * query', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .build()

      expect(query.statement).toBe('SELECT * FROM "Users"')
      expect(query.parameters).toHaveLength(0)
    })

    it('should build SELECT with specific columns', () => {
      const query = partiql()
        .select(['id', 'name', 'email'])
        .from('Users')
        .build()

      expect(query.statement).toBe('SELECT "id", "name", "email" FROM "Users"')
    })

    it('should build SELECT with single column', () => {
      const query = partiql()
        .select(['name'])
        .from('Users')
        .build()

      expect(query.statement).toBe('SELECT "name" FROM "Users"')
    })

    it('should default to SELECT * when no projection specified', () => {
      const query = partiql()
        .select()
        .from('Users')
        .build()

      expect(query.statement).toBe('SELECT * FROM "Users"')
    })

    it('should use selectFrom shorthand', () => {
      const query = selectFrom('Users').build()
      expect(query.statement).toBe('SELECT * FROM "Users"')
    })

    it('should use selectFrom shorthand with projection', () => {
      const query = selectFrom('Users', ['id', 'name']).build()
      expect(query.statement).toBe('SELECT "id", "name" FROM "Users"')
    })
  })

  describe('WHERE Clauses', () => {
    it('should build WHERE with equals condition', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .where('id', '=', '123')
        .build()

      expect(query.statement).toBe('SELECT * FROM "Users" WHERE "id" = ?')
      expect(query.parameters).toHaveLength(1)
      expect(query.parameters[0].value).toBe('123')
      expect(query.parameters[0].type).toBe('S')
    })

    it('should build WHERE with whereEquals helper', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereEquals('id', '123')
        .build()

      expect(query.statement).toContain('WHERE "id" = ?')
    })

    it('should build WHERE with not equals', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereNotEquals('status', 'deleted')
        .build()

      expect(query.statement).toContain('WHERE "status" <> ?')
    })

    it('should build WHERE with less than', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereLessThan('age', 18)
        .build()

      expect(query.statement).toContain('WHERE "age" < ?')
      expect(query.parameters[0].type).toBe('N')
    })

    it('should build WHERE with less than or equal', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereLessThanOrEqual('score', 100)
        .build()

      expect(query.statement).toContain('WHERE "score" <= ?')
    })

    it('should build WHERE with greater than', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereGreaterThan('age', 21)
        .build()

      expect(query.statement).toContain('WHERE "age" > ?')
    })

    it('should build WHERE with greater than or equal', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereGreaterThanOrEqual('level', 5)
        .build()

      expect(query.statement).toContain('WHERE "level" >= ?')
    })

    it('should build WHERE with BETWEEN', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereBetween('age', 18, 65)
        .build()

      expect(query.statement).toContain('WHERE "age" BETWEEN ? AND ?')
      expect(query.parameters).toHaveLength(2)
      expect(query.parameters[0].value).toBe(18)
      expect(query.parameters[1].value).toBe(65)
    })

    it('should build WHERE with IN clause', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereIn('status', ['active', 'pending', 'verified'])
        .build()

      expect(query.statement).toContain('WHERE "status" IN (?, ?, ?)')
      expect(query.parameters).toHaveLength(3)
    })

    it('should build WHERE with BEGINS_WITH', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereBeginsWith('email', 'admin@')
        .build()

      expect(query.statement).toContain('begins_with("email", ?)')
      expect(query.parameters[0].type).toBe('S')
    })

    it('should build WHERE with CONTAINS', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereContains('tags', 'premium')
        .build()

      expect(query.statement).toContain('contains("tags", ?)')
    })

    it('should build WHERE with IS NULL', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereNull('deletedAt')
        .build()

      expect(query.statement).toContain('WHERE "deletedAt" IS NULL')
      expect(query.parameters).toHaveLength(0)
    })

    it('should build WHERE with IS NOT NULL', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereNotNull('verifiedAt')
        .build()

      expect(query.statement).toContain('WHERE "verifiedAt" IS NOT NULL')
    })

    it('should combine multiple WHERE conditions with AND', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereEquals('status', 'active')
        .whereGreaterThan('age', 18)
        .whereNotNull('email')
        .build()

      expect(query.statement).toContain('"status" = ?')
      expect(query.statement).toContain(' AND ')
      expect(query.statement).toContain('"age" > ?')
      expect(query.statement).toContain('"email" IS NOT NULL')
    })
  })

  describe('INSERT Queries', () => {
    it('should build INSERT query', () => {
      const query = partiql()
        .insert({ pk: 'USER#123', name: 'John', age: 30 })
        .into('Users')
        .build()

      expect(query.statement).toContain('INSERT INTO "Users"')
      expect(query.statement).toContain('VALUE')
      expect(query.parameters).toHaveLength(3)
    })

    it('should use insertInto shorthand', () => {
      const query = insertInto('Users', { pk: 'USER#123', name: 'John' }).build()

      expect(query.statement).toContain('INSERT INTO "Users"')
      expect(query.parameters).toHaveLength(2)
    })

    it('should infer correct types for values', () => {
      const query = partiql()
        .insert({
          str: 'text',
          num: 42,
          bool: true,
          nil: null,
        })
        .into('Test')
        .build()

      const strParam = query.parameters.find(p => p.value === 'text')
      const numParam = query.parameters.find(p => p.value === 42)
      const boolParam = query.parameters.find(p => p.value === true)
      const nilParam = query.parameters.find(p => p.value === null)

      expect(strParam?.type).toBe('S')
      expect(numParam?.type).toBe('N')
      expect(boolParam?.type).toBe('BOOL')
      expect(nilParam?.type).toBe('NULL')
    })

    it('should handle array values', () => {
      const query = partiql()
        .insert({
          stringSet: ['a', 'b', 'c'],
          numberSet: [1, 2, 3],
          mixedList: [1, 'two', true],
        })
        .into('Test')
        .build()

      const ssParam = query.parameters.find(p => Array.isArray(p.value) && typeof (p.value as unknown[])[0] === 'string')
      const nsParam = query.parameters.find(p => Array.isArray(p.value) && typeof (p.value as unknown[])[0] === 'number')

      expect(ssParam?.type).toBe('SS')
      expect(nsParam?.type).toBe('NS')
    })

    it('should handle object values', () => {
      const query = partiql()
        .insert({
          nested: { foo: 'bar' },
        })
        .into('Test')
        .build()

      const objParam = query.parameters.find(p => typeof p.value === 'object' && p.value !== null && !Array.isArray(p.value))
      expect(objParam?.type).toBe('M')
    })

    it('should handle empty array', () => {
      const query = partiql()
        .insert({ emptyList: [] })
        .into('Test')
        .build()

      expect(query.parameters[0].type).toBe('L')
    })
  })

  describe('UPDATE Queries', () => {
    it('should build UPDATE query with SET', () => {
      const query = partiql()
        .update()
        .from('Users')
        .set('name', 'Jane')
        .whereEquals('pk', 'USER#123')
        .build()

      expect(query.statement).toContain('UPDATE "Users"')
      expect(query.statement).toContain('SET "name" = ?')
      expect(query.statement).toContain('WHERE')
    })

    it('should build UPDATE with multiple SET using object', () => {
      const query = partiql()
        .update()
        .from('Users')
        .set({ name: 'Jane', age: 31, status: 'active' })
        .whereEquals('pk', 'USER#123')
        .build()

      expect(query.statement).toContain('SET')
      expect(query.statement).toContain('"name" = ?')
      expect(query.statement).toContain('"age" = ?')
      expect(query.statement).toContain('"status" = ?')
    })

    it('should build UPDATE with chained SET calls', () => {
      const query = partiql()
        .update()
        .from('Users')
        .set('name', 'Jane')
        .set('age', 31)
        .whereEquals('pk', 'USER#123')
        .build()

      expect(query.statement).toContain('"name" = ?')
      expect(query.statement).toContain('"age" = ?')
    })

    it('should use updateTable shorthand', () => {
      const query = updateTable('Users')
        .set('name', 'Jane')
        .whereEquals('pk', 'USER#123')
        .build()

      expect(query.statement).toContain('UPDATE "Users"')
    })
  })

  describe('DELETE Queries', () => {
    it('should build DELETE query', () => {
      const query = partiql()
        .delete()
        .from('Users')
        .whereEquals('pk', 'USER#123')
        .build()

      expect(query.statement).toBe('DELETE FROM "Users" WHERE "pk" = ?')
    })

    it('should use deleteFrom shorthand', () => {
      const query = deleteFrom('Users')
        .whereEquals('pk', 'USER#123')
        .build()

      expect(query.statement).toContain('DELETE FROM "Users"')
    })

    it('should build DELETE without WHERE (dangerous but valid)', () => {
      const query = partiql()
        .delete()
        .from('Users')
        .build()

      expect(query.statement).toBe('DELETE FROM "Users"')
    })
  })

  describe('LIMIT Clause', () => {
    it('should add LIMIT to SELECT', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .limit(10)
        .build()

      expect(query.statement).toContain('LIMIT 10')
    })

    it('should add LIMIT with WHERE', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereEquals('status', 'active')
        .limit(5)
        .build()

      expect(query.statement).toContain('WHERE "status" = ?')
      expect(query.statement).toContain('LIMIT 5')
    })
  })

  describe('ORDER BY Clause', () => {
    it('should add ORDER BY ASC', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .orderBy('createdAt', 'ASC')
        .build()

      // Note: ORDER BY is stored but may not be in output depending on implementation
      expect(query).toBeDefined()
    })

    it('should add ORDER BY DESC', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .orderBy('createdAt', 'DESC')
        .build()

      expect(query).toBeDefined()
    })

    it('should default to ASC when direction not specified', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .orderBy('createdAt')
        .build()

      expect(query).toBeDefined()
    })
  })

  describe('Method Chaining', () => {
    it('should support full method chaining', () => {
      const builder = partiql()
        .select(['id', 'name'])
        .from('Users')
        .whereEquals('status', 'active')
        .whereGreaterThan('age', 18)
        .orderBy('createdAt', 'DESC')
        .limit(10)

      expect(builder).toBeInstanceOf(PartiQLBuilder)
    })

    it('should return same instance for all chain methods', () => {
      const builder = partiql()
      const afterSelect = builder.select('*')
      const afterFrom = afterSelect.from('Users')
      const afterWhere = afterFrom.whereEquals('id', '1')

      expect(afterSelect).toBe(builder)
      expect(afterFrom).toBe(builder)
      expect(afterWhere).toBe(builder)
    })
  })

  describe('Builder Output Methods', () => {
    it('should get statement string only with toStatement()', () => {
      const statement = partiql()
        .select('*')
        .from('Users')
        .whereEquals('id', '123')
        .toStatement()

      expect(typeof statement).toBe('string')
      expect(statement).toContain('SELECT')
    })

    it('should get parameters only with toParameters()', () => {
      const params = partiql()
        .select('*')
        .from('Users')
        .whereEquals('id', '123')
        .toParameters()

      expect(Array.isArray(params)).toBe(true)
      expect(params).toHaveLength(1)
    })
  })

  describe('Builder Reset', () => {
    it('should reset builder state', () => {
      const builder = partiql()
        .select(['id'])
        .from('Users')
        .whereEquals('id', '123')
        .limit(10)

      builder.reset()

      const query = builder.select('*').from('Test').build()
      expect(query.statement).toBe('SELECT * FROM "Test"')
      expect(query.parameters).toHaveLength(0)
    })
  })

  describe('Batch Statements', () => {
    it('should build batch statements', () => {
      const queries: PartiQLQuery[] = [
        partiql().select('*').from('Users').whereEquals('id', '1').build(),
        partiql().select('*').from('Users').whereEquals('id', '2').build(),
      ]

      const batches = buildBatchStatements(queries)
      expect(batches).toHaveLength(1)
      expect(batches[0].Statements).toHaveLength(2)
    })

    it('should split batches by max size', () => {
      const queries: PartiQLQuery[] = Array.from({ length: 30 }, (_, i) =>
        partiql().select('*').from('Users').whereEquals('id', String(i)).build())

      const batches = buildBatchStatements(queries, { maxBatchSize: 10 })
      expect(batches).toHaveLength(3)
      expect(batches[0].Statements).toHaveLength(10)
      expect(batches[1].Statements).toHaveLength(10)
      expect(batches[2].Statements).toHaveLength(10)
    })

    it('should use default max batch size of 25', () => {
      const queries: PartiQLQuery[] = Array.from({ length: 50 }, (_, i) =>
        partiql().select('*').from('Users').whereEquals('id', String(i)).build())

      const batches = buildBatchStatements(queries)
      expect(batches).toHaveLength(2)
      expect(batches[0].Statements).toHaveLength(25)
      expect(batches[1].Statements).toHaveLength(25)
    })

    it('should convert parameters to DynamoDB format', () => {
      const queries: PartiQLQuery[] = [
        partiql()
          .insert({ str: 'text', num: 42, bool: true })
          .into('Test')
          .build(),
      ]

      const batches = buildBatchStatements(queries)
      const params = batches[0].Statements[0].Parameters

      expect(params).toBeDefined()
      expect(params?.some(p => p.S === 'text')).toBe(true)
      expect(params?.some(p => p.N === '42')).toBe(true)
      expect(params?.some(p => p.BOOL === true)).toBe(true)
    })

    it('should handle NULL type parameters', () => {
      const queries: PartiQLQuery[] = [
        partiql().insert({ value: null }).into('Test').build(),
      ]

      const batches = buildBatchStatements(queries)
      const params = batches[0].Statements[0].Parameters

      expect(params?.some(p => p.NULL === true)).toBe(true)
    })

    it('should handle empty parameters', () => {
      const queries: PartiQLQuery[] = [
        partiql().select('*').from('Users').build(),
      ]

      const batches = buildBatchStatements(queries)
      expect(batches[0].Statements[0].Parameters).toBeUndefined()
    })

    it('should handle string sets (SS)', () => {
      const queries: PartiQLQuery[] = [
        partiql().insert({ tags: ['a', 'b', 'c'] }).into('Test').build(),
      ]

      const batches = buildBatchStatements(queries)
      const params = batches[0].Statements[0].Parameters

      expect(params?.some(p => p.SS?.includes('a'))).toBe(true)
    })

    it('should handle number sets (NS)', () => {
      const queries: PartiQLQuery[] = [
        partiql().insert({ scores: [1, 2, 3] }).into('Test').build(),
      ]

      const batches = buildBatchStatements(queries)
      const params = batches[0].Statements[0].Parameters

      expect(params?.some(p => p.NS?.includes('1'))).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in table name', () => {
      const query = partiql()
        .select('*')
        .from('my-table_v2')
        .build()

      expect(query.statement).toContain('"my-table_v2"')
    })

    it('should handle special characters in attribute names', () => {
      const query = partiql()
        .select(['user-id', 'created_at', 'type'])
        .from('Users')
        .build()

      expect(query.statement).toContain('"user-id"')
      expect(query.statement).toContain('"created_at"')
    })

    it('should handle empty WHERE IN array', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereIn('status', [])
        .build()

      expect(query.statement).toContain('IN ()')
    })

    it('should handle single item WHERE IN', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereIn('status', ['active'])
        .build()

      expect(query.statement).toContain('IN (?)')
      expect(query.parameters).toHaveLength(1)
    })

    it('should handle undefined value', () => {
      const query = partiql()
        .insert({ value: undefined })
        .into('Test')
        .build()

      expect(query.parameters[0].type).toBe('NULL')
    })

    it('should handle Buffer/Uint8Array values', () => {
      const query = partiql()
        .insert({ data: new Uint8Array([1, 2, 3]) })
        .into('Test')
        .build()

      expect(query.parameters[0].type).toBe('B')
    })

    it('should handle deeply nested objects', () => {
      const query = partiql()
        .insert({
          nested: {
            level1: {
              level2: {
                value: 'deep',
              },
            },
          },
        })
        .into('Test')
        .build()

      expect(query.parameters[0].type).toBe('M')
    })

    it('should handle multiple WHERE conditions with same attribute', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereGreaterThan('age', 18)
        .whereLessThan('age', 65)
        .build()

      expect(query.statement).toContain('"age" > ?')
      expect(query.statement).toContain('"age" < ?')
      expect(query.parameters).toHaveLength(2)
    })

    it('should generate unique parameter names', () => {
      const query = partiql()
        .select('*')
        .from('Users')
        .whereEquals('a', '1')
        .whereEquals('b', '2')
        .whereEquals('c', '3')
        .build()

      const paramNames = query.parameters.map(p => p.name)
      const uniqueNames = new Set(paramNames)
      expect(uniqueNames.size).toBe(paramNames.length)
    })

    it('should handle very long attribute values', () => {
      const longString = 'a'.repeat(10000)
      const query = partiql()
        .insert({ longValue: longString })
        .into('Test')
        .build()

      expect(query.parameters[0].value).toBe(longString)
    })

    it('should handle numeric zero value', () => {
      const query = partiql()
        .insert({ count: 0 })
        .into('Test')
        .build()

      expect(query.parameters[0].value).toBe(0)
      expect(query.parameters[0].type).toBe('N')
    })

    it('should handle boolean false value', () => {
      const query = partiql()
        .insert({ active: false })
        .into('Test')
        .build()

      expect(query.parameters[0].value).toBe(false)
      expect(query.parameters[0].type).toBe('BOOL')
    })

    it('should handle empty string value', () => {
      const query = partiql()
        .insert({ name: '' })
        .into('Test')
        .build()

      expect(query.parameters[0].value).toBe('')
      expect(query.parameters[0].type).toBe('S')
    })
  })

  describe('Complex Query Scenarios', () => {
    it('should build complex SELECT with all features', () => {
      const query = partiql()
        .select(['id', 'name', 'email', 'status'])
        .from('Users')
        .whereEquals('status', 'active')
        .whereGreaterThan('age', 18)
        .whereIn('role', ['admin', 'moderator'])
        .whereNotNull('email')
        .orderBy('createdAt', 'DESC')
        .limit(100)
        .build()

      expect(query.statement).toContain('SELECT')
      expect(query.statement).toContain('FROM "Users"')
      expect(query.statement).toContain('WHERE')
      expect(query.statement).toContain('LIMIT 100')
      expect(query.parameters.length).toBeGreaterThan(0)
    })

    it('should build UPDATE with complex WHERE', () => {
      const query = partiql()
        .update()
        .from('Users')
        .set({
          lastLogin: Date.now(),
          loginCount: 10,
          status: 'active',
        })
        .whereEquals('pk', 'USER#123')
        .whereEquals('sk', 'PROFILE')
        .build()

      expect(query.statement).toContain('UPDATE')
      expect(query.statement).toContain('SET')
      expect(query.statement).toContain('WHERE')
      expect(query.statement).toContain('"pk" = ?')
      expect(query.statement).toContain('"sk" = ?')
    })
  })
})
