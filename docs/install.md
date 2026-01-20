---
title: Installation Guide
description: Install and configure DynamoDB Tooling for your project.
---

# Installation

DynamoDB Tooling can be installed via npm, pnpm, yarn, or bun.

## Package Installation

::: code-group

```bash [bun]
bun add dynamodb-tooling
```

```bash [npm]
npm install dynamodb-tooling
```

```bash [pnpm]
pnpm add dynamodb-tooling
```

```bash [yarn]
yarn add dynamodb-tooling
```

:::

## Configuration

Create a `dynamodb.config.ts` file in your project root:

```ts
import type { DynamoDBConfig } from 'dynamodb-tooling'

export default {
  // AWS Settings
  region: 'us-east-1',

  // Table Settings
  defaultTableName: 'MyApp',
  tableNamePrefix: '', // Optional prefix
  tableNameSuffix: '', // Optional suffix

  // Single-Table Design
  singleTableDesign: {
    enabled: true,
    partitionKeyName: 'pk',
    sortKeyName: 'sk',
    keyDelimiter: '#',
    entityTypeAttribute: '_type',
    gsiCount: 5,
  },

  // Query Builder
  queryBuilder: {
    modelsPath: './app/models',
    timestampFormat: 'iso', // 'iso' | 'unix' | 'unix_ms'
    softDeletes: {
      enabled: true,
      attribute: 'deletedAt',
    },
  },

  // Capacity
  capacity: {
    billingMode: 'PAY_PER_REQUEST', // or 'PROVISIONED'
    read: 5, // Only for PROVISIONED
    write: 5, // Only for PROVISIONED
  },

  // DynamoDB Local
  local: {
    enabled: process.env.NODE_ENV !== 'production',
    port: 8000,
  },
} satisfies DynamoDBConfig
```

## AWS Credentials

DynamoDB Tooling uses the standard AWS SDK credential chain. Configure credentials using one of these methods:

### Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### AWS Credentials File

Create `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = your_access_key
aws_secret_access_key = your_secret_key
```

### Explicit Configuration

```ts
export default {
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // ... rest of config
} satisfies DynamoDBConfig
```

## DynamoDB Local Setup

For local development, install DynamoDB Local:

```bash
# Using the CLI
dbtooling install

# Start local instance
dbtooling start

# Verify it's running
dbtooling status
```

Or install manually via Docker:

```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

## Creating Your First Model

Create a model in your models directory:

```ts
// app/models/User.ts
import { DynamoDBModel } from 'dynamodb-tooling'

export class User extends DynamoDBModel {
  static table = 'users'
  static primaryKey = 'id'
  static timestamps = true

  attributes = {
    id: { type: 'string', required: true },
    email: { type: 'string', required: true },
    name: { type: 'string', required: true },
  }
}
```

## Running Migrations

Generate and run migrations:

```bash
# Generate migration from models
dbtooling migrate:generate

# Preview changes
dbtooling migrate --dry-run

# Apply migration
dbtooling migrate
```

## Verify Installation

Test your setup:

```ts
import { User } from './app/models/User'

async function test() {
  // Create a user
  const user = await User.create({
    email: 'test@example.com',
    name: 'Test User',
  })

  console.log('Created user:', user)

  // Query users
  const users = await User.query().get()
  console.log('All users:', users)
}

test()
```

## Next Steps

- [Table Operations](/table-operations) - Learn about table management
- [Query Helpers](/query-helpers) - Master the query builder
- [Local Development](/local-development) - DynamoDB Local setup
