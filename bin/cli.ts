#!/usr/bin/env bun
// ============================================================================
// DynamoDB Tooling CLI
// ============================================================================

import nodeProcess from 'node:process'
import { CAC } from 'cac'
import { version } from '../package.json'
import {
  registerLocalCommands,
  registerMigrateCommands,
  registerQueryCommands,
  registerTableCommands,
  registerUtilityCommands,
} from '../src/cli/commands'

const cli = new CAC('dbtooling')

// Register all command modules
registerTableCommands(cli)
registerMigrateCommands(cli)
registerQueryCommands(cli)
registerUtilityCommands(cli)
registerLocalCommands(cli)

// config - Show current configuration
cli
  .command('config', 'Show current configuration')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const { getConfig } = await import('../src/config')
      const config = await getConfig()

      if (options.json) {
        console.log(JSON.stringify(config, null, 2))
      }
      else {
        console.log('DynamoDB Tooling Configuration')
        console.log('==============================')
        console.log(`Default Table: ${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`)
        console.log(`Region: ${config.region}`)
        console.log(`Billing Mode: ${config.capacity.billingMode}`)
        console.log(`Local Port: ${config.local.port}`)
        console.log('')
        console.log('Single Table Design:')
        console.log(`  Partition Key: ${config.singleTableDesign.partitionKeyName}`)
        console.log(`  Sort Key: ${config.singleTableDesign.sortKeyName}`)
        console.log(`  GSI Count: ${config.singleTableDesign.gsiCount}`)
      }
    }
    catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      nodeProcess.exit(1)
    }
  })

// version - Show version info
cli
  .command('version', 'Show version information')
  .action(() => {
    console.log(`dbtooling v${version}`)
    console.log('DynamoDB Tooling for Stacks')
  })

cli.version(version)
cli.help()
cli.parse()
