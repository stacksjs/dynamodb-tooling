// ============================================================================
// Validation Module - Async Rules & ts-validation Integration
// ============================================================================

export {
  type AsyncValidationContext,
  type AsyncValidationRule,
  // Async validation
  AsyncValidator,
  createAsyncValidator,
} from './AsyncValidator'

export {
  createModelValidator,
  type ModelValidationOptions,
  type ModelValidationResult,
  // Model validation
  ModelValidator,
  validateModel,
} from './ModelValidator'

export {
  boolean,
  custom,
  email,
  max,
  maxLength,
  min,
  minLength,
  number,
  oneOf,
  pattern,
  required,
  // Built-in rules
  rules,
  string,
  unique,
  url,
  uuid,
} from './rules'

export {
  createTsValidationRule,
  type TsValidationRuleName,
  type TsValidationRuleOptions,
  // ts-validation integration
  TsValidationRules,
} from './TsValidationIntegration'

export {
  createValidator,
  type ValidationContext,
  type ValidationResult,
  type ValidationRule,
  type ValidationRuleDefinition,
  // Core validation
  Validator,
  type ValidatorOptions,
} from './Validator'
