---
title: DynamoDB Tooling - A Complete DynamoDB Toolkit for TypeScript
description: Comprehensive DynamoDB toolkit with Laravel-style ORM, single-table design, migrations, and CLI tools.
---

# DynamoDB Tooling

A comprehensive DynamoDB toolkit for TypeScript with automatic single-table design, Laravel-style ORM, migrations, and CLI tools.

<div class="tip custom-block" style="padding-top: 8px">
Define your models once and get automatic key pattern generation, GSI derivation, and a type-safe query experience powered by DynamoDB best practices.
</div>

## Features

- **Laravel-Style ORM** - Familiar query builder with fluent chainable methods
- **Single-Table Design** - Zero-config key patterns with automatic GSI derivation
- **Migrations** - Generate and execute migrations from models with full diff support
- **Factories & Seeders** - Generate fake data for testing
- **DynamoDB Local** - Built-in support for local development
- **Full Type Safety** - Complete TypeScript support with IntelliSense

## Quick Start

```bash
bun add dynamodb-tooling
```

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
```

## Documentation

- [Introduction](/intro) - Overview and key concepts
- [Installation](/install) - Getting started guide
- [Table Operations](/table-operations) - Creating and managing tables
- [Query Helpers](/query-helpers) - Fluent query building
- [Batch Operations](/batch-operations) - Efficient bulk operations
- [Local Development](/local-development) - DynamoDB Local setup

## Why DynamoDB Tooling?

DynamoDB Tooling eliminates the complexity of working with DynamoDB by providing a familiar, Laravel-inspired interface while automatically handling single-table design patterns, key generation, and index management.
