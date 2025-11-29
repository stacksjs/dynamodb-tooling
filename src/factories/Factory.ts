// ============================================================================
// Factory System for DynamoDB Test Data Generation
// ============================================================================

import type { Config } from '../types'
import type { SeederDatabaseClient } from '../seeders/Seeder'
import { getConfig } from '../config'

// ============================================================================
// Types
// ============================================================================

/**
 * Factory state definition - overrides or generates additional attributes
 */
export type FactoryState<T> = Partial<T> | (() => Partial<T>)

/**
 * Factory definition configuration
 */
export interface FactoryConfig<T extends Record<string, unknown>> {
  /**
   * Entity type name (e.g., 'User', 'Post')
   */
  entityType: string
  /**
   * Default attributes or generator function
   */
  definition: T | (() => T)
  /**
   * Named states for variations
   */
  states?: Record<string, FactoryState<T>>
  /**
   * Lifecycle hooks
   */
  hooks?: {
    afterMaking?: (item: T) => T | void
    afterCreating?: (item: T) => T | void | Promise<T | void>
  }
}

/**
 * Factory builder for fluent API
 */
export interface FactoryBuilder<T extends Record<string, unknown>> {
  /**
   * Set number of items to create
   */
  count: (n: number) => FactoryBuilder<T>
  /**
   * Apply a named state
   */
  state: (name: string) => FactoryBuilder<T>
  /**
   * Apply multiple states
   */
  states: (...names: string[]) => FactoryBuilder<T>
  /**
   * Override specific attributes
   */
  override: (attributes: Partial<T>) => FactoryBuilder<T>
  /**
   * Sequence helper for unique values
   */
  sequence: <K extends keyof T>(
    key: K,
    generator: (index: number) => T[K],
  ) => FactoryBuilder<T>
  /**
   * Create items without persisting to database
   */
  make: () => T[]
  /**
   * Create a single item without persisting
   */
  makeOne: () => T
  /**
   * Create and persist items to database
   */
  create: () => Promise<T[]>
  /**
   * Create and persist a single item
   */
  createOne: () => Promise<T>
  /**
   * Get raw attributes (for debugging)
   */
  raw: () => Partial<T>[]
}

/**
 * Registered factory storage
 */
interface FactoryRegistration<T extends Record<string, unknown>> {
  config: FactoryConfig<T>
  db?: SeederDatabaseClient
  tableName?: string
  appConfig?: Config
}

// ============================================================================
// Factory Registry
// ============================================================================

const factoryRegistry = new Map<string, FactoryRegistration<Record<string, unknown>>>()

// ============================================================================
// Factory Class
// ============================================================================

/**
 * Factory class for generating test data
 *
 * Example:
 * ```ts
 * // Define a factory
 * Factory.define('User', {
 *   entityType: 'USER',
 *   definition: () => ({
 *     id: crypto.randomUUID(),
 *     name: 'Test User',
 *     email: `user${Date.now()}@example.com`,
 *     createdAt: new Date().toISOString(),
 *   }),
 *   states: {
 *     admin: { role: 'admin' },
 *     inactive: () => ({ status: 'inactive', deactivatedAt: new Date().toISOString() }),
 *   }
 * })
 *
 * // Use the factory
 * const users = await Factory.for('User')
 *   .count(5)
 *   .state('admin')
 *   .create()
 * ```
 */
export class Factory {
  /**
   * Define a new factory
   */
  static define<T extends Record<string, unknown>>(
    name: string,
    config: FactoryConfig<T>,
  ): void {
    factoryRegistry.set(name, {
      config: config as FactoryConfig<Record<string, unknown>>,
    })
  }

  /**
   * Configure the factory system with database client
   */
  static async configure(
    db: SeederDatabaseClient,
    config?: Config,
  ): Promise<void> {
    const resolvedConfig = config ?? await getConfig()
    const tableName = `${resolvedConfig.tableNamePrefix}${resolvedConfig.defaultTableName}${resolvedConfig.tableNameSuffix}`

    // Update all registered factories
    for (const [_, registration] of factoryRegistry) {
      registration.db = db
      registration.tableName = tableName
      registration.appConfig = resolvedConfig
    }
  }

  /**
   * Get a factory builder for creating items
   */
  static for<T extends Record<string, unknown>>(name: string): FactoryBuilder<T> {
    const registration = factoryRegistry.get(name)
    if (!registration) {
      throw new Error(`Factory '${name}' not found. Did you forget to define it?`)
    }

    return createFactoryBuilder<T>(
      registration.config as FactoryConfig<T>,
      registration.db,
      registration.tableName,
      registration.appConfig,
    )
  }

  /**
   * Check if a factory exists
   */
  static has(name: string): boolean {
    return factoryRegistry.has(name)
  }

  /**
   * Get all registered factory names
   */
  static names(): string[] {
    return Array.from(factoryRegistry.keys())
  }

  /**
   * Clear all registered factories
   */
  static clear(): void {
    factoryRegistry.clear()
  }
}

// ============================================================================
// Factory Builder Implementation
// ============================================================================

function createFactoryBuilder<T extends Record<string, unknown>>(
  config: FactoryConfig<T>,
  db?: SeederDatabaseClient,
  tableName?: string,
  appConfig?: Config,
): FactoryBuilder<T> {
  let _count = 1
  const _states: string[] = []
  let _overrides: Partial<T> = {}
  const _sequences = new Map<keyof T, (index: number) => unknown>()

  const resolveDefinition = (): T => {
    if (typeof config.definition === 'function') {
      return config.definition()
    }
    return { ...config.definition }
  }

  const resolveState = (name: string): Partial<T> => {
    const state = config.states?.[name]
    if (!state) {
      throw new Error(`State '${name}' not found in factory for '${config.entityType}'`)
    }
    if (typeof state === 'function') {
      return state()
    }
    return { ...state }
  }

  const buildItem = (index: number): T => {
    // Start with base definition
    let item = resolveDefinition()

    // Apply states in order
    for (const stateName of _states) {
      item = { ...item, ...resolveState(stateName) }
    }

    // Apply overrides
    item = { ...item, ..._overrides } as T

    // Apply sequences
    for (const [key, generator] of _sequences) {
      (item as Record<string, unknown>)[key as string] = generator(index)
    }

    return item
  }

  const addDynamoDBKeys = (item: T, cfg: Config): T => {
    const delimiter = cfg.singleTableDesign.keyDelimiter
    const pkAttr = cfg.singleTableDesign.partitionKeyName
    const skAttr = cfg.singleTableDesign.sortKeyName
    const etAttr = cfg.singleTableDesign.entityTypeAttribute

    const id = (item as Record<string, unknown>).id ?? crypto.randomUUID()

    return {
      ...item,
      [pkAttr]: `${config.entityType}${delimiter}${id}`,
      [skAttr]: `${config.entityType}${delimiter}${id}`,
      [etAttr]: config.entityType,
    }
  }

  const builder: FactoryBuilder<T> = {
    count(n: number) {
      _count = n
      return builder
    },

    state(name: string) {
      _states.push(name)
      return builder
    },

    states(...names: string[]) {
      _states.push(...names)
      return builder
    },

    override(attributes: Partial<T>) {
      _overrides = { ..._overrides, ...attributes }
      return builder
    },

    sequence<K extends keyof T>(key: K, generator: (index: number) => T[K]) {
      _sequences.set(key, generator)
      return builder
    },

    make(): T[] {
      const items: T[] = []

      for (let i = 0; i < _count; i++) {
        let item = buildItem(i)

        // Add DynamoDB keys if config is available
        if (appConfig) {
          item = addDynamoDBKeys(item, appConfig)
        }

        // Apply afterMaking hook
        if (config.hooks?.afterMaking) {
          const result = config.hooks.afterMaking(item)
          if (result) {
            item = result
          }
        }

        items.push(item)
      }

      return items
    },

    makeOne(): T {
      const items = builder.count(1).make()
      return items[0]
    },

    async create(): Promise<T[]> {
      if (!db || !tableName) {
        throw new Error(
          'Factory not configured with database client. Call Factory.configure(db) first.',
        )
      }

      const items = builder.make()

      // Batch write items (chunks of 25)
      const batchSize = 25
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await db.batchWrite(
          tableName,
          batch.map(item => ({ type: 'put', item })),
        )
      }

      // Apply afterCreating hooks
      if (config.hooks?.afterCreating) {
        for (let i = 0; i < items.length; i++) {
          const result = await config.hooks.afterCreating(items[i])
          if (result) {
            items[i] = result
          }
        }
      }

      return items
    },

    async createOne(): Promise<T> {
      const items = await builder.count(1).create()
      return items[0]
    },

    raw(): Partial<T>[] {
      const items: Partial<T>[] = []
      for (let i = 0; i < _count; i++) {
        items.push(buildItem(i))
      }
      return items
    },
  }

  return builder
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique email
 */
export function uniqueEmail(domain = 'example.com'): string {
  return `user${Date.now()}${Math.random().toString(36).slice(2)}@${domain}`
}

/**
 * Generate a unique username
 */
export function uniqueUsername(prefix = 'user'): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Generate a random integer in range
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Pick a random element from an array
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Generate a random boolean with optional probability
 */
export function randomBool(probability = 0.5): boolean {
  return Math.random() < probability
}

/**
 * Generate a random date in range
 */
export function randomDate(start: Date, end: Date = new Date()): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

/**
 * Generate a random ISO date string
 */
export function randomISODate(start: Date, end: Date = new Date()): string {
  return randomDate(start, end).toISOString()
}
