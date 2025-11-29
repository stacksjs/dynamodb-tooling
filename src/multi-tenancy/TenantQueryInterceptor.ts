// ============================================================================
// Tenant Query Interceptor - Auto-inject tenant context into queries
// ============================================================================

import type { TenantIsolationStrategy } from '../types'
import { TenantIsolation } from './TenantIsolation'
import { CrossTenantAccessError, type TenantManager } from './TenantManager'

/**
 * Intercepted query with tenant modifications
 */
export interface InterceptedQuery {
  /** Modified table name */
  tableName: string
  /** Modified key condition */
  keyCondition?: {
    pk?: string
    sk?: string
    pkOperator?: string
    skOperator?: string
  }
  /** Filter expression additions */
  filterExpression?: string
  /** Expression attribute values additions */
  expressionAttributeValues?: Record<string, unknown>
  /** Expression attribute names additions */
  expressionAttributeNames?: Record<string, string>
  /** Additional item attributes for writes */
  additionalAttributes?: Record<string, unknown>
  /** Index to use */
  indexName?: string
}

/**
 * Query interceptor options
 */
export interface TenantQueryInterceptorOptions {
  /** Tenant manager instance */
  tenantManager: TenantManager
  /** Strategy-specific options */
  strategyOptions?: Record<string, unknown>
  /** Whether to validate results */
  validateResults?: boolean
  /** Whether to strip tenant info from results */
  stripTenantInfo?: boolean
}

/**
 * Tenant query interceptor
 * Automatically injects tenant context into all queries
 */
export class TenantQueryInterceptor {
  private tenantManager: TenantManager
  private isolation: TenantIsolation
  private options: TenantQueryInterceptorOptions

  constructor(options: TenantQueryInterceptorOptions) {
    this.options = {
      validateResults: true,
      stripTenantInfo: true,
      ...options,
    }
    this.tenantManager = options.tenantManager
    const strategy = this.tenantManager.getStrategy()
    this.isolation = new TenantIsolation(strategy, options.strategyOptions)
  }

  /**
   * Check if interceptor is active
   */
  isActive(): boolean {
    return this.tenantManager.isEnabled()
  }

  /**
   * Get current tenant ID
   */
  async getTenantId(): Promise<string> {
    return this.tenantManager.getCurrentTenantId()
  }

  /**
   * Intercept a GetItem operation
   */
  async interceptGetItem(
    tableName: string,
    pk: string,
    sk?: string,
  ): Promise<InterceptedQuery> {
    if (!this.isActive()) {
      return { tableName, keyCondition: { pk, sk } }
    }

    const tenantId = await this.getTenantId()

    return {
      tableName: this.isolation.transformTableName(tableName, tenantId),
      keyCondition: {
        pk: this.isolation.transformPk(pk, tenantId),
        sk: sk ? this.isolation.transformSk(sk, tenantId) : undefined,
      },
    }
  }

  /**
   * Intercept a PutItem operation
   */
  async interceptPutItem(
    tableName: string,
    item: Record<string, unknown>,
  ): Promise<{ tableName: string, item: Record<string, unknown> }> {
    if (!this.isActive()) {
      return { tableName, item }
    }

    const tenantId = await this.getTenantId()

    return {
      tableName: this.isolation.transformTableName(tableName, tenantId),
      item: this.isolation.transformItemForStorage(item, tenantId),
    }
  }

  /**
   * Intercept a Query operation
   */
  async interceptQuery(
    tableName: string,
    keyCondition: { pk: string, pkOperator?: string, sk?: string, skOperator?: string },
    indexName?: string,
  ): Promise<InterceptedQuery> {
    if (!this.isActive()) {
      return { tableName, keyCondition, indexName }
    }

    const tenantId = await this.getTenantId()
    const transformedTableName = this.isolation.transformTableName(tableName, tenantId)

    // Transform key condition
    const transformedKeyCondition = {
      pk: this.isolation.transformPk(keyCondition.pk, tenantId),
      pkOperator: keyCondition.pkOperator || '=',
      sk: keyCondition.sk ? this.isolation.transformSk(keyCondition.sk, tenantId) : undefined,
      skOperator: keyCondition.skOperator,
    }

    // Get filter expression for attribute strategy
    const filterInfo = this.isolation.getFilterExpression(tenantId)

    return {
      tableName: transformedTableName,
      keyCondition: transformedKeyCondition,
      filterExpression: filterInfo.expression,
      expressionAttributeValues: filterInfo.values,
      indexName,
    }
  }

  /**
   * Intercept a Scan operation
   */
  async interceptScan(
    tableName: string,
    indexName?: string,
  ): Promise<InterceptedQuery> {
    if (!this.isActive()) {
      return { tableName, indexName }
    }

    const tenantId = await this.getTenantId()
    const filterInfo = this.isolation.getFilterExpression(tenantId)

    return {
      tableName: this.isolation.transformTableName(tableName, tenantId),
      filterExpression: filterInfo.expression,
      expressionAttributeValues: filterInfo.values,
      indexName,
    }
  }

  /**
   * Intercept a DeleteItem operation
   */
  async interceptDeleteItem(
    tableName: string,
    pk: string,
    sk?: string,
  ): Promise<InterceptedQuery> {
    // Same as GetItem for key transformation
    return this.interceptGetItem(tableName, pk, sk)
  }

  /**
   * Intercept an UpdateItem operation
   */
  async interceptUpdateItem(
    tableName: string,
    pk: string,
    sk?: string,
    updates?: Record<string, unknown>,
  ): Promise<InterceptedQuery & { additionalAttributes?: Record<string, unknown> }> {
    if (!this.isActive()) {
      return { tableName, keyCondition: { pk, sk } }
    }

    const tenantId = await this.getTenantId()

    // For attribute strategy, ensure tenant attribute is maintained
    let additionalAttributes: Record<string, unknown> | undefined
    if (this.isolation.getStrategy().type === 'attribute' && updates) {
      additionalAttributes = this.isolation.getAdditionalAttributes(tenantId)
    }

    return {
      tableName: this.isolation.transformTableName(tableName, tenantId),
      keyCondition: {
        pk: this.isolation.transformPk(pk, tenantId),
        sk: sk ? this.isolation.transformSk(sk, tenantId) : undefined,
      },
      additionalAttributes,
    }
  }

  /**
   * Intercept a BatchGetItem operation
   */
  async interceptBatchGetItem(
    requests: Array<{ tableName: string, pk: string, sk?: string }>,
  ): Promise<Array<InterceptedQuery>> {
    if (!this.isActive()) {
      return requests.map(r => ({
        tableName: r.tableName,
        keyCondition: { pk: r.pk, sk: r.sk },
      }))
    }

    const tenantId = await this.getTenantId()

    return requests.map(r => ({
      tableName: this.isolation.transformTableName(r.tableName, tenantId),
      keyCondition: {
        pk: this.isolation.transformPk(r.pk, tenantId),
        sk: r.sk ? this.isolation.transformSk(r.sk, tenantId) : undefined,
      },
    }))
  }

  /**
   * Intercept a BatchWriteItem operation
   */
  async interceptBatchWriteItem(
    requests: Array<{ tableName: string, operation: 'put' | 'delete', item?: Record<string, unknown>, pk?: string, sk?: string }>,
  ): Promise<Array<{ tableName: string, operation: 'put' | 'delete', item?: Record<string, unknown>, pk?: string, sk?: string }>> {
    if (!this.isActive()) {
      return requests
    }

    const tenantId = await this.getTenantId()

    return requests.map((r) => {
      const tableName = this.isolation.transformTableName(r.tableName, tenantId)

      if (r.operation === 'put' && r.item) {
        return {
          tableName,
          operation: r.operation,
          item: this.isolation.transformItemForStorage(r.item, tenantId),
        }
      }
      else {
        return {
          tableName,
          operation: r.operation,
          pk: r.pk ? this.isolation.transformPk(r.pk, tenantId) : undefined,
          sk: r.sk ? this.isolation.transformSk(r.sk, tenantId) : undefined,
        }
      }
    })
  }

  /**
   * Validate and transform query results
   */
  async processResults<T extends Record<string, unknown>>(
    items: T[],
  ): Promise<T[]> {
    if (!this.isActive()) {
      return items
    }

    const tenantId = await this.getTenantId()
    const processed: T[] = []

    for (const item of items) {
      // Validate item belongs to tenant
      if (this.options.validateResults && !this.isolation.validateItem(item, tenantId)) {
        // This shouldn't happen if queries are properly intercepted
        throw new CrossTenantAccessError(
          (item as Record<string, unknown>).tenantId as string || 'unknown',
          tenantId,
        )
      }

      // Transform item for client
      if (this.options.stripTenantInfo) {
        processed.push(this.isolation.transformItemForClient(item, tenantId) as T)
      }
      else {
        processed.push(item)
      }
    }

    return processed
  }

  /**
   * Process single result item
   */
  async processResult<T extends Record<string, unknown>>(
    item: T | null,
  ): Promise<T | null> {
    if (!item) return null
    const results = await this.processResults([item])
    return results[0] || null
  }
}

/**
 * Create a tenant query interceptor
 */
export function createTenantQueryInterceptor(
  options: TenantQueryInterceptorOptions,
): TenantQueryInterceptor {
  return new TenantQueryInterceptor(options)
}
