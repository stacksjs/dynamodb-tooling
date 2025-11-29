// ============================================================================
// Multi-Tenancy Module Tests
// ============================================================================

import { describe, expect, it, beforeEach } from 'bun:test'
import {
  // Tenant management
  TenantManager,
  createTenantManager,
  TenantContext,
  setTenantContext,
  getTenantContext,
  clearTenantContext,
  withTenant,
  TenantNotFoundError,
  CrossTenantAccessError,

  // Tenant isolation
  TenantIsolation,
  createTablePerTenantIsolation,
  createPrefixIsolation,
  createAttributeIsolation,

  // Query interceptor
  TenantQueryInterceptor,
  createTenantQueryInterceptor,

  // Capacity management
  TenantCapacityManager,
  createTenantCapacityManager,
} from '../src/index'

describe('TenantContext', () => {
  beforeEach(() => {
    clearTenantContext()
  })

  it('should set and get tenant context', () => {
    setTenantContext('tenant-123')
    const context = getTenantContext()

    expect(context).not.toBeNull()
    expect(context?.tenantId).toBe('tenant-123')
  })

  it('should clear tenant context', () => {
    setTenantContext('tenant-123')
    clearTenantContext()

    expect(getTenantContext()).toBeNull()
  })

  it('should support metadata', () => {
    setTenantContext('tenant-123', { plan: 'enterprise' })
    const context = getTenantContext()

    expect(context?.metadata?.plan).toBe('enterprise')
  })

  it('should run function with tenant context', async () => {
    let capturedTenantId = ''

    await withTenant('tenant-456', () => {
      capturedTenantId = getTenantContext()?.tenantId || ''
    })

    expect(capturedTenantId).toBe('tenant-456')
  })

  it('should restore previous context after withTenant', async () => {
    setTenantContext('tenant-original')

    await withTenant('tenant-temporary', () => {
      // Inside withTenant
    })

    expect(getTenantContext()?.tenantId).toBe('tenant-original')
  })
})

describe('TenantManager', () => {
  beforeEach(() => {
    clearTenantContext()
  })

  describe('configuration', () => {
    it('should be disabled by default', () => {
      const manager = createTenantManager()
      expect(manager.isEnabled()).toBe(false)
    })

    it('should use default prefix strategy', () => {
      const manager = createTenantManager({ enabled: true })
      expect(manager.getStrategy()).toBe('prefix')
    })

    it('should use configured strategy', () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'table',
      })
      expect(manager.getStrategy()).toBe('table')
    })
  })

  describe('tenant resolution', () => {
    it('should get tenant from context', async () => {
      const manager = createTenantManager({ enabled: true, requireTenant: false })
      setTenantContext('tenant-ctx')

      const tenantId = await manager.getCurrentTenantId()
      expect(tenantId).toBe('tenant-ctx')
    })

    it('should use resolver if provided', async () => {
      const manager = createTenantManager({
        enabled: true,
        tenantResolver: () => 'resolved-tenant',
      })

      const tenantId = await manager.getCurrentTenantId()
      expect(tenantId).toBe('resolved-tenant')
    })

    it('should use default tenant if no context', async () => {
      const manager = createTenantManager({
        enabled: true,
        defaultTenantId: 'default-tenant',
      })

      const tenantId = await manager.getCurrentTenantId()
      expect(tenantId).toBe('default-tenant')
    })

    it('should throw if required and no tenant', async () => {
      const manager = createTenantManager({
        enabled: true,
        requireTenant: true,
      })

      await expect(manager.getCurrentTenantId()).rejects.toThrow(TenantNotFoundError)
    })
  })

  describe('key transformation', () => {
    it('should transform pk for prefix strategy', () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'prefix',
      })
      manager.setTenant('tenant-123')

      const pk = manager.getPkPrefixForTenant('USER#456')
      expect(pk).toBe('TENANT#tenant-123#USER#456')
    })

    it('should transform table name for table strategy', () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'table',
      })
      manager.setTenant('tenant-123')

      const tableName = manager.getTableNameForTenant('MainTable')
      expect(tableName).toBe('MainTable_tenant-123')
    })

    it('should get tenant attributes for attribute strategy', () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'attribute',
        tenantIdAttribute: 'tenantId',
      })
      manager.setTenant('tenant-123')

      const attrs = manager.getTenantAttributes()
      expect(attrs.tenantId).toBe('tenant-123')
    })
  })

  describe('tenant validation', () => {
    it('should validate item for prefix strategy', () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'prefix',
      })
      manager.setTenant('tenant-123')

      const validItem = { pk: 'TENANT#tenant-123#USER#456', sk: 'PROFILE' }
      expect(manager.validateTenantAccess(validItem)).toBe(true)

      const invalidItem = { pk: 'TENANT#other-tenant#USER#456', sk: 'PROFILE' }
      expect(manager.validateTenantAccess(invalidItem)).toBe(false)
    })

    it('should validate item for attribute strategy', () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'attribute',
        tenantIdAttribute: 'tenantId',
      })
      manager.setTenant('tenant-123')

      const validItem = { pk: 'USER#456', tenantId: 'tenant-123' }
      expect(manager.validateTenantAccess(validItem)).toBe(true)

      const invalidItem = { pk: 'USER#456', tenantId: 'other-tenant' }
      expect(manager.validateTenantAccess(invalidItem)).toBe(false)
    })
  })
})

describe('TenantIsolation', () => {
  describe('table-per-tenant strategy', () => {
    it('should transform table name', () => {
      const isolation = new TenantIsolation('table')

      expect(isolation.transformTableName('MainTable', 'tenant-123'))
        .toBe('MainTable_tenant-123')
    })

    it('should not transform pk', () => {
      const isolation = new TenantIsolation('table')

      expect(isolation.transformPk('USER#456', 'tenant-123'))
        .toBe('USER#456')
    })

    it('should validate all items (table provides isolation)', () => {
      const isolation = new TenantIsolation('table')

      expect(isolation.validateItem({ pk: 'anything' }, 'tenant-123')).toBe(true)
    })
  })

  describe('prefix strategy', () => {
    it('should transform pk with tenant prefix', () => {
      const isolation = new TenantIsolation('prefix')

      expect(isolation.transformPk('USER#456', 'tenant-123'))
        .toBe('TENANT#tenant-123#USER#456')
    })

    it('should not transform table name', () => {
      const isolation = new TenantIsolation('prefix')

      expect(isolation.transformTableName('MainTable', 'tenant-123'))
        .toBe('MainTable')
    })

    it('should validate item by pk prefix', () => {
      const isolation = new TenantIsolation('prefix')

      const validItem = { pk: 'TENANT#tenant-123#USER#456' }
      expect(isolation.validateItem(validItem, 'tenant-123')).toBe(true)

      const invalidItem = { pk: 'TENANT#other#USER#456' }
      expect(isolation.validateItem(invalidItem, 'tenant-123')).toBe(false)
    })

    it('should extract original pk', () => {
      const isolation = new TenantIsolation('prefix')

      const originalPk = isolation.extractOriginalPk('TENANT#tenant-123#USER#456', 'tenant-123')
      expect(originalPk).toBe('USER#456')
    })

    it('should get filter expression', () => {
      const isolation = new TenantIsolation('prefix')
      const filter = isolation.getFilterExpression('tenant-123')

      expect(filter.expression).toBe('begins_with(pk, :tenantPrefix)')
      expect(filter.values?.[':tenantPrefix']).toBe('TENANT#tenant-123#')
    })
  })

  describe('attribute strategy', () => {
    it('should add tenant attribute', () => {
      const isolation = new TenantIsolation('attribute', { attributeName: 'tenantId' })

      const attrs = isolation.getAdditionalAttributes('tenant-123')
      expect(attrs.tenantId).toBe('tenant-123')
    })

    it('should not transform pk', () => {
      const isolation = new TenantIsolation('attribute')

      expect(isolation.transformPk('USER#456', 'tenant-123'))
        .toBe('USER#456')
    })

    it('should validate item by tenant attribute', () => {
      const isolation = new TenantIsolation('attribute', { attributeName: 'tenantId' })

      const validItem = { pk: 'USER#456', tenantId: 'tenant-123' }
      expect(isolation.validateItem(validItem, 'tenant-123')).toBe(true)

      const invalidItem = { pk: 'USER#456', tenantId: 'other' }
      expect(isolation.validateItem(invalidItem, 'tenant-123')).toBe(false)
    })

    it('should get filter expression', () => {
      const isolation = new TenantIsolation('attribute', { attributeName: 'tenantId' })
      const filter = isolation.getFilterExpression('tenant-123')

      expect(filter.expression).toBe('tenantId = :tenantId')
      expect(filter.values?.[':tenantId']).toBe('tenant-123')
    })
  })

  describe('item transformation', () => {
    it('should transform item for storage (prefix)', () => {
      const isolation = new TenantIsolation('prefix')

      const original = { pk: 'USER#456', sk: 'PROFILE', name: 'John' }
      const transformed = isolation.transformItemForStorage(original, 'tenant-123')

      expect(transformed.pk).toBe('TENANT#tenant-123#USER#456')
      expect(transformed.name).toBe('John')
    })

    it('should transform item for client (prefix)', () => {
      const isolation = new TenantIsolation('prefix')

      const stored = { pk: 'TENANT#tenant-123#USER#456', sk: 'PROFILE', name: 'John' }
      const transformed = isolation.transformItemForClient(stored, 'tenant-123')

      expect(transformed.pk).toBe('USER#456')
    })

    it('should transform item for storage (attribute)', () => {
      const isolation = new TenantIsolation('attribute', { attributeName: 'tenantId' })

      const original = { pk: 'USER#456', name: 'John' }
      const transformed = isolation.transformItemForStorage(original, 'tenant-123')

      expect(transformed.tenantId).toBe('tenant-123')
    })

    it('should strip tenant attribute for client', () => {
      const isolation = new TenantIsolation('attribute', { attributeName: 'tenantId' })

      const stored = { pk: 'USER#456', tenantId: 'tenant-123', name: 'John' }
      const transformed = isolation.transformItemForClient(stored, 'tenant-123')

      expect(transformed.tenantId).toBeUndefined()
    })
  })
})

describe('TenantQueryInterceptor', () => {
  beforeEach(() => {
    clearTenantContext()
  })

  describe('with disabled tenant manager', () => {
    it('should pass through queries unchanged', async () => {
      const manager = createTenantManager({ enabled: false })
      const interceptor = createTenantQueryInterceptor({ tenantManager: manager })

      const result = await interceptor.interceptGetItem('Table', 'pk123', 'sk456')

      expect(result.tableName).toBe('Table')
      expect(result.keyCondition?.pk).toBe('pk123')
    })
  })

  describe('with prefix strategy', () => {
    let interceptor: TenantQueryInterceptor

    beforeEach(() => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'prefix',
      })
      manager.setTenant('tenant-abc')
      interceptor = createTenantQueryInterceptor({ tenantManager: manager })
    })

    it('should intercept GetItem', async () => {
      const result = await interceptor.interceptGetItem('Table', 'USER#123')

      expect(result.keyCondition?.pk).toBe('TENANT#tenant-abc#USER#123')
    })

    it('should intercept PutItem', async () => {
      const result = await interceptor.interceptPutItem('Table', {
        pk: 'USER#123',
        sk: 'PROFILE',
        name: 'John',
      })

      expect(result.item.pk).toBe('TENANT#tenant-abc#USER#123')
      expect(result.item.name).toBe('John')
    })

    it('should intercept Query', async () => {
      const result = await interceptor.interceptQuery('Table', {
        pk: 'USER#123',
        sk: 'ORDER#',
        skOperator: 'begins_with',
      })

      expect(result.keyCondition?.pk).toBe('TENANT#tenant-abc#USER#123')
      expect(result.filterExpression).toBeDefined()
    })

    it('should intercept Scan', async () => {
      const result = await interceptor.interceptScan('Table')

      expect(result.filterExpression).toContain('begins_with')
    })

    it('should intercept BatchGetItem', async () => {
      const result = await interceptor.interceptBatchGetItem([
        { tableName: 'Table', pk: 'USER#1' },
        { tableName: 'Table', pk: 'USER#2' },
      ])

      expect(result[0].keyCondition?.pk).toBe('TENANT#tenant-abc#USER#1')
      expect(result[1].keyCondition?.pk).toBe('TENANT#tenant-abc#USER#2')
    })
  })

  describe('result processing', () => {
    it('should strip tenant prefix from results', async () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'prefix',
      })
      manager.setTenant('tenant-abc')
      const interceptor = createTenantQueryInterceptor({
        tenantManager: manager,
        strategyOptions: { validateResults: true, stripTenantInfo: true },
      })

      const items = [
        { pk: 'TENANT#tenant-abc#USER#1', name: 'John' },
        { pk: 'TENANT#tenant-abc#USER#2', name: 'Jane' },
      ]

      const processed = await interceptor.processResults(items)

      expect(processed[0].pk).toBe('USER#1')
      expect(processed[1].pk).toBe('USER#2')
    })

    it('should throw CrossTenantAccessError for invalid items', async () => {
      const manager = createTenantManager({
        enabled: true,
        strategy: 'prefix',
      })
      manager.setTenant('tenant-abc')
      const interceptor = createTenantQueryInterceptor({
        tenantManager: manager,
        strategyOptions: { validateResults: true },
      })

      const items = [
        { pk: 'TENANT#other-tenant#USER#1', name: 'Hacker' },
      ]

      await expect(interceptor.processResults(items)).rejects.toThrow(CrossTenantAccessError)
    })
  })
})

describe('TenantCapacityManager', () => {
  describe('configuration', () => {
    it('should use default config', () => {
      const manager = createTenantCapacityManager()
      const config = manager.getTenantConfig('any-tenant')

      expect(config.maxReadCapacity).toBe(1000)
      expect(config.maxWriteCapacity).toBe(500)
    })

    it('should set tenant-specific config', () => {
      const manager = createTenantCapacityManager()
      manager.setTenantConfig('premium-tenant', {
        maxReadCapacity: 5000,
        maxWriteCapacity: 2500,
      })

      const config = manager.getTenantConfig('premium-tenant')
      expect(config.maxReadCapacity).toBe(5000)
    })
  })

  describe('capacity tracking', () => {
    it('should track read/write capacity', () => {
      const manager = createTenantCapacityManager()

      manager.trackCapacity('tenant-1', 10, 5)
      manager.trackCapacity('tenant-1', 20, 10)

      const stats = manager.getStats('tenant-1')
      expect(stats?.totalReadCapacity).toBe(30)
      expect(stats?.totalWriteCapacity).toBe(15)
    })

    it('should allow requests within limits', () => {
      const manager = createTenantCapacityManager({
        maxReadCapacity: 100,
        throttleOnExceed: true,
      })

      const result = manager.trackCapacity('tenant-1', 50, 10)
      expect(result.allowed).toBe(true)
      expect(result.throttled).toBe(false)
    })

    it('should throttle requests over limit', () => {
      const manager = createTenantCapacityManager({
        maxReadCapacity: 100,
        throttleOnExceed: true,
        burstAllowance: 0, // No burst
      })

      // First request
      manager.trackCapacity('tenant-1', 80, 0)

      // Second request exceeds limit
      const result = manager.trackCapacity('tenant-1', 50, 0)
      expect(result.allowed).toBe(false)
      expect(result.throttled).toBe(true)
    })

    it('should allow burst within allowance', () => {
      const manager = createTenantCapacityManager({
        maxReadCapacity: 100,
        throttleOnExceed: true,
        burstAllowance: 0.5, // 50% burst
      })

      // First request
      manager.trackCapacity('tenant-1', 100, 0)

      // Second request uses burst allowance (total 140, limit*1.5=150)
      const result = manager.trackCapacity('tenant-1', 40, 0)
      expect(result.allowed).toBe(true)
    })
  })

  describe('item and storage tracking', () => {
    it('should track item count', () => {
      const manager = createTenantCapacityManager()

      manager.updateItemCount('tenant-1', 10)
      manager.updateItemCount('tenant-1', 5)

      const stats = manager.getStats('tenant-1')
      expect(stats?.estimatedItems).toBe(15)
    })

    it('should track storage size', () => {
      const manager = createTenantCapacityManager()

      manager.updateStorageSize('tenant-1', 1000)
      manager.updateStorageSize('tenant-1', 500)

      const stats = manager.getStats('tenant-1')
      expect(stats?.estimatedStorageBytes).toBe(1500)
    })

    it('should not go negative', () => {
      const manager = createTenantCapacityManager()

      manager.updateItemCount('tenant-1', -100)

      const stats = manager.getStats('tenant-1')
      expect(stats?.estimatedItems).toBe(0)
    })
  })

  describe('limit checking', () => {
    it('should report within limits', () => {
      const manager = createTenantCapacityManager({
        maxItems: 1000,
        maxStorageBytes: 1000000,
      })

      manager.updateItemCount('tenant-1', 500)
      manager.updateStorageSize('tenant-1', 500000)

      const status = manager.isWithinLimits('tenant-1')
      expect(status.withinLimits).toBe(true)
      expect(status.itemLimitExceeded).toBe(false)
      expect(status.storageLimitExceeded).toBe(false)
    })

    it('should detect exceeded limits', () => {
      const manager = createTenantCapacityManager({
        maxItems: 1000,
      })

      manager.updateItemCount('tenant-1', 1500)

      const status = manager.isWithinLimits('tenant-1')
      expect(status.withinLimits).toBe(false)
      expect(status.itemLimitExceeded).toBe(true)
    })
  })

  describe('cost estimation', () => {
    it('should estimate costs', () => {
      const manager = createTenantCapacityManager()

      // 1 million reads, 500k writes
      manager.trackCapacity('tenant-1', 1000000, 500000)

      const cost = manager.getCostEstimate('tenant-1')
      expect(cost.readCost).toBe(1.25)
      expect(cost.writeCost).toBeCloseTo(0.625, 2)
      expect(cost.totalCost).toBeCloseTo(1.875, 2)
    })
  })

  describe('statistics management', () => {
    it('should get all stats', () => {
      const manager = createTenantCapacityManager()

      manager.trackCapacity('tenant-1', 10, 5)
      manager.trackCapacity('tenant-2', 20, 10)

      const allStats = manager.getAllStats()
      expect(allStats.length).toBe(2)
    })

    it('should reset tenant stats', () => {
      const manager = createTenantCapacityManager()

      manager.trackCapacity('tenant-1', 10, 5)
      manager.resetStats('tenant-1')

      expect(manager.getStats('tenant-1')).toBeNull()
    })

    it('should reset all stats', () => {
      const manager = createTenantCapacityManager()

      manager.trackCapacity('tenant-1', 10, 5)
      manager.trackCapacity('tenant-2', 20, 10)
      manager.resetAllStats()

      expect(manager.getAllStats().length).toBe(0)
    })
  })

  describe('usage percentage', () => {
    it('should calculate usage percentage', () => {
      const manager = createTenantCapacityManager({
        maxReadCapacity: 100,
        maxWriteCapacity: 50,
      })

      manager.trackCapacity('tenant-1', 50, 25)

      const usage = manager.getCapacityUsagePercent('tenant-1')
      expect(usage.readPercent).toBe(50)
      expect(usage.writePercent).toBe(50)
    })
  })
})
