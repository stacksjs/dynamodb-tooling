// ============================================================================
// Multi-Tenancy Module
// ============================================================================

export {
  createTenantCapacityManager,
  type TenantCapacityConfig,
  TenantCapacityManager,
  type TenantCapacityStats,
} from './TenantCapacityManager'

export {
  type AttributeIsolationStrategy,
  createAttributeIsolation,
  createPrefixIsolation,
  createTablePerTenantIsolation,
  type IsolationStrategy,
  type PrefixIsolationStrategy,
  type TablePerTenantStrategy,
  TenantIsolation,
} from './TenantIsolation'

export {
  clearTenantContext,
  createTenantManager,
  getTenantContext,
  setTenantContext,
  TenantContext,
  type TenantContextData,
  TenantManager,
  withTenant,
} from './TenantManager'

export {
  createTenantQueryInterceptor,
  type InterceptedQuery,
  TenantQueryInterceptor,
} from './TenantQueryInterceptor'
