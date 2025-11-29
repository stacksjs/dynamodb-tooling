// ============================================================================
// Seeder CLI Commands
// ============================================================================

import type { CAC } from 'cac'
import { getConfig } from '../../config'
import { handleError } from '../utils'

/**
 * Register seeder commands
 */
export function registerSeedCommands(cli: CAC): void {
  // seed - Run seeders
  cli
    .command('seed', 'Run database seeders')
    .option('--class <name>', 'Run only a specific seeder class')
    .option('--path <path>', 'Path to seeders directory')
    .option('--dry-run', 'Preview what would be seeded without persisting')
    .option('--verbose', 'Show detailed output')
    .action(async (options: {
      class?: string
      path?: string
      dryRun?: boolean
      verbose?: boolean
    }) => {
      try {
        const config = await getConfig()
        const seedersPath = options.path ?? config.queryBuilder.modelsPath?.replace('/models', '/seeders') ?? './seeders'

        console.log('Running seeders...')
        console.log('')

        if (options.dryRun) {
          console.log('[DRY RUN] No data will be persisted.')
          console.log('')
        }

        console.log(`Seeders path: ${seedersPath}`)

        if (options.class) {
          console.log(`Running only: ${options.class}`)
        }

        console.log('')
        console.log('Note: To run seeders, integrate with a DynamoDB client.')
        console.log('')
        console.log('Example seeder:')
        console.log('```typescript')
        console.log('// seeders/UserSeeder.ts')
        console.log('import { Seeder, SeederContext } from \'dynamodb-tooling\'')
        console.log('')
        console.log('export class UserSeeder extends Seeder {')
        console.log('  static order = 1')
        console.log('')
        console.log('  async run(ctx: SeederContext): Promise<void> {')
        console.log('    await ctx.factory(\'USER\', {')
        console.log('      attributes: () => ({')
        console.log('        id: crypto.randomUUID(),')
        console.log('        name: \'Test User\',')
        console.log('        email: `user${Date.now()}@example.com`,')
        console.log('      })')
        console.log('    }).count(10).create()')
        console.log('  }')
        console.log('}')
        console.log('```')
      }
      catch (error) {
        handleError(error)
      }
    })

  // make:seeder - Generate a seeder file
  cli
    .command('make:seeder <name>', 'Generate a new seeder file')
    .option('--path <path>', 'Output directory for the seeder')
    .action(async (name: string, options: { path?: string }) => {
      try {
        const config = await getConfig()
        const outputPath = options.path ?? config.queryBuilder.modelsPath?.replace('/models', '/seeders') ?? './seeders'

        const fs = await import('node:fs/promises')
        const path = await import('node:path')

        // Ensure directory exists
        await fs.mkdir(outputPath, { recursive: true })

        // Format seeder name
        const seederName = name.endsWith('Seeder') ? name : `${name}Seeder`
        const fileName = `${seederName}.ts`
        const filePath = path.join(outputPath, fileName)

        // Check if file exists
        try {
          await fs.access(filePath)
          console.log(`Error: Seeder '${fileName}' already exists at ${filePath}`)
          return
        }
        catch {
          // File doesn't exist, we can create it
        }

        // Generate seeder content
        const entityName = name.replace(/Seeder$/, '')
        const entityType = entityName.toUpperCase()

        const content = `// ============================================================================
// ${seederName}
// ============================================================================

import type { SeederContext } from 'dynamodb-tooling'
import { Seeder } from 'dynamodb-tooling'

/**
 * ${seederName}
 *
 * Seeds ${entityName} data into the database.
 */
export class ${seederName} extends Seeder {
  /**
   * Execution order (lower runs first)
   */
  static order = 10

  /**
   * Description of this seeder
   */
  static description = 'Seeds ${entityName} data'

  /**
   * Run the seeder
   */
  async run(ctx: SeederContext): Promise<void> {
    // Create ${entityName} items using the factory helper
    await ctx.factory('${entityType}', {
      attributes: () => ({
        id: crypto.randomUUID(),
        name: 'Test ${entityName}',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    })
      .count(10)
      .create()

    console.log('  Created 10 ${entityName} items')
  }
}
`

        await fs.writeFile(filePath, content, 'utf-8')

        console.log(`Seeder created: ${filePath}`)
        console.log('')
        console.log('Next steps:')
        console.log(`  1. Edit ${fileName} to customize the seeder`)
        console.log('  2. Run: dbtooling seed')
      }
      catch (error) {
        handleError(error)
      }
    })

  // db:fresh - Drop, migrate, and seed
  cli
    .command('db:fresh', 'Drop all tables, re-migrate, and seed')
    .option('--seed', 'Run seeders after migrating', { default: true })
    .option('--force', 'Skip confirmation prompts')
    .action(async (options: { seed: boolean, force?: boolean }) => {
      try {
        if (!options.force) {
          console.log('WARNING: This will DELETE ALL DATA and recreate the table!')
          console.log('Use --force to proceed.')
          return
        }

        const config = await getConfig()
        const tableName = `${config.tableNamePrefix}${config.defaultTableName}${config.tableNameSuffix}`

        console.log('Running db:fresh...')
        console.log('')

        console.log('Step 1: Delete existing table')
        console.log(`  Table: ${tableName}`)
        console.log('')

        console.log('Step 2: Wait for deletion')
        console.log('')

        console.log('Step 3: Create new table with current schema')
        console.log('')

        console.log('Step 4: Wait for table to become ACTIVE')
        console.log('')

        if (options.seed) {
          console.log('Step 5: Run seeders')
          console.log('')
        }

        console.log('Note: Implement DynamoDB client integration to execute these steps.')
        console.log('The migration system already handles schema generation.')
      }
      catch (error) {
        handleError(error)
      }
    })

  // make:factory - Generate a factory file
  cli
    .command('make:factory <name>', 'Generate a new factory file')
    .option('--path <path>', 'Output directory for the factory')
    .action(async (name: string, options: { path?: string }) => {
      try {
        const config = await getConfig()
        const outputPath = options.path ?? config.queryBuilder.modelsPath?.replace('/models', '/factories') ?? './factories'

        const fs = await import('node:fs/promises')
        const path = await import('node:path')

        // Ensure directory exists
        await fs.mkdir(outputPath, { recursive: true })

        // Format factory name
        const factoryName = name.endsWith('Factory') ? name : `${name}Factory`
        const fileName = `${factoryName}.ts`
        const filePath = path.join(outputPath, fileName)

        // Check if file exists
        try {
          await fs.access(filePath)
          console.log(`Error: Factory '${fileName}' already exists at ${filePath}`)
          return
        }
        catch {
          // File doesn't exist, we can create it
        }

        // Generate factory content
        const entityName = name.replace(/Factory$/, '')
        const entityType = entityName.toUpperCase()

        const content = `// ============================================================================
// ${factoryName}
// ============================================================================

import { Factory, uniqueEmail, randomInt } from 'dynamodb-tooling'

/**
 * ${factoryName}
 *
 * Defines how to generate fake ${entityName} data for testing.
 */
Factory.define('${entityName}', {
  entityType: '${entityType}',

  /**
   * Default attributes for a ${entityName}
   */
  definition: () => ({
    id: crypto.randomUUID(),
    name: 'Test ${entityName}',
    email: uniqueEmail(),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  /**
   * Named states for variations
   */
  states: {
    /**
     * An inactive ${entityName.toLowerCase()}
     */
    inactive: {
      status: 'inactive',
    },

    /**
     * A verified ${entityName.toLowerCase()}
     */
    verified: () => ({
      emailVerifiedAt: new Date().toISOString(),
    }),

    /**
     * An admin ${entityName.toLowerCase()}
     */
    admin: {
      role: 'admin',
    },
  },

  /**
   * Lifecycle hooks
   */
  hooks: {
    afterMaking: (item) => {
      // Modify item after it's made but before it's saved
      return item
    },
    afterCreating: async (item) => {
      // Run after item is saved to database
      return item
    },
  },
})

/**
 * Usage examples:
 *
 * // Create 5 users
 * const users = await Factory.for('${entityName}').count(5).create()
 *
 * // Create an admin user
 * const admin = await Factory.for('${entityName}').state('admin').createOne()
 *
 * // Create with specific attributes
 * const user = await Factory.for('${entityName}')
 *   .override({ name: 'John Doe' })
 *   .createOne()
 *
 * // Make without persisting
 * const fakeUsers = Factory.for('${entityName}').count(10).make()
 */
`

        await fs.writeFile(filePath, content, 'utf-8')

        console.log(`Factory created: ${filePath}`)
        console.log('')
        console.log('Next steps:')
        console.log(`  1. Edit ${fileName} to customize the factory`)
        console.log('  2. Import the factory in your seeders or tests')
        console.log(`  3. Use: Factory.for('${entityName}').count(5).create()`)
      }
      catch (error) {
        handleError(error)
      }
    })
}
