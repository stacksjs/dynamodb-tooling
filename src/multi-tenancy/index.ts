// ============================================================================
// Multi-Tenancy Module
// ============================================================================

export {
  TenantManager,
  createTenantManager,
  TenantContext,
  setTenantContext,
  getTenantContext,
  clearTenantContext,
  withTenant,
  type TenantContextData,
} from './TenantManager'

export {
  TenantIsolation,
  createTablePerTenantIsolation,
  createPrefixIsolation,
  createAttributeIsolation,
  type IsolationStrategy,
  type TablePerTenantStrategy,
  type PrefixIsolationStrategy,
  type AttributeIsolationStrategy,
} from './TenantIsolation'

export {
  TenantQueryInterceptor,
  createTenantQueryInterceptor,
  type InterceptedQuery,
} from './TenantQueryInterceptor'

export {
  TenantCapacityManager,
  createTenantCapacityManager,
  type TenantCapacityConfig,
  type TenantCapacityStats,
} from './TenantCapacityManager'
