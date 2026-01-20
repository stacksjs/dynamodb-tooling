---
title: Local Development
description: Set up and use DynamoDB Local for development and testing.
---

# Local Development

DynamoDB Tooling includes built-in support for DynamoDB Local, making it easy to develop and test without connecting to AWS.

## Installation

### Using CLI

```bash
# Install DynamoDB Local
dbtooling install

# This downloads and sets up DynamoDB Local in your project
```

### Manual Installation

Using Docker (recommended):

```bash
docker pull amazon/dynamodb-local
```

Or download directly from AWS:

```bash
# Download
curl -O https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz

# Extract
tar -xzf dynamodb_local_latest.tar.gz
```

## Starting the Server

### CLI Commands

```bash
# Start with defaults (port 8000)
dbtooling start

# Start on custom port
dbtooling start --port 8001

# Start with persistent storage
dbtooling start --db-path ./data/dynamodb

# Start in shared database mode (one database for all clients)
dbtooling start --shared-db

# Start with CORS enabled
dbtooling start --cors "*"

# Check status
dbtooling status

# Stop the server
dbtooling stop

# Stop all instances
dbtooling stop --all
```

### Programmatic Control

```ts
import { dynamoDb } from 'dynamodb-tooling'

// Start server
await dynamoDb.launch({
  port: 8000,
  inMemory: true,
})

// Start with persistent storage
await dynamoDb.launch({
  port: 8000,
  dbPath: './data/dynamodb',
})

// Check if running
const isRunning = await dynamoDb.isRunning(8000)

// Stop server
await dynamoDb.stop(8000)

// Stop all instances
await dynamoDb.stopAll()
```

## Configuration

Configure local development in `dynamodb.config.ts`:

```ts
import type { DynamoDBConfig } from 'dynamodb-tooling'

export default {
  region: 'us-east-1',
  defaultTableName: 'MyApp',

  // DynamoDB Local settings
  local: {
    enabled: process.env.NODE_ENV !== 'production',
    port: 8000,
    endpoint: 'http://localhost:8000',
    installPath: './.dynamodb-local',
    inMemory: true, // Data stored in memory only
  },

  // Development credentials (any values work for local)
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
} satisfies DynamoDBConfig
```

### Environment-Based Configuration

```ts
const isLocal = process.env.NODE_ENV !== 'production'

export default {
  region: process.env.AWS_REGION || 'us-east-1',

  ...(isLocal && {
    endpoint: 'http://localhost:8000',
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  }),

  local: {
    enabled: isLocal,
    port: 8000,
  },
} satisfies DynamoDBConfig
```

## Docker Setup

### docker-compose.yml

```yaml
version: '3.8'

services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    volumes:
      - dynamodb-data:/home/dynamodblocal/data
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb", "-dbPath", "/home/dynamodblocal/data"]

volumes:
  dynamodb-data:
```

Start with:

```bash
docker-compose up -d dynamodb-local
```

### Admin UI (Optional)

Add DynamoDB Admin for a web interface:

```yaml
services:
  dynamodb-local:
    # ... as above

  dynamodb-admin:
    image: aaronshaf/dynamodb-admin
    ports:
      - "8001:8001"
    environment:
      DYNAMO_ENDPOINT: http://dynamodb-local:8000
    depends_on:
      - dynamodb-local
```

Access the UI at `http://localhost:8001`.

## Testing

### Test Setup

```ts
// test/setup.ts
import { dynamoDb, DynamoDBModel } from 'dynamodb-tooling'
import { beforeAll, afterAll, beforeEach } from 'bun:test'

beforeAll(async () => {
  // Start DynamoDB Local
  await dynamoDb.launch({ port: 8000, inMemory: true })

  // Create tables
  await DynamoDBModel.migrate()
})

afterAll(async () => {
  // Stop server
  await dynamoDb.stop(8000)
})

beforeEach(async () => {
  // Clear tables between tests
  await DynamoDBModel.truncateAll()
})
```

### Using Factories

```ts
import { Factory } from 'dynamodb-tooling'
import { User } from '../app/models/User'

Factory.define('User', {
  entityType: 'USER',
  definition: () => ({
    id: crypto.randomUUID(),
    email: `user-${Date.now()}@example.com`,
    name: 'Test User',
  }),
  states: {
    admin: { role: 'admin' },
    inactive: { status: 'inactive' },
  },
})

// In tests
const user = await Factory.for('User').createOne()
const admin = await Factory.for('User').state('admin').createOne()
const users = await Factory.for('User').count(10).create()
```

### Example Test

```ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { dynamoDb } from 'dynamodb-tooling'
import { User } from '../app/models/User'
import { Factory } from 'dynamodb-tooling'

describe('User Model', () => {
  beforeAll(async () => {
    await dynamoDb.launch({ port: 8000, inMemory: true })
    await User.migrate()
  })

  afterAll(async () => {
    await dynamoDb.stop(8000)
  })

  test('creates a user', async () => {
    const user = await User.create({
      email: 'test@example.com',
      name: 'Test User',
    })

    expect(user.id).toBeDefined()
    expect(user.email).toBe('test@example.com')
  })

  test('queries users', async () => {
    await Factory.for('User').count(5).create()

    const users = await User.query().get()

    expect(users.length).toBe(5)
  })

  test('filters by status', async () => {
    await Factory.for('User').count(3).create()
    await Factory.for('User').state('inactive').count(2).create()

    const activeUsers = await User.query()
      .where('status', 'active')
      .get()

    expect(activeUsers.length).toBe(3)
  })
})
```

## Seeding

Populate local database with test data:

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

Run seeders:

```bash
# Seed the database
dbtooling seed

# Run specific seeder
dbtooling seed --class UserSeeder

# Fresh start (drop, migrate, seed)
dbtooling db:fresh
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use the CLI
dbtooling stop --port 8000
```

### Connection Refused

Ensure DynamoDB Local is running:

```bash
# Check status
dbtooling status

# Start if not running
dbtooling start
```

### Table Not Found

Ensure tables are created:

```bash
# List tables
dbtooling table:list

# Create tables from models
dbtooling migrate
```

### Data Not Persisting

By default, DynamoDB Local runs in-memory. For persistence:

```bash
# Start with persistent storage
dbtooling start --db-path ./data/dynamodb
```

## Best Practices

### 1. Use In-Memory for Tests

```ts
await dynamoDb.launch({ port: 8000, inMemory: true })
```

### 2. Isolate Test Data

```ts
beforeEach(async () => {
  await DynamoDBModel.truncateAll()
})
```

### 3. Use Separate Ports

```ts
// Unit tests
await dynamoDb.launch({ port: 8001, inMemory: true })

// Integration tests
await dynamoDb.launch({ port: 8002, inMemory: true })
```

### 4. Clean Up After Tests

```ts
afterAll(async () => {
  await dynamoDb.stopAll()
})
```

## Next Steps

- [Migrations](/migrations) - Schema migration management
- [Factories](/factories) - Test data generation
- [Seeders](/seeders) - Database population
