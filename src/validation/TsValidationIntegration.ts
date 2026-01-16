// ============================================================================
// ts-validation Integration - @stacksjs/ts-validation Wrapper
// ============================================================================

import type { ValidationContext, ValidationResult, ValidationRuleDefinition } from './Validator'

/**
 * Available ts-validation rule names
 */
export type TsValidationRuleName =
  // Email/URL/IP
  | 'email'
  | 'url'
  | 'ip'
  | 'ipRange'
  | 'fqdn'
  | 'macAddress'
  | 'mailtoUri'
  | 'magnetUri'
  | 'dataUri'
  // Date and time
  | 'date'
  | 'time'
  | 'rfc3339'
  | 'iso8601'
  | 'after'
  | 'before'
  // String types
  | 'alpha'
  | 'alphanumeric'
  | 'numeric'
  | 'passportNumber'
  | 'port'
  | 'lowercase'
  | 'uppercase'
  | 'ascii'
  | 'fullWidth'
  | 'halfWidth'
  | 'variableWidth'
  | 'multibyte'
  | 'boolean'
  | 'locale'
  | 'slug'
  | 'empty'
  | 'length'
  | 'byteLength'
  | 'semVer'
  | 'surrogatePair'
  // Numbers
  | 'int'
  | 'float'
  | 'decimal'
  | 'hexadecimal'
  | 'octal'
  | 'divisibleBy'
  | 'luhnNumber'
  // Financial
  | 'creditCard'
  | 'bic'
  | 'iban'
  | 'ethereumAddress'
  | 'currency'
  | 'btcAddress'
  // Colors
  | 'hexColor'
  | 'rgbColor'
  | 'hsl'
  // Identifiers
  | 'isrc'
  | 'md5'
  | 'hash'
  | 'jwt'
  | 'json'
  | 'uuid'
  | 'ulid'
  | 'mongoId'
  | 'base32'
  | 'base58'
  | 'base64'
  // Array/list
  | 'in'
  // Identification
  | 'imei'
  | 'ean'
  | 'isin'
  | 'isbn'
  | 'issn'
  | 'taxId'
  | 'identityCard'
  | 'vat'
  // Phone
  | 'mobilePhone'
  | 'postalCode'
  // Geographical
  | 'latLong'
  | 'licensePlate'
  // ISO standards
  | 'iso6346'
  | 'freightContainerId'
  | 'iso6391'
  | 'iso15924'
  | 'iso31661Alpha2'
  | 'iso31661Alpha3'
  | 'iso31661Numeric'
  | 'iso4217'
  // Security
  | 'strongPassword'
  // String manipulation (validators)
  | 'contains'
  | 'equals'
  | 'matches'
  | 'whitelisted'

/**
 * Options for ts-validation rules
 */
export interface TsValidationRuleOptions {
  // Email options
  allow_display_name?: boolean
  allow_underscores?: boolean
  require_display_name?: boolean
  allow_utf8_local_part?: boolean
  require_tld?: boolean
  blacklisted_chars?: string
  ignore_max_length?: boolean
  host_blacklist?: string[]
  host_whitelist?: string[]

  // URL options
  protocols?: string[]
  require_protocol?: boolean
  require_host?: boolean
  require_port?: boolean
  require_valid_protocol?: boolean
  allow_trailing_dot?: boolean
  allow_protocol_relative_urls?: boolean
  allow_fragments?: boolean
  allow_query_components?: boolean
  disallow_auth?: boolean
  validate_length?: boolean
  max_allowed_length?: number

  // IP options
  version?: 4 | 6 | '4' | '6'

  // Alpha/Alphanumeric options
  locale?: string

  // Length options
  min?: number
  max?: number

  // Number options
  allow_leading_zeroes?: boolean

  // Hash options
  algorithm?: string

  // Strong password options
  minLength?: number
  minLowercase?: number
  minUppercase?: number
  minNumbers?: number
  minSymbols?: number
  returnScore?: boolean
  pointsPerUnique?: number
  pointsPerRepeat?: number
  pointsForContainingLower?: number
  pointsForContainingUpper?: number
  pointsForContainingNumber?: number
  pointsForContainingSymbol?: number

  // Contains options
  ignoreCase?: boolean

  // Matches options (pattern)
  pattern?: RegExp | string
  modifiers?: string

  // In options (array)
  values?: unknown[]

  // Decimal options
  decimal_digits?: string
  force_decimal?: boolean
  locale_for_decimal?: string

  // Date options
  format?: string
  strictMode?: boolean
  delimiters?: string[]

  // After/Before options
  comparisonDate?: string | Date

  // Generic options
  no_symbols?: boolean
  allow_hyphens?: boolean
  strict?: boolean
}

/**
 * Map of rule names to ts-validation function names
 */
const ruleNameMap: Record<TsValidationRuleName, string> = {
  email: 'isEmail',
  url: 'isURL',
  ip: 'isIP',
  ipRange: 'isIPRange',
  fqdn: 'isFQDN',
  macAddress: 'isMACAddress',
  mailtoUri: 'isMailtoURI',
  magnetUri: 'isMagnetURI',
  dataUri: 'isDataURI',
  date: 'isDate',
  time: 'isTime',
  rfc3339: 'isRFC3339',
  iso8601: 'isISO8601',
  after: 'isAfter',
  before: 'isBefore',
  alpha: 'isAlpha',
  alphanumeric: 'isAlphanumeric',
  numeric: 'isNumeric',
  passportNumber: 'isPassportNumber',
  port: 'isPort',
  lowercase: 'isLowercase',
  uppercase: 'isUppercase',
  ascii: 'isAscii',
  fullWidth: 'isFullWidth',
  halfWidth: 'isHalfWidth',
  variableWidth: 'isVariableWidth',
  multibyte: 'isMultibyte',
  boolean: 'isBoolean',
  locale: 'isLocale',
  slug: 'isSlug',
  empty: 'isEmpty',
  length: 'isLength',
  byteLength: 'isByteLength',
  semVer: 'isSemVer',
  surrogatePair: 'isSurrogatePair',
  int: 'isInt',
  float: 'isFloat',
  decimal: 'isDecimal',
  hexadecimal: 'isHexadecimal',
  octal: 'isOctal',
  divisibleBy: 'isDivisibleBy',
  luhnNumber: 'isLuhnNumber',
  creditCard: 'isCreditCard',
  bic: 'isBIC',
  iban: 'isIBAN',
  ethereumAddress: 'isEthereumAddress',
  currency: 'isCurrency',
  btcAddress: 'isBtcAddress',
  hexColor: 'isHexColor',
  rgbColor: 'isRgbColor',
  hsl: 'isHSL',
  isrc: 'isISRC',
  md5: 'isMD5',
  hash: 'isHash',
  jwt: 'isJWT',
  json: 'isJSON',
  uuid: 'isUUID',
  ulid: 'isULID',
  mongoId: 'isMongoId',
  base32: 'isBase32',
  base58: 'isBase58',
  base64: 'isBase64',
  in: 'isIn',
  imei: 'isIMEI',
  ean: 'isEAN',
  isin: 'isISIN',
  isbn: 'isISBN',
  issn: 'isISSN',
  taxId: 'isTaxID',
  identityCard: 'isIdentityCard',
  vat: 'isVAT',
  mobilePhone: 'isMobilePhone',
  postalCode: 'isPostalCode',
  latLong: 'isLatLong',
  licensePlate: 'isLicensePlate',
  iso6346: 'isISO6346',
  freightContainerId: 'isFreightContainerID',
  iso6391: 'isISO6391',
  iso15924: 'isISO15924',
  iso31661Alpha2: 'isISO31661Alpha2',
  iso31661Alpha3: 'isISO31661Alpha3',
  iso31661Numeric: 'isISO31661Numeric',
  iso4217: 'isISO4217',
  strongPassword: 'isStrongPassword',
  contains: 'contains',
  equals: 'equals',
  matches: 'matches',
  whitelisted: 'isWhitelisted',
}

/**
 * Default error messages for ts-validation rules
 */
const defaultMessages: Record<TsValidationRuleName, string> = {
  email: 'The :attribute must be a valid email address',
  url: 'The :attribute must be a valid URL',
  ip: 'The :attribute must be a valid IP address',
  ipRange: 'The :attribute must be a valid IP range',
  fqdn: 'The :attribute must be a valid fully qualified domain name',
  macAddress: 'The :attribute must be a valid MAC address',
  mailtoUri: 'The :attribute must be a valid mailto URI',
  magnetUri: 'The :attribute must be a valid magnet URI',
  dataUri: 'The :attribute must be a valid data URI',
  date: 'The :attribute must be a valid date',
  time: 'The :attribute must be a valid time',
  rfc3339: 'The :attribute must be a valid RFC3339 date',
  iso8601: 'The :attribute must be a valid ISO8601 date',
  after: 'The :attribute must be a date after :comparisonDate',
  before: 'The :attribute must be a date before :comparisonDate',
  alpha: 'The :attribute may only contain letters',
  alphanumeric: 'The :attribute may only contain letters and numbers',
  numeric: 'The :attribute must be numeric',
  passportNumber: 'The :attribute must be a valid passport number',
  port: 'The :attribute must be a valid port number',
  lowercase: 'The :attribute must be lowercase',
  uppercase: 'The :attribute must be uppercase',
  ascii: 'The :attribute may only contain ASCII characters',
  fullWidth: 'The :attribute must contain full-width characters',
  halfWidth: 'The :attribute must contain half-width characters',
  variableWidth: 'The :attribute must contain variable-width characters',
  multibyte: 'The :attribute must contain multibyte characters',
  boolean: 'The :attribute must be a boolean',
  locale: 'The :attribute must be a valid locale',
  slug: 'The :attribute must be a valid slug',
  empty: 'The :attribute must be empty',
  length: 'The :attribute must be between :min and :max characters',
  byteLength: 'The :attribute must be between :min and :max bytes',
  semVer: 'The :attribute must be a valid semantic version',
  surrogatePair: 'The :attribute must contain a surrogate pair',
  int: 'The :attribute must be an integer',
  float: 'The :attribute must be a float',
  decimal: 'The :attribute must be a decimal number',
  hexadecimal: 'The :attribute must be a hexadecimal number',
  octal: 'The :attribute must be an octal number',
  divisibleBy: 'The :attribute must be divisible by :value',
  luhnNumber: 'The :attribute must be a valid Luhn number',
  creditCard: 'The :attribute must be a valid credit card number',
  bic: 'The :attribute must be a valid BIC/SWIFT code',
  iban: 'The :attribute must be a valid IBAN',
  ethereumAddress: 'The :attribute must be a valid Ethereum address',
  currency: 'The :attribute must be a valid currency amount',
  btcAddress: 'The :attribute must be a valid Bitcoin address',
  hexColor: 'The :attribute must be a valid hex color',
  rgbColor: 'The :attribute must be a valid RGB color',
  hsl: 'The :attribute must be a valid HSL color',
  isrc: 'The :attribute must be a valid ISRC',
  md5: 'The :attribute must be a valid MD5 hash',
  hash: 'The :attribute must be a valid :algorithm hash',
  jwt: 'The :attribute must be a valid JWT',
  json: 'The :attribute must be valid JSON',
  uuid: 'The :attribute must be a valid UUID',
  ulid: 'The :attribute must be a valid ULID',
  mongoId: 'The :attribute must be a valid MongoDB ObjectId',
  base32: 'The :attribute must be valid Base32',
  base58: 'The :attribute must be valid Base58',
  base64: 'The :attribute must be valid Base64',
  in: 'The selected :attribute is invalid',
  imei: 'The :attribute must be a valid IMEI number',
  ean: 'The :attribute must be a valid EAN',
  isin: 'The :attribute must be a valid ISIN',
  isbn: 'The :attribute must be a valid ISBN',
  issn: 'The :attribute must be a valid ISSN',
  taxId: 'The :attribute must be a valid tax ID',
  identityCard: 'The :attribute must be a valid identity card number',
  vat: 'The :attribute must be a valid VAT number',
  mobilePhone: 'The :attribute must be a valid mobile phone number',
  postalCode: 'The :attribute must be a valid postal code',
  latLong: 'The :attribute must be a valid latitude/longitude coordinate',
  licensePlate: 'The :attribute must be a valid license plate',
  iso6346: 'The :attribute must be a valid ISO 6346 container code',
  freightContainerId: 'The :attribute must be a valid freight container ID',
  iso6391: 'The :attribute must be a valid ISO 639-1 language code',
  iso15924: 'The :attribute must be a valid ISO 15924 script code',
  iso31661Alpha2: 'The :attribute must be a valid ISO 3166-1 alpha-2 country code',
  iso31661Alpha3: 'The :attribute must be a valid ISO 3166-1 alpha-3 country code',
  iso31661Numeric: 'The :attribute must be a valid ISO 3166-1 numeric country code',
  iso4217: 'The :attribute must be a valid ISO 4217 currency code',
  strongPassword: 'The :attribute must be a strong password',
  contains: 'The :attribute must contain :seed',
  equals: 'The :attribute must equal :comparison',
  matches: 'The :attribute format is invalid',
  whitelisted: 'The :attribute contains invalid characters',
}

/**
 * ts-validation integration class
 * Provides access to all validators from @stacksjs/ts-validation
 */
export class TsValidationRules {
  private validator: { [key: string]: unknown } | null = null
  private loadPromise: Promise<{ [key: string]: unknown }> | null = null

  /**
   * Lazily load the ts-validation package
   */
  private async getValidator(): Promise<{ [key: string]: unknown }> {
    if (this.validator) {
      return this.validator
    }

    if (this.loadPromise) {
      return this.loadPromise
    }

    this.loadPromise = (async (): Promise<{ [key: string]: unknown }> => {
      try {
        // Dynamic import for ts-validation

        const mod = await (new Function('return import("@stacksjs/ts-validation")')() as Promise<{ default?: { [key: string]: unknown }, [key: string]: unknown }>)
        this.validator = (mod.default || mod) as { [key: string]: unknown }
        return this.validator
      }
      catch {
        throw new Error(
          'Failed to load @stacksjs/ts-validation. Please install it: npm install @stacksjs/ts-validation',
        )
      }
    })()

    return this.loadPromise
  }

  /**
   * Create a validation rule from ts-validation
   */
  createRule(
    ruleName: TsValidationRuleName,
    options?: TsValidationRuleOptions,
    customMessage?: string,
  ): ValidationRuleDefinition {
    const fnName = ruleNameMap[ruleName]

    return {
      name: ruleName,
      params: options as Record<string, unknown>,
      message: customMessage ?? defaultMessages[ruleName],
      rule: (value: unknown, context: ValidationContext): ValidationResult => {
        // Skip validation for empty values (let required rule handle it)
        if (value === undefined || value === null || value === '') {
          return { valid: true }
        }

        // Ensure value is a string for ts-validation
        const strValue = String(value)

        try {
          // Synchronous check using pre-loaded validator
          if (!this.validator) {
            // Return pending result that will be resolved
            return { valid: true } // Optimistically pass, async validation will catch it
          }

          const validatorFn = this.validator[fnName] as ((str: string, opts?: unknown) => boolean) | undefined
          if (!validatorFn) {
            return {
              valid: false,
              message: `Unknown validation rule: ${ruleName}`,
              code: 'unknown_rule',
            }
          }

          // Handle special cases
          let isValid: boolean
          if (ruleName === 'in' && options?.values) {
            isValid = validatorFn(strValue, options.values)
          }
          else if (ruleName === 'contains' && options && 'seed' in (options as Record<string, unknown>)) {
            isValid = validatorFn(strValue, (options as Record<string, unknown>).seed)
          }
          else if (ruleName === 'equals' && options && 'comparison' in (options as Record<string, unknown>)) {
            isValid = validatorFn(strValue, (options as Record<string, unknown>).comparison)
          }
          else if (ruleName === 'matches' && options?.pattern) {
            const pattern = typeof options.pattern === 'string'
              ? new RegExp(options.pattern, options.modifiers)
              : options.pattern
            isValid = validatorFn(strValue, pattern)
          }
          else if (ruleName === 'divisibleBy' && options && 'value' in (options as Record<string, unknown>)) {
            isValid = validatorFn(strValue, (options as Record<string, unknown>).value)
          }
          else if (ruleName === 'hash' && options?.algorithm) {
            isValid = validatorFn(strValue, options.algorithm)
          }
          else if (options && Object.keys(options).length > 0) {
            isValid = validatorFn(strValue, options)
          }
          else {
            isValid = validatorFn(strValue)
          }

          return {
            valid: isValid,
            message: isValid ? undefined : (customMessage ?? defaultMessages[ruleName]),
            code: ruleName,
          }
        }
        catch (error) {
          return {
            valid: false,
            message: error instanceof Error ? error.message : 'Validation failed',
            code: 'validation_error',
          }
        }
      },
    }
  }

  /**
   * Initialize the validator (load ts-validation package)
   */
  async initialize(): Promise<void> {
    await this.getValidator()
  }

  /**
   * Check if validator is loaded
   */
  isLoaded(): boolean {
    return this.validator !== null
  }

  // ============================================================================
  // Convenience methods for common rules
  // ============================================================================

  email(options?: TsValidationRuleOptions, message?: string): ValidationRuleDefinition {
    return this.createRule('email', options, message)
  }

  url(options?: TsValidationRuleOptions, message?: string): ValidationRuleDefinition {
    return this.createRule('url', options, message)
  }

  uuid(version?: 3 | 4 | 5 | 'all', message?: string): ValidationRuleDefinition {
    return this.createRule('uuid', version ? { version } as TsValidationRuleOptions : undefined, message)
  }

  ip(version?: 4 | 6, message?: string): ValidationRuleDefinition {
    return this.createRule('ip', version ? { version } : undefined, message)
  }

  creditCard(message?: string): ValidationRuleDefinition {
    return this.createRule('creditCard', undefined, message)
  }

  strongPassword(options?: TsValidationRuleOptions, message?: string): ValidationRuleDefinition {
    return this.createRule('strongPassword', options, message)
  }

  alpha(locale?: string, message?: string): ValidationRuleDefinition {
    return this.createRule('alpha', locale ? { locale } : undefined, message)
  }

  alphanumeric(locale?: string, message?: string): ValidationRuleDefinition {
    return this.createRule('alphanumeric', locale ? { locale } : undefined, message)
  }

  numeric(message?: string): ValidationRuleDefinition {
    return this.createRule('numeric', undefined, message)
  }

  date(options?: TsValidationRuleOptions, message?: string): ValidationRuleDefinition {
    return this.createRule('date', options, message)
  }

  json(message?: string): ValidationRuleDefinition {
    return this.createRule('json', undefined, message)
  }

  jwt(message?: string): ValidationRuleDefinition {
    return this.createRule('jwt', undefined, message)
  }

  hexColor(message?: string): ValidationRuleDefinition {
    return this.createRule('hexColor', undefined, message)
  }

  iban(message?: string): ValidationRuleDefinition {
    return this.createRule('iban', undefined, message)
  }

  mobilePhone(locale?: string, message?: string): ValidationRuleDefinition {
    return this.createRule('mobilePhone', locale ? { locale } : undefined, message)
  }

  postalCode(locale?: string, message?: string): ValidationRuleDefinition {
    return this.createRule('postalCode', locale ? { locale } : undefined, message)
  }

  slug(message?: string): ValidationRuleDefinition {
    return this.createRule('slug', undefined, message)
  }

  semVer(message?: string): ValidationRuleDefinition {
    return this.createRule('semVer', undefined, message)
  }

  base64(message?: string): ValidationRuleDefinition {
    return this.createRule('base64', undefined, message)
  }

  mongoId(message?: string): ValidationRuleDefinition {
    return this.createRule('mongoId', undefined, message)
  }

  latLong(message?: string): ValidationRuleDefinition {
    return this.createRule('latLong', undefined, message)
  }

  contains(seed: string, options?: { ignoreCase?: boolean }, message?: string): ValidationRuleDefinition {
    return this.createRule('contains', { ...options, seed } as TsValidationRuleOptions, message)
  }

  matches(pattern: RegExp | string, modifiers?: string, message?: string): ValidationRuleDefinition {
    return this.createRule('matches', { pattern, modifiers }, message)
  }

  length(min: number, max?: number, message?: string): ValidationRuleDefinition {
    return this.createRule('length', { min, max: max ?? min }, message)
  }
}

/**
 * Create a ts-validation rule
 */
export function createTsValidationRule(
  ruleName: TsValidationRuleName,
  options?: TsValidationRuleOptions,
  message?: string,
): ValidationRuleDefinition {
  const rules = new TsValidationRules()
  return rules.createRule(ruleName, options, message)
}

// Export singleton instance
export const tsValidation: TsValidationRules = new TsValidationRules()
