// ============================================================================
// Tenant Isolation Strategies
// ============================================================================

import type { TenantIsolationStrategy } from '../types'

/**
 * Base isolation strategy interface
 */
export interface IsolationStrategy {
  /** Strategy type */
  type: TenantIsolationStrategy
  /** Transform table name for tenant */
  transformTableName(tableName: string, tenantId: string): string
  /** Transform pk for tenant */
  transformPk(pk: string, tenantId: string): string
  /** Transform sk for tenant */
  transformSk(sk: string, tenantId: string): string
  /** Get additional attributes to add to items */
  getAdditionalAttributes(tenantId: string): Record<string, unknown>
  /** Get filter expression for queries */
  getFilterExpression(tenantId: string): { expression?: string, values?: Record<string, unknown> }
  /** Validate item belongs to tenant */
  validateItem(item: Record<string, unknown>, tenantId: string): boolean
  /** Extract original pk from tenant-prefixed pk */
  extractOriginalPk(pk: string, tenantId: string): string
  /** Extract original sk from tenant-prefixed sk */
  extractOriginalSk(sk: string, tenantId: string): string
}

/**
 * Table-per-tenant strategy
 * Each tenant gets their own DynamoDB table
 */
export interface TablePerTenantStrategy extends IsolationStrategy {
  type: 'table'
  tableNamePattern: string
}

/**
 * Prefix isolation strategy
 * Tenant ID is prefixed to pk: TENANT#123#USER#456
 */
export interface PrefixIsolationStrategy extends IsolationStrategy {
  type: 'prefix'
  prefix: string
  delimiter: string
}

/**
 * Attribute isolation strategy
 * Tenant ID stored as separate attribute with GSI
 */
export interface AttributeIsolationStrategy extends IsolationStrategy {
  type: 'attribute'
  attributeName: string
  gsiName: string
}

/**
 * Create table-per-tenant isolation strategy
 */
export function createTablePerTenantIsolation(
  tableNamePattern: string = '{table}_{tenant}',
): TablePerTenantStrategy {
  return {
    type: 'table',
    tableNamePattern,

    transformTableName(tableName: string, tenantId: string): string {
      return tableNamePattern
        .replace('{table}', tableName)
        .replace('{tenant}', tenantId)
    },

    transformPk(pk: string, _tenantId: string): string {
      // No pk transformation needed - separate table
      return pk
    },

    transformSk(sk: string, _tenantId: string): string {
      // No sk transformation needed - separate table
      return sk
    },

    getAdditionalAttributes(_tenantId: string): Record<string, unknown> {
      // No additional attributes needed
      return {}
    },

    getFilterExpression(_tenantId: string): { expression?: string, values?: Record<string, unknown> } {
      // No filter needed - already isolated by table
      return {}
    },

    validateItem(_item: Record<string, unknown>, _tenantId: string): boolean {
      // Table isolation guarantees tenant ownership
      return true
    },

    extractOriginalPk(pk: string, _tenantId: string): string {
      return pk
    },

    extractOriginalSk(sk: string, _tenantId: string): string {
      return sk
    },
  }
}

/**
 * Create prefix isolation strategy
 */
export function createPrefixIsolation(
  prefix: string = 'TENANT',
  delimiter: string = '#',
): PrefixIsolationStrategy {
  const tenantPrefix = (tenantId: string): string => `${prefix}${delimiter}${tenantId}${delimiter}`

  return {
    type: 'prefix',
    prefix,
    delimiter,

    transformTableName(tableName: string, _tenantId: string): string {
      // Same table for all tenants
      return tableName
    },

    transformPk(pk: string, tenantId: string): string {
      // Prefix pk with tenant: TENANT#123#USER#456
      return `${tenantPrefix(tenantId)}${pk}`
    },

    transformSk(sk: string, _tenantId: string): string {
      // SK typically doesn't need tenant prefix (pk provides isolation)
      return sk
    },

    getAdditionalAttributes(_tenantId: string): Record<string, unknown> {
      // No additional attributes - tenant info is in pk
      return {}
    },

    getFilterExpression(tenantId: string): { expression?: string, values?: Record<string, unknown> } {
      // Filter by pk prefix for scans
      return {
        expression: 'begins_with(pk, :tenantPrefix)',
        values: {
          ':tenantPrefix': tenantPrefix(tenantId),
        },
      }
    },

    validateItem(item: Record<string, unknown>, tenantId: string): boolean {
      const pk = item.pk as string
      if (!pk) return false
      return pk.startsWith(tenantPrefix(tenantId))
    },

    extractOriginalPk(pk: string, tenantId: string): string {
      const prefixStr = tenantPrefix(tenantId)
      if (pk.startsWith(prefixStr)) {
        return pk.slice(prefixStr.length)
      }
      return pk
    },

    extractOriginalSk(sk: string, _tenantId: string): string {
      return sk
    },
  }
}

/**
 * Create attribute isolation strategy
 */
export function createAttributeIsolation(
  attributeName: string = 'tenantId',
  gsiName: string = 'gsi-tenant',
): AttributeIsolationStrategy {
  return {
    type: 'attribute',
    attributeName,
    gsiName,

    transformTableName(tableName: string, _tenantId: string): string {
      // Same table for all tenants
      return tableName
    },

    transformPk(pk: string, _tenantId: string): string {
      // No pk transformation - tenant is in attribute
      return pk
    },

    transformSk(sk: string, _tenantId: string): string {
      // No sk transformation
      return sk
    },

    getAdditionalAttributes(tenantId: string): Record<string, unknown> {
      // Add tenant ID as attribute
      return {
        [attributeName]: tenantId,
      }
    },

    getFilterExpression(tenantId: string): { expression?: string, values?: Record<string, unknown> } {
      // Filter by tenant attribute
      return {
        expression: `${attributeName} = :tenantId`,
        values: {
          ':tenantId': tenantId,
        },
      }
    },

    validateItem(item: Record<string, unknown>, tenantId: string): boolean {
      return item[attributeName] === tenantId
    },

    extractOriginalPk(pk: string, _tenantId: string): string {
      return pk
    },

    extractOriginalSk(sk: string, _tenantId: string): string {
      return sk
    },
  }
}

/**
 * Main tenant isolation class
 */
export class TenantIsolation {
  private strategy: IsolationStrategy

  constructor(strategyType: TenantIsolationStrategy, options?: Record<string, unknown>) {
    switch (strategyType) {
      case 'table':
        this.strategy = createTablePerTenantIsolation(
          options?.tableNamePattern as string | undefined,
        )
        break
      case 'prefix':
        this.strategy = createPrefixIsolation(
          options?.prefix as string | undefined,
          options?.delimiter as string | undefined,
        )
        break
      case 'attribute':
        this.strategy = createAttributeIsolation(
          options?.attributeName as string | undefined,
          options?.gsiName as string | undefined,
        )
        break
      default:
        throw new Error(`Unknown isolation strategy: ${strategyType}`)
    }
  }

  /**
   * Get the underlying strategy
   */
  getStrategy(): IsolationStrategy {
    return this.strategy
  }

  /**
   * Transform table name for tenant
   */
  transformTableName(tableName: string, tenantId: string): string {
    return this.strategy.transformTableName(tableName, tenantId)
  }

  /**
   * Transform pk for tenant
   */
  transformPk(pk: string, tenantId: string): string {
    return this.strategy.transformPk(pk, tenantId)
  }

  /**
   * Transform sk for tenant
   */
  transformSk(sk: string, tenantId: string): string {
    return this.strategy.transformSk(sk, tenantId)
  }

  /**
   * Get additional attributes for items
   */
  getAdditionalAttributes(tenantId: string): Record<string, unknown> {
    return this.strategy.getAdditionalAttributes(tenantId)
  }

  /**
   * Get filter expression for queries
   */
  getFilterExpression(tenantId: string): { expression?: string, values?: Record<string, unknown> } {
    return this.strategy.getFilterExpression(tenantId)
  }

  /**
   * Validate item belongs to tenant
   */
  validateItem(item: Record<string, unknown>, tenantId: string): boolean {
    return this.strategy.validateItem(item, tenantId)
  }

  /**
   * Extract original pk
   */
  extractOriginalPk(pk: string, tenantId: string): string {
    return this.strategy.extractOriginalPk(pk, tenantId)
  }

  /**
   * Extract original sk
   */
  extractOriginalSk(sk: string, tenantId: string): string {
    return this.strategy.extractOriginalSk(sk, tenantId)
  }

  /**
   * Transform a complete item for storage
   */
  transformItemForStorage(item: Record<string, unknown>, tenantId: string): Record<string, unknown> {
    const transformed = { ...item }

    if (transformed.pk) {
      transformed.pk = this.transformPk(transformed.pk as string, tenantId)
    }

    if (transformed.sk) {
      transformed.sk = this.transformSk(transformed.sk as string, tenantId)
    }

    const additionalAttrs = this.getAdditionalAttributes(tenantId)
    return { ...transformed, ...additionalAttrs }
  }

  /**
   * Transform a retrieved item for client
   */
  transformItemForClient(item: Record<string, unknown>, tenantId: string): Record<string, unknown> {
    const transformed = { ...item }

    if (transformed.pk) {
      transformed.pk = this.extractOriginalPk(transformed.pk as string, tenantId)
    }

    if (transformed.sk) {
      transformed.sk = this.extractOriginalSk(transformed.sk as string, tenantId)
    }

    // Optionally remove tenant attribute
    if (this.strategy.type === 'attribute') {
      const attrStrategy = this.strategy as AttributeIsolationStrategy
      delete transformed[attrStrategy.attributeName]
    }

    return transformed
  }
}
