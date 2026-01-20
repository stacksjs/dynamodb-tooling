---
title: Table Operations
description: Create, manage, and configure DynamoDB tables with DynamoDB Tooling.
---

# Table Operations

DynamoDB Tooling provides comprehensive tools for managing DynamoDB tables, including creation, configuration, and maintenance.

## Creating Tables

### From Models

The recommended approach is to generate tables from your model definitions:

```bash
# Generate table schema from models
dbtooling table:create

# Preview the table schema
dbtooling table:create --dry-run
```

### Programmatic Creation

Create tables programmatically:

```ts
import { createTable, TableDefinition } from 'dynamodb-tooling'

const tableDefinition: TableDefinition = {
  tableName: 'MyApp',
  partitionKey: { name: 'pk', type: 'S' },
  sortKey: { name: 'sk', type: 'S' },
  globalSecondaryIndexes: [
    {
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: 'S' },
      sortKey: { name: 'gsi1sk', type: 'S' },
    },
    {
      indexName: 'GSI2',
      partitionKey: { name: 'gsi2pk', type: 'S' },
      sortKey: { name: 'gsi2sk', type: 'S' },
    },
  ],
  billingMode: 'PAY_PER_REQUEST',
}

await createTable(tableDefinition)
```

## Table Configuration

### Billing Mode

Choose between on-demand and provisioned capacity:

```ts
// On-demand (pay-per-request)
{
  billingMode: 'PAY_PER_REQUEST',
}

// Provisioned capacity
{
  billingMode: 'PROVISIONED',
  provisionedThroughput: {
    readCapacityUnits: 5,
    writeCapacityUnits: 5,
  },
}
```

### Global Secondary Indexes (GSI)

Configure GSIs for alternative access patterns:

```ts
{
  globalSecondaryIndexes: [
    {
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: 'S' },
      sortKey: { name: 'gsi1sk', type: 'S' },
      projection: { type: 'ALL' }, // or 'KEYS_ONLY', 'INCLUDE'
    },
    {
      indexName: 'ByEmail',
      partitionKey: { name: 'email', type: 'S' },
      projection: {
        type: 'INCLUDE',
        nonKeyAttributes: ['name', 'status'],
      },
    },
  ],
}
```

### Local Secondary Indexes (LSI)

LSIs must be defined at table creation:

```ts
{
  localSecondaryIndexes: [
    {
      indexName: 'LSI1',
      sortKey: { name: 'createdAt', type: 'S' },
      projection: { type: 'ALL' },
    },
  ],
}
```

### Time to Live (TTL)

Enable automatic item expiration:

```ts
{
  ttl: {
    enabled: true,
    attributeName: 'expiresAt',
  },
}
```

### Streams

Enable DynamoDB Streams for change data capture:

```ts
{
  stream: {
    enabled: true,
    viewType: 'NEW_AND_OLD_IMAGES', // or 'KEYS_ONLY', 'NEW_IMAGE', 'OLD_IMAGE'
  },
}
```

## CLI Commands

### List Tables

```bash
# List all tables
dbtooling table:list

# Filter by prefix
dbtooling table:list --prefix MyApp
```

### Describe Table

```bash
# Get table details
dbtooling table:describe MyApp

# Output as JSON
dbtooling table:describe MyApp --format json
```

### Delete Table

```bash
# Delete a table (with confirmation)
dbtooling table:delete MyApp

# Force delete without confirmation
dbtooling table:delete MyApp --force
```

## Global Tables

Create multi-region global tables for disaster recovery:

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
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
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
