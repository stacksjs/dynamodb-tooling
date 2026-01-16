// ============================================================================
// Driver Utility Functions
// ============================================================================

import type { DynamoDBAttributeValue, DynamoDBItem } from '../single-table/EntityTransformer'
import type { AttributeValue } from './types'

/**
 * Unmarshall a DynamoDB item to a plain JavaScript object
 * Note: Returns DynamoDBItem which uses the internal DynamoDBAttributeValue type
 */
export function unmarshallItem(item: Record<string, AttributeValue>): DynamoDBItem {
  const result: DynamoDBItem = {}

  for (const [key, value] of Object.entries(item)) {
    result[key] = unmarshallValueInternal(value)
  }

  return result
}

/**
 * Internal unmarshall that returns DynamoDBAttributeValue for use in DynamoDBItem
 */
function unmarshallValueInternal(value: AttributeValue): DynamoDBAttributeValue {
  if (value.S !== undefined)
    return { S: value.S }
  if (value.N !== undefined)
    return { N: value.N }
  if (value.B !== undefined)
    return { B: typeof value.B === 'string' ? value.B : Buffer.from(value.B).toString('base64') }
  if (value.BOOL !== undefined)
    return { BOOL: value.BOOL }
  if (value.NULL !== undefined)
    return { NULL: true }
  if (value.SS !== undefined)
    return { SS: value.SS }
  if (value.NS !== undefined)
    return { NS: value.NS }
  if (value.BS !== undefined)
    return { BS: (value.BS as Array<Uint8Array | string>).map(b => typeof b === 'string' ? b : Buffer.from(b).toString('base64')) }
  if (value.L !== undefined)
    return { L: value.L.map(v => unmarshallValueInternal(v)) }
  if (value.M !== undefined) {
    const result: Record<string, DynamoDBAttributeValue> = {}
    for (const [k, v] of Object.entries(value.M)) {
      result[k] = unmarshallValueInternal(v)
    }
    return { M: result }
  }
  // Default to null
  return { NULL: true }
}

/**
 * Unmarshall a single DynamoDB attribute value to plain JavaScript
 */
export function unmarshallValue(value: AttributeValue): unknown {
  if (value.S !== undefined)
    return value.S
  if (value.N !== undefined)
    return Number(value.N)
  if (value.B !== undefined)
    return value.B
  if (value.BOOL !== undefined)
    return value.BOOL
  if (value.NULL !== undefined)
    return null
  if (value.SS !== undefined)
    return new Set(value.SS)
  if (value.NS !== undefined)
    return new Set(value.NS.map(Number))
  if (value.BS !== undefined)
    return new Set(value.BS)
  if (value.L !== undefined)
    return value.L.map(v => unmarshallValue(v))
  if (value.M !== undefined) {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value.M)) {
      result[k] = unmarshallValue(v)
    }
    return result
  }

  return undefined
}

/**
 * Marshall a plain JavaScript object to a DynamoDB item
 */
export function marshallItem(item: Record<string, unknown>): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {}

  for (const [key, value] of Object.entries(item)) {
    const marshalled = marshallValue(value)
    if (marshalled !== undefined) {
      result[key] = marshalled
    }
  }

  return result
}

/**
 * Marshall a single JavaScript value to a DynamoDB attribute value
 */
export function marshallValue(value: unknown): AttributeValue | undefined {
  if (value === undefined)
    return undefined

  if (value === null) {
    return { NULL: true }
  }

  if (typeof value === 'string') {
    return { S: value }
  }

  if (typeof value === 'number') {
    return { N: String(value) }
  }

  if (typeof value === 'boolean') {
    return { BOOL: value }
  }

  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return { B: value }
  }

  if (value instanceof Set) {
    const arr = Array.from(value)
    if (arr.length === 0)
      return { L: [] }

    const first = arr[0]
    if (typeof first === 'string') {
      return { SS: arr as string[] }
    }
    if (typeof first === 'number') {
      return { NS: arr.map(String) }
    }
    if (first instanceof Uint8Array || Buffer.isBuffer(first)) {
      return { BS: arr as Array<Uint8Array | string> }
    }
    // Mixed set - convert to list
    return { L: arr.map(v => marshallValue(v)).filter((v): v is AttributeValue => v !== undefined) }
  }

  if (Array.isArray(value)) {
    return {
      L: value.map(v => marshallValue(v)).filter((v): v is AttributeValue => v !== undefined),
    }
  }

  if (typeof value === 'object') {
    return {
      M: marshallItem(value as Record<string, unknown>),
    }
  }

  // Fallback: convert to string
  return { S: String(value) }
}

/**
 * Build an update expression from a set of changes
 */
export function buildUpdateExpression(
  changes: Record<string, unknown>,
  options?: {
    /** Attributes to remove */
    removeAttributes?: string[]
    /** Attributes to add to number/set */
    addAttributes?: Record<string, number | string[]>
    /** Attributes to delete from set */
    deleteAttributes?: Record<string, string[]>
  },
): {
    updateExpression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, AttributeValue>
  } {
  const names: Record<string, string> = {}
  const values: Record<string, AttributeValue> = {}
  const setParts: string[] = []
  const removeParts: string[] = []
  const addParts: string[] = []
  const deleteParts: string[] = []

  let index = 0

  // SET clause
  for (const [key, value] of Object.entries(changes)) {
    const nameKey = `#n${index}`
    const valueKey = `:v${index}`
    names[nameKey] = key
    const marshalled = marshallValue(value)
    if (marshalled) {
      values[valueKey] = marshalled
      setParts.push(`${nameKey} = ${valueKey}`)
    }
    index++
  }

  // REMOVE clause
  if (options?.removeAttributes) {
    for (const attr of options.removeAttributes) {
      const nameKey = `#n${index}`
      names[nameKey] = attr
      removeParts.push(nameKey)
      index++
    }
  }

  // ADD clause
  if (options?.addAttributes) {
    for (const [key, value] of Object.entries(options.addAttributes)) {
      const nameKey = `#n${index}`
      const valueKey = `:v${index}`
      names[nameKey] = key
      const marshalled = marshallValue(value)
      if (marshalled) {
        values[valueKey] = marshalled
        addParts.push(`${nameKey} ${valueKey}`)
      }
      index++
    }
  }

  // DELETE clause
  if (options?.deleteAttributes) {
    for (const [key, value] of Object.entries(options.deleteAttributes)) {
      const nameKey = `#n${index}`
      const valueKey = `:v${index}`
      names[nameKey] = key
      values[valueKey] = { SS: value }
      deleteParts.push(`${nameKey} ${valueKey}`)
      index++
    }
  }

  // Build expression
  const parts: string[] = []
  if (setParts.length > 0)
    parts.push(`SET ${setParts.join(', ')}`)
  if (removeParts.length > 0)
    parts.push(`REMOVE ${removeParts.join(', ')}`)
  if (addParts.length > 0)
    parts.push(`ADD ${addParts.join(', ')}`)
  if (deleteParts.length > 0)
    parts.push(`DELETE ${deleteParts.join(', ')}`)

  return {
    updateExpression: parts.join(' '),
    expressionAttributeNames: names,
    expressionAttributeValues: values,
  }
}

/**
 * Build a key condition expression
 */
export function buildKeyConditionExpression(
  conditions: Array<{
    attribute: string
    operator: '=' | '<' | '<=' | '>' | '>=' | 'BETWEEN' | 'begins_with'
    value: unknown
    value2?: unknown
  }>,
): {
    keyConditionExpression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, AttributeValue>
  } {
  const names: Record<string, string> = {}
  const values: Record<string, AttributeValue> = {}
  const parts: string[] = []

  let index = 0

  for (const condition of conditions) {
    const nameKey = `#k${index}`
    const valueKey = `:k${index}`
    names[nameKey] = condition.attribute

    switch (condition.operator) {
      case '=':
      case '<':
      case '<=':
      case '>':
      case '>=': {
        const marshalled = marshallValue(condition.value)
        if (marshalled) {
          values[valueKey] = marshalled
          parts.push(`${nameKey} ${condition.operator} ${valueKey}`)
        }
        break
      }
      case 'BETWEEN': {
        const valueKey2 = `:k${index}b`
        const marshalled1 = marshallValue(condition.value)
        const marshalled2 = marshallValue(condition.value2)
        if (marshalled1 && marshalled2) {
          values[valueKey] = marshalled1
          values[valueKey2] = marshalled2
          parts.push(`${nameKey} BETWEEN ${valueKey} AND ${valueKey2}`)
        }
        break
      }
      case 'begins_with': {
        const marshalled = marshallValue(condition.value)
        if (marshalled) {
          values[valueKey] = marshalled
          parts.push(`begins_with(${nameKey}, ${valueKey})`)
        }
        break
      }
    }

    index++
  }

  return {
    keyConditionExpression: parts.join(' AND '),
    expressionAttributeNames: names,
    expressionAttributeValues: values,
  }
}

/**
 * Build a filter expression
 */
export function buildFilterExpression(
  conditions: Array<{
    attribute: string
    operator: '=' | '<>' | '<' | '<=' | '>' | '>=' | 'BETWEEN' | 'IN' | 'begins_with' | 'contains' | 'attribute_exists' | 'attribute_not_exists' | 'attribute_type'
    value?: unknown
    value2?: unknown
    values?: unknown[]
    type?: 'S' | 'N' | 'B' | 'BOOL' | 'NULL' | 'L' | 'M' | 'SS' | 'NS' | 'BS'
  }>,
  logicalOperator: 'AND' | 'OR' = 'AND',
): {
    filterExpression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, AttributeValue>
  } {
  const names: Record<string, string> = {}
  const values: Record<string, AttributeValue> = {}
  const parts: string[] = []

  let index = 0

  for (const condition of conditions) {
    const nameKey = `#f${index}`
    const valueKey = `:f${index}`
    names[nameKey] = condition.attribute

    switch (condition.operator) {
      case '=':
      case '<>':
      case '<':
      case '<=':
      case '>':
      case '>=': {
        const marshalled = marshallValue(condition.value)
        if (marshalled) {
          values[valueKey] = marshalled
          parts.push(`${nameKey} ${condition.operator} ${valueKey}`)
        }
        break
      }
      case 'BETWEEN': {
        const valueKey2 = `:f${index}b`
        const marshalled1 = marshallValue(condition.value)
        const marshalled2 = marshallValue(condition.value2)
        if (marshalled1 && marshalled2) {
          values[valueKey] = marshalled1
          values[valueKey2] = marshalled2
          parts.push(`${nameKey} BETWEEN ${valueKey} AND ${valueKey2}`)
        }
        break
      }
      case 'IN': {
        if (condition.values && condition.values.length > 0) {
          const inParts: string[] = []
          for (let i = 0; i < condition.values.length; i++) {
            const inValueKey = `:f${index}_${i}`
            const marshalled = marshallValue(condition.values[i])
            if (marshalled) {
              values[inValueKey] = marshalled
              inParts.push(inValueKey)
            }
          }
          if (inParts.length > 0) {
            parts.push(`${nameKey} IN (${inParts.join(', ')})`)
          }
        }
        break
      }
      case 'begins_with': {
        const marshalled = marshallValue(condition.value)
        if (marshalled) {
          values[valueKey] = marshalled
          parts.push(`begins_with(${nameKey}, ${valueKey})`)
        }
        break
      }
      case 'contains': {
        const marshalled = marshallValue(condition.value)
        if (marshalled) {
          values[valueKey] = marshalled
          parts.push(`contains(${nameKey}, ${valueKey})`)
        }
        break
      }
      case 'attribute_exists': {
        parts.push(`attribute_exists(${nameKey})`)
        break
      }
      case 'attribute_not_exists': {
        parts.push(`attribute_not_exists(${nameKey})`)
        break
      }
      case 'attribute_type': {
        if (condition.type) {
          values[valueKey] = { S: condition.type }
          parts.push(`attribute_type(${nameKey}, ${valueKey})`)
        }
        break
      }
    }

    index++
  }

  return {
    filterExpression: parts.join(` ${logicalOperator} `),
    expressionAttributeNames: names,
    expressionAttributeValues: values,
  }
}

/**
 * Build a projection expression
 */
export function buildProjectionExpression(attributes: string[]): {
  projectionExpression: string
  expressionAttributeNames: Record<string, string>
} {
  const names: Record<string, string> = {}
  const parts: string[] = []

  for (let i = 0; i < attributes.length; i++) {
    const nameKey = `#p${i}`
    names[nameKey] = attributes[i]
    parts.push(nameKey)
  }

  return {
    projectionExpression: parts.join(', '),
    expressionAttributeNames: names,
  }
}

/**
 * Merge expression attribute names from multiple expressions
 */
export function mergeExpressionAttributeNames(
  ...maps: Array<Record<string, string> | undefined>
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const map of maps) {
    if (map) {
      Object.assign(result, map)
    }
  }
  return result
}

/**
 * Merge expression attribute values from multiple expressions
 */
export function mergeExpressionAttributeValues(
  ...maps: Array<Record<string, AttributeValue> | undefined>
): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {}
  for (const map of maps) {
    if (map) {
      Object.assign(result, map)
    }
  }
  return result
}

/**
 * Check if a value is a DynamoDB reserved word
 */
const RESERVED_WORDS = new Set([
  'ABORT',
  'ABSOLUTE',
  'ACTION',
  'ADD',
  'AFTER',
  'AGENT',
  'AGGREGATE',
  'ALL',
  'ALLOCATE',
  'ALTER',
  'ANALYZE',
  'AND',
  'ANY',
  'ARCHIVE',
  'ARE',
  'ARRAY',
  'AS',
  'ASC',
  'ASCII',
  'ASENSITIVE',
  'ASSERTION',
  'ASYMMETRIC',
  'AT',
  'ATOMIC',
  'ATTACH',
  'ATTRIBUTE',
  'AUTH',
  'AUTHORIZATION',
  'AUTHORIZE',
  'AUTO',
  'AVG',
  'BACK',
  'BACKUP',
  'BASE',
  'BATCH',
  'BEFORE',
  'BEGIN',
  'BETWEEN',
  'BIGINT',
  'BINARY',
  'BIT',
  'BLOB',
  'BLOCK',
  'BOOLEAN',
  'BOTH',
  'BREADTH',
  'BUCKET',
  'BULK',
  'BY',
  'BYTE',
  'CALL',
  'CALLED',
  'CALLING',
  'CAPACITY',
  'CASCADE',
  'CASCADED',
  'CASE',
  'CAST',
  'CATALOG',
  'CHAR',
  'CHARACTER',
  'CHECK',
  'CLASS',
  'CLOB',
  'CLOSE',
  'CLUSTER',
  'CLUSTERED',
  'CLUSTERING',
  'CLUSTERS',
  'COALESCE',
  'COLLATE',
  'COLLATION',
  'COLLECTION',
  'COLUMN',
  'COLUMNS',
  'COMBINE',
  'COMMENT',
  'COMMIT',
  'COMPACT',
  'COMPILE',
  'COMPRESS',
  'CONDITION',
  'CONFLICT',
  'CONNECT',
  'CONNECTION',
  'CONSISTENCY',
  'CONSISTENT',
  'CONSTRAINT',
  'CONSTRAINTS',
  'CONSTRUCTOR',
  'CONSUMED',
  'CONTINUE',
  'CONVERT',
  'COPY',
  'CORRESPONDING',
  'COUNT',
  'COUNTER',
  'CREATE',
  'CROSS',
  'CUBE',
  'CURRENT',
  'CURSOR',
  'CYCLE',
  'DATA',
  'DATABASE',
  'DATE',
  'DATETIME',
  'DAY',
  'DEALLOCATE',
  'DEC',
  'DECIMAL',
  'DECLARE',
  'DEFAULT',
  'DEFERRABLE',
  'DEFERRED',
  'DEFINE',
  'DEFINED',
  'DEFINITION',
  'DELETE',
  'DELIMITED',
  'DEPTH',
  'DEREF',
  'DESC',
  'DESCRIBE',
  'DESCRIPTOR',
  'DETACH',
  'DETERMINISTIC',
  'DIAGNOSTICS',
  'DIRECTORIES',
  'DIRECTORY',
  'DISABLE',
  'DISCONNECT',
  'DISTINCT',
  'DISTRIBUTE',
  'DO',
  'DOMAIN',
  'DOUBLE',
  'DROP',
  'DUMP',
  'DURATION',
  'DYNAMIC',
  'EACH',
  'ELEMENT',
  'ELSE',
  'ELSEIF',
  'EMPTY',
  'ENABLE',
  'END',
  'EQUAL',
  'EQUALS',
  'ERROR',
  'ESCAPE',
  'ESCAPED',
  'EVAL',
  'EVALUATE',
  'EXCEEDED',
  'EXCEPT',
  'EXCEPTION',
  'EXCEPTIONS',
  'EXCLUSIVE',
  'EXEC',
  'EXECUTE',
  'EXISTS',
  'EXIT',
  'EXPLAIN',
  'EXPLODE',
  'EXPORT',
  'EXPRESSION',
  'EXTENDED',
  'EXTERNAL',
  'EXTRACT',
  'FAIL',
  'FALSE',
  'FAMILY',
  'FETCH',
  'FIELDS',
  'FILE',
  'FILTER',
  'FILTERING',
  'FINAL',
  'FINISH',
  'FIRST',
  'FIXED',
  'FLATTERN',
  'FLOAT',
  'FOR',
  'FORCE',
  'FOREIGN',
  'FORMAT',
  'FORWARD',
  'FOUND',
  'FREE',
  'FROM',
  'FULL',
  'FUNCTION',
  'FUNCTIONS',
  'GENERAL',
  'GENERATE',
  'GET',
  'GLOB',
  'GLOBAL',
  'GO',
  'GOTO',
  'GRANT',
  'GREATER',
  'GROUP',
  'GROUPING',
  'HANDLER',
  'HASH',
  'HAVE',
  'HAVING',
  'HEAP',
  'HIDDEN',
  'HOLD',
  'HOUR',
  'IDENTIFIED',
  'IDENTITY',
  'IF',
  'IGNORE',
  'IMMEDIATE',
  'IMPORT',
  'IN',
  'INCLUDING',
  'INCLUSIVE',
  'INCREMENT',
  'INCREMENTAL',
  'INDEX',
  'INDEXED',
  'INDEXES',
  'INDICATOR',
  'INFINITE',
  'INITIALLY',
  'INLINE',
  'INNER',
  'INNTER',
  'INOUT',
  'INPUT',
  'INSENSITIVE',
  'INSERT',
  'INSTEAD',
  'INT',
  'INTEGER',
  'INTERSECT',
  'INTERVAL',
  'INTO',
  'INVALIDATE',
  'IS',
  'ISOLATION',
  'ITEM',
  'ITEMS',
  'ITERATE',
  'JOIN',
  'KEY',
  'KEYS',
  'LAG',
  'LANGUAGE',
  'LARGE',
  'LAST',
  'LATERAL',
  'LEAD',
  'LEADING',
  'LEAVE',
  'LEFT',
  'LENGTH',
  'LESS',
  'LEVEL',
  'LIKE',
  'LIMIT',
  'LIMITED',
  'LINES',
  'LIST',
  'LOAD',
  'LOCAL',
  'LOCALTIME',
  'LOCALTIMESTAMP',
  'LOCATION',
  'LOCATOR',
  'LOCK',
  'LOCKS',
  'LOG',
  'LOGED',
  'LONG',
  'LOOP',
  'LOWER',
  'MAP',
  'MATCH',
  'MATERIALIZED',
  'MAX',
  'MAXLEN',
  'MEMBER',
  'MERGE',
  'METHOD',
  'METRICS',
  'MIN',
  'MINUS',
  'MINUTE',
  'MISSING',
  'MOD',
  'MODE',
  'MODIFIES',
  'MODIFY',
  'MODULE',
  'MONTH',
  'MULTI',
  'MULTISET',
  'NAME',
  'NAMES',
  'NATIONAL',
  'NATURAL',
  'NCHAR',
  'NCLOB',
  'NEW',
  'NEXT',
  'NO',
  'NONE',
  'NOT',
  'NULL',
  'NULLIF',
  'NUMBER',
  'NUMERIC',
  'OBJECT',
  'OF',
  'OFFLINE',
  'OFFSET',
  'OLD',
  'ON',
  'ONLINE',
  'ONLY',
  'OPAQUE',
  'OPEN',
  'OPERATOR',
  'OPTION',
  'OR',
  'ORDER',
  'ORDINALITY',
  'OTHER',
  'OTHERS',
  'OUT',
  'OUTER',
  'OUTPUT',
  'OVER',
  'OVERLAPS',
  'OVERRIDE',
  'OWNER',
  'PAD',
  'PARALLEL',
  'PARAMETER',
  'PARAMETERS',
  'PARTIAL',
  'PARTITION',
  'PARTITIONED',
  'PARTITIONS',
  'PATH',
  'PERCENT',
  'PERCENTILE',
  'PERMISSION',
  'PERMISSIONS',
  'PIPE',
  'PIPELINED',
  'PLAN',
  'POOL',
  'POSITION',
  'PRECISION',
  'PREPARE',
  'PRESERVE',
  'PRIMARY',
  'PRIOR',
  'PRIVATE',
  'PRIVILEGES',
  'PROCEDURE',
  'PROCESSED',
  'PROJECT',
  'PROJECTION',
  'PROPERTY',
  'PROVISIONING',
  'PUBLIC',
  'PUT',
  'QUERY',
  'QUIT',
  'QUORUM',
  'RAISE',
  'RANDOM',
  'RANGE',
  'RANK',
  'RAW',
  'READ',
  'READS',
  'REAL',
  'REBUILD',
  'RECORD',
  'RECURSIVE',
  'REDUCE',
  'REF',
  'REFERENCE',
  'REFERENCES',
  'REFERENCING',
  'REGEXP',
  'REGION',
  'REINDEX',
  'RELATIVE',
  'RELEASE',
  'REMAINDER',
  'RENAME',
  'REPEAT',
  'REPLACE',
  'REQUEST',
  'RESET',
  'RESIGNAL',
  'RESOURCE',
  'RESPONSE',
  'RESTORE',
  'RESTRICT',
  'RESULT',
  'RETURN',
  'RETURNING',
  'RETURNS',
  'REVERSE',
  'REVOKE',
  'RIGHT',
  'ROLE',
  'ROLES',
  'ROLLBACK',
  'ROLLUP',
  'ROUTINE',
  'ROW',
  'ROWS',
  'RULE',
  'RULES',
  'SAMPLE',
  'SATISFIES',
  'SAVE',
  'SAVEPOINT',
  'SCAN',
  'SCHEMA',
  'SCOPE',
  'SCROLL',
  'SEARCH',
  'SECOND',
  'SECTION',
  'SEGMENT',
  'SEGMENTS',
  'SELECT',
  'SELF',
  'SEMI',
  'SENSITIVE',
  'SEPARATE',
  'SEQUENCE',
  'SERIALIZABLE',
  'SESSION',
  'SET',
  'SETS',
  'SHARD',
  'SHARE',
  'SHARED',
  'SHORT',
  'SHOW',
  'SIGNAL',
  'SIMILAR',
  'SIZE',
  'SKEWED',
  'SMALLINT',
  'SNAPSHOT',
  'SOME',
  'SOURCE',
  'SPACE',
  'SPACES',
  'SPARSE',
  'SPECIFIC',
  'SPECIFICTYPE',
  'SPLIT',
  'SQL',
  'SQLCODE',
  'SQLERROR',
  'SQLEXCEPTION',
  'SQLSTATE',
  'SQLWARNING',
  'START',
  'STATE',
  'STATIC',
  'STATUS',
  'STORAGE',
  'STORE',
  'STORED',
  'STREAM',
  'STRING',
  'STRUCT',
  'STYLE',
  'SUB',
  'SUBMULTISET',
  'SUBPARTITION',
  'SUBSTRING',
  'SUBTYPE',
  'SUM',
  'SUPER',
  'SYMMETRIC',
  'SYNONYM',
  'SYSTEM',
  'TABLE',
  'TABLESAMPLE',
  'TEMP',
  'TEMPORARY',
  'TERMINATED',
  'TEXT',
  'THAN',
  'THEN',
  'THROUGHPUT',
  'TIME',
  'TIMESTAMP',
  'TIMEZONE',
  'TINYINT',
  'TO',
  'TOKEN',
  'TOTAL',
  'TOUCH',
  'TRAILING',
  'TRANSACTION',
  'TRANSFORM',
  'TRANSLATE',
  'TRANSLATION',
  'TREAT',
  'TRIGGER',
  'TRIM',
  'TRUE',
  'TRUNCATE',
  'TTL',
  'TUPLE',
  'TYPE',
  'UNDER',
  'UNDO',
  'UNION',
  'UNIQUE',
  'UNIT',
  'UNKNOWN',
  'UNLOGGED',
  'UNNEST',
  'UNPROCESSED',
  'UNSIGNED',
  'UNTIL',
  'UPDATE',
  'UPPER',
  'URL',
  'USAGE',
  'USE',
  'USER',
  'USERS',
  'USING',
  'UUID',
  'VACUUM',
  'VALUE',
  'VALUED',
  'VALUES',
  'VARCHAR',
  'VARIABLE',
  'VARIANCE',
  'VARINT',
  'VARYING',
  'VIEW',
  'VIEWS',
  'VIRTUAL',
  'VOID',
  'WAIT',
  'WHEN',
  'WHENEVER',
  'WHERE',
  'WHILE',
  'WINDOW',
  'WITH',
  'WITHIN',
  'WITHOUT',
  'WORK',
  'WRAPPED',
  'WRITE',
  'YEAR',
  'ZONE',
])

export function isReservedWord(word: string): boolean {
  return RESERVED_WORDS.has(word.toUpperCase())
}

/**
 * Escape attribute name if it's a reserved word
 */
export function escapeAttributeName(name: string): string {
  if (isReservedWord(name)) {
    return `#${name}`
  }
  return name
}
