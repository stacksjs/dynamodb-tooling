// ============================================================================
// PartiQL Builder - SQL-like Queries for DynamoDB
// ============================================================================

/**
 * PartiQL statement types
 */
export type PartiQLStatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * PartiQL parameter
 */
export interface PartiQLParameter {
  name: string
  value: unknown
  type?: 'S' | 'N' | 'B' | 'BOOL' | 'NULL' | 'L' | 'M' | 'SS' | 'NS' | 'BS'
}

/**
 * PartiQL query result
 */
export interface PartiQLQuery {
  statement: string
  parameters: PartiQLParameter[]
}

/**
 * WHERE clause condition
 */
export interface WhereCondition {
  attribute: string
  operator: '=' | '<>' | '<' | '<=' | '>' | '>=' | 'BETWEEN' | 'IN' | 'BEGINS_WITH' | 'CONTAINS' | 'IS_NULL' | 'IS_NOT_NULL'
  value?: unknown
  value2?: unknown // For BETWEEN
}

/**
 * SELECT projection
 */
export type SelectProjection = '*' | string[]

/**
 * ORDER BY direction
 */
export type OrderDirection = 'ASC' | 'DESC'

/**
 * PartiQL builder for constructing SQL-like queries
 */
export class PartiQLBuilder {
  private statementType: PartiQLStatementType = 'SELECT'
  private tableName: string = ''
  private projection: SelectProjection = '*'
  private whereConditions: WhereCondition[] = []
  private setValues: Record<string, unknown> = {}
  private insertValues: Record<string, unknown> = {}
  private orderByAttribute?: string
  private orderDirection: OrderDirection = 'ASC'
  private limitValue?: number
  private parameterCounter = 0

  /**
   * Start a SELECT statement
   */
  select(projection: SelectProjection = '*'): this {
    this.statementType = 'SELECT'
    this.projection = projection
    return this
  }

  /**
   * Start an INSERT statement
   */
  insert(values: Record<string, unknown>): this {
    this.statementType = 'INSERT'
    this.insertValues = values
    return this
  }

  /**
   * Start an UPDATE statement
   */
  update(): this {
    this.statementType = 'UPDATE'
    return this
  }

  /**
   * Start a DELETE statement
   */
  delete(): this {
    this.statementType = 'DELETE'
    return this
  }

  /**
   * Specify the table
   */
  from(tableName: string): this {
    this.tableName = tableName
    return this
  }

  /**
   * Alias for from() - used with INSERT
   */
  into(tableName: string): this {
    return this.from(tableName)
  }

  /**
   * Add SET clause for UPDATE
   */
  set(attribute: string, value: unknown): this
  set(values: Record<string, unknown>): this
  set(attributeOrValues: string | Record<string, unknown>, value?: unknown): this {
    if (typeof attributeOrValues === 'string') {
      this.setValues[attributeOrValues] = value
    }
    else {
      Object.assign(this.setValues, attributeOrValues)
    }
    return this
  }

  /**
   * Add WHERE condition
   */
  where(attribute: string, operator: WhereCondition['operator'], value?: unknown, value2?: unknown): this {
    this.whereConditions.push({ attribute, operator, value, value2 })
    return this
  }

  /**
   * Add WHERE equals condition
   */
  whereEquals(attribute: string, value: unknown): this {
    return this.where(attribute, '=', value)
  }

  /**
   * Add WHERE not equals condition
   */
  whereNotEquals(attribute: string, value: unknown): this {
    return this.where(attribute, '<>', value)
  }

  /**
   * Add WHERE less than condition
   */
  whereLessThan(attribute: string, value: unknown): this {
    return this.where(attribute, '<', value)
  }

  /**
   * Add WHERE less than or equal condition
   */
  whereLessThanOrEqual(attribute: string, value: unknown): this {
    return this.where(attribute, '<=', value)
  }

  /**
   * Add WHERE greater than condition
   */
  whereGreaterThan(attribute: string, value: unknown): this {
    return this.where(attribute, '>', value)
  }

  /**
   * Add WHERE greater than or equal condition
   */
  whereGreaterThanOrEqual(attribute: string, value: unknown): this {
    return this.where(attribute, '>=', value)
  }

  /**
   * Add WHERE BETWEEN condition
   */
  whereBetween(attribute: string, low: unknown, high: unknown): this {
    return this.where(attribute, 'BETWEEN', low, high)
  }

  /**
   * Add WHERE IN condition
   */
  whereIn(attribute: string, values: unknown[]): this {
    return this.where(attribute, 'IN', values)
  }

  /**
   * Add WHERE BEGINS_WITH condition
   */
  whereBeginsWith(attribute: string, prefix: string): this {
    return this.where(attribute, 'BEGINS_WITH', prefix)
  }

  /**
   * Add WHERE CONTAINS condition
   */
  whereContains(attribute: string, value: unknown): this {
    return this.where(attribute, 'CONTAINS', value)
  }

  /**
   * Add WHERE IS NULL condition
   */
  whereNull(attribute: string): this {
    return this.where(attribute, 'IS_NULL')
  }

  /**
   * Add WHERE IS NOT NULL condition
   */
  whereNotNull(attribute: string): this {
    return this.where(attribute, 'IS_NOT_NULL')
  }

  /**
   * Add ORDER BY clause (only works with certain queries)
   */
  orderBy(attribute: string, direction: OrderDirection = 'ASC'): this {
    this.orderByAttribute = attribute
    this.orderDirection = direction
    return this
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): this {
    this.limitValue = count
    return this
  }

  /**
   * Build the PartiQL query
   */
  build(): PartiQLQuery {
    switch (this.statementType) {
      case 'SELECT':
        return this.buildSelect()
      case 'INSERT':
        return this.buildInsert()
      case 'UPDATE':
        return this.buildUpdate()
      case 'DELETE':
        return this.buildDelete()
      default:
        throw new Error(`Unknown statement type: ${this.statementType}`)
    }
  }

  /**
   * Get the statement string only
   */
  toStatement(): string {
    return this.build().statement
  }

  /**
   * Get parameters only
   */
  toParameters(): PartiQLParameter[] {
    return this.build().parameters
  }

  private buildSelect(): PartiQLQuery {
    const parameters: PartiQLParameter[] = []

    // Build projection
    let projectionStr: string
    if (this.projection === '*') {
      projectionStr = '*'
    }
    else {
      projectionStr = this.projection.map(attr => `"${attr}"`).join(', ')
    }

    // Build statement
    let statement = `SELECT ${projectionStr} FROM "${this.tableName}"`

    // Add WHERE clause
    const whereClause = this.buildWhereClause(parameters)
    if (whereClause) {
      statement += ` WHERE ${whereClause}`
    }

    // Note: ORDER BY is not natively supported in PartiQL for DynamoDB
    // but we include it for compatibility with other PartiQL implementations

    // Add LIMIT
    if (this.limitValue !== undefined) {
      statement += ` LIMIT ${this.limitValue}`
    }

    return { statement, parameters }
  }

  private buildInsert(): PartiQLQuery {
    const parameters: PartiQLParameter[] = []
    const attributes = Object.keys(this.insertValues)
    const valuePlaceholders: string[] = []

    for (const attr of attributes) {
      const paramName = this.nextParamName()
      valuePlaceholders.push(`?`)
      parameters.push({
        name: paramName,
        value: this.insertValues[attr],
        type: this.inferType(this.insertValues[attr]),
      })
    }

    const statement = `INSERT INTO "${this.tableName}" VALUE {${attributes.map((attr, i) => `'${attr}': ${valuePlaceholders[i]}`).join(', ')}}`

    return { statement, parameters }
  }

  private buildUpdate(): PartiQLQuery {
    const parameters: PartiQLParameter[] = []

    // Build SET clause
    const setClauses: string[] = []
    for (const [attr, value] of Object.entries(this.setValues)) {
      const paramName = this.nextParamName()
      setClauses.push(`"${attr}" = ?`)
      parameters.push({
        name: paramName,
        value,
        type: this.inferType(value),
      })
    }

    let statement = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')}`

    // Add WHERE clause
    const whereClause = this.buildWhereClause(parameters)
    if (whereClause) {
      statement += ` WHERE ${whereClause}`
    }

    return { statement, parameters }
  }

  private buildDelete(): PartiQLQuery {
    const parameters: PartiQLParameter[] = []

    let statement = `DELETE FROM "${this.tableName}"`

    // Add WHERE clause
    const whereClause = this.buildWhereClause(parameters)
    if (whereClause) {
      statement += ` WHERE ${whereClause}`
    }

    return { statement, parameters }
  }

  private buildWhereClause(parameters: PartiQLParameter[]): string {
    if (this.whereConditions.length === 0) {
      return ''
    }

    const conditions = this.whereConditions.map((condition) => {
      const attr = `"${condition.attribute}"`

      switch (condition.operator) {
        case '=':
        case '<>':
        case '<':
        case '<=':
        case '>':
        case '>=': {
          const paramName = this.nextParamName()
          parameters.push({
            name: paramName,
            value: condition.value,
            type: this.inferType(condition.value),
          })
          return `${attr} ${condition.operator} ?`
        }

        case 'BETWEEN': {
          const paramName1 = this.nextParamName()
          const paramName2 = this.nextParamName()
          parameters.push({
            name: paramName1,
            value: condition.value,
            type: this.inferType(condition.value),
          })
          parameters.push({
            name: paramName2,
            value: condition.value2,
            type: this.inferType(condition.value2),
          })
          return `${attr} BETWEEN ? AND ?`
        }

        case 'IN': {
          const values = condition.value as unknown[]
          const placeholders = values.map((v) => {
            const paramName = this.nextParamName()
            parameters.push({
              name: paramName,
              value: v,
              type: this.inferType(v),
            })
            return '?'
          })
          return `${attr} IN (${placeholders.join(', ')})`
        }

        case 'BEGINS_WITH': {
          const paramName = this.nextParamName()
          parameters.push({
            name: paramName,
            value: condition.value,
            type: 'S',
          })
          return `begins_with(${attr}, ?)`
        }

        case 'CONTAINS': {
          const paramName = this.nextParamName()
          parameters.push({
            name: paramName,
            value: condition.value,
            type: this.inferType(condition.value),
          })
          return `contains(${attr}, ?)`
        }

        case 'IS_NULL':
          return `${attr} IS NULL`

        case 'IS_NOT_NULL':
          return `${attr} IS NOT NULL`

        default:
          throw new Error(`Unknown operator: ${condition.operator}`)
      }
    })

    return conditions.join(' AND ')
  }

  private nextParamName(): string {
    return `p${++this.parameterCounter}`
  }

  private inferType(value: unknown): PartiQLParameter['type'] {
    if (value === null || value === undefined) {
      return 'NULL'
    }
    if (typeof value === 'string') {
      return 'S'
    }
    if (typeof value === 'number') {
      return 'N'
    }
    if (typeof value === 'boolean') {
      return 'BOOL'
    }
    if (value instanceof Uint8Array || value instanceof Buffer) {
      return 'B'
    }
    if (Array.isArray(value)) {
      if (value.length === 0)
        return 'L'
      if (typeof value[0] === 'string')
        return 'SS'
      if (typeof value[0] === 'number')
        return 'NS'
      return 'L'
    }
    if (typeof value === 'object') {
      return 'M'
    }
    return 'S'
  }

  /**
   * Reset the builder for reuse
   */
  reset(): this {
    this.statementType = 'SELECT'
    this.tableName = ''
    this.projection = '*'
    this.whereConditions = []
    this.setValues = {}
    this.insertValues = {}
    this.orderByAttribute = undefined
    this.orderDirection = 'ASC'
    this.limitValue = undefined
    this.parameterCounter = 0
    return this
  }
}

/**
 * Create a new PartiQL builder
 */
export function partiql(): PartiQLBuilder {
  return new PartiQLBuilder()
}

/**
 * Shorthand for SELECT query
 */
export function selectFrom(tableName: string, projection: SelectProjection = '*'): PartiQLBuilder {
  return new PartiQLBuilder().select(projection).from(tableName)
}

/**
 * Shorthand for INSERT query
 */
export function insertInto(tableName: string, values: Record<string, unknown>): PartiQLBuilder {
  return new PartiQLBuilder().insert(values).into(tableName)
}

/**
 * Shorthand for UPDATE query
 */
export function updateTable(tableName: string): PartiQLBuilder {
  return new PartiQLBuilder().update().from(tableName)
}

/**
 * Shorthand for DELETE query
 */
export function deleteFrom(tableName: string): PartiQLBuilder {
  return new PartiQLBuilder().delete().from(tableName)
}

/**
 * Batch statement executor configuration
 */
export interface BatchStatementConfig {
  /** Maximum statements per batch (DynamoDB limit is 25) */
  maxBatchSize?: number
  /** Return consumed capacity */
  returnConsumedCapacity?: 'INDEXES' | 'TOTAL' | 'NONE'
}

/**
 * Batch statement result
 */
export interface BatchStatementResult {
  /** Successful results */
  responses: Array<{
    statement: string
    items?: Record<string, unknown>[]
    error?: string
  }>
  /** Consumed capacity */
  consumedCapacity?: Array<{
    tableName: string
    capacityUnits: number
  }>
  /** Unprocessed statements */
  unprocessedStatements: string[]
}

/**
 * Build batch execute statements for DynamoDB
 */
export function buildBatchStatements(
  queries: PartiQLQuery[],
  config?: BatchStatementConfig,
): Array<{
    Statements: Array<{
      Statement: string
      Parameters?: Array<{ S?: string, N?: string, B?: string, BOOL?: boolean, NULL?: boolean, L?: unknown[], M?: Record<string, unknown>, SS?: string[], NS?: string[], BS?: string[] }>
    }>
  }> {
  const maxBatchSize = config?.maxBatchSize ?? 25
  const batches: Array<{
    Statements: Array<{
      Statement: string
      Parameters?: Array<{ S?: string, N?: string, B?: string, BOOL?: boolean, NULL?: boolean, L?: unknown[], M?: Record<string, unknown>, SS?: string[], NS?: string[], BS?: string[] }>
    }>
  }> = []

  for (let i = 0; i < queries.length; i += maxBatchSize) {
    const batch = queries.slice(i, i + maxBatchSize)
    batches.push({
      Statements: batch.map((query) => {
        const stmt: {
          Statement: string
          Parameters?: Array<{ S?: string, N?: string, B?: string, BOOL?: boolean, NULL?: boolean, L?: unknown[], M?: Record<string, unknown>, SS?: string[], NS?: string[], BS?: string[] }>
        } = {
          Statement: query.statement,
        }

        if (query.parameters.length > 0) {
          stmt.Parameters = query.parameters.map((param) => {
            const dynamoValue: { S?: string, N?: string, B?: string, BOOL?: boolean, NULL?: boolean, L?: unknown[], M?: Record<string, unknown>, SS?: string[], NS?: string[], BS?: string[] } = {}

            switch (param.type) {
              case 'S':
                dynamoValue.S = String(param.value)
                break
              case 'N':
                dynamoValue.N = String(param.value)
                break
              case 'B':
                dynamoValue.B = param.value as string
                break
              case 'BOOL':
                dynamoValue.BOOL = Boolean(param.value)
                break
              case 'NULL':
                dynamoValue.NULL = true
                break
              case 'L':
                dynamoValue.L = param.value as unknown[]
                break
              case 'M':
                dynamoValue.M = param.value as Record<string, unknown>
                break
              case 'SS':
                dynamoValue.SS = param.value as string[]
                break
              case 'NS':
                dynamoValue.NS = (param.value as number[]).map(String)
                break
              case 'BS':
                dynamoValue.BS = param.value as string[]
                break
              default:
                dynamoValue.S = String(param.value)
            }

            return dynamoValue
          })
        }

        return stmt
      }),
    })
  }

  return batches
}
