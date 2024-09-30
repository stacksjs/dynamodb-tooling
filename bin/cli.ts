import { log } from '@stacksjs/logging'
import { CAC } from 'cac'
import { version } from '../package.json'
import { config } from '../src/config'

const cli = new CAC('dbtooling')

interface Options {
  name: string
}

cli
  .command('create:table [name]', 'Create a local DynamoDB Table')
  .usage('dbtooling create:table <name> [options]')
  .example('dbtooling create:table MyOfflineTable')
  .action(async (name: string, options?: Options) => {
    name = name ?? config?.defaultTableName

    log.info(`Creating a local DynamoDB Table for: ${name}`)
    log.debug('Options:', options)
    log.success('Table created')
  })

cli.version(version)
cli.help()
cli.parse()
