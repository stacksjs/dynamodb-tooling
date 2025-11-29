// ============================================================================
// Performance & Optimization Module
// ============================================================================

export {
  QueryCache,
  createQueryCache,
  type CacheStats,
} from './QueryCache'

export {
  RetryHandler,
  RequestDeduplicator,
  RequestCoalescer,
  CapacityTracker,
  createRetryHandler,
  createRequestDeduplicator,
  createCapacityTracker,
  type RetryConfig,
} from './RetryHandler'
