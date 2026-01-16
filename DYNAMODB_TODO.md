# DynamoDB Tooling TODO

## Overview

**dynamodb-tooling** is the foundational DynamoDB ORM that powers `bun-query-builder/dynamodb`. It provides:

- Single-table design patterns
- Stacks model transformation
- Key pattern generation
- GSI/LSI derivation
- Full ORM capabilities

```
┌─────────────────────────────────────────────────────────┐
│                  bun-query-builder                      │
│  ┌─────────────────┐    ┌─────────────────────────┐    │
│  │     sql/        │    │      dynamodb/          │    │
│  │  (table-centric)│    │   (entity-centric)      │    │
│  │                 │    │                         │    │
│  │  db.table()     │    │  dynamo.entity()        │    │
│  │  .join()        │    │  .pk() .sk()            │    │
│  │  .where()       │    │  .index()               │    │
│  └─────────────────┘    └───────────┬─────────────┘    │
└─────────────────────────────────────┼──────────────────┘
                                      │ extends
                          ┌───────────▼─────────────┐
                          │    dynamodb-tooling     │
                          │                         │
                          │  - EntityTransformer    │
                          │  - KeyPatternGenerator  │
                          │  - DynamoDBModel        │
                          │  - AccessPatternGen     │
                          │  - GsiDeriver           │
                          │  - StacksModelParser    │
                          └─────────────────────────┘
```

---

## DynamoDB ORM Driver

### Stacks Models to Single Table Design
**Status:** Complete
**Description:** Special DynamoDB "ORM driver"/tool where Stacks models are transformed to single table designs.

**Tasks:**
- [x] Finish DynamoDB ORM driver (`src/models/DynamoDBModel.ts`)
- [x] Transform Stacks models to single table design (`src/model-parser/StacksModelParser.ts`, `src/single-table/EntityTransformer.ts`)
- [x] Define access patterns for common queries (`src/single-table/AccessPatternGenerator.ts`)
- [x] Implement GSI (Global Secondary Index) strategies (`src/single-table/GsiDeriver.ts`)
- [x] Add migration tooling for schema changes (`src/migrations/`)
- [x] Document single table design patterns (README.md)

---

## Relationship with bun-query-builder

### How bun-query-builder Extends dynamodb-tooling
**Status:** Complete

**Architecture Decision:** SQL and DynamoDB are fundamentally different paradigms:

| SQL (bun-query-builder) | DynamoDB (extends dynamodb-tooling) |
|-------------------------|-------------------------------------|
| Table-centric | Entity-centric |
| `db.table('users')` | `dynamo.entity('User')` |
| JOINs for relationships | Denormalization |
| WHERE clauses | pk/sk key conditions |
| Multiple tables | Single table, multiple entity types |

**What bun-query-builder/dynamodb imports from dynamodb-tooling:**

```typescript
import type { AccessPattern, EntityDefinition, SingleTableConfig } from 'dynamodb-tooling'
// bun-query-builder/dynamodb uses these from dynamodb-tooling:
import {

  AccessPatternGenerator,

  DynamoDBDriver,
  // Core ORM
  DynamoDBModel,

  // Single-table design
  EntityTransformer,
  // Index derivation
  GsiDeriver,
  KeyPatternGenerator,

  LsiDeriver,

  // Relationships
  RelationshipResolver,

  // Types

  SparseIndexDeriver,
  // Model parsing
  StacksModelParser
} from 'dynamodb-tooling'
```

**bun-query-builder/dynamodb provides:**
- Fluent query builder API (`dynamo.entity().pk().sk().get()`)
- Connection management
- Higher-level abstractions for common patterns

---

## Exports for bun-query-builder Integration

### Core Exports
```typescript
// dynamodb-tooling/index.ts exports for bun-query-builder:

// Configuration
export { defaultConfig, type SingleTableConfig } from './config'
export { DynamoDBDriver } from './drivers/DynamoDBDriver'

// Model parsing (Stacks integration)
export { StacksModelParser } from './model-parser/StacksModelParser'
// ORM
export { DynamoDBModel } from './models/DynamoDBModel'
export { AccessPatternGenerator } from './single-table/AccessPatternGenerator'

// Single-table design
export { EntityTransformer } from './single-table/EntityTransformer'
// Index derivation
export { GsiDeriver } from './single-table/GsiDeriver'

export { KeyPatternGenerator } from './single-table/KeyPatternGenerator'

export { LsiDeriver } from './single-table/LsiDeriver'

// Relationships
export { RelationshipResolver } from './single-table/RelationshipResolver'
```

---

## Use Cases

- **Pantry registry API backend** - Package metadata, versions, analytics
- **Fathom analytics alternative** - Event tracking, aggregations
- **Heatmap data storage** - Mouse movements, clicks, scroll depth
- **Any high-scale, low-latency needs** - Single-table design excels here

---

## Implemented Features Summary

### Core Features
- **DynamoDB Model ORM** - Laravel-style query builder with `where()`, `with()`, `orderBy()`
- **Single-Table Design** - Automatic pk/sk pattern generation from model definitions
- **Model Parser** - Parses Stacks model files and extracts metadata
- **Entity Transformer** - Transforms JS objects to/from DynamoDB format
- **Key Pattern Generator** - Generates pk/sk patterns based on entity type
- **GSI Deriver** - Automatically derives GSI requirements from relationships
- **LSI Deriver** - Derives Local Secondary Index configurations
- **Access Pattern Generator** - Documents all access patterns for a model
- **Relationship Resolver** - Handles hasOne, hasMany, belongsTo, belongsToMany

### Infrastructure
- **Migrations** - Schema generation, diffing, and migrations
- **Factories** - Generate fake data for testing
- **Seeders** - Populate database with test data
- **CLI Tools** - Full CLI for table management, migrations, seeding
- **DynamoDB Local** - Built-in support with Docker option

### Advanced Features
- **Multi-Tenancy** - Tenant isolation strategies (table, prefix, attribute)
- **Validation** - Sync and async validation with ts-validation integration
- **Streams** - DynamoDB Streams processing
- **PartiQL** - PartiQL query builder
- **Backup & Restore** - PITR and on-demand backups
- **Global Tables** - Multi-region replication management
- **Observability** - Logging, metrics, tracing
- **Security** - Encryption, access control, audit logging
- **Caching** - Query result caching
- **Polymorphic Relationships** - morphTo, morphMany support
- **Event Sourcing** - Event store and aggregate roots
- **GraphQL Integration** - Schema generation from models
- **Serverless** - Lambda handler utilities
- **Import/Export** - Data migration tools

---

## Usage Example (via bun-query-builder)

```typescript
import { dynamo } from 'bun-query-builder/dynamodb'

// Configure (uses dynamodb-tooling under the hood)
dynamo.connection({
  region: 'us-east-1',
  table: 'MyApp',
})

// Register Stacks model (parsed by StacksModelParser)
dynamo.registerModel({
  name: 'User',
  primaryKey: 'id',
  attributes: {
    name: { fillable: true },
    email: { fillable: true, unique: true },
  },
  hasMany: ['Post'],
  traits: { useTimestamps: true },
})

// Entity-centric queries
const users = await dynamo.entity('User')
  .pk('USER#123')
  .sk
  .beginsWith('PROFILE#')
  .index('GSI1')
  .project('name', 'email')
  .get()

// Automatic key generation (via KeyPatternGenerator)
const item = dynamo.createItem('User', { id: '123', name: 'John' })
// => { pk: 'USER#123', sk: 'USER#123', _et: 'User', name: 'John', ... }
```

---

## Notes

- **dynamodb-tooling is the foundation** - bun-query-builder/dynamodb wraps it with fluent API
- **Single table design is the pattern** - All entities in one table, differentiated by pk/sk patterns
- **Stacks models are first-class** - StacksModelParser transforms them to DynamoDB entities
- **Full TypeScript support** - Comprehensive type inference throughout
- **Don't use for SQL patterns** - Use bun-query-builder's SQL module for relational databases
