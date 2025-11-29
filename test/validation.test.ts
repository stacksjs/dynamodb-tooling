// ============================================================================
// Validation Module Tests
// ============================================================================

import { describe, expect, it } from 'bun:test'
import {
  // Core validation
  Validator,
  createValidator,
  ValidationFailedError,

  // Async validation
  AsyncValidator,
  createAsyncValidator,
  uniqueAsync,
  existsAsync,

  // Model validation
  ModelValidator,
  createModelValidator,
  validateModel,
  ModelValidationError,

  // Built-in rules
  rules,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  oneOf,
  custom,
  between,
  confirmed,
  different,
  same,
  alpha,
  alphaNumeric,
  alphaDash,
  startsWith,
  endsWith,
  integer,
  positive,
  negative,

  // ts-validation
  TsValidationRules,
  createTsValidationRule,
} from '../src/index'
import type { ModelAttribute } from '../src/models/types'

describe('Validator', () => {
  describe('basic validation', () => {
    it('should validate required fields', () => {
      const validator = createValidator()
      validator.addRule('name', required())

      const result1 = validator.validate({ name: 'John' })
      expect(result1.valid).toBe(true)

      const result2 = validator.validate({ name: '' })
      expect(result2.valid).toBe(false)
      expect(result2.errors.name).toContain('The name field is required')

      const result3 = validator.validate({})
      expect(result3.valid).toBe(false)
    })

    it('should validate string type', () => {
      const validator = createValidator()
      validator.addRule('name', rules.string())

      const result1 = validator.validate({ name: 'John' })
      expect(result1.valid).toBe(true)

      const result2 = validator.validate({ name: 123 })
      expect(result2.valid).toBe(false)
    })

    it('should validate number type', () => {
      const validator = createValidator()
      validator.addRule('age', rules.number())

      const result1 = validator.validate({ age: 25 })
      expect(result1.valid).toBe(true)

      const result2 = validator.validate({ age: '25' }) // Numeric string
      expect(result2.valid).toBe(true)

      const result3 = validator.validate({ age: 'abc' })
      expect(result3.valid).toBe(false)
    })

    it('should validate boolean type', () => {
      const validator = createValidator()
      validator.addRule('active', rules.boolean())

      expect(validator.validate({ active: true }).valid).toBe(true)
      expect(validator.validate({ active: false }).valid).toBe(true)
      expect(validator.validate({ active: 1 }).valid).toBe(true)
      expect(validator.validate({ active: '1' }).valid).toBe(true)
      expect(validator.validate({ active: 'true' }).valid).toBe(true)
    })
  })

  describe('numeric validation', () => {
    it('should validate min value', () => {
      const validator = createValidator()
      validator.addRule('age', min(18))

      expect(validator.validate({ age: 25 }).valid).toBe(true)
      expect(validator.validate({ age: 18 }).valid).toBe(true)
      expect(validator.validate({ age: 17 }).valid).toBe(false)
    })

    it('should validate max value', () => {
      const validator = createValidator()
      validator.addRule('age', max(100))

      expect(validator.validate({ age: 50 }).valid).toBe(true)
      expect(validator.validate({ age: 100 }).valid).toBe(true)
      expect(validator.validate({ age: 101 }).valid).toBe(false)
    })

    it('should validate between values', () => {
      const validator = createValidator()
      validator.addRule('score', between(0, 100))

      expect(validator.validate({ score: 50 }).valid).toBe(true)
      expect(validator.validate({ score: 0 }).valid).toBe(true)
      expect(validator.validate({ score: 100 }).valid).toBe(true)
      expect(validator.validate({ score: -1 }).valid).toBe(false)
      expect(validator.validate({ score: 101 }).valid).toBe(false)
    })

    it('should validate integer', () => {
      const validator = createValidator()
      validator.addRule('count', integer())

      expect(validator.validate({ count: 5 }).valid).toBe(true)
      expect(validator.validate({ count: 5.5 }).valid).toBe(false)
    })

    it('should validate positive/negative', () => {
      const validator = createValidator()
      validator.addRule('pos', positive())
      validator.addRule('neg', negative())

      expect(validator.validate({ pos: 5, neg: -5 }).valid).toBe(true)
      expect(validator.validate({ pos: -5, neg: -5 }).valid).toBe(false)
      expect(validator.validate({ pos: 5, neg: 5 }).valid).toBe(false)
    })
  })

  describe('string validation', () => {
    it('should validate minLength', () => {
      const validator = createValidator()
      validator.addRule('password', minLength(8))

      expect(validator.validate({ password: '12345678' }).valid).toBe(true)
      expect(validator.validate({ password: '1234567' }).valid).toBe(false)
    })

    it('should validate maxLength', () => {
      const validator = createValidator()
      validator.addRule('username', maxLength(20))

      expect(validator.validate({ username: 'john' }).valid).toBe(true)
      expect(validator.validate({ username: 'a'.repeat(21) }).valid).toBe(false)
    })

    it('should validate pattern', () => {
      const validator = createValidator()
      validator.addRule('code', pattern(/^[A-Z]{3}-\d{3}$/))

      expect(validator.validate({ code: 'ABC-123' }).valid).toBe(true)
      expect(validator.validate({ code: 'abc-123' }).valid).toBe(false)
    })

    it('should validate alpha', () => {
      const validator = createValidator()
      validator.addRule('name', alpha())

      expect(validator.validate({ name: 'John' }).valid).toBe(true)
      expect(validator.validate({ name: 'John123' }).valid).toBe(false)
    })

    it('should validate alphaNumeric', () => {
      const validator = createValidator()
      validator.addRule('username', alphaNumeric())

      expect(validator.validate({ username: 'John123' }).valid).toBe(true)
      expect(validator.validate({ username: 'John_123' }).valid).toBe(false)
    })

    it('should validate alphaDash', () => {
      const validator = createValidator()
      validator.addRule('slug', alphaDash())

      expect(validator.validate({ slug: 'my-slug_123' }).valid).toBe(true)
      expect(validator.validate({ slug: 'my slug' }).valid).toBe(false)
    })

    it('should validate startsWith', () => {
      const validator = createValidator()
      validator.addRule('url', startsWith(['http://', 'https://']))

      expect(validator.validate({ url: 'https://example.com' }).valid).toBe(true)
      expect(validator.validate({ url: 'ftp://example.com' }).valid).toBe(false)
    })

    it('should validate endsWith', () => {
      const validator = createValidator()
      validator.addRule('email', endsWith(['.com', '.org']))

      expect(validator.validate({ email: 'test@example.com' }).valid).toBe(true)
      expect(validator.validate({ email: 'test@example.net' }).valid).toBe(false)
    })
  })

  describe('oneOf validation', () => {
    it('should validate oneOf values', () => {
      const validator = createValidator()
      validator.addRule('status', oneOf(['active', 'inactive', 'pending']))

      expect(validator.validate({ status: 'active' }).valid).toBe(true)
      expect(validator.validate({ status: 'unknown' }).valid).toBe(false)
    })
  })

  describe('field comparison validation', () => {
    it('should validate confirmed', () => {
      const validator = createValidator()
      validator.addRule('password', confirmed())

      expect(validator.validate({
        password: 'secret123',
        password_confirmation: 'secret123',
      }).valid).toBe(true)

      expect(validator.validate({
        password: 'secret123',
        password_confirmation: 'different',
      }).valid).toBe(false)
    })

    it('should validate different', () => {
      const validator = createValidator()
      validator.addRule('new_password', different('old_password'))

      expect(validator.validate({
        old_password: 'old',
        new_password: 'new',
      }).valid).toBe(true)

      expect(validator.validate({
        old_password: 'same',
        new_password: 'same',
      }).valid).toBe(false)
    })

    it('should validate same', () => {
      const validator = createValidator()
      validator.addRule('confirm_email', same('email'))

      expect(validator.validate({
        email: 'test@example.com',
        confirm_email: 'test@example.com',
      }).valid).toBe(true)

      expect(validator.validate({
        email: 'test@example.com',
        confirm_email: 'other@example.com',
      }).valid).toBe(false)
    })
  })

  describe('custom validation', () => {
    it('should support custom validation function', () => {
      const validator = createValidator()
      validator.addRule('age', custom(
        (value) => {
          if (typeof value !== 'number') return 'Age must be a number'
          if (value < 0) return 'Age cannot be negative'
          if (value > 150) return 'Age seems unrealistic'
          return true
        },
        'customAge',
      ))

      expect(validator.validate({ age: 25 }).valid).toBe(true)
      expect(validator.validate({ age: -5 }).valid).toBe(false)
      expect(validator.validate({ age: 200 }).valid).toBe(false)
    })
  })

  describe('multiple rules', () => {
    it('should validate multiple rules on same field', () => {
      const validator = createValidator()
      validator.addRules('password', [
        required(),
        minLength(8),
        maxLength(50),
        pattern(/[A-Z]/),
      ])

      expect(validator.validate({ password: 'SecurePass123' }).valid).toBe(true)
      expect(validator.validate({ password: 'short' }).valid).toBe(false)
      expect(validator.validate({ password: 'alllowercase' }).valid).toBe(false)
    })

    it('should validate multiple fields', () => {
      const validator = createValidator()
      validator.setRules({
        email: [required(), rules.email()],
        age: [required(), min(18), max(100)],
        status: [oneOf(['active', 'inactive'])],
      })

      const result = validator.validate({
        email: 'test@example.com',
        age: 25,
        status: 'active',
      })
      expect(result.valid).toBe(true)

      const result2 = validator.validate({
        email: 'invalid',
        age: 15,
        status: 'unknown',
      })
      expect(result2.valid).toBe(false)
      expect(Object.keys(result2.errors)).toContain('email')
      expect(Object.keys(result2.errors)).toContain('age')
      expect(Object.keys(result2.errors)).toContain('status')
    })
  })

  describe('validateOrThrow', () => {
    it('should throw ValidationFailedError on failure', () => {
      const validator = createValidator()
      validator.addRule('name', required())

      expect(() => validator.validateOrThrow({})).toThrow(ValidationFailedError)
      expect(() => validator.validateOrThrow({ name: 'John' })).not.toThrow()
    })

    it('should include error details in exception', () => {
      const validator = createValidator()
      validator.addRule('name', required())

      try {
        validator.validateOrThrow({})
        expect(true).toBe(false) // Should not reach here
      }
      catch (e) {
        expect(e).toBeInstanceOf(ValidationFailedError)
        const error = e as ValidationFailedError
        expect(error.errors.name).toBeDefined()
        expect(error.hasErrors('name')).toBe(true)
        expect(error.getFirstError()).toContain('name')
      }
    })
  })
})

describe('AsyncValidator', () => {
  describe('basic async validation', () => {
    it('should validate asynchronously', async () => {
      const validator = createAsyncValidator()
      validator.addRule('email', {
        name: 'asyncCheck',
        rule: async (value) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return value === 'valid@example.com'
        },
        message: 'Invalid email',
      })

      const result1 = await validator.validate({ email: 'valid@example.com' })
      expect(result1.valid).toBe(true)

      const result2 = await validator.validate({ email: 'invalid@example.com' })
      expect(result2.valid).toBe(false)
    })

    it('should track validation duration', async () => {
      const validator = createAsyncValidator()
      validator.addRule('field', {
        name: 'slowCheck',
        rule: async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
          return true
        },
      })

      const result = await validator.validate({ field: 'test' })
      expect(result.duration).toBeGreaterThanOrEqual(40)
    })
  })

  describe('uniqueAsync helper', () => {
    it('should create unique validation rule', async () => {
      const existingEmails = ['taken@example.com', 'used@example.com']

      const validator = createAsyncValidator()
      validator.addRule('email', uniqueAsync(async (value: string) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        return !existingEmails.includes(value)
      }))

      const result1 = await validator.validate({ email: 'new@example.com' })
      expect(result1.valid).toBe(true)

      const result2 = await validator.validate({ email: 'taken@example.com' })
      expect(result2.valid).toBe(false)
    })
  })

  describe('existsAsync helper', () => {
    it('should create exists validation rule', async () => {
      const validUserIds = [1, 2, 3]

      const validator = createAsyncValidator()
      validator.addRule('userId', existsAsync(async (value: number) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        return validUserIds.includes(value)
      }))

      const result1 = await validator.validate({ userId: 1 })
      expect(result1.valid).toBe(true)

      const result2 = await validator.validate({ userId: 999 })
      expect(result2.valid).toBe(false)
    })
  })

  describe('timeout handling', () => {
    it('should timeout slow validations', async () => {
      const validator = createAsyncValidator({ defaultTimeout: 50 })
      validator.addRule('field', {
        name: 'verySlowCheck',
        rule: async () => {
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        },
      })

      const result = await validator.validate({ field: 'test' })
      expect(result.valid).toBe(false)
      expect(result.errors.field?.[0]).toContain('timed out')
    })
  })
})

describe('ModelValidator', () => {
  describe('from model attributes', () => {
    it('should configure from model attributes', async () => {
      const attributes: Record<string, ModelAttribute> = {
        name: { name: 'name', type: 'string', required: true },
        email: { name: 'email', type: 'string', validation: 'email' },
        age: { name: 'age', type: 'number', validation: ['min:18', 'max:100'] },
      }

      const result = await validateModel(
        { name: 'John', email: 'john@example.com', age: 25 },
        attributes,
      )
      expect(result.valid).toBe(true)

      const result2 = await validateModel(
        { name: '', email: 'invalid', age: 15 },
        attributes,
      )
      expect(result2.valid).toBe(false)
    })

    it('should handle validation string parsing', async () => {
      const attributes: Record<string, ModelAttribute> = {
        password: {
          name: 'password',
          type: 'string',
          validation: ['minLength:8', 'maxLength:50'],
        },
      }

      const result1 = await validateModel(
        { password: 'validpass123' },
        attributes,
      )
      expect(result1.valid).toBe(true)

      const result2 = await validateModel(
        { password: 'short' },
        attributes,
      )
      expect(result2.valid).toBe(false)
    })
  })

  describe('sync validation', () => {
    it('should validate synchronously', () => {
      const validator = createModelValidator()
      validator.fromModelAttributes({
        name: { name: 'name', required: true },
      })

      const result = validator.validateSync({ name: '' })
      expect(result.valid).toBe(false)
    })
  })

  describe('validateOrThrow', () => {
    it('should throw ModelValidationError', async () => {
      const attributes: Record<string, ModelAttribute> = {
        name: { name: 'name', required: true },
      }

      const validator = createModelValidator({ modelType: 'User' })

      await expect(
        validator.validateOrThrow({}, attributes),
      ).rejects.toThrow(ModelValidationError)
    })
  })

  describe('only/except options', () => {
    it('should only validate specified fields', async () => {
      const attributes: Record<string, ModelAttribute> = {
        name: { name: 'name', required: true },
        email: { name: 'email', required: true },
      }

      const validator = createModelValidator({ only: ['name'] })
      const result = await validator.validate({ name: 'John' }, attributes)
      expect(result.valid).toBe(true) // email not validated
    })

    it('should exclude specified fields', async () => {
      const attributes: Record<string, ModelAttribute> = {
        name: { name: 'name', required: true },
        email: { name: 'email', required: true },
      }

      const validator = createModelValidator({ except: ['email'] })
      const result = await validator.validate({ name: 'John' }, attributes)
      expect(result.valid).toBe(true) // email not validated
    })
  })
})

describe('TsValidationRules', () => {
  describe('basic rules', () => {
    it('should create email rule', () => {
      const tsRules = new TsValidationRules()
      const emailRule = tsRules.email()

      expect(emailRule.name).toBe('email')
      expect(emailRule.rule).toBeDefined()
    })

    it('should create url rule', () => {
      const tsRules = new TsValidationRules()
      const urlRule = tsRules.url()

      expect(urlRule.name).toBe('url')
    })

    it('should create uuid rule', () => {
      const tsRules = new TsValidationRules()
      const uuidRule = tsRules.uuid()

      expect(uuidRule.name).toBe('uuid')
    })

    it('should create strongPassword rule', () => {
      const tsRules = new TsValidationRules()
      const passwordRule = tsRules.strongPassword({
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
      })

      expect(passwordRule.name).toBe('strongPassword')
    })
  })

  describe('createTsValidationRule helper', () => {
    it('should create rules via helper', () => {
      const emailRule = createTsValidationRule('email')
      expect(emailRule.name).toBe('email')

      const ipRule = createTsValidationRule('ip', { version: 4 })
      expect(ipRule.name).toBe('ip')
    })
  })

  describe('convenience methods', () => {
    it('should create length rule', () => {
      const tsRules = new TsValidationRules()
      const lengthRule = tsRules.length(5, 10)

      expect(lengthRule.name).toBe('length')
      expect(lengthRule.params?.min).toBe(5)
      expect(lengthRule.params?.max).toBe(10)
    })

    it('should create contains rule', () => {
      const tsRules = new TsValidationRules()
      const containsRule = tsRules.contains('test', { ignoreCase: true })

      expect(containsRule.name).toBe('contains')
    })

    it('should create matches rule', () => {
      const tsRules = new TsValidationRules()
      const matchesRule = tsRules.matches(/^[A-Z]+$/)

      expect(matchesRule.name).toBe('matches')
    })
  })
})

describe('integration', () => {
  it('should work with combined sync and async validation', async () => {
    const modelValidator = createModelValidator()

    // Configure sync rules
    modelValidator.fromModelAttributes({
      username: { name: 'username', type: 'string', required: true, validation: 'minLength:3' },
      email: { name: 'email', type: 'string', required: true, validation: 'email' },
    })

    // Add async unique check
    const existingEmails = ['taken@example.com']
    modelValidator.addAsyncRule('email', uniqueAsync(async (value: string) => {
      return !existingEmails.includes(value)
    }))

    // Valid data
    const result1 = await modelValidator.validate({
      username: 'john',
      email: 'john@example.com',
    })
    expect(result1.valid).toBe(true)

    // Invalid - email taken
    const result2 = await modelValidator.validate({
      username: 'jane',
      email: 'taken@example.com',
    })
    expect(result2.valid).toBe(false)
    expect(result2.errors.email).toBeDefined()

    // Invalid - username too short
    const result3 = await modelValidator.validate({
      username: 'ab',
      email: 'new@example.com',
    })
    expect(result3.valid).toBe(false)
    expect(result3.errors.username).toBeDefined()
  })
})
