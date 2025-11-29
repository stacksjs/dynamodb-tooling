// Migrations Module
// Automatic schema generation and migration for DynamoDB single-table design

// Access Pattern Documentation Generator
export {
  type AccessPatternDocumentation,
  type AccessPatternGroup,
  type AttributeDocumentation,
  type DetailedAccessPattern,
  type EntityDocumentation,
  formatAsJSON,
  formatAsMarkdown,
  formatAsSummary,
  generateAccessPatternDoc,
  generateDocFromRegistry,
  type IndexDocumentation,
  type QueryExample,
  type RelationshipDocumentation,
  type TableInfo,
} from './AccessPatternDocGenerator'

// Migration Runner
export {
  DynamoDBMigrationStateStore,
  type ExecutedStep,
  formatMigrationResult,
  getMigrationStatus,
  InMemoryMigrationStateStore,
  type MigrationDynamoDBClient,
  type MigrationError,
  type MigrationOptions,
  type MigrationPreview,
  type MigrationResult,
  type MigrationStateStore,
  type MigrationStatusResult,
  previewMigration,
  rollbackMigration,
  runMigrations,
  type TableDescription,
} from './AutoMigrationRunner'

// Schema Generator
export {
  type AccessPatternSummary,
  type CreateTableInput,
  type DynamoDBAttributeDefinition,
  exportSchemaAsJSON,
  formatSchemaSummary,
  generateSchema,
  generateSchemaFromRegistry,
  type GlobalSecondaryIndexInput,
  type KeySchemaElement,
  type LocalSecondaryIndexInput,
  type ProvisionedThroughput,
  type SchemaGenerationResult,
  type SchemaSummary,
  type SSESpecification,
  type StreamSpecification,
  type TimeToLiveSpecification,
} from './AutoSchemaGenerator'

// Data Migrator
export {
  addMissingEntityTypes,
  addMissingTimestamps,
  backfillGSI,
  backfillMultipleGSIs,
  cleanupOrphanedItems,
  type DataMigrationClient,
  type DataMigrationOptions,
  type DataMigrationResult,
  formatMigrationResult as formatDataMigrationResult,
  type GSIBackfillSpec,
  migrateData,
  migrateEntityTypePrefixes,
  type MigrationItem,
  type MigrationItemError,
  type MigrationProgress,
  type TransformFunction,
} from './DataMigrator'

// Schema Differ
export {
  type ChangeSeverity,
  type ChangeType,
  createMigrationState,
  diffSchemas,
  type DiffSummary,
  formatDiffSummary,
  generateSchemaHash,
  type MigrationState,
  type MigrationStep,
  type SchemaChange,
  type SchemaDiffResult,
} from './SchemaDiffer'
