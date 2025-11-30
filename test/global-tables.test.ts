import { describe, expect, it, beforeEach } from 'bun:test'
import {
  GlobalTableManager,
  createGlobalTableManager,
  type AWSRegion,
} from '../src/global-tables'

describe('Global Tables', () => {
  let manager: GlobalTableManager

  beforeEach(() => {
    manager = createGlobalTableManager('Users', 'us-east-1')
  })

  describe('GlobalTableManager Creation', () => {
    it('should create a global table manager', () => {
      expect(manager).toBeInstanceOf(GlobalTableManager)
    })

    it('should create a manager using factory function', () => {
      const m = createGlobalTableManager('TestTable', 'eu-west-1')
      expect(m).toBeInstanceOf(GlobalTableManager)
    })

    it('should store table name', () => {
      expect(manager.getTableName()).toBe('Users')
    })

    it('should store primary region', () => {
      expect(manager.getPrimaryRegion()).toBe('us-east-1')
    })
  })

  describe('Create Global Table', () => {
    it('should create global table with single replica', () => {
      const command = manager.createGlobalTable(['eu-west-1'])

      expect(command.command).toBe('UpdateTable')
      expect(command.input.TableName).toBe('Users')
      expect(command.input.ReplicaUpdates).toHaveLength(1)
      expect(command.input.ReplicaUpdates[0].Create.RegionName).toBe('eu-west-1')
    })

    it('should create global table with multiple replicas', () => {
      const command = manager.createGlobalTable(['eu-west-1', 'ap-northeast-1', 'ap-southeast-1'])

      expect(command.input.ReplicaUpdates).toHaveLength(3)
      expect(command.input.ReplicaUpdates.map(r => r.Create.RegionName)).toEqual([
        'eu-west-1',
        'ap-northeast-1',
        'ap-southeast-1',
      ])
    })

    it('should create global table with empty replica list', () => {
      const command = manager.createGlobalTable([])

      expect(command.input.ReplicaUpdates).toHaveLength(0)
    })
  })

  describe('Add Replica', () => {
    it('should add replica with minimal settings', () => {
      const command = manager.addReplica({ region: 'eu-west-1' })

      expect(command.command).toBe('UpdateTable')
      expect(command.input.TableName).toBe('Users')
      expect(command.input.ReplicaUpdates[0].Create.RegionName).toBe('eu-west-1')
    })

    it('should add replica with KMS key', () => {
      const command = manager.addReplica({
        region: 'eu-west-1',
        kmsKeyId: 'arn:aws:kms:eu-west-1:123456789:key/abc-123',
      })

      expect(command.input.ReplicaUpdates[0].Create.KMSMasterKeyId).toBe('arn:aws:kms:eu-west-1:123456789:key/abc-123')
    })

    it('should add replica with provisioned throughput', () => {
      const command = manager.addReplica({
        region: 'eu-west-1',
        provisionedThroughput: {
          readCapacityUnits: 100,
          writeCapacityUnits: 50,
        },
      })

      expect(command.input.ReplicaUpdates[0].Create.ProvisionedThroughputOverride).toEqual({
        ReadCapacityUnits: 100,
      })
    })

    it('should add replica with GSI overrides', () => {
      const command = manager.addReplica({
        region: 'eu-west-1',
        globalSecondaryIndexes: [
          {
            indexName: 'GSI1',
            provisionedThroughput: {
              readCapacityUnits: 50,
              writeCapacityUnits: 25,
            },
          },
        ],
      })

      expect(command.input.ReplicaUpdates[0].Create.GlobalSecondaryIndexes).toHaveLength(1)
      expect(command.input.ReplicaUpdates[0].Create.GlobalSecondaryIndexes![0]).toEqual({
        IndexName: 'GSI1',
        ProvisionedThroughputOverride: { ReadCapacityUnits: 50 },
      })
    })

    it('should add replica with table class override', () => {
      const command = manager.addReplica({
        region: 'eu-west-1',
        tableClassOverride: 'STANDARD_INFREQUENT_ACCESS',
      })

      expect(command.input.ReplicaUpdates[0].Create.TableClassOverride).toBe('STANDARD_INFREQUENT_ACCESS')
    })

    it('should add replica with all settings', () => {
      const command = manager.addReplica({
        region: 'eu-west-1',
        kmsKeyId: 'arn:aws:kms:...',
        provisionedThroughput: {
          readCapacityUnits: 100,
          writeCapacityUnits: 50,
        },
        globalSecondaryIndexes: [
          {
            indexName: 'GSI1',
            provisionedThroughput: {
              readCapacityUnits: 50,
              writeCapacityUnits: 25,
            },
          },
        ],
        tableClassOverride: 'STANDARD',
      })

      const create = command.input.ReplicaUpdates[0].Create
      expect(create.KMSMasterKeyId).toBeDefined()
      expect(create.ProvisionedThroughputOverride).toBeDefined()
      expect(create.GlobalSecondaryIndexes).toBeDefined()
      expect(create.TableClassOverride).toBe('STANDARD')
    })
  })

  describe('Remove Replica', () => {
    it('should remove replica', () => {
      const command = manager.removeReplica('eu-west-1')

      expect(command.command).toBe('UpdateTable')
      expect(command.input.TableName).toBe('Users')
      expect(command.input.ReplicaUpdates[0].Delete.RegionName).toBe('eu-west-1')
    })

    it('should remove replica from any region', () => {
      const regions: AWSRegion[] = ['us-west-2', 'ap-northeast-1', 'sa-east-1']

      for (const region of regions) {
        const command = manager.removeReplica(region)
        expect(command.input.ReplicaUpdates[0].Delete.RegionName).toBe(region)
      }
    })
  })

  describe('Update Replica', () => {
    it('should update replica with minimal settings', () => {
      const command = manager.updateReplica({ region: 'eu-west-1' })

      expect(command.command).toBe('UpdateTable')
      expect(command.input.ReplicaUpdates[0].Update.RegionName).toBe('eu-west-1')
    })

    it('should update replica KMS key', () => {
      const command = manager.updateReplica({
        region: 'eu-west-1',
        kmsKeyId: 'arn:aws:kms:eu-west-1:123456789:key/new-key',
      })

      expect(command.input.ReplicaUpdates[0].Update.KMSMasterKeyId).toBe('arn:aws:kms:eu-west-1:123456789:key/new-key')
    })

    it('should update replica provisioned throughput', () => {
      const command = manager.updateReplica({
        region: 'eu-west-1',
        provisionedThroughput: {
          readCapacityUnits: 200,
          writeCapacityUnits: 100,
        },
      })

      expect(command.input.ReplicaUpdates[0].Update.ProvisionedThroughputOverride).toEqual({
        ReadCapacityUnits: 200,
      })
    })

    it('should update replica GSI settings', () => {
      const command = manager.updateReplica({
        region: 'eu-west-1',
        globalSecondaryIndexes: [
          {
            indexName: 'GSI1',
            provisionedThroughput: {
              readCapacityUnits: 100,
              writeCapacityUnits: 50,
            },
          },
          {
            indexName: 'GSI2',
            provisionedThroughput: {
              readCapacityUnits: 75,
              writeCapacityUnits: 25,
            },
          },
        ],
      })

      expect(command.input.ReplicaUpdates[0].Update.GlobalSecondaryIndexes).toHaveLength(2)
    })

    it('should update replica table class', () => {
      const command = manager.updateReplica({
        region: 'eu-west-1',
        tableClassOverride: 'STANDARD_INFREQUENT_ACCESS',
      })

      expect(command.input.ReplicaUpdates[0].Update.TableClassOverride).toBe('STANDARD_INFREQUENT_ACCESS')
    })
  })

  describe('Describe Table', () => {
    it('should create describe table command', () => {
      const command = manager.describeTable()

      expect(command.command).toBe('DescribeTable')
      expect(command.input.TableName).toBe('Users')
    })
  })

  describe('Describe Table Replica Auto Scaling', () => {
    it('should create describe auto scaling command', () => {
      const command = manager.describeTableReplicaAutoScaling()

      expect(command.command).toBe('DescribeTableReplicaAutoScaling')
      expect(command.input.TableName).toBe('Users')
    })
  })

  describe('Update Replica Auto Scaling', () => {
    it('should update replica auto scaling with read capacity', () => {
      const command = manager.updateReplicaAutoScaling({
        region: 'eu-west-1',
        readCapacity: {
          minCapacity: 5,
          maxCapacity: 100,
          targetUtilization: 70,
        },
      })

      expect(command.command).toBe('UpdateTableReplicaAutoScaling')
      expect(command.input.TableName).toBe('Users')
      expect((command.input.ReplicaUpdates as Array<{ RegionName: string }>)[0].RegionName).toBe('eu-west-1')
    })

    it('should update replica auto scaling with GSI settings', () => {
      const command = manager.updateReplicaAutoScaling({
        region: 'eu-west-1',
        globalSecondaryIndexes: [
          {
            indexName: 'GSI1',
            readCapacity: {
              minCapacity: 5,
              maxCapacity: 50,
              targetUtilization: 70,
            },
          },
        ],
      })

      expect(command.input.ReplicaUpdates).toBeDefined()
    })

    it('should update replica auto scaling without any capacity settings', () => {
      const command = manager.updateReplicaAutoScaling({
        region: 'eu-west-1',
      })

      expect(command.command).toBe('UpdateTableReplicaAutoScaling')
    })
  })

  describe('Parse Describe Table Response', () => {
    it('should parse complete response', () => {
      const response = {
        Table: {
          TableName: 'Users',
          TableStatus: 'ACTIVE',
          Replicas: [
            {
              RegionName: 'us-east-1',
              ReplicaStatus: 'ACTIVE',
            },
            {
              RegionName: 'eu-west-1',
              ReplicaStatus: 'ACTIVE',
              KMSMasterKeyId: 'arn:aws:kms:...',
              ProvisionedThroughputOverride: {
                ReadCapacityUnits: 100,
              },
            },
          ],
          CreationDateTime: new Date('2024-01-01'),
        },
      }

      const description = GlobalTableManager.parseDescribeTableResponse(response)

      expect(description).not.toBeNull()
      expect(description?.tableName).toBe('Users')
      expect(description?.status).toBe('ACTIVE')
      expect(description?.replicas).toHaveLength(2)
      expect(description?.replicas[1].kmsKeyId).toBe('arn:aws:kms:...')
    })

    it('should return null for missing table name', () => {
      const response = {
        Table: {
          TableStatus: 'ACTIVE',
        },
      }

      const description = GlobalTableManager.parseDescribeTableResponse(response)
      expect(description).toBeNull()
    })

    it('should return null for empty response', () => {
      const description = GlobalTableManager.parseDescribeTableResponse({})
      expect(description).toBeNull()
    })

    it('should handle response without replicas', () => {
      const response = {
        Table: {
          TableName: 'Users',
          TableStatus: 'ACTIVE',
        },
      }

      const description = GlobalTableManager.parseDescribeTableResponse(response)

      expect(description).not.toBeNull()
      expect(description?.replicas).toHaveLength(0)
    })

    it('should parse replica GSI settings', () => {
      const response = {
        Table: {
          TableName: 'Users',
          Replicas: [
            {
              RegionName: 'eu-west-1',
              ReplicaStatus: 'ACTIVE',
              GlobalSecondaryIndexes: [
                {
                  IndexName: 'GSI1',
                  ProvisionedThroughputOverride: {
                    ReadCapacityUnits: 50,
                  },
                },
              ],
            },
          ],
        },
      }

      const description = GlobalTableManager.parseDescribeTableResponse(response)

      expect(description?.replicas[0].globalSecondaryIndexes).toHaveLength(1)
      expect(description?.replicas[0].globalSecondaryIndexes![0].indexName).toBe('GSI1')
    })

    it('should parse replica table class override', () => {
      const response = {
        Table: {
          TableName: 'Users',
          Replicas: [
            {
              RegionName: 'eu-west-1',
              ReplicaTableClassSummary: {
                TableClass: 'STANDARD_INFREQUENT_ACCESS',
              },
            },
          ],
        },
      }

      const description = GlobalTableManager.parseDescribeTableResponse(response)

      expect(description?.replicas[0].tableClassOverride).toBe('STANDARD_INFREQUENT_ACCESS')
    })

    it('should handle non-ACTIVE table status', () => {
      const response = {
        Table: {
          TableName: 'Users',
          TableStatus: 'CREATING',
        },
      }

      const description = GlobalTableManager.parseDescribeTableResponse(response)

      expect(description?.status).toBe('UPDATING')
    })
  })

  describe('Get Recommended Regions', () => {
    it('should get Americas regions', () => {
      const regions = GlobalTableManager.getRecommendedRegions('us-east-1', {
        coverage: 'americas',
      })

      expect(regions).not.toContain('us-east-1') // Primary region excluded
      expect(regions).toContain('us-west-2')
      expect(regions).toContain('sa-east-1')
      expect(regions).not.toContain('eu-west-1')
    })

    it('should get Europe regions', () => {
      const regions = GlobalTableManager.getRecommendedRegions('eu-west-1', {
        coverage: 'europe',
      })

      expect(regions).not.toContain('eu-west-1')
      expect(regions).toContain('eu-central-1')
      expect(regions).toContain('eu-north-1')
      expect(regions).not.toContain('us-east-1')
    })

    it('should get Asia-Pacific regions', () => {
      const regions = GlobalTableManager.getRecommendedRegions('ap-northeast-1', {
        coverage: 'asia-pacific',
      })

      expect(regions).not.toContain('ap-northeast-1')
      expect(regions).toContain('ap-southeast-1')
      expect(regions).toContain('ap-south-1')
    })

    it('should get global regions', () => {
      const regions = GlobalTableManager.getRecommendedRegions('us-east-1', {
        coverage: 'global',
      })

      expect(regions).not.toContain('us-east-1')
      expect(regions.length).toBeGreaterThan(5)
      // Should include regions from all continents
      expect(regions.some(r => r.startsWith('eu-'))).toBe(true)
      expect(regions.some(r => r.startsWith('ap-'))).toBe(true)
    })

    it('should default to global coverage', () => {
      const regions = GlobalTableManager.getRecommendedRegions('us-east-1', {})

      expect(regions.length).toBeGreaterThan(5)
    })
  })

  describe('Estimate Replication Lag', () => {
    it('should estimate same-continent lag', () => {
      const estimate = GlobalTableManager.estimateReplicationLag('us-east-1', 'us-west-2')

      expect(estimate.distance).toBe('same-continent')
      expect(estimate.estimatedLagMs).toBe(50)
    })

    it('should estimate cross-continent lag', () => {
      const estimate = GlobalTableManager.estimateReplicationLag('us-east-1', 'eu-west-1')

      expect(estimate.distance).toBe('cross-continent')
      expect(estimate.estimatedLagMs).toBe(150)
    })

    it('should estimate cross-ocean lag', () => {
      const estimate = GlobalTableManager.estimateReplicationLag('us-east-1', 'ap-northeast-1')

      expect(estimate.distance).toBe('cross-ocean')
      expect(estimate.estimatedLagMs).toBe(300)
    })

    it('should handle Europe to Asia', () => {
      const estimate = GlobalTableManager.estimateReplicationLag('eu-west-1', 'ap-southeast-1')

      expect(estimate.distance).toBe('cross-continent')
    })

    it('should handle unknown regions', () => {
      // When both regions are unknown, they map to same continent ('unknown' === 'unknown')
      const estimate = GlobalTableManager.estimateReplicationLag('custom-region-1' as AWSRegion, 'custom-region-2' as AWSRegion)

      expect(estimate.distance).toBe('same-continent')
      expect(estimate.estimatedLagMs).toBe(50)
    })

    it('should handle same region', () => {
      const estimate = GlobalTableManager.estimateReplicationLag('us-east-1', 'us-east-1')

      expect(estimate.distance).toBe('same-continent')
      expect(estimate.estimatedLagMs).toBe(50)
    })
  })

  describe('Edge Cases', () => {
    it('should handle custom region strings', () => {
      const m = createGlobalTableManager('Test', 'custom-region' as AWSRegion)
      expect(m.getPrimaryRegion()).toBe('custom-region')
    })

    it('should handle special characters in table name', () => {
      const m = createGlobalTableManager('my-table_v2.test', 'us-east-1')
      expect(m.getTableName()).toBe('my-table_v2.test')
    })

    it('should handle empty KMS key ID', () => {
      const command = manager.addReplica({
        region: 'eu-west-1',
        kmsKeyId: '',
      })

      // Empty string should not be included
      expect(command.input.ReplicaUpdates[0].Create.KMSMasterKeyId).toBeUndefined()
    })

    it('should handle zero read capacity units', () => {
      const command = manager.addReplica({
        region: 'eu-west-1',
        provisionedThroughput: {
          readCapacityUnits: 0,
          writeCapacityUnits: 10,
        },
      })

      // Zero should not be included (falsy)
      expect(command.input.ReplicaUpdates[0].Create.ProvisionedThroughputOverride).toBeUndefined()
    })

    it('should handle all AWS regions', () => {
      const allRegions: AWSRegion[] = [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
        'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
        'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
        'sa-east-1', 'ca-central-1', 'me-south-1', 'af-south-1',
      ]

      for (const region of allRegions) {
        const command = manager.addReplica({ region })
        expect(command.input.ReplicaUpdates[0].Create.RegionName).toBe(region)
      }
    })
  })
})
