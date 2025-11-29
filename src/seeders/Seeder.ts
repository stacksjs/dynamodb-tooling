// ============================================================================
// Base Seeder Class for DynamoDB
// ============================================================================

import type { Config } from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * Database client interface for seeder operations
 */
export interface SeederDatabaseClient {
  /**
   * Put an item into the table
   */
  putItem: (tableName: string, item: Record<string, unknown>) => Promise<void>
  /**
   * Batch write items
   */
  batchWrite: (tableName: string, items: Array<{
    type: 'put' | 'delete'
    item: Record<string, unknown>
  }>) => Promise<{ unprocessedItems: Record<string, unknown>[] }>
  /**
   * Delete an item
   */
  deleteItem: (tableName: string, key: Record<string, unknown>) => Promise<void>
  /**
   * Scan items (for cleanup)
   */
  scan: (tableName: string, options?: {
    limit?: number
    filter?: string
    filterValues?: Record<string, unknown>
  }) => Promise<{ items: Record<string, unknown>[], lastEvaluatedKey?: Record<string, unknown> }>
}

/**
 * Seeder context passed to run method
 */
export interface SeederContext {
  /**
   * Database client
   */
  db: SeederDatabaseClient
  /**
   * Configuration
   */
  config: Config
  /**
   * Table name
   */
  tableName: string
  /**
   * Factory helper
   */
  factory: <T extends Record<string, unknown>>(
    entityType: string,
    definition: FactoryDefinition<T>,
  ) => FactoryInstance<T>
}

/**
 * Factory definition for generating fake data
 */
export interface FactoryDefinition<T extends Record<string, unknown>> {
  /**
   * Default attributes or generator function
   */
  attributes: T | (() => T)
  /**
   * Named states for variations
   */
  states?: Record<string, Partial<T> | (() => Partial<T>)>
}

/**
 * Factory instance for creating items
 */
export interface FactoryInstance<T extends Record<string, unknown>> {
  /**
   * Set the number of items to create
   */
  count: (n: number) => FactoryInstance<T>
  /**
   * Apply a named state
   */
  state: (name: string) => FactoryInstance<T>
  /**
   * Override specific attributes
   */
  override: (attributes: Partial<T>) => FactoryInstance<T>
  /**
   * Create items without persisting
   */
  make: () => T[]
  /**
   * Create and persist items
   */
  create: () => Promise<T[]>
}

/**
 * Seeder metadata
 */
export interface SeederMetadata {
  /**
   * Seeder name
   */
  name: string
  /**
   * Execution order (lower runs first)
   */
  order: number
  /**
   * Description
   */
  description?: string
}

// ============================================================================
// Base Seeder Class
// ============================================================================

/**
 * Abstract base class for seeders
 *
 * Example usage:
 * ```ts
 * export class UserSeeder extends Seeder {
 *   static order = 1
 *   static description = 'Seeds initial users'
 *
 *   async run(ctx: SeederContext): Promise<void> {
 *     const users = ctx.factory('User', {
 *       attributes: () => ({
 *         id: crypto.randomUUID(),
 *         name: 'Test User',
 *         email: `user${Math.random()}@example.com`,
 *         createdAt: new Date().toISOString(),
 *       })
 *     }).count(10).create()
 *   }
 * }
 * ```
 */
export abstract class Seeder {
  /**
   * Execution order (lower runs first)
   */
  static order: number = 100

  /**
   * Human-readable description
   */
  static description?: string

  /**
   * Run the seeder
   */
  abstract run(ctx: SeederContext): Promise<void>

  /**
   * Get seeder metadata
   */
  static getMetadata(): SeederMetadata {
    return {
      name: this.name,
      order: this.order,
      description: this.description,
    }
  }
}

// ============================================================================
// Seeder Result Types
// ============================================================================

/**
 * Result of running a single seeder
 */
export interface SeederResult {
  /**
   * Seeder name
   */
  name: string
  /**
   * Whether it was successful
   */
  success: boolean
  /**
   * Execution time in milliseconds
   */
  durationMs: number
  /**
   * Number of items created
   */
  itemsCreated: number
  /**
   * Error message if failed
   */
  error?: string
}

/**
 * Result of running all seeders
 */
export interface SeederRunResult {
  /**
   * Whether all seeders succeeded
   */
  success: boolean
  /**
   * Total execution time
   */
  durationMs: number
  /**
   * Total items created
   */
  totalItemsCreated: number
  /**
   * Results per seeder
   */
  results: SeederResult[]
  /**
   * Any errors
   */
  errors: Array<{ seeder: string, error: string }>
}
