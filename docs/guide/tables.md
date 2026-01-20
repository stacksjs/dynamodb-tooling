# Table Operations

Learn how to manage DynamoDB tables with dynamodb-tooling.

## Creating Tables

### From Models

Generate tables automatically from your model definitions:

```typescript
import { createTableFromModels } from 'dynamodb-tooling'

// Create table with all GSIs derived from models
await createTableFromModels('./app/models', {
  tableName: 'MyApp',
  billingMode: 'PAY_PER_REQUEST'
})
```

### CLI Commands

```bash
# Create table from models
dbtooling table:create

# With options
dbtooling table:create --table MyApp --billing PROVISIONED --read 5 --write 5
```

### Manual Table Creation

```typescript
import { createTable } from 'dynamodb-tooling'

await createTable({
  tableName: 'MyApp',
  partitionKey: { name: 'pk', type: 'S' },
  sortKey: { name: 'sk', type: 'S' },
  billingMode: 'PAY_PER_REQUEST',
  gsis: [
    {
      name: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: 'S' },
      sortKey: { name: 'gsi1sk', type: 'S' }
    }
  ]
})
```

## Single-Table Design

### Key Patterns

dynamodb-tooling automatically generates key patterns from your models:

```
Entity: User
  pk: USER#{id}
  sk: USER#{id}

Entity: Post
  pk: POST#{id}
  sk: POST#{id}
  gsi1pk: USER#{userId}  (for querying posts by user)
  gsi1sk: POST#{createdAt}
```

### View Access Patterns

```bash
# Show all access patterns
dbtooling access-patterns

# Output as markdown
dbtooling access-patterns --format markdown
```

### Custom Key Patterns

```typescript
class Order extends DynamoDBModel {
  static keyPattern = {
    pk: 'ORDER#{{id}}',
    sk: 'ORDER#{{id}}',
    gsi1pk: 'USER#{{userId}}',
    gsi1sk: 'ORDER#{{createdAt}}'
  }
}
```

## Migrations

### Generate Migrations

```bash
# Generate migration from model changes
dbtooling migrate:generate

# Preview changes without applying
dbtooling migrate --dry-run
```

### Run Migrations

```bash
# Apply all pending migrations
dbtooling migrate

# Check migration status
dbtooling migrate:status

# Rollback last migration
dbtooling migrate:rollback
```

### Programmatic Migrations

```typescript
import { generateMigration, executeMigration } from 'dynamodb-tooling'

// Generate migration
const migration = await generateMigration('./app/models', {
  tableName: 'MyApp',
  dryRun: false
})

// Execute migration
await executeMigration(migration)
```

### Migration Operations

Migrations support:

- Table creation/deletion
- GSI creation/deletion
- LSI configuration
- TTL settings
- Stream configuration

```typescript
// Example migration file
export default {
  up: async (client) => {
    // Add new GSI
    await client.updateTable({
      TableName: 'MyApp',
      GlobalSecondaryIndexUpdates: [{
        Create: {
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'gsi2pk', KeyType: 'HASH' },
            { AttributeName: 'gsi2sk', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      }]
    })
  },

  down: async (client) => {
    // Remove GSI
    await client.updateTable({
      TableName: 'MyApp',
      GlobalSecondaryIndexUpdates: [{
        Delete: { IndexName: 'GSI2' }
      }]
    })
  }
}
```

## Table Information

### Describe Table

```bash
# Show table details
dbtooling table:describe MyApp
```

```typescript
import { describeTable } from 'dynamodb-tooling'

const info = await describeTable('MyApp')
console.log(info.itemCount)
console.log(info.tableSizeBytes)
console.log(info.globalSecondaryIndexes)
```

### List Tables

```bash
# List all tables
dbtooling table:list
```

## Table Management

### Delete Table

```bash
# Delete a table (with confirmation)
dbtooling table:delete MyApp

# Force delete without confirmation
dbtooling table:delete MyApp --force
```

### Fresh Start

```bash
# Drop table, recreate, and seed
dbtooling db:fresh
```

## GSI Management

### Automatic GSI Derivation

Based on your model relationships and access patterns:

```typescript
class Post extends DynamoDBModel {
  relationships = {
    author: { type: 'belongsTo', model: 'User', foreignKey: 'userId' }
  }
}

// Automatically creates GSI for:
// - Query posts by userId
// - Sorted by createdAt
```

### Manual GSI Definition

```typescript
class Product extends DynamoDBModel {
  static gsis = [
    {
      name: 'CategoryIndex',
      pk: 'category',
      sk: 'price'
    },
    {
      name: 'StatusIndex',
      pk: 'status',
      sk: 'createdAt',
      sparse: true  // Only index items with status attribute
    }
  ]
}
```

## TTL Configuration

```typescript
class Session extends DynamoDBModel {
  static ttl = {
    enabled: true,
    attribute: 'expiresAt'
  }
}
```

```bash
# Enable TTL on table
dbtooling table:ttl MyApp --enable --attribute expiresAt
```

## Streams

```typescript
// Enable streams for CDC
class AuditLog extends DynamoDBModel {
  static streams = {
    enabled: true,
    viewType: 'NEW_AND_OLD_IMAGES'
  }
}
```

## Examples

### E-commerce Schema

```typescript
// Single table for e-commerce
class Product extends DynamoDBModel {
  static keyPattern = {
    pk: 'PRODUCT#{{id}}',
    sk: 'PRODUCT#{{id}}',
    gsi1pk: 'CATEGORY#{{category}}',
    gsi1sk: 'PRODUCT#{{price}}'
  }
}

class Order extends DynamoDBModel {
  static keyPattern = {
    pk: 'ORDER#{{id}}',
    sk: 'ORDER#{{id}}',
    gsi1pk: 'USER#{{userId}}',
    gsi1sk: 'ORDER#{{createdAt}}'
  }
}

class OrderItem extends DynamoDBModel {
  static keyPattern = {
    pk: 'ORDER#{{orderId}}',
    sk: 'ITEM#{{productId}}'
  }
}
```

### Multi-Tenant Schema

```typescript
class Tenant extends DynamoDBModel {
  static keyPattern = {
    pk: 'TENANT#{{id}}',
    sk: 'TENANT#{{id}}'
  }
}

class TenantUser extends DynamoDBModel {
  static keyPattern = {
    pk: 'TENANT#{{tenantId}}',
    sk: 'USER#{{userId}}',
    gsi1pk: 'USER#{{userId}}',
    gsi1sk: 'TENANT#{{tenantId}}'
  }
}
```

## Next Steps

- Learn about [query helpers](./queries.md)
- Set up [local development](./local.md)
