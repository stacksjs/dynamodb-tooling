# API Reference

Complete API reference for dynamodb-tooling.

## Model Class

### Static Properties

| Property | Type | Description |
|----------|------|-------------|
| `table` | `string` | Entity/table name |
| `primaryKey` | `string` | Primary key attribute |
| `timestamps` | `boolean` | Enable createdAt/updatedAt |
| `softDeletes` | `boolean` | Enable soft deletes |
| `attributes` | `object` | Attribute definitions |
| `relationships` | `object` | Relationship definitions |

### Static Methods

| Method | Description | Example |
|--------|-------------|---------|
| `find(id)` | Find by primary key | `User.find('123')` |
| `findOrFail(id)` | Find or throw error | `User.findOrFail('123')` |
| `create(data)` | Create new record | `User.create({...})` |
| `query()` | Start query builder | `User.query().where(...)` |
| `all()` | Get all records | `User.all()` |

## Query Builder

### Where Methods

| Method | Description | Example |
|--------|-------------|---------|
| `where(key, value)` | Equality condition | `.where('status', 'active')` |
| `where(key, op, value)` | Comparison | `.where('age', '>=', 18)` |
| `whereIn(key, values)` | IN condition | `.whereIn('id', [1, 2, 3])` |
| `whereNotIn(key, values)` | NOT IN | `.whereNotIn('status', [...])` |
| `whereBetween(key, a, b)` | BETWEEN | `.whereBetween('age', 18, 65)` |
| `whereNull(key)` | IS NULL | `.whereNull('deletedAt')` |
| `whereNotNull(key)` | IS NOT NULL | `.whereNotNull('email')` |
| `whereBeginsWith(key, prefix)` | Begins with | `.whereBeginsWith('sk', 'USER#')` |
| `whereContains(key, value)` | Contains | `.whereContains('tags', 'featured')` |
| `whereExists(key)` | Attribute exists | `.whereExists('phone')` |
| `whereNotExists(key)` | Attribute not exists | `.whereNotExists('deleted')` |

### Index Methods

| Method | Description | Example |
|--------|-------------|---------|
| `index(name)` | Use specific GSI | `.index('GSI1')` |

### Order Methods

| Method | Description | Example |
|--------|-------------|---------|
| `orderBy(key)` | Ascending order | `.orderBy('createdAt')` |
| `orderByDesc(key)` | Descending order | `.orderByDesc('createdAt')` |
| `latest()` | Order by createdAt DESC | `.latest()` |
| `oldest()` | Order by createdAt ASC | `.oldest()` |

### Limit Methods

| Method | Description | Example |
|--------|-------------|---------|
| `limit(n)` | Limit results | `.limit(10)` |

### Execution Methods

| Method | Description | Example |
|--------|-------------|---------|
| `get()` | Execute and get all | `await query.get()` |
| `first()` | Get first result | `await query.first()` |
| `count()` | Count results | `await query.count()` |
| `exists()` | Check if exists | `await query.exists()` |
| `doesntExist()` | Check if not exists | `await query.doesntExist()` |

### Pagination Methods

| Method | Description | Example |
|--------|-------------|---------|
| `paginate(perPage)` | Standard pagination | `.paginate(20)` |
| `cursorPaginate(cursor?, limit?)` | Cursor pagination | `.cursorPaginate(null, 20)` |

### Aggregation Methods

| Method | Description | Example |
|--------|-------------|---------|
| `count()` | Count records | `await query.count()` |
| `sum(key)` | Sum values | `await query.sum('balance')` |
| `avg(key)` | Average values | `await query.avg('age')` |
| `min(key)` | Minimum value | `await query.min('price')` |
| `max(key)` | Maximum value | `await query.max('price')` |

### Relation Methods

| Method | Description | Example |
|--------|-------------|---------|
| `with(relations)` | Eager load | `.with('posts')` |
| `withCount(relation)` | Count relation | `.withCount('comments')` |
| `has(relation)` | Has relation | `.has('posts')` |
| `doesntHave(relation)` | Missing relation | `.doesntHave('posts')` |
| `whereHas(rel, cb)` | Filter by relation | `.whereHas('posts', q => ...)` |

### Soft Delete Methods

| Method | Description | Example |
|--------|-------------|---------|
| `withTrashed()` | Include soft deleted | `.withTrashed()` |
| `onlyTrashed()` | Only soft deleted | `.onlyTrashed()` |

### Read Options

| Method | Description | Example |
|--------|-------------|---------|
| `consistentRead()` | Strong consistency | `.consistentRead()` |
| `select(attrs)` | Project attributes | `.select(['id', 'name'])` |

## Instance Methods

### CRUD Methods

| Method | Description | Example |
|--------|-------------|---------|
| `save()` | Save changes | `await user.save()` |
| `update(data)` | Update attributes | `await user.update({...})` |
| `delete()` | Delete (soft if enabled) | `await user.delete()` |
| `forceDelete()` | Permanent delete | `await user.forceDelete()` |
| `restore()` | Restore soft deleted | `await user.restore()` |
| `refresh()` | Reload from DB | `await user.refresh()` |

## Batch Operations

### batchGet

```typescript
import { batchGet } from 'dynamodb-tooling'

const items = await batchGet(tableName, keys)
```

### batchWrite

```typescript
import { batchWrite } from 'dynamodb-tooling'

await batchWrite(tableName, {
  put: [...],
  delete: [...]
})
```

### transactWrite

```typescript
import { transactWrite } from 'dynamodb-tooling'

await transactWrite([
  { Put: {...} },
  { Update: {...} },
  { Delete: {...} }
])
```

## DynamoDB Local

### dynamoDb

```typescript
import { dynamoDb } from 'dynamodb-tooling'

// Launch
await dynamoDb.launch({
  port?: number,
  inMemory?: boolean,
  dbPath?: string,
  sharedDb?: boolean
})

// Stop
dynamoDb.stop(port)
```

## Table Operations

### createTable

```typescript
import { createTable } from 'dynamodb-tooling'

await createTable({
  tableName: string,
  partitionKey: { name: string, type: 'S' | 'N' | 'B' },
  sortKey?: { name: string, type: 'S' | 'N' | 'B' },
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED',
  gsis?: GSIDefinition[]
})
```

### createTableFromModels

```typescript
import { createTableFromModels } from 'dynamodb-tooling'

await createTableFromModels(modelsPath, options?)
```

### describeTable

```typescript
import { describeTable } from 'dynamodb-tooling'

const info = await describeTable(tableName)
```

## Migrations

### generateMigration

```typescript
import { generateMigration } from 'dynamodb-tooling'

const migration = await generateMigration(modelsPath, {
  tableName?: string,
  dryRun?: boolean
})
```

### executeMigration

```typescript
import { executeMigration } from 'dynamodb-tooling'

await executeMigration(migration)
```

## Factories

### Factory.define

```typescript
import { Factory } from 'dynamodb-tooling'

Factory.define('User', {
  entityType: 'USER',
  definition: () => ({
    id: crypto.randomUUID(),
    email: `user${Date.now()}@example.com`,
    name: 'Test User'
  }),
  states: {
    admin: { role: 'admin' },
    inactive: { status: 'inactive' }
  }
})
```

### Factory.for

```typescript
// Create records
const users = await Factory.for('User').count(10).create()

// With state
const admin = await Factory.for('User').state('admin').createOne()

// Without persisting
const fakeUsers = Factory.for('User').count(5).make()
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `dbtooling start` | Start DynamoDB Local |
| `dbtooling stop` | Stop DynamoDB Local |
| `dbtooling status` | Show running instances |
| `dbtooling install` | Install DynamoDB Local |
| `dbtooling migrate` | Run migrations |
| `dbtooling migrate:generate` | Generate migration |
| `dbtooling migrate:rollback` | Rollback migration |
| `dbtooling migrate:fresh` | Fresh migration |
| `dbtooling migrate:status` | Migration status |
| `dbtooling table:create` | Create table |
| `dbtooling table:describe` | Describe table |
| `dbtooling table:list` | List tables |
| `dbtooling table:delete` | Delete table |
| `dbtooling seed` | Run seeders |
| `dbtooling make:seeder` | Generate seeder |
| `dbtooling make:factory` | Generate factory |
| `dbtooling db:fresh` | Drop, migrate, seed |
| `dbtooling query` | Query items |
| `dbtooling scan` | Scan table |
| `dbtooling get` | Get single item |
| `dbtooling access-patterns` | Show access patterns |
| `dbtooling export` | Export data |
| `dbtooling import` | Import data |

## Configuration

### DynamoDBConfig

```typescript
interface DynamoDBConfig {
  region?: string
  endpoint?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  }

  defaultTableName: string
  tableNamePrefix?: string
  tableNameSuffix?: string

  singleTableDesign: {
    enabled: boolean
    partitionKeyName: string
    sortKeyName: string
    keyDelimiter: string
    entityTypeAttribute: string
    gsiCount: number
  }

  queryBuilder: {
    modelsPath: string
    timestampFormat: 'iso' | 'unix' | 'unix_ms'
    softDeletes: {
      enabled: boolean
      attribute: string
    }
  }

  capacity: {
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
    read?: number
    write?: number
  }

  local: {
    enabled: boolean
    port: number
    dbPath?: string
    inMemory?: boolean
  }
}
```
