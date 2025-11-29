import type {
  AutoScalingCapacityConfig,
  AutoScalingConfig,
  CachingConfig,
  CapacityConfig,
  Config,
  ConfigValidationError,
  ConfigValidationResult,
  ContributorInsightsConfig,
  DeepPartial,
  HooksConfig,
  HttpOptions,
  LocalConfig,
  MultiTenancyConfig,
  QueryBuilderConfig,
  SingleTableDesignConfig,
  SoftDeletesConfig,
  StreamsConfig,
  TTLConfig,
  UserConfig,
} from './types'
import { resolve } from 'node:path'
import { loadConfig } from 'bunfig'

// ============================================================================
// Default Configuration Values
// ============================================================================

/**
 * Default HTTP options
 */
export const defaultHttpOptions: HttpOptions = {
  timeout: 30000,
  connectTimeout: 5000,
  keepAlive: true,
  keepAliveTimeout: 60000,
}

/**
 * Default single-table design configuration
 */
export const defaultSingleTableDesign: SingleTableDesignConfig = {
  enabled: true,
  partitionKeyName: 'pk',
  sortKeyName: 'sk',
  gsi1pkName: 'gsi1pk',
  gsi1skName: 'gsi1sk',
  gsi2pkName: 'gsi2pk',
  gsi2skName: 'gsi2sk',
  gsi3pkName: 'gsi3pk',
  gsi3skName: 'gsi3sk',
  gsi4pkName: 'gsi4pk',
  gsi4skName: 'gsi4sk',
  gsi5pkName: 'gsi5pk',
  gsi5skName: 'gsi5sk',
  entityTypeAttribute: '_et',
  dataAttribute: '_d',
  pkPrefix: '{ENTITY}#',
  skPrefix: '{ENTITY}#',
  gsiCount: 2,
  keyDelimiter: '#',
}

/**
 * Default soft deletes configuration
 */
export const defaultSoftDeletes: SoftDeletesConfig = {
  enabled: false,
  attribute: 'deletedAt',
}

/**
 * Default hooks configuration
 */
export const defaultHooks: HooksConfig = {
  global: {},
  models: {},
}

/**
 * Default caching configuration
 */
export const defaultCaching: CachingConfig = {
  enabled: false,
  ttlMs: 60000,
  maxSize: 1000,
  keyPrefix: 'ddb:',
}

/**
 * Default query builder configuration
 */
export const defaultQueryBuilder: QueryBuilderConfig = {
  modelsPath: './app/models',
  entityMappingStrategy: 'prefix',
  timestampFormat: 'iso',
  softDeletes: defaultSoftDeletes,
  hooks: defaultHooks,
  caching: defaultCaching,
  createdAtAttribute: 'createdAt',
  updatedAtAttribute: 'updatedAt',
  versionAttribute: '_v',
}

/**
 * Default auto-scaling capacity configuration
 */
export const defaultAutoScalingCapacity: AutoScalingCapacityConfig = {
  min: 5,
  max: 100,
  targetUtilization: 70,
}

/**
 * Default auto-scaling configuration
 */
export const defaultAutoScaling: AutoScalingConfig = {
  enabled: false,
  read: { ...defaultAutoScalingCapacity },
  write: { ...defaultAutoScalingCapacity },
  scaleInCooldown: 60,
  scaleOutCooldown: 60,
}

/**
 * Default capacity configuration
 */
export const defaultCapacity: CapacityConfig = {
  billingMode: 'PAY_PER_REQUEST',
  read: 5,
  write: 5,
  autoScaling: defaultAutoScaling,
}

/**
 * Default streams configuration
 */
export const defaultStreams: StreamsConfig = {
  enabled: false,
  viewType: 'NEW_AND_OLD_IMAGES',
}

/**
 * Default TTL configuration
 */
export const defaultTTL: TTLConfig = {
  enabled: false,
  attributeName: 'ttl',
}

/**
 * Default contributor insights configuration
 */
export const defaultContributorInsights: ContributorInsightsConfig = {
  enabled: false,
}

/**
 * Default local DynamoDB configuration
 */
export const defaultLocal: LocalConfig = {
  port: 8000,
  dbPath: '',
  detached: false,
  additionalArgs: ['-sharedDb'],
  javaOpts: '',
  installPath: 'dynamodb-local',
  downloadUrl: 'https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz',
}

/**
 * Default multi-tenancy configuration
 */
export const defaultMultiTenancy: MultiTenancyConfig = {
  enabled: false,
  strategy: 'prefix',
  tenantIdAttribute: 'tenantId',
  tenantResolver: undefined,
}

/**
 * Complete default configuration
 */
export const defaultConfig: Config = {
  // AWS Connection
  region: 'us-east-1',
  endpoint: undefined,
  credentials: undefined,
  profile: undefined,

  // Retry & HTTP
  maxRetries: 3,
  retryMode: 'standard',
  httpOptions: defaultHttpOptions,

  // Table Naming
  defaultTableName: 'MainTable',
  tableNamePrefix: '',
  tableNameSuffix: '',

  // Single-Table Design
  singleTableDesign: defaultSingleTableDesign,

  // Query Builder
  queryBuilder: defaultQueryBuilder,

  // Capacity & Performance
  capacity: defaultCapacity,

  // Streams & TTL
  streams: defaultStreams,
  ttl: defaultTTL,

  // Table Settings
  tableClass: 'STANDARD',
  deletionProtection: false,
  contributorInsights: defaultContributorInsights,
  tags: {},

  // Default Operation Settings
  returnConsumedCapacity: 'NONE',
  returnItemCollectionMetrics: 'NONE',
  consistentRead: false,

  // Local Development
  local: defaultLocal,

  // Multi-Tenancy
  multiTenancy: defaultMultiTenancy,

  // GSI/LSI Definitions
  globalSecondaryIndexes: [],
  localSecondaryIndexes: [],
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validates the configuration and returns detailed error messages
 */
export function validateConfig(config: Config): ConfigValidationResult {
  const errors: ConfigValidationError[] = []

  // Validate region
  if (config.region && !/^[a-z]{2}-[a-z]+-\d$/.test(config.region)) {
    errors.push({
      path: 'region',
      message: 'Invalid AWS region format',
      value: config.region,
      suggestion: 'Use format like "us-east-1", "eu-west-2", "ap-southeast-1"',
    })
  }

  // Validate endpoint URL
  if (config.endpoint) {
    try {
      new URL(config.endpoint)
    }
    catch {
      errors.push({
        path: 'endpoint',
        message: 'Invalid endpoint URL',
        value: config.endpoint,
        suggestion: 'Use a valid URL like "http://localhost:8000"',
      })
    }
  }

  // Validate maxRetries
  if (config.maxRetries < 0 || config.maxRetries > 10) {
    errors.push({
      path: 'maxRetries',
      message: 'maxRetries must be between 0 and 10',
      value: config.maxRetries,
      suggestion: 'Use a value between 0 and 10 (3 is recommended)',
    })
  }

  // Validate HTTP options
  if (config.httpOptions.timeout !== undefined && config.httpOptions.timeout < 0) {
    errors.push({
      path: 'httpOptions.timeout',
      message: 'timeout must be a positive number',
      value: config.httpOptions.timeout,
    })
  }

  if (config.httpOptions.connectTimeout !== undefined && config.httpOptions.connectTimeout < 0) {
    errors.push({
      path: 'httpOptions.connectTimeout',
      message: 'connectTimeout must be a positive number',
      value: config.httpOptions.connectTimeout,
    })
  }

  // Validate table name
  if (!config.defaultTableName || config.defaultTableName.length < 3) {
    errors.push({
      path: 'defaultTableName',
      message: 'Table name must be at least 3 characters',
      value: config.defaultTableName,
      suggestion: 'DynamoDB table names must be 3-255 characters',
    })
  }

  if (config.defaultTableName && config.defaultTableName.length > 255) {
    errors.push({
      path: 'defaultTableName',
      message: 'Table name must not exceed 255 characters',
      value: config.defaultTableName,
    })
  }

  // Validate single-table design
  if (config.singleTableDesign.gsiCount < 0 || config.singleTableDesign.gsiCount > 20) {
    errors.push({
      path: 'singleTableDesign.gsiCount',
      message: 'gsiCount must be between 0 and 20',
      value: config.singleTableDesign.gsiCount,
      suggestion: 'DynamoDB supports up to 20 GSIs per table. 2-5 is recommended for most use cases.',
    })
  }

  if (!config.singleTableDesign.partitionKeyName) {
    errors.push({
      path: 'singleTableDesign.partitionKeyName',
      message: 'partitionKeyName is required',
      suggestion: 'Use "pk" as the partition key name',
    })
  }

  if (!config.singleTableDesign.sortKeyName) {
    errors.push({
      path: 'singleTableDesign.sortKeyName',
      message: 'sortKeyName is required',
      suggestion: 'Use "sk" as the sort key name',
    })
  }

  // Validate capacity configuration
  if (config.capacity.billingMode === 'PROVISIONED') {
    if (config.capacity.read < 1) {
      errors.push({
        path: 'capacity.read',
        message: 'Read capacity must be at least 1 for provisioned mode',
        value: config.capacity.read,
      })
    }

    if (config.capacity.write < 1) {
      errors.push({
        path: 'capacity.write',
        message: 'Write capacity must be at least 1 for provisioned mode',
        value: config.capacity.write,
      })
    }

    // Validate auto-scaling
    if (config.capacity.autoScaling.enabled) {
      const { read, write } = config.capacity.autoScaling

      if (read.min < 1 || read.max < read.min) {
        errors.push({
          path: 'capacity.autoScaling.read',
          message: 'Read auto-scaling min must be at least 1 and max must be >= min',
          value: read,
        })
      }

      if (write.min < 1 || write.max < write.min) {
        errors.push({
          path: 'capacity.autoScaling.write',
          message: 'Write auto-scaling min must be at least 1 and max must be >= min',
          value: write,
        })
      }

      if (read.targetUtilization < 20 || read.targetUtilization > 90) {
        errors.push({
          path: 'capacity.autoScaling.read.targetUtilization',
          message: 'Target utilization must be between 20 and 90',
          value: read.targetUtilization,
        })
      }

      if (write.targetUtilization < 20 || write.targetUtilization > 90) {
        errors.push({
          path: 'capacity.autoScaling.write.targetUtilization',
          message: 'Target utilization must be between 20 and 90',
          value: write.targetUtilization,
        })
      }
    }
  }

  // Validate query builder
  if (config.queryBuilder.caching.enabled) {
    if (config.queryBuilder.caching.ttlMs < 0) {
      errors.push({
        path: 'queryBuilder.caching.ttlMs',
        message: 'Cache TTL must be a positive number',
        value: config.queryBuilder.caching.ttlMs,
      })
    }

    if (config.queryBuilder.caching.maxSize < 1) {
      errors.push({
        path: 'queryBuilder.caching.maxSize',
        message: 'Cache max size must be at least 1',
        value: config.queryBuilder.caching.maxSize,
      })
    }
  }

  // Validate local config
  if (config.local.port < 1 || config.local.port > 65535) {
    errors.push({
      path: 'local.port',
      message: 'Port must be between 1 and 65535',
      value: config.local.port,
    })
  }

  // Validate GSI definitions
  config.globalSecondaryIndexes.forEach((gsi, index) => {
    if (!gsi.name) {
      errors.push({
        path: `globalSecondaryIndexes[${index}].name`,
        message: 'GSI name is required',
      })
    }

    if (!gsi.partitionKey) {
      errors.push({
        path: `globalSecondaryIndexes[${index}].partitionKey`,
        message: 'GSI partition key is required',
      })
    }

    if (gsi.projection.type === 'INCLUDE' && (!gsi.projection.attributes || gsi.projection.attributes.length === 0)) {
      errors.push({
        path: `globalSecondaryIndexes[${index}].projection.attributes`,
        message: 'Projection attributes are required when type is INCLUDE',
      })
    }
  })

  // Validate LSI definitions (max 5)
  if (config.localSecondaryIndexes.length > 5) {
    errors.push({
      path: 'localSecondaryIndexes',
      message: 'Maximum of 5 Local Secondary Indexes allowed per table',
      value: config.localSecondaryIndexes.length,
    })
  }

  config.localSecondaryIndexes.forEach((lsi, index) => {
    if (!lsi.name) {
      errors.push({
        path: `localSecondaryIndexes[${index}].name`,
        message: 'LSI name is required',
      })
    }

    if (!lsi.sortKey) {
      errors.push({
        path: `localSecondaryIndexes[${index}].sortKey`,
        message: 'LSI sort key is required',
      })
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Deep merge two objects, with source values taking precedence
 */
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const k = key as keyof T
    const sourceValue = (source as Record<string, unknown>)[key]
    const targetValue = target[k]

    if (sourceValue === undefined) {
      continue
    }

    if (
      sourceValue !== null
      && typeof sourceValue === 'object'
      && !Array.isArray(sourceValue)
      && targetValue !== null
      && typeof targetValue === 'object'
      && !Array.isArray(targetValue)
    ) {
      result[k] = deepMerge(targetValue as object, sourceValue as object) as T[keyof T]
    }
    else {
      result[k] = sourceValue as T[keyof T]
    }
  }

  return result
}

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Lazy-loaded config to avoid top-level await (enables bun --compile)
 */
let _config: Config | null = null

/**
 * Programmatically set configuration
 */
let _programmaticConfig: UserConfig | null = null

/**
 * Load and merge configuration from dynamodb.config.ts
 */
export async function getConfig(): Promise<Config> {
  if (_config) {
    return _config
  }

  // Load from config file
  const fileConfig = await loadConfig<UserConfig>({
    name: 'dynamodb',
    cwd: resolve(__dirname, '..'),
    defaultConfig: {},
  })

  // Merge: defaults < file config < programmatic config
  let mergedConfig = deepMerge(defaultConfig, fileConfig)

  if (_programmaticConfig) {
    mergedConfig = deepMerge(mergedConfig, _programmaticConfig)
  }

  // Validate the final config
  const validation = validateConfig(mergedConfig)
  if (!validation.valid) {
    const errorMessages = validation.errors
      .map(e => `  - ${e.path}: ${e.message}${e.suggestion ? ` (${e.suggestion})` : ''}`)
      .join('\n')
    console.warn(`DynamoDB Tooling Configuration Warnings:\n${errorMessages}`)
  }

  _config = mergedConfig
  return _config
}

/**
 * Programmatically set configuration (merged with defaults and file config)
 */
export function setConfig(userConfig: UserConfig): void {
  _programmaticConfig = userConfig
  _config = null // Reset cached config to force reload
}

/**
 * Reset configuration to defaults (useful for testing)
 */
export function resetConfig(): void {
  _config = null
  _programmaticConfig = null
}

/**
 * Get configuration synchronously (returns defaults if not loaded)
 * @deprecated Use getConfig() for full configuration. This is for backwards compatibility.
 */
export const config: Config = defaultConfig

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the full table name with prefix and suffix applied
 */
export function getFullTableName(tableName: string, config: Config): string {
  return `${config.tableNamePrefix}${tableName}${config.tableNameSuffix}`
}

/**
 * Generate default GSI definitions based on single-table design config
 */
export function generateDefaultGSIs(config: Config): Config['globalSecondaryIndexes'] {
  const { singleTableDesign } = config
  const gsis: Config['globalSecondaryIndexes'] = []

  const gsiNames = [
    { pk: singleTableDesign.gsi1pkName, sk: singleTableDesign.gsi1skName, name: 'GSI1' },
    { pk: singleTableDesign.gsi2pkName, sk: singleTableDesign.gsi2skName, name: 'GSI2' },
    { pk: singleTableDesign.gsi3pkName, sk: singleTableDesign.gsi3skName, name: 'GSI3' },
    { pk: singleTableDesign.gsi4pkName, sk: singleTableDesign.gsi4skName, name: 'GSI4' },
    { pk: singleTableDesign.gsi5pkName, sk: singleTableDesign.gsi5skName, name: 'GSI5' },
  ]

  for (let i = 0; i < Math.min(singleTableDesign.gsiCount, 5); i++) {
    gsis.push({
      name: gsiNames[i].name,
      partitionKey: gsiNames[i].pk,
      sortKey: gsiNames[i].sk,
      projection: { type: 'ALL' },
    })
  }

  return gsis
}

/**
 * Check if running in local development mode
 */
export function isLocalMode(config: Config): boolean {
  return config.endpoint?.includes('localhost') || config.endpoint?.includes('127.0.0.1') || false
}

/**
 * Get the endpoint URL, defaulting to local if specified
 */
export function getEndpoint(config: Config): string | undefined {
  if (config.endpoint) {
    return config.endpoint
  }

  // Check for common local development indicators
  if (process.env.DYNAMODB_LOCAL === 'true' || process.env.NODE_ENV === 'development') {
    return `http://localhost:${config.local.port}`
  }

  return undefined
}
