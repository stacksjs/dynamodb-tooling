// ============================================================================
// Stacks Framework Integration
// ============================================================================
// Integration with the Stacks framework analytics system
// This provides a DynamoDB-backed analytics driver for Stacks

import {
  AggregationPipeline,
  AnalyticsAPI,
  AnalyticsQueryAPI,
  AnalyticsStore,
  generateTrackingScript,
  type AnalyticsAPIConfig,
  type HandlerContext,
} from './index'

// ============================================================================
// Stacks Analytics Driver Configuration
// ============================================================================

/**
 * DynamoDB analytics driver configuration for Stacks
 */
export interface DynamoDBAnalyticsConfig {
  /** DynamoDB table name */
  tableName: string
  /** AWS region */
  region?: string
  /** Site ID for this installation */
  siteId: string
  /** API endpoint URL */
  apiEndpoint?: string
  /** Whether to use TTL for data retention */
  useTtl?: boolean
  /** Raw event retention in days */
  rawEventRetentionDays?: number
  /** Hourly aggregate retention in days */
  hourlyRetentionDays?: number
  /** Daily aggregate retention in years */
  dailyRetentionYears?: number
  /** Privacy settings */
  privacy?: {
    /** Respect Do Not Track header */
    honorDnt?: boolean
    /** Hash visitor IPs */
    hashIps?: boolean
    /** Collect geolocation data */
    collectGeolocation?: boolean
  }
  /** Tracking options */
  tracking?: {
    /** Track hash changes (for SPAs) */
    trackHashChanges?: boolean
    /** Track outbound links */
    trackOutboundLinks?: boolean
    /** Excluded paths (regex patterns) */
    excludedPaths?: string[]
    /** Excluded IPs */
    excludedIps?: string[]
  }
}

/**
 * Stacks analytics options interface (matches Stacks pattern)
 */
export interface StacksAnalyticsOptions {
  driver: 'google-analytics' | 'fathom' | 'dynamodb'

  drivers: {
    googleAnalytics?: {
      trackingId: string
    }
    fathom?: {
      siteId: string
    }
    dynamodb?: DynamoDBAnalyticsConfig
  }
}

// ============================================================================
// Stacks Analytics Driver
// ============================================================================

/**
 * DynamoDB Analytics Driver for Stacks
 *
 * @example
 * ```typescript
 * // config/analytics.ts
 * export default {
 *   driver: 'dynamodb',
 *   drivers: {
 *     dynamodb: {
 *       tableName: 'analytics',
 *       siteId: 'my-site-id',
 *       region: 'us-east-1',
 *       privacy: {
 *         honorDnt: true,
 *         hashIps: true,
 *       },
 *     },
 *   },
 * } satisfies StacksAnalyticsOptions
 * ```
 */
export class DynamoDBAnalyticsDriver {
  private config: DynamoDBAnalyticsConfig
  private api: AnalyticsAPI
  private store: AnalyticsStore
  private queryApi: AnalyticsQueryAPI
  private pipeline: AggregationPipeline
  private executeCommand: HandlerContext['executeCommand']

  constructor(
    config: DynamoDBAnalyticsConfig,
    executeCommand: HandlerContext['executeCommand'],
  ) {
    this.config = {
      region: 'us-east-1',
      useTtl: true,
      rawEventRetentionDays: 30,
      hourlyRetentionDays: 90,
      dailyRetentionYears: 2,
      privacy: {
        honorDnt: true,
        hashIps: true,
        collectGeolocation: false,
      },
      tracking: {
        trackHashChanges: true,
        trackOutboundLinks: true,
        excludedPaths: [],
        excludedIps: [],
      },
      ...config,
    }

    this.executeCommand = executeCommand

    const apiConfig: AnalyticsAPIConfig = {
      tableName: this.config.tableName,
      useTtl: this.config.useTtl,
      rawEventTtl: (this.config.rawEventRetentionDays || 30) * 24 * 60 * 60,
    }

    this.api = new AnalyticsAPI(apiConfig)
    this.store = this.api.getStore()
    this.queryApi = this.api.getQueryAPI()
    this.pipeline = this.api.getPipeline()
  }

  /**
   * Get the tracking script HTML to inject into pages
   */
  getTrackingScript(): string {
    return generateTrackingScript({
      siteId: this.config.siteId,
      apiEndpoint: this.config.apiEndpoint || '/api/analytics',
      honorDnt: this.config.privacy?.honorDnt,
      trackHashChanges: this.config.tracking?.trackHashChanges,
      trackOutboundLinks: this.config.tracking?.trackOutboundLinks,
    })
  }

  /**
   * Track a page view (server-side)
   */
  async trackPageView(options: {
    path: string
    title?: string
    referrer?: string
    visitorId: string
    sessionId: string
    userAgent?: string
    ip?: string
  }): Promise<void> {
    const deviceInfo = AnalyticsStore.parseUserAgent(options.userAgent || '')
    const referrerSource = AnalyticsStore.parseReferrerSource(options.referrer)
    const timestamp = new Date()

    const pageView = {
      id: AnalyticsStore.generateId(),
      siteId: this.config.siteId,
      visitorId: options.visitorId,
      sessionId: options.sessionId,
      path: options.path,
      hostname: '',
      title: options.title,
      referrer: options.referrer,
      referrerSource,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      browserVersion: deviceInfo.browserVersion,
      os: deviceInfo.os,
      osVersion: deviceInfo.osVersion,
      isUnique: true,
      isBounce: true,
      timestamp,
    }

    const command = this.store.recordPageViewCommand(pageView)
    await this.executeCommand(command)
  }

  /**
   * Track a custom event (server-side)
   */
  async trackEvent(options: {
    name: string
    value?: number
    properties?: Record<string, string | number | boolean>
    path: string
    visitorId: string
    sessionId: string
  }): Promise<void> {
    const event = {
      id: AnalyticsStore.generateId(),
      siteId: this.config.siteId,
      visitorId: options.visitorId,
      sessionId: options.sessionId,
      name: options.name,
      value: options.value,
      properties: options.properties,
      path: options.path,
      timestamp: new Date(),
    }

    const command = this.store.recordCustomEventCommand(event)
    await this.executeCommand(command)
  }

  /**
   * Get dashboard summary stats
   */
  async getDashboardStats(options?: {
    startDate?: Date
    endDate?: Date
    includeComparison?: boolean
  }): Promise<{
    summary: ReturnType<typeof AnalyticsQueryAPI.processSummary>
    timeSeries: ReturnType<typeof AnalyticsQueryAPI.processTimeSeries>
  }> {
    const startDate = options?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const endDate = options?.endDate || new Date()

    const queries = this.queryApi.generateDashboardQueries({
      siteId: this.config.siteId,
      dateRange: { start: startDate, end: endDate },
      includeComparison: options?.includeComparison,
    })

    const [statsResult, previousResult] = await Promise.all([
      this.executeCommand(queries.aggregatedStats),
      queries.previousPeriodStats ? this.executeCommand(queries.previousPeriodStats) : null,
    ])

    const stats = (statsResult as { Items?: unknown[] })?.Items || []
    const previousStats = previousResult
      ? (previousResult as { Items?: unknown[] })?.Items || []
      : undefined

    return {
      summary: AnalyticsQueryAPI.processSummary(
        stats as Parameters<typeof AnalyticsQueryAPI.processSummary>[0],
        previousStats as Parameters<typeof AnalyticsQueryAPI.processSummary>[1],
      ),
      timeSeries: AnalyticsQueryAPI.processTimeSeries(
        stats as Parameters<typeof AnalyticsQueryAPI.processTimeSeries>[0],
      ),
    }
  }

  /**
   * Get realtime visitor count
   */
  async getRealtimeVisitors(minutes = 5): Promise<{
    currentVisitors: number
    pageViewsLastHour: number
    topActivePages: Array<{ name: string, value: number, percentage: number }>
  }> {
    const command = this.store.getRealtimeStatsCommand(this.config.siteId, minutes)
    const result = await this.executeCommand(command) as { Items?: unknown[] }

    return AnalyticsQueryAPI.processRealtimeData(
      (result.Items || []) as Parameters<typeof AnalyticsQueryAPI.processRealtimeData>[0],
    )
  }

  /**
   * Get top pages
   */
  async getTopPages(options?: {
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Promise<unknown[]> {
    const endDate = options?.endDate || new Date()
    const dateRange = {
      start: options?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: endDate,
    }
    const period = AnalyticsQueryAPI.determinePeriod(dateRange)
    const periodStart = AnalyticsStore.getPeriodStart(endDate, period)

    const command = this.store.getTopPagesCommand(
      this.config.siteId,
      period,
      periodStart,
      options?.limit || 10,
    )

    const result = await this.executeCommand(command) as { Items?: unknown[] }
    return result.Items || []
  }

  /**
   * Run aggregation for a time period
   */
  async runAggregation(period: 'hour' | 'day' | 'month'): Promise<{
    success: boolean
    config: ReturnType<typeof AggregationPipeline.createJobConfig>
  }> {
    const config = AggregationPipeline.createJobConfig(this.config.siteId, period)

    // Note: In a real implementation, you would:
    // 1. Query raw page views and sessions for the window
    // 2. Run the aggregation job
    // 3. Execute the generated commands

    return {
      success: true,
      config,
    }
  }

  /**
   * Get the underlying API instance for advanced usage
   */
  getAPI(): AnalyticsAPI {
    return this.api
  }

  /**
   * Get the underlying store for advanced queries
   */
  getStore(): AnalyticsStore {
    return this.store
  }
}

// ============================================================================
// Stacks Middleware
// ============================================================================

/**
 * Create Stacks analytics middleware
 * Injects tracking script into HTML responses
 */
export function createAnalyticsMiddleware(driver: DynamoDBAnalyticsDriver) {
  const script = driver.getTrackingScript()

  return async (ctx: {
    request: Request
    response?: Response
    html?: string
  }, next: () => Promise<void>) => {
    await next()

    // Inject script into HTML responses
    if (ctx.html && ctx.html.includes('</head>')) {
      ctx.html = ctx.html.replace('</head>', `${script}\n</head>`)
    }
  }
}

/**
 * Create server-side tracking middleware
 * Tracks page views automatically for server-rendered pages
 */
export function createServerTrackingMiddleware(
  driver: DynamoDBAnalyticsDriver,
  options?: {
    excludedPaths?: RegExp[]
    getVisitorId?: (request: Request) => string
    getSessionId?: (request: Request) => string
  },
) {
  return async (ctx: {
    request: Request
    url: URL
  }, next: () => Promise<void>) => {
    const { request, url } = ctx

    // Check excluded paths
    if (options?.excludedPaths?.some(pattern => pattern.test(url.pathname))) {
      return next()
    }

    // Get or generate visitor/session IDs
    const visitorId = options?.getVisitorId?.(request)
      || request.headers.get('x-visitor-id')
      || AnalyticsStore.generateId()

    const sessionId = options?.getSessionId?.(request)
      || request.headers.get('x-session-id')
      || AnalyticsStore.generateId()

    // Track page view asynchronously (don't block response)
    driver.trackPageView({
      path: url.pathname,
      referrer: request.headers.get('referer') || undefined,
      visitorId,
      sessionId,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || undefined,
    }).catch(err => console.error('Failed to track page view:', err))

    return next()
  }
}

// ============================================================================
// Stacks Actions (Dashboard API)
// ============================================================================

/**
 * Create Stacks dashboard actions for analytics
 */
export function createDashboardActions(driver: DynamoDBAnalyticsDriver) {
  return {
    /**
     * Get dashboard stats action
     */
    async getDashboardStats(params: {
      startDate?: string
      endDate?: string
      compare?: boolean
    }) {
      return driver.getDashboardStats({
        startDate: params.startDate ? new Date(params.startDate) : undefined,
        endDate: params.endDate ? new Date(params.endDate) : undefined,
        includeComparison: params.compare,
      })
    },

    /**
     * Get realtime stats action
     */
    async getRealtimeStats(params?: { minutes?: number }) {
      return driver.getRealtimeVisitors(params?.minutes)
    },

    /**
     * Get top pages action
     */
    async getTopPages(params?: {
      startDate?: string
      endDate?: string
      limit?: number
    }) {
      return driver.getTopPages({
        startDate: params?.startDate ? new Date(params.startDate) : undefined,
        endDate: params?.endDate ? new Date(params.endDate) : undefined,
        limit: params?.limit,
      })
    },

    /**
     * Trigger aggregation action
     */
    async runAggregation(params: { period: 'hour' | 'day' | 'month' }) {
      return driver.runAggregation(params.period)
    },
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a DynamoDB analytics driver from Stacks config
 *
 * @example
 * ```typescript
 * import { createAnalyticsDriver } from '@stacksjs/dynamodb-tooling'
 * import config from './config/analytics'
 * import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
 *
 * const client = new DynamoDBClient({ region: 'us-east-1' })
 * const driver = createAnalyticsDriver(config.drivers.dynamodb!, async (cmd) => {
 *   // Execute DynamoDB command
 *   return client.send(new cmd.command(cmd.input))
 * })
 * ```
 */
export function createAnalyticsDriver(
  config: DynamoDBAnalyticsConfig,
  executeCommand: HandlerContext['executeCommand'],
): DynamoDBAnalyticsDriver {
  return new DynamoDBAnalyticsDriver(config, executeCommand)
}

// ============================================================================
// Type Exports for Stacks Integration
// ============================================================================

export type {
  AnalyticsAPIConfig,
  HandlerContext,
}
