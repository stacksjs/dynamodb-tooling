# Getting Started

Learn how to install and set up dynamodb-tooling in your project.

## Prerequisites

- Node.js 18+ or Bun 1.0+
- AWS credentials (for production) or DynamoDB Local (for development)

## Installation

```bash
# Using bun
bun add dynamodb-tooling

# Using npm
npm install dynamodb-tooling

# Using pnpm
pnpm add dynamodb-tooling
```

## Configuration

Create a `dynamodb.config.ts` file in your project root:

```typescript
import type { DynamoDBConfig } from 'dynamodb-tooling'

export default {
  // AWS Region
  region: 'us-east-1',

  // Default table name for single-table design
  defaultTableName: 'MyApp',

  // Single-table design settings
  singleTableDesign: {
    enabled: true,
    partitionKeyName: 'pk',
    sortKeyName: 'sk',
    keyDelimiter: '#',
    entityTypeAttribute: '_type',
    gsiCount: 5
  },

  // Query builder settings
  queryBuilder: {
    modelsPath: './app/models',
    timestampFormat: 'iso',
    softDeletes: {
      enabled: true,
      attribute: 'deletedAt'
    }
  },

  // Capacity settings
  capacity: {
    billingMode: 'PAY_PER_REQUEST'
  },

  // DynamoDB Local settings
  local: {
    enabled: true,
    port: 8000
  }
} satisfies DynamoDBConfig
```

## Defining Models

Create model files in your models directory:

```typescript
// app/models/User.ts
import { DynamoDBModel } from 'dynamodb-tooling'

export class User extends DynamoDBModel {
  static table = 'users'
  static primaryKey = 'id'
  static timestamps = true
  static softDeletes = true

  attributes = {
    id: { type: 'string', required: true },
    email: { type: 'string', required: true, unique: true },
    name: { type: 'string', required: true },
    age: { type: 'number' },
    status: { type: 'string', default: 'active' }
  }

  relationships = {
    posts: { type: 'hasMany', model: 'Post', foreignKey: 'userId' },
    profile: { type: 'hasOne', model: 'Profile', foreignKey: 'userId' }
  }
}
```

## Basic Usage

### Finding Records

```typescript
import { User } from './app/models/User'

// Find by ID
const user = await User.find('123')

// Find or fail
const user = await User.findOrFail('123')

// Find by conditions
const users = await User.query()
  .where('status', 'active')
  .get()
```

### Creating Records

```typescript
// Create a new user
const user = await User.create({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30
})

console.log(user.id) // Auto-generated ID
```

### Updating Records

```typescript
// Find and update
const user = await User.find('123')
await user.update({ name: 'Jane Doe' })

// Or in one step
await User.query()
  .where('id', '123')
  .update({ name: 'Jane Doe' })
```

### Deleting Records

```typescript
// Soft delete (if enabled)
await user.delete()

// Force delete (permanent)
await user.forceDelete()
```

## Query Builder

### Where Conditions

```typescript
// Simple equality
User.query().where('status', 'active').get()

// Comparison operators
User.query().where('age', '>=', 18).get()

// Multiple conditions
User.query()
  .where('status', 'active')
  .where('age', '>=', 18)
  .get()
```

### DynamoDB-Specific Queries

```typescript
// Begins with (for sort key queries)
User.query().whereBeginsWith('sk', 'USER#').get()

// Contains (for lists/sets)
User.query().whereContains('tags', 'featured').get()

// Between
User.query().whereBetween('age', 18, 65).get()
```

### Ordering and Limiting

```typescript
User.query()
  .orderByDesc('createdAt')
  .limit(10)
  .get()

// Shortcuts
User.query().latest().get()
User.query().oldest().get()
```

## Eager Loading Relations

```typescript
// Load single relation
const users = await User.query()
  .with('posts')
  .get()

// Load multiple relations
const users = await User.query()
  .with('posts', 'profile')
  .get()

// Nested relations
const users = await User.query()
  .with('posts.comments')
  .get()
```

## Aggregations

```typescript
// Count
const count = await User.query().count()

// Sum
const total = await User.query().sum('balance')

// Average
const avgAge = await User.query().avg('age')

// Min/Max
const youngest = await User.query().min('age')
const oldest = await User.query().max('age')

// Exists
const hasUsers = await User.query().exists()
```

## Pagination

```typescript
// Standard pagination
const page1 = await User.query().paginate(20)

// Cursor-based pagination (recommended for DynamoDB)
const page1 = await User.query().cursorPaginate(null, 20)
const page2 = await User.query().cursorPaginate(page1.nextCursor, 20)
```

## Next Steps

- Learn about [table operations](./tables.md)
- Explore [query helpers](./queries.md)
- Set up [local development](./local.md)
