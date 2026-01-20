---
title: Query Helpers
description: Build DynamoDB queries with a fluent, Laravel-style query builder.
---

# Query Helpers

DynamoDB Tooling provides a powerful, fluent query builder inspired by Laravel's Eloquent ORM.

## Basic Queries

### Find by Primary Key

```ts
// Find single item by ID
const user = await User.find('user-123')

// Find multiple items
const users = await User.findMany(['user-1', 'user-2', 'user-3'])

// Find or fail (throws if not found)
const user = await User.findOrFail('user-123')
```

### Get All Items

```ts
// Get all items (use with caution on large tables)
const allUsers = await User.query().get()

// Get first item
const firstUser = await User.query().first()

// Get first or fail
const user = await User.query().firstOrFail()
```

## Where Conditions

### Basic Comparisons

```ts
// Equality
User.query().where('status', 'active').get()
User.query().where('status', '=', 'active').get()

// Inequality
User.query().where('age', '!=', 18).get()
User.query().where('age', '<>', 18).get()

// Greater/Less than
User.query().where('age', '>', 18).get()
User.query().where('age', '>=', 18).get()
User.query().where('age', '<', 65).get()
User.query().where('age', '<=', 65).get()
```

### Multiple Conditions

```ts
// AND conditions
User.query()
  .where('status', 'active')
  .where('age', '>=', 18)
  .where('role', 'admin')
  .get()

// Explicit AND
User.query()
  .where('status', 'active')
  .andWhere('verified', true)
  .get()

// OR conditions
User.query()
  .where('role', 'admin')
  .orWhere('role', 'moderator')
  .get()
```

### Special Conditions

```ts
// IN clause
User.query().whereIn('role', ['admin', 'moderator']).get()
User.query().whereNotIn('status', ['banned', 'suspended']).get()

// BETWEEN
User.query().whereBetween('age', 18, 65).get()
User.query().whereNotBetween('createdAt', startDate, endDate).get()

// NULL checks
User.query().whereNull('deletedAt').get()
User.query().whereNotNull('emailVerifiedAt').get()

// String operations (DynamoDB specific)
User.query().whereBeginsWith('sk', 'USER#').get()
User.query().whereContains('tags', 'featured').get()
User.query().whereNotContains('tags', 'spam').get()

// Attribute exists
User.query().whereExists('profileImage').get()
User.query().whereNotExists('deletedAt').get()
```

## Ordering & Limiting

### Order By

```ts
// Ascending order
User.query().orderBy('name').get()
User.query().orderBy('name', 'asc').get()

// Descending order
User.query().orderByDesc('createdAt').get()
User.query().orderBy('createdAt', 'desc').get()

// Shortcuts
User.query().latest().get() // orderBy('createdAt', 'desc')
User.query().oldest().get() // orderBy('createdAt', 'asc')
```

### Limiting Results

```ts
// Limit
User.query().limit(10).get()

// Take (alias)
User.query().take(10).get()

// Skip (for manual pagination)
User.query().skip(20).limit(10).get()
```

## Pagination

### Offset Pagination

```ts
// Get paginated results
const page = await User.query().paginate(20) // 20 items per page

console.log(page.data)       // Array of items
console.log(page.total)      // Total count
console.log(page.perPage)    // Items per page
console.log(page.currentPage)// Current page number
console.log(page.lastPage)   // Last page number
```

### Cursor Pagination

```ts
// First page
const firstPage = await User.query()
  .orderBy('createdAt')
  .cursorPaginate(20)

console.log(firstPage.data)
console.log(firstPage.nextCursor) // Use this for next page

// Next page
const nextPage = await User.query()
  .orderBy('createdAt')
  .cursorPaginate(20, firstPage.nextCursor)
```

### Chunking for Large Datasets

```ts
// Process items in chunks
await User.query().chunk(100, async (users) => {
  for (const user of users) {
    await processUser(user)
  }
})

// With parallel processing
await User.query().chunkById(100, async (users) => {
  await Promise.all(users.map(processUser))
})
```

## Relationships

### Eager Loading

```ts
// Load single relationship
const users = await User.query()
  .with('posts')
  .get()

// Load multiple relationships
const users = await User.query()
  .with('posts', 'profile')
  .get()

// Nested relationships
const users = await User.query()
  .with('posts.comments')
  .get()

// Constrained eager loading
const users = await User.query()
  .with('posts', query => query.where('published', true).limit(5))
  .get()
```

### Relationship Counts

```ts
// Get count of related items
const users = await User.query()
  .withCount('posts')
  .get()

// users[0].postsCount = 5
```

### Relationship Existence

```ts
// Has relationship
const usersWithPosts = await User.query()
  .has('posts')
  .get()

// Has with count
const usersWithManyPosts = await User.query()
  .has('posts', '>=', 10)
  .get()

// Doesn't have relationship
const usersWithoutPosts = await User.query()
  .doesntHave('posts')
  .get()

// Where has with conditions
const usersWithPublishedPosts = await User.query()
  .whereHas('posts', query => query.where('published', true))
  .get()
```

## Aggregations

```ts
// Count
const count = await User.query().count()
const activeCount = await User.query().where('status', 'active').count()

// Sum
const totalBalance = await User.query().sum('balance')

// Average
const avgAge = await User.query().avg('age')

// Min/Max
const minAge = await User.query().min('age')
const maxAge = await User.query().max('age')

// Exists
const hasAdmins = await User.query().where('role', 'admin').exists()
const noAdmins = await User.query().where('role', 'admin').doesntExist()
```

## Soft Deletes

If your model has soft deletes enabled:

```ts
// Exclude soft deleted (default)
const activeUsers = await User.query().get()

// Include soft deleted
const allUsers = await User.query().withTrashed().get()

// Only soft deleted
const deletedUsers = await User.query().onlyTrashed().get()

// Restore soft deleted
const user = await User.query().withTrashed().find('user-123')
await user.restore()

// Permanently delete
await user.forceDelete()
```

## Query Scopes

Define reusable query constraints on your models:

```ts
// In your model
class User extends DynamoDBModel {
  // ... attributes

  scopes = {
    active: (query) => query.where('status', 'active'),
    adults: (query) => query.where('age', '>=', 18),
    role: (query, role: string) => query.where('role', role),
  }
}

// Usage
const activeAdults = await User.query()
  .active()
  .adults()
  .get()

const admins = await User.query()
  .role('admin')
  .get()
```

## Raw Key Access

For direct DynamoDB key access:

```ts
// Query by partition key
const results = await User.query()
  .pk('USER#123')
  .get()

// Query by pk and sk
const results = await User.query()
  .pk('USER#123')
  .sk('begins_with', 'ORDER#')
  .get()

// Query using GSI
const results = await User.query()
  .index('GSI1')
  .pk('STATUS#active')
  .get()
```

## PartiQL Queries

Use SQL-like syntax:

```ts
import { partiql, selectFrom } from 'dynamodb-tooling'

// Simple select
const users = await selectFrom('Users')
  .where('status', '=', 'active')
  .execute()

// With projection
const users = await selectFrom('Users')
  .select('id', 'name', 'email')
  .where('age', '>=', 18)
  .orderBy('name')
  .limit(10)
  .execute()
```

## Best Practices

### 1. Always Use Indexes

```ts
// Use GSI for non-key queries
User.query()
  .index('ByEmail')
  .where('email', 'john@example.com')
  .get()
```

### 2. Limit Results

```ts
// Always limit scan operations
User.query().limit(100).get()
```

### 3. Use Projections

```ts
// Only fetch needed attributes
User.query()
  .select('id', 'name', 'email')
  .get()
```

### 4. Prefer Cursor Pagination

For large datasets, cursor pagination is more efficient than offset pagination.

## Next Steps

- [Batch Operations](/batch-operations) - Efficient bulk operations
- [Relationships](/relationships) - Working with related data
- [Migrations](/migrations) - Schema migration management
