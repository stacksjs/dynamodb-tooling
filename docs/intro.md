---
title: Introduction to DynamoDB Tooling
description: Learn about DynamoDB Tooling's architecture and capabilities for building DynamoDB applications.
---

# Introduction

DynamoDB Tooling is a comprehensive toolkit designed to make working with Amazon DynamoDB as intuitive as working with traditional ORMs like Laravel's Eloquent or ActiveRecord.

## Core Concepts

### Single-Table Design

DynamoDB best practices recommend using a single table for most applications. DynamoDB Tooling automatically generates the key patterns required for single-table design:

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

### Models

Models define your data structure and relationships:

```ts
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

The query builder provides a fluent interface for constructing DynamoDB queries:

```ts
// Simple queries
const users = await User.query()
  .where('status', 'active')
  .get()

// Complex queries with relationships
const usersWithPosts = await User.query()
  .where('age', '>=', 18)
  .with('posts')
  .orderByDesc('createdAt')
  .limit(10)
  .get()
```

## Architecture

DynamoDB Tooling consists of several integrated components:

### Model Layer

- **DynamoDBModel** - Base class for all models
- **ModelValidator** - Validates model data against schema
- **ModelParser** - Parses Stacks model definitions

### Query Layer

- **Query Builder** - Fluent query construction
- **PartiQL Builder** - SQL-like query syntax
- **Driver System** - Pluggable DynamoDB driver

### Single-Table Design

- **KeyPatternGenerator** - Generates pk/sk patterns
- **GSIDeriver** - Derives Global Secondary Indexes
- **LSIDeriver** - Derives Local Secondary Indexes
- **SparseIndexDeriver** - Creates sparse indexes

### Operations

- **Migration System** - Schema migration management
- **Factory System** - Test data generation
- **Seeder System** - Database population
- **Backup Manager** - Backup and restore

### Advanced Features

- **Multi-Tenancy** - Tenant isolation and management
- **Caching** - Query result caching
- **Observability** - Logging, metrics, and tracing
- **Security** - Encryption and access control

## Configuration

Create a `dynamodb.config.ts` file in your project root:

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

## Next Steps

- [Installation Guide](/install) - Get started with DynamoDB Tooling
- [Table Operations](/table-operations) - Learn about table management
- [Query Helpers](/query-helpers) - Master the query builder
