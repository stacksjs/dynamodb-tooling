// ============================================================================
// Global Table Manager - DynamoDB Global Tables Support
// ============================================================================

/**
 * Global table status
 */
export type GlobalTableStatus = 'CREATING' | 'ACTIVE' | 'DELETING' | 'UPDATING'

/**
 * Replica status
 */
export type ReplicaStatus =
  | 'CREATING'
  | 'CREATION_FAILED'
  | 'UPDATING'
  | 'DELETING'
  | 'ACTIVE'
  | 'REGION_DISABLED'
  | 'INACCESSIBLE_ENCRYPTION_CREDENTIALS'

/**
 * AWS region
 */
export type AWSRegion =
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'eu-west-2'
  | 'eu-west-3'
  | 'eu-central-1'
  | 'eu-north-1'
  | 'ap-northeast-1'
  | 'ap-northeast-2'
  | 'ap-northeast-3'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'ap-south-1'
  | 'sa-east-1'
  | 'ca-central-1'
  | 'me-south-1'
  | 'af-south-1'
  | string

/**
 * Replica description
 */
export interface ReplicaDescription {
  /** Region name */
  region: AWSRegion
  /** Replica status */
  status: ReplicaStatus
  /** KMS key ID for encryption */
  kmsKeyId?: string
  /** Provisioned throughput override */
  provisionedThroughput?: {
    readCapacityUnits?: number
    writeCapacityUnits?: number
  }
  /** Global secondary index settings */
  globalSecondaryIndexes?: Array<{
    indexName: string
    provisionedThroughput?: {
      readCapacityUnits?: number
      writeCapacityUnits?: number
    }
  }>
  /** Replica table class override */
  tableClassOverride?: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'
}

/**
 * Global table description
 */
export interface GlobalTableDescription {
  /** Table name */
  tableName: string
  /** Global table status */
  status: GlobalTableStatus
  /** List of replicas */
  replicas: ReplicaDescription[]
  /** Creation time */
  createdAt?: Date
  /** Last update time */
  lastUpdatedAt?: Date
}

/**
 * Replica settings
 */
export interface ReplicaSettings {
  /** Region name */
  region: AWSRegion
  /** KMS key ID for encryption (optional) */
  kmsKeyId?: string
  /** Provisioned throughput override (optional) */
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  /** Global secondary index overrides */
  globalSecondaryIndexes?: Array<{
    indexName: string
    provisionedThroughput: {
      readCapacityUnits: number
      writeCapacityUnits: number
    }
  }>
  /** Table class override */
  tableClassOverride?: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'
}

/**
 * Replica auto-scaling settings
 */
export interface ReplicaAutoScalingSettings {
  /** Region name */
  region: AWSRegion
  /** Read capacity auto-scaling */
  readCapacity?: {
    minCapacity: number
    maxCapacity: number
    targetUtilization: number
  }
  /** Write capacity auto-scaling */
  writeCapacity?: {
    minCapacity: number
    maxCapacity: number
    targetUtilization: number
  }
  /** GSI auto-scaling */
  globalSecondaryIndexes?: Array<{
    indexName: string
    readCapacity?: {
      minCapacity: number
      maxCapacity: number
      targetUtilization: number
    }
    writeCapacity?: {
      minCapacity: number
      maxCapacity: number
      targetUtilization: number
    }
  }>
}

/**
 * Global table manager for multi-region DynamoDB tables
 */
export class GlobalTableManager {
  private primaryRegion: AWSRegion
  private tableName: string

  constructor(tableName: string, primaryRegion: AWSRegion) {
    this.tableName = tableName
    this.primaryRegion = primaryRegion
  }

  /**
   * Create a global table (v2 - using UpdateTable)
   */
  createGlobalTable(replicaRegions: AWSRegion[]): {
    command: 'UpdateTable'
    input: {
      TableName: string
      ReplicaUpdates: Array<{
        Create: {
          RegionName: string
        }
      }>
    }
  } {
    return {
      command: 'UpdateTable',
      input: {
        TableName: this.tableName,
        ReplicaUpdates: replicaRegions.map(region => ({
          Create: {
            RegionName: region,
          },
        })),
      },
    }
  }

  /**
   * Add a replica region
   */
  addReplica(settings: ReplicaSettings): {
    command: 'UpdateTable'
    input: {
      TableName: string
      ReplicaUpdates: Array<{
        Create: {
          RegionName: string
          KMSMasterKeyId?: string
          ProvisionedThroughputOverride?: {
            ReadCapacityUnits: number
          }
          GlobalSecondaryIndexes?: Array<{
            IndexName: string
            ProvisionedThroughputOverride: {
              ReadCapacityUnits: number
            }
          }>
          TableClassOverride?: string
        }
      }>
    }
  } {
    const createSpec: {
      RegionName: string
      KMSMasterKeyId?: string
      ProvisionedThroughputOverride?: {
        ReadCapacityUnits: number
      }
      GlobalSecondaryIndexes?: Array<{
        IndexName: string
        ProvisionedThroughputOverride: {
          ReadCapacityUnits: number
        }
      }>
      TableClassOverride?: string
    } = {
      RegionName: settings.region,
    }

    if (settings.kmsKeyId) {
      createSpec.KMSMasterKeyId = settings.kmsKeyId
    }

    if (settings.provisionedThroughput?.readCapacityUnits) {
      createSpec.ProvisionedThroughputOverride = {
        ReadCapacityUnits: settings.provisionedThroughput.readCapacityUnits,
      }
    }

    if (settings.globalSecondaryIndexes) {
      createSpec.GlobalSecondaryIndexes = settings.globalSecondaryIndexes.map(gsi => ({
        IndexName: gsi.indexName,
        ProvisionedThroughputOverride: {
          ReadCapacityUnits: gsi.provisionedThroughput.readCapacityUnits,
        },
      }))
    }

    if (settings.tableClassOverride) {
      createSpec.TableClassOverride = settings.tableClassOverride
    }

    return {
      command: 'UpdateTable',
      input: {
        TableName: this.tableName,
        ReplicaUpdates: [{ Create: createSpec }],
      },
    }
  }

  /**
   * Remove a replica region
   */
  removeReplica(region: AWSRegion): {
    command: 'UpdateTable'
    input: {
      TableName: string
      ReplicaUpdates: Array<{
        Delete: {
          RegionName: string
        }
      }>
    }
  } {
    return {
      command: 'UpdateTable',
      input: {
        TableName: this.tableName,
        ReplicaUpdates: [
          {
            Delete: {
              RegionName: region,
            },
          },
        ],
      },
    }
  }

  /**
   * Update replica settings
   */
  updateReplica(settings: ReplicaSettings): {
    command: 'UpdateTable'
    input: {
      TableName: string
      ReplicaUpdates: Array<{
        Update: {
          RegionName: string
          KMSMasterKeyId?: string
          ProvisionedThroughputOverride?: {
            ReadCapacityUnits: number
          }
          GlobalSecondaryIndexes?: Array<{
            IndexName: string
            ProvisionedThroughputOverride: {
              ReadCapacityUnits: number
            }
          }>
          TableClassOverride?: string
        }
      }>
    }
  } {
    const updateSpec: {
      RegionName: string
      KMSMasterKeyId?: string
      ProvisionedThroughputOverride?: {
        ReadCapacityUnits: number
      }
      GlobalSecondaryIndexes?: Array<{
        IndexName: string
        ProvisionedThroughputOverride: {
          ReadCapacityUnits: number
        }
      }>
      TableClassOverride?: string
    } = {
      RegionName: settings.region,
    }

    if (settings.kmsKeyId) {
      updateSpec.KMSMasterKeyId = settings.kmsKeyId
    }

    if (settings.provisionedThroughput?.readCapacityUnits) {
      updateSpec.ProvisionedThroughputOverride = {
        ReadCapacityUnits: settings.provisionedThroughput.readCapacityUnits,
      }
    }

    if (settings.globalSecondaryIndexes) {
      updateSpec.GlobalSecondaryIndexes = settings.globalSecondaryIndexes.map(gsi => ({
        IndexName: gsi.indexName,
        ProvisionedThroughputOverride: {
          ReadCapacityUnits: gsi.provisionedThroughput.readCapacityUnits,
        },
      }))
    }

    if (settings.tableClassOverride) {
      updateSpec.TableClassOverride = settings.tableClassOverride
    }

    return {
      command: 'UpdateTable',
      input: {
        TableName: this.tableName,
        ReplicaUpdates: [{ Update: updateSpec }],
      },
    }
  }

  /**
   * Describe the global table
   */
  describeTable(): {
    command: 'DescribeTable'
    input: {
      TableName: string
    }
  } {
    return {
      command: 'DescribeTable',
      input: {
        TableName: this.tableName,
      },
    }
  }

  /**
   * Describe table replica auto-scaling
   */
  describeTableReplicaAutoScaling(): {
    command: 'DescribeTableReplicaAutoScaling'
    input: {
      TableName: string
    }
  } {
    return {
      command: 'DescribeTableReplicaAutoScaling',
      input: {
        TableName: this.tableName,
      },
    }
  }

  /**
   * Update table replica auto-scaling
   */
  updateReplicaAutoScaling(settings: ReplicaAutoScalingSettings): {
    command: 'UpdateTableReplicaAutoScaling'
    input: Record<string, unknown>
  } {
    const input: Record<string, unknown> = {
      TableName: this.tableName,
      ReplicaUpdates: [],
    }

    const replicaUpdate: Record<string, unknown> = {
      RegionName: settings.region,
    }

    if (settings.readCapacity) {
      replicaUpdate.ReplicaProvisionedReadCapacityAutoScalingUpdate = {
        MinimumUnits: settings.readCapacity.minCapacity,
        MaximumUnits: settings.readCapacity.maxCapacity,
        ScalingPolicyUpdate: {
          TargetTrackingScalingPolicyConfiguration: {
            TargetValue: settings.readCapacity.targetUtilization,
          },
        },
      }
    }

    if (settings.globalSecondaryIndexes) {
      replicaUpdate.ReplicaGlobalSecondaryIndexUpdates = settings.globalSecondaryIndexes.map((gsi) => {
        const gsiUpdate: Record<string, unknown> = {
          IndexName: gsi.indexName,
        }

        if (gsi.readCapacity) {
          gsiUpdate.ProvisionedReadCapacityAutoScalingUpdate = {
            MinimumUnits: gsi.readCapacity.minCapacity,
            MaximumUnits: gsi.readCapacity.maxCapacity,
            ScalingPolicyUpdate: {
              TargetTrackingScalingPolicyConfiguration: {
                TargetValue: gsi.readCapacity.targetUtilization,
              },
            },
          }
        }

        return gsiUpdate
      })
    }

    (input.ReplicaUpdates as Record<string, unknown>[]).push(replicaUpdate)

    return {
      command: 'UpdateTableReplicaAutoScaling',
      input,
    }
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName
  }

  /**
   * Get primary region
   */
  getPrimaryRegion(): AWSRegion {
    return this.primaryRegion
  }

  /**
   * Parse DynamoDB DescribeTable response for global table info
   */
  static parseDescribeTableResponse(response: {
    Table?: {
      TableName?: string
      TableStatus?: string
      Replicas?: Array<{
        RegionName?: string
        ReplicaStatus?: string
        KMSMasterKeyId?: string
        ProvisionedThroughputOverride?: {
          ReadCapacityUnits?: number
        }
        GlobalSecondaryIndexes?: Array<{
          IndexName?: string
          ProvisionedThroughputOverride?: {
            ReadCapacityUnits?: number
          }
        }>
        ReplicaTableClassSummary?: {
          TableClass?: string
        }
      }>
      CreationDateTime?: Date
    }
  }): GlobalTableDescription | null {
    const table = response.Table
    if (!table?.TableName) {
      return null
    }

    const replicas: ReplicaDescription[] = (table.Replicas || []).map(replica => ({
      region: replica.RegionName || '',
      status: (replica.ReplicaStatus || 'ACTIVE') as ReplicaStatus,
      kmsKeyId: replica.KMSMasterKeyId,
      provisionedThroughput: replica.ProvisionedThroughputOverride
        ? {
            readCapacityUnits: replica.ProvisionedThroughputOverride.ReadCapacityUnits,
          }
        : undefined,
      globalSecondaryIndexes: replica.GlobalSecondaryIndexes?.map(gsi => ({
        indexName: gsi.IndexName || '',
        provisionedThroughput: gsi.ProvisionedThroughputOverride
          ? {
              readCapacityUnits: gsi.ProvisionedThroughputOverride.ReadCapacityUnits,
            }
          : undefined,
      })),
      tableClassOverride: replica.ReplicaTableClassSummary?.TableClass as 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS' | undefined,
    }))

    return {
      tableName: table.TableName,
      status: (table.TableStatus === 'ACTIVE' ? 'ACTIVE' : 'UPDATING') as GlobalTableStatus,
      replicas,
      createdAt: table.CreationDateTime,
    }
  }

  /**
   * Get recommended regions based on latency requirements
   */
  static getRecommendedRegions(primaryRegion: AWSRegion, requirements: {
    coverage?: 'americas' | 'europe' | 'asia-pacific' | 'global'
    maxLatencyMs?: number
  }): AWSRegion[] {
    const regionGroups: Record<string, AWSRegion[]> = {
      americas: ['us-east-1', 'us-west-2', 'sa-east-1', 'ca-central-1'],
      europe: ['eu-west-1', 'eu-central-1', 'eu-north-1'],
      'asia-pacific': ['ap-northeast-1', 'ap-southeast-1', 'ap-south-1', 'ap-southeast-2'],
    }

    const coverage = requirements.coverage || 'global'

    if (coverage === 'global') {
      return [
        ...regionGroups.americas,
        ...regionGroups.europe,
        ...regionGroups['asia-pacific'],
      ].filter(r => r !== primaryRegion)
    }

    return (regionGroups[coverage] || []).filter(r => r !== primaryRegion)
  }

  /**
   * Calculate estimated replication lag between regions
   */
  static estimateReplicationLag(sourceRegion: AWSRegion, targetRegion: AWSRegion): {
    estimatedLagMs: number
    distance: 'same-continent' | 'cross-continent' | 'cross-ocean'
  } {
    // Simplified estimation based on geographic distance
    const continentMap: Record<string, string> = {
      'us-east-1': 'americas',
      'us-east-2': 'americas',
      'us-west-1': 'americas',
      'us-west-2': 'americas',
      'ca-central-1': 'americas',
      'sa-east-1': 'americas',
      'eu-west-1': 'europe',
      'eu-west-2': 'europe',
      'eu-west-3': 'europe',
      'eu-central-1': 'europe',
      'eu-north-1': 'europe',
      'ap-northeast-1': 'asia',
      'ap-northeast-2': 'asia',
      'ap-northeast-3': 'asia',
      'ap-southeast-1': 'asia',
      'ap-southeast-2': 'oceania',
      'ap-south-1': 'asia',
      'me-south-1': 'middle-east',
      'af-south-1': 'africa',
    }

    const sourceContinent = continentMap[sourceRegion] || 'unknown'
    const targetContinent = continentMap[targetRegion] || 'unknown'

    if (sourceContinent === targetContinent) {
      return { estimatedLagMs: 50, distance: 'same-continent' }
    }

    // Cross-continent but same general area
    const adjacentContinents = [
      ['americas', 'europe'],
      ['europe', 'asia'],
      ['europe', 'africa'],
      ['europe', 'middle-east'],
      ['asia', 'oceania'],
    ]

    const isAdjacent = adjacentContinents.some(
      pair =>
        (pair[0] === sourceContinent && pair[1] === targetContinent)
        || (pair[1] === sourceContinent && pair[0] === targetContinent),
    )

    if (isAdjacent) {
      return { estimatedLagMs: 150, distance: 'cross-continent' }
    }

    // Cross-ocean (e.g., Americas to Asia)
    return { estimatedLagMs: 300, distance: 'cross-ocean' }
  }
}

/**
 * Create a global table manager
 */
export function createGlobalTableManager(tableName: string, primaryRegion: AWSRegion): GlobalTableManager {
  return new GlobalTableManager(tableName, primaryRegion)
}
