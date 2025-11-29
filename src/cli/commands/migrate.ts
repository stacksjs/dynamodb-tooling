// ============================================================================
// Migration CLI Commands
// ============================================================================

import type { CAC } from 'cac'
import { getConfig } from '../../config'
import {
  formatDiffSummary,
  formatSchemaSummary,
  generateSchema,
  getMigrationStatus,
  InMemoryMigrationStateStore,
  previewMigration,
} from '../../migrations'
import { handleError } from '../utils'

/**
 * Register migration commands
 */
export function registerMigrateCommands(cli: CAC): void {
  // migrate - Run migrations
  cli
    .command('migrate', 'Run database migrations based on your Stacks models')
    .option('--dry-run', 'Preview changes without executing')
    .option('--force', 'Skip confirmation prompts')
    .option('--verbose', 'Show detailed output')
    .action(async (options: { dryRun?: boolean, force?: boolean, verbose?: boolean }) => {
      try {
        const config = await getConfig()
        const stateStore = new InMemoryMigrationStateStore()

        console.log('Analyzing models and generating migration plan...\n')

        const preview = await previewMigration(stateStore, config)

        if (!preview.diff.hasChanges) {
          console.log('No changes detected. Database is up to date.')
          return
        }

        console.log(formatDiffSummary(preview.diff))

        if (options.dryRun) {
          console.log('\n[DRY RUN] No changes were applied.')
          return
        }

        if (preview.diff.hasBreakingChanges && !options.force) {
          console.log('\nWARNING: This migration contains breaking changes!')
          console.log('Use --force to proceed anyway.')
          return
        }

        console.log('\nTo execute migrations, integrate with a DynamoDB client.')
        console.log('Use the migration plan above to apply changes.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // migrate:status - Show migration status
  cli
    .command('migrate:status', 'Show current migration status')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const config = await getConfig()
        const stateStore = new InMemoryMigrationStateStore()

        const status = await getMigrationStatus(stateStore, config)

        if (options.json) {
          console.log(JSON.stringify({
            currentVersion: status.currentVersion,
            appliedAt: status.appliedAt,
            entityTypes: status.entityTypes,
            gsiCount: status.gsiCount,
            lsiCount: status.lsiCount,
            pendingChanges: status.pendingChanges,
            pendingChangeCount: status.pendingChangeCount,
            hasBreakingChanges: status.hasBreakingChanges,
          }, null, 2))
        }
        else {
          console.log('Migration Status')
          console.log('================')
          console.log(`Current Version: ${status.currentVersion ?? 'No migrations applied'}`)
          console.log(`Applied At: ${status.appliedAt ?? 'N/A'}`)
          console.log(`Entity Types: ${status.entityTypes.length}`)
          console.log(`GSI Count: ${status.gsiCount}`)
          console.log(`LSI Count: ${status.lsiCount}`)
          console.log('')
          console.log(`Pending Changes: ${status.pendingChanges ? 'Yes' : 'No'}`)
          if (status.pendingChanges) {
            console.log(`  Change Count: ${status.pendingChangeCount}`)
            console.log(`  Breaking Changes: ${status.hasBreakingChanges ? 'Yes' : 'No'}`)
          }
        }
      }
      catch (error) {
        handleError(error)
      }
    })

  // migrate:rollback - Rollback last migration
  cli
    .command('migrate:rollback', 'Rollback the last migration')
    .option('--step <n>', 'Number of migrations to rollback', { default: 1 })
    .option('--force', 'Skip confirmation prompts')
    .action(async (options: { step: number, force?: boolean }) => {
      try {
        console.log(`Rolling back ${options.step} migration(s)...`)
        console.log('\nNote: DynamoDB schema changes are not easily reversible.')
        console.log('Rollback support is limited. Consider these alternatives:')
        console.log('  1. Create a new migration that reverts the changes')
        console.log('  2. Recreate the table with the desired schema')
        console.log('  3. For GSI changes, delete and recreate the GSI')
      }
      catch (error) {
        handleError(error)
      }
    })

  // migrate:fresh - Drop all tables and re-migrate
  cli
    .command('migrate:fresh', 'Drop all tables and re-run all migrations')
    .option('--seed', 'Run seeders after migrating')
    .option('--force', 'Skip confirmation prompts')
    .action(async (options: { seed?: boolean, force?: boolean }) => {
      try {
        if (!options.force) {
          console.log('WARNING: This will DELETE ALL DATA and recreate the table!')
          console.log('Use --force to proceed.')
          return
        }

        console.log('Dropping and recreating table...')
        console.log('\nNote: Implement DynamoDB client integration to:')
        console.log('  1. Delete existing table')
        console.log('  2. Wait for deletion')
        console.log('  3. Create new table with current schema')
        console.log('  4. Wait for table to become active')

        if (options.seed) {
          console.log('  5. Run seeders')
        }
      }
      catch (error) {
        handleError(error)
      }
    })

  // migrate:generate - Generate schema from models
  cli
    .command('migrate:generate', 'Generate migration schema from Stacks models')
    .option('--output <path>', 'Output file path')
    .option('--format <format>', 'Output format (json, summary)', { default: 'summary' })
    .action(async (options: { output?: string, format: string }) => {
      try {
        const config = await getConfig()
        const schema = await generateSchema(config)

        let output: string
        if (options.format === 'json') {
          output = JSON.stringify(schema.createTableInput, null, 2)
        }
        else {
          output = formatSchemaSummary(schema)
        }

        if (options.output) {
          const fs = await import('node:fs/promises')
          await fs.writeFile(options.output, output)
          console.log(`Schema written to ${options.output}`)
        }
        else {
          console.log(output)
        }
      }
      catch (error) {
        handleError(error)
      }
    })
}
