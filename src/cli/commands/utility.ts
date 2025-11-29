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
}
