// ============================================================================
// Migration CLI Commands
// ============================================================================

import type { CAC } from 'cac'
import { getConfig } from '../../config'
import {
  formatSchemaSummary,
  generateSchema,
  getMigrationStatus,
  InMemoryMigrationStateStore,
  previewMigration,
} from '../../migrations'
import { handleCommandError } from '../error-formatter'
import {
  box,
  c,
  createSpinner,
  divider,
  formatKeyValue,
  header,
  icons,
  info,
  newline,
  step,
  success,
  warning,
} from '../ui'

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

        const spinner = createSpinner('Analyzing models and generating migration plan...')
        spinner.start()

        const preview = await previewMigration(stateStore, config)

        if (!preview.diff.hasChanges) {
          spinner.succeed('No changes detected. Database is up to date.')
          return
        }

        spinner.stop()

        header(`${icons.rocket} Migration Preview`, 'The following changes will be applied')

        // Display changes in a visual format
        displayMigrationPreview(preview.diff, options.verbose)

        if (options.dryRun) {
          newline()
          console.log(box(
            [
              `${c.cyan(icons.info)} This is a dry run preview.`,
              '',
              'No changes have been applied to your database.',
              '',
              `Run ${c.cyan('dbtooling migrate')} without --dry-run to apply changes.`,
            ].join('\n'),
            { title: 'DRY RUN', titleColor: c.cyan, borderColor: c.cyan },
          ))
          return
        }

        if (preview.diff.hasBreakingChanges && !options.force) {
          newline()
          console.log(box(
            [
              `${c.red(icons.warning)} This migration contains BREAKING CHANGES!`,
              '',
              'Breaking changes may cause data loss or application errors.',
              'Please review the changes above carefully.',
              '',
              `Use ${c.yellow('--force')} to proceed anyway.`,
            ].join('\n'),
            { title: 'WARNING', titleColor: c.red, borderColor: c.red },
          ))
          return
        }

        newline()
        info('To execute migrations, integrate with a DynamoDB client.')
        info('Use the migration plan above to apply changes.')
      }
      catch (error) {
        handleCommandError(error, 'migrate')
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
          header(`${icons.database} Migration Status`)

          console.log(box(
            formatKeyValue({
              'Current Version': status.currentVersion ?? c.dim('No migrations applied'),
              'Applied At': status.appliedAt ?? c.dim('N/A'),
              'Entity Types': status.entityTypes.length,
              'GSI Count': status.gsiCount,
              'LSI Count': status.lsiCount,
            }),
            { title: 'Schema State' },
          ))

          newline()

          if (status.pendingChanges) {
            console.log(box(
              formatKeyValue({
                'Pending Changes': c.yellow('Yes'),
                'Change Count': status.pendingChangeCount,
                'Breaking Changes': status.hasBreakingChanges ? c.red('Yes') : c.green('No'),
              }),
              { title: 'Pending', titleColor: c.yellow, borderColor: c.yellow },
            ))

            newline()
            info(`Run ${c.cyan('dbtooling migrate --dry-run')} to preview changes`)
          }
          else {
            success('Database is up to date. No pending changes.')
          }
        }
      }
      catch (error) {
        handleCommandError(error, 'migrate:status')
      }
    })

  // migrate:rollback - Rollback last migration
  cli
    .command('migrate:rollback', 'Rollback the last migration')
    .option('--step <n>', 'Number of migrations to rollback', { default: 1 })
    .option('--force', 'Skip confirmation prompts')
    .action(async (options: { step: number, force?: boolean }) => {
      try {
        header(`${icons.warning} Migration Rollback`)

        warning(`Rolling back ${options.step} migration(s)...`)

        newline()
        console.log(box(
          [
            `${c.yellow(icons.warning)} DynamoDB schema changes are not easily reversible.`,
            '',
            'Rollback support is limited. Consider these alternatives:',
            '',
            `  ${icons.bullet} Create a new migration that reverts the changes`,
            `  ${icons.bullet} Recreate the table with the desired schema`,
            `  ${icons.bullet} For GSI changes, delete and recreate the GSI`,
          ].join('\n'),
          { title: 'Important', titleColor: c.yellow, borderColor: c.yellow },
        ))
      }
      catch (error) {
        handleCommandError(error, 'migrate:rollback')
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
          newline()
          console.log(box(
            [
              `${c.red(icons.error)} DANGER ZONE`,
              '',
              'This command will:',
              `  ${c.red('1.')} ${c.red('DELETE ALL DATA')} in the table`,
              `  ${c.dim('2.')} Wait for table deletion`,
              `  ${c.green('3.')} Create a new table with current schema`,
              `  ${c.dim('4.')} Wait for table to become active`,
              ...(options.seed ? [`  ${c.cyan('5.')} Run seeders`] : []),
              '',
              `Use ${c.yellow('--force')} to proceed.`,
            ].join('\n'),
            { title: 'WARNING', titleColor: c.red, borderColor: c.red },
          ))
          return
        }

        const spinner = createSpinner('Dropping and recreating table...')
        spinner.start()

        // Steps would go here
        step(1, 4, 'Deleting existing table...')
        step(2, 4, 'Waiting for deletion...')
        step(3, 4, 'Creating new table with current schema...')
        step(4, 4, 'Waiting for table to become active...')

        if (options.seed) {
          step(5, 5, 'Running seeders...')
        }

        spinner.stop()
        info('Note: Implement DynamoDB client integration to execute these steps.')
      }
      catch (error) {
        handleCommandError(error, 'migrate:fresh')
      }
    })

  // migrate:generate - Generate schema from models
  cli
    .command('migrate:generate', 'Generate migration schema from Stacks models')
    .option('--output <path>', 'Output file path')
    .option('--format <format>', 'Output format (json, summary)', { default: 'summary' })
    .action(async (options: { output?: string, format: string }) => {
      try {
        const spinner = createSpinner('Generating schema from models...')
        spinner.start()

        const config = await getConfig()
        const schema = await generateSchema(config)

        spinner.stop()

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
          success(`Schema written to ${c.cyan(options.output)}`)
        }
        else {
          console.log(output)
        }
      }
      catch (error) {
        handleCommandError(error, 'migrate:generate')
      }
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

interface SchemaDiff {
  hasChanges: boolean
  hasBreakingChanges: boolean
  changes: Array<{
    type: string
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
    description: string
    details?: string
  }>
}

function displayMigrationPreview(diff: SchemaDiff, verbose?: boolean): void {
  // Group changes by severity
  const critical = diff.changes.filter(c => c.severity === 'critical')
  const high = diff.changes.filter(c => c.severity === 'high')
  const medium = diff.changes.filter(c => c.severity === 'medium')
  const low = diff.changes.filter(c => c.severity === 'low')
  const infoChanges = diff.changes.filter(c => c.severity === 'info')

  // Summary
  console.log(box(
    formatKeyValue({
      'Total Changes': diff.changes.length,
      'Breaking Changes': diff.hasBreakingChanges ? c.red('Yes') : c.green('No'),
      'Critical': critical.length > 0 ? c.red(String(critical.length)) : c.dim('0'),
      'High': high.length > 0 ? c.red(String(high.length)) : c.dim('0'),
      'Medium': medium.length > 0 ? c.yellow(String(medium.length)) : c.dim('0'),
      'Low': low.length > 0 ? c.blue(String(low.length)) : c.dim('0'),
      'Info': infoChanges.length > 0 ? c.dim(String(infoChanges.length)) : c.dim('0'),
    }),
    { title: 'Change Summary' },
  ))

  newline()

  // Display changes by severity
  if (critical.length > 0) {
    console.log(c.bold(c.red(`${icons.error} Critical Changes (${critical.length})`)))
    divider()
    for (const change of critical) {
      console.log(`  ${c.red(icons.cross)} ${change.description}`)
      if (verbose && change.details) {
        console.log(`    ${c.dim(change.details)}`)
      }
    }
    newline()
  }

  if (high.length > 0) {
    console.log(c.bold(c.red(`${icons.warning} High Severity (${high.length})`)))
    divider()
    for (const change of high) {
      console.log(`  ${c.red(icons.warning)} ${change.description}`)
      if (verbose && change.details) {
        console.log(`    ${c.dim(change.details)}`)
      }
    }
    newline()
  }

  if (medium.length > 0) {
    console.log(c.bold(c.yellow(`${icons.warning} Medium Severity (${medium.length})`)))
    divider()
    for (const change of medium) {
      console.log(`  ${c.yellow(icons.bullet)} ${change.description}`)
      if (verbose && change.details) {
        console.log(`    ${c.dim(change.details)}`)
      }
    }
    newline()
  }

  if ((low.length > 0 || infoChanges.length > 0) && verbose) {
    console.log(c.bold(c.blue(`${icons.info} Low/Info (${low.length + infoChanges.length})`)))
    divider()
    for (const change of [...low, ...infoChanges]) {
      console.log(`  ${c.dim(icons.bullet)} ${change.description}`)
    }
    newline()
  }
  else if (low.length > 0 || infoChanges.length > 0) {
    info(`${low.length + infoChanges.length} low severity changes (use --verbose to see)`)
    newline()
  }
}
