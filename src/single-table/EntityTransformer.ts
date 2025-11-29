import type { ParsedModel } from '../model-parser/types'
import type { Config } from '../types'
import { resolveKeyPattern } from './KeyPatternGenerator'

// ============================================================================
// Entity Transformation Types
// ============================================================================

/**
 * DynamoDB attribute value types
 */
export type DynamoDBAttributeValue =
  | { S: string }
  | { N: string }
  | { B: string } // Base64 encoded binary
  | { BOOL: boolean }
  | { NULL: true }
  | { M: Record<string, DynamoDBAttributeValue> }
  | { L: DynamoDBAttributeValue[] }
  | { SS: string[] }
  | { NS: string[] }
  | { BS: string[] }

/**
 * DynamoDB item (marshalled format)
 */
export type DynamoDBItem = Record<string, DynamoDBAttributeValue>

/**
 * JavaScript object (unmarshalled format)
 */
export type JSObject = Record<string, unknown>

/**
 * Transformation options
 */
export interface TransformOptions {
  /**
   * Include internal attributes (pk, sk, _et, etc.) in output
   * @default false for toModel, true for toDynamoDB
   */
  includeInternalAttributes?: boolean
  /**
   * Strip null values from output
   * @default true
   */
  stripNulls?: boolean
  /**
   * Apply type casts from model definition
   * @default true
   */
  applyCasts?: boolean
}

/**
 * Transformation result with metadata
 */
export interface TransformResult<T> {
  /**
   * Transformed data
   */
  data: T
  /**
   * Generated keys
   */
  keys: {
    pk: string
    sk: string
    gsi1pk?: string
    gsi1sk?: string
    gsi2pk?: string
    gsi2sk?: string
  }
  /**
   * Entity type
   */
  entityType: string
}

// ============================================================================
// Entity Transformer Implementation
// ============================================================================

/**
 * Transform a model instance to a DynamoDB item
 */
export function toDynamoDBItem(
  model: ParsedModel,
  data: JSObject,
  config: Config,
  options: TransformOptions = {},
): TransformResult<DynamoDBItem> {
  const delimiter = config.singleTableDesign.keyDelimiter
  const entityType = model.entityType

  // Resolve key patterns
  const keys = resolveKeyPattern(model.keyPatterns, data as Record<string, string | number>)

  // Build the DynamoDB item
  const item: DynamoDBItem = {}

  // Add primary keys
  item[config.singleTableDesign.partitionKeyName] = { S: keys.pk }
  item[config.singleTableDesign.sortKeyName] = { S: keys.sk }

  // Add entity type attribute
  item[config.singleTableDesign.entityTypeAttribute] = { S: model.name }

  // Add GSI keys if present
  if (keys.gsi1pk) {
    item[config.singleTableDesign.gsi1pkName] = { S: keys.gsi1pk }
    if (keys.gsi1sk)
      item[config.singleTableDesign.gsi1skName] = { S: keys.gsi1sk }
  }
  if (keys.gsi2pk) {
    item[config.singleTableDesign.gsi2pkName] = { S: keys.gsi2pk }
    if (keys.gsi2sk)
      item[config.singleTableDesign.gsi2skName] = { S: keys.gsi2sk }
  }

  // Add data attributes
  for (const attr of model.attributes) {
    const value = data[attr.name]

    // Skip undefined values
    if (value === undefined)
      continue

    // Skip null values if configured
    if (value === null && options.stripNulls !== false)
      continue

    // Marshal the value
    const marshalledValue = marshallValue(value, attr.dynamoDbType)
    if (marshalledValue) {
      item[attr.name] = marshalledValue
    }
  }

  // Add timestamps if enabled
  if (model.hasTimestamps) {
    const now = formatTimestamp(new Date(), config.queryBuilder.timestampFormat)
    if (!data[config.queryBuilder.createdAtAttribute]) {
      item[config.queryBuilder.createdAtAttribute] = { S: now }
    }
    item[config.queryBuilder.updatedAtAttribute] = { S: now }
  }

  // Add version if enabled
  if (model.hasVersioning) {
    const version = (data[config.queryBuilder.versionAttribute] as number | undefined) ?? 1
    item[config.queryBuilder.versionAttribute] = { N: String(version) }
  }

  return {
    data: item,
    keys: {
      pk: keys.pk,
      sk: keys.sk,
      gsi1pk: keys.gsi1pk,
      gsi1sk: keys.gsi1sk,
      gsi2pk: keys.gsi2pk,
      gsi2sk: keys.gsi2sk,
    },
    entityType,
  }
}

/**
 * Transform a DynamoDB item to a model instance
 */
export function toModelInstance(
  model: ParsedModel,
  item: DynamoDBItem,
  config: Config,
  options: TransformOptions = {},
): TransformResult<JSObject> {
  const pkName = config.singleTableDesign.partitionKeyName
  const skName = config.singleTableDesign.sortKeyName

  const pk = (item[pkName] as { S: string })?.S ?? ''
  const sk = (item[skName] as { S: string })?.S ?? ''

  const data: JSObject = {}

  // Unmarshall all attributes
  for (const [key, value] of Object.entries(item)) {
    // Skip internal attributes unless requested
    if (!options.includeInternalAttributes) {
      if (isInternalAttribute(key, config))
        continue
    }

    // Unmarshall the value
    const unmarshalledValue = unmarshallValue(value)

    // Apply type casts if configured
    if (options.applyCasts !== false) {
      const attrDef = model.attributes.find(a => a.name === key)
      if (attrDef?.cast) {
        data[key] = applyCast(unmarshalledValue, attrDef.cast)
      }
      else {
        data[key] = unmarshalledValue
      }
    }
    else {
      data[key] = unmarshalledValue
    }
  }

  return {
    data,
    keys: {
      pk,
      sk,
      gsi1pk: (item[config.singleTableDesign.gsi1pkName] as { S: string })?.S,
      gsi1sk: (item[config.singleTableDesign.gsi1skName] as { S: string })?.S,
      gsi2pk: (item[config.singleTableDesign.gsi2pkName] as { S: string })?.S,
      gsi2sk: (item[config.singleTableDesign.gsi2skName] as { S: string })?.S,
    },
    entityType: model.entityType,
  }
}

/**
 * Check if an attribute is an internal DynamoDB/single-table attribute
 */
function isInternalAttribute(key: string, config: Config): boolean {
  const internalAttrs = [
    config.singleTableDesign.partitionKeyName,
    config.singleTableDesign.sortKeyName,
    config.singleTableDesign.entityTypeAttribute,
    config.singleTableDesign.dataAttribute,
    config.singleTableDesign.gsi1pkName,
    config.singleTableDesign.gsi1skName,
    config.singleTableDesign.gsi2pkName,
    config.singleTableDesign.gsi2skName,
    config.singleTableDesign.gsi3pkName,
    config.singleTableDesign.gsi3skName,
    config.singleTableDesign.gsi4pkName,
    config.singleTableDesign.gsi4skName,
    config.singleTableDesign.gsi5pkName,
    config.singleTableDesign.gsi5skName,
  ]

  return internalAttrs.includes(key)
}

/**
 * Marshall a JavaScript value to DynamoDB format
 */
export function marshallValue(value: unknown, typeHint?: string): DynamoDBAttributeValue | null {
  if (value === null) {
    return { NULL: true }
  }

  if (value === undefined) {
    return null
  }

  // Handle based on JavaScript type
  switch (typeof value) {
    case 'string':
      return { S: value }

    case 'number':
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        return null
      }
      return { N: String(value) }

    case 'boolean':
      return { BOOL: value }

    case 'object':
      if (Array.isArray(value)) {
        // Check if it's a Set type
        if (typeHint === 'SS') {
          return { SS: value.map(String) }
        }
        if (typeHint === 'NS') {
          return { NS: value.map(String) }
        }
        // Regular list
        const list = value
          .map(v => marshallValue(v))
          .filter((v): v is DynamoDBAttributeValue => v !== null)
        return { L: list }
      }

      if (value instanceof Set) {
        const arr = Array.from(value)
        if (arr.every(v => typeof v === 'string')) {
          return { SS: arr as string[] }
        }
        if (arr.every(v => typeof v === 'number')) {
          return { NS: arr.map(String) }
        }
        // Convert to list
        const list = arr
          .map(v => marshallValue(v))
          .filter((v): v is DynamoDBAttributeValue => v !== null)
        return { L: list }
      }

      if (value instanceof Date) {
        return { S: value.toISOString() }
      }

      if (value instanceof Buffer || value instanceof Uint8Array) {
        return { B: Buffer.from(value).toString('base64') }
      }

      // Plain object -> Map
      const map: Record<string, DynamoDBAttributeValue> = {}
      for (const [k, v] of Object.entries(value)) {
        const marshalled = marshallValue(v)
        if (marshalled) {
          map[k] = marshalled
        }
      }
      return { M: map }

    default:
      return null
  }
}

/**
 * Unmarshall a DynamoDB value to JavaScript format
 */
export function unmarshallValue(value: DynamoDBAttributeValue): unknown {
  if ('S' in value)
    return value.S
  if ('N' in value)
    return Number(value.N)
  if ('BOOL' in value)
    return value.BOOL
  if ('NULL' in value)
    return null
  if ('B' in value)
    return Buffer.from(value.B, 'base64')
  if ('SS' in value)
    return new Set(value.SS)
  if ('NS' in value)
    return new Set(value.NS.map(Number))
  if ('BS' in value)
    return new Set(value.BS.map(b => Buffer.from(b, 'base64')))
  if ('L' in value)
    return value.L.map(unmarshallValue)
  if ('M' in value) {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value.M)) {
      obj[k] = unmarshallValue(v)
    }
    return obj
  }
  return null
}

/**
 * Marshall an entire object to DynamoDB format
 */
export function marshallObject(obj: JSObject): DynamoDBItem {
  const item: DynamoDBItem = {}
  for (const [key, value] of Object.entries(obj)) {
    const marshalled = marshallValue(value)
    if (marshalled) {
      item[key] = marshalled
    }
  }
  return item
}

/**
 * Unmarshall an entire DynamoDB item to JavaScript format
 */
export function unmarshallItem(item: DynamoDBItem): JSObject {
  const obj: JSObject = {}
  for (const [key, value] of Object.entries(item)) {
    obj[key] = unmarshallValue(value)
  }
  return obj
}

/**
 * Format a timestamp according to config
 */
function formatTimestamp(date: Date, format: 'iso' | 'unix' | 'unixMs'): string {
  switch (format) {
    case 'iso':
      return date.toISOString()
    case 'unix':
      return String(Math.floor(date.getTime() / 1000))
    case 'unixMs':
      return String(date.getTime())
    default:
      return date.toISOString()
  }
}

/**
 * Apply type cast to a value
 */
function applyCast(value: unknown, cast: string): unknown {
  switch (cast.toLowerCase()) {
    case 'integer':
    case 'int':
      return typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)

    case 'float':
    case 'double':
    case 'number':
    case 'decimal':
      return Number(value)

    case 'boolean':
    case 'bool':
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1'
      }
      return Boolean(value)

    case 'string':
      return String(value)

    case 'datetime':
    case 'date':
      if (value instanceof Date)
        return value
      return new Date(value as string | number)

    case 'json':
    case 'object':
    case 'array':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        }
        catch {
          return value
        }
      }
      return value

    default:
      return value
  }
}

/**
 * Extract the primary key values from a model instance
 */
export function extractKeys(
  model: ParsedModel,
  data: JSObject,
  config: Config,
): { pk: string, sk: string } {
  const keys = resolveKeyPattern(model.keyPatterns, data as Record<string, string | number>)
  return { pk: keys.pk, sk: keys.sk }
}

/**
 * Build an update expression from changed attributes
 */
export function buildUpdateData(
  model: ParsedModel,
  original: JSObject,
  updated: JSObject,
  config: Config,
): { changes: JSObject, hasChanges: boolean } {
  const changes: JSObject = {}
  let hasChanges = false

  for (const attr of model.attributes) {
    if (!attr.fillable)
      continue

    const origValue = original[attr.name]
    const newValue = updated[attr.name]

    // Check if value changed
    if (!deepEqual(origValue, newValue)) {
      changes[attr.name] = newValue
      hasChanges = true
    }
  }

  // Always update updatedAt if timestamps enabled
  if (model.hasTimestamps) {
    changes[config.queryBuilder.updatedAtAttribute] = formatTimestamp(
      new Date(),
      config.queryBuilder.timestampFormat,
    )
  }

  // Increment version if versioning enabled
  if (model.hasVersioning) {
    const currentVersion = (original[config.queryBuilder.versionAttribute] as number | undefined) ?? 0
    changes[config.queryBuilder.versionAttribute] = currentVersion + 1
  }

  return { changes, hasChanges }
}

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b)
    return true
  if (a == null || b == null)
    return a === b
  if (typeof a !== typeof b)
    return false

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        return false
      return a.every((v, i) => deepEqual(v, b[i]))
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime()
    }

    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size)
        return false
      for (const v of a) {
        if (!b.has(v))
          return false
      }
      return true
    }

    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const aKeys = Object.keys(aObj)
    const bKeys = Object.keys(bObj)

    if (aKeys.length !== bKeys.length)
      return false
    return aKeys.every(k => deepEqual(aObj[k], bObj[k]))
  }

  return false
}
