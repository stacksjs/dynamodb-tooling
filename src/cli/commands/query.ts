// ============================================================================
// Query CLI Commands
// ============================================================================

import type { CAC } from 'cac'
import { getConfig } from '../../config'
import { handleError } from '../utils'

/**
 * Register query commands
 */
export function registerQueryCommands(cli: CAC): void {
  // query - Interactive query
  cli
    .command('query [table]', 'Query a DynamoDB table')
    .option('--pk <value>', 'Partition key value')
    .option('--sk <value>', 'Sort key value (exact match)')
    .option('--sk-begins <prefix>', 'Sort key begins with prefix')
    .option('--index <name>', 'Use a specific GSI/LSI')
    .option('--limit <n>', 'Limit number of results')
    .option('--json', 'Output as JSON')
    .action(async (table: string | undefined, options: {
      pk?: string
      sk?: string
      skBegins?: string
      index?: string
      limit?: number
      json?: boolean
    }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        console.log(`Querying table: ${tableName}`)

        if (!options.pk) {
          console.log('\nError: --pk is required for Query operations')
          console.log('Use `dbtooling scan` for operations without a partition key')
          return
        }

        console.log('\nQuery parameters:')
        console.log(`  Partition Key: ${options.pk}`)
        if (options.sk) {
          console.log(`  Sort Key: ${options.sk}`)
        }
        if (options.skBegins) {
          console.log(`  Sort Key begins with: ${options.skBegins}`)
        }
        if (options.index) {
          console.log(`  Using index: ${options.index}`)
        }
        if (options.limit) {
          console.log(`  Limit: ${options.limit}`)
        }

        console.log('\nNote: Implement DynamoDB client integration to execute the query.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // scan - Scan a table
  cli
    .command('scan [table]', 'Scan a DynamoDB table')
    .option('--filter <expression>', 'Filter expression')
    .option('--limit <n>', 'Limit number of results')
    .option('--entity-type <type>', 'Filter by entity type')
    .option('--json', 'Output as JSON')
    .action(async (table: string | undefined, options: {
      filter?: string
      limit?: number
      entityType?: string
      json?: boolean
    }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        console.log(`Scanning table: ${tableName}`)
        console.log('\nWARNING: Scan operations read every item in the table.')
        console.log('Consider using Query with a partition key for better performance.\n')

        console.log('Scan parameters:')
        if (options.filter) {
          console.log(`  Filter: ${options.filter}`)
        }
        if (options.limit) {
          console.log(`  Limit: ${options.limit}`)
        }
        if (options.entityType) {
          console.log(`  Entity Type: ${options.entityType}`)
        }

        console.log('\nNote: Implement DynamoDB client integration to execute the scan.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // get - Get a single item
  cli
    .command('get [table]', 'Get a single item from DynamoDB')
    .option('--pk <value>', 'Partition key value (required)')
    .option('--sk <value>', 'Sort key value (required)')
    .option('--consistent', 'Use consistent read')
    .option('--json', 'Output as JSON')
    .action(async (table: string | undefined, options: {
      pk?: string
      sk?: string
      consistent?: boolean
      json?: boolean
    }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        if (!options.pk || !options.sk) {
          console.log('Error: Both --pk and --sk are required for GetItem')
          return
        }

        console.log(`Getting item from: ${tableName}`)
        console.log(`  PK: ${options.pk}`)
        console.log(`  SK: ${options.sk}`)
        if (options.consistent) {
          console.log(`  Consistent Read: true`)
        }

        console.log('\nNote: Implement DynamoDB client integration to get the item.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // put - Put an item
  cli
    .command('put [table]', 'Put an item into DynamoDB')
    .option('--item <json>', 'Item as JSON string (required)')
    .option('--condition <expression>', 'Condition expression')
    .action(async (table: string | undefined, options: {
      item?: string
      condition?: string
    }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        if (!options.item) {
          console.log('Error: --item is required')
          console.log('Example: dbtooling put --item \'{"pk":"USER#1","sk":"USER#1","name":"John"}\'')
          return
        }

        let item: unknown
        try {
          item = JSON.parse(options.item)
        }
        catch {
          console.log('Error: --item must be valid JSON')
          return
        }

        console.log(`Putting item into: ${tableName}`)
        console.log('Item:', JSON.stringify(item, null, 2))
        if (options.condition) {
          console.log(`Condition: ${options.condition}`)
        }

        console.log('\nNote: Implement DynamoDB client integration to put the item.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // delete - Delete an item
  cli
    .command('delete [table]', 'Delete an item from DynamoDB')
    .option('--pk <value>', 'Partition key value (required)')
    .option('--sk <value>', 'Sort key value (required)')
    .option('--condition <expression>', 'Condition expression')
    .option('--force', 'Skip confirmation')
    .action(async (table: string | undefined, options: {
      pk?: string
      sk?: string
      condition?: string
      force?: boolean
    }) => {
      try {
        const config = await getConfig()
        const tableName = table ?? `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        if (!options.pk || !options.sk) {
          console.log('Error: Both --pk and --sk are required for DeleteItem')
          return
        }

        if (!options.force) {
          console.log('WARNING: This will permanently delete the item.')
          console.log(`  Table: ${tableName}`)
          console.log(`  PK: ${options.pk}`)
          console.log(`  SK: ${options.sk}`)
          console.log('Use --force to proceed.')
          return
        }

        console.log(`Deleting item from: ${tableName}`)
        console.log(`  PK: ${options.pk}`)
        console.log(`  SK: ${options.sk}`)
        if (options.condition) {
          console.log(`  Condition: ${options.condition}`)
        }

        console.log('\nNote: Implement DynamoDB client integration to delete the item.')
      }
      catch (error) {
        handleError(error)
      }
    })
}
