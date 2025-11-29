// ============================================================================
// Core Validator - Synchronous Validation Engine
// ============================================================================

/**
 * Validation context passed to rules
 */
export interface ValidationContext {
  /** The attribute name being validated */
  attribute: string
  /** All attributes being validated (for cross-field validation) */
  data: Record<string, unknown>
  /** The model type (if available) */
  modelType?: string
  /** Custom options passed to the validator */
  options?: Record<string, unknown>
}

/**
 * Result of a validation rule
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean
  /** Error message if validation failed */
  message?: string
  /** Error code for programmatic handling */
  code?: string
}

/**
 * Validation rule function signature
 */
export type ValidationRule<T = unknown> = (
  value: T,
  context: ValidationContext,
) => ValidationResult | boolean | string | undefined

/**
 * Rule definition with name, rule function, and optional parameters
 */
export interface ValidationRuleDefinition {
  /** Rule name (e.g., 'required', 'email', 'min') */
  name: string
  /** The validation rule function */
  rule: ValidationRule
  /** Rule parameters (e.g., { min: 5 } for min length) */
  params?: Record<string, unknown>
  /** Custom error message override */
  message?: string
}

/**
 * Validator options
 */
export interface ValidatorOptions {
  /** Stop validation on first error per attribute */
  stopOnFirstError?: boolean
  /** Custom error messages by rule name */
  messages?: Record<string, string>
  /** Attribute display names for error messages */
  attributeNames?: Record<string, string>
}

/**
 * Full validation result for an entity
 */
export interface FullValidationResult {
  /** Whether all validations passed */
  valid: boolean
  /** Errors by attribute name */
  errors: Record<string, string[]>
  /** First error message (convenience) */
  firstError?: string
}

/**
 * Core synchronous validator
 */
export class Validator {
  private rules: Map<string, ValidationRuleDefinition[]> = new Map()
  private options: ValidatorOptions

  constructor(options?: ValidatorOptions) {
    this.options = {
      stopOnFirstError: true,
      messages: {},
      attributeNames: {},
      ...options,
    }
  }

  /**
   * Add a validation rule for an attribute
   */
  addRule(
    attribute: string,
    ruleDef: ValidationRuleDefinition | ValidationRule,
    message?: string,
  ): this {
    const rules = this.rules.get(attribute) || []

    if (typeof ruleDef === 'function') {
      rules.push({
        name: 'custom',
        rule: ruleDef,
        message,
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
  addRules(attribute: string, rules: Array<ValidationRuleDefinition | ValidationRule>): this {
    for (const rule of rules) {
      this.addRule(attribute, rule)
    }
    return this
  }

  /**
   * Set rules for multiple attributes at once
   */
  setRules(rules: Record<string, Array<ValidationRuleDefinition | ValidationRule>>): this {
    for (const [attribute, attributeRules] of Object.entries(rules)) {
      this.addRules(attribute, attributeRules)
    }
    return this
  }

  /**
   * Validate a single value
   */
  validateValue(
    value: unknown,
    attribute: string,
    data: Record<string, unknown> = {},
    modelType?: string,
  ): string[] {
    const rules = this.rules.get(attribute) || []
    const errors: string[] = []
    const context: ValidationContext = {
      attribute,
      data,
      modelType,
      options: this.options.messages,
    }

    for (const ruleDef of rules) {
      const result = ruleDef.rule(value, context)
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
   * Validate all data
   */
  validate(
    data: Record<string, unknown>,
    modelType?: string,
  ): FullValidationResult {
    const errors: Record<string, string[]> = {}
    let firstError: string | undefined

    for (const [attribute, rules] of this.rules) {
      if (rules.length === 0) continue

      const value = data[attribute]
      const attributeErrors = this.validateValue(value, attribute, data, modelType)

      if (attributeErrors.length > 0) {
        errors[attribute] = attributeErrors
        if (!firstError) {
          firstError = attributeErrors[0]
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      firstError,
    }
  }

  /**
   * Check if data passes validation (throws on failure)
   */
  validateOrThrow(
    data: Record<string, unknown>,
    modelType?: string,
  ): void {
    const result = this.validate(data, modelType)
    if (!result.valid) {
      const error = new ValidationFailedError(result.errors, modelType)
      throw error
    }
  }

  /**
   * Normalize rule result to ValidationResult
   */
  private normalizeResult(
    result: ValidationResult | boolean | string | undefined,
    ruleDef: ValidationRuleDefinition,
    attribute: string,
  ): ValidationResult {
    // Undefined or true means valid
    if (result === undefined || result === true) {
      return { valid: true }
    }

    // False means invalid with default message
    if (result === false) {
      return {
        valid: false,
        message: this.formatMessage(ruleDef, attribute),
        code: ruleDef.name,
      }
    }

    // String is an error message
    if (typeof result === 'string') {
      return {
        valid: false,
        message: result,
        code: ruleDef.name,
      }
    }

    // Full ValidationResult object
    return {
      ...result,
      message: result.message || this.formatMessage(ruleDef, attribute),
      code: result.code || ruleDef.name,
    }
  }

  /**
   * Format error message with attribute name and parameters
   */
  private formatMessage(ruleDef: ValidationRuleDefinition, attribute: string): string {
    // Check for custom message in rule definition
    let message = ruleDef.message

    // Check for global custom message by rule name
    if (!message && this.options.messages?.[ruleDef.name]) {
      message = this.options.messages[ruleDef.name]
    }

    // Default message
    if (!message) {
      message = `The ${attribute} field failed ${ruleDef.name} validation`
    }

    // Replace placeholders
    const displayName = this.options.attributeNames?.[attribute] || attribute
    message = message.replace(/:attribute/g, displayName)

    // Replace parameter placeholders
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
  getRules(): Map<string, ValidationRuleDefinition[]> {
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
 * Validation failed error
 */
export class ValidationFailedError extends Error {
  public readonly errors: Record<string, string[]>
  public readonly modelType?: string

  constructor(errors: Record<string, string[]>, modelType?: string) {
    const messages = Object.entries(errors)
      .flatMap(([_, msgs]) => msgs)
      .join('; ')
    super(`Validation failed: ${messages}`)
    this.name = 'ValidationFailedError'
    this.errors = errors
    this.modelType = modelType
  }

  /**
   * Get errors for a specific attribute
   */
  getErrors(attribute: string): string[] {
    return this.errors[attribute] || []
  }

  /**
   * Get first error message
   */
  getFirstError(): string | undefined {
    for (const errors of Object.values(this.errors)) {
      if (errors.length > 0) {
        return errors[0]
      }
    }
    return undefined
  }

  /**
   * Check if attribute has errors
   */
  hasErrors(attribute?: string): boolean {
    if (attribute) {
      return (this.errors[attribute]?.length || 0) > 0
    }
    return Object.keys(this.errors).length > 0
  }
}

/**
 * Create a new validator instance
 */
export function createValidator(options?: ValidatorOptions): Validator {
  return new Validator(options)
}
