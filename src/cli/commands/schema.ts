// ============================================================================
// Schema Viewer CLI Commands
// ============================================================================
// Interactive schema visualization and exploration

import type { CAC } from 'cac'
import type { TreeNode } from '../ui'
import { getConfig } from '../../config'
import {
  exportSchemaAsJSON,
  generateSchema,
} from '../../migrations'
import { handleCommandError } from '../error-formatter'
import {
  box,
  c,
  divider,
  formatKeyValue,
  formatTable,
  formatTree,
  header,
  icons,
  info,
  newline,
  success,

  warning,
} from '../ui'

/**
 * Register schema viewer commands
 */
export function registerSchemaCommands(cli: CAC): void {
  // schema - Show schema overview
  cli
    .command('schema', 'Display table schema overview')
    .alias('schema:show')
    .option('--json', 'Output as JSON')
    .option('--detailed', 'Show detailed attribute information')
    .action(async (options: { json?: boolean, detailed?: boolean }) => {
      try {
        const config = await getConfig()
        const schema = await generateSchema(config)

        if (options.json) {
          console.log(exportSchemaAsJSON(schema))
          return
        }

        const entityCount = schema.summary.entityTypes.length

        header(
          `${icons.database} Table Schema: ${schema.createTableInput.tableName}`,
          'Single-table design schema overview',
        )

        // Table overview
        console.log(box(
          formatKeyValue({
            'Table Name': schema.createTableInput.tableName,
            'Billing Mode': schema.createTableInput.billingMode || 'PAY_PER_REQUEST',
            'Partition Key': `${config.singleTableDesign.partitionKeyName} (${c.cyan('S')})`,
            'Sort Key': `${config.singleTableDesign.sortKeyName} (${c.cyan('S')})`,
            'Entity Types': entityCount,
            'GSI Count': schema.summary.gsiCount,
            'LSI Count': schema.summary.lsiCount || 0,
          }),
          { title: 'Overview', titleColor: c.cyan },
        ))

        newline()

        // Key Schema
        console.log(c.subheader('Key Schema'))
        divider()
        const keySchema = schema.createTableInput.keySchema || []
        console.log(formatTable(
          keySchema.map((k: { attributeName: string, keyType: string }) => ({
            attribute: k.attributeName,
            type: k.keyType,
            description: k.keyType === 'HASH' ? 'Partition Key' : 'Sort Key',
          })),
          {
            columns: [
              { key: 'attribute', header: 'Attribute', width: 20 },
              { key: 'type', header: 'Key Type', width: 12 },
              { key: 'description', header: 'Description', width: 20 },
            ],
            compact: true,
          },
        ))

        newline()

        // GSIs
        const gsis = schema.createTableInput.globalSecondaryIndexes || []
        if (gsis.length > 0) {
          console.log(c.subheader(`Global Secondary Indexes (${gsis.length})`))
          divider()
          console.log(formatTable(
            gsis.map((gsi: {
              indexName: string
              keySchema: Array<{ attributeName: string, keyType: string }>
              projection: { projectionType: string }
            }) => {
              const pk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'HASH')
              const sk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'RANGE')
              return {
                name: gsi.indexName,
                pk: pk?.attributeName || '-',
                sk: sk?.attributeName || '-',
                projection: gsi.projection?.projectionType || 'ALL',
              }
            }),
            {
              columns: [
                { key: 'name', header: 'Index Name', width: 15 },
                { key: 'pk', header: 'Partition Key', width: 15 },
                { key: 'sk', header: 'Sort Key', width: 15 },
                { key: 'projection', header: 'Projection', width: 12 },
              ],
              compact: true,
            },
          ))
          newline()
        }

        // Attribute Definitions
        if (options.detailed) {
          const attrs = schema.createTableInput.attributeDefinitions || []
          console.log(c.subheader('Attribute Definitions'))
          divider()
          console.log(formatTable(
            attrs.map((a: { attributeName: string, attributeType: string }) => ({
              name: a.attributeName,
              type: formatAttributeType(a.attributeType || 'S'),
              usage: getAttributeUsage(a.attributeName || '', schema.createTableInput),
            })),
            {
              columns: [
                { key: 'name', header: 'Attribute', width: 20 },
                { key: 'type', header: 'Type', width: 10 },
                { key: 'usage', header: 'Usage', width: 30 },
              ],
              compact: true,
            },
          ))
          newline()
        }

        // Entity Types
        console.log(c.subheader(`Entity Types (${entityCount})`))
        divider()
        const entityNodes: TreeNode[] = schema.summary.entityTypes.map((entity: string) => ({
          label: entity,
          icon: icons.table,
          color: c.green,
        }))
        console.log(formatTree(entityNodes))

        newline()
        info(`Run ${c.cyan('dbtooling schema:tree')} to see the full entity hierarchy`)
        info(`Run ${c.cyan('dbtooling models:show <model>')} to see model details`)
      }
      catch (error) {
        handleCommandError(error, 'schema')
      }
    })

  // schema:tree - Show schema as tree
  cli
    .command('schema:tree', 'Display schema as a tree structure')
    .option('--depth <n>', 'Maximum depth to display', { default: 3 })
    .action(async (_options: { depth: number }) => {
      try {
        const config = await getConfig()
        const schema = await generateSchema(config)

        header(
          `${icons.database} Schema Tree: ${schema.createTableInput.tableName}`,
          'Hierarchical view of your schema',
        )

        const tableNode: TreeNode = {
          label: schema.createTableInput.tableName || 'Table',
          icon: icons.database,
          color: c.bold,
          children: [
            {
              label: 'Keys',
              icon: icons.key,
              color: c.yellow,
              children: [
                {
                  label: `${config.singleTableDesign.partitionKeyName} (Partition Key)`,
                  icon: icons.arrowRight,
                  color: c.cyan,
                },
                {
                  label: `${config.singleTableDesign.sortKeyName} (Sort Key)`,
                  icon: icons.arrowRight,
                  color: c.cyan,
                },
              ],
            },
            {
              label: `Global Secondary Indexes (${schema.summary.gsiCount})`,
              icon: icons.link,
              color: c.magenta,
              children: (schema.createTableInput.globalSecondaryIndexes || []).map((gsi: {
                indexName: string
                keySchema: Array<{ attributeName: string, keyType: string }>
              }) => {
                const pk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'HASH')
                const sk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'RANGE')
                return {
                  label: gsi.indexName || 'Unknown',
                  icon: icons.arrowRight,
                  children: [
                    { label: `PK: ${pk?.attributeName}`, color: c.dim },
                    { label: `SK: ${sk?.attributeName}`, color: c.dim },
                  ],
                }
              }),
            },
            {
              label: `Entity Types (${schema.summary.entityTypes.length})`,
              icon: icons.table,
              color: c.green,
              children: schema.summary.entityTypes.map((entity: string) => ({
                label: entity,
                icon: icons.bullet,
              })),
            },
          ],
        }

        console.log(formatTree([tableNode]))
        newline()
      }
      catch (error) {
        handleCommandError(error, 'schema:tree')
      }
    })

  // schema:gsi - Show GSI details
  cli
    .command('schema:gsi [name]', 'Display GSI details')
    .option('--json', 'Output as JSON')
    .action(async (name: string | undefined, options: { json?: boolean }) => {
      try {
        const config = await getConfig()
        const schema = await generateSchema(config)
        const gsis = schema.createTableInput.globalSecondaryIndexes || []

        if (gsis.length === 0) {
          warning('No Global Secondary Indexes defined')
          info(`GSI Count configured: ${config.singleTableDesign.gsiCount}`)
          return
        }

        if (name) {
          const gsi = gsis.find((g: { indexName: string }) => g.indexName === name)
          if (!gsi) {
            warning(`GSI '${name}' not found`)
            info(`Available GSIs: ${gsis.map((g: { indexName: string }) => g.indexName).join(', ')}`)
            return
          }

          if (options.json) {
            console.log(JSON.stringify(gsi, null, 2))
            return
          }

          header(`${icons.link} GSI: ${gsi.indexName}`)

          const pk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'HASH')
          const sk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'RANGE')

          console.log(box(
            formatKeyValue({
              'Index Name': gsi.indexName,
              'Partition Key': pk?.attributeName || '-',
              'Sort Key': sk?.attributeName || '-',
              'Projection Type': gsi.projection?.projectionType || 'ALL',
            }),
            { title: 'GSI Details' },
          ))

          if (gsi.projection?.nonKeyAttributes) {
            newline()
            console.log(c.subheader('Projected Attributes'))
            for (const attr of gsi.projection.nonKeyAttributes) {
              console.log(`  ${icons.bullet} ${attr}`)
            }
          }
        }
        else {
          if (options.json) {
            console.log(JSON.stringify(gsis, null, 2))
            return
          }

          header(`${icons.link} Global Secondary Indexes (${gsis.length})`)

          for (const gsi of gsis) {
            const pk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'HASH')
            const sk = gsi.keySchema.find((k: { keyType: string }) => k.keyType === 'RANGE')

            console.log(c.bold(gsi.indexName || 'Unknown'))
            console.log(`  ${c.dim('PK:')} ${pk?.attributeName || '-'}`)
            console.log(`  ${c.dim('SK:')} ${sk?.attributeName || '-'}`)
            console.log(`  ${c.dim('Projection:')} ${gsi.projection?.projectionType || 'ALL'}`)
            newline()
          }
        }
      }
      catch (error) {
        handleCommandError(error, 'schema:gsi')
      }
    })

  // schema:access-patterns - Show access patterns
  cli
    .command('schema:access-patterns', 'Display access patterns')
    .alias('schema:ap')
    .option('--json', 'Output as JSON')
    .option('--model <name>', 'Filter by model name')
    .action(async (options: { json?: boolean, model?: string }) => {
      try {
        const config = await getConfig()
        const schema = await generateSchema(config)

        header(`${icons.lightning} Access Patterns`)

        // Generate access pattern summary
        const patterns = generateAccessPatternSummary(schema, config)

        if (options.model) {
          const filtered = patterns.filter(p =>
            p.entity.toLowerCase() === options.model?.toLowerCase(),
          )
          if (filtered.length === 0) {
            warning(`No access patterns found for model '${options.model}'`)
            return
          }
          displayAccessPatterns(filtered, options.json)
        }
        else {
          displayAccessPatterns(patterns, options.json)
        }
      }
      catch (error) {
        handleCommandError(error, 'schema:access-patterns')
      }
    })

  // schema:validate - Validate schema
  cli
    .command('schema:validate', 'Validate the schema configuration')
    .action(async () => {
      try {
        const config = await getConfig()
        const schema = await generateSchema(config)

        header(`${icons.check} Schema Validation`)

        const issues: { level: 'error' | 'warning' | 'info', message: string }[] = []

        // Check GSI count
        const gsiCount = (schema.createTableInput.globalSecondaryIndexes || []).length
        if (gsiCount > 20) {
          issues.push({ level: 'error', message: `GSI count (${gsiCount}) exceeds DynamoDB limit of 20` })
        }
        else if (gsiCount > 15) {
          issues.push({ level: 'warning', message: `High GSI count (${gsiCount}/20). Consider consolidating indexes.` })
        }

        // Check LSI count
        const lsiCount = (schema.createTableInput.localSecondaryIndexes || []).length
        if (lsiCount > 5) {
          issues.push({ level: 'error', message: `LSI count (${lsiCount}) exceeds DynamoDB limit of 5` })
        }

        // Check entity count
        const entityCount = schema.summary.entityTypes.length
        if (entityCount > 50) {
          issues.push({ level: 'warning', message: `Large number of entity types (${entityCount}). Consider splitting tables.` })
        }

        // Check for missing GSIs
        if (gsiCount < config.singleTableDesign.gsiCount) {
          issues.push({ level: 'info', message: `Only ${gsiCount} of ${config.singleTableDesign.gsiCount} configured GSIs are in use` })
        }

        // Display results
        if (issues.length === 0) {
          success('Schema validation passed! No issues found.')
        }
        else {
          const errors = issues.filter(i => i.level === 'error')
          const warnings = issues.filter(i => i.level === 'warning')
          const infos = issues.filter(i => i.level === 'info')

          if (errors.length > 0) {
            console.log(c.red(`${icons.error} Errors (${errors.length}):`))
            errors.forEach(e => console.log(`  ${c.red(icons.cross)} ${e.message}`))
            newline()
          }

          if (warnings.length > 0) {
            console.log(c.yellow(`${icons.warning} Warnings (${warnings.length}):`))
            warnings.forEach(w => console.log(`  ${c.yellow(icons.warning)} ${w.message}`))
            newline()
          }

          if (infos.length > 0) {
            console.log(c.blue(`${icons.info} Info (${infos.length}):`))
            infos.forEach(i => console.log(`  ${c.blue(icons.info)} ${i.message}`))
            newline()
          }

          if (errors.length > 0) {
            console.log(c.red('Schema validation failed. Please fix errors before proceeding.'))
          }
          else {
            success('Schema validation passed with warnings.')
          }
        }
      }
      catch (error) {
        handleCommandError(error, 'schema:validate')
      }
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatAttributeType(type: string): string {
  const types: Record<string, string> = {
    S: `${c.cyan('S')} (String)`,
    N: `${c.green('N')} (Number)`,
    B: `${c.yellow('B')} (Binary)`,
    BOOL: `${c.magenta('BOOL')} (Boolean)`,
    L: `${c.blue('L')} (List)`,
    M: `${c.red('M')} (Map)`,
    SS: `${c.cyan('SS')} (String Set)`,
    NS: `${c.green('NS')} (Number Set)`,
    BS: `${c.yellow('BS')} (Binary Set)`,
  }
  return types[type] || type
}

function getAttributeUsage(attrName: string, createTableInput: {
  keySchema: Array<{ attributeName: string }>
  globalSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{ attributeName: string }>
  }>
}): string {
  const usages: string[] = []

  // Check if it's a table key
  const tableKey = createTableInput.keySchema.find(k => k.attributeName === attrName)
  if (tableKey) {
    usages.push('Table Key')
  }

  // Check GSI usage
  const gsis = createTableInput.globalSecondaryIndexes || []
  for (const gsi of gsis) {
    if (gsi.keySchema.some(k => k.attributeName === attrName)) {
      usages.push(`GSI: ${gsi.indexName}`)
    }
  }

  return usages.length > 0 ? usages.join(', ') : 'Data attribute'
}

interface AccessPatternInfo {
  entity: string
  pattern: string
  index: string
  pk: string
  sk: string
  operation: string
}

function generateAccessPatternSummary(
  schema: { summary: { entityTypes: string[] } },
  _config: { singleTableDesign: { partitionKeyName: string, sortKeyName: string } },
): AccessPatternInfo[] {
  const patterns: AccessPatternInfo[] = []

  for (const entity of schema.summary.entityTypes) {
    // Get by ID
    patterns.push({
      entity,
      pattern: `Get ${entity} by ID`,
      index: 'Table',
      pk: `${entity.toUpperCase()}#<id>`,
      sk: `${entity.toUpperCase()}#<id>`,
      operation: 'GetItem',
    })

    // List all
    patterns.push({
      entity,
      pattern: `List all ${entity}`,
      index: 'Table',
      pk: `${entity.toUpperCase()}#<id>`,
      sk: 'begins_with',
      operation: 'Query',
    })
  }

  return patterns
}

function displayAccessPatterns(patterns: AccessPatternInfo[], asJson?: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(patterns, null, 2))
    return
  }

  const tableData = patterns.map(p => ({
    entity: p.entity,
    pattern: p.pattern,
    index: p.index,
    operation: p.operation,
  }))

  console.log(formatTable(
    tableData as unknown as Record<string, unknown>[],
    {
      columns: [
        { key: 'entity', header: 'Entity', width: 15 },
        { key: 'pattern', header: 'Pattern', width: 25 },
        { key: 'index', header: 'Index', width: 10 },
        { key: 'operation', header: 'Operation', width: 10 },
      ],
      compact: true,
    },
  ))
}
