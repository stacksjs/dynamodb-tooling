// ============================================================================
// Tenant Manager - Core Multi-Tenancy Management
// ============================================================================

import type { TenantIsolationStrategy } from '../types'

/**
 * Tenant context data
 */
export interface TenantContextData {
  /** Unique tenant identifier */
  tenantId: string
  /** Optional tenant name for logging */
  tenantName?: string
  /** Tenant-specific metadata */
  metadata?: Record<string, unknown>
  /** When the context was created */
  createdAt: number
}

/**
 * Tenant resolver function type
 */
export type TenantResolver = () => string | Promise<string>

/**
 * Tenant manager configuration
 */
export interface TenantManagerConfig {
  /** Enable multi-tenancy */
  enabled: boolean
  /** Isolation strategy */
  strategy: TenantIsolationStrategy
  /** Attribute name for tenant ID (for 'attribute' strategy) */
  tenantIdAttribute: string
  /** Function to resolve current tenant */
  tenantResolver?: TenantResolver
  /** Throw error if no tenant context */
  requireTenant: boolean
  /** Default tenant ID (for development/testing) */
  defaultTenantId?: string
}

/**
 * Default configuration
 */
const defaultConfig: TenantManagerConfig = {
  enabled: false,
  strategy: 'prefix',
  tenantIdAttribute: 'tenantId',
  requireTenant: true,
}

// Global tenant context (using AsyncLocalStorage-like pattern)
let globalTenantContext: TenantContextData | null = null
const contextStack: TenantContextData[] = []

/**
 * Tenant context manager (similar to AsyncLocalStorage)
 */
export class TenantContext {
  private static instance: TenantContext | null = null
  private storage: Map<string, TenantContextData> = new Map()

  static getInstance(): TenantContext {
    if (!TenantContext.instance) {
      TenantContext.instance = new TenantContext()
    }
    return TenantContext.instance
  }

  /**
   * Set tenant context for current execution
   */
  set(tenantId: string, metadata?: Record<string, unknown>): TenantContextData {
    const context: TenantContextData = {
      tenantId,
      metadata,
      createdAt: Date.now(),
    }
    globalTenantContext = context
    this.storage.set(tenantId, context)
    return context
  }

  /**
   * Get current tenant context
   */
  get(): TenantContextData | null {
    return globalTenantContext
  }

  /**
   * Clear current tenant context
   */
  clear(): void {
    globalTenantContext = null
  }

  /**
   * Run function with tenant context
   */
  async run<T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> {
    const previousContext = globalTenantContext
    this.set(tenantId)
    try {
      return await fn()
    }
    finally {
      globalTenantContext = previousContext
    }
  }

  /**
   * Push a new tenant context onto the stack
   */
  push(tenantId: string, metadata?: Record<string, unknown>): void {
    if (globalTenantContext) {
      contextStack.push(globalTenantContext)
    }
    this.set(tenantId, metadata)
  }

  /**
   * Pop the current tenant context and restore previous
   */
  pop(): TenantContextData | null {
    const current = globalTenantContext
    globalTenantContext = contextStack.pop() || null
    return current
  }
}

/**
 * Core tenant manager
 */
export class TenantManager {
  private config: TenantManagerConfig
  private context: TenantContext

  constructor(config?: Partial<TenantManagerConfig>) {
    this.config = { ...defaultConfig, ...config }
    this.context = TenantContext.getInstance()
  }

  /**
   * Check if multi-tenancy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get the current isolation strategy
   */
  getStrategy(): TenantIsolationStrategy {
    return this.config.strategy
  }

  /**
   * Get the tenant ID attribute name
   */
  getTenantIdAttribute(): string {
    return this.config.tenantIdAttribute
  }

  /**
   * Get the current tenant ID
   */
  async getCurrentTenantId(): Promise<string> {
    // Try resolver first
    if (this.config.tenantResolver) {
      return this.config.tenantResolver()
    }

    // Try context
    const ctx = this.context.get()
    if (ctx) {
      return ctx.tenantId
    }

    // Try default
    if (this.config.defaultTenantId) {
      return this.config.defaultTenantId
    }

    // Error if required
    if (this.config.requireTenant) {
      throw new TenantNotFoundError('No tenant context found and no default tenant configured')
    }

    return ''
  }

  /**
   * Get the current tenant ID synchronously (may throw)
   */
  getCurrentTenantIdSync(): string {
    const ctx = this.context.get()
    if (ctx) {
      return ctx.tenantId
    }

    if (this.config.defaultTenantId) {
      return this.config.defaultTenantId
    }

    if (this.config.requireTenant) {
      throw new TenantNotFoundError('No tenant context found')
    }

    return ''
  }

  /**
   * Set the current tenant context
   */
  setTenant(tenantId: string, metadata?: Record<string, unknown>): void {
    this.context.set(tenantId, metadata)
  }

  /**
   * Clear the current tenant context
   */
  clearTenant(): void {
    this.context.clear()
  }

  /**
   * Execute function with tenant context
   */
  async withTenant<T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> {
    return this.context.run(tenantId, fn)
  }

  /**
   * Get table name for tenant (for table-per-tenant strategy)
   */
  getTableNameForTenant(baseTableName: string, tenantId?: string): string {
    if (this.config.strategy !== 'table') {
      return baseTableName
    }

    const tenant = tenantId ?? this.getCurrentTenantIdSync()
    if (!tenant) {
      return baseTableName
    }

    return `${baseTableName}_${tenant}`
  }

  /**
   * Get pk prefix for tenant (for prefix strategy)
   */
  getPkPrefixForTenant(entityPrefix: string, tenantId?: string): string {
    if (this.config.strategy !== 'prefix') {
      return entityPrefix
    }

    const tenant = tenantId ?? this.getCurrentTenantIdSync()
    if (!tenant) {
      return entityPrefix
    }

    return `TENANT#${tenant}#${entityPrefix}`
  }

  /**
   * Get tenant attributes to add to item (for attribute strategy)
   */
  getTenantAttributes(tenantId?: string): Record<string, string> {
    if (this.config.strategy !== 'attribute') {
      return {}
    }

    const tenant = tenantId ?? this.getCurrentTenantIdSync()
    if (!tenant) {
      return {}
    }

    return {
      [this.config.tenantIdAttribute]: tenant,
    }
  }

  /**
   * Validate tenant access to item
   */
  validateTenantAccess(item: Record<string, unknown>): boolean {
    if (!this.config.enabled) {
      return true
    }

    const currentTenantId = this.getCurrentTenantIdSync()
    if (!currentTenantId) {
      return !this.config.requireTenant
    }

    switch (this.config.strategy) {
      case 'attribute': {
        const itemTenantId = item[this.config.tenantIdAttribute]
        return itemTenantId === currentTenantId
      }

      case 'prefix': {
        const pk = item.pk as string
        if (!pk)
          return false
        return pk.startsWith(`TENANT#${currentTenantId}#`)
      }

      case 'table':
        // Table strategy doesn't need item-level validation
        return true

      default:
        return true
    }
  }

  /**
   * Get current tenant context
   */
  getContext(): TenantContextData | null {
    return this.context.get()
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TenantManagerConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * Tenant not found error
 */
export class TenantNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TenantNotFoundError'
  }
}

/**
 * Cross-tenant access error
 */
export class CrossTenantAccessError extends Error {
  public readonly attemptedTenantId: string
  public readonly currentTenantId: string

  constructor(attemptedTenantId: string, currentTenantId: string) {
    super(`Cross-tenant access denied: attempted to access tenant ${attemptedTenantId} from tenant ${currentTenantId}`)
    this.name = 'CrossTenantAccessError'
    this.attemptedTenantId = attemptedTenantId
    this.currentTenantId = currentTenantId
  }
}

// Singleton instance
let tenantManagerInstance: TenantManager | null = null

/**
 * Create or get the tenant manager instance
 */
export function createTenantManager(config?: Partial<TenantManagerConfig>): TenantManager {
  if (!tenantManagerInstance || config) {
    tenantManagerInstance = new TenantManager(config)
  }
  return tenantManagerInstance
}

/**
 * Set tenant context (convenience function)
 */
export function setTenantContext(tenantId: string, metadata?: Record<string, unknown>): void {
  TenantContext.getInstance().set(tenantId, metadata)
}

/**
 * Get tenant context (convenience function)
 */
export function getTenantContext(): TenantContextData | null {
  return TenantContext.getInstance().get()
}

/**
 * Clear tenant context (convenience function)
 */
export function clearTenantContext(): void {
  TenantContext.getInstance().clear()
}

/**
 * Execute with tenant context (convenience function)
 */
export async function withTenant<T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> {
  return TenantContext.getInstance().run(tenantId, fn)
}
