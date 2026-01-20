# Query Helpers

Learn how to query DynamoDB efficiently with dynamodb-tooling.

## Query vs Scan

DynamoDB has two main operations for retrieving multiple items:

- **Query**: Efficient, uses partition key (and optionally sort key)
- **Scan**: Reads entire table, expensive for large datasets

dynamodb-tooling optimizes for Query operations whenever possible.

## Basic Queries

### Query by Partition Key

```typescript
// Query items with specific partition key
const posts = await Post.query()
  .where('pk', 'USER#123')
  .get()
```

### Query with Sort Key

```typescript
// Query with sort key condition
const recentPosts = await Post.query()
  .where('pk', 'USER#123')
  .where('sk', 'begins_with', 'POST#2024')
  .get()
```

## Where Conditions

### Equality

```typescript
// Simple equality
User.query().where('status', 'active').get()

// With explicit operator
User.query().where('status', '=', 'active').get()
```

### Comparison Operators

```typescript
// Greater than
User.query().where('age', '>', 18).get()

// Less than or equal
User.query().where('score', '<=', 100).get()

// Not equal
User.query().where('status', '<>', 'banned').get()
```

### DynamoDB-Specific Operators

```typescript
// Begins with (for sort key queries)
Post.query()
  .where('pk', 'USER#123')
  .whereBeginsWith('sk', 'POST#2024')
  .get()

// Between (for sort key)
Order.query()
  .where('pk', 'USER#123')
  .whereBetween('sk', 'ORDER#2024-01', 'ORDER#2024-12')
  .get()

// Contains (for lists/sets)
Product.query()
  .whereContains('tags', 'featured')
  .get()

// Attribute exists
User.query()
  .whereExists('phoneNumber')
  .get()

// Attribute not exists
User.query()
  .whereNotExists('deletedAt')
  .get()
```

### Multiple Conditions

```typescript
// AND conditions
User.query()
  .where('status', 'active')
  .where('age', '>=', 18)
  .where('country', 'USA')
  .get()

// OR conditions (using filter)
User.query()
  .where('pk', 'DEPT#engineering')
  .filter((q) => {
    q.where('role', 'admin')
      .orWhere('role', 'manager')
  })
  .get()
```

### IN Operator

```typescript
// Where in array
User.query()
  .whereIn('status', ['active', 'pending'])
  .get()

// Where not in
User.query()
  .whereNotIn('role', ['banned', 'suspended'])
  .get()
```

### NULL Checks

```typescript
// Where null
User.query()
  .whereNull('deletedAt')
  .get()

// Where not null
User.query()
  .whereNotNull('emailVerifiedAt')
  .get()
```

## Using GSIs

### Query GSI by Name

```typescript
// Query using a specific GSI
const userPosts = await Post.query()
  .index('GSI1')
  .where('gsi1pk', 'USER#123')
  .orderByDesc('gsi1sk')
  .get()
```

### Auto-Select GSI

dynamodb-tooling can automatically select the best index:

```typescript
// Automatically uses appropriate GSI based on query
const posts = await Post.query()
  .where('userId', '123')
  .orderByDesc('createdAt')
  .get()
```

## Ordering

```typescript
// Ascending (default)
User.query().orderBy('createdAt').get()

// Descending
User.query().orderByDesc('createdAt').get()

// Shortcuts
User.query().latest().get()  // orderByDesc('createdAt')
User.query().oldest().get()  // orderBy('createdAt')
```

## Limiting Results

```typescript
// Limit results
User.query().limit(10).get()

// For pagination
const page1 = await User.query().limit(20).get()
```

## Pagination

### Cursor-Based Pagination

Recommended for DynamoDB:

```typescript
// First page
const page1 = await User.query()
  .where('pk', 'USERS')
  .limit(20)
  .cursorPaginate()

// Next page
const page2 = await User.query()
  .where('pk', 'USERS')
  .limit(20)
  .cursorPaginate(page1.nextCursor)

// Response format
{
  data: [...],
  nextCursor: 'eyJwayI6...',
  prevCursor: 'eyJwayI6...',
  hasMore: true
}
```

### Standard Pagination

```typescript
const result = await User.query().paginate(20, 1)

// Response format
{
  data: [...],
  total: 100,
  perPage: 20,
  currentPage: 1,
  lastPage: 5
}
```

## Chunking

Process large datasets in chunks:

```typescript
// Process in batches
await User.query()
  .where('status', 'active')
  .chunk(100, async (users) => {
    for (const user of users) {
      await processUser(user)
    }
  })
```

## Batch Operations

### Batch Get

```typescript
import { batchGet } from 'dynamodb-tooling'

const users = await batchGet('MyApp', [
  { pk: 'USER#1', sk: 'USER#1' },
  { pk: 'USER#2', sk: 'USER#2' },
  { pk: 'USER#3', sk: 'USER#3' }
])
```

### Batch Write

```typescript
import { batchWrite } from 'dynamodb-tooling'

await batchWrite('MyApp', {
  put: [
    { pk: 'USER#1', sk: 'USER#1', name: 'John' },
    { pk: 'USER#2', sk: 'USER#2', name: 'Jane' }
  ],
  delete: [
    { pk: 'USER#3', sk: 'USER#3' }
  ]
})
```

### Transact Write

```typescript
import { transactWrite } from 'dynamodb-tooling'

await transactWrite([
  {
    Put: {
      TableName: 'MyApp',
      Item: { pk: 'USER#1', sk: 'USER#1', balance: 100 }
    }
  },
  {
    Update: {
      TableName: 'MyApp',
      Key: { pk: 'USER#2', sk: 'USER#2' },
      UpdateExpression: 'SET balance = balance - :amount',
      ExpressionAttributeValues: { ':amount': 100 }
    }
  }
])
```

## Projections

Select specific attributes:

```typescript
const users = await User.query()
  .select(['id', 'name', 'email'])
  .get()
```

## Consistent Reads

```typescript
// Use strongly consistent read
const user = await User.query()
  .where('pk', 'USER#123')
  .consistentRead()
  .first()
```

## Aggregations

```typescript
// Count
const count = await User.query()
  .where('status', 'active')
  .count()

// Sum (client-side)
const total = await Order.query()
  .where('userId', '123')
  .sum('total')

// Average
const avgAge = await User.query().avg('age')

// Min/Max
const youngest = await User.query().min('age')
const oldest = await User.query().max('age')
```

## Examples

### User Posts Feed

```typescript
async function getUserFeed(userId: string, cursor?: string) {
  return Post.query()
    .index('GSI1')
    .where('gsi1pk', `USER#${userId}`)
    .orderByDesc('gsi1sk')
    .limit(20)
    .cursorPaginate(cursor)
}
```

### Search with Filters

```typescript
async function searchProducts(filters: ProductFilters) {
  let query = Product.query()
    .where('pk', `CATEGORY#${filters.category}`)

  if (filters.minPrice) {
    query = query.where('price', '>=', filters.minPrice)
  }

  if (filters.maxPrice) {
    query = query.where('price', '<=', filters.maxPrice)
  }

  if (filters.inStock) {
    query = query.where('stock', '>', 0)
  }

  return query
    .orderBy('price')
    .limit(50)
    .get()
}
```

### Time-Range Query

```typescript
async function getOrdersInRange(userId: string, start: Date, end: Date) {
  return Order.query()
    .index('GSI1')
    .where('gsi1pk', `USER#${userId}`)
    .whereBetween('gsi1sk',
      `ORDER#${start.toISOString()}`,
      `ORDER#${end.toISOString()}`
    )
    .get()
}
```

## Performance Tips

1. **Always use Query over Scan** when possible
2. **Design keys for access patterns** before building
3. **Use sparse indexes** for filtered queries
4. **Limit result sets** to what you need
5. **Use projections** to reduce data transfer
6. **Batch operations** for multiple items

## Next Steps

- Set up [local development](./local.md)
- Learn about [table operations](./tables.md)
