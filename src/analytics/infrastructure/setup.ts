/**
 * Analytics Table Setup & Migration Scripts
 *
 * Provides utilities for creating, updating, and migrating
 * the analytics DynamoDB table.
 */

import { generateCreateTableInput, type AnalyticsTableProps } from './cdk'

// ============================================================================
// Types
// ============================================================================

export interface SetupConfig extends AnalyticsTableProps {
  /** AWS region */
  region?: string
  /** DynamoDB endpoint (for local development) */
  endpoint?: string
  /** Wait for table to be active */
  waitForActive?: boolean
  /** Timeout for waiting (ms) */
  waitTimeout?: number
}

export interface SetupResult {
  success: boolean
  tableName: string
  tableArn?: string
  error?: string
}

export interface MigrationStep {
  name: string
  description: string
  execute: (client: DynamoDBClientLike) => Promise<void>
  rollback?: (client: DynamoDBClientLike) => Promise<void>
}

export interface MigrationResult {
  success: boolean
  stepsCompleted: string[]
  error?: string
  failedStep?: string
}

// ============================================================================
// Client Interface (for dependency injection)
// ============================================================================

/**
 * Minimal DynamoDB client interface
 * Allows using either AWS SDK v2 or v3
 */
export interface DynamoDBClientLike {
  send: (command: unknown) => Promise<unknown>
}

/**
 * CreateTable command interface
 */
export interface CreateTableCommandLike {
  input: Record<string, unknown>
}

/**
 * DescribeTable command interface
 */
export interface DescribeTableCommandLike {
  input: { TableName: string }
}

/**
 * UpdateTimeToLive command interface
 */
export interface UpdateTimeToLiveCommandLike {
  input: {
    TableName: string
    TimeToLiveSpecification: {
      AttributeName: string
      Enabled: boolean
    }
  }
}

// ============================================================================
// Setup Functions
// ============================================================================

/**
 * Create the analytics table
 *
 * @example
 * ```typescript
 * import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb'
 * import { createAnalyticsTable } from 'dynamodb-tooling/analytics/infrastructure'
 *
 * const client = new DynamoDBClient({ region: 'us-east-1' })
 *
 * const result = await createAnalyticsTable(client, {
 *   tableName: 'my-analytics',
 *   billingMode: 'PAY_PER_REQUEST',
 * })
 *
 * console.log(`Created table: ${result.tableName}`)
 * ```
 */
export async function createAnalyticsTable(
  client: DynamoDBClientLike,
  config: SetupConfig = {},
  commandFactories: {
    CreateTableCommand: new (input: Record<string, unknown>) => unknown
    DescribeTableCommand: new (input: { TableName: string }) => unknown
  },
): Promise<SetupResult> {
  const { CreateTableCommand, DescribeTableCommand } = commandFactories
  const tableName = config.tableName || 'analytics'

  try {
    // Check if table exists
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }))
      return {
        success: true,
        tableName,
        error: 'Table already exists',
      }
    }
    catch (err) {
      // Table doesn't exist, continue with creation
      if ((err as { name?: string }).name !== 'ResourceNotFoundException') {
        throw err
      }
    }

    // Create table
    const createInput = generateCreateTableInput(config)
    await client.send(new CreateTableCommand(createInput))

    // Wait for table to be active
    if (config.waitForActive !== false) {
      const timeout = config.waitTimeout || 60000
      const startTime = Date.now()

      while (Date.now() - startTime < timeout) {
        const describeResult = await client.send(
          new DescribeTableCommand({ TableName: tableName }),
        ) as { Table?: { TableStatus?: string, TableArn?: string } }

        if (describeResult.Table?.TableStatus === 'ACTIVE') {
          return {
            success: true,
            tableName,
            tableArn: describeResult.Table.TableArn,
          }
        }

        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      return {
        success: false,
        tableName,
        error: 'Timeout waiting for table to become active',
      }
    }

    return {
      success: true,
      tableName,
    }
  }
  catch (err) {
    return {
      success: false,
      tableName,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Enable TTL on the analytics table
 */
export async function enableTtl(
  client: DynamoDBClientLike,
  tableName: string,
  attributeName: string,
  commandFactory: {
    UpdateTimeToLiveCommand: new (input: {
      TableName: string
      TimeToLiveSpecification: { AttributeName: string, Enabled: boolean }
    }) => unknown
  },
): Promise<SetupResult> {
  const { UpdateTimeToLiveCommand } = commandFactory

  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          AttributeName: attributeName,
          Enabled: true,
        },
      }),
    )

    return {
      success: true,
      tableName,
    }
  }
  catch (err) {
    return {
      success: false,
      tableName,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Check if table exists and is active
 */
export async function checkTableStatus(
  client: DynamoDBClientLike,
  tableName: string,
  commandFactory: {
    DescribeTableCommand: new (input: { TableName: string }) => unknown
  },
): Promise<{
  exists: boolean
  status?: string
  itemCount?: number
  sizeBytes?: number
  gsiCount?: number
}> {
  const { DescribeTableCommand } = commandFactory

  try {
    const result = await client.send(
      new DescribeTableCommand({ TableName: tableName }),
    ) as {
      Table?: {
        TableStatus?: string
        ItemCount?: number
        TableSizeBytes?: number
        GlobalSecondaryIndexes?: unknown[]
      }
    }

    return {
      exists: true,
      status: result.Table?.TableStatus,
      itemCount: result.Table?.ItemCount,
      sizeBytes: result.Table?.TableSizeBytes,
      gsiCount: result.Table?.GlobalSecondaryIndexes?.length,
    }
  }
  catch (err) {
    if ((err as { name?: string }).name === 'ResourceNotFoundException') {
      return { exists: false }
    }
    throw err
  }
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Run analytics migrations
 */
export async function runMigrations(
  client: DynamoDBClientLike,
  tableName: string,
  migrations: MigrationStep[],
): Promise<MigrationResult> {
  const stepsCompleted: string[] = []

  for (const migration of migrations) {
    try {
      await migration.execute(client)
      stepsCompleted.push(migration.name)
    }
    catch (err) {
      // Attempt rollback of completed steps
      for (const completedName of stepsCompleted.reverse()) {
        const completedMigration = migrations.find(m => m.name === completedName)
        if (completedMigration?.rollback) {
          try {
            await completedMigration.rollback(client)
          }
          catch {
            // Ignore rollback errors
          }
        }
      }

      return {
        success: false,
        stepsCompleted,
        error: err instanceof Error ? err.message : String(err),
        failedStep: migration.name,
      }
    }
  }

  return {
    success: true,
    stepsCompleted,
  }
}

// ============================================================================
// Pre-defined Migrations
// ============================================================================

/**
 * Migration: Add GSI for time-based queries
 */
export function createTimeBasedGsiMigration(
  tableName: string,
  commandFactory: {
    UpdateTableCommand: new (input: Record<string, unknown>) => unknown
  },
): MigrationStep {
  const { UpdateTableCommand } = commandFactory

  return {
    name: 'add-time-gsi',
    description: 'Add GSI for time-based queries (gsi3pk/gsi3sk)',
    execute: async (client) => {
      await client.send(
        new UpdateTableCommand({
          TableName: tableName,
          AttributeDefinitions: [
            { AttributeName: 'gsi3pk', AttributeType: 'S' },
            { AttributeName: 'gsi3sk', AttributeType: 'S' },
          ],
          GlobalSecondaryIndexUpdates: [
            {
              Create: {
                IndexName: 'GSI3',
                KeySchema: [
                  { AttributeName: 'gsi3pk', KeyType: 'HASH' },
                  { AttributeName: 'gsi3sk', KeyType: 'RANGE' },
                ],
                Projection: { ProjectionType: 'ALL' },
              },
            },
          ],
        }),
      )
    },
    rollback: async (client) => {
      await client.send(
        new UpdateTableCommand({
          TableName: tableName,
          GlobalSecondaryIndexUpdates: [
            {
              Delete: { IndexName: 'GSI3' },
            },
          ],
        }),
      )
    },
  }
}

/**
 * Migration: Enable Point-in-Time Recovery
 */
export function createPitrMigration(
  tableName: string,
  commandFactory: {
    UpdateContinuousBackupsCommand: new (input: Record<string, unknown>) => unknown
  },
): MigrationStep {
  const { UpdateContinuousBackupsCommand } = commandFactory

  return {
    name: 'enable-pitr',
    description: 'Enable Point-in-Time Recovery',
    execute: async (client) => {
      await client.send(
        new UpdateContinuousBackupsCommand({
          TableName: tableName,
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: true,
          },
        }),
      )
    },
    rollback: async (client) => {
      await client.send(
        new UpdateContinuousBackupsCommand({
          TableName: tableName,
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: false,
          },
        }),
      )
    },
  }
}

/**
 * Migration: Enable DynamoDB Streams
 */
export function createStreamsMigration(
  tableName: string,
  viewType: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES',
  commandFactory: {
    UpdateTableCommand: new (input: Record<string, unknown>) => unknown
  },
): MigrationStep {
  const { UpdateTableCommand } = commandFactory

  return {
    name: 'enable-streams',
    description: `Enable DynamoDB Streams (${viewType})`,
    execute: async (client) => {
      await client.send(
        new UpdateTableCommand({
          TableName: tableName,
          StreamSpecification: {
            StreamEnabled: true,
            StreamViewType: viewType,
          },
        }),
      )
    },
    rollback: async (client) => {
      await client.send(
        new UpdateTableCommand({
          TableName: tableName,
          StreamSpecification: {
            StreamEnabled: false,
          },
        }),
      )
    },
  }
}

// ============================================================================
// CLI Helper
// ============================================================================

/**
 * Print setup instructions for manual deployment
 */
export function printSetupInstructions(config: SetupConfig = {}): void {
  const tableName = config.tableName || 'analytics'

  console.log(`
# Analytics DynamoDB Table Setup

## Option 1: AWS CLI

\`\`\`bash
aws dynamodb create-table \\
  --table-name ${tableName} \\
  --attribute-definitions \\
    AttributeName=pk,AttributeType=S \\
    AttributeName=sk,AttributeType=S \\
    AttributeName=gsi1pk,AttributeType=S \\
    AttributeName=gsi1sk,AttributeType=S \\
    AttributeName=gsi2pk,AttributeType=S \\
    AttributeName=gsi2sk,AttributeType=S \\
  --key-schema \\
    AttributeName=pk,KeyType=HASH \\
    AttributeName=sk,KeyType=RANGE \\
  --billing-mode PAY_PER_REQUEST \\
  --global-secondary-indexes \\
    '[
      {
        "IndexName": "GSI1",
        "KeySchema": [
          {"AttributeName": "gsi1pk", "KeyType": "HASH"},
          {"AttributeName": "gsi1sk", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      },
      {
        "IndexName": "GSI2",
        "KeySchema": [
          {"AttributeName": "gsi2pk", "KeyType": "HASH"},
          {"AttributeName": "gsi2sk", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      }
    ]'

# Enable TTL
aws dynamodb update-time-to-live \\
  --table-name ${tableName} \\
  --time-to-live-specification AttributeName=ttl,Enabled=true

# Enable PITR
aws dynamodb update-continuous-backups \\
  --table-name ${tableName} \\
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
\`\`\`

## Option 2: CloudFormation

\`\`\`bash
# Generate template
npx dynamodb-tooling analytics:cfn > analytics.yaml

# Deploy
aws cloudformation deploy \\
  --template-file analytics.yaml \\
  --stack-name ${tableName}-stack
\`\`\`

## Option 3: CDK

\`\`\`bash
# Generate CDK code
npx dynamodb-tooling analytics:cdk > lib/analytics-stack.ts

# Deploy
cdk deploy AnalyticsStack
\`\`\`

## Option 4: SAM

\`\`\`bash
# Generate SAM template
npx dynamodb-tooling analytics:sam > template.yaml

# Deploy
sam build && sam deploy --guided
\`\`\`
`)
}

/**
 * Generate AWS CLI commands for table creation
 */
export function generateAwsCliCommands(config: SetupConfig = {}): string {
  const tableName = config.tableName || 'analytics'
  const region = config.region || 'us-east-1'

  return `#!/bin/bash
set -e

TABLE_NAME="${tableName}"
REGION="${region}"

echo "Creating analytics table: $TABLE_NAME"

# Create table
aws dynamodb create-table \\
  --table-name $TABLE_NAME \\
  --region $REGION \\
  --attribute-definitions \\
    AttributeName=pk,AttributeType=S \\
    AttributeName=sk,AttributeType=S \\
    AttributeName=gsi1pk,AttributeType=S \\
    AttributeName=gsi1sk,AttributeType=S \\
    AttributeName=gsi2pk,AttributeType=S \\
    AttributeName=gsi2sk,AttributeType=S \\
  --key-schema \\
    AttributeName=pk,KeyType=HASH \\
    AttributeName=sk,KeyType=RANGE \\
  --billing-mode PAY_PER_REQUEST \\
  --global-secondary-indexes '[
    {
      "IndexName": "GSI1",
      "KeySchema": [
        {"AttributeName": "gsi1pk", "KeyType": "HASH"},
        {"AttributeName": "gsi1sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI2",
      "KeySchema": [
        {"AttributeName": "gsi2pk", "KeyType": "HASH"},
        {"AttributeName": "gsi2sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]'

echo "Waiting for table to be active..."
aws dynamodb wait table-exists --table-name $TABLE_NAME --region $REGION

echo "Enabling TTL..."
aws dynamodb update-time-to-live \\
  --table-name $TABLE_NAME \\
  --region $REGION \\
  --time-to-live-specification AttributeName=ttl,Enabled=true

echo "Enabling Point-in-Time Recovery..."
aws dynamodb update-continuous-backups \\
  --table-name $TABLE_NAME \\
  --region $REGION \\
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

echo "Done! Table $TABLE_NAME is ready."
`
}
