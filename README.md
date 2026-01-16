<p align="center"><img src=".github/art/cover.png" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# dynamodb-tooling

A comprehensive DynamoDB toolkit for TypeScript/JavaScript with automatic single-table design, Laravel-style ORM, migrations, and CLI tools.

Define your models once and get automatic key pattern generation, GSI derivation, and a type-safe query experience powered by DynamoDB best practices.

## Features

### Core Query Building

- **Laravel-Style ORM**: Familiar query builder with `where()`, `with()`, `orderBy()`, `limit()`, and more.
- **Fluent Builder**: `select/create/update/delete`, `where/andWhere/orWhere`, `whereIn/whereBetween/whereNull`, `orderBy/orderByDesc`.
- **Aggregations**: `count()`, `sum()`, `avg()`, `min()`, `max()` with full type safety.
- **Batch Operations**: `batchGet()`, `batchWrite()`, `transactWrite()` for efficient bulk operations.

### Single-Table Design

- **Zero-Config Key Patterns**: Automatically generates pk/sk patterns from your model definitions.
- **GSI Derivation**: Intelligent GSI assignment based on relationships and access patterns.
- **LSI Support**: Local Secondary Index derivation for alternative sort keys.
- **Sparse Indexes**: Cost-effective sparse GSI patterns for status-based queries.

### Advanced Features

- **Relations**: `with(...)`, `withCount(...)`, `has()`, `doesntHave()`, `whereHas()` with eager loading support.
- **Query Scopes**: Define reusable query constraints on models for cleaner, more maintainable code.
- **Soft Deletes**: `withTrashed()`, `onlyTrashed()`, `restore()`, `forceDelete()` for logical deletion.
- **Model Hooks**: Lifecycle events - `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`.

### Database Operations

- **Migrations**: Generate and execute migrations from models with full diff support.
- **Factories**: Generate fake data for testing with states and sequences.
- **Seeders**: Database seeding with configurable data generation.
- **DynamoDB Local**: Built-in support for local development and testing.

### Configuration & CLI

- **TypeScript First**: Full type safety and IntelliSense support throughout.
- **Configurable**: Single-table settings, capacity modes, TTL, streams, and more.
- **CLI Tools**: Manage tables, run migrations, seed data, query items, and more.
- **bun-query-builder Integration**: Use as a DynamoDB driver for bun-query-builder.

## Get Started

### Installation

```bash
bun add dynamodb-tooling
# or
npm install dynamodb-tooling
```

### Configuration

Create a `dynamodb.config.ts` file:

```ts
import type { DynamoDBConfig } from 'dynamodb-tooling'

export default {
  region: 'us-east-1',
  defaultTableName: 'MyApp',

  singleTableDesign: {
    enabled: true,
    partitionKeyName: 'pk',
    sortKeyName: 'sk',
    keyDelimiter: '#',
    gsiCount: 5,
  },

  local: {
    enabled: true,
    port: 8000,
  },
} satisfies DynamoDBConfig
```

### Usage

```ts
import { User } from './app/models/User'

// Find by ID
const user = await User.find('123')

// Query with conditions
const users = await User.query()
  .where('status', 'active')
  .where('age', '>=', 18)
  .orderByDesc('createdAt')
  .limit(10)
  .get()

// With eager loading
const usersWithPosts = await User.query()
  .with('posts')
  .get()
```

### Defining Models

```ts
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
  }

  relationships = {
    posts: { type: 'hasMany', model: 'Post', foreignKey: 'userId' },
    profile: { type: 'hasOne', model: 'Profile', foreignKey: 'userId' },
  }
}
```

### Query Builder

```ts
// Where conditions
User.query().where('status', 'active').get()
User.query().where('age', '>=', 18).get()
User.query().whereIn('role', ['admin', 'moderator']).get()
User.query().whereBetween('age', 18, 65).get()
User.query().whereNull('deletedAt').get()
User.query().whereBeginsWith('sk', 'USER#').get()
User.query().whereContains('tags', 'featured').get()

// Ordering and limiting
User.query().orderBy('name').get()
User.query().orderByDesc('createdAt').get()
User.query().latest().get() // orderBy('createdAt', 'desc')
User.query().oldest().get() // orderBy('createdAt', 'asc')
User.query().limit(10).get()

// Pagination
const page1 = await User.query().paginate(20)
const page2 = await User.query().cursorPaginate(cursor, 20)

// Chunking for large datasets
await User.query().chunk(100, async (users) => {
  for (const user of users) {
    // Process user
  }
})
```

### Relationships

```ts
// Eager loading
User.query().with('posts').get()
User.query().with('posts', 'profile').get()
User.query().with('posts.comments').get() // Nested

// Relationship counts
User.query().withCount('posts').get()

// Relationship existence
User.query().has('posts').get()
User.query().doesntHave('posts').get()
User.query().whereHas('posts', q => q.where('published', true)).get()
```

### Aggregations

```ts
await User.query().count()
await User.query().sum('balance')
await User.query().avg('age')
await User.query().min('age')
await User.query().max('age')
await User.query().exists()
await User.query().doesntExist()
```

### Soft Deletes

```ts
// Include soft deleted
User.query().withTrashed().get()

// Only soft deleted
User.query().onlyTrashed().get()

// Restore
await user.restore()

// Force delete (permanent)
await user.forceDelete()
```

### CRUD Operations

```ts
// Create
const newUser = await User.create({
  email: 'john@example.com',
  name: 'John Doe',
})

// Update
await user.update({ name: 'Jane Doe' })

// Delete (soft delete if enabled)
await user.delete()

// Force delete
await user.forceDelete()
```

## Factory System

Create factories for generating test data:

```ts
// factories/UserFactory.ts
import { Factory, randomInt, uniqueEmail } from 'dynamodb-tooling'

Factory.define('User', {
  entityType: 'USER',
  definition: () => ({
    id: crypto.randomUUID(),
    email: uniqueEmail(),
    name: 'Test User',
    age: randomInt(18, 65),
  }),
  states: {
    admin: { role: 'admin' },
    inactive: { status: 'inactive' },
  },
})

// Usage
const users = await Factory.for('User').count(10).create()
const admin = await Factory.for('User').state('admin').createOne()
const fakeUsers = Factory.for('User').count(5).make() // No persist
```

## Seeder System

Create seeders to populate your database:

```ts
// seeders/UserSeeder.ts
import { Seeder, SeederContext } from 'dynamodb-tooling'

export class UserSeeder extends Seeder {
  static order = 1

  async run(ctx: SeederContext): Promise<void> {
    await ctx.factory('USER', {
      attributes: () => ({
        id: crypto.randomUUID(),
        email: `user${Date.now()}@example.com`,
        name: 'Test User',
      }),
    }).count(50).create()
  }
}
```

## Migration System

Migrations are automatically generated from your models:

```bash
# Generate migration
dbtooling migrate:generate

# Preview changes
dbtooling migrate --dry-run

# Apply migration
dbtooling migrate

# Rollback
dbtooling migrate:rollback
```

The migration system handles:
- Table creation with pk/sk
- GSI creation/deletion
- LSI configuration
- TTL settings
- Stream configuration

## Single-Table Design

The toolkit automatically generates single-table design patterns from your models:

### Key Patterns

```
User:
  pk: USER#{id}
  sk: USER#{id}

Post:
  pk: POST#{id}
  sk: POST#{id}
  gsi1pk: USER#{userId}  (for querying posts by user)
  gsi1sk: POST#{id}
```

### Access Patterns Generated

1. Get User by ID
2. Get Post by ID
3. Get all Posts by User (via GSI1)
4. Get User's Profile (via relationship)

View patterns with:
```bash
dbtooling access-patterns --format markdown
```

## CLI Commands

The CLI is available as `dbtooling`:

```bash
# DynamoDB Local
dbtooling start              # Start DynamoDB Local
dbtooling stop               # Stop DynamoDB Local
dbtooling status             # Show running instances
dbtooling install            # Install DynamoDB Local

# Migrations
dbtooling migrate            # Run migrations
dbtooling migrate:status     # Show migration status
dbtooling migrate:rollback   # Rollback last migration
dbtooling migrate:fresh      # Drop and re-migrate
dbtooling migrate:generate   # Generate migration from models

# Tables
dbtooling table:create       # Create table from models
dbtooling table:describe     # Describe a table
dbtooling table:list         # List all tables
dbtooling table:delete       # Delete a table

# Seeding
dbtooling seed               # Run seeders
dbtooling make:seeder User   # Generate a seeder
dbtooling make:factory User  # Generate a factory
dbtooling db:fresh           # Drop, migrate, and seed

# Queries
dbtooling query --pk USER#1  # Query by partition key
dbtooling scan               # Scan table
dbtooling get --pk X --sk Y  # Get single item

# Utilities
dbtooling access-patterns    # Show access patterns
dbtooling export             # Export table data
dbtooling import             # Import data
dbtooling ci:validate        # Validate models for CI
```

## DynamoDB Local

Start local development:

```ts
import { dynamoDb } from 'dynamodb-tooling'

// Start
await dynamoDb.launch({ port: 8000 })

// With persistent storage
await dynamoDb.launch({
  port: 8000,
  dbPath: './data/dynamodb',
})

// Stop
dynamoDb.stop(8000)
```

Or via CLI:

```bash
dbtooling start --port 8000
dbtooling start --db-path ./data  # Persistent
dbtooling stop
```

## bun-query-builder Integration

Use dynamodb-tooling as a DynamoDB driver for bun-query-builder:

```ts
import { createQueryBuilder } from 'bun-query-builder'
import { DynamoDBDriver } from 'dynamodb-tooling'

const driver = new DynamoDBDriver({
  region: 'us-east-1',
  tableName: 'MyApp',
})

const db = createQueryBuilder({
  driver,
  // ... other options
})

// Now use bun-query-builder with DynamoDB!
const users = await db.selectFrom('users')
  .where({ active: true })
  .get()
```

## Configuration Reference

```ts
interface DynamoDBConfig {
  // AWS Settings
  region?: string
  endpoint?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  }

  // Table Settings
  defaultTableName: string
  tableNamePrefix?: string
  tableNameSuffix?: string

  // Single-Table Design
  singleTableDesign: {
    enabled: boolean
    partitionKeyName: string // default: 'pk'
    sortKeyName: string // default: 'sk'
    keyDelimiter: string // default: '#'
    entityTypeAttribute: string // default: '_type'
    gsiCount: number // default: 5
  }

  // Query Builder
  queryBuilder: {
    modelsPath: string
    timestampFormat: 'iso' | 'unix' | 'unix_ms'
    softDeletes: {
      enabled: boolean
      attribute: string
    }
  }

  // Capacity
  capacity: {
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
    read?: number
    write?: number
  }

  // DynamoDB Local
  local: {
    enabled: boolean
    port: number
    installPath: string
  }
}
```

## Testing

```bash
bun test
```

## Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Postcardware

Stacks OSS will always stay open-sourced, and we will always love to receive postcards from wherever Stacks is used! _And we also publish them on our website. Thank you, Spatie._

Our address: Stacks.js, 12665 Village Ln #2306, Playa Vista, CA 90094, United States 🌎

## Sponsors

We would like to extend our thanks to the following sponsors for funding Stacks development. If you are interested in becoming a sponsor, please reach out to us.

- [JetBrains](https://www.jetbrains.com/)
- [The Solana Foundation](https://solana.com/)

## Credits

- [dynamodb-toolbox](https://github.com/jeremydaly/dynamodb-toolbox)
- [dynamodb-local](https://github.com/rynop/dynamodb-local)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/dynamodb-tooling?style=flat-square
[npm-version-href]: https://npmjs.com/package/dynamodb-tooling
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/dynamodb-tooling/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/dynamodb-tooling/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/dynamodb-tooling/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/dynamodb-tooling -->
