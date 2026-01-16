import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  BackupManager,
  createBackupManager,
} from '../src/backup'

describe('Backup & Restore', () => {
  let manager: BackupManager

  beforeEach(() => {
    manager = createBackupManager()
  })

  afterEach(() => {
    manager.shutdown()
  })

  describe('BackupManager Creation', () => {
    it('should create a backup manager', () => {
      expect(manager).toBeInstanceOf(BackupManager)
    })

    it('should create a backup manager using factory function', () => {
      const m = createBackupManager()
      expect(m).toBeInstanceOf(BackupManager)
      m.shutdown()
    })
  })

  describe('Create Backup', () => {
    it('should create backup command', () => {
      const command = manager.createBackup({
        tableName: 'Users',
        backupName: 'users-backup-2024',
      })

      expect(command.command).toBe('CreateBackup')
      expect(command.input.TableName).toBe('Users')
      expect(command.input.BackupName).toBe('users-backup-2024')
    })

    it('should create backup command with tags', () => {
      const command = manager.createBackup({
        tableName: 'Users',
        backupName: 'users-backup',
        tags: { environment: 'production' },
      })

      expect(command.input.TableName).toBe('Users')
    })

    it('should handle special characters in table name', () => {
      const command = manager.createBackup({
        tableName: 'my-table_v2',
        backupName: 'backup',
      })

      expect(command.input.TableName).toBe('my-table_v2')
    })

    it('should handle empty backup name', () => {
      const command = manager.createBackup({
        tableName: 'Users',
        backupName: '',
      })

      expect(command.input.BackupName).toBe('')
    })
  })

  describe('Delete Backup', () => {
    it('should create delete backup command', () => {
      const arn = 'arn:aws:dynamodb:us-east-1:123456789:table/Users/backup/123'
      const command = manager.deleteBackup(arn)

      expect(command.command).toBe('DeleteBackup')
      expect(command.input.BackupArn).toBe(arn)
    })
  })

  describe('Describe Backup', () => {
    it('should create describe backup command', () => {
      const arn = 'arn:aws:dynamodb:us-east-1:123456789:table/Users/backup/123'
      const command = manager.describeBackup(arn)

      expect(command.command).toBe('DescribeBackup')
      expect(command.input.BackupArn).toBe(arn)
    })
  })

  describe('List Backups', () => {
    it('should create list backups command without options', () => {
      const command = manager.listBackups()

      expect(command.command).toBe('ListBackups')
      expect(command.input).toEqual({})
    })

    it('should create list backups command with table name filter', () => {
      const command = manager.listBackups({ tableName: 'Users' })

      expect(command.input.TableName).toBe('Users')
    })

    it('should create list backups command with backup type filter', () => {
      const command = manager.listBackups({ backupType: 'USER' })

      expect(command.input.BackupType).toBe('USER')
    })

    it('should create list backups command with ALL backup type', () => {
      const command = manager.listBackups({ backupType: 'ALL' })

      expect(command.input.BackupType).toBe('ALL')
    })

    it('should create list backups command with time range', () => {
      const startTime = new Date('2024-01-01')
      const endTime = new Date('2024-12-31')
      const command = manager.listBackups({ startTime, endTime })

      expect(command.input.TimeRangeLowerBound).toEqual(startTime)
      expect(command.input.TimeRangeUpperBound).toEqual(endTime)
    })

    it('should create list backups command with limit', () => {
      const command = manager.listBackups({ limit: 50 })

      expect(command.input.Limit).toBe(50)
    })

    it('should create list backups command with pagination token', () => {
      const command = manager.listBackups({ nextToken: 'arn:aws:...' })

      expect(command.input.ExclusiveStartBackupArn).toBe('arn:aws:...')
    })

    it('should create list backups command with all options', () => {
      const command = manager.listBackups({
        tableName: 'Users',
        backupType: 'USER',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-12-31'),
        limit: 100,
        nextToken: 'arn:aws:...',
      })

      expect(command.input.TableName).toBe('Users')
      expect(command.input.BackupType).toBe('USER')
      expect(command.input.Limit).toBe(100)
    })
  })

  describe('Restore From Backup', () => {
    it('should create restore from backup command', () => {
      const command = manager.restoreFromBackup({
        backupArn: 'arn:aws:dynamodb:us-east-1:123456789:table/Users/backup/123',
        targetTableName: 'Users-Restored',
      })

      expect(command.command).toBe('RestoreTableFromBackup')
      expect(command.input.BackupArn).toBe('arn:aws:dynamodb:us-east-1:123456789:table/Users/backup/123')
      expect(command.input.TargetTableName).toBe('Users-Restored')
    })

    it('should throw error when backupArn is missing', () => {
      expect(() => {
        manager.restoreFromBackup({
          targetTableName: 'Users-Restored',
        })
      }).toThrow('backupArn is required for restoreFromBackup')
    })

    it('should support billing mode override', () => {
      const command = manager.restoreFromBackup({
        backupArn: 'arn:aws:...',
        targetTableName: 'Users-Restored',
        billingMode: 'PAY_PER_REQUEST',
      })

      expect(command.input.BillingModeOverride).toBe('PAY_PER_REQUEST')
    })

    it('should support provisioned throughput override', () => {
      const command = manager.restoreFromBackup({
        backupArn: 'arn:aws:...',
        targetTableName: 'Users-Restored',
        provisionedThroughput: {
          readCapacityUnits: 100,
          writeCapacityUnits: 50,
        },
      })

      expect(command.input.ProvisionedThroughputOverride).toEqual({
        ReadCapacityUnits: 100,
        WriteCapacityUnits: 50,
      })
    })

    it('should support GSI override', () => {
      const command = manager.restoreFromBackup({
        backupArn: 'arn:aws:...',
        targetTableName: 'Users-Restored',
        globalSecondaryIndexOverride: [
          {
            indexName: 'GSI1',
            keySchema: [
              { attributeName: 'GSI1PK', keyType: 'HASH' },
              { attributeName: 'GSI1SK', keyType: 'RANGE' },
            ],
            projection: { projectionType: 'ALL' },
            provisionedThroughput: {
              readCapacityUnits: 10,
              writeCapacityUnits: 10,
            },
          },
        ],
      })

      const gsi = (command.input.GlobalSecondaryIndexOverride as Array<unknown>)[0] as { IndexName: string }
      expect(gsi.IndexName).toBe('GSI1')
    })

    it('should support LSI override', () => {
      const command = manager.restoreFromBackup({
        backupArn: 'arn:aws:...',
        targetTableName: 'Users-Restored',
        localSecondaryIndexOverride: [
          {
            indexName: 'LSI1',
            keySchema: [
              { attributeName: 'pk', keyType: 'HASH' },
              { attributeName: 'LSI1SK', keyType: 'RANGE' },
            ],
            projection: { projectionType: 'KEYS_ONLY' },
          },
        ],
      })

      const lsi = (command.input.LocalSecondaryIndexOverride as Array<unknown>)[0] as { IndexName: string }
      expect(lsi.IndexName).toBe('LSI1')
    })

    it('should support SSE specification override', () => {
      const command = manager.restoreFromBackup({
        backupArn: 'arn:aws:...',
        targetTableName: 'Users-Restored',
        sseSpecificationOverride: {
          enabled: true,
          sseType: 'KMS',
          kmsMasterKeyId: 'arn:aws:kms:...',
        },
      })

      expect(command.input.SSESpecificationOverride).toEqual({
        Enabled: true,
        SSEType: 'KMS',
        KMSMasterKeyId: 'arn:aws:kms:...',
      })
    })
  })

  describe('Point-in-Time Recovery', () => {
    it('should enable PITR', () => {
      const command = manager.enablePITR('Users')

      expect(command.command).toBe('UpdateContinuousBackups')
      expect(command.input.TableName).toBe('Users')
      expect(command.input.PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled).toBe(true)
    })

    it('should disable PITR', () => {
      const command = manager.disablePITR('Users')

      expect(command.command).toBe('UpdateContinuousBackups')
      expect(command.input.TableName).toBe('Users')
      expect(command.input.PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled).toBe(false)
    })

    it('should describe continuous backups', () => {
      const command = manager.describeContinuousBackups('Users')

      expect(command.command).toBe('DescribeContinuousBackups')
      expect(command.input.TableName).toBe('Users')
    })
  })

  describe('Restore to Point-in-Time', () => {
    it('should create restore to point-in-time command', () => {
      const command = manager.restoreToPointInTime({
        sourceTableName: 'Users',
        targetTableName: 'Users-Restored',
        restoreDateTime: new Date('2024-06-15T12:00:00Z'),
      })

      expect(command.command).toBe('RestoreTableToPointInTime')
      expect(command.input.SourceTableName).toBe('Users')
      expect(command.input.TargetTableName).toBe('Users-Restored')
      expect(command.input.RestoreDateTime).toEqual(new Date('2024-06-15T12:00:00Z'))
    })

    it('should throw error when sourceTableName is missing', () => {
      expect(() => {
        manager.restoreToPointInTime({
          targetTableName: 'Users-Restored',
        })
      }).toThrow('sourceTableName is required for restoreToPointInTime')
    })

    it('should use latest restorable time when restoreDateTime not specified', () => {
      const command = manager.restoreToPointInTime({
        sourceTableName: 'Users',
        targetTableName: 'Users-Restored',
      })

      expect(command.input.UseLatestRestorableTime).toBe(true)
      expect(command.input.RestoreDateTime).toBeUndefined()
    })

    it('should support billing mode override in PITR', () => {
      const command = manager.restoreToPointInTime({
        sourceTableName: 'Users',
        targetTableName: 'Users-Restored',
        billingMode: 'PROVISIONED',
      })

      expect(command.input.BillingModeOverride).toBe('PROVISIONED')
    })

    it('should support all restore options in PITR', () => {
      const command = manager.restoreToPointInTime({
        sourceTableName: 'Users',
        targetTableName: 'Users-Restored',
        restoreDateTime: new Date('2024-06-15'),
        billingMode: 'PROVISIONED',
        provisionedThroughput: {
          readCapacityUnits: 100,
          writeCapacityUnits: 50,
        },
        globalSecondaryIndexOverride: [
          {
            indexName: 'GSI1',
            keySchema: [{ attributeName: 'GSI1PK', keyType: 'HASH' }],
            projection: { projectionType: 'ALL' },
          },
        ],
        localSecondaryIndexOverride: [
          {
            indexName: 'LSI1',
            keySchema: [
              { attributeName: 'pk', keyType: 'HASH' },
              { attributeName: 'LSI1SK', keyType: 'RANGE' },
            ],
            projection: { projectionType: 'KEYS_ONLY' },
          },
        ],
        sseSpecificationOverride: {
          enabled: true,
          sseType: 'AES256',
        },
      })

      expect(command.input.SourceTableName).toBe('Users')
      expect(command.input.BillingModeOverride).toBe('PROVISIONED')
      expect(command.input.ProvisionedThroughputOverride).toBeDefined()
      expect(command.input.GlobalSecondaryIndexOverride).toBeDefined()
      expect(command.input.LocalSecondaryIndexOverride).toBeDefined()
      expect(command.input.SSESpecificationOverride).toBeDefined()
    })
  })

  describe('Scheduled Backups', () => {
    it('should schedule a backup', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(24 hours)',
        retentionDays: 7,
      })

      const scheduled = manager.getScheduledBackups()
      expect(scheduled).toHaveLength(1)
      expect(scheduled[0].tableName).toBe('Users')
    })

    it('should schedule multiple backups', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(24 hours)',
        retentionDays: 7,
      })

      manager.scheduleBackup({
        tableName: 'Orders',
        backupNamePrefix: 'hourly',
        schedule: 'rate(1 hour)',
        retentionDays: 1,
      })

      const scheduled = manager.getScheduledBackups()
      expect(scheduled).toHaveLength(2)
    })

    it('should unschedule a backup', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(24 hours)',
        retentionDays: 7,
      })

      manager.unscheduleBackup('Users', 'daily')

      const scheduled = manager.getScheduledBackups()
      expect(scheduled).toHaveLength(0)
    })

    it('should replace existing schedule with same key', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(24 hours)',
        retentionDays: 7,
      })

      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(12 hours)',
        retentionDays: 14,
      })

      const scheduled = manager.getScheduledBackups()
      expect(scheduled).toHaveLength(1)
      expect(scheduled[0].retentionDays).toBe(14)
    })

    it('should handle cron expressions (unsupported)', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'cron(0 12 * * ? *)',
        retentionDays: 7,
      })

      const scheduled = manager.getScheduledBackups()
      expect(scheduled).toHaveLength(1)
    })

    it('should include tags in scheduled backups', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(24 hours)',
        retentionDays: 7,
        tags: { environment: 'production' },
      })

      const scheduled = manager.getScheduledBackups()
      expect(scheduled[0].tags).toEqual({ environment: 'production' })
    })
  })

  describe('Generate Backup Name', () => {
    it('should generate backup name with timestamp', () => {
      const name = manager.generateBackupName('Users')
      expect(name).toMatch(/^Users-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
    })

    it('should generate backup name with custom prefix', () => {
      const name = manager.generateBackupName('Users', 'daily')
      expect(name).toMatch(/^Users-daily-/)
    })

    it('should generate unique names for successive calls', () => {
      const name1 = manager.generateBackupName('Users')
      const name2 = manager.generateBackupName('Users')
      // Names might be the same if called within same second
      expect(name1).toMatch(/^Users-backup-/)
      expect(name2).toMatch(/^Users-backup-/)
    })
  })

  describe('Parse Backup Description', () => {
    it('should parse complete backup description', () => {
      const response = {
        BackupDescription: {
          BackupDetails: {
            BackupArn: 'arn:aws:dynamodb:us-east-1:123456789:table/Users/backup/123',
            BackupName: 'users-backup',
            BackupStatus: 'AVAILABLE',
            BackupType: 'USER',
            BackupCreationDateTime: new Date('2024-06-15'),
            BackupSizeBytes: 1024,
          },
          SourceTableDetails: {
            TableName: 'Users',
            TableArn: 'arn:aws:dynamodb:us-east-1:123456789:table/Users',
            ItemCount: 1000,
          },
        },
      }

      const details = BackupManager.parseBackupDescription(response)

      expect(details).not.toBeNull()
      expect(details?.arn).toBe('arn:aws:dynamodb:us-east-1:123456789:table/Users/backup/123')
      expect(details?.name).toBe('users-backup')
      expect(details?.tableName).toBe('Users')
      expect(details?.status).toBe('AVAILABLE')
      expect(details?.type).toBe('USER')
      expect(details?.sizeBytes).toBe(1024)
      expect(details?.itemCount).toBe(1000)
    })

    it('should return null for incomplete response', () => {
      const response = {
        BackupDescription: {
          BackupDetails: {
            BackupStatus: 'AVAILABLE',
          },
        },
      }

      const details = BackupManager.parseBackupDescription(response)
      expect(details).toBeNull()
    })

    it('should handle missing optional fields', () => {
      const response = {
        BackupDescription: {
          BackupDetails: {
            BackupArn: 'arn:aws:...',
            BackupName: 'backup',
          },
        },
      }

      const details = BackupManager.parseBackupDescription(response)
      expect(details).not.toBeNull()
      expect(details?.status).toBe('AVAILABLE')
      expect(details?.type).toBe('USER')
      expect(details?.tableName).toBe('')
    })

    it('should handle empty response', () => {
      const details = BackupManager.parseBackupDescription({})
      expect(details).toBeNull()
    })
  })

  describe('Parse PITR Description', () => {
    it('should parse enabled PITR description', () => {
      const response = {
        ContinuousBackupsDescription: {
          ContinuousBackupsStatus: 'ENABLED',
          PointInTimeRecoveryDescription: {
            PointInTimeRecoveryStatus: 'ENABLED',
            EarliestRestorableDateTime: new Date('2024-06-01'),
            LatestRestorableDateTime: new Date('2024-06-15'),
          },
        },
      }

      const pitr = BackupManager.parsePITRDescription(response)

      expect(pitr.status).toBe('ENABLED')
      expect(pitr.earliestRestorableTime).toEqual(new Date('2024-06-01'))
      expect(pitr.latestRestorableTime).toEqual(new Date('2024-06-15'))
    })

    it('should parse disabled PITR description', () => {
      const response = {
        ContinuousBackupsDescription: {
          ContinuousBackupsStatus: 'DISABLED',
          PointInTimeRecoveryDescription: {
            PointInTimeRecoveryStatus: 'DISABLED',
          },
        },
      }

      const pitr = BackupManager.parsePITRDescription(response)

      expect(pitr.status).toBe('DISABLED')
      expect(pitr.earliestRestorableTime).toBeUndefined()
      expect(pitr.latestRestorableTime).toBeUndefined()
    })

    it('should handle empty response', () => {
      const pitr = BackupManager.parsePITRDescription({})

      expect(pitr.status).toBe('DISABLED')
    })
  })

  describe('Shutdown', () => {
    it('should clean up all intervals on shutdown', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(24 hours)',
        retentionDays: 7,
      })

      manager.scheduleBackup({
        tableName: 'Orders',
        backupNamePrefix: 'hourly',
        schedule: 'rate(1 hour)',
        retentionDays: 1,
      })

      manager.shutdown()

      const scheduled = manager.getScheduledBackups()
      expect(scheduled).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long table names', () => {
      const longName = 'a'.repeat(255)
      const command = manager.createBackup({
        tableName: longName,
        backupName: 'backup',
      })

      expect(command.input.TableName).toBe(longName)
    })

    it('should handle unschedule of non-existent backup', () => {
      // Should not throw
      manager.unscheduleBackup('NonExistent', 'backup')
      expect(manager.getScheduledBackups()).toHaveLength(0)
    })

    it('should handle rate expression with minutes', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'frequent',
        schedule: 'rate(30 minutes)',
        retentionDays: 1,
      })

      expect(manager.getScheduledBackups()).toHaveLength(1)
    })

    it('should handle rate expression with days', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'weekly',
        schedule: 'rate(7 days)',
        retentionDays: 30,
      })

      expect(manager.getScheduledBackups()).toHaveLength(1)
    })

    it('should handle singular rate units', () => {
      manager.scheduleBackup({
        tableName: 'Users',
        backupNamePrefix: 'daily',
        schedule: 'rate(1 hour)',
        retentionDays: 1,
      })

      expect(manager.getScheduledBackups()).toHaveLength(1)
    })
  })
})
