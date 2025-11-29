// ============================================================================
// Query Result Caching - LRU Cache Implementation
// ============================================================================

import type { Config } from '../types'

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T
  timestamp: number
  size: number
  key: string
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
  evictions: number
  hitRate: number
}

/**
 * LRU Cache for query results
 */
export class QueryCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private accessOrder: string[] = []
  private maxSize: number
  private ttlMs: number
  private keyPrefix: string
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 0,
    evictions: 0,
    hitRate: 0,
  }

  constructor(config?: Partial<Config['queryBuilder']['caching']>) {
    this.maxSize = config?.maxSize ?? 1000
    this.ttlMs = config?.ttlMs ?? 60000
    this.keyPrefix = config?.keyPrefix ?? 'ddb:'
    this.stats.maxSize = this.maxSize
  }

  /**
   * Generate cache key from query parameters
   */
  generateKey(operation: string, params: Record<string, unknown>): string {
    const sortedParams = this.sortObject(params)
    const hash = this.hashString(JSON.stringify(sortedParams))
    return `${this.keyPrefix}${operation}:${hash}`
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return undefined
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.delete(key)
      this.stats.misses++
      this.updateHitRate()
      return undefined
    }

    // Update access order (LRU)
    this.updateAccessOrder(key)
    this.stats.hits++
    this.updateHitRate()

    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // Check if we need to evict
    while (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const size = this.estimateSize(value)
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      size,
      key,
    }

    this.cache.set(key, entry)
    this.updateAccessOrder(key)
    this.stats.size = this.cache.size
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      const index = this.accessOrder.indexOf(key)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
      }
      this.stats.size = this.cache.size
    }
    return deleted
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    this.stats.size = 0
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: string | RegExp): number {
    let count = 0
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key)
        count++
      }
    }

    return count
  }

  /**
   * Invalidate cache entries for a specific entity type
   */
  invalidateEntityType(entityType: string): number {
    return this.invalidateByPattern(new RegExp(`${this.keyPrefix}.*${entityType}`))
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: this.cache.size,
      maxSize: this.maxSize,
      evictions: 0,
      hitRate: 0,
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Get all cached keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return

    const lruKey = this.accessOrder[0]
    this.delete(lruKey)
    this.stats.evictions++
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(key)
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  /**
   * Estimate size of value for memory tracking
   */
  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2 // Rough estimate in bytes
    }
    catch {
      return 0
    }
  }

  /**
   * Sort object keys for consistent hashing
   */
  private sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(obj).sort()

    for (const key of keys) {
      const value = obj[key]
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sorted[key] = this.sortObject(value as Record<string, unknown>)
      }
      else {
        sorted[key] = value
      }
    }

    return sorted
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

/**
 * Create a query cache instance
 */
export function createQueryCache<T = unknown>(
  config?: Partial<Config['queryBuilder']['caching']>,
): QueryCache<T> {
  return new QueryCache<T>(config)
}
