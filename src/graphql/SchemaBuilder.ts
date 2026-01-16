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
 * Relationship definition
 */
export interface RelationshipDefinition {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany'
  model: string
  foreignKey?: string
  /** For manyToMany - the join table */
  through?: string
}

/**
 * Auth directive configuration
 */
export interface AuthConfig {
  rules: Array<{
    allow: 'owner' | 'groups' | 'private' | 'public'
    groups?: string[]
    operations?: Array<'create' | 'read' | 'update' | 'delete'>
  }>
}

/**
 * Custom mutation definition
 */
export interface CustomMutationDef {
  args?: Record<string, { type: string, required?: boolean }>
  returnType?: string
}

/**
 * Nested property definition (recursive)
 */
export interface NestedPropertyDef {
  type: string
  required?: boolean
  properties?: Record<string, NestedPropertyDef>
}

/**
 * Model attribute definition
 */
export interface ModelAttribute {
  type: string
  required?: boolean
  description?: string
  /** For array types, the item type - can be string or object */
  items?: string | { type: string }
  /** For object types, nested properties */
  properties?: Record<string, NestedPropertyDef>
}

/**
 * Model definition for schema generation
 */
export interface ModelDefinition {
  name: string
  tableName: string
  primaryKey: string
  sortKey?: string
  attributes: Record<string, ModelAttribute>
  indexes?: Array<{
    name: string
    partitionKey: string
    sortKey?: string
  }>
  /** Relationship definitions */
  relationships?: Record<string, RelationshipDefinition>
  /** Auth directives */
  auth?: AuthConfig
  /** Custom mutations - false to disable, or object for custom mutations */
  mutations?: false | Record<string, CustomMutationDef>
}

/**
 * Naming convention options
 */
export interface NamingOptions {
  /** Naming convention for types */
  types?: 'PascalCase' | 'camelCase'
  /** Naming convention for fields */
  fields?: 'camelCase' | 'snake_case'
  /** Naming convention for queries */
  queries?: 'camelCase' | 'PascalCase'
  /** Prefix for query operations */
  queryPrefix?: string
  /** Prefix for mutation operations */
  mutationPrefix?: string
}

/**
 * Custom scalar definition
 */
export interface CustomScalar {
  name: string
  description?: string
  serialize?: string
  parseValue?: string
}

/**
 * Directive definition
 */
export interface DirectiveDefinition {
  name: string
  locations: string[]
  args?: Record<string, { type: string, required?: boolean }>
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
  /** Generate subscription types */
  generateSubscriptions?: boolean
  /** Use Relay-style connections */
  useConnections?: boolean
  /** Custom scalar mappings */
  scalarMappings?: Record<string, GraphQLScalarType>
  /** Naming conventions */
  naming?: NamingOptions
  /** Custom scalars - can be string names or full definitions */
  scalars?: (string | CustomScalar)[]
  /** Custom directives - can be string names or full definitions */
  directives?: (string | DirectiveDefinition)[]
}

/**
 * Resolver mapping type
 */
export interface ResolverMapping {
  type: string
  field: string
  dataSource: string
  requestMappingTemplate: string
  responseMappingTemplate: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * GraphQL schema builder
 */
export class GraphQLSchemaBuilder {
  private types: Map<string, GraphQLTypeDef> = new Map()
  private queries: Map<string, GraphQLQueryDef> = new Map()
  private mutations: Map<string, GraphQLMutationDef> = new Map()
  private customDirectives: DirectiveDefinition[] = []
  private models: ModelDefinition[] = []
  private options: Required<Omit<SchemaBuilderOptions, 'naming' | 'scalars' | 'directives'>> & Pick<SchemaBuilderOptions, 'naming' | 'scalars' | 'directives'>

  constructor(options?: SchemaBuilderOptions) {
    this.options = {
      generateInputTypes: true,
      generateConnections: true,
      generateFilters: true,
      generateSubscriptions: false,
      useConnections: false,
      scalarMappings: {},
      naming: options?.naming,
      scalars: options?.scalars,
      directives: options?.directives,
      ...options,
    }
  }

  /**
   * Add a model to the schema
   */
  addModel(model: ModelDefinition): this {
    // Store model for later use
    this.models.push(model)

    // Create main type
    const typeDef: GraphQLTypeDef = {
      name: model.name,
      fields: {},
    }

    for (const [fieldName, attr] of Object.entries(model.attributes)) {
      // Handle array types with items
      if (attr.items) {
        const itemType = typeof attr.items === 'string' ? attr.items : attr.items.type
        typeDef.fields[fieldName] = {
          type: this.mapType(itemType),
          list: true,
          required: attr.required,
          description: attr.description,
        }
      }
      // Handle nested object types with properties
      else if (attr.properties) {
        const nestedTypeName = `${model.name}${this.capitalize(fieldName)}`
        this.generateNestedType(nestedTypeName, attr.properties)
        typeDef.fields[fieldName] = {
          type: nestedTypeName,
          required: attr.required,
          description: attr.description,
        }
      }
      else {
        typeDef.fields[fieldName] = {
          type: this.mapType(attr.type),
          required: attr.required,
          description: attr.description,
        }
      }
    }

    // Add relationship fields
    if (model.relationships) {
      for (const [fieldName, rel] of Object.entries(model.relationships)) {
        typeDef.fields[fieldName] = {
          type: rel.model,
          list: rel.type === 'hasMany' || rel.type === 'manyToMany',
          required: false,
        }
      }
    }

    this.types.set(model.name, typeDef)

    // Generate queries
    this.generateQueries(model)

    // Generate mutations (unless disabled)
    if (model.mutations !== false) {
      this.generateMutations(model)
    }

    // Generate custom mutations
    if (model.mutations && typeof model.mutations === 'object') {
      this.generateCustomMutations(model)
    }

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
   * Generate nested type from properties
   */
  private generateNestedType(name: string, properties: Record<string, { type: string, required?: boolean }>): void {
    const fields: Record<string, GraphQLFieldDef> = {}
    for (const [propName, prop] of Object.entries(properties)) {
      fields[propName] = {
        type: this.mapType(prop.type),
        required: prop.required,
      }
    }
    this.types.set(name, { name, fields })
  }

  /**
   * Generate custom mutations from model definition
   */
  private generateCustomMutations(model: ModelDefinition): void {
    if (!model.mutations)
      return

    for (const [mutationName, mutationDef] of Object.entries(model.mutations)) {
      const args: Record<string, GraphQLFieldDef> = {}
      if (mutationDef.args) {
        for (const [argName, argDef] of Object.entries(mutationDef.args)) {
          args[argName] = {
            type: this.mapType(argDef.type),
            required: argDef.required,
          }
        }
      }

      this.mutations.set(mutationName, {
        name: mutationName,
        args,
        returnType: mutationDef.returnType || model.name,
      })
    }
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
    const _lowerName = name.charAt(0).toLowerCase() + name.slice(1)

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
      if (field.list)
        typeStr = `[${typeStr}]`
      if (field.required)
        typeStr = `${typeStr}!`

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
        if (def.list)
          typeStr = `[${typeStr}]`
        if (def.required)
          typeStr = `${typeStr}!`
        return `${name}: ${typeStr}`
      })
      .join(', ')

    let returnType = query.returnType
    if (query.list)
      returnType = `[${returnType}]`

    const desc = query.description ? `  # ${query.description}\n  ` : ''
    return `${desc}${query.name}(${args}): ${returnType}`
  }

  private buildMutation(mutation: GraphQLMutationDef): string {
    const args = Object.entries(mutation.args)
      .map(([name, def]) => {
        let typeStr = def.type
        if (def.list)
          typeStr = `[${typeStr}]`
        if (def.required)
          typeStr = `${typeStr}!`
        return `${name}: ${typeStr}`
      })
      .join(', ')

    const desc = mutation.description ? `  # ${mutation.description}\n  ` : ''
    return `${desc}${mutation.name}(${args}): ${mutation.returnType}`
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Add a custom directive
   * @param nameOrDirective - Either a directive name string or a full DirectiveDefinition
   * @param options - Optional directive options when nameOrDirective is a string
   */
  addDirective(nameOrDirective: string | DirectiveDefinition, options?: Partial<Omit<DirectiveDefinition, 'name'>>): this {
    if (typeof nameOrDirective === 'string') {
      this.customDirectives.push({
        name: nameOrDirective,
        locations: options?.locations || ['FIELD_DEFINITION'],
        args: options?.args,
      })
    }
    else {
      this.customDirectives.push(nameOrDirective)
    }
    return this
  }

  /**
   * Get resolver mappings for AppSync (structured by type)
   */
  getResolverMappings(): { Query?: Record<string, ResolverMapping>, Mutation?: Record<string, ResolverMapping> } {
    const result: { Query?: Record<string, ResolverMapping>, Mutation?: Record<string, ResolverMapping> } = {}

    // Generate resolver mappings for queries
    if (this.queries.size > 0) {
      result.Query = {}
      for (const query of this.queries.values()) {
        result.Query[query.name] = {
          type: 'Query',
          field: query.name,
          dataSource: 'DynamoDB',
          requestMappingTemplate: this.generateQueryRequestTemplate(query),
          responseMappingTemplate: '$util.toJson($ctx.result)',
        }
      }
    }

    // Generate resolver mappings for mutations
    if (this.mutations.size > 0) {
      result.Mutation = {}
      for (const mutation of this.mutations.values()) {
        result.Mutation[mutation.name] = {
          type: 'Mutation',
          field: mutation.name,
          dataSource: 'DynamoDB',
          requestMappingTemplate: this.generateMutationRequestTemplate(mutation),
          responseMappingTemplate: '$util.toJson($ctx.result)',
        }
      }
    }

    return result
  }

  /**
   * Get DynamoDB resolver templates for AppSync VTL
   */
  getDynamoDBResolverTemplates(): Record<string, { request: string, response: string }> {
    const templates: Record<string, { request: string, response: string }> = {}

    for (const model of this.models) {
      const name = model.name

      // GetItem template
      templates[`get${name}`] = {
        request: `{
  "version": "2018-05-29",
  "operation": "GetItem",
  "key": {
    "${model.primaryKey}": $util.dynamodb.toDynamoDBJson($ctx.args.${model.primaryKey})${model.sortKey ? `,\n    "${model.sortKey}": $util.dynamodb.toDynamoDBJson($ctx.args.${model.sortKey})` : ''}
  }
}`,
        response: '$util.toJson($ctx.result)',
      }

      // Query template
      templates[`list${name}s`] = {
        request: `{
  "version": "2018-05-29",
  "operation": "Scan",
  "limit": $util.defaultIfNull($ctx.args.limit, 20),
  "nextToken": $util.toJson($ctx.args.nextToken)
}`,
        response: '$util.toJson($ctx.result)',
      }

      // PutItem template
      templates[`create${name}`] = {
        request: `{
  "version": "2018-05-29",
  "operation": "PutItem",
  "key": {
    "${model.primaryKey}": $util.dynamodb.toDynamoDBJson($util.autoId())
  },
  "attributeValues": $util.dynamodb.toMapValuesJson($ctx.args.input)
}`,
        response: '$util.toJson($ctx.result)',
      }

      // UpdateItem template
      templates[`update${name}`] = {
        request: this.generateUpdateTemplate(model),
        response: '$util.toJson($ctx.result)',
      }

      // DeleteItem template
      templates[`delete${name}`] = {
        request: `{
  "version": "2018-05-29",
  "operation": "DeleteItem",
  "key": {
    "${model.primaryKey}": $util.dynamodb.toDynamoDBJson($ctx.args.${model.primaryKey})${model.sortKey ? `,\n    "${model.sortKey}": $util.dynamodb.toDynamoDBJson($ctx.args.${model.sortKey})` : ''}
  }
}`,
        response: '$util.toJson($ctx.result)',
      }
    }

    return templates
  }

  /**
   * Validate the schema
   */
  validate(): ValidationResult {
    const errors: string[] = []

    // Check for duplicate type names
    const typeNames = new Set<string>()
    for (const typeDef of this.types.values()) {
      if (typeNames.has(typeDef.name)) {
        errors.push(`Duplicate type name: ${typeDef.name}`)
      }
      typeNames.add(typeDef.name)
    }

    // Check for missing referenced types
    for (const typeDef of this.types.values()) {
      for (const [fieldName, field] of Object.entries(typeDef.fields)) {
        const fieldType = field.type.replace(/[[\]!]/g, '')
        if (!this.isScalarType(fieldType) && !typeNames.has(fieldType)) {
          errors.push(`Type "${typeDef.name}" field "${fieldName}" references unknown type: ${fieldType}`)
        }
      }
    }

    // Check for empty types
    for (const typeDef of this.types.values()) {
      if (Object.keys(typeDef.fields).length === 0) {
        errors.push(`Type "${typeDef.name}" has no fields`)
      }
    }

    // Check model relationships
    for (const model of this.models) {
      if (model.relationships) {
        for (const [relName, rel] of Object.entries(model.relationships)) {
          if (!this.models.some(m => m.name === rel.model)) {
            errors.push(`Model "${model.name}" relationship "${relName}" references unknown model: ${rel.model}`)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  private isScalarType(type: string): boolean {
    return ['String', 'Int', 'Float', 'Boolean', 'ID', 'AWSDateTime', 'AWSJSON'].includes(type)
  }

  private generateQueryRequestTemplate(_query: GraphQLQueryDef): string {
    return `{
  "version": "2018-05-29",
  "operation": "Query",
  "query": $util.toJson($ctx.args)
}`
  }

  private generateMutationRequestTemplate(_mutation: GraphQLMutationDef): string {
    return `{
  "version": "2018-05-29",
  "operation": "PutItem",
  "attributeValues": $util.dynamodb.toMapValuesJson($ctx.args.input)
}`
  }

  private generateUpdateTemplate(model: ModelDefinition): string {
    return `#set($input = $ctx.args.input)
#set($expressionNames = {})
#set($expressionValues = {})
#set($updateExpression = "SET ")
#set($first = true)

#foreach($entry in $input.entrySet())
  #if($entry.key != "${model.primaryKey}"${model.sortKey ? ` && $entry.key != "${model.sortKey}"` : ''})
    #if(!$first)
      #set($updateExpression = "$updateExpression, ")
    #end
    #set($expressionNames["#$entry.key"] = "$entry.key")
    #set($expressionValues[":$entry.key"] = $util.dynamodb.toDynamoDB($entry.value))
    #set($updateExpression = "$updateExpression#$entry.key = :$entry.key")
    #set($first = false)
  #end
#end

{
  "version": "2018-05-29",
  "operation": "UpdateItem",
  "key": {
    "${model.primaryKey}": $util.dynamodb.toDynamoDBJson($input.${model.primaryKey})${model.sortKey ? `,\n    "${model.sortKey}": $util.dynamodb.toDynamoDBJson($input.${model.sortKey})` : ''}
  },
  "update": {
    "expression": "$updateExpression",
    "expressionNames": $util.toJson($expressionNames),
    "expressionValues": $util.toJson($expressionValues)
  }
}`
  }
}

/**
 * Create a GraphQL schema builder
 */
export function createGraphQLSchemaBuilder(options?: SchemaBuilderOptions): GraphQLSchemaBuilder {
  return new GraphQLSchemaBuilder(options)
}
