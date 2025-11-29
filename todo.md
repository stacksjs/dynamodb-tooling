# DynamoDB Tooling - TODO

> A comprehensive task list for building a Laravel-like ORM/Query Builder for DynamoDB with single-table design patterns (Alex DeBrie style).

---

## Phase 1: Enhanced Configuration System ✅ COMPLETE

### 1.1 Expand Core Config Types ✅

- [x] Add `region` config option (default: `us-east-1`)
- [x] Add `endpoint` config option for local/custom endpoints
- [x] Add `credentials` config section (accessKeyId, secretAccessKey, sessionToken)
- [x] Add `profile` option for AWS credential profiles
- [x] Add `maxRetries` and `retryMode` options
- [x] Add `httpOptions` (timeout, connectTimeout, keepAlive, keepAliveTimeout)
- [x] Add `tableNamePrefix` for multi-tenant/environment table naming
- [x] Add `tableNameSuffix` option
- [x] Add `defaultTableName` for single-table design primary table

### 1.2 Single-Table Design Config ✅

- [x] Add `singleTableDesign.enabled` boolean (default: true)
- [x] Add `singleTableDesign.partitionKeyName` (default: `pk`)
- [x] Add `singleTableDesign.sortKeyName` (default: `sk`)
- [x] Add `singleTableDesign.gsi1pkName` / `gsi1skName` (default: `gsi1pk`, `gsi1sk`)
- [x] Add `singleTableDesign.gsi2pkName` / `gsi2skName` (default: `gsi2pk`, `gsi2sk`)
- [x] Add `singleTableDesign.gsi3pkName` / `gsi3skName` through gsi5 (extended)
- [x] Add `singleTableDesign.entityTypeAttribute` (default: `_et`)
- [x] Add `singleTableDesign.dataAttribute` (default: `_d`)
- [x] Add `singleTableDesign.pkPrefix` format (e.g., `{ENTITY}#`)
- [x] Add `singleTableDesign.skPrefix` format patterns
- [x] Add `singleTableDesign.gsiCount` (number of GSIs to configure, default: 2)
- [x] Add `singleTableDesign.keyDelimiter` (default: `#`)

### 1.3 Query Builder Integration Config ✅

- [x] Add `queryBuilder.modelsPath` for Stacks model discovery
- [x] Add `queryBuilder.entityMappingStrategy` (`prefix`, `attribute`, `composite`)
- [x] Add `queryBuilder.timestampFormat` (`iso`, `unix`, `unixMs`)
- [x] Add `queryBuilder.softDeletes.enabled` boolean
- [x] Add `queryBuilder.softDeletes.attribute` (default: `deletedAt`)
- [x] Add `queryBuilder.hooks` section for lifecycle events (global and per-model)
- [x] Add `queryBuilder.caching.enabled` boolean
- [x] Add `queryBuilder.caching.ttlMs` default TTL
- [x] Add `queryBuilder.caching.maxSize` LRU cache size
- [x] Add `queryBuilder.caching.keyPrefix` for namespacing
- [x] Add `queryBuilder.createdAtAttribute` (default: `createdAt`)
- [x] Add `queryBuilder.updatedAtAttribute` (default: `updatedAt`)
- [x] Add `queryBuilder.versionAttribute` (default: `_v`)

### 1.4 Capacity & Performance Config ✅

- [x] Add `capacity.billingMode` (`PAY_PER_REQUEST` | `PROVISIONED`)
- [x] Add `capacity.read` / `capacity.write` for provisioned mode
- [x] Add `capacity.autoScaling.enabled` boolean
- [x] Add `capacity.autoScaling.read.min` / `max` / `targetUtilization`
- [x] Add `capacity.autoScaling.write.min` / `max` / `targetUtilization`
- [x] Add `capacity.autoScaling.scaleInCooldown` / `scaleOutCooldown`

### 1.5 Streams & TTL Config ✅

- [x] Add `streams.enabled` boolean
- [x] Add `streams.viewType` (`KEYS_ONLY`, `NEW_IMAGE`, `OLD_IMAGE`, `NEW_AND_OLD_IMAGES`)
- [x] Add `ttl.enabled` boolean
- [x] Add `ttl.attributeName` (default: `ttl`)

### 1.6 Table Class & Advanced Config ✅

- [x] Add `tableClass` option (`STANDARD` | `STANDARD_INFREQUENT_ACCESS`)
- [x] Add `deletionProtection` boolean (prevent accidental deletes)
- [x] Add `contributorInsights.enabled` boolean
- [x] Add `tags` config for resource tagging
- [x] Add `returnConsumedCapacity` default (`NONE` | `TOTAL` | `INDEXES`)
- [x] Add `returnItemCollectionMetrics` default (`NONE` | `SIZE`)
- [x] Add `consistentRead` default boolean
- [x] Add `globalSecondaryIndexes` array for GSI definitions
- [x] Add `localSecondaryIndexes` array for LSI definitions
- [x] Add `multiTenancy` config (enabled, strategy, tenantIdAttribute, tenantResolver)
- [x] Add `local` config section for DynamoDB Local settings

### 1.7 Config File Implementation ✅

- [x] Update `src/types.ts` with all new config interfaces (850+ lines)
- [x] Update `src/config.ts` with new defaults
- [x] Add config validation with helpful error messages (`validateConfig()`)
- [x] Add `getConfig()` async loader with bunfig
- [x] Add `setConfig()` for programmatic configuration
- [x] Add `resetConfig()` for testing
- [x] Add config merging for nested objects (`deepMerge()`)
- [x] Add helper functions (`getFullTableName()`, `generateDefaultGSIs()`, `isLocalMode()`, `getEndpoint()`)
- [ ] Document all config options in README (deferred to Phase 13)

---

## Phase 2: Automated Single-Table Design from Stacks Models

> **CORE FEATURE**: Zero-config, fully automated translation of Stacks data models into DynamoDB single-table design. Developers write standard Stacks models and the system automatically generates pk/sk patterns, GSIs, access patterns, and handles all DynamoDB complexity behind the scenes.

### 2.1 Stacks Model Parser

- [ ] Create `src/model-parser/StacksModelParser.ts`
- [ ] Auto-discover models from `queryBuilder.modelsPath` config
- [ ] Parse model `name` → entity type prefix (e.g., `User` → `USER#`)
- [ ] Parse model `primaryKey` → sort key suffix pattern
- [ ] Parse model `attributes` → DynamoDB attribute definitions
- [ ] Parse model `hasOne` → auto-generate GSI for reverse lookup
- [ ] Parse model `hasMany` → auto-generate sk begins_with pattern
- [ ] Parse model `belongsTo` → auto-generate pk reference pattern
- [ ] Parse model `belongsToMany` → auto-generate adjacency list items
- [ ] Parse model `traits` → apply behaviors (timestamps, soft deletes, etc.)
- [ ] Parse model `indexes` → map to GSI definitions
- [ ] Cache parsed models for runtime performance

### 2.2 Automatic Key Pattern Generation

- [ ] Create `src/single-table/KeyPatternGenerator.ts`
- [ ] Auto-generate pk pattern: `{ENTITY}#{primaryKey}` (e.g., `USER#123`)
- [ ] Auto-generate sk pattern: `{ENTITY}#{primaryKey}` for base entity
- [ ] Auto-generate hierarchical sk for nested entities: `USER#123#ORDER#456`
- [ ] Auto-generate GSI1 pk/sk from `hasMany` relations (inverted index)
- [ ] Auto-generate GSI2 pk/sk from `belongsToMany` relations
- [ ] Support custom key patterns via optional model config override
- [ ] Validate key patterns don't conflict across entities
- [ ] Generate key pattern documentation automatically

### 2.3 Automatic GSI Derivation from Relationships

- [ ] Create `src/single-table/GsiDeriver.ts`
- [ ] Analyze all `hasOne` relations → derive GSI for "get parent from child"
- [ ] Analyze all `hasMany` relations → derive GSI for "get children by parent"
- [ ] Analyze all `belongsTo` relations → derive reverse lookup GSI
- [ ] Analyze all `belongsToMany` relations → derive adjacency list GSI
- [ ] Detect overlapping access patterns → consolidate into overloaded GSIs
- [ ] Minimize GSI count (max 20 per table, aim for 2-5)
- [ ] Auto-assign GSI pk/sk attributes based on query needs
- [ ] Generate GSI usage documentation per model

### 2.4 Local Secondary Index (LSI) Support

- [ ] Create `src/single-table/LsiDeriver.ts`
- [ ] Detect attributes that need sorting within same pk
- [ ] Auto-generate LSI for `orderBy` patterns on same partition
- [ ] Support up to 5 LSIs per table
- [ ] Handle LSI projection types (ALL, KEYS_ONLY, INCLUDE)
- [ ] Warn about LSI 10GB partition limit

### 2.5 Sparse Index Support

- [ ] Create `src/single-table/SparseIndexDeriver.ts`
- [ ] Detect optional/nullable attributes that need indexing
- [ ] Auto-generate sparse GSI (only items with attribute are indexed)
- [ ] Use sparse indexes for status-based queries (e.g., `status = 'active'`)
- [ ] Document sparse index cost savings

### 2.6 Collection Patterns

- [ ] Support item collections (related items with same pk)
- [ ] Auto-generate collection queries from `hasMany` relations
- [ ] Support `getCollection(pk)` to fetch all related items
- [ ] Implement collection size limits and warnings
- [ ] Support hierarchical collections (nested relationships)

### 2.7 Automatic Access Pattern Generation

- [ ] Create `src/single-table/AccessPatternGenerator.ts`
- [ ] Generate "Get {Entity} by ID" pattern for each model
- [ ] Generate "List all {Entity}" pattern (scan with entity type filter)
- [ ] Generate "Get {Child} by {Parent}" from hasMany relations
- [ ] Generate "Get {Parent} of {Child}" from belongsTo relations
- [ ] Generate "Get {Entity} by {attribute}" from unique attributes
- [ ] Generate "List {Entity} by {attribute}" from indexed attributes
- [ ] Output access pattern matrix (entity × operation × index used)
- [ ] Warn if common query patterns lack efficient index
- [ ] Auto-generate access pattern documentation markdown

### 2.8 Automatic Entity-to-Item Transformation

- [ ] Create `src/single-table/EntityTransformer.ts`
- [ ] Auto-transform model instance → DynamoDB item with pk/sk
- [ ] Auto-add entity type attribute (`_et: 'User'`)
- [ ] Auto-add GSI key attributes based on relationships
- [ ] Auto-add timestamp attributes if `useTimestamps` trait
- [ ] Auto-add version attribute if `useVersioning` trait
- [ ] Auto-add TTL attribute if `useTtl` trait
- [ ] Auto-transform DynamoDB item → model instance (reverse)
- [ ] Handle nested/embedded documents (Map type)
- [ ] Handle arrays/sets (List/Set types)
- [ ] Strip internal attributes (pk, sk, gsi keys) from model output

### 2.9 Automatic Relationship Resolution

- [ ] Create `src/single-table/RelationshipResolver.ts`
- [ ] Auto-resolve `hasOne` → single GetItem on related entity
- [ ] Auto-resolve `hasMany` → Query with sk begins_with
- [ ] Auto-resolve `belongsTo` → GetItem on parent entity
- [ ] Auto-resolve `belongsToMany` → Query adjacency list + BatchGet
- [ ] Support eager loading via `with()` - batch all related queries
- [ ] Support lazy loading via proxy/getter
- [ ] Optimize N+1 queries automatically with batching
- [ ] Cache relationship results within request scope

### 2.10 Time-Series Data Patterns

- [ ] Support time-based sort keys (`USER#123#2024-01-15T10:30:00Z`)
- [ ] Auto-generate time-bucketed partitions for high-volume writes
- [ ] Implement `whereDate()`, `whereMonth()`, `whereYear()` helpers
- [ ] Support time-range queries with efficient key conditions
- [ ] Auto-archive old data to cold storage (S3)

### 2.11 Write Sharding for Hot Partitions

- [ ] Detect high-cardinality write patterns
- [ ] Auto-generate sharded partition keys (`COUNTER#1`, `COUNTER#2`, etc.)
- [ ] Implement scatter-gather reads for sharded data
- [ ] Configurable shard count per entity type
- [ ] Document write sharding patterns

---

## Phase 3: bun-query-builder Driver System

> **IMPORTANT**: Enable a pluggable driver system in bun-query-builder so external drivers (like the DynamoDB sponsorware driver) can be registered.

### 3.1 Driver Plugin Architecture in bun-query-builder

- [ ] Create `src/drivers/registry.ts` - driver registration system
- [ ] Define `DriverPlugin` interface for external drivers
- [ ] Implement `registerDriver(name, driver)` function
- [ ] Implement `getDriver(name)` function with fallback to built-in
- [ ] Update `SupportedDialect` to accept string (for custom drivers)
- [ ] Add `drivers` config option for auto-registration
- [ ] Export driver interfaces from package for external use
- [ ] Document driver plugin API in README

### 3.2 Driver Interface Refinement

- [ ] Extract `BaseDriver` abstract class with common functionality
- [ ] Define `DriverCapabilities` interface (transactions, batch, streams, etc.)
- [ ] Add `getCapabilities()` method to driver interface
- [ ] Add `validateConfig()` method for driver-specific config validation
- [ ] Add `connect()` / `disconnect()` lifecycle methods
- [ ] Add `healthCheck()` method for connection status
- [ ] Ensure all existing drivers (SQLite, PostgreSQL, MySQL) implement new interface

---

## Phase 4: DynamoDB Driver Sponsorware Repository

> **SPONSORWARE**: Create separate repo at `~/Code/bun-dynamodb-driver` using ts-starter template. This is a paid driver that integrates with bun-query-builder.

### 4.1 Repository Setup

- [ ] Copy ts-starter to `~/Code/bun-dynamodb-driver`
- [ ] Update `package.json` name to `bun-dynamodb-driver`
- [ ] Update `package.json` description for DynamoDB driver
- [ ] Update repository URLs to `stacksjs/bun-dynamodb-driver`
- [ ] Update LICENSE for sponsorware terms
- [ ] Remove unnecessary starter files (bin/, cli scripts)
- [ ] Set up GitHub repo with sponsorware access controls
- [ ] Add sponsorware badge and notice to README

### 4.2 Driver Dependencies

- [ ] Run `bun link` in ts-cloud
- [ ] Run `bun link ts-cloud` in bun-dynamodb-driver
- [ ] Run `bun link` in bun-query-builder
- [ ] Run `bun link bun-query-builder` in bun-dynamodb-driver
- [ ] Add ts-cloud as dependency in package.json
- [ ] Add bun-query-builder as peerDependency in package.json
- [ ] Export driver registration function from index

### 4.3 Driver Structure

- [ ] Create `src/driver.ts` - main DynamoDBDriver class
- [ ] Create `src/config.ts` - DynamoDB-specific config types
- [ ] Create `src/types.ts` - DynamoDB types and interfaces
- [ ] Create `src/index.ts` - exports and auto-registration
- [ ] Implement `DriverPlugin` interface from bun-query-builder
- [ ] Export `registerDynamoDBDriver()` convenience function

---

## Phase 5: ts-cloud DynamoDB Client Implementation

> **IMPORTANT**: All AWS interactions go through `ts-cloud` (~/Code/ts-cloud). Implement missing DynamoDB APIs there, then import into bun-dynamodb-driver. No direct AWS SDK usage.

### 5.1 DynamoDB Client in ts-cloud

- [ ] Create `packages/core/src/aws/dynamodb.ts` in ts-cloud
- [ ] Implement `DynamoDBClient` class using existing `makeAWSRequest` + AWS Signature V4
- [ ] Implement `createTable(params)` - CreateTable API
- [ ] Implement `deleteTable(tableName)` - DeleteTable API
- [ ] Implement `describeTable(tableName)` - DescribeTable API
- [ ] Implement `listTables()` - ListTables API
- [ ] Implement `updateTable(params)` - UpdateTable API (for GSI changes)
- [ ] Implement `waitForTableActive(tableName)` - poll until ACTIVE
- [ ] Implement `waitForTableDeleted(tableName)` - poll until deleted
- [ ] Export from `packages/core/src/aws/index.ts`

### 5.2 DynamoDB Item Operations in ts-cloud

- [ ] Implement `getItem(tableName, key)` - GetItem API
- [ ] Implement `putItem(tableName, item, options?)` - PutItem API
- [ ] Implement `updateItem(tableName, key, updates, options?)` - UpdateItem API
- [ ] Implement `deleteItem(tableName, key, options?)` - DeleteItem API
- [ ] Implement `query(tableName, params)` - Query API
- [ ] Implement `scan(tableName, params?)` - Scan API
- [ ] Support `ConsistentRead` option on all read operations
- [ ] Support `ReturnValues` option on write operations
- [ ] Support `ConditionExpression` for conditional writes

### 5.3 DynamoDB Batch Operations in ts-cloud

- [ ] Implement `batchGetItem(params)` - BatchGetItem API
- [ ] Implement `batchWriteItem(params)` - BatchWriteItem API
- [ ] Handle `UnprocessedKeys` / `UnprocessedItems` with retries
- [ ] Auto-chunk requests exceeding limits (25 write / 100 read)
- [ ] Implement exponential backoff for throttling

### 5.4 DynamoDB Transaction Operations in ts-cloud

- [ ] Implement `transactGetItems(params)` - TransactGetItems API
- [ ] Implement `transactWriteItems(params)` - TransactWriteItems API
- [ ] Handle `TransactionCanceledException` with details
- [ ] Validate 100 item limit before request

### 5.5 DynamoDB Expression Builders in ts-cloud

- [ ] Create `packages/core/src/aws/dynamodb-expressions.ts`
- [ ] Implement `buildKeyConditionExpression(conditions)`
- [ ] Implement `buildFilterExpression(conditions)`
- [ ] Implement `buildUpdateExpression(updates)`
- [ ] Implement `buildProjectionExpression(attributes)`
- [ ] Implement `buildConditionExpression(conditions)`
- [ ] Auto-generate `ExpressionAttributeNames` (#name placeholders)
- [ ] Auto-generate `ExpressionAttributeValues` (:value placeholders)
- [ ] Handle reserved word escaping automatically

### 5.6 DynamoDB Types in ts-cloud

- [ ] Expand `packages/aws-types/src/dynamodb.ts` with runtime types
- [ ] Add `DynamoDBItem` type (Record<string, AttributeValue>)
- [ ] Add `AttributeValue` type (S, N, B, BOOL, NULL, M, L, SS, NS, BS)
- [ ] Add `KeyCondition`, `FilterCondition` types
- [ ] Add `UpdateExpression` types (SET, REMOVE, ADD, DELETE)
- [ ] Add `QueryInput`, `QueryOutput` types
- [ ] Add `ScanInput`, `ScanOutput` types
- [ ] Add `TransactWriteItem`, `TransactGetItem` types

### 5.7 DynamoDB Document Client in ts-cloud

- [ ] Create `packages/core/src/aws/dynamodb-document.ts`
- [ ] Implement automatic JS ↔ DynamoDB type marshalling
- [ ] Marshal `string` → `{ S: string }`
- [ ] Marshal `number` → `{ N: string }` (DynamoDB uses string for numbers)
- [ ] Marshal `boolean` → `{ BOOL: boolean }`
- [ ] Marshal `null` → `{ NULL: true }`
- [ ] Marshal `Array` → `{ L: [...] }`
- [ ] Marshal `Object` → `{ M: {...} }`
- [ ] Marshal `Set<string>` → `{ SS: [...] }`
- [ ] Marshal `Set<number>` → `{ NS: [...] }`
- [ ] Marshal `Buffer/Uint8Array` → `{ B: base64 }`
- [ ] Implement `unmarshall(item)` for reverse conversion
- [ ] Export `DocumentClient` wrapper with auto-marshalling

---

## Phase 6: DynamoDB Driver Implementation (in bun-dynamodb-driver)

> These tasks are implemented in the `~/Code/bun-dynamodb-driver` sponsorware repo.

### 6.1 Driver Core Methods

- [ ] Implement `quoteIdentifier()` (no-op for DynamoDB)
- [ ] Implement `getColumnType()` mapping to DynamoDB types (S, N, B, BOOL, NULL, M, L, SS, NS, BS)
- [ ] Implement `createTable()` generating DynamoDB CreateTable params
- [ ] Implement `createIndex()` for GSI/LSI creation
- [ ] Implement `addColumn()` (no-op, DynamoDB is schemaless)
- [ ] Implement `modifyColumn()` (no-op, DynamoDB is schemaless)
- [ ] Implement `dropTable()` generating DeleteTable params
- [ ] Implement `dropColumn()` (no-op)
- [ ] Implement `dropIndex()` for GSI removal
- [ ] Implement `createMigrationsTable()` for migration tracking item
- [ ] Implement `getExecutedMigrationsQuery()` for migration state
- [ ] Implement `recordMigrationQuery()` for migration tracking
- [ ] Import `DynamoDBClient` from `ts-cloud`

### 6.2 Query Translation Layer

- [ ] Create `src/query-translator.ts`
- [ ] Translate `where('id', '=', 123)` → pk/sk key condition automatically
- [ ] Translate `where('userId', '=', 456)` → GSI query automatically
- [ ] Translate arbitrary where → filter expression (with warning)
- [ ] Auto-select best index based on where conditions
- [ ] Translate `orderBy` → ScanIndexForward boolean
- [ ] Translate `limit` → Limit parameter
- [ ] Translate `select` → ProjectionExpression
- [ ] Handle entity type filtering automatically (invisible to user)

### 6.3 Core Query Builder for DynamoDB

- [ ] Create `src/query-builder/DynamoQueryBuilder.ts`
- [ ] Implement fluent API matching bun-query-builder interface
- [ ] Implement `table(name)` / `from(name)` method
- [ ] Implement `select(...columns)` for projection expressions
- [ ] Implement `where(key, operator, value)` for key conditions
- [ ] Implement `andWhere()` / `orWhere()` for filter expressions
- [ ] Implement `whereIn(key, values)` for IN conditions
- [ ] Implement `whereBetween(key, min, max)` for BETWEEN
- [ ] Implement `whereBeginsWith(key, prefix)` for begins_with
- [ ] Implement `whereContains(key, value)` for contains
- [ ] Implement `whereExists(key)` / `whereNotExists(key)`
- [ ] Implement `orderBy(key, direction)` (ScanIndexForward)
- [ ] Implement `limit(n)` for Limit parameter
- [ ] Implement `offset()` with pagination token handling

### 6.4 CRUD Operations

- [ ] Implement `get()` / `first()` - GetItem operation
- [ ] Implement `all()` / `execute()` - Query/Scan operations
- [ ] Implement `insert(data)` - PutItem operation
- [ ] Implement `insertMany(items)` - BatchWriteItem operation
- [ ] Implement `update(data)` - UpdateItem operation
- [ ] Implement `updateMany(items)` - BatchWriteItem for updates
- [ ] Implement `delete()` - DeleteItem operation
- [ ] Implement `deleteMany(keys)` - BatchWriteItem for deletes
- [ ] Implement `upsert(data)` - conditional PutItem
- [ ] Implement `increment(key, amount)` - atomic counter update
- [ ] Implement `decrement(key, amount)` - atomic counter update
- [ ] Implement `append(key, values)` - list append operation
- [ ] Implement `remove(key)` - remove attribute operation

### 6.5 Query vs Scan Intelligence

- [ ] Auto-detect when Query is possible (pk provided)
- [ ] Auto-detect when Scan is required (no pk)
- [ ] Implement `useIndex(indexName)` for GSI/LSI selection
- [ ] Implement automatic index selection based on query conditions
- [ ] Add `forceScan()` method to override Query preference
- [ ] Add `forceQuery()` method with validation
- [ ] Implement parallel scan with `parallelScan(segments)`
- [ ] Add query cost estimation/warnings

### 6.6 Pagination

- [ ] Implement `paginate(perPage)` with LastEvaluatedKey handling
- [ ] Implement `cursorPaginate()` using ExclusiveStartKey
- [ ] Implement `chunk(size, callback)` for batch processing
- [ ] Implement `chunkById(size, callback)` variant
- [ ] Implement `each(callback)` for streaming results
- [ ] Return pagination metadata (hasMore, cursor, count)

### 6.7 Aggregations (Client-Side)

- [ ] Implement `count()` - with optional server-side Select: 'COUNT'
- [ ] Implement `sum(attribute)` - client-side aggregation
- [ ] Implement `avg(attribute)` - client-side aggregation
- [ ] Implement `min(attribute)` - client-side aggregation
- [ ] Implement `max(attribute)` - client-side aggregation
- [ ] Add warning for large dataset aggregations
- [ ] Consider PartiQL for complex aggregations

### 6.8 Transactions

- [ ] Implement `transaction(callback)` wrapper
- [ ] Implement `transactWrite(items)` - TransactWriteItems
- [ ] Implement `transactGet(keys)` - TransactGetItems
- [ ] Handle transaction conflicts with retries
- [ ] Implement `conditionCheck()` for transaction conditions
- [ ] Add transaction item limit validation (100 items max)

### 6.9 Batch Operations

- [ ] Implement `batchGet(keys)` - BatchGetItem with chunking
- [ ] Implement `batchWrite(items)` - BatchWriteItem with chunking
- [ ] Handle unprocessed items with exponential backoff
- [ ] Implement automatic chunking for >25 items (write) / >100 items (read)
- [ ] Add progress callbacks for large batches

### 6.10 Conditional Operations

- [ ] Implement `when(condition, callback)` for conditional building
- [ ] Implement `unless(condition, callback)` inverse
- [ ] Implement `ifNotExists()` for conditional puts
- [ ] Implement `ifExists()` for conditional updates
- [ ] Implement `expectVersion(version)` for optimistic locking
- [ ] Handle ConditionalCheckFailedException gracefully

### 6.11 Atomic Counters & Sets

- [ ] Implement `increment(attribute, amount)` - ADD operation
- [ ] Implement `decrement(attribute, amount)` - ADD with negative
- [ ] Implement `addToSet(attribute, values)` - ADD to SS/NS
- [ ] Implement `removeFromSet(attribute, values)` - DELETE from SS/NS
- [ ] Implement `appendToList(attribute, values)` - list_append
- [ ] Implement `prependToList(attribute, values)` - list_append reversed
- [ ] Implement `removeFromList(attribute, indexes)` - REMOVE list[i]

### 6.12 Unique Constraints

- [ ] Implement unique constraint via conditional writes
- [ ] Support `unique: true` on model attributes
- [ ] Create unique constraint items (pk: `UNIQUE#email#user@example.com`)
- [ ] Transaction-based unique validation on insert/update
- [ ] Handle unique constraint violations with clear errors

### 6.13 Query Result Transformations

- [ ] Implement `map(callback)` - transform each result
- [ ] Implement `filter(callback)` - client-side filtering
- [ ] Implement `reduce(callback, initial)` - aggregate results
- [ ] Implement `groupBy(attribute)` - group results
- [ ] Implement `keyBy(attribute)` - index results by attribute
- [ ] Implement `sortBy(attribute)` - client-side sorting
- [ ] Implement `unique(attribute?)` - deduplicate results
- [ ] Implement `flatten()` - flatten nested results

### 6.14 Raw Query Support

- [ ] Implement `rawQuery(params)` - direct Query API access
- [ ] Implement `rawScan(params)` - direct Scan API access
- [ ] Implement `rawGet(params)` - direct GetItem API access
- [ ] Implement `rawPut(params)` - direct PutItem API access
- [ ] Implement `rawUpdate(params)` - direct UpdateItem API access
- [ ] Implement `rawDelete(params)` - direct DeleteItem API access
- [ ] Implement `rawBatchGet(params)` - direct BatchGetItem
- [ ] Implement `rawBatchWrite(params)` - direct BatchWriteItem
- [ ] Implement `rawTransactWrite(params)` - direct TransactWriteItems
- [ ] Implement `partiql(statement, params)` - PartiQL execution

---

## Phase 7: Model System (Laravel/Stacks Style)

### 7.1 Base Model Class

- [ ] Create `src/models/Model.ts` base class
- [ ] Implement static `table` property (maps to entity type)
- [ ] Implement static `primaryKey` property
- [ ] Implement static `pkPrefix` / `skPrefix` properties
- [ ] Implement `attributes` definition matching Stacks models
- [ ] Implement `fillable` / `guarded` attribute protection
- [ ] Implement `hidden` attributes for serialization
- [ ] Implement `casts` for type coercion
- [ ] Implement `dates` for date attribute handling

### 7.2 Model CRUD Methods

- [ ] Implement `Model.find(pk, sk?)` static method
- [ ] Implement `Model.findOrFail(pk, sk?)` with exception
- [ ] Implement `Model.findMany(keys)` batch get
- [ ] Implement `Model.create(attributes)` static method
- [ ] Implement `Model.query()` returning query builder
- [ ] Implement `model.save()` instance method
- [ ] Implement `model.update(attributes)` instance method
- [ ] Implement `model.delete()` instance method
- [ ] Implement `model.refresh()` to reload from DB
- [ ] Implement `model.replicate()` to clone

### 7.3 Model Relationships

- [ ] Implement `hasOne(Model, fkAttribute)` relationship
- [ ] Implement `hasMany(Model, fkAttribute)` relationship
- [ ] Implement `belongsTo(Model, fkAttribute)` relationship
- [ ] Implement `belongsToMany(Model, pivotEntity)` relationship
- [ ] Implement relationship eager loading with `with()`
- [ ] Implement `withCount()` for relationship counts
- [ ] Implement `has()` / `doesntHave()` existence checks
- [ ] Implement `whereHas()` for relationship conditions
- [ ] Handle single-table relationship queries efficiently

### 7.4 Model Traits (Stacks Compatible)

- [ ] Implement `useTimestamps` trait (createdAt, updatedAt)
- [ ] Implement `useSoftDeletes` trait (deletedAt)
- [ ] Implement `useUuid` trait for UUID primary keys
- [ ] Implement `useTtl` trait for auto-expiring items
- [ ] Implement `useVersioning` trait for optimistic locking
- [ ] Implement `useSeeder` trait configuration
- [ ] Implement `useSearch` trait (for OpenSearch integration later)

### 7.5 Model Events/Hooks

- [ ] Implement `creating` / `created` events
- [ ] Implement `updating` / `updated` events
- [ ] Implement `deleting` / `deleted` events
- [ ] Implement `saving` / `saved` events (create + update)
- [ ] Implement `restoring` / `restored` events (soft delete)
- [ ] Implement `forceDeleting` / `forceDeleted` events
- [ ] Add global model observers support

### 7.6 Model Accessors & Mutators

- [ ] Implement `get` accessors (computed attributes)
- [ ] Implement `set` mutators (transform on save)
- [ ] Implement attribute casting system
- [ ] Support custom cast classes
- [ ] Handle JSON attribute casting
- [ ] Handle date/datetime casting

### 7.7 Model Scopes

- [ ] Implement global scopes (auto-applied)
- [ ] Implement local scopes (opt-in via `scope()`)
- [ ] Implement `withoutGlobalScopes()` method
- [ ] Support scope parameters

### 7.8 Model Serialization

- [ ] Implement `toJSON()` method (respects `hidden`)
- [ ] Implement `toArray()` method
- [ ] Implement `only(...keys)` for selective serialization
- [ ] Implement `except(...keys)` to exclude attributes
- [ ] Implement `makeVisible(...keys)` to temporarily unhide
- [ ] Implement `makeHidden(...keys)` to temporarily hide
- [ ] Support custom serialization via `serializeDate()` override
- [ ] Handle circular references in relationships

### 7.9 Model Dirty Tracking

- [ ] Track original attributes on load
- [ ] Implement `isDirty(attribute?)` method
- [ ] Implement `isClean(attribute?)` method
- [ ] Implement `wasChanged(attribute?)` after save
- [ ] Implement `getOriginal(attribute?)` method
- [ ] Implement `getDirty()` - return changed attributes only
- [ ] Implement `getChanges()` - return changes after save
- [ ] Only send changed attributes in UpdateItem (optimization)

---

## Phase 8: Automated Migration System

> **FULLY AUTOMATED**: Run `dbtooling migrate` and the system reads your Stacks models, generates the optimal single-table schema with GSIs, and creates/updates the DynamoDB table. No manual schema design required.

### 8.1 Automatic Schema Generation from Models

- [ ] Create `src/migrations/AutoSchemaGenerator.ts`
- [ ] Scan all Stacks models from configured path automatically
- [ ] Generate single CreateTable definition with:
  - [ ] pk (String) + sk (String) composite primary key
  - [ ] GSI1 with gsi1pk/gsi1sk (auto-derived from relations)
  - [ ] GSI2 with gsi2pk/gsi2sk (auto-derived from relations)
  - [ ] Additional GSIs as needed (up to 5 recommended)
- [ ] Auto-determine billing mode from config
- [ ] Auto-configure TTL if any model uses `useTtl` trait
- [ ] Auto-configure streams if any model uses event sourcing
- [ ] Output human-readable schema summary

### 8.2 Automatic Diff Detection

- [ ] Create `src/migrations/SchemaDiffer.ts`
- [ ] Compare current models vs last migration state
- [ ] Detect new models → new entity types (no table change needed)
- [ ] Detect new relationships → may need new GSI
- [ ] Detect removed relationships → GSI can be removed
- [ ] Detect attribute changes → no table change (schemaless)
- [ ] Generate migration plan with changes
- [ ] Warn about breaking changes (GSI removal affects queries)

### 8.3 Automatic Migration Execution

- [ ] Create `src/migrations/AutoMigrationRunner.ts`
- [ ] On first run: CreateTable with all derived GSIs
- [ ] On subsequent runs: UpdateTable for GSI changes only
- [ ] Handle GSI creation limits (1 at a time, wait for ACTIVE)
- [ ] Handle GSI deletion (wait for removal)
- [ ] Track migration state in `_migrations` item in same table
- [ ] Support `--dry-run` to preview changes
- [ ] Support `--force` to skip confirmations
- [ ] Rollback support for failed migrations

### 8.4 Automatic Access Pattern Documentation

- [ ] Create `src/migrations/AccessPatternDocGenerator.ts`
- [ ] Auto-generate markdown doc with all access patterns
- [ ] Show which index serves each access pattern
- [ ] Show example pk/sk values for each entity
- [ ] Show example queries for each relationship
- [ ] Output to `docs/access-patterns.md` automatically
- [ ] Update on each migration run

### 8.5 Data Migration for Schema Evolution

- [ ] Create `src/migrations/DataMigrator.ts`
- [ ] Auto-backfill new GSI attributes on existing items
- [ ] Handle large datasets with parallel batch writes
- [ ] Progress reporting with ETA
- [ ] Resume capability for interrupted migrations
- [ ] Validate data integrity post-migration

---

## Phase 9: Seeding System

### 9.1 Seeder Infrastructure

- [ ] Create `src/seeders/Seeder.ts` base class
- [ ] Implement `run(db)` abstract method
- [ ] Implement `order` property for execution order
- [ ] Create `src/seeders/SeederRunner.ts`
- [ ] Discover seeders from configured directory
- [ ] Execute seeders in order

### 9.2 Factory System

- [ ] Create `src/factories/Factory.ts` base class
- [ ] Integrate with `ts-mocker` for fake data
- [ ] Parse `factory` definitions from Stacks models
- [ ] Implement `Factory.count(n).create()`
- [ ] Implement `Factory.make()` (without persisting)
- [ ] Support factory states for variations

### 9.3 Seeder CLI Commands

- [ ] Add `dbtooling seed` command
- [ ] Add `dbtooling seed --class=UserSeeder` specific seeder
- [ ] Add `dbtooling make:seeder <Name>` generator
- [ ] Add `dbtooling db:fresh` (wipe + migrate + seed)

---

## Phase 10: CLI Enhancements

### 10.1 Table Management Commands

- [ ] Add `dbtooling table:create` command
- [ ] Add `dbtooling table:delete` command
- [ ] Add `dbtooling table:describe` command
- [ ] Add `dbtooling table:list` command
- [ ] Add `dbtooling table:wait` (wait for ACTIVE)

### 10.2 Migration Commands

- [ ] Add `dbtooling migrate` command
- [ ] Add `dbtooling migrate:status` command
- [ ] Add `dbtooling migrate:rollback` command
- [ ] Add `dbtooling migrate:fresh` command
- [ ] Add `dbtooling migrate:generate` from models

### 10.3 Query Commands

- [ ] Add `dbtooling query <table>` interactive query
- [ ] Add `dbtooling scan <table>` scan with filters
- [ ] Add `dbtooling get <table> <pk> [sk]` get item
- [ ] Add `dbtooling put <table> <json>` put item
- [ ] Add `dbtooling delete <table> <pk> [sk]` delete item

### 10.4 Utility Commands

- [ ] Add `dbtooling export <table> --format=json|csv`
- [ ] Add `dbtooling import <table> <file>`
- [ ] Add `dbtooling backup <table>` to S3
- [ ] Add `dbtooling restore <table> <backup>`
- [ ] Add `dbtooling console` interactive REPL
- [ ] Add `dbtooling access-patterns` show patterns from models

### 10.5 Local Development Commands

- [ ] Enhance `dbtooling start` (launch local DynamoDB)
- [ ] Add `dbtooling stop` command
- [ ] Add `dbtooling status` command
- [ ] Add `dbtooling logs` command
- [ ] Add `dbtooling reset` (stop + clear data + start)

### 10.6 Environment Management

- [ ] Add `dbtooling env:list` - show configured environments
- [ ] Add `dbtooling env:switch <env>` - switch active environment
- [ ] Add `dbtooling env:diff <env1> <env2>` - compare table schemas
- [ ] Support `.env` file for environment-specific config
- [ ] Support `--env` flag on all commands
- [ ] Prevent accidental production operations (confirmation prompts)

### 10.7 CI/CD Commands

- [ ] Add `dbtooling ci:migrate` - non-interactive migration for CI
- [ ] Add `dbtooling ci:validate` - validate models without applying
- [ ] Add `dbtooling ci:test` - run tests against ephemeral table
- [ ] Generate migration plan as JSON for review
- [ ] Support GitHub Actions / GitLab CI examples

---

## Phase 11: dynamodb-tooling Integration

### 11.1 Link Setup

- [ ] Run `bun link` in ts-cloud
- [ ] Run `bun link ts-cloud` in dynamodb-tooling
- [ ] Run `bun link` in bun-query-builder
- [ ] Run `bun link bun-query-builder` in dynamodb-tooling
- [ ] Run `bun link` in bun-dynamodb-driver
- [ ] Run `bun link bun-dynamodb-driver` in dynamodb-tooling
- [ ] Add ts-cloud as dependency in package.json
- [ ] Add bun-query-builder as dependency in package.json
- [ ] Add bun-dynamodb-driver as dependency in package.json
- [ ] Export query builder from dynamodb-tooling index

### 11.2 Unified API

- [ ] Create `src/index.ts` unified exports
- [ ] Export `createDynamoQueryBuilder()` factory
- [ ] Export `Model` base class
- [ ] Export all config types
- [ ] Export migration utilities
- [ ] Export seeder utilities

### 11.3 Feature Parity Checklist (vs bun-query-builder)

- [ ] `selectFrom()` / `from()` ✓
- [ ] `select()` with projections ✓
- [ ] `where()` / `andWhere()` / `orWhere()` ✓
- [ ] `whereIn()` / `whereNotIn()` ✓
- [ ] `whereBetween()` ✓
- [ ] `whereNull()` / `whereNotNull()` ✓
- [ ] `orderBy()` / `orderByDesc()` ✓
- [ ] `limit()` ✓
- [ ] `offset()` (via cursor) ✓
- [ ] `insert()` / `insertMany()` ✓
- [ ] `update()` / `updateMany()` ✓
- [ ] `delete()` / `deleteMany()` ✓
- [ ] `count()` / `sum()` / `avg()` / `min()` / `max()` ✓
- [ ] `paginate()` / `cursorPaginate()` ✓
- [ ] `chunk()` / `chunkById()` ✓
- [ ] `transaction()` ✓
- [ ] `with()` eager loading ✓
- [ ] `withCount()` ✓
- [ ] `has()` / `doesntHave()` ✓
- [ ] `whereHas()` ✓
- [ ] `scope()` query scopes ✓
- [ ] `cache()` query caching ✓
- [ ] Model hooks (before/after CRUD) ✓
- [ ] Soft deletes (`withTrashed()`, `onlyTrashed()`) ✓
- [ ] `latest()` / `oldest()` ✓
- [ ] `first()` / `firstOrFail()` ✓
- [ ] `find()` / `findOrFail()` ✓
- [ ] `pluck()` single column ✓
- [ ] `exists()` / `doesntExist()` ✓
- [ ] `raw()` for PartiQL queries ✓

---

## Phase 12: Testing

### 12.1 Unit Tests

- [ ] Test config loading and validation
- [ ] Test SingleTableMapper transformations
- [ ] Test query builder SQL generation (PartiQL)
- [ ] Test Model CRUD operations
- [ ] Test relationship loading
- [ ] Test pagination token handling
- [ ] Test batch operation chunking
- [ ] Test transaction building

### 12.2 Integration Tests

- [ ] Test against DynamoDB Local
- [ ] Test CreateTable / DeleteTable
- [ ] Test CRUD operations end-to-end
- [ ] Test GSI queries
- [ ] Test transactions
- [ ] Test batch operations with retries
- [ ] Test pagination with real data
- [ ] Test soft deletes

### 12.3 Model Tests

- [ ] Test model attribute casting
- [ ] Test model accessors/mutators
- [ ] Test model events firing
- [ ] Test model scopes
- [ ] Test model relationships
- [ ] Test model validation

### 12.4 Automated Single-Table Tests

- [ ] Test automatic pk/sk generation from models
- [ ] Test automatic GSI derivation from relationships
- [ ] Test automatic access pattern generation
- [ ] Test entity-to-item transformation
- [ ] Test item-to-entity transformation
- [ ] Test relationship resolution queries
- [ ] Test migration generation from models
- [ ] Test migration execution end-to-end
- [ ] Test migration rollback
- [ ] Test data backfill for new GSIs

### 12.5 Testing Utilities

- [ ] Create `createTestTable()` helper for isolated test tables
- [ ] Create `seedTestData()` helper using factories
- [ ] Create `cleanupTestTable()` helper
- [ ] Implement test fixtures system
- [ ] Add `Model.fake()` method using factory
- [ ] Support in-memory mock for unit tests (no DynamoDB)
- [ ] Add query assertion helpers (`assertQueried`, `assertInserted`)
- [ ] Add consumed capacity assertions for performance tests

---

## Phase 13: Documentation

### 13.1 README Updates

- [ ] Add comprehensive feature list
- [ ] Add installation instructions
- [ ] Add quick start guide
- [ ] Add configuration reference
- [ ] Add single-table design explanation
- [ ] Add migration guide
- [ ] Add model definition guide

### 13.2 API Documentation

- [ ] Document all query builder methods
- [ ] Document Model class API
- [ ] Document relationship methods
- [ ] Document migration utilities
- [ ] Document CLI commands
- [ ] Add TypeDoc generation

### 13.3 Guides

- [ ] Write "Single-Table Design with Stacks Models" guide
- [ ] Write "Migrating from SQL to DynamoDB" guide
- [ ] Write "Access Pattern Design" guide
- [ ] Write "Performance Optimization" guide
- [ ] Write "Testing with DynamoDB Local" guide

### 13.4 Examples

- [ ] Create example Stacks models for DynamoDB
- [ ] Create example queries for common patterns
- [ ] Create example migrations
- [ ] Create example seeders
- [ ] Create full example application

---

## Phase 14: Type Safety & Developer Experience

> **GOAL**: Extremely narrow types with zero `any`, full inference, and compile-time validation of all DynamoDB operations.

### 14.1 Branded/Opaque Types for Keys

- [ ] Create branded `PartitionKey<Entity>` type (not just `string`)
- [ ] Create branded `SortKey<Entity>` type (not just `string`)
- [ ] Create branded `GSI1PK<Entity>` / `GSI1SK<Entity>` types
- [ ] Create branded `EntityType<Name>` literal type
- [ ] Prevent mixing keys from different entities at compile time
- [ ] Type-safe key construction: `pk('USER', userId)` returns `PartitionKey<User>`
- [ ] Validate key format at type level using template literal types

### 14.2 Model Type Inference from Schema

- [ ] Infer `Attributes<Model>` from model `attributes` definition
- [ ] Infer `RequiredAttributes<Model>` vs `OptionalAttributes<Model>`
- [ ] Infer `FillableAttributes<Model>` from `fillable` array
- [ ] Infer `HiddenAttributes<Model>` from `hidden` array
- [ ] Infer `RelationshipTypes<Model>` from `hasOne`/`hasMany`/etc.
- [ ] Generate discriminated union for all entity types
- [ ] Support `const` assertions for literal inference
- [ ] Infer attribute types from `casts` definition

### 14.3 Query Builder Type Narrowing

- [ ] Generic `QueryBuilder<TModel, TSelected, TWith>` with state tracking
- [ ] `where()` narrows to `QueryBuilder<TModel, TSelected, TWith>` with pk/sk context
- [ ] `select('name', 'email')` returns `Pick<TModel, 'name' | 'email'>`
- [ ] `select()` with no args returns full `TModel`
- [ ] `with('posts')` adds `posts: Post[]` to return type
- [ ] `withCount('posts')` adds `postsCount: number` to return type
- [ ] Chain methods preserve and narrow types through entire chain
- [ ] `first()` returns `TModel | null`, `firstOrFail()` returns `TModel`
- [ ] `get()` returns `TModel[]` with correct narrowed type

### 14.4 Conditional Type Safety

- [ ] `where(key)` only accepts `keyof Attributes<TModel>`
- [ ] `where(key, op, value)` - `value` type matches `Attributes<TModel>[key]`
- [ ] `orderBy(key)` only accepts sortable attributes
- [ ] `increment(key)` only accepts numeric attributes
- [ ] `whereIn(key, values)` - `values` is `Array<Attributes<TModel>[key]>`
- [ ] Operator overloads: `=` works on all, `>` only on number/string
- [ ] `beginsWith` only valid on string attributes

### 14.5 Insert/Update Type Validation

- [ ] `insert(data)` - `data` must satisfy `FillableAttributes<TModel>`
- [ ] `insert(data)` - reject unknown keys at compile time
- [ ] `update(data)` - `data` is `Partial<FillableAttributes<TModel>>`
- [ ] `create(data)` - validate required fields present
- [ ] `upsert(data)` - same validation as insert
- [ ] Readonly attributes rejected in update operations
- [ ] Auto-managed fields (`createdAt`, `pk`, `sk`) not in insert type

### 14.6 Relationship Type Safety

- [ ] `hasOne<Profile>()` returns `Profile | null`
- [ ] `hasMany<Post>()` returns `Post[]`
- [ ] `belongsTo<Team>()` returns `Team | null`
- [ ] `with('posts')` - `'posts'` must be valid relationship name
- [ ] `with('posts', query => ...)` - callback receives `QueryBuilder<Post>`
- [ ] Nested `with('posts.comments')` infers through relationship chain
- [ ] `whereHas('posts', q => q.where(...))` - type-safe nested query

### 14.7 Result Type Transformations

- [ ] `pluck('email')` returns `Array<Attributes<TModel>['email']>`
- [ ] `value('email')` returns `Attributes<TModel>['email'] | null`
- [ ] `count()` returns `number`
- [ ] `exists()` returns `boolean`
- [ ] `paginate()` returns `PaginatedResult<TModel>` with typed metadata
- [ ] `chunk()` callback receives `TModel[]`
- [ ] `map(fn)` return type inferred from callback

### 14.8 DynamoDB-Specific Type Safety

- [ ] `AttributeValue` as discriminated union (S | N | B | BOOL | NULL | M | L | SS | NS | BS)
- [ ] Type-safe marshalling: `marshall<T>(obj: T): DynamoDBItem<T>`
- [ ] Type-safe unmarshalling: `unmarshall<T>(item: DynamoDBItem<T>): T`
- [ ] `KeyConditionExpression` builder with type-safe attribute references
- [ ] `FilterExpression` builder with type-safe comparisons
- [ ] `UpdateExpression` builder: SET/REMOVE/ADD/DELETE with correct types
- [ ] `ProjectionExpression` from `select()` with attribute validation

### 14.9 Template Literal Types for Keys

- [ ] `type UserPK = \`USER#${string}\`` - validate pk format
- [ ] `type UserSK = \`USER#${string}\` | \`PROFILE#${string}\`` - union for collections
- [ ] `type GSI1PK = \`TEAM#${string}\`` - relationship keys
- [ ] Auto-generate key type from model definition
- [ ] Compile-time validation of key patterns
- [ ] Extract entity type from key: `EntityFromPK<'USER#123'>` = `User`

### 14.10 Strict Configuration Types

- [ ] `Config` type with no optional `any` properties
- [ ] `BillingMode` as `'PAY_PER_REQUEST' | 'PROVISIONED'` literal union
- [ ] `StreamViewType` as literal union
- [ ] `ReturnValue` as literal union
- [ ] Capacity config only valid when `billingMode: 'PROVISIONED'`
- [ ] Conditional config types based on feature flags

### 14.11 Error Types

- [ ] Discriminated union for all error types
- [ ] `DynamoDBError` base with `code` discriminant
- [ ] `ItemNotFoundError<TModel>` includes model type
- [ ] `ValidationError` with typed field errors
- [ ] `ConditionalCheckFailedError` with condition details
- [ ] `TransactionCancelledError` with per-item reasons
- [ ] Type guards: `isItemNotFoundError(e): e is ItemNotFoundError`

### 14.12 Generic Constraints & Inference

- [ ] `Model` base class with generic: `class Model<T extends ModelDefinition>`
- [ ] Infer model type from class: `type UserType = InferModel<typeof User>`
- [ ] Constrain relationships: `hasMany<T extends Model>(...)`
- [ ] Factory type inference: `Factory<User>` produces `User` instances
- [ ] Query builder generic flows through all operations
- [ ] No `any` in public API - use `unknown` with type guards where needed

### 14.13 Compile-Time Query Validation

- [ ] Detect missing pk in Query operation at compile time
- [ ] Warn when Scan is required (no pk condition)
- [ ] Validate GSI exists when `useIndex()` called
- [ ] Validate sort key operators (`begins_with` only on sk)
- [ ] Validate transaction item count at type level (max 100)
- [ ] Validate batch size at type level (max 25 write, 100 read)

### 14.14 IDE Integration Types

- [ ] JSDoc comments on all public types
- [ ] `@example` tags with working code
- [ ] `@see` links to DynamoDB documentation
- [ ] `@deprecated` markers with migration path
- [ ] Hover information shows full type expansion
- [ ] Go-to-definition works for generated types

### 14.15 Type Testing

- [ ] Use `tsd` or `expect-type` for type-level tests
- [ ] Test that invalid queries fail to compile
- [ ] Test that return types are correctly narrowed
- [ ] Test branded types prevent mixing
- [ ] Test template literal types validate formats
- [ ] Test discriminated unions exhaustiveness
- [ ] CI runs type tests alongside unit tests

### 14.16 Error Handling & Debugging

- [ ] Create custom error classes (ItemNotFoundError, ValidationError, etc.)
- [ ] Add detailed error messages with suggested fixes
- [ ] Implement query logging with timing
- [ ] Add `debug()` method to print query params before execution
- [ ] Add `explain()` method to show which index will be used
- [ ] Implement retry logic with exponential backoff for throttling
- [ ] Handle ProvisionedThroughputExceededException gracefully

### 14.17 Validation Integration

- [ ] Parse `validation.rule` from Stacks models
- [ ] Validate before insert/update operations
- [ ] Return structured validation errors
- [ ] Support async validation rules
- [ ] Integrate with `@stacksjs/ts-validation`

### 14.18 IDE Integration

- [ ] VSCode extension for model visualization
- [ ] Show access patterns inline in model files
- [ ] Autocomplete for query builder methods
- [ ] Hover documentation for DynamoDB operations
- [ ] Lint rules for inefficient query patterns

---

## Phase 15: Performance & Optimization

### 15.1 Connection Management

- [ ] Implement connection pooling for DynamoDB client
- [ ] Support keep-alive connections
- [ ] Add connection health checks
- [ ] Handle connection timeouts gracefully

### 15.2 Query Optimization

- [ ] Warn when using Scan instead of Query
- [ ] Warn when filter expressions filter large result sets
- [ ] Suggest GSI creation for common query patterns
- [ ] Implement query result caching (LRU)
- [ ] Add consumed capacity tracking and reporting
- [ ] Implement read/write capacity budgeting

### 15.3 Batch Optimization

- [ ] Implement adaptive batch sizing based on item size
- [ ] Parallel batch execution for large datasets
- [ ] Implement request coalescing for concurrent reads
- [ ] Add batch operation progress events

### 15.4 Cost Monitoring

- [ ] Track consumed read/write capacity units
- [ ] Estimate query costs before execution
- [ ] Add cost alerts/warnings for expensive operations
- [ ] Generate cost reports per entity type

---

## Phase 16: Multi-Tenancy Support

### 16.1 Tenant Isolation Strategies

- [ ] Support table-per-tenant (separate tables)
- [ ] Support prefix-per-tenant (pk prefix: `TENANT#123#USER#456`)
- [ ] Support attribute-per-tenant (tenantId attribute + GSI)
- [ ] Auto-inject tenant context into all queries
- [ ] Prevent cross-tenant data access

### 16.2 Tenant Configuration

- [ ] Add `multiTenancy.enabled` config
- [ ] Add `multiTenancy.strategy` (`table`, `prefix`, `attribute`)
- [ ] Add `multiTenancy.tenantIdAttribute` config
- [ ] Add `multiTenancy.tenantResolver` callback
- [ ] Support tenant-specific table capacity

---

## Phase 17: Advanced Features (Future)

### 17.1 OpenSearch Integration

- [ ] Add OpenSearch Serverless config
- [ ] Implement full-text search queries
- [ ] Sync DynamoDB to OpenSearch via streams
- [ ] Implement `search()` method on models

### 17.2 DAX Integration

- [ ] Add DAX cluster config
- [ ] Implement DAX client wrapper
- [ ] Add caching layer with DAX
- [ ] Handle DAX failover

### 17.3 Streams Processing

- [ ] Add stream consumer utilities
- [ ] Implement change data capture
- [ ] Add event sourcing helpers
- [ ] Integrate with Lambda handlers

### 17.4 Global Tables

- [ ] Add multi-region config
- [ ] Handle global table replication
- [ ] Add region-aware queries

### 17.5 PartiQL Support

- [ ] Implement `raw()` for PartiQL
- [ ] Add PartiQL query builder
- [ ] Support PartiQL transactions

### 17.6 Point-in-Time Recovery

- [ ] Add PITR config option
- [ ] Implement restore to point-in-time
- [ ] Add backup scheduling utilities

### 17.7 On-Demand Backup

- [ ] Implement `backup()` method
- [ ] Implement `restore()` from backup
- [ ] Add backup listing and management
- [ ] Support cross-region backup restore

---

## Phase 18: Observability & Monitoring

### 18.1 Logging

- [ ] Structured logging for all operations
- [ ] Log query patterns and execution times
- [ ] Log consumed capacity per operation
- [ ] Configurable log levels (debug, info, warn, error)
- [ ] Integration with popular loggers (pino, winston)

### 18.2 Metrics

- [ ] Expose Prometheus-compatible metrics
- [ ] Track operation latency histograms
- [ ] Track error rates by operation type
- [ ] Track cache hit/miss ratios
- [ ] Track batch operation sizes

### 18.3 Tracing

- [ ] OpenTelemetry integration
- [ ] Trace spans for each DynamoDB operation
- [ ] Propagate trace context through batch operations
- [ ] Add custom attributes (table, entity type, index used)

---

## Phase 19: Security

### 19.1 Encryption

- [ ] Support client-side encryption
- [ ] Integrate with AWS KMS for key management
- [ ] Encrypt sensitive attributes automatically
- [ ] Support attribute-level encryption config

### 19.2 Access Control

- [ ] Implement row-level security patterns
- [ ] Support IAM condition keys in queries
- [ ] Add audit logging for data access
- [ ] Implement data masking for sensitive fields

---

## Phase 20: Developer Tooling

### 20.1 Data Visualization

- [ ] Create `dbtooling studio` - web UI for table exploration
- [ ] Visual entity relationship diagram from models
- [ ] Query builder UI with live preview
- [ ] Item editor with validation
- [ ] Access pattern visualization matrix

### 20.2 Code Generation

- [ ] Generate TypeScript types from existing DynamoDB table
- [ ] Generate Stacks models from existing table structure
- [ ] Generate access pattern documentation from query logs
- [ ] Scaffold new model with CLI (`dbtooling make:model`)

### 20.3 Development Workflow

- [ ] Hot reload models during development
- [ ] Watch mode for auto-migration on model changes
- [ ] Diff preview before applying migrations
- [ ] Snapshot testing for query outputs

---

## Phase 21: ElectroDB Compatibility Layer (Optional)

> For teams migrating from ElectroDB or wanting familiar patterns.

### 21.1 ElectroDB-Style Entity Definition

- [ ] Support `Entity` class with ElectroDB-style schema
- [ ] Support `Service` for grouping entities
- [ ] Map ElectroDB attributes to Stacks model format
- [ ] Support ElectroDB composite key syntax

### 21.2 Migration Path

- [ ] Import existing ElectroDB entities
- [ ] Convert ElectroDB schema to Stacks models
- [ ] Document migration guide from ElectroDB

---

## Phase 22: Serverless Framework Integration

### 22.1 Infrastructure as Code

- [ ] Generate CloudFormation/SAM template from models
- [ ] Generate Terraform configuration from models
- [ ] Generate Pulumi configuration from models
- [ ] Support CDK constructs generation

### 22.2 Lambda Integration

- [ ] Optimized cold start initialization
- [ ] Connection reuse across invocations
- [ ] Middleware for Lambda handlers
- [ ] Request context propagation (tracing, tenant)

---

## Phase 23: Data Import/Export & Interoperability

### 23.1 Data Import

- [ ] Import from JSON files
- [ ] Import from CSV with column mapping
- [ ] Import from S3 (large datasets)
- [ ] Import from other DynamoDB tables
- [ ] Validate data against model schema before import
- [ ] Support dry-run mode for import preview
- [ ] Resume interrupted imports

### 23.2 Data Export

- [ ] Export to JSON (single file or chunked)
- [ ] Export to CSV with configurable columns
- [ ] Export to S3 for large tables
- [ ] Export with filters (by entity type, date range, etc.)
- [ ] Support incremental exports (changes since last export)
- [ ] Export access patterns as documentation

### 23.3 Database Sync

- [ ] Sync between DynamoDB tables (dev → staging → prod)
- [ ] Sync subset of data for development
- [ ] Anonymize/mask sensitive data during sync
- [ ] Two-way sync with conflict resolution

---

## Phase 24: Query Caching & Performance

### 24.1 In-Memory Caching

- [ ] Implement LRU cache for query results
- [ ] Cache invalidation on writes
- [ ] Configurable TTL per entity type
- [ ] Cache key generation from query params
- [ ] Cache statistics and hit rate monitoring

### 24.2 Request Deduplication

- [ ] Deduplicate identical concurrent requests
- [ ] Batch concurrent GetItem requests automatically
- [ ] Request coalescing window configuration

### 24.3 Prefetching

- [ ] Prefetch related entities on relationship access
- [ ] Predictive prefetching based on access patterns
- [ ] Background refresh for frequently accessed data

---

## Phase 25: Polymorphic Relationships & Advanced Patterns

### 25.1 Polymorphic Relationships

- [ ] Support `morphOne` relationship (one-to-one polymorphic)
- [ ] Support `morphMany` relationship (one-to-many polymorphic)
- [ ] Support `morphToMany` relationship (many-to-many polymorphic)
- [ ] Auto-generate polymorphic type attribute
- [ ] Query across polymorphic types

### 25.2 Self-Referential Relationships

- [ ] Support `hasMany('self')` for tree structures
- [ ] Implement `ancestors()` / `descendants()` methods
- [ ] Support nested set model for hierarchies
- [ ] Implement `getTree()` for full hierarchy fetch

### 25.3 Composite Primary Keys

- [ ] Support multi-attribute primary keys
- [ ] Auto-generate composite sk patterns
- [ ] Query by partial composite key

---

## Phase 26: Event Sourcing & CQRS (Optional)

### 26.1 Event Store

- [ ] Store events as immutable items
- [ ] Event versioning and ordering
- [ ] Snapshot support for aggregate reconstruction
- [ ] Event replay capabilities

### 26.2 Projections

- [ ] Build read models from events
- [ ] Async projection updates via streams
- [ ] Projection rebuild from event history

---

## Phase 27: GraphQL Integration (Optional)

### 27.1 Schema Generation

- [ ] Generate GraphQL schema from Stacks models
- [ ] Map relationships to GraphQL connections
- [ ] Support pagination (Relay-style cursors)
- [ ] Generate resolvers automatically

### 27.2 DataLoader Integration

- [ ] Implement DataLoader for batching
- [ ] Automatic N+1 prevention
- [ ] Per-request caching

---

## Notes

### Single-Table Design Principles (Alex DeBrie)

1. **One table per application** - All entities in single table
2. **Composite keys** - pk/sk pattern for all items
3. **GSIs for access patterns** - Overloaded GSIs for different queries
4. **Entity type attribute** - Distinguish item types
5. **Denormalization** - Duplicate data for query efficiency
6. **Hierarchical keys** - `USER#123#ORDER#456` patterns

### Key Differences from SQL Query Builder

- No JOINs - use denormalization and GSIs
- No arbitrary WHERE - must use key conditions
- No GROUP BY - client-side aggregation
- No OFFSET - cursor-based pagination only
- Transactions limited to 100 items
- Batch operations limited to 25 writes / 100 reads

### Stacks Model Compatibility (Zero Changes Required)

Stacks models work **as-is** with automatic translation:

| Stacks Model Property | DynamoDB Translation (Automatic) |
|-----------------------|----------------------------------|
| `name: 'User'` | Entity type prefix `USER#` |
| `table: 'users'` | Ignored (single table design) |
| `primaryKey: 'id'` | Sort key pattern `USER#{id}` |
| `attributes: {...}` | Item attributes (schemaless) |
| `hasOne: ['Profile']` | GSI1 for reverse lookup |
| `hasMany: ['Post']` | Query with sk `begins_with` |
| `belongsTo: ['Team']` | pk stores `TEAM#{teamId}` ref |
| `belongsToMany: ['Role']` | Adjacency list items |
| `traits.useTimestamps` | Auto-add `createdAt`/`updatedAt` |
| `traits.useSoftDeletes` | Auto-add `deletedAt` + filter |
| `traits.useUuid` | UUID generation for pk |
| `indexes: [...]` | Additional GSI definitions |
| `validation: {...}` | Client-side validation |
| `factory: fn` | Seeder data generation |

### Example: Automatic Translation

```typescript
// Stacks Model (app/models/User.ts) - NO CHANGES NEEDED
export default {
  name: 'User',
  primaryKey: 'id',
  hasMany: ['Post', 'Comment'],
  belongsTo: ['Team'],
  attributes: {
    email: { unique: true, validation: {...} },
    name: { fillable: true },
  },
  traits: { useTimestamps: true },
}

// Automatically generates DynamoDB items like:
// {
//   pk: 'USER#123',
//   sk: 'USER#123',
//   gsi1pk: 'TEAM#456',        // from belongsTo
//   gsi1sk: 'USER#123',
//   _et: 'User',               // entity type
//   email: 'user@example.com',
//   name: 'John Doe',
//   createdAt: '2024-01-01T00:00:00Z',
//   updatedAt: '2024-01-01T00:00:00Z',
// }

// Automatically generates access patterns:
// - Get User by ID: pk = 'USER#123', sk = 'USER#123'
// - Get User's Posts: pk = 'USER#123', sk begins_with 'POST#'
// - Get Users by Team: GSI1 where gsi1pk = 'TEAM#456'
```
