// ============================================================================
// Cache Manager - Caching Integration for DynamoDB
// ============================================================================

/**
 * Cache entry
 */
export interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number
  createdAt: number
  metadata?: Record<string, unknown>
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** TTL in milliseconds */
  ttl?: number
  /** Cache key prefix */
  prefix?: string
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  hitRate: number
  size: number
}

/**
 * Cache store interface
 */
export interface CacheStore {
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T, options?: CacheOptions) => Promise<void>
  delete: (key: string) => Promise<boolean>
  has: (key: string) => Promise<boolean>
  clear: () => Promise<void>
  keys: (pattern?: string) => Promise<string[]>
}

/**
 * In-memory cache store
 */
export class MemoryCacheStore implements CacheStore {
  private cache: Map<string, CacheEntry> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(cleanupIntervalMs: number = 60000) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs)
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key)
    if (!entry)
      return undefined

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value as T
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? 300000 // Default 5 minutes
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      metadata: options?.metadata,
    })
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key)
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key)
    if (!entry)
      return false
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys())
    if (!pattern)
      return allKeys

    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return allKeys.filter(key => regex.test(key))
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key)
      }
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

/**
 * Eviction policy for cache
 */
export type EvictionPolicy = 'fifo' | 'lru' | 'lfu'

/**
 * Cache manager options
 */
export interface CacheManagerOptions {
  store?: CacheStore
  defaultTtl?: number
  prefix?: string
  /** Alias for defaultTtl */
  ttl?: number
  /** Max cache size (entries) */
  maxSize?: number
  /** Refresh TTL on access */
  refreshOnAccess?: boolean
  /** Eviction policy when max size is reached */
  evictionPolicy?: EvictionPolicy
}

/**
 * Cache manager for DynamoDB operations
 */
export class CacheManager {
  private store: CacheStore
  private defaultTtl: number
  private prefix: string
  private maxSize?: number
  private refreshOnAccess: boolean
  private evictionPolicy: EvictionPolicy
  private accessOrder: string[] = []
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    size: 0,
  }

  constructor(options?: CacheManagerOptions) {
    this.store = options?.store ?? new MemoryCacheStore()
    this.defaultTtl = options?.defaultTtl ?? options?.ttl ?? 300000 // 5 minutes
    this.prefix = options?.prefix ?? 'dynamodb:'
    this.maxSize = options?.maxSize
    this.refreshOnAccess = options?.refreshOnAccess ?? false
    this.evictionPolicy = options?.evictionPolicy ?? 'fifo'
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    const fullKey = this.buildKey(key)
    const value = await this.store.get<T>(fullKey)

    if (value !== undefined) {
      this.stats.hits++

      // Refresh TTL on access if configured
      if (this.refreshOnAccess) {
        await this.store.set(fullKey, value, { ttl: this.defaultTtl })
      }

      // Update LRU access order
      this.updateAccessOrder(fullKey)
    }
    else {
      this.stats.misses++
    }
    this.updateHitRate()

    return value
  }

  /**
   * Set item in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key)

    // Handle eviction if max size is set
    if (this.maxSize && this.stats.size >= this.maxSize) {
      await this.evict()
    }

    await this.store.set(fullKey, value, {
      ttl: options?.ttl ?? this.defaultTtl,
      ...options,
    })

    // Track access order for eviction
    if (!this.accessOrder.includes(fullKey)) {
      this.accessOrder.push(fullKey)
      this.stats.size++
    }
    this.stats.sets++
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
      this.accessOrder.push(key)
    }
  }

  /**
   * Evict oldest/least recently used item
   */
  private async evict(): Promise<void> {
    if (this.accessOrder.length === 0)
      return

    // For FIFO, evict from front; for LRU, also from front (since accessed items move to back)
    const keyToEvict = this.accessOrder.shift()
    if (keyToEvict) {
      await this.store.delete(keyToEvict)
      this.stats.deletes++
      this.stats.size--
    }
  }

  /**
   * Check if item exists in cache
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key)
    return this.store.has(fullKey)
  }

  /**
   * Delete item from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key)
    const deleted = await this.store.delete(fullKey)
    if (deleted) {
      this.stats.deletes++
      this.stats.size--
    }
    return deleted
  }

  /**
   * Get or set with callback
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== undefined) {
      return cached
    }

    const value = await factory()
    await this.set(key, value, options)
    return value
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern)
    const keys = await this.store.keys(fullPattern)

    let count = 0
    for (const key of keys) {
      if (await this.store.delete(key)) {
        count++
        this.stats.deletes++
        this.stats.size--
      }
    }

    return count
  }

  /**
   * Invalidate all items for a table
   */
  async invalidateTable(tableName: string): Promise<number> {
    return this.invalidatePattern(`table:${tableName}:*`)
  }

  /**
   * Invalidate all items for an entity type
   */
  async invalidateEntity(entityType: string): Promise<number> {
    return this.invalidatePattern(`entity:${entityType}:*`)
  }

  /**
   * Build cache key for item
   */
  buildItemKey(tableName: string, pk: string, sk?: string): string {
    return sk
      ? `table:${tableName}:${pk}:${sk}`
      : `table:${tableName}:${pk}`
  }

  /**
   * Build cache key for query
   */
  buildQueryKey(tableName: string, queryHash: string): string {
    return `query:${tableName}:${queryHash}`
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
      sets: 0,
      deletes: 0,
      hitRate: 0,
      size: 0,
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await this.store.clear()
    this.stats.size = 0
  }

  private buildKey(key: string): string {
    return `${this.prefix}${key}`
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }
}

/**
 * Create a cache manager
 */
export function createCacheManager(options?: CacheManagerOptions): CacheManager {
  return new CacheManager(options)
}

/**
 * Cached decorator factory for methods
 */
export function cached(options?: CacheOptions): MethodDecorator {
  return function (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value

    descriptor.value = async function (this: { cache?: CacheManager }, ...args: unknown[]): Promise<unknown> {
      if (!this.cache) {
        return originalMethod.apply(this, args)
      }

      const key = `${String(propertyKey)}:${JSON.stringify(args)}`
      return this.cache.getOrSet(key, () => originalMethod.apply(this, args), options)
    }

    return descriptor
  }
}

/**
 * Deeply sort object keys for consistent stringification
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']'
  }

  const keys = Object.keys(value as Record<string, unknown>).sort()
  const pairs = keys.map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
  return '{' + pairs.join(',') + '}'
}

/**
 * Hash function for query parameters
 */
export function hashQuery(params: Record<string, unknown>): string {
  const str = stableStringify(params)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
