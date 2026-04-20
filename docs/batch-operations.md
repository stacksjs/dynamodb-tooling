---
title: Batch Operations
description: Perform efficient bulk read and write operations with DynamoDB Tooling.
---
  tableName: 'MyApp',
  batchSize: 25,
  concurrency: 5,
  onProgress: (progress) => {
    console.log(`Imported ${progress.completed}/${progress.total} items`)
  },
})

// Import from array
await importer.importItems(arrayOf10000Items)

// Import from JSON file
await importer.importFromFile('./data/users.json')

// Import from CSV
await importer.importFromCSV('./data/users.csv', {
  delimiter: ',',
  headers: true,
})
```

## Bulk Export

Export table data:

```ts
import { createDataExporter } from 'dynamodb-tooling'

const exporter = createDataExporter({
  tableName: 'MyApp',
})

// Export to JSON
await exporter.exportToFile('./backup/users.json', {
  format: 'json',
  filter: { entityType: 'USER' },
})

// Export to CSV
await exporter.exportToFile('./backup/users.csv', {
  format: 'csv',
  columns: ['id', 'email', 'name', 'createdAt'],
})

// Stream export for large tables
const stream = await exporter.createExportStream({
  format: 'jsonl', // JSON Lines
})

stream.pipe(fs.createWriteStream('./backup/users.jsonl'))
```

## Parallel Scan

Scan large tables efficiently:

```ts
import { parallelScan } from 'dynamodb-tooling'

const results = await parallelScan({
  model: User,
  segments: 4, // Number of parallel segments
  filter: { status: 'active' },
  onProgress: (segment, items) => {
    console.log(`Segment ${segment}: ${items.length} items`)
  },
})
```

## Throttle Handling

Automatic retry with exponential backoff:

```ts
await User.batchCreate(items, {
  retryConfig: {
    maxRetries: 10,
    baseDelay: 50, // ms
    maxDelay: 5000, // ms
    backoffFactor: 2,
  },
})
```

## Monitoring Batch Operations

Track batch operation performance:

```ts
import { batchWrite, createMetricsRegistry } from 'dynamodb-tooling'

const metrics = createMetricsRegistry()

await batchWrite(items, {
  metrics,
  onBatch: (batchResult) => {
    console.log(`Batch ${batchResult.batchNumber}:`)
    console.log(`  Items: ${batchResult.itemCount}`)
    console.log(`  Duration: ${batchResult.duration}ms`)
    console.log(`  Retries: ${batchResult.retries}`)
  },
})

console.log('Total metrics:', metrics.getAll())
```

## Best Practices

### 1. Use Batch Operations for Bulk Data

```ts
// Good: Batch operation
await User.batchCreate(users)

// Bad: Individual operations
for (const user of users) {
  await User.create(user)
}
```

### 2. Handle Unprocessed Items

```ts
const result = await User.batchCreate(items)

if (result.unprocessedItems.length > 0) {
  // Retry or log unprocessed items
  console.warn('Unprocessed items:', result.unprocessedItems)
}
```

### 3. Use Transactions for Atomicity

When operations must succeed or fail together, use transactions:

```ts
await transactWrite([
  // All operations succeed or all fail
])
```

### 4. Monitor Consumed Capacity

```ts
const result = await User.batchGet(ids, {
  returnConsumedCapacity: 'TOTAL',
})

console.log('Consumed capacity:', result.consumedCapacity)
```

### 5. Implement Idempotency

Use unique request tokens for critical operations:

```ts
await transactWrite(operations, {
  clientRequestToken: generateIdempotencyKey(),
})
```

## Next Steps

- [Migrations](/migrations) - Schema migration management
- [Local Development](/local-development) - DynamoDB Local setup
- [Advanced Features](/advanced) - Multi-tenancy, caching, and more
