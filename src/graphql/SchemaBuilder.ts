// ============================================================================
// GraphQL Schema Builder - Generate GraphQL Schema from DynamoDB Models
// ============================================================================

/**
 * GraphQL field type
 */
export type GraphQLScalarType = 'String' | 'Int' | 'Float' | 'Boolean' | 'ID' | 'AWSDateTime' | 'AWSJSON'

/**
 * GraphQL field definition
 */
export interface GraphQLFieldDef {
  type: GraphQLScalarType | string
  required?: boolean
  list?: boolean
  description?: string
}

/**
 * GraphQL type definition
 */
export interface GraphQLTypeDef {
  name: string
  description?: string
  fields: Record<string, GraphQLFieldDef>
}

/**
 * GraphQL query definition
 */
export interface GraphQLQueryDef {
  name: string
  description?: string
  args: Record<string, GraphQLFieldDef>
  returnType: string
  list?: boolean
}

/**
 * GraphQL mutation definition
 */
export interface GraphQLMutationDef {
  name: string
  description?: string
  args: Record<string, GraphQLFieldDef>
  returnType: string
}

/**
 * Model definition for schema generation
 */
export interface ModelDefinition {
  name: string
  tableName: string
  primaryKey: string
  sortKey?: string
  attributes: Record<string, {
    type: string
    required?: boolean
    description?: string
  }>
  indexes?: Array<{
    name: string
    partitionKey: string
    sortKey?: string
  }>
}

/**
 * Schema builder options
 */
export interface SchemaBuilderOptions {
  /** Generate input types */
  generateInputTypes?: boolean
  /** Generate connection types for pagination */
  generateConnections?: boolean
  /** Generate filter input types */
  generateFilters?: boolean
  /** Custom scalar mappings */
  scalarMappings?: Record<string, GraphQLScalarType>
}

/**
 * GraphQL schema builder
 */
export class GraphQLSchemaBuilder {
  private types: Map<string, GraphQLTypeDef> = new Map()
  private queries: Map<string, GraphQLQueryDef> = new Map()
  private mutations: Map<string, GraphQLMutationDef> = new Map()
  private options: Required<SchemaBuilderOptions>

  constructor(options?: SchemaBuilderOptions) {
    this.options = {
      generateInputTypes: true,
      generateConnections: true,
      generateFilters: true,
      scalarMappings: {},
      ...options,
    }
  }

  /**
   * Add a model to the schema
   */
  addModel(model: ModelDefinition): this {
    // Create main type
    const typeDef: GraphQLTypeDef = {
      name: model.name,
      fields: {},
    }

    for (const [fieldName, attr] of Object.entries(model.attributes)) {
      typeDef.fields[fieldName] = {
        type: this.mapType(attr.type),
        required: attr.required,
        description: attr.description,
      }
    }

    this.types.set(model.name, typeDef)

    // Generate queries
    this.generateQueries(model)

    // Generate mutations
    this.generateMutations(model)

    // Generate input types
    if (this.options.generateInputTypes) {
      this.generateInputTypes(model)
    }

    // Generate connection types
    if (this.options.generateConnections) {
      this.generateConnectionTypes(model)
    }

    // Generate filter types
    if (this.options.generateFilters) {
      this.generateFilterTypes(model)
    }

    return this
  }

  /**
   * Add custom type
   */
  addType(typeDef: GraphQLTypeDef): this {
    this.types.set(typeDef.name, typeDef)
    return this
  }

  /**
   * Add custom query
   */
  addQuery(queryDef: GraphQLQueryDef): this {
    this.queries.set(queryDef.name, queryDef)
    return this
  }

  /**
   * Add custom mutation
   */
  addMutation(mutationDef: GraphQLMutationDef): this {
    this.mutations.set(mutationDef.name, mutationDef)
    return this
  }

  /**
   * Build the GraphQL schema string
   */
  build(): string {
    const parts: string[] = []

    // Custom scalars
    parts.push('scalar AWSDateTime')
    parts.push('scalar AWSJSON')
    parts.push('')

    // Types
    for (const typeDef of this.types.values()) {
      parts.push(this.buildType(typeDef))
      parts.push('')
    }

    // Query type
    if (this.queries.size > 0) {
      parts.push('type Query {')
      for (const query of this.queries.values()) {
        parts.push(`  ${this.buildQuery(query)}`)
      }
      parts.push('}')
      parts.push('')
    }

    // Mutation type
    if (this.mutations.size > 0) {
      parts.push('type Mutation {')
      for (const mutation of this.mutations.values()) {
        parts.push(`  ${this.buildMutation(mutation)}`)
      }
      parts.push('}')
      parts.push('')
    }

    return parts.join('\n')
  }

  /**
   * Get all type definitions
   */
  getTypes(): GraphQLTypeDef[] {
    return Array.from(this.types.values())
  }

  /**
   * Get all queries
   */
  getQueries(): GraphQLQueryDef[] {
    return Array.from(this.queries.values())
  }

  /**
   * Get all mutations
   */
  getMutations(): GraphQLMutationDef[] {
    return Array.from(this.mutations.values())
  }

  private generateQueries(model: ModelDefinition): void {
    const name = model.name
    const lowerName = name.charAt(0).toLowerCase() + name.slice(1)

    // Get by ID
    this.queries.set(`get${name}`, {
      name: `get${name}`,
      description: `Get a ${name} by ID`,
      args: {
        [model.primaryKey]: { type: 'ID', required: true },
        ...(model.sortKey && { [model.sortKey]: { type: 'String', required: true } }),
      },
      returnType: name,
    })

    // List all
    this.queries.set(`list${name}s`, {
      name: `list${name}s`,
      description: `List all ${name}s`,
      args: {
        limit: { type: 'Int' },
        nextToken: { type: 'String' },
      },
      returnType: `${name}Connection`,
      list: false,
    })

    // Query by index (if indexes defined)
    if (model.indexes) {
      for (const index of model.indexes) {
        const queryName = `query${name}By${this.capitalize(index.name)}`
        this.queries.set(queryName, {
          name: queryName,
          description: `Query ${name}s by ${index.name}`,
          args: {
            [index.partitionKey]: { type: 'String', required: true },
            ...(index.sortKey && { [index.sortKey]: { type: 'String' } }),
            limit: { type: 'Int' },
            nextToken: { type: 'String' },
          },
          returnType: `${name}Connection`,
        })
      }
    }
  }

  private generateMutations(model: ModelDefinition): void {
    const name = model.name

    // Create
    this.mutations.set(`create${name}`, {
      name: `create${name}`,
      description: `Create a new ${name}`,
      args: {
        input: { type: `Create${name}Input`, required: true },
      },
      returnType: name,
    })

    // Update
    this.mutations.set(`update${name}`, {
      name: `update${name}`,
      description: `Update an existing ${name}`,
      args: {
        input: { type: `Update${name}Input`, required: true },
      },
      returnType: name,
    })

    // Delete
    this.mutations.set(`delete${name}`, {
      name: `delete${name}`,
      description: `Delete a ${name}`,
      args: {
        [model.primaryKey]: { type: 'ID', required: true },
        ...(model.sortKey && { [model.sortKey]: { type: 'String', required: true } }),
      },
      returnType: name,
    })
  }

  private generateInputTypes(model: ModelDefinition): void {
    const name = model.name

    // Create input
    const createFields: Record<string, GraphQLFieldDef> = {}
    for (const [fieldName, attr] of Object.entries(model.attributes)) {
      if (fieldName !== model.primaryKey) {
        createFields[fieldName] = {
          type: this.mapType(attr.type),
          required: attr.required,
        }
      }
    }

    this.types.set(`Create${name}Input`, {
      name: `Create${name}Input`,
      description: `Input for creating a ${name}`,
      fields: createFields,
    })

    // Update input (all fields optional except keys)
    const updateFields: Record<string, GraphQLFieldDef> = {
      [model.primaryKey]: { type: 'ID', required: true },
    }

    if (model.sortKey) {
      updateFields[model.sortKey] = { type: 'String', required: true }
    }

    for (const [fieldName, attr] of Object.entries(model.attributes)) {
      if (fieldName !== model.primaryKey && fieldName !== model.sortKey) {
        updateFields[fieldName] = {
          type: this.mapType(attr.type),
          required: false,
        }
      }
    }

    this.types.set(`Update${name}Input`, {
      name: `Update${name}Input`,
      description: `Input for updating a ${name}`,
      fields: updateFields,
    })
  }

  private generateConnectionTypes(model: ModelDefinition): void {
    const name = model.name

    // Connection type
    this.types.set(`${name}Connection`, {
      name: `${name}Connection`,
      description: `Paginated ${name} results`,
      fields: {
        items: { type: name, list: true, required: true },
        nextToken: { type: 'String' },
        totalCount: { type: 'Int' },
      },
    })
  }

  private generateFilterTypes(model: ModelDefinition): void {
    const name = model.name

    const filterFields: Record<string, GraphQLFieldDef> = {}

    for (const [fieldName, attr] of Object.entries(model.attributes)) {
      const type = this.mapType(attr.type)

      // Basic comparison operators
      filterFields[fieldName] = { type: `${type}Filter` }
    }

    // Logical operators
    filterFields.and = { type: `${name}Filter`, list: true }
    filterFields.or = { type: `${name}Filter`, list: true }
    filterFields.not = { type: `${name}Filter` }

    this.types.set(`${name}Filter`, {
      name: `${name}Filter`,
      description: `Filter conditions for ${name}`,
      fields: filterFields,
    })

    // Generate scalar filter types if not already defined
    this.ensureScalarFilterTypes()
  }

  private ensureScalarFilterTypes(): void {
    const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'ID']

    for (const scalar of scalarTypes) {
      const filterName = `${scalar}Filter`
      if (!this.types.has(filterName)) {
        this.types.set(filterName, {
          name: filterName,
          fields: {
            eq: { type: scalar },
            ne: { type: scalar },
            ...(scalar !== 'Boolean' && {
              lt: { type: scalar },
              le: { type: scalar },
              gt: { type: scalar },
              ge: { type: scalar },
              between: { type: scalar, list: true },
            }),
            ...(scalar === 'String' && {
              contains: { type: 'String' },
              notContains: { type: 'String' },
              beginsWith: { type: 'String' },
            }),
            in: { type: scalar, list: true },
            notIn: { type: scalar, list: true },
          },
        })
      }
    }
  }

  private mapType(type: string): GraphQLScalarType {
    // Check custom mappings first
    if (this.options.scalarMappings[type]) {
      return this.options.scalarMappings[type]
    }

    // Default mappings
    switch (type.toLowerCase()) {
      case 'string':
      case 'text':
      case 'email':
      case 'url':
        return 'String'
      case 'integer':
      case 'int':
        return 'Int'
      case 'number':
      case 'float':
      case 'decimal':
        return 'Float'
      case 'boolean':
      case 'bool':
        return 'Boolean'
      case 'id':
      case 'uuid':
        return 'ID'
      case 'date':
      case 'datetime':
      case 'timestamp':
        return 'AWSDateTime'
      case 'json':
      case 'object':
      case 'map':
        return 'AWSJSON'
      default:
        return 'String'
    }
  }

  private buildType(typeDef: GraphQLTypeDef): string {
    const lines: string[] = []

    if (typeDef.description) {
      lines.push(`"""${typeDef.description}"""`)
    }

    const isInput = typeDef.name.endsWith('Input') || typeDef.name.endsWith('Filter')
    lines.push(`${isInput ? 'input' : 'type'} ${typeDef.name} {`)

    for (const [fieldName, field] of Object.entries(typeDef.fields)) {
      let typeStr = field.type
      if (field.list) typeStr = `[${typeStr}]`
      if (field.required) typeStr = `${typeStr}!`

      const desc = field.description ? ` # ${field.description}` : ''
      lines.push(`  ${fieldName}: ${typeStr}${desc}`)
    }

    lines.push('}')
    return lines.join('\n')
  }

  private buildQuery(query: GraphQLQueryDef): string {
    const args = Object.entries(query.args)
      .map(([name, def]) => {
        let typeStr = def.type
        if (def.list) typeStr = `[${typeStr}]`
        if (def.required) typeStr = `${typeStr}!`
        return `${name}: ${typeStr}`
      })
      .join(', ')

    let returnType = query.returnType
    if (query.list) returnType = `[${returnType}]`

    const desc = query.description ? `  # ${query.description}\n  ` : ''
    return `${desc}${query.name}(${args}): ${returnType}`
  }

  private buildMutation(mutation: GraphQLMutationDef): string {
    const args = Object.entries(mutation.args)
      .map(([name, def]) => {
        let typeStr = def.type
        if (def.list) typeStr = `[${typeStr}]`
        if (def.required) typeStr = `${typeStr}!`
        return `${name}: ${typeStr}`
      })
      .join(', ')

    const desc = mutation.description ? `  # ${mutation.description}\n  ` : ''
    return `${desc}${mutation.name}(${args}): ${mutation.returnType}`
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

/**
 * Create a GraphQL schema builder
 */
export function createGraphQLSchemaBuilder(options?: SchemaBuilderOptions): GraphQLSchemaBuilder {
  return new GraphQLSchemaBuilder(options)
}
