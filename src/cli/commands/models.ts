// ============================================================================
// Models Viewer CLI Commands
// ============================================================================
// View and explore Stacks model definitions

import type { CAC } from 'cac'
import { getConfig } from '../../config'
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
  type TreeNode,
  warning,
} from '../ui'

// Types for parsed models
interface ParsedAttribute {
  name: string
  type: string
  required?: boolean
  default?: unknown
  unique?: boolean
  index?: boolean
}

interface ParsedRelationship {
  name: string
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'
  model: string
  foreignKey?: string
  localKey?: string
}

interface ParsedModel {
  name: string
  tableName?: string
  attributes: ParsedAttribute[]
  relationships: ParsedRelationship[]
  traits: string[]
  primaryKey?: string
  timestamps?: boolean
  softDeletes?: boolean
}

/**
 * Register models viewer commands
 */
export function registerModelsCommands(cli: CAC): void {
  // models - List all models
  cli
    .command('models', 'List all Stacks models')
    .alias('models:list')
    .option('--json', 'Output as JSON')
    .option('--detailed', 'Show detailed model information')
    .action(async (options: { json?: boolean, detailed?: boolean }) => {
      try {
        const config = await getConfig()

        header(
          `${icons.table} Stacks Models`,
          `Models directory: ${config.queryBuilder.modelsPath}`,
        )

        // Try to load models (mock for now since model parser is async)
        const models = await loadModels()

        if (models.length === 0) {
          warning('No models found')
          info(`Configure your models path in dynamodb.config.ts`)
          info(`Expected path: ${config.queryBuilder.modelsPath}`)
          return
        }

        if (options.json) {
          console.log(JSON.stringify(models, null, 2))
          return
        }

        if (options.detailed) {
          for (const model of models) {
            displayModelDetails(model)
            newline()
          }
        }
        else {
          console.log(formatTable(
            models.map(m => ({
              name: m.name,
              attributes: m.attributes.length,
              relationships: m.relationships.length,
              traits: m.traits.join(', ') || '-',
            })),
            {
              columns: [
                { key: 'name', header: 'Model', width: 20, format: v => c.green(String(v)) },
                { key: 'attributes', header: 'Attrs', width: 8, align: 'right' },
                { key: 'relationships', header: 'Rels', width: 8, align: 'right' },
                { key: 'traits', header: 'Traits', width: 30 },
              ],
              compact: true,
            },
          ))

          newline()
          info(`Found ${c.bold(String(models.length))} models`)
          info(`Run ${c.cyan('dbtooling models:show <name>')} for details`)
        }

      }
      catch (error) {
        handleCommandError(error, 'models')
      }
    })

  // models:show - Show model details
  cli
    .command('models:show <name>', 'Show details for a specific model')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options: { json?: boolean }) => {
      try {
        const config = await getConfig()
        const models = await loadModels()

        const model = models.find(m =>
          m.name.toLowerCase() === name.toLowerCase(),
        )

        if (!model) {
          warning(`Model '${name}' not found`)
          const similar = models.filter(m =>
            m.name.toLowerCase().includes(name.toLowerCase()),
          )
          if (similar.length > 0) {
            info(`Did you mean: ${similar.map(m => c.cyan(m.name)).join(', ')}?`)
          }
          info(`Available models: ${models.map(m => m.name).join(', ')}`)
          return
        }

        if (options.json) {
          console.log(JSON.stringify(model, null, 2))
          return
        }

        displayModelDetails(model)

      }
      catch (error) {
        handleCommandError(error, 'models:show')
      }
    })

  // models:tree - Show models as tree
  cli
    .command('models:tree', 'Display models as a relationship tree')
    .option('--model <name>', 'Start from a specific model')
    .action(async (options: { model?: string }) => {
      try {
        const config = await getConfig()
        const models = await loadModels()

        header(
          `${icons.table} Model Relationships`,
          'Hierarchical view of model relationships',
        )

        if (models.length === 0) {
          warning('No models found')
          return
        }

        if (options.model) {
          const rootModel = models.find(m =>
            m.name.toLowerCase() === options.model?.toLowerCase(),
          )
          if (!rootModel) {
            warning(`Model '${options.model}' not found`)
            return
          }
          const tree = buildModelTree(rootModel, models, new Set())
          console.log(formatTree([tree]))
        }
        else {
          // Show all models with their relationships
          const trees = models.map(m => buildModelTree(m, models, new Set(), 1))
          console.log(formatTree(trees))
        }

        newline()

      }
      catch (error) {
        handleCommandError(error, 'models:tree')
      }
    })

  // models:attributes - List attributes for a model
  cli
    .command('models:attributes <name>', 'List attributes for a model')
    .alias('models:attrs')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options: { json?: boolean }) => {
      try {
        const config = await getConfig()
        const models = await loadModels()

        const model = models.find(m =>
          m.name.toLowerCase() === name.toLowerCase(),
        )

        if (!model) {
          warning(`Model '${name}' not found`)
          return
        }

        if (options.json) {
          console.log(JSON.stringify(model.attributes, null, 2))
          return
        }

        header(`${icons.key} Attributes: ${model.name}`)

        console.log(formatTable(
          model.attributes.map(attr => ({
            name: attr.name,
            type: formatType(attr.type),
            required: attr.required ? c.green('Yes') : c.dim('No'),
            unique: attr.unique ? c.yellow('Yes') : c.dim('No'),
            index: attr.index ? c.cyan('Yes') : c.dim('No'),
            default: attr.default !== undefined ? String(attr.default) : c.dim('-'),
          })),
          {
            columns: [
              { key: 'name', header: 'Name', width: 20 },
              { key: 'type', header: 'Type', width: 15 },
              { key: 'required', header: 'Required', width: 10 },
              { key: 'unique', header: 'Unique', width: 8 },
              { key: 'index', header: 'Index', width: 8 },
              { key: 'default', header: 'Default', width: 15 },
            ],
            compact: true,
          },
        ))

        newline()
        info(`Total: ${model.attributes.length} attributes`)

      }
      catch (error) {
        handleCommandError(error, 'models:attributes')
      }
    })

  // models:relationships - List relationships for a model
  cli
    .command('models:relationships <name>', 'List relationships for a model')
    .alias('models:rels')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options: { json?: boolean }) => {
      try {
        const config = await getConfig()
        const models = await loadModels()

        const model = models.find(m =>
          m.name.toLowerCase() === name.toLowerCase(),
        )

        if (!model) {
          warning(`Model '${name}' not found`)
          return
        }

        if (model.relationships.length === 0) {
          info(`Model '${model.name}' has no relationships defined`)
          return
        }

        if (options.json) {
          console.log(JSON.stringify(model.relationships, null, 2))
          return
        }

        header(`${icons.link} Relationships: ${model.name}`)

        console.log(formatTable(
          model.relationships.map(rel => ({
            name: rel.name,
            type: formatRelationType(rel.type),
            model: c.green(rel.model),
            foreignKey: rel.foreignKey || c.dim('(auto)'),
            localKey: rel.localKey || c.dim('(auto)'),
          })),
          {
            columns: [
              { key: 'name', header: 'Name', width: 20 },
              { key: 'type', header: 'Type', width: 15 },
              { key: 'model', header: 'Related Model', width: 20 },
              { key: 'foreignKey', header: 'Foreign Key', width: 15 },
              { key: 'localKey', header: 'Local Key', width: 15 },
            ],
            compact: true,
          },
        ))

        newline()
        info(`Total: ${model.relationships.length} relationships`)

      }
      catch (error) {
        handleCommandError(error, 'models:relationships')
      }
    })

  // models:keys - Show key patterns for a model
  cli
    .command('models:keys <name>', 'Show DynamoDB key patterns for a model')
    .option('--json', 'Output as JSON')
    .action(async (name: string, options: { json?: boolean }) => {
      try {
        const config = await getConfig()
        const models = await loadModels()

        const model = models.find(m =>
          m.name.toLowerCase() === name.toLowerCase(),
        )

        if (!model) {
          warning(`Model '${name}' not found`)
          return
        }

        header(`${icons.key} Key Patterns: ${model.name}`)

        const entityType = model.name.toUpperCase()
        const keyPatterns = {
          'Entity Type': entityType,
          'Partition Key Pattern': `${entityType}#<${model.primaryKey || 'id'}>`,
          'Sort Key Pattern': `${entityType}#<${model.primaryKey || 'id'}>`,
        }

        // Add GSI patterns for relationships
        const gsiPatterns: Record<string, string> = {}
        let gsiIndex = 1
        for (const rel of model.relationships) {
          if (rel.type === 'belongsTo') {
            gsiPatterns[`GSI${gsiIndex} (by ${rel.model})`] = `${rel.model.toUpperCase()}#<${rel.foreignKey || rel.model.toLowerCase() + 'Id'}>`
            gsiIndex++
          }
        }

        if (options.json) {
          console.log(JSON.stringify({ ...keyPatterns, gsi: gsiPatterns }, null, 2))
          return
        }

        console.log(box(
          formatKeyValue(keyPatterns),
          { title: 'Primary Key Patterns', titleColor: c.cyan },
        ))

        if (Object.keys(gsiPatterns).length > 0) {
          newline()
          console.log(box(
            formatKeyValue(gsiPatterns),
            { title: 'GSI Key Patterns', titleColor: c.magenta },
          ))
        }

        newline()
        console.log(c.subheader('Example Keys'))
        divider()
        console.log(`  ${c.dim('pk:')} ${c.cyan(`"${entityType}#abc123"`)}`)
        console.log(`  ${c.dim('sk:')} ${c.cyan(`"${entityType}#abc123"`)}`)
        console.log(`  ${c.dim('_et:')} ${c.cyan(`"${entityType}"`)}`)

      }
      catch (error) {
        handleCommandError(error, 'models:keys')
      }
    })

  // models:generate - Generate model stub
  cli
    .command('models:generate <name>', 'Generate a new model file')
    .alias('make:model')
    .option('--attributes <attrs>', 'Comma-separated attributes (name:type)')
    .option('--relationships <rels>', 'Comma-separated relationships (name:type:model)')
    .option('--timestamps', 'Include timestamps trait', { default: true })
    .option('--soft-deletes', 'Include soft deletes trait')
    .option('--dry-run', 'Show what would be generated without creating file')
    .action(async (name: string, options: {
      attributes?: string
      relationships?: string
      timestamps?: boolean
      softDeletes?: boolean
      dryRun?: boolean
    }) => {
      try {
        const config = await getConfig()

        header(`${icons.sparkles} Generate Model: ${name}`)

        // Parse attributes
        const attributes = options.attributes
          ? options.attributes.split(',').map(attr => {
              const [attrName, type] = attr.trim().split(':')
              return { name: attrName, type: type || 'string' }
            })
          : []

        // Parse relationships
        const relationships = options.relationships
          ? options.relationships.split(',').map(rel => {
              const [relName, type, model] = rel.trim().split(':')
              return { name: relName, type, model }
            })
          : []

        // Generate model code
        const modelCode = generateModelCode(name, {
          attributes,
          relationships,
          timestamps: options.timestamps,
          softDeletes: options.softDeletes,
        })

        console.log(c.subheader('Generated Model'))
        divider()
        console.log(c.cyan(modelCode))
        divider()

        if (options.dryRun) {
          newline()
          info('[DRY RUN] No file was created')
          info(`Would create: ${config.queryBuilder.modelsPath}/${name}.ts`)
        }
        else {
          const fs = await import('node:fs/promises')
          const path = await import('node:path')

          const filePath = path.join(config.queryBuilder.modelsPath, `${name}.ts`)

          // Check if file exists
          try {
            await fs.access(filePath)
            warning(`File already exists: ${filePath}`)
            info('Use a different name or delete the existing file')
            return
          }
          catch {
            // File doesn't exist, proceed
          }

          // Ensure directory exists
          await fs.mkdir(config.queryBuilder.modelsPath, { recursive: true })

          // Write file
          await fs.writeFile(filePath, modelCode)

          newline()
          success(`Model created: ${filePath}`)
          info(`Run ${c.cyan('dbtooling migrate --dry-run')} to preview schema changes`)
        }

      }
      catch (error) {
        handleCommandError(error, 'models:generate')
      }
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

async function loadModels(): Promise<ParsedModel[]> {
  // Try to load from model parser if available
  try {
    const { parseModels } = await import('../../model-parser')
    const registry = await parseModels()
    return Object.values(registry.models).map((m: {
      name: string
      tableName?: string
      attributes: Array<{
        name: string
        type: string
        required?: boolean
        default?: unknown
        unique?: boolean
        index?: boolean
      }>
      relationships: Array<{
        name: string
        type: string
        relatedModel: string
        foreignKey?: string
        localKey?: string
      }>
      traits?: string[]
      primaryKey?: string
      timestamps?: boolean
      softDeletes?: boolean
    }) => ({
      name: m.name,
      tableName: m.tableName,
      attributes: m.attributes.map((a: {
        name: string
        type: string
        required?: boolean
        default?: unknown
        unique?: boolean
        index?: boolean
      }) => ({
        name: a.name,
        type: a.type,
        required: a.required,
        default: a.default,
        unique: a.unique,
        index: a.index,
      })),
      relationships: m.relationships.map((r: {
        name: string
        type: string
        relatedModel: string
        foreignKey?: string
        localKey?: string
      }) => ({
        name: r.name,
        type: r.type as ParsedRelationship['type'],
        model: r.relatedModel,
        foreignKey: r.foreignKey,
        localKey: r.localKey,
      })),
      traits: m.traits || [],
      primaryKey: m.primaryKey,
      timestamps: m.timestamps,
      softDeletes: m.softDeletes,
    }))
  }
  catch {
    // Fallback: scan directory for .ts files
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const { getConfig } = await import('../../config')

    try {
      const cfg = await getConfig()
      const files = await fs.readdir(cfg.queryBuilder.modelsPath)
      const modelFiles = files.filter((f: string) => f.endsWith('.ts') && !f.startsWith('index'))

      return modelFiles.map((f: string) => ({
        name: path.basename(f, '.ts'),
        attributes: [],
        relationships: [],
        traits: [],
      }))
    }
    catch {
      return []
    }
  }
}

function displayModelDetails(model: ParsedModel): void {
  console.log(box(
    formatKeyValue({
      'Name': c.green(model.name),
      'Table': model.tableName || c.dim('(default)'),
      'Primary Key': model.primaryKey || 'id',
      'Attributes': model.attributes.length,
      'Relationships': model.relationships.length,
      'Timestamps': model.timestamps !== false ? c.green('Yes') : c.dim('No'),
      'Soft Deletes': model.softDeletes ? c.yellow('Yes') : c.dim('No'),
      'Traits': model.traits.length > 0 ? model.traits.join(', ') : c.dim('None'),
    }),
    { title: model.name, titleColor: c.green },
  ))

  if (model.attributes.length > 0) {
    newline()
    console.log(c.subheader('Attributes'))
    for (const attr of model.attributes.slice(0, 5)) {
      const flags: string[] = []
      if (attr.required) flags.push(c.red('required'))
      if (attr.unique) flags.push(c.yellow('unique'))
      if (attr.index) flags.push(c.cyan('indexed'))

      console.log(`  ${icons.bullet} ${attr.name}: ${c.cyan(attr.type)}${flags.length > 0 ? ` [${flags.join(', ')}]` : ''}`)
    }
    if (model.attributes.length > 5) {
      console.log(c.dim(`  ... and ${model.attributes.length - 5} more`))
    }
  }

  if (model.relationships.length > 0) {
    newline()
    console.log(c.subheader('Relationships'))
    for (const rel of model.relationships) {
      console.log(`  ${icons.link} ${rel.name}: ${formatRelationType(rel.type)} ${c.green(rel.model)}`)
    }
  }
}

function buildModelTree(
  model: ParsedModel,
  allModels: ParsedModel[],
  visited: Set<string>,
  maxDepth = 3,
  depth = 0,
): TreeNode {
  const children: TreeNode[] = []

  if (depth < maxDepth && !visited.has(model.name)) {
    visited.add(model.name)

    for (const rel of model.relationships) {
      const relatedModel = allModels.find(m => m.name === rel.model)
      if (relatedModel && !visited.has(rel.model)) {
        children.push({
          label: `${rel.name} (${formatRelationType(rel.type)})`,
          icon: icons.link,
          color: c.dim,
          children: depth < maxDepth - 1
            ? [buildModelTree(relatedModel, allModels, new Set(visited), maxDepth, depth + 1)]
            : undefined,
        })
      }
      else {
        children.push({
          label: `${rel.name} → ${rel.model} (${formatRelationType(rel.type)})`,
          icon: icons.link,
          color: c.dim,
        })
      }
    }
  }

  return {
    label: model.name,
    icon: icons.table,
    color: c.green,
    children: children.length > 0 ? children : undefined,
  }
}

function formatType(type: string): string {
  const colors: Record<string, (s: string) => string> = {
    string: c.cyan,
    number: c.green,
    boolean: c.magenta,
    date: c.yellow,
    json: c.blue,
    array: c.red,
  }
  const colorFn = colors[type.toLowerCase()] || c.white
  return colorFn(type)
}

function formatRelationType(type: string): string {
  const colors: Record<string, (s: string) => string> = {
    hasOne: c.cyan,
    hasMany: c.green,
    belongsTo: c.yellow,
    belongsToMany: c.magenta,
  }
  const colorFn = colors[type] || c.white
  return colorFn(type)
}

function generateModelCode(
  name: string,
  options: {
    attributes: Array<{ name: string, type: string }>
    relationships: Array<{ name: string, type: string, model: string }>
    timestamps?: boolean
    softDeletes?: boolean
  },
): string {
  const lines: string[] = []

  lines.push(`import type { Model } from '@stacksjs/types'`)
  lines.push('')
  lines.push(`export default {`)
  lines.push(`  name: '${name}',`)
  lines.push(`  table: '${name.toLowerCase()}s',`)
  lines.push(`  primaryKey: 'id',`)

  // Traits
  const traits: string[] = []
  if (options.timestamps !== false) traits.push('timestamps')
  if (options.softDeletes) traits.push('softDeletes')
  if (traits.length > 0) {
    lines.push(`  traits: ['${traits.join("', '")}'],`)
  }

  lines.push('')

  // Attributes
  lines.push(`  attributes: {`)
  for (const attr of options.attributes) {
    lines.push(`    ${attr.name}: {`)
    lines.push(`      type: '${attr.type}',`)
    lines.push(`      required: true,`)
    lines.push(`    },`)
  }
  lines.push(`  },`)

  // Relationships
  if (options.relationships.length > 0) {
    lines.push('')
    lines.push(`  relationships: {`)
    for (const rel of options.relationships) {
      lines.push(`    ${rel.name}: {`)
      lines.push(`      type: '${rel.type}',`)
      lines.push(`      model: '${rel.model}',`)
      lines.push(`    },`)
    }
    lines.push(`  },`)
  }

  lines.push(`} satisfies Model`)
  lines.push('')

  return lines.join('\n')
}
