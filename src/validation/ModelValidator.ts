// ============================================================================
// Model Validator - Integration with Model System
// ============================================================================

import type { ModelAttribute } from '../models/types'
import { AsyncValidator, type AsyncValidationRuleDefinition } from './AsyncValidator'
import { rules } from './rules'
import { TsValidationRules } from './TsValidationIntegration'
import { type ValidationRuleDefinition, Validator } from './Validator'

/**
 * Model validation options
 */
export interface ModelValidationOptions {
  /** Model type name for error messages */
  modelType?: string
  /** Stop on first error per attribute */
  stopOnFirstError?: boolean
  /** Custom error messages */
  messages?: Record<string, string>
  /** Whether to run async validations */
  runAsync?: boolean
  /** Timeout for async validations (ms) */
  asyncTimeout?: number
  /** Skip validation for these attributes */
  except?: string[]
  /** Only validate these attributes */
  only?: string[]
}

/**
 * Model validation result
 */
export interface ModelValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Errors by attribute name */
  errors: Record<string, string[]>
  /** First error message */
  firstError?: string
  /** Validation duration (ms) */
  duration?: number
}

/**
 * Parsed validation rule from string
 */
interface ParsedRule {
  name: string
  params: unknown[]
}

/**
 * Model validator that integrates with the model system
 */
export class ModelValidator {
  private syncValidator: Validator
  private asyncValidator: AsyncValidator
  private tsValidation: TsValidationRules
  private customAsyncRules: Map<string, AsyncValidationRuleDefinition[]> = new Map()
  private options: ModelValidationOptions

  constructor(options?: ModelValidationOptions) {
    this.options = {
      stopOnFirstError: true,
      runAsync: true,
      asyncTimeout: 5000,
      ...options,
    }

    this.syncValidator = new Validator({
      stopOnFirstError: this.options.stopOnFirstError,
      messages: this.options.messages,
    })

    this.asyncValidator = new AsyncValidator({
      stopOnFirstError: this.options.stopOnFirstError,
      defaultTimeout: this.options.asyncTimeout,
      messages: this.options.messages,
    })

    this.tsValidation = new TsValidationRules()
  }

  /**
   * Add async validation rules for an attribute
   */
  addAsyncRule(attribute: string, rule: AsyncValidationRuleDefinition): this {
    const existingRules = this.customAsyncRules.get(attribute) || []
    existingRules.push(rule)
    this.customAsyncRules.set(attribute, existingRules)
    return this
  }

  /**
   * Configure validation from model attributes
   */
  fromModelAttributes(attributes: Record<string, ModelAttribute>): this {
    for (const [name, attr] of Object.entries(attributes)) {
      const validationRules = this.parseValidationRules(attr)

      if (validationRules.length > 0) {
        this.syncValidator.addRules(name, validationRules)
      }
    }

    return this
  }

  /**
   * Parse validation rules from attribute definition
   */
  private parseValidationRules(attr: ModelAttribute): ValidationRuleDefinition[] {
    const validationRules: ValidationRuleDefinition[] = []

    // Handle required attribute
    if (attr.required) {
      validationRules.push(rules.required())
    }

    // Handle type-based validation
    if (attr.type) {
      const typeRule = this.getTypeRule(attr.type)
      if (typeRule) {
        validationRules.push(typeRule)
      }
    }

    // Handle validation string/array
    if (attr.validation) {
      const validations = Array.isArray(attr.validation) ? attr.validation : [attr.validation]

      for (const validation of validations) {
        const parsed = this.parseValidationString(validation)
        const rule = this.createRuleFromParsed(parsed)
        if (rule) {
          validationRules.push(rule)
        }
      }
    }

    return validationRules
  }

  /**
   * Get validation rule for attribute type
   */
  private getTypeRule(type: string): ValidationRuleDefinition | null {
    switch (type) {
      case 'string':
        return rules.string()
      case 'number':
        return rules.number()
      case 'boolean':
        return rules.boolean()
      case 'date':
        return this.tsValidation.date()
      case 'json':
        return this.tsValidation.json()
      default:
        return null
    }
  }

  /**
   * Parse a validation string like "min:5" or "email"
   */
  private parseValidationString(validation: string): ParsedRule {
    const [name, ...paramParts] = validation.split(':')
    const params = paramParts.length > 0
      ? paramParts.join(':').split(',').map((p) => {
          // Try to parse as number
          const num = Number(p)
          return Number.isNaN(num) ? p : num
        })
      : []

    return { name, params }
  }

  /**
   * Create a validation rule from parsed string
   */
  private createRuleFromParsed(parsed: ParsedRule): ValidationRuleDefinition | null {
    const { name, params } = parsed

    // Check built-in rules first
    switch (name) {
      case 'required':
        return rules.required()
      case 'string':
        return rules.string()
      case 'number':
        return rules.number()
      case 'boolean':
        return rules.boolean()
      case 'min':
        return rules.min(params[0] as number)
      case 'max':
        return rules.max(params[0] as number)
      case 'minLength':
      case 'min_length':
        return rules.minLength(params[0] as number)
      case 'maxLength':
      case 'max_length':
        return rules.maxLength(params[0] as number)
      case 'pattern':
      case 'regex':
        return rules.pattern(params[0] as string)
      case 'oneOf':
      case 'in':
        return rules.oneOf(params)

      // ts-validation rules
      case 'email':
        return this.tsValidation.email()
      case 'url':
        return this.tsValidation.url()
      case 'uuid':
        return this.tsValidation.uuid(params[0] as 3 | 4 | 5 | 'all' | undefined)
      case 'ip':
        return this.tsValidation.ip(params[0] as 4 | 6 | undefined)
      case 'alpha':
        return this.tsValidation.alpha(params[0] as string | undefined)
      case 'alphanumeric':
        return this.tsValidation.alphanumeric(params[0] as string | undefined)
      case 'numeric':
        return this.tsValidation.numeric()
      case 'date':
        return this.tsValidation.date()
      case 'json':
        return this.tsValidation.json()
      case 'creditCard':
      case 'credit_card':
        return this.tsValidation.creditCard()
      case 'strongPassword':
      case 'strong_password':
        return this.tsValidation.strongPassword()
      case 'slug':
        return this.tsValidation.slug()
      case 'semVer':
      case 'semver':
        return this.tsValidation.semVer()
      case 'base64':
        return this.tsValidation.base64()
      case 'mongoId':
      case 'mongo_id':
        return this.tsValidation.mongoId()
      case 'iban':
        return this.tsValidation.iban()
      case 'jwt':
        return this.tsValidation.jwt()
      case 'hexColor':
      case 'hex_color':
        return this.tsValidation.hexColor()
      case 'latLong':
      case 'lat_long':
        return this.tsValidation.latLong()
      case 'mobilePhone':
      case 'mobile_phone':
      case 'phone':
        return this.tsValidation.mobilePhone(params[0] as string | undefined)
      case 'postalCode':
      case 'postal_code':
        return this.tsValidation.postalCode(params[0] as string | undefined)

      default:
        // Try to create from ts-validation
        try {
          return this.tsValidation.createRule(name as Parameters<typeof this.tsValidation.createRule>[0])
        }
        catch {
          console.warn(`Unknown validation rule: ${name}`)
          return null
        }
    }
  }

  /**
   * Validate data against model attributes
   */
  async validate(
    data: Record<string, unknown>,
    attributes?: Record<string, ModelAttribute>,
  ): Promise<ModelValidationResult> {
    const startTime = Date.now()

    // Filter attributes based on only/except before configuring
    if (attributes) {
      let filteredAttributes: Record<string, ModelAttribute> = attributes
      if (this.options.only) {
        filteredAttributes = {}
        for (const key of this.options.only) {
          if (key in attributes) {
            filteredAttributes[key] = attributes[key]
          }
        }
      }
      else if (this.options.except) {
        filteredAttributes = { ...attributes }
        for (const key of this.options.except) {
          delete filteredAttributes[key]
        }
      }
      this.fromModelAttributes(filteredAttributes)
    }

    // Run synchronous validation first
    const syncResult = this.syncValidator.validate(data, this.options.modelType)

    if (!syncResult.valid && this.options.stopOnFirstError) {
      return {
        valid: false,
        errors: syncResult.errors,
        firstError: syncResult.firstError,
        duration: Date.now() - startTime,
      }
    }

    // Run async validation if enabled and there are async rules
    if (this.options.runAsync && this.customAsyncRules.size > 0) {
      // Add custom async rules
      for (const [attr, asyncRules] of this.customAsyncRules) {
        this.asyncValidator.addRules(attr, asyncRules)
      }

      const asyncResult = await this.asyncValidator.validate(
        data,
        this.options.modelType,
      )

      // Merge errors
      const mergedErrors = { ...syncResult.errors }
      for (const [attr, errors] of Object.entries(asyncResult.errors)) {
        if (mergedErrors[attr]) {
          mergedErrors[attr] = [...mergedErrors[attr], ...errors]
        }
        else {
          mergedErrors[attr] = errors
        }
      }

      const firstError = syncResult.firstError || asyncResult.firstError

      return {
        valid: Object.keys(mergedErrors).length === 0,
        errors: mergedErrors,
        firstError,
        duration: Date.now() - startTime,
      }
    }

    return {
      valid: syncResult.valid,
      errors: syncResult.errors,
      firstError: syncResult.firstError,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Validate and throw on failure
   */
  async validateOrThrow(
    data: Record<string, unknown>,
    attributes?: Record<string, ModelAttribute>,
  ): Promise<void> {
    const result = await this.validate(data, attributes)
    if (!result.valid) {
      throw new ModelValidationError(
        this.options.modelType || 'Model',
        result.errors,
      )
    }
  }

  /**
   * Validate synchronously only (no async rules)
   */
  validateSync(
    data: Record<string, unknown>,
    attributes?: Record<string, ModelAttribute>,
  ): ModelValidationResult {
    // Filter attributes based on only/except before configuring
    if (attributes) {
      let filteredAttributes: Record<string, ModelAttribute> = attributes
      if (this.options.only) {
        filteredAttributes = {}
        for (const key of this.options.only) {
          if (key in attributes) {
            filteredAttributes[key] = attributes[key]
          }
        }
      }
      else if (this.options.except) {
        filteredAttributes = { ...attributes }
        for (const key of this.options.except) {
          delete filteredAttributes[key]
        }
      }
      this.fromModelAttributes(filteredAttributes)
    }

    const result = this.syncValidator.validate(data, this.options.modelType)

    return {
      valid: result.valid,
      errors: result.errors,
      firstError: result.firstError,
    }
  }
}

/**
 * Model validation error
 */
export class ModelValidationError extends Error {
  public readonly model: string
  public readonly errors: Record<string, string[]>

  constructor(model: string, errors: Record<string, string[]>) {
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ')
    super(`Validation failed for ${model}: ${messages}`)
    this.name = 'ModelValidationError'
    this.model = model
    this.errors = errors
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(field: string): string[] {
    return this.errors[field] || []
  }

  /**
   * Check if a field has errors
   */
  hasFieldErrors(field: string): boolean {
    return (this.errors[field]?.length || 0) > 0
  }
}

/**
 * Create a model validator
 */
export function createModelValidator(options?: ModelValidationOptions): ModelValidator {
  return new ModelValidator(options)
}

/**
 * Validate model data directly
 */
export async function validateModel(
  data: Record<string, unknown>,
  attributes: Record<string, ModelAttribute>,
  options?: ModelValidationOptions,
): Promise<ModelValidationResult> {
  const validator = new ModelValidator(options)
  return validator.validate(data, attributes)
}
