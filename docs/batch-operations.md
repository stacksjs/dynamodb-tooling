---
title: Batch Operations
description: Perform efficient bulk read and write operations with DynamoDB Tooling.
---

# Batch Operations

DynamoDB Tooling provides efficient batch operations for bulk reads and writes, handling DynamoDB's limits and throttling automatically.

## Batch Get

Retrieve multiple items efficiently:

```ts
import { User } from './models/User'

// Get multiple items by ID
const users = await User.batchGet([
  'user-1',
  'user-2',
  'user-3',
])

// With consistent read
const users = await User.batchGet(['user-1', 'user-2'], {
  consistentRead: true,
})

// With projection
const users = await User.batchGet(['user-1', 'user-2'], {
  projection: ['id', 'name', 'email'],
})
```

### Cross-Model Batch Get

Retrieve items from multiple models:

```ts
import { batchGet } from 'dynamodb-tooling'

const results = await batchGet([
  { model: User, keys: ['user-1', 'user-2'] },
  { model: Post, keys: ['post-1', 'post-2'] },
  { model: Comment, keys: ['comment-1'] },
])

console.log(results.users)    // User[]
console.log(results.posts)    // Post[]
console.log(results.comments) // Comment[]
```

### Handling Large Batches

DynamoDB limits batch get to 100 items. The library handles this automatically:

```ts
// Automatically splits into multiple requests
const users = await User.batchGet(arrayOf500UserIds)

// With custom concurrency
const users = await User.batchGet(arrayOf500UserIds, {
  concurrency: 5, // Number of parallel requests
})
```

## Batch Write

Write multiple items efficiently:

```ts
// Batch create
await User.batchCreate([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
  { email: 'user3@example.com', name: 'User 3' },
])

// Batch update
await User.batchUpdate([
  { id: 'user-1', status: 'active' },
  { id: 'user-2', status: 'active' },
  { id: 'user-3', status: 'inactive' },
])

// Batch delete
await User.batchDelete(['user-1', 'user-2', 'user-3'])
```

### Mixed Batch Operations

Combine different operations in one batch:

```ts
import { batchWrite } from 'dynamodb-tooling'

await batchWrite([
  { type: 'put', model: User, item: { id: 'user-new', name: 'New User' } },
  { type: 'put', model: Post, item: { id: 'post-new', title: 'New Post' } },
  { type: 'delete', model: User, key: 'user-old' },
  { type: 'delete', model: Comment, key: 'comment-old' },
])
```

### Handling Large Writes

DynamoDB limits batch write to 25 items:

```ts
// Automatically splits into multiple requests
await User.batchCreate(arrayOf1000Users)

// With retry handling for unprocessed items
await User.batchCreate(arrayOf1000Users, {
  retryUnprocessed: true,
  retryDelay: 100, // ms
  maxRetries: 5,
})
```

## Transactions

For atomic operations across multiple items:

### Transaction Write

```ts
import { transactWrite } from 'dynamodb-tooling'

await transactWrite([
  {
    type: 'put',
    model: User,
    item: { id: 'user-1', name: 'John', balance: 100 },
  },
  {
    type: 'update',
    model: Account,
    key: 'account-1',
    update: { balance: { $add: -50 } },
  },
  {
    type: 'conditionCheck',
    model: Order,
    key: 'order-1',
    condition: { status: 'pending' },
  },
  {
    type: 'delete',
    model: TempRecord,
    key: 'temp-1',
  },
])
```

### Transaction Get

```ts
import { transactGet } from 'dynamodb-tooling'

const [user, account, order] = await transactGet([
  { model: User, key: 'user-1' },
  { model: Account, key: 'account-1' },
  { model: Order, key: 'order-1' },
])
```

### Idempotent Transactions

Use client tokens for idempotency:

```ts
await transactWrite([
  // ... operations
], {
  clientRequestToken: 'unique-request-id-123',
})
```

## Bulk Import

For large-scale data imports:

```ts
import { createDataImporter } from 'dynamodb-tooling'

const importer = createDataImporter({
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
