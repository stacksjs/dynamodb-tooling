---
title: Table Operations
description: Create, manage, and configure DynamoDB tables with DynamoDB Tooling.
---

```ts
import { createGlobalTableManager } from 'dynamodb-tooling'

const globalTableManager = createGlobalTableManager({
  tableName: 'MyApp',
  regions: ['us-east-1', 'eu-west-1', 'ap-northeast-1'],
})

// Create global table
await globalTableManager.create()

// Add a new region
await globalTableManager.addRegion('ap-southeast-1')

// Get status
const status = await globalTableManager.describe()
console.log(status.replicaDescriptions)
```

## Backup & Restore

### On-Demand Backup

```ts
import { createBackupManager } from 'dynamodb-tooling'

const backupManager = createBackupManager({
  tableName: 'MyApp',
})

// Create backup
const backup = await backupManager.createBackup('pre-migration-backup')
console.log(`Backup created: ${backup.backupArn}`)

// List backups
const backups = await backupManager.listBackups()

// Restore from backup
await backupManager.restoreFromBackup({
  backupArn: backup.backupArn,
  targetTableName: 'MyApp-Restored',
})
```

### Point-in-Time Recovery

```ts
// Enable PITR
await backupManager.enablePointInTimeRecovery()

// Get PITR status
const pitrStatus = await backupManager.describePointInTimeRecovery()

// Restore to a specific point in time
await backupManager.restoreToPointInTime({
  targetTableName: 'MyApp-PITR-Restore',
  restoreDateTime: new Date('2024-01-15T10:00:00Z'),
})
```

## Auto Scaling

Configure auto scaling for provisioned tables:

```ts
import { configureAutoScaling } from 'dynamodb-tooling'

await configureAutoScaling({
  tableName: 'MyApp',
  readCapacity: {
    min: 5,
    max: 100,
    targetUtilization: 70,
  },
  writeCapacity: {
    min: 5,
    max: 50,
    targetUtilization: 70,
  },
})
```

## Table Metrics

Monitor table performance:

```ts
import { getTableMetrics } from 'dynamodb-tooling'

const metrics = await getTableMetrics('MyApp', {
  period: 300, // 5 minutes
  startTime: new Date(Date.now() - 24 _ 60 _ 60 * 1000), // Last 24 hours
})

console.log('Read Capacity Units:', metrics.consumedReadCapacityUnits)
console.log('Write Capacity Units:', metrics.consumedWriteCapacityUnits)
console.log('Throttled Requests:', metrics.throttledRequests)
```

## Best Practices

### 1. Use On-Demand for Variable Workloads

```ts
{
  billingMode: 'PAY_PER_REQUEST',
}
```

### 2. Plan GSIs Carefully

GSIs consume additional capacity and storage. Plan them based on your access patterns.

### 3. Enable PITR for Production

```ts
await backupManager.enablePointInTimeRecovery()
```

### 4. Monitor Throttling

Set up alarms for throttled requests to catch capacity issues early.

### 5. Use Tags for Cost Tracking

```ts
{
  tags: {
    Environment: 'production',
    Project: 'MyApp',
    Team: 'Backend',
  },
}
```

## Next Steps

- [Query Helpers](/query-helpers) - Learn the query builder
- [Batch Operations](/batch-operations) - Efficient bulk operations
- [Migrations](/migrations) - Schema migration management
