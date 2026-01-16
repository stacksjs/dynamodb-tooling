// ============================================================================
// Async Validator - Asynchronous Validation Engine
// ============================================================================

import type { ValidationContext, ValidationResult, ValidatorOptions } from './Validator'
import { ValidationFailedError } from './Validator'

/**
 * Async validation context (extends base context)
 */
export interface AsyncValidationContext extends ValidationContext {
  /** Abort signal for cancellation */
  signal?: AbortSignal
  /** Timeout in milliseconds */
  timeout?: number
}

/**
 * Async validation rule function signature
 */
export type AsyncValidationRule<T = unknown> = (
  value: T,
  context: AsyncValidationContext,
) => Promise<ValidationResult | boolean | string | undefined> | ValidationResult | boolean | string | undefined

/**
 * Async rule definition
 */
export interface AsyncValidationRuleDefinition {
  /** Rule name */
  name: string
  /** The async validation rule function */
  rule: AsyncValidationRule
  /** Rule parameters */
  params?: Record<string, unknown>
  /** Custom error message override */
  message?: string
  /** Timeout for this specific rule (ms) */
  timeout?: number
  /** Whether this rule can run in parallel with others */
  parallel?: boolean
}

/**
 * Async validator options
 */
export interface AsyncValidatorOptions extends ValidatorOptions {
  /** Default timeout for async rules (ms) */
  defaultTimeout?: number
  /** Run rules in parallel where possible */
  parallel?: boolean
  /** Maximum concurrent validations */
  maxConcurrency?: number
}

/**
 * Async validation result
 */
export interface AsyncFullValidationResult {
  /** Whether all validations passed */
  valid: boolean
  /** Errors by attribute name */
  errors: Record<string, string[]>
  /** First error message */
  firstError?: string
  /** Total validation time in ms */
  duration: number
}

/**
 * Async validator for handling asynchronous validation rules
 * Supports database lookups, API calls, and other async operations
 */
export class AsyncValidator {
  private rules: Map<string, AsyncValidationRuleDefinition[]> = new Map()
  private options: AsyncValidatorOptions

  constructor(options?: AsyncValidatorOptions) {
    this.options = {
      stopOnFirstError: true,
      defaultTimeout: 5000,
      parallel: true,
      maxConcurrency: 10,
      messages: {},
      attributeNames: {},
      ...options,
    }
  }

  /**
   * Add an async validation rule for an attribute
   */
  addRule(
    attribute: string,
    ruleDef: AsyncValidationRuleDefinition | AsyncValidationRule,
    message?: string,
  ): this {
    const rules = this.rules.get(attribute) || []

    if (typeof ruleDef === 'function') {
      rules.push({
        name: 'asyncCustom',
        rule: ruleDef,
        message,
        parallel: true,
      })
    }
    else {
      rules.push({
        ...ruleDef,
        message: message ?? ruleDef.message,
      })
    }

    this.rules.set(attribute, rules)
    return this
  }

  /**
   * Add multiple rules for an attribute
   */
  addRules(attribute: string, rules: Array<AsyncValidationRuleDefinition | AsyncValidationRule>): this {
    for (const rule of rules) {
      this.addRule(attribute, rule)
    }
    return this
  }

  /**
   * Set rules for multiple attributes at once
   */
  setRules(rules: Record<string, Array<AsyncValidationRuleDefinition | AsyncValidationRule>>): this {
    for (const [attribute, attributeRules] of Object.entries(rules)) {
      this.addRules(attribute, attributeRules)
    }
    return this
  }

  /**
   * Validate a single value asynchronously
   */
  async validateValue(
    value: unknown,
    attribute: string,
    data: Record<string, unknown> = {},
    modelType?: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const rules = this.rules.get(attribute) || []
    const errors: string[] = []
    const context: AsyncValidationContext = {
      attribute,
      data,
      modelType,
      options: this.options.messages,
      signal,
      timeout: this.options.defaultTimeout,
    }

    // Group rules by parallel capability
    const parallelRules = rules.filter(r => r.parallel !== false)
    const sequentialRules = rules.filter(r => r.parallel === false)

    // Run parallel rules
    if (this.options.parallel && parallelRules.length > 0) {
      const parallelResults = await this.runParallel(
        parallelRules,
        value,
        context,
        attribute,
      )
      errors.push(...parallelResults)

      if (errors.length > 0 && this.options.stopOnFirstError) {
        return errors
      }
    }

    // Run sequential rules
    for (const ruleDef of sequentialRules) {
      if (signal?.aborted) {
        throw new Error('Validation aborted')
      }

      const result = await this.executeRule(ruleDef, value, context)
      const validationResult = this.normalizeResult(result, ruleDef, attribute)

      if (!validationResult.valid) {
        errors.push(validationResult.message || `${attribute} validation failed`)

        if (this.options.stopOnFirstError) {
          break
        }
      }
    }

    return errors
  }

  /**
   * Validate all data asynchronously
   */
  async validate(
    data: Record<string, unknown>,
    modelType?: string,
    signal?: AbortSignal,
  ): Promise<AsyncFullValidationResult> {
    const startTime = Date.now()
    const errors: Record<string, string[]> = {}
    let firstError: string | undefined

    // Collect all attribute validations
    const attributeValidations: Array<Promise<{ attribute: string, errors: string[] }>> = []

    for (const [attribute, rules] of this.rules) {
      if (rules.length === 0)
        continue

      const value = data[attribute]
      const validation = this.validateValue(value, attribute, data, modelType, signal)
        .then(errors => ({ attribute, errors }))
        .catch(error => ({
          attribute,
          errors: [error instanceof Error ? error.message : String(error)],
        }))

      attributeValidations.push(validation)
    }

    // Run all attribute validations (potentially in parallel)
    if (this.options.parallel) {
      const results = await this.runWithConcurrencyLimit(
        attributeValidations,
        this.options.maxConcurrency || 10,
      )

      for (const { attribute, errors: attrErrors } of results) {
        if (attrErrors.length > 0) {
          errors[attribute] = attrErrors
          if (!firstError) {
            firstError = attrErrors[0]
          }
        }
      }
    }
    else {
      for (const validation of attributeValidations) {
        const { attribute, errors: attrErrors } = await validation

        if (attrErrors.length > 0) {
          errors[attribute] = attrErrors
          if (!firstError) {
            firstError = attrErrors[0]
          }
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      firstError,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Check if data passes validation (throws on failure)
   */
  async validateOrThrow(
    data: Record<string, unknown>,
    modelType?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const result = await this.validate(data, modelType, signal)
    if (!result.valid) {
      throw new ValidationFailedError(result.errors, modelType)
    }
  }

  /**
   * Execute a single rule with timeout support
   */
  private async executeRule(
    ruleDef: AsyncValidationRuleDefinition,
    value: unknown,
    context: AsyncValidationContext,
  ): Promise<ValidationResult | boolean | string | undefined> {
    const timeout = ruleDef.timeout ?? this.options.defaultTimeout ?? 5000

    const rulePromise = Promise.resolve(ruleDef.rule(value, context))

    if (timeout <= 0) {
      return rulePromise
    }

    return Promise.race([
      rulePromise,
      new Promise<ValidationResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Validation rule '${ruleDef.name}' timed out after ${timeout}ms`))
        }, timeout)
      }),
    ])
  }

  /**
   * Run rules in parallel with concurrency limit
   */
  private async runParallel(
    rules: AsyncValidationRuleDefinition[],
    value: unknown,
    context: AsyncValidationContext,
    attribute: string,
  ): Promise<string[]> {
    const errors: string[] = []

    const promises = rules.map(async (ruleDef) => {
      try {
        const result = await this.executeRule(ruleDef, value, context)
        const validationResult = this.normalizeResult(result, ruleDef, attribute)
        return validationResult
      }
      catch (error) {
        return {
          valid: false,
          message: error instanceof Error ? error.message : String(error),
          code: ruleDef.name,
        }
      }
    })

    const results = await Promise.all(promises)

    for (const result of results) {
      if (!result.valid) {
        errors.push(result.message || `${attribute} validation failed`)
        if (this.options.stopOnFirstError) {
          break
        }
      }
    }

    return errors
  }

  /**
   * Run promises with concurrency limit
   */
  private async runWithConcurrencyLimit<T>(
    promises: Promise<T>[],
    limit: number,
  ): Promise<T[]> {
    const results: T[] = []
    const executing: Promise<void>[] = []

    for (const promise of promises) {
      const p = promise.then((result) => {
        results.push(result)
      })

      executing.push(p)

      if (executing.length >= limit) {
        await Promise.race(executing)
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          // Check if promise is settled
          const race = Promise.race([
            executing[i].then(() => true),
            Promise.resolve(false),
          ])
          if (await race) {
            executing.splice(i, 1)
          }
        }
      }
    }

    // Wait for all remaining
    await Promise.all(executing)

    return results
  }

  /**
   * Normalize rule result to ValidationResult
   */
  private normalizeResult(
    result: ValidationResult | boolean | string | undefined,
    ruleDef: AsyncValidationRuleDefinition,
    attribute: string,
  ): ValidationResult {
    if (result === undefined || result === true) {
      return { valid: true }
    }

    if (result === false) {
      return {
        valid: false,
        message: this.formatMessage(ruleDef, attribute),
        code: ruleDef.name,
      }
    }

    if (typeof result === 'string') {
      return {
        valid: false,
        message: result,
        code: ruleDef.name,
      }
    }

    return {
      ...result,
      message: result.message || this.formatMessage(ruleDef, attribute),
      code: result.code || ruleDef.name,
    }
  }

  /**
   * Format error message
   */
  private formatMessage(ruleDef: AsyncValidationRuleDefinition, attribute: string): string {
    let message = ruleDef.message

    if (!message && this.options.messages?.[ruleDef.name]) {
      message = this.options.messages[ruleDef.name]
    }

    if (!message) {
      message = `The ${attribute} field failed ${ruleDef.name} validation`
    }

    const displayName = this.options.attributeNames?.[attribute] || attribute
    message = message.replace(/:attribute/g, displayName)

    if (ruleDef.params) {
      for (const [key, value] of Object.entries(ruleDef.params)) {
        message = message.replace(new RegExp(`:${key}`, 'g'), String(value))
      }
    }

    return message
  }

  /**
   * Get all registered rules
   */
  getRules(): Map<string, AsyncValidationRuleDefinition[]> {
    return new Map(this.rules)
  }

  /**
   * Clear all rules
   */
  clearRules(): this {
    this.rules.clear()
    return this
  }

  /**
   * Remove rules for a specific attribute
   */
  removeRules(attribute: string): this {
    this.rules.delete(attribute)
    return this
  }
}

/**
 * Create a new async validator instance
 */
export function createAsyncValidator(options?: AsyncValidatorOptions): AsyncValidator {
  return new AsyncValidator(options)
}

// ============================================================================
// Built-in Async Rules
// ============================================================================

/**
 * Create a unique validation rule that checks database uniqueness
 */
export function uniqueAsync<T>(
  checkFn: (value: T, context: AsyncValidationContext) => Promise<boolean>,
  message?: string,
): AsyncValidationRuleDefinition {
  return {
    name: 'unique',
    rule: async (value: unknown, context) => {
      if (value === undefined || value === null || value === '') {
        return true // Let required rule handle empty values
      }
      const isUnique = await checkFn(value as T, context)
      return isUnique || message || `The :attribute has already been taken`
    },
    message,
    parallel: false, // Database checks should be sequential
  }
}

/**
 * Create an exists validation rule that checks if a value exists in database
 */
export function existsAsync<T>(
  checkFn: (value: T, context: AsyncValidationContext) => Promise<boolean>,
  message?: string,
): AsyncValidationRuleDefinition {
  return {
    name: 'exists',
    rule: async (value: unknown, context) => {
      if (value === undefined || value === null || value === '') {
        return true // Let required rule handle empty values
      }
      const exists = await checkFn(value as T, context)
      return exists || message || `The selected :attribute is invalid`
    },
    message,
    parallel: false,
  }
}

/**
 * Create a debounced validation rule for expensive operations
 */
export function debouncedAsync<T>(
  rule: AsyncValidationRule<T>,
  debounceMs: number = 300,
): AsyncValidationRule<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastValue: T | undefined
  let lastResult: Promise<ValidationResult | boolean | string | undefined> | undefined

  return async (value: T, context) => {
    // Return cached result if value hasn't changed
    if (value === lastValue && lastResult !== undefined) {
      return lastResult
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Create debounced promise
    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        lastValue = value
        lastResult = Promise.resolve(rule(value, context))
        resolve(await lastResult)
      }, debounceMs)
    })
  }
}

/**
 * Create a cached validation rule
 */
export function cachedAsync<T>(
  rule: AsyncValidationRule<T>,
  ttlMs: number = 60000,
): AsyncValidationRule<T> {
  const cache = new Map<string, { result: ValidationResult | boolean | string | undefined, timestamp: number }>()

  return async (value: T, context) => {
    const cacheKey = JSON.stringify(value)
    const cached = cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.result
    }

    const result = await rule(value, context)
    cache.set(cacheKey, { result, timestamp: Date.now() })

    // Clean old entries
    if (cache.size > 1000) {
      const now = Date.now()
      for (const [key, entry] of cache) {
        if (now - entry.timestamp > ttlMs) {
          cache.delete(key)
        }
      }
    }

    return result
  }
}
