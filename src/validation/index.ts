// ============================================================================
// Validation Module - Async Rules & ts-validation Integration
// ============================================================================

export {
  // Core validation
  Validator,
  createValidator,
  type ValidationRule,
  type ValidationResult,
  type ValidationContext,
  type ValidatorOptions,
  type ValidationRuleDefinition,
} from './Validator'

export {
  // Async validation
  AsyncValidator,
  createAsyncValidator,
  type AsyncValidationRule,
  type AsyncValidationContext,
} from './AsyncValidator'

export {
  // ts-validation integration
  TsValidationRules,
  createTsValidationRule,
  type TsValidationRuleName,
  type TsValidationRuleOptions,
} from './TsValidationIntegration'

export {
  // Model validation
  ModelValidator,
  createModelValidator,
  validateModel,
  type ModelValidationResult,
  type ModelValidationOptions,
} from './ModelValidator'

export {
  // Built-in rules
  rules,
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
} from './rules'
