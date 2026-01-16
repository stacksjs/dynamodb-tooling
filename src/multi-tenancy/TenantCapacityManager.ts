// ============================================================================
// Tenant Capacity Manager - Per-tenant capacity tracking and limits
// ============================================================================

/**
 * Tenant capacity configuration
 */
export interface TenantCapacityConfig {
  /** Maximum read capacity units per second */
  maxReadCapacity?: number
  /** Maximum write capacity units per second */
  maxWriteCapacity?: number
  /** Maximum items per tenant (soft limit) */
  maxItems?: number
  /** Maximum storage size in bytes (soft limit) */
  maxStorageBytes?: number
  /** Throttle requests when limits exceeded */
  throttleOnExceed?: boolean
  /** Burst allowance (percentage over limit allowed briefly) */
  burstAllowance?: number
}

/**
 * Tenant capacity statistics
 */
export interface TenantCapacityStats {
  /** Tenant ID */
  tenantId: string
  /** Current read capacity usage (units in last second) */
  currentReadCapacity: number
  /** Current write capacity usage (units in last second) */
  currentWriteCapacity: number
  /** Total read capacity consumed */
  totalReadCapacity: number
  /** Total write capacity consumed */
  totalWriteCapacity: number
  /** Estimated item count */
  estimatedItems: number
  /** Estimated storage size in bytes */
  estimatedStorageBytes: number
  /** Number of throttled requests */
  throttledRequests: number
  /** Last updated timestamp */
  lastUpdated: number
}

/**
 * Capacity window for rate limiting
 */
interface CapacityWindow {
  startTime: number
  readUnits: number
  writeUnits: number
}

/**
 * Tenant capacity manager
 * Tracks and enforces per-tenant capacity limits
 */
export class TenantCapacityManager {
  private configs: Map<string, TenantCapacityConfig> = new Map()
  private stats: Map<string, TenantCapacityStats> = new Map()
  private windows: Map<string, CapacityWindow> = new Map()
  private defaultConfig: TenantCapacityConfig

  constructor(defaultConfig?: TenantCapacityConfig) {
    this.defaultConfig = {
      maxReadCapacity: 1000,
      maxWriteCapacity: 500,
      throttleOnExceed: false,
      burstAllowance: 0.2,
      ...defaultConfig,
    }
  }

  /**
   * Set capacity configuration for a specific tenant
   */
  setTenantConfig(tenantId: string, config: TenantCapacityConfig): void {
    this.configs.set(tenantId, { ...this.defaultConfig, ...config })
  }

  /**
   * Get capacity configuration for a tenant
   */
  getTenantConfig(tenantId: string): TenantCapacityConfig {
    return this.configs.get(tenantId) || this.defaultConfig
  }

  /**
   * Remove tenant configuration (use defaults)
   */
  removeTenantConfig(tenantId: string): void {
    this.configs.delete(tenantId)
  }

  /**
   * Track consumed capacity for a tenant
   */
  trackCapacity(
    tenantId: string,
    readUnits: number,
    writeUnits: number,
  ): {
      allowed: boolean
      throttled: boolean
      retryAfterMs?: number
    } {
    const config = this.getTenantConfig(tenantId)
    const now = Date.now()

    // Get or create window
    let window = this.windows.get(tenantId)
    if (!window || now - window.startTime >= 1000) {
      window = { startTime: now, readUnits: 0, writeUnits: 0 }
      this.windows.set(tenantId, window)
    }

    // Calculate new totals
    const newReadTotal = window.readUnits + readUnits
    const newWriteTotal = window.writeUnits + writeUnits

    // Check limits with burst allowance
    const maxRead = config.maxReadCapacity ?? Infinity
    const maxWrite = config.maxWriteCapacity ?? Infinity
    const burst = 1 + (config.burstAllowance ?? 0)

    const readExceeded = newReadTotal > maxRead * burst
    const writeExceeded = newWriteTotal > maxWrite * burst

    if ((readExceeded || writeExceeded) && config.throttleOnExceed) {
      // Update stats
      this.updateStats(tenantId, 0, 0, true)

      return {
        allowed: false,
        throttled: true,
        retryAfterMs: 1000 - (now - window.startTime),
      }
    }

    // Update window
    window.readUnits = newReadTotal
    window.writeUnits = newWriteTotal

    // Update stats
    this.updateStats(tenantId, readUnits, writeUnits, false)

    return { allowed: true, throttled: false }
  }

  /**
   * Update tenant statistics
   */
  private updateStats(
    tenantId: string,
    readUnits: number,
    writeUnits: number,
    throttled: boolean,
  ): void {
    let stats = this.stats.get(tenantId)

    if (!stats) {
      stats = {
        tenantId,
        currentReadCapacity: 0,
        currentWriteCapacity: 0,
        totalReadCapacity: 0,
        totalWriteCapacity: 0,
        estimatedItems: 0,
        estimatedStorageBytes: 0,
        throttledRequests: 0,
        lastUpdated: Date.now(),
      }
      this.stats.set(tenantId, stats)
    }

    stats.totalReadCapacity += readUnits
    stats.totalWriteCapacity += writeUnits
    stats.currentReadCapacity = this.windows.get(tenantId)?.readUnits ?? 0
    stats.currentWriteCapacity = this.windows.get(tenantId)?.writeUnits ?? 0

    if (throttled) {
      stats.throttledRequests++
    }

    stats.lastUpdated = Date.now()
  }

  /**
   * Update item count estimate for tenant
   */
  updateItemCount(tenantId: string, delta: number): void {
    let stats = this.stats.get(tenantId)
    if (!stats) {
      stats = {
        tenantId,
        currentReadCapacity: 0,
        currentWriteCapacity: 0,
        totalReadCapacity: 0,
        totalWriteCapacity: 0,
        estimatedItems: 0,
        estimatedStorageBytes: 0,
        throttledRequests: 0,
        lastUpdated: Date.now(),
      }
      this.stats.set(tenantId, stats)
    }

    stats.estimatedItems += delta
    if (stats.estimatedItems < 0)
      stats.estimatedItems = 0
    stats.lastUpdated = Date.now()
  }

  /**
   * Update storage estimate for tenant
   */
  updateStorageSize(tenantId: string, delta: number): void {
    let stats = this.stats.get(tenantId)
    if (!stats) {
      stats = {
        tenantId,
        currentReadCapacity: 0,
        currentWriteCapacity: 0,
        totalReadCapacity: 0,
        totalWriteCapacity: 0,
        estimatedItems: 0,
        estimatedStorageBytes: 0,
        throttledRequests: 0,
        lastUpdated: Date.now(),
      }
      this.stats.set(tenantId, stats)
    }

    stats.estimatedStorageBytes += delta
    if (stats.estimatedStorageBytes < 0)
      stats.estimatedStorageBytes = 0
    stats.lastUpdated = Date.now()
  }

  /**
   * Get statistics for a tenant
   */
  getStats(tenantId: string): TenantCapacityStats | null {
    return this.stats.get(tenantId) ?? null
  }

  /**
   * Get statistics for all tenants
   */
  getAllStats(): TenantCapacityStats[] {
    return Array.from(this.stats.values())
  }

  /**
   * Check if tenant is within limits
   */
  isWithinLimits(tenantId: string): {
    withinLimits: boolean
    itemLimitExceeded: boolean
    storageLimitExceeded: boolean
    readCapacityWarning: boolean
    writeCapacityWarning: boolean
  } {
    const config = this.getTenantConfig(tenantId)
    const stats = this.stats.get(tenantId)

    if (!stats) {
      return {
        withinLimits: true,
        itemLimitExceeded: false,
        storageLimitExceeded: false,
        readCapacityWarning: false,
        writeCapacityWarning: false,
      }
    }

    const itemLimitExceeded = config.maxItems !== undefined
      && stats.estimatedItems > config.maxItems

    const storageLimitExceeded = config.maxStorageBytes !== undefined
      && stats.estimatedStorageBytes > config.maxStorageBytes

    const readCapacityWarning = config.maxReadCapacity !== undefined
      && stats.currentReadCapacity > config.maxReadCapacity * 0.8

    const writeCapacityWarning = config.maxWriteCapacity !== undefined
      && stats.currentWriteCapacity > config.maxWriteCapacity * 0.8

    return {
      withinLimits: !itemLimitExceeded && !storageLimitExceeded,
      itemLimitExceeded,
      storageLimitExceeded,
      readCapacityWarning,
      writeCapacityWarning,
    }
  }

  /**
   * Reset statistics for a tenant
   */
  resetStats(tenantId: string): void {
    this.stats.delete(tenantId)
    this.windows.delete(tenantId)
  }

  /**
   * Reset all statistics
   */
  resetAllStats(): void {
    this.stats.clear()
    this.windows.clear()
  }

  /**
   * Get capacity usage as percentage
   */
  getCapacityUsagePercent(tenantId: string): {
    readPercent: number
    writePercent: number
  } {
    const config = this.getTenantConfig(tenantId)
    const stats = this.stats.get(tenantId)

    if (!stats) {
      return { readPercent: 0, writePercent: 0 }
    }

    return {
      readPercent: config.maxReadCapacity
        ? (stats.currentReadCapacity / config.maxReadCapacity) * 100
        : 0,
      writePercent: config.maxWriteCapacity
        ? (stats.currentWriteCapacity / config.maxWriteCapacity) * 100
        : 0,
    }
  }

  /**
   * Get cost estimate for tenant
   * Based on on-demand pricing: $1.25 per million RCU, $1.25 per million WCU
   */
  getCostEstimate(tenantId: string): {
    readCost: number
    writeCost: number
    totalCost: number
  } {
    const stats = this.stats.get(tenantId)

    if (!stats) {
      return { readCost: 0, writeCost: 0, totalCost: 0 }
    }

    const readCost = (stats.totalReadCapacity / 1000000) * 1.25
    const writeCost = (stats.totalWriteCapacity / 1000000) * 1.25

    return {
      readCost,
      writeCost,
      totalCost: readCost + writeCost,
    }
  }
}

/**
 * Create a tenant capacity manager
 */
export function createTenantCapacityManager(
  defaultConfig?: TenantCapacityConfig,
): TenantCapacityManager {
  return new TenantCapacityManager(defaultConfig)
}
