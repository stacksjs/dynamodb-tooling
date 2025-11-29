// ============================================================================
// Built-in Validation Rules
// ============================================================================

import type { ValidationContext, ValidationRuleDefinition } from './Validator'

/**
 * Required validation rule
 */
export function required(message?: string): ValidationRuleDefinition {
  return {
    name: 'required',
    message: message ?? 'The :attribute field is required',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return false
      }
      if (typeof value === 'string' && value.trim() === '') {
        return false
      }
      if (Array.isArray(value) && value.length === 0) {
        return false
      }
      return true
    },
  }
}

/**
 * String validation rule
 */
export function string(message?: string): ValidationRuleDefinition {
  return {
    name: 'string',
    message: message ?? 'The :attribute must be a string',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true // Let required handle empty values
      }
      return typeof value === 'string'
    },
  }
}

/**
 * Number validation rule
 */
export function number(message?: string): ValidationRuleDefinition {
  return {
    name: 'number',
    message: message ?? 'The :attribute must be a number',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return true
      }
      // Also accept numeric strings
      if (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))) {
        return true
      }
      return false
    },
  }
}

/**
 * Boolean validation rule
 */
export function boolean(message?: string): ValidationRuleDefinition {
  return {
    name: 'boolean',
    message: message ?? 'The :attribute must be a boolean',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      return typeof value === 'boolean' || value === 0 || value === 1 || value === '0' || value === '1' || value === 'true' || value === 'false'
    },
  }
}

/**
 * Email validation rule (basic pattern)
 */
export function email(message?: string): ValidationRuleDefinition {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  return {
    name: 'email',
    message: message ?? 'The :attribute must be a valid email address',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      return typeof value === 'string' && emailPattern.test(value)
    },
  }
}

/**
 * URL validation rule (basic pattern)
 */
export function url(message?: string): ValidationRuleDefinition {
  return {
    name: 'url',
    message: message ?? 'The :attribute must be a valid URL',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      if (typeof value !== 'string') {
        return false
      }
      try {
        new URL(value)
        return true
      }
      catch {
        return false
      }
    },
  }
}

/**
 * UUID validation rule
 */
export function uuid(version?: 3 | 4 | 5 | 'all', message?: string): ValidationRuleDefinition {
  const patterns: Record<string, RegExp> = {
    3: /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    5: /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    all: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  }

  const pattern = patterns[version?.toString() ?? 'all'] ?? patterns.all

  return {
    name: 'uuid',
    params: { version },
    message: message ?? 'The :attribute must be a valid UUID',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      return typeof value === 'string' && pattern.test(value)
    },
  }
}

/**
 * Minimum value validation rule
 */
export function min(minValue: number, message?: string): ValidationRuleDefinition {
  return {
    name: 'min',
    params: { min: minValue },
    message: message ?? 'The :attribute must be at least :min',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(num)) {
        return false
      }
      return num >= minValue
    },
  }
}

/**
 * Maximum value validation rule
 */
export function max(maxValue: number, message?: string): ValidationRuleDefinition {
  return {
    name: 'max',
    params: { max: maxValue },
    message: message ?? 'The :attribute must not be greater than :max',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(num)) {
        return false
      }
      return num <= maxValue
    },
  }
}

/**
 * Minimum length validation rule
 */
export function minLength(length: number, message?: string): ValidationRuleDefinition {
  return {
    name: 'minLength',
    params: { min: length },
    message: message ?? 'The :attribute must be at least :min characters',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      if (typeof value === 'string') {
        return value.length >= length
      }
      if (Array.isArray(value)) {
        return value.length >= length
      }
      return false
    },
  }
}

/**
 * Maximum length validation rule
 */
export function maxLength(length: number, message?: string): ValidationRuleDefinition {
  return {
    name: 'maxLength',
    params: { max: length },
    message: message ?? 'The :attribute must not exceed :max characters',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      if (typeof value === 'string') {
        return value.length <= length
      }
      if (Array.isArray(value)) {
        return value.length <= length
      }
      return false
    },
  }
}

/**
 * Pattern/Regex validation rule
 */
export function pattern(regex: string | RegExp, message?: string): ValidationRuleDefinition {
  const regexPattern = typeof regex === 'string' ? new RegExp(regex) : regex

  return {
    name: 'pattern',
    params: { pattern: regexPattern.source },
    message: message ?? 'The :attribute format is invalid',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      return typeof value === 'string' && regexPattern.test(value)
    },
  }
}

/**
 * One of (enum) validation rule
 */
export function oneOf<T>(values: T[], message?: string): ValidationRuleDefinition {
  return {
    name: 'oneOf',
    params: { values },
    message: message ?? 'The :attribute must be one of: ' + values.join(', '),
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      return values.includes(value as T)
    },
  }
}

/**
 * Custom validation rule wrapper
 */
export function custom(
  validator: (value: unknown, context: ValidationContext) => boolean | string,
  name: string = 'custom',
  message?: string,
): ValidationRuleDefinition {
  return {
    name,
    message,
    rule: (value: unknown, context: ValidationContext) => {
      const result = validator(value, context)
      if (typeof result === 'string') {
        return { valid: false, message: result }
      }
      return { valid: result }
    },
  }
}

/**
 * Unique validation rule (requires async implementation)
 * This returns a placeholder that should be used with async validator
 */
export function unique(
  _checkFn?: (value: unknown, context: ValidationContext) => Promise<boolean>,
  message?: string,
): ValidationRuleDefinition {
  return {
    name: 'unique',
    message: message ?? 'The :attribute has already been taken',
    rule: () => {
      // Sync version always passes - actual check done in async validator
      return true
    },
  }
}

/**
 * Array validation rule
 */
export function array(message?: string): ValidationRuleDefinition {
  return {
    name: 'array',
    message: message ?? 'The :attribute must be an array',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      return Array.isArray(value)
    },
  }
}

/**
 * Object validation rule
 */
export function object(message?: string): ValidationRuleDefinition {
  return {
    name: 'object',
    message: message ?? 'The :attribute must be an object',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      return typeof value === 'object' && !Array.isArray(value)
    },
  }
}

/**
 * Date validation rule
 */
export function date(message?: string): ValidationRuleDefinition {
  return {
    name: 'date',
    message: message ?? 'The :attribute must be a valid date',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      if (value instanceof Date) {
        return !Number.isNaN(value.getTime())
      }
      if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value)
        return !Number.isNaN(d.getTime())
      }
      return false
    },
  }
}

/**
 * Integer validation rule
 */
export function integer(message?: string): ValidationRuleDefinition {
  return {
    name: 'integer',
    message: message ?? 'The :attribute must be an integer',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      if (typeof value === 'number') {
        return Number.isInteger(value)
      }
      if (typeof value === 'string') {
        const num = Number(value)
        return !Number.isNaN(num) && Number.isInteger(num)
      }
      return false
    },
  }
}

/**
 * Positive number validation rule
 */
export function positive(message?: string): ValidationRuleDefinition {
  return {
    name: 'positive',
    message: message ?? 'The :attribute must be a positive number',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      const num = typeof value === 'number' ? value : Number(value)
      return !Number.isNaN(num) && num > 0
    },
  }
}

/**
 * Negative number validation rule
 */
export function negative(message?: string): ValidationRuleDefinition {
  return {
    name: 'negative',
    message: message ?? 'The :attribute must be a negative number',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      const num = typeof value === 'number' ? value : Number(value)
      return !Number.isNaN(num) && num < 0
    },
  }
}

/**
 * Between validation rule (for numbers)
 */
export function between(minVal: number, maxVal: number, message?: string): ValidationRuleDefinition {
  return {
    name: 'between',
    params: { min: minVal, max: maxVal },
    message: message ?? 'The :attribute must be between :min and :max',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      const num = typeof value === 'number' ? value : Number(value)
      return !Number.isNaN(num) && num >= minVal && num <= maxVal
    },
  }
}

/**
 * Confirmed validation rule (value must match another field)
 */
export function confirmed(fieldName?: string, message?: string): ValidationRuleDefinition {
  return {
    name: 'confirmed',
    params: { field: fieldName },
    message: message ?? 'The :attribute confirmation does not match',
    rule: (value: unknown, context: ValidationContext): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      const confirmField = fieldName ?? `${context.attribute}_confirmation`
      return value === context.data[confirmField]
    },
  }
}

/**
 * Different validation rule (value must be different from another field)
 */
export function different(fieldName: string, message?: string): ValidationRuleDefinition {
  return {
    name: 'different',
    params: { field: fieldName },
    message: message ?? 'The :attribute and :field must be different',
    rule: (value: unknown, context: ValidationContext): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      return value !== context.data[fieldName]
    },
  }
}

/**
 * Same validation rule (value must be same as another field)
 */
export function same(fieldName: string, message?: string): ValidationRuleDefinition {
  return {
    name: 'same',
    params: { field: fieldName },
    message: message ?? 'The :attribute and :field must match',
    rule: (value: unknown, context: ValidationContext): boolean => {
      if (value === undefined || value === null) {
        return true
      }
      return value === context.data[fieldName]
    },
  }
}

/**
 * Nullable validation rule (allows null values)
 */
export function nullable(): ValidationRuleDefinition {
  return {
    name: 'nullable',
    rule: (): boolean => true, // Always passes, marks field as nullable
  }
}

/**
 * Sometimes validation rule (only validate if present)
 */
export function sometimes(): ValidationRuleDefinition {
  return {
    name: 'sometimes',
    rule: (value: unknown): boolean => {
      // Always passes - other rules should check for undefined
      return true
    },
  }
}

/**
 * Alpha validation rule
 */
export function alpha(message?: string): ValidationRuleDefinition {
  return {
    name: 'alpha',
    message: message ?? 'The :attribute may only contain letters',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      return typeof value === 'string' && /^[a-zA-Z]+$/.test(value)
    },
  }
}

/**
 * Alpha numeric validation rule
 */
export function alphaNumeric(message?: string): ValidationRuleDefinition {
  return {
    name: 'alphaNumeric',
    message: message ?? 'The :attribute may only contain letters and numbers',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      return typeof value === 'string' && /^[a-zA-Z0-9]+$/.test(value)
    },
  }
}

/**
 * Alpha dash validation rule (letters, numbers, dashes, underscores)
 */
export function alphaDash(message?: string): ValidationRuleDefinition {
  return {
    name: 'alphaDash',
    message: message ?? 'The :attribute may only contain letters, numbers, dashes, and underscores',
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value)
    },
  }
}

/**
 * Starts with validation rule
 */
export function startsWith(prefix: string | string[], message?: string): ValidationRuleDefinition {
  const prefixes = Array.isArray(prefix) ? prefix : [prefix]

  return {
    name: 'startsWith',
    params: { prefix: prefixes },
    message: message ?? 'The :attribute must start with one of: ' + prefixes.join(', '),
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      if (typeof value !== 'string') {
        return false
      }
      return prefixes.some(p => value.startsWith(p))
    },
  }
}

/**
 * Ends with validation rule
 */
export function endsWith(suffix: string | string[], message?: string): ValidationRuleDefinition {
  const suffixes = Array.isArray(suffix) ? suffix : [suffix]

  return {
    name: 'endsWith',
    params: { suffix: suffixes },
    message: message ?? 'The :attribute must end with one of: ' + suffixes.join(', '),
    rule: (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') {
        return true
      }
      if (typeof value !== 'string') {
        return false
      }
      return suffixes.some(s => value.endsWith(s))
    },
  }
}

/**
 * Rules collection type
 */
export interface RulesCollection {
  required: typeof required
  string: typeof string
  number: typeof number
  boolean: typeof boolean
  email: typeof email
  url: typeof url
  uuid: typeof uuid
  min: typeof min
  max: typeof max
  minLength: typeof minLength
  maxLength: typeof maxLength
  pattern: typeof pattern
  oneOf: typeof oneOf
  custom: typeof custom
  unique: typeof unique
  array: typeof array
  object: typeof object
  date: typeof date
  integer: typeof integer
  positive: typeof positive
  negative: typeof negative
  between: typeof between
  confirmed: typeof confirmed
  different: typeof different
  same: typeof same
  nullable: typeof nullable
  sometimes: typeof sometimes
  alpha: typeof alpha
  alphaNumeric: typeof alphaNumeric
  alphaDash: typeof alphaDash
  startsWith: typeof startsWith
  endsWith: typeof endsWith
}

/**
 * Export all rules as an object
 */
export const rules: RulesCollection = {
  required,
  string,
  number,
  boolean,
  email,
  url,
  uuid,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  oneOf,
  custom,
  unique,
  array,
  object,
  date,
  integer,
  positive,
  negative,
  between,
  confirmed,
  different,
  same,
  nullable,
  sometimes,
  alpha,
  alphaNumeric,
  alphaDash,
  startsWith,
  endsWith,
}
