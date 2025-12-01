/**
 * Analytics Infrastructure Module
 *
 * Provides tools for deploying the analytics DynamoDB table:
 * - CloudFormation templates (JSON/YAML)
 * - SAM templates for serverless deployment
 * - CDK code generation
 * - AWS SDK CreateTable input
 * - Migration utilities
 * - Setup scripts
 */

// CloudFormation
export {
  generateCloudFormationJson,
  generateCloudFormationTemplate,
  generateCloudFormationYaml,
  generateSamTemplate,
  generateSamYaml,
  type CloudFormationConfig,
} from './cloudformation'

// CDK
export {
  generateCdkCode,
  generateCdkTableCode,
  generateCreateTableInput,
  type AnalyticsApiProps,
  type AnalyticsTableProps,
} from './cdk'

// Setup & Migrations
export {
  checkTableStatus,
  createAnalyticsTable,
  createPitrMigration,
  createStreamsMigration,
  createTimeBasedGsiMigration,
  enableTtl,
  generateAwsCliCommands,
  printSetupInstructions,
  runMigrations,
  type DynamoDBClientLike,
  type MigrationResult,
  type MigrationStep,
  type SetupConfig,
  type SetupResult,
} from './setup'
