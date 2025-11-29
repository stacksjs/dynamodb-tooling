// ============================================================================
// Retry Handler with Exponential Backoff
// ============================================================================

import {
  isRetryableError,
  getRetryDelayMs,
  ThrottlingError,
  ProvisionedThroughputExceededError,
} from '../types/errors'

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries: number
  /**
   * Base delay in milliseconds
   * @default 100
   */
  baseDelayMs: number
  /**
   * Maximum delay in milliseconds
   * @default 20000
   */
  maxDelayMs: number
  /**
   * Jitter factor (0-1) to randomize delays
   * @default 0.2
   */
  jitterFactor: number
  /**
   * Callback when retry is attempted
   */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

/**
 * Default retry configuration
 */
const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 20000,
  jitterFactor: 0.2,
}

/**
 * Retry handler with exponential backoff
 */
export class RetryHandler {
  private config: RetryConfig

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...defaultRetryConfig, ...config }
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined
    let attempt = 0

    while (attempt <= this.config.maxRetries) {
      try {
        return await fn()
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (!isRetryableError(error) || attempt >= this.config.maxRetries) {
          throw lastError
        }

        const delay = this.calculateDelay(attempt, error)

        if (this.config.onRetry) {
          this.config.onRetry(attempt + 1, lastError, delay)
        }

        await this.sleep(delay)
        attempt++
      }
    }

    throw lastError || new Error('Retry failed')
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateDelay(attempt: number, error: unknown): number {
    // Check if error provides a retry delay
    const errorDelay = getRetryDelayMs(error)
    if (errorDelay) {
      return Math.min(errorDelay, this.config.maxDelayMs)
    }

    // Calculate exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = this.config.baseDelayMs * 2 ** attempt

    // Add jitter
    const jitter = exponentialDelay * this.config.jitterFactor * Math.random()
    const totalDelay = exponentialDelay + jitter

    // Cap at max delay
    return Math.min(totalDelay, this.config.maxDelayMs)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Request deduplication for concurrent identical requests
 */
export class RequestDeduplicator {
  private pending: Map<string, Promise<unknown>> = new Map()

  /**
   * Execute a request with deduplication
   * Identical concurrent requests will share the same promise
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check if identical request is in flight
    const existing = this.pending.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    // Create new request
    const promise = fn().finally(() => {
      this.pending.delete(key)
    })

    this.pending.set(key, promise)
    return promise
  }

  /**
   * Get number of pending requests
   */
  get pendingCount(): number {
    return this.pending.size
  }

  /**
   * Check if a request is pending
   */
  isPending(key: string): boolean {
    return this.pending.has(key)
  }
}

/**
 * Request coalescer for batching concurrent requests
 */
export class RequestCoalescer<TKey, TResult> {
  private queue: Map<string, TKey[]> = new Map()
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private windowMs: number
  private maxBatchSize: number
  private batchFn: (keys: TKey[]) => Promise<Map<TKey, TResult>>

  constructor(
    batchFn: (keys: TKey[]) => Promise<Map<TKey, TResult>>,
    options?: {
      windowMs?: number
      maxBatchSize?: number
    },
  ) {
    this.batchFn = batchFn
    this.windowMs = options?.windowMs ?? 10
    this.maxBatchSize = options?.maxBatchSize ?? 100
  }

  /**
   * Add a key to be fetched
   * Returns a promise that resolves when the batch is processed
   */
  async get(batchKey: string, key: TKey): Promise<TResult | undefined> {
    return new Promise((resolve, reject) => {
      // Get or create queue for this batch
      let queue = this.queue.get(batchKey)
      if (!queue) {
        queue = []
        this.queue.set(batchKey, queue)
      }

      queue.push(key)

      // Schedule batch execution
      this.scheduleBatch(batchKey, resolve, reject)
    })
  }

  private scheduleBatch(
    batchKey: string,
    resolve: (result: TResult | undefined) => void,
    reject: (error: Error) => void,
  ): void {
    const queue = this.queue.get(batchKey)
    if (!queue) return

    // Execute immediately if max batch size reached
    if (queue.length >= this.maxBatchSize) {
      this.executeBatch(batchKey).then(results => {
        // Note: This simplified version just returns the first result
        // A real implementation would track resolve/reject per key
        resolve(results.values().next().value)
      }).catch(reject)
      return
    }

    // Schedule with window
    let timeout = this.timeouts.get(batchKey)
    if (!timeout) {
      timeout = setTimeout(() => {
        this.executeBatch(batchKey).then(results => {
          resolve(results.values().next().value)
        }).catch(reject)
      }, this.windowMs)
      this.timeouts.set(batchKey, timeout)
    }
  }

  private async executeBatch(batchKey: string): Promise<Map<TKey, TResult>> {
    const queue = this.queue.get(batchKey) || []
    this.queue.delete(batchKey)

    const timeout = this.timeouts.get(batchKey)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(batchKey)
    }

    return this.batchFn(queue)
  }
}

/**
 * Consumed capacity tracker
 */
export class CapacityTracker {
  private readUnits: number = 0
  private writeUnits: number = 0
  private operationCount: number = 0
  private startTime: number = Date.now()

  /**
   * Track consumed capacity from a response
   */
  track(consumedCapacity?: {
    ReadCapacityUnits?: number
    WriteCapacityUnits?: number
    CapacityUnits?: number
  }): void {
    if (!consumedCapacity) return

    this.operationCount++

    if (consumedCapacity.ReadCapacityUnits) {
      this.readUnits += consumedCapacity.ReadCapacityUnits
    }
    if (consumedCapacity.WriteCapacityUnits) {
      this.writeUnits += consumedCapacity.WriteCapacityUnits
    }
    if (consumedCapacity.CapacityUnits && !consumedCapacity.ReadCapacityUnits && !consumedCapacity.WriteCapacityUnits) {
      // Generic capacity (could be read or write)
      this.readUnits += consumedCapacity.CapacityUnits
    }
  }

  /**
   * Get current statistics
   */
  getStats(): {
    totalReadUnits: number
    totalWriteUnits: number
    operationCount: number
    elapsedMs: number
    readUnitsPerSecond: number
    writeUnitsPerSecond: number
  } {
    const elapsedMs = Date.now() - this.startTime
    const elapsedSeconds = elapsedMs / 1000

    return {
      totalReadUnits: this.readUnits,
      totalWriteUnits: this.writeUnits,
      operationCount: this.operationCount,
      elapsedMs,
      readUnitsPerSecond: elapsedSeconds > 0 ? this.readUnits / elapsedSeconds : 0,
      writeUnitsPerSecond: elapsedSeconds > 0 ? this.writeUnits / elapsedSeconds : 0,
    }
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.readUnits = 0
    this.writeUnits = 0
    this.operationCount = 0
    this.startTime = Date.now()
  }

  /**
   * Estimate cost (approximate)
   * Based on on-demand pricing: $1.25 per million RCU, $1.25 per million WCU
   */
  estimateCost(): { readCost: number, writeCost: number, totalCost: number } {
    const readCost = (this.readUnits / 1000000) * 1.25
    const writeCost = (this.writeUnits / 1000000) * 1.25
    return {
      readCost,
      writeCost,
      totalCost: readCost + writeCost,
    }
  }
}

/**
 * Create a retry handler with default or custom config
 */
export function createRetryHandler(config?: Partial<RetryConfig>): RetryHandler {
  return new RetryHandler(config)
}

/**
 * Create a request deduplicator
 */
export function createRequestDeduplicator(): RequestDeduplicator {
  return new RequestDeduplicator()
}

/**
 * Create a capacity tracker
 */
export function createCapacityTracker(): CapacityTracker {
  return new CapacityTracker()
}
