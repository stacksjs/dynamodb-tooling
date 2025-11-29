// ============================================================================
// Backup Manager - DynamoDB Backup & Restore Operations
// ============================================================================

/**
 * Backup status
 */
export type BackupStatus = 'CREATING' | 'DELETED' | 'AVAILABLE'

/**
 * Backup type
 */
export type BackupType = 'USER' | 'SYSTEM' | 'AWS_BACKUP'

/**
 * Point-in-time recovery status
 */
export type PITRStatus = 'ENABLED' | 'DISABLED'

/**
 * Backup details
 */
export interface BackupDetails {
  /** Backup ARN */
  arn: string
  /** Backup name */
  name: string
  /** Table name */
  tableName: string
  /** Table ARN */
  tableArn: string
  /** Backup status */
  status: BackupStatus
  /** Backup type */
  type: BackupType
  /** Creation time */
  createdAt: Date
  /** Expiration time (for scheduled backups) */
  expiresAt?: Date
  /** Backup size in bytes */
  sizeBytes?: number
  /** Item count */
  itemCount?: number
}

/**
 * Backup creation options
 */
export interface CreateBackupOptions {
  /** Table name to backup */
  tableName: string
  /** Backup name */
  backupName: string
  /** Tags to apply to the backup */
  tags?: Record<string, string>
}

/**
 * Backup list options
 */
export interface ListBackupsOptions {
  /** Filter by table name */
  tableName?: string
  /** Filter by backup type */
  backupType?: BackupType | 'ALL'
  /** Start time range */
  startTime?: Date
  /** End time range */
  endTime?: Date
  /** Maximum results to return */
  limit?: number
  /** Pagination token */
  nextToken?: string
}

/**
 * Restore options
 */
export interface RestoreOptions {
  /** Source backup ARN */
  backupArn?: string
  /** Source table name (for PITR) */
  sourceTableName?: string
  /** Target table name */
  targetTableName: string
  /** Point in time to restore to (for PITR) */
  restoreDateTime?: Date
  /** Override billing mode */
  billingMode?: 'PROVISIONED' | 'PAY_PER_REQUEST'
  /** Override provisioned throughput */
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  /** Override global secondary indexes */
  globalSecondaryIndexOverride?: Array<{
    indexName: string
    keySchema: Array<{ attributeName: string, keyType: 'HASH' | 'RANGE' }>
    projection: { projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE', nonKeyAttributes?: string[] }
    provisionedThroughput?: { readCapacityUnits: number, writeCapacityUnits: number }
  }>
  /** Override local secondary indexes */
  localSecondaryIndexOverride?: Array<{
    indexName: string
    keySchema: Array<{ attributeName: string, keyType: 'HASH' | 'RANGE' }>
    projection: { projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE', nonKeyAttributes?: string[] }
  }>
  /** Override SSE specification */
  sseSpecificationOverride?: {
    enabled: boolean
    sseType?: 'AES256' | 'KMS'
    kmsMasterKeyId?: string
  }
}

/**
 * PITR description
 */
export interface PITRDescription {
  /** PITR status */
  status: PITRStatus
  /** Earliest restorable time */
  earliestRestorableTime?: Date
  /** Latest restorable time */
  latestRestorableTime?: Date
}

/**
 * Scheduled backup configuration
 */
export interface ScheduledBackupConfig {
  /** Table name */
  tableName: string
  /** Backup name prefix */
  backupNamePrefix: string
  /** Schedule expression (cron or rate) */
  schedule: string
  /** Retention period in days */
  retentionDays: number
  /** Tags to apply */
  tags?: Record<string, string>
}

/**
 * Backup manager for DynamoDB backup and restore operations
 */
export class BackupManager {
  private scheduledBackups: Map<string, ScheduledBackupConfig> = new Map()
  private backupIntervals: Map<string, ReturnType<typeof setInterval>> = new Map()

  /**
   * Create a backup (returns command for DynamoDB)
   */
  createBackup(options: CreateBackupOptions): {
    command: 'CreateBackup'
    input: {
      TableName: string
      BackupName: string
    }
  } {
    return {
      command: 'CreateBackup',
      input: {
        TableName: options.tableName,
        BackupName: options.backupName,
      },
    }
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupArn: string): {
    command: 'DeleteBackup'
    input: {
      BackupArn: string
    }
  } {
    return {
      command: 'DeleteBackup',
      input: {
        BackupArn: backupArn,
      },
    }
  }

  /**
   * Describe a backup
   */
  describeBackup(backupArn: string): {
    command: 'DescribeBackup'
    input: {
      BackupArn: string
    }
  } {
    return {
      command: 'DescribeBackup',
      input: {
        BackupArn: backupArn,
      },
    }
  }

  /**
   * List backups
   */
  listBackups(options?: ListBackupsOptions): {
    command: 'ListBackups'
    input: {
      TableName?: string
      BackupType?: string
      TimeRangeLowerBound?: Date
      TimeRangeUpperBound?: Date
      Limit?: number
      ExclusiveStartBackupArn?: string
    }
  } {
    const input: {
      TableName?: string
      BackupType?: string
      TimeRangeLowerBound?: Date
      TimeRangeUpperBound?: Date
      Limit?: number
      ExclusiveStartBackupArn?: string
    } = {}

    if (options?.tableName) {
      input.TableName = options.tableName
    }
    if (options?.backupType) {
      input.BackupType = options.backupType
    }
    if (options?.startTime) {
      input.TimeRangeLowerBound = options.startTime
    }
    if (options?.endTime) {
      input.TimeRangeUpperBound = options.endTime
    }
    if (options?.limit) {
      input.Limit = options.limit
    }
    if (options?.nextToken) {
      input.ExclusiveStartBackupArn = options.nextToken
    }

    return {
      command: 'ListBackups',
      input,
    }
  }

  /**
   * Restore table from backup
   */
  restoreFromBackup(options: RestoreOptions): {
    command: 'RestoreTableFromBackup'
    input: Record<string, unknown>
  } {
    if (!options.backupArn) {
      throw new Error('backupArn is required for restoreFromBackup')
    }

    const input: Record<string, unknown> = {
      BackupArn: options.backupArn,
      TargetTableName: options.targetTableName,
    }

    if (options.billingMode) {
      input.BillingModeOverride = options.billingMode
    }

    if (options.provisionedThroughput) {
      input.ProvisionedThroughputOverride = {
        ReadCapacityUnits: options.provisionedThroughput.readCapacityUnits,
        WriteCapacityUnits: options.provisionedThroughput.writeCapacityUnits,
      }
    }

    if (options.globalSecondaryIndexOverride) {
      input.GlobalSecondaryIndexOverride = options.globalSecondaryIndexOverride.map(gsi => ({
        IndexName: gsi.indexName,
        KeySchema: gsi.keySchema.map(ks => ({
          AttributeName: ks.attributeName,
          KeyType: ks.keyType,
        })),
        Projection: {
          ProjectionType: gsi.projection.projectionType,
          NonKeyAttributes: gsi.projection.nonKeyAttributes,
        },
        ProvisionedThroughput: gsi.provisionedThroughput
          ? {
              ReadCapacityUnits: gsi.provisionedThroughput.readCapacityUnits,
              WriteCapacityUnits: gsi.provisionedThroughput.writeCapacityUnits,
            }
          : undefined,
      }))
    }

    if (options.localSecondaryIndexOverride) {
      input.LocalSecondaryIndexOverride = options.localSecondaryIndexOverride.map(lsi => ({
        IndexName: lsi.indexName,
        KeySchema: lsi.keySchema.map(ks => ({
          AttributeName: ks.attributeName,
          KeyType: ks.keyType,
        })),
        Projection: {
          ProjectionType: lsi.projection.projectionType,
          NonKeyAttributes: lsi.projection.nonKeyAttributes,
        },
      }))
    }

    if (options.sseSpecificationOverride) {
      input.SSESpecificationOverride = {
        Enabled: options.sseSpecificationOverride.enabled,
        SSEType: options.sseSpecificationOverride.sseType,
        KMSMasterKeyId: options.sseSpecificationOverride.kmsMasterKeyId,
      }
    }

    return {
      command: 'RestoreTableFromBackup',
      input,
    }
  }

  /**
   * Restore table to a point in time
   */
  restoreToPointInTime(options: RestoreOptions): {
    command: 'RestoreTableToPointInTime'
    input: Record<string, unknown>
  } {
    if (!options.sourceTableName) {
      throw new Error('sourceTableName is required for restoreToPointInTime')
    }

    const input: Record<string, unknown> = {
      SourceTableName: options.sourceTableName,
      TargetTableName: options.targetTableName,
    }

    if (options.restoreDateTime) {
      input.RestoreDateTime = options.restoreDateTime
    }
    else {
      input.UseLatestRestorableTime = true
    }

    if (options.billingMode) {
      input.BillingModeOverride = options.billingMode
    }

    if (options.provisionedThroughput) {
      input.ProvisionedThroughputOverride = {
        ReadCapacityUnits: options.provisionedThroughput.readCapacityUnits,
        WriteCapacityUnits: options.provisionedThroughput.writeCapacityUnits,
      }
    }

    if (options.globalSecondaryIndexOverride) {
      input.GlobalSecondaryIndexOverride = options.globalSecondaryIndexOverride.map(gsi => ({
        IndexName: gsi.indexName,
        KeySchema: gsi.keySchema.map(ks => ({
          AttributeName: ks.attributeName,
          KeyType: ks.keyType,
        })),
        Projection: {
          ProjectionType: gsi.projection.projectionType,
          NonKeyAttributes: gsi.projection.nonKeyAttributes,
        },
        ProvisionedThroughput: gsi.provisionedThroughput
          ? {
              ReadCapacityUnits: gsi.provisionedThroughput.readCapacityUnits,
              WriteCapacityUnits: gsi.provisionedThroughput.writeCapacityUnits,
            }
          : undefined,
      }))
    }

    if (options.localSecondaryIndexOverride) {
      input.LocalSecondaryIndexOverride = options.localSecondaryIndexOverride.map(lsi => ({
        IndexName: lsi.indexName,
        KeySchema: lsi.keySchema.map(ks => ({
          AttributeName: ks.attributeName,
          KeyType: ks.keyType,
        })),
        Projection: {
          ProjectionType: lsi.projection.projectionType,
          NonKeyAttributes: lsi.projection.nonKeyAttributes,
        },
      }))
    }

    if (options.sseSpecificationOverride) {
      input.SSESpecificationOverride = {
        Enabled: options.sseSpecificationOverride.enabled,
        SSEType: options.sseSpecificationOverride.sseType,
        KMSMasterKeyId: options.sseSpecificationOverride.kmsMasterKeyId,
      }
    }

    return {
      command: 'RestoreTableToPointInTime',
      input,
    }
  }

  /**
   * Enable point-in-time recovery
   */
  enablePITR(tableName: string): {
    command: 'UpdateContinuousBackups'
    input: {
      TableName: string
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: boolean
      }
    }
  } {
    return {
      command: 'UpdateContinuousBackups',
      input: {
        TableName: tableName,
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      },
    }
  }

  /**
   * Disable point-in-time recovery
   */
  disablePITR(tableName: string): {
    command: 'UpdateContinuousBackups'
    input: {
      TableName: string
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: boolean
      }
    }
  } {
    return {
      command: 'UpdateContinuousBackups',
      input: {
        TableName: tableName,
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: false,
        },
      },
    }
  }

  /**
   * Describe continuous backups (PITR status)
   */
  describeContinuousBackups(tableName: string): {
    command: 'DescribeContinuousBackups'
    input: {
      TableName: string
    }
  } {
    return {
      command: 'DescribeContinuousBackups',
      input: {
        TableName: tableName,
      },
    }
  }

  /**
   * Schedule automatic backups (in-memory scheduler)
   */
  scheduleBackup(config: ScheduledBackupConfig): void {
    const key = `${config.tableName}:${config.backupNamePrefix}`

    // Clear existing schedule if any
    this.unscheduleBackup(config.tableName, config.backupNamePrefix)

    this.scheduledBackups.set(key, config)

    // Parse schedule and set up interval
    const intervalMs = this.parseSchedule(config.schedule)
    if (intervalMs > 0) {
      const interval = setInterval(() => {
        this.triggerScheduledBackup(config)
      }, intervalMs)
      this.backupIntervals.set(key, interval)
    }
  }

  /**
   * Remove a scheduled backup
   */
  unscheduleBackup(tableName: string, backupNamePrefix: string): void {
    const key = `${tableName}:${backupNamePrefix}`
    const interval = this.backupIntervals.get(key)
    if (interval) {
      clearInterval(interval)
      this.backupIntervals.delete(key)
    }
    this.scheduledBackups.delete(key)
  }

  /**
   * Get all scheduled backups
   */
  getScheduledBackups(): ScheduledBackupConfig[] {
    return Array.from(this.scheduledBackups.values())
  }

  /**
   * Trigger a scheduled backup (returns the command)
   */
  private triggerScheduledBackup(config: ScheduledBackupConfig): {
    command: 'CreateBackup'
    input: {
      TableName: string
      BackupName: string
    }
  } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `${config.backupNamePrefix}-${timestamp}`

    return this.createBackup({
      tableName: config.tableName,
      backupName,
      tags: config.tags,
    })
  }

  /**
   * Parse schedule expression to interval in milliseconds
   */
  private parseSchedule(schedule: string): number {
    // Support rate expressions like "rate(1 hour)" or "rate(24 hours)"
    const rateMatch = schedule.match(/rate\((\d+)\s+(minute|hour|day)s?\)/i)
    if (rateMatch) {
      const value = Number.parseInt(rateMatch[1], 10)
      const unit = rateMatch[2].toLowerCase()
      switch (unit) {
        case 'minute':
          return value * 60 * 1000
        case 'hour':
          return value * 60 * 60 * 1000
        case 'day':
          return value * 24 * 60 * 60 * 1000
        default:
          return 0
      }
    }

    // For cron expressions, we'd need a cron parser
    // For now, return 0 (not supported)
    return 0
  }

  /**
   * Generate a backup name with timestamp
   */
  generateBackupName(tableName: string, prefix?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const p = prefix || 'backup'
    return `${tableName}-${p}-${timestamp}`
  }

  /**
   * Parse DynamoDB backup response to BackupDetails
   */
  static parseBackupDescription(response: {
    BackupDescription?: {
      BackupDetails?: {
        BackupArn?: string
        BackupName?: string
        BackupStatus?: string
        BackupType?: string
        BackupCreationDateTime?: Date
        BackupExpiryDateTime?: Date
        BackupSizeBytes?: number
      }
      SourceTableDetails?: {
        TableName?: string
        TableArn?: string
        ItemCount?: number
      }
    }
  }): BackupDetails | null {
    const backup = response.BackupDescription?.BackupDetails
    const source = response.BackupDescription?.SourceTableDetails

    if (!backup?.BackupArn || !backup?.BackupName) {
      return null
    }

    return {
      arn: backup.BackupArn,
      name: backup.BackupName,
      tableName: source?.TableName || '',
      tableArn: source?.TableArn || '',
      status: (backup.BackupStatus || 'AVAILABLE') as BackupStatus,
      type: (backup.BackupType || 'USER') as BackupType,
      createdAt: backup.BackupCreationDateTime || new Date(),
      expiresAt: backup.BackupExpiryDateTime,
      sizeBytes: backup.BackupSizeBytes,
      itemCount: source?.ItemCount,
    }
  }

  /**
   * Parse DynamoDB PITR response
   */
  static parsePITRDescription(response: {
    ContinuousBackupsDescription?: {
      ContinuousBackupsStatus?: string
      PointInTimeRecoveryDescription?: {
        PointInTimeRecoveryStatus?: string
        EarliestRestorableDateTime?: Date
        LatestRestorableDateTime?: Date
      }
    }
  }): PITRDescription {
    const pitr = response.ContinuousBackupsDescription?.PointInTimeRecoveryDescription

    return {
      status: (pitr?.PointInTimeRecoveryStatus === 'ENABLED' ? 'ENABLED' : 'DISABLED') as PITRStatus,
      earliestRestorableTime: pitr?.EarliestRestorableDateTime,
      latestRestorableTime: pitr?.LatestRestorableDateTime,
    }
  }

  /**
   * Clean up all intervals on shutdown
   */
  shutdown(): void {
    for (const interval of this.backupIntervals.values()) {
      clearInterval(interval)
    }
    this.backupIntervals.clear()
    this.scheduledBackups.clear()
  }
}

/**
 * Create a new backup manager
 */
export function createBackupManager(): BackupManager {
  return new BackupManager()
}
