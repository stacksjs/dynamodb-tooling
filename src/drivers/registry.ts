// ============================================================================
// Driver Registry - Plugin Registration System
// ============================================================================

import type { DriverConnectionOptions, DriverFactory, DriverPlugin } from './types'

/**
 * Global driver registry
 */
const driverRegistry = new Map<string, DriverFactory>()
let defaultDriverName: string | null = null
let activeDriver: DriverPlugin | null = null

/**
 * Register a driver plugin
 *
 * @param name - Unique driver name
 * @param factory - Factory function that creates driver instances
 * @param setAsDefault - Whether to set this as the default driver
 *
 * @example
 * ```typescript
 * registerDriver('dynamodb', createDynamoDBDriver)
 * registerDriver('dynamodb-local', createDynamoDBLocalDriver, true)
 * ```
 */
export function registerDriver(
  name: string,
  factory: DriverFactory,
  setAsDefault: boolean = false,
): void {
  if (driverRegistry.has(name)) {
    console.warn(`Driver "${name}" is already registered and will be overwritten`)
  }

  driverRegistry.set(name, factory)

  if (setAsDefault || defaultDriverName === null) {
    defaultDriverName = name
  }
}

/**
 * Unregister a driver plugin
 *
 * @param name - Driver name to unregister
 */
export function unregisterDriver(name: string): boolean {
  const deleted = driverRegistry.delete(name)

  if (deleted && defaultDriverName === name) {
    // Set first available driver as default, or null if none
    const remaining = Array.from(driverRegistry.keys())
    defaultDriverName = remaining[0] ?? null
  }

  return deleted
}

/**
 * Get a driver factory by name
 *
 * @param name - Driver name (optional, uses default if not specified)
 * @returns Driver factory or undefined if not found
 */
export function getDriverFactory(name?: string): DriverFactory | undefined {
  const driverName = name ?? defaultDriverName
  if (!driverName) {
    return undefined
  }
  return driverRegistry.get(driverName)
}

/**
 * Get a driver instance by name
 *
 * @param name - Driver name (optional, uses default if not specified)
 * @param options - Connection options for the driver
 * @returns Driver instance or undefined if not found
 */
export function getDriver(name?: string, options?: DriverConnectionOptions): DriverPlugin | undefined {
  const factory = getDriverFactory(name)
  if (!factory) {
    return undefined
  }
  return factory(options)
}

/**
 * Create and set the active driver
 *
 * @param name - Driver name (optional, uses default if not specified)
 * @param options - Connection options
 * @returns The created driver instance
 */
export async function createActiveDriver(
  name?: string,
  options?: DriverConnectionOptions,
): Promise<DriverPlugin> {
  const driver = getDriver(name, options)
  if (!driver) {
    const availableDrivers = getRegisteredDrivers()
    throw new Error(
      `Driver "${name ?? 'default'}" not found. Available drivers: ${availableDrivers.join(', ') || 'none'}`,
    )
  }

  // Disconnect existing driver if any
  if (activeDriver?.isConnected()) {
    await activeDriver.disconnect()
  }

  // Connect new driver
  if (options) {
    await driver.connect(options)
  }

  activeDriver = driver
  return driver
}

/**
 * Get the currently active driver
 *
 * @returns The active driver instance or null
 */
export function getActiveDriver(): DriverPlugin | null {
  return activeDriver
}

/**
 * Set the active driver directly
 *
 * @param driver - Driver instance to set as active
 */
export function setActiveDriver(driver: DriverPlugin | null): void {
  activeDriver = driver
}

/**
 * Get all registered driver names
 *
 * @returns Array of registered driver names
 */
export function getRegisteredDrivers(): string[] {
  return Array.from(driverRegistry.keys())
}

/**
 * Check if a driver is registered
 *
 * @param name - Driver name to check
 * @returns True if driver is registered
 */
export function hasDriver(name: string): boolean {
  return driverRegistry.has(name)
}

/**
 * Get the default driver name
 *
 * @returns Default driver name or null
 */
export function getDefaultDriverName(): string | null {
  return defaultDriverName
}

/**
 * Set the default driver
 *
 * @param name - Driver name to set as default
 */
export function setDefaultDriver(name: string): void {
  if (!driverRegistry.has(name)) {
    throw new Error(`Cannot set default driver: "${name}" is not registered`)
  }
  defaultDriverName = name
}

/**
 * Clear all registered drivers
 * Useful for testing
 */
export function clearDriverRegistry(): void {
  driverRegistry.clear()
  defaultDriverName = null
  activeDriver = null
}

/**
 * Get driver registry stats
 */
export function getDriverRegistryStats(): {
  registeredCount: number
  defaultDriver: string | null
  hasActiveDriver: boolean
  activeDriverName: string | null
} {
  return {
    registeredCount: driverRegistry.size,
    defaultDriver: defaultDriverName,
    hasActiveDriver: activeDriver !== null,
    activeDriverName: activeDriver?.name ?? null,
  }
}
