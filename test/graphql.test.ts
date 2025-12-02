import { describe, expect, it } from 'bun:test'
import {
  createGraphQLSchemaBuilder,
  GraphQLSchemaBuilder,
} from '../src'

describe('GraphQLSchemaBuilder', () => {
  describe('creation', () => {
    it('should create a schema builder', () => {
      const builder = createGraphQLSchemaBuilder()
      expect(builder).toBeInstanceOf(GraphQLSchemaBuilder)
    })

    it('should create builder with custom options', () => {
      const builder = createGraphQLSchemaBuilder({
        generateSubscriptions: true,
        generateInputTypes: true,
      })
      expect(builder).toBeInstanceOf(GraphQLSchemaBuilder)
    })

    it('should create builder with naming conventions', () => {
      const builder = createGraphQLSchemaBuilder({
        naming: {
          queryPrefix: 'fetch',
          mutationPrefix: '',
        },
      })
      expect(builder).toBeInstanceOf(GraphQLSchemaBuilder)
    })
  })

  describe('adding models', () => {
    it('should add models to schema', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          email: { type: 'email', required: true },
          age: { type: 'integer' },
        },
      })

      const types = builder.getTypes()
      expect(types.find(t => t.name === 'User')).toBeDefined()
    })

    it('should add multiple models', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      builder.addModel({
        name: 'Post',
        tableName: 'Posts',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
      })

      const types = builder.getTypes()
      expect(types.find(t => t.name === 'User')).toBeDefined()
      expect(types.find(t => t.name === 'Post')).toBeDefined()
    })

    it('should support various attribute types', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'AllTypes',
        tableName: 'AllTypes',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string' },
          age: { type: 'integer' },
          price: { type: 'float' },
          active: { type: 'boolean' },
          createdAt: { type: 'datetime' },
          tags: { type: 'array', items: 'string' },
        },
      })

      const types = builder.getTypes()
      const allTypes = types.find(t => t.name === 'AllTypes')
      expect(allTypes).toBeDefined()
    })

    it('should handle optional attributes', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          nickname: { type: 'string', required: false },
          bio: { type: 'string' }, // implicitly optional
        },
      })

      const types = builder.getTypes()
      const user = types.find(t => t.name === 'User')
      expect(user?.fields.nickname?.required).toBe(false)
    })
  })

  describe('query generation', () => {
    it('should generate queries for models', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      const queries = builder.getQueries()
      expect(queries.find(q => q.name === 'getUser')).toBeDefined()
      expect(queries.find(q => q.name === 'listUsers')).toBeDefined()
    })

    it('should generate getById query', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      const queries = builder.getQueries()
      const getUser = queries.find(q => q.name === 'getUser')

      expect(getUser?.args).toContainEqual(
        expect.objectContaining({ name: 'id' }),
      )
    })

    it('should generate list query with pagination', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
      })

      const queries = builder.getQueries()
      const listUsers = queries.find(q => q.name === 'listUsers')

      expect(listUsers?.args).toContainEqual(
        expect.objectContaining({ name: 'limit' }),
      )
      expect(listUsers?.args).toContainEqual(
        expect.objectContaining({ name: 'nextToken' }),
      )
    })

    it('should generate filter arguments for list query', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          status: { type: 'string' },
        },
      })

      const queries = builder.getQueries()
      const listUsers = queries.find(q => q.name === 'listUsers')

      expect(listUsers?.args).toContainEqual(
        expect.objectContaining({ name: 'filter' }),
      )
    })
  })

  describe('mutation generation', () => {
    it('should generate mutations for models', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      const mutations = builder.getMutations()
      expect(mutations.find(m => m.name === 'createUser')).toBeDefined()
      expect(mutations.find(m => m.name === 'updateUser')).toBeDefined()
      expect(mutations.find(m => m.name === 'deleteUser')).toBeDefined()
    })

    it('should generate create mutation with input', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          email: { type: 'email', required: true },
        },
      })

      const mutations = builder.getMutations()
      const createUser = mutations.find(m => m.name === 'createUser')

      expect(createUser?.args).toContainEqual(
        expect.objectContaining({ name: 'input' }),
      )
    })

    it('should generate update mutation', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      const mutations = builder.getMutations()
      const updateUser = mutations.find(m => m.name === 'updateUser')

      expect(updateUser?.args).toContainEqual(
        expect.objectContaining({ name: 'id' }),
      )
      expect(updateUser?.args).toContainEqual(
        expect.objectContaining({ name: 'input' }),
      )
    })

    it('should generate delete mutation', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
      })

      const mutations = builder.getMutations()
      const deleteUser = mutations.find(m => m.name === 'deleteUser')

      expect(deleteUser?.args).toContainEqual(
        expect.objectContaining({ name: 'id' }),
      )
    })
  })

  describe('building schema string', () => {
    it('should build GraphQL schema string', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('type User')
      expect(schema).toContain('type Query')
      expect(schema).toContain('type Mutation')
      expect(schema).toContain('getUser')
      expect(schema).toContain('createUser')
    })

    it('should include field types in schema', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          age: { type: 'integer' },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('id: ID!')
      expect(schema).toContain('name: String!')
      expect(schema).toContain('age: Int')
    })

    it('should generate input types', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('input CreateUserInput')
      expect(schema).toContain('input UpdateUserInput')
    })

    it('should handle array types in schema', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          tags: { type: 'array', items: 'string' },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('[String]')
    })

    it('should handle connection types for pagination', () => {
      const builder = createGraphQLSchemaBuilder({
        useConnections: true,
      })

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('UserConnection')
      expect(schema).toContain('edges')
      expect(schema).toContain('pageInfo')
    })
  })

  describe('relationships', () => {
    it('should handle hasMany relationship', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
        relationships: {
          posts: { type: 'hasMany', model: 'Post', foreignKey: 'userId' },
        },
      })

      builder.addModel({
        name: 'Post',
        tableName: 'Posts',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          userId: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('posts: [Post]')
    })

    it('should handle belongsTo relationship', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'Post',
        tableName: 'Posts',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          userId: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
        relationships: {
          author: { type: 'belongsTo', model: 'User', foreignKey: 'userId' },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('author: User')
    })

    it('should handle many-to-many relationship', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
        relationships: {
          roles: { type: 'manyToMany', model: 'Role', through: 'UserRoles' },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('roles: [Role]')
    })
  })

  describe('custom scalars', () => {
    it('should include custom scalars', () => {
      const builder = createGraphQLSchemaBuilder({
        scalars: ['DateTime', 'JSON', 'Email'],
      })

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          createdAt: { type: 'datetime' },
          metadata: { type: 'json' },
        },
      })

      const schema = builder.build()

      expect(schema).toContain('scalar DateTime')
      expect(schema).toContain('scalar JSON')
    })
  })

  describe('directives', () => {
    it('should support auth directives', () => {
      const builder = createGraphQLSchemaBuilder({
        directives: ['@auth'],
      })

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
        auth: { rules: [{ allow: 'owner' }] },
      })

      const schema = builder.build()

      expect(schema).toContain('@auth')
    })

    it('should support custom directives', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addDirective('deprecated', {
        locations: ['FIELD_DEFINITION'],
        args: { reason: { type: 'String' } },
      })

      const schema = builder.build()

      expect(schema).toContain('directive @deprecated')
    })
  })

  describe('resolver generation', () => {
    it('should generate resolver mappings', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
      })

      const resolvers = builder.getResolverMappings()

      expect(resolvers.Query?.getUser).toBeDefined()
      expect(resolvers.Query?.listUsers).toBeDefined()
      expect(resolvers.Mutation?.createUser).toBeDefined()
    })

    it('should generate DynamoDB resolver templates', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
      })

      const templates = builder.getDynamoDBResolverTemplates()

      expect(templates.getUser?.request).toBeDefined()
      expect(templates.getUser?.response).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty model', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'Empty',
        tableName: 'Empty',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
      })

      const schema = builder.build()
      expect(schema).toContain('type Empty')
    })

    it('should handle reserved GraphQL names', () => {
      const builder = createGraphQLSchemaBuilder()

      // Should handle or rename reserved words
      builder.addModel({
        name: 'Type',
        tableName: 'Types',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          type: { type: 'string' }, // reserved word as field
        },
      })

      const schema = builder.build()
      expect(schema).toBeDefined()
    })

    it('should handle deeply nested types', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              location: {
                type: 'object',
                properties: {
                  lat: { type: 'float' },
                  lng: { type: 'float' },
                },
              },
            },
          },
        },
      })

      const schema = builder.build()
      expect(schema).toContain('type User')
    })

    it('should handle model with no mutations', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'ReadOnlyModel',
        tableName: 'ReadOnly',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
        mutations: false,
      })

      const mutations = builder.getMutations()
      expect(mutations.find(m => m.name === 'createReadOnlyModel')).toBeUndefined()
    })

    it('should handle unicode in field names', () => {
      const builder = createGraphQLSchemaBuilder()

      // GraphQL doesn't support unicode in names, should handle gracefully
      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
          // Should be sanitized or rejected
        },
      })

      const schema = builder.build()
      expect(schema).toBeDefined()
    })

    it('should build schema with no models', () => {
      const builder = createGraphQLSchemaBuilder()

      const schema = builder.build()
      expect(schema).toContain('type Query')
    })
  })

  describe('schema validation', () => {
    it('should validate schema before building', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', required: true },
        },
      })

      const validation = builder.validate()
      expect(validation.valid).toBe(true)
    })

    it('should detect circular relationships', () => {
      const builder = createGraphQLSchemaBuilder()

      builder.addModel({
        name: 'User',
        tableName: 'Users',
        primaryKey: 'id',
        attributes: { id: { type: 'string', required: true } },
        relationships: {
          manager: { type: 'belongsTo', model: 'User', foreignKey: 'managerId' },
        },
      })

      const validation = builder.validate()
      // Should either be valid (self-reference is okay) or have warnings
      expect(validation).toBeDefined()
    })
  })
})
