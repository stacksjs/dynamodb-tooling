// ============================================================================
// Utility CLI Commands
// ============================================================================

import type { CAC } from 'cac'
import { getConfig } from '../../config'
import {
  formatAsJSON,
  formatAsMarkdown,
  formatAsSummary,
  generateAccessPatternDoc,
} from '../../migrations'
import { handleError } from '../utils'

/**
 * Register utility commands
 */
export function registerUtilityCommands(cli: CAC): void {
  // access-patterns - Show access patterns from models
  cli
    .command('access-patterns', 'Show access patterns derived from your Stacks models')
    .option('--format <format>', 'Output format: summary, markdown, json', { default: 'summary' })
    .option('--output <path>', 'Output file path')
    .action(async (options: { format: string, output?: string }) => {
      try {
        const config = await getConfig()
        const doc = await generateAccessPatternDoc(config)

        let output: string
        switch (options.format) {
          case 'markdown':
            output = formatAsMarkdown(doc)
            break
          case 'json':
            output = formatAsJSON(doc)
            break
          case 'summary':
          default:
            output = formatAsSummary(doc)
        }

        if (options.output) {
          const fs = await import('node:fs/promises')
          await fs.writeFile(options.output, output)
          console.log(`Access patterns written to ${options.output}`)
        }
        else {
          console.log(output)
        }
      }
      catch (error) {
        handleError(error)
      }
    })

  // export - Export table data
  cli
    .command('export [table]', 'Export DynamoDB table data')
    .option('--format <format>', 'Output format: json, csv', { default: 'json' })
    .option('--output <path>', 'Output file path (required)')
    .option('--entity-type <type>', 'Filter by entity type')
    .option('--limit <n>', 'Limit number of items')
    .action(async (table: string | undefined, options: {
      format: string
      output?: string
      entityType?: string
      limit?: number
    }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        if (!options.output) {
          console.log('Error: --output is required')
          return
        }

        console.log(`Exporting from: ${tableName}`)
        console.log(`  Format: ${options.format}`)
        console.log(`  Output: ${options.output}`)
        if (options.entityType) {
          console.log(`  Entity Type: ${options.entityType}`)
        }
        if (options.limit) {
          console.log(`  Limit: ${options.limit}`)
        }

        console.log('\nNote: Implement DynamoDB client integration to export data.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // import - Import data into table
  cli
    .command('import [table]', 'Import data into a DynamoDB table')
    .option('--input <path>', 'Input file path (required)')
    .option('--format <format>', 'Input format: json, csv', { default: 'json' })
    .option('--dry-run', 'Validate without importing')
    .option('--batch-size <n>', 'Batch size for writes', { default: 25 })
    .action(async (table: string | undefined, options: {
      input?: string
      format: string
      dryRun?: boolean
      batchSize: number
    }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        if (!options.input) {
          console.log('Error: --input is required')
          return
        }

        console.log(`Importing into: ${tableName}`)
        console.log(`  Input: ${options.input}`)
        console.log(`  Format: ${options.format}`)
        console.log(`  Batch Size: ${options.batchSize}`)

        if (options.dryRun) {
          console.log('\n[DRY RUN] Would validate and preview import.')
        }

        console.log('\nNote: Implement DynamoDB client integration to import data.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // backup - Create a backup
  cli
    .command('backup [table]', 'Create a backup of a DynamoDB table')
    .option('--name <name>', 'Backup name')
    .action(async (table: string | undefined, options: { name?: string }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`
        const backupName = options.name ?? `${tableName}-${Date.now()}`

        console.log(`Creating backup: ${backupName}`)
        console.log(`  Table: ${tableName}`)

        console.log('\nNote: Implement DynamoDB client integration to create backup.')
        console.log('Alternatively, use AWS CLI: aws dynamodb create-backup --table-name <name> --backup-name <name>')
      }
      catch (error) {
        handleError(error)
      }
    })

  // console - Interactive REPL
  cli
    .command('console', 'Start an interactive console')
    .action(async () => {
      try {
        console.log('DynamoDB Tooling Console')
        console.log('========================')
        console.log('')
        console.log('Available globals:')
        console.log('  config  - Configuration object')
        console.log('  db      - Query builder (when implemented)')
        console.log('')
        console.log('Note: Interactive REPL requires additional implementation.')
        console.log('For now, use Node.js REPL with dynamodb-tooling imported.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // restore - Restore from a backup
  cli
    .command('restore [table]', 'Restore a DynamoDB table from a backup')
    .option('--backup-arn <arn>', 'ARN of the backup to restore from (required)')
    .option('--target-table <name>', 'Name for the restored table (required)')
    .option('--force', 'Skip confirmation')
    .action(async (table: string | undefined, options: {
      backupArn?: string
      targetTable?: string
      force?: boolean
    }) => {
      try {
        const config = await getConfig()
        const _tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        if (!options.backupArn) {
          console.log('Error: --backup-arn is required')
          console.log('Example: dbtooling restore --backup-arn arn:aws:dynamodb:us-east-1:123456789012:table/MyTable/backup/01234567890123-abcdef12')
          return
        }

        if (!options.targetTable) {
          console.log('Error: --target-table is required')
          console.log('Example: dbtooling restore --backup-arn <arn> --target-table MyRestoredTable')
          return
        }

        if (!options.force) {
          console.log('Restore Configuration:')
          console.log(`  Backup ARN: ${options.backupArn}`)
          console.log(`  Target Table: ${options.targetTable}`)
          console.log('')
          console.log('This will create a new table from the backup.')
          console.log('Use --force to proceed.')
          return
        }

        console.log(`Restoring backup to: ${options.targetTable}`)
        console.log(`  Backup ARN: ${options.backupArn}`)
        console.log('')
        console.log('Note: Implement DynamoDB client integration to restore from backup.')
        console.log('Alternatively, use AWS CLI:')
        console.log(`  aws dynamodb restore-table-from-backup \\`)
        console.log(`    --target-table-name ${options.targetTable} \\`)
        console.log(`    --backup-arn ${options.backupArn}`)
      }
      catch (error) {
        handleError(error)
      }
    })

  // env:list - List environments
  cli
    .command('env:list', 'List configured environments')
    .action(async () => {
      try {
        const config = await getConfig()

        console.log('Configured Environments')
        console.log('=======================')
        console.log('')
        console.log(`Current configuration:`)
        console.log(`  Region: ${config.region}`)
        console.log(`  Endpoint: ${config.endpoint ?? 'Default AWS'}`)
        console.log(`  Table Prefix: ${config.tableNamePrefix || '(none)'}`)
        console.log(`  Table Suffix: ${config.tableNameSuffix || '(none)'}`)
        console.log(`  Default Table: ${config.defaultTableName}`)
        console.log('')
        console.log('Note: Environment management uses the dynamodb.config.ts file.')
        console.log('Switch environments by modifying the config or using environment variables.')
        console.log('')
        console.log('Environment Variables:')
        console.log('  AWS_REGION - Override region')
        console.log('  AWS_ENDPOINT_URL - Override endpoint (for local dev)')
        console.log('  AWS_PROFILE - Use a specific AWS profile')
      }
      catch (error) {
        handleError(error)
      }
    })

  // ci:validate - Validate models without applying
  cli
    .command('ci:validate', 'Validate Stacks models and schema (for CI)')
    .option('--json', 'Output as JSON for programmatic use')
    .action(async (options: { json?: boolean }) => {
      try {
        const config = await getConfig()
        const doc = await generateAccessPatternDoc(config)

        const result = {
          valid: true,
          tableName: doc.table.name,
          entityCount: doc.entities.length,
          entities: doc.entities.map(e => e.name),
          gsiCount: doc.table.gsiCount,
          lsiCount: doc.table.lsiCount,
          accessPatternCount: doc.accessPatterns.reduce((sum, g) => sum + g.patterns.length, 0),
          warnings: [] as string[],
        }

        // Check for potential issues
        if (doc.table.gsiCount > 5) {
          result.warnings.push(`High GSI count (${doc.table.gsiCount}). Consider consolidating.`)
        }
        if (doc.entities.length === 0) {
          result.valid = false
          result.warnings.push('No entity types found. Check your models path.')
        }

        if (options.json) {
          console.log(JSON.stringify(result, null, 2))
        }
        else {
          console.log('Model Validation')
          console.log('================')
          console.log('')
          console.log(`Status: ${result.valid ? '✓ Valid' : '✗ Invalid'}`)
          console.log(`Table: ${result.tableName}`)
          console.log(`Entities: ${result.entityCount}`)
          console.log(`GSIs: ${result.gsiCount}`)
          console.log(`LSIs: ${result.lsiCount}`)
          console.log(`Access Patterns: ${result.accessPatternCount}`)

          if (result.warnings.length > 0) {
            console.log('')
            console.log('Warnings:')
            for (const warning of result.warnings) {
              console.log(`  ⚠ ${warning}`)
            }
          }
        }

        // Exit with error code for CI
        if (!result.valid) {
          process.exit(1)
        }
      }
      catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ valid: false, error: String(error) }, null, 2))
        }
        process.exit(1)
      }
    })
}
