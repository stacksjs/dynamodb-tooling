// ============================================================================
// Performance & Optimization Module
// ============================================================================

export {
  type CacheStats,
  createQueryCache,
  QueryCache,
} from './QueryCache'

export {
  CapacityTracker,
  createCapacityTracker,
  createRequestDeduplicator,
  createRetryHandler,
  RequestCoalescer,
  RequestDeduplicator,
  type RetryConfig,
  RetryHandler,
} from './RetryHandler'
