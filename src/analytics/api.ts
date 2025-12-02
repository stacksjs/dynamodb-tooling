// ============================================================================
// Analytics API Handlers
// ============================================================================
// HTTP handlers for analytics endpoints, designed to work with any server framework
// (Bun, Express, Hono, AWS Lambda, Cloudflare Workers, etc.)

import {
  AggregationPipeline,
  AnalyticsAggregator,
  AnalyticsKeyPatterns,
  AnalyticsQueryAPI,
  AnalyticsStore,
  generateTrackingScript,
  GoalMatcher,
  type AggregationPeriod,
  type CustomEvent,
  type Goal,
  type PageView,
  type Session,
  type Site,
  type SiteSettings,
} from './Analytics'

// ============================================================================
// Types
// ============================================================================

/**
 * Generic HTTP request interface (framework-agnostic)
 */
export interface AnalyticsRequest {
  method: string
  path: string
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
  headers: Record<string, string>
  ip?: string
  userAgent?: string
}

/**
 * Generic HTTP response interface
 */
export interface AnalyticsResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

/**
 * API handler context
 */
export interface HandlerContext {
  store: AnalyticsStore
  queryApi: AnalyticsQueryAPI
  pipeline: AggregationPipeline
  /** Daily rotating salt for visitor ID hashing */
  visitorSalt: string
  /** Function to execute DynamoDB commands */
  executeCommand: (command: { command: string, input: Record<string, unknown> }) => Promise<unknown>
  /** Optional: Function to get goals for a site */
  getGoals?: (siteId: string) => Promise<Goal[]>
  /** Optional: Function to get site by ID */
  getSite?: (siteId: string) => Promise<Site | null>
  /** Optional: Session store for managing visitor sessions */
  sessionStore?: SessionStore
}

/**
 * Simple in-memory session store interface
 */
export interface SessionStore {
  get(key: string): Promise<Session | null>
  set(key: string, session: Session, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
}

/**
 * Collect endpoint payload (from tracking script)
 */
export interface CollectPayload {
  /** Site ID */
  s: string
  /** Session ID */
  sid: string
  /** Event type */
  e: 'pageview' | 'event' | 'outbound'
  /** Event properties */
  p?: Record<string, unknown>
  /** Current URL */
  u: string
  /** Referrer */
  r?: string
  /** Page title */
  t?: string
  /** Screen width */
  sw?: number
  /** Screen height */
  sh?: number
}

/**
 * API configuration
 */
export interface AnalyticsAPIConfig {
  /** DynamoDB table name */
  tableName: string
  /** CORS allowed origins */
  corsOrigins?: string[]
  /** Whether to use TTL for raw events */
  useTtl?: boolean
  /** Raw event TTL in seconds */
  rawEventTtl?: number
  /** Base path for API routes */
  basePath?: string
}

// ============================================================================
// Analytics API Handler Class
// ============================================================================

/**
 * Analytics API - handles all analytics HTTP endpoints
 */
export class AnalyticsAPI {
  private config: Required<AnalyticsAPIConfig>
  private store: AnalyticsStore
  private queryApi: AnalyticsQueryAPI
  private pipeline: AggregationPipeline

  constructor(config: AnalyticsAPIConfig) {
    this.config = {
      corsOrigins: ['*'],
      useTtl: true,
      rawEventTtl: 30 * 24 * 60 * 60,
      basePath: '/api/analytics',
      ...config,
    }

    this.store = new AnalyticsStore({
      tableName: this.config.tableName,
      useTtl: this.config.useTtl,
      rawEventTtl: this.config.rawEventTtl,
    })

    this.queryApi = new AnalyticsQueryAPI(this.store)
    this.pipeline = new AggregationPipeline(this.store)
  }

  /**
   * Create handler context for request processing
   */
  createContext(
    executeCommand: HandlerContext['executeCommand'],
    options?: Partial<Pick<HandlerContext, 'getGoals' | 'getSite' | 'sessionStore'>>,
  ): HandlerContext {
    return {
      store: this.store,
      queryApi: this.queryApi,
      pipeline: this.pipeline,
      visitorSalt: this.getDailySalt(),
      executeCommand,
      ...options,
    }
  }

  /**
   * Get daily rotating salt for visitor ID hashing
   */
  private getDailySalt(): string {
    const today = new Date().toISOString().slice(0, 10)
    return `analytics-salt-${today}`
  }

  /**
   * Get CORS headers
   */
  getCorsHeaders(origin?: string): Record<string, string> {
    const allowedOrigin = this.config.corsOrigins.includes('*')
      ? '*'
      : (origin && this.config.corsOrigins.includes(origin) ? origin : this.config.corsOrigins[0])

    return {
      'Access-Control-Allow-Origin': allowedOrigin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  }

  // ==========================================================================
  // Route Handlers
  // ==========================================================================

  /**
   * Handle OPTIONS preflight request
   */
  handleOptions(req: AnalyticsRequest): AnalyticsResponse {
    return {
      status: 204,
      headers: this.getCorsHeaders(req.headers.origin),
      body: null,
    }
  }

  /**
   * POST /collect - Receive tracking events from JavaScript snippet
   */
  async handleCollect(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const payload = req.body as CollectPayload

      if (!payload?.s || !payload?.e || !payload?.u) {
        return this.errorResponse(400, 'Missing required fields: s, e, u')
      }

      // Hash visitor ID for privacy
      const visitorId = await AnalyticsStore.hashVisitorId(
        req.ip || 'unknown',
        req.userAgent || req.headers['user-agent'] || 'unknown',
        payload.s,
        ctx.visitorSalt,
      )

      // Parse URL
      let parsedUrl: URL
      try {
        parsedUrl = new URL(payload.u)
      }
      catch {
        return this.errorResponse(400, 'Invalid URL')
      }

      const timestamp = new Date()
      const sessionId = payload.sid

      // Get or create session
      let session = ctx.sessionStore ? await ctx.sessionStore.get(`${payload.s}:${sessionId}`) : null
      const isNewSession = !session
      const isUnique = isNewSession

      if (payload.e === 'pageview') {
        // Parse device info from user agent
        const deviceInfo = AnalyticsStore.parseUserAgent(req.userAgent || req.headers['user-agent'] || '')
        const referrerSource = AnalyticsStore.parseReferrerSource(payload.r)

        // Parse UTM parameters from URL
        const utmSource = parsedUrl.searchParams.get('utm_source') || undefined
        const utmMedium = parsedUrl.searchParams.get('utm_medium') || undefined
        const utmCampaign = parsedUrl.searchParams.get('utm_campaign') || undefined
        const utmContent = parsedUrl.searchParams.get('utm_content') || undefined
        const utmTerm = parsedUrl.searchParams.get('utm_term') || undefined

        // Create page view record
        const pageView: PageView = {
          id: AnalyticsStore.generateId(),
          siteId: payload.s,
          visitorId,
          sessionId,
          path: parsedUrl.pathname,
          hostname: parsedUrl.hostname,
          title: payload.t,
          referrer: payload.r,
          referrerSource,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          browserVersion: deviceInfo.browserVersion,
          os: deviceInfo.os,
          osVersion: deviceInfo.osVersion,
          screenWidth: payload.sw,
          screenHeight: payload.sh,
          isUnique,
          isBounce: isNewSession, // Will be updated if more pages viewed
          timestamp,
        }

        // Store page view
        const pvCommand = this.store.recordPageViewCommand(pageView)
        await ctx.executeCommand(pvCommand)

        // Update or create session
        if (session) {
          session.pageViewCount += 1
          session.exitPath = parsedUrl.pathname
          session.endedAt = timestamp
          session.isBounce = false
          session.duration = timestamp.getTime() - session.startedAt.getTime()
        }
        else {
          session = {
            id: sessionId,
            siteId: payload.s,
            visitorId,
            entryPath: parsedUrl.pathname,
            exitPath: parsedUrl.pathname,
            referrer: payload.r,
            referrerSource,
            utmSource,
            utmMedium,
            utmCampaign,
            country: undefined, // Would need geo lookup
            deviceType: deviceInfo.deviceType,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            pageViewCount: 1,
            eventCount: 0,
            isBounce: true,
            duration: 0,
            startedAt: timestamp,
            endedAt: timestamp,
          }
        }

        // Store session
        const sessionCommand = this.store.upsertSessionCommand(session)
        await ctx.executeCommand(sessionCommand)

        if (ctx.sessionStore) {
          await ctx.sessionStore.set(`${payload.s}:${sessionId}`, session, 1800) // 30 min TTL
        }

        // Update realtime stats
        const minute = timestamp.toISOString().slice(0, 16)
        const realtimeCommand = this.store.updateRealtimeStatsCommand({
          siteId: payload.s,
          minute,
          currentVisitors: 1, // Simplified - would need proper counting
          pageViews: 1,
          activePages: { [parsedUrl.pathname]: 1 },
          ttl: Math.floor(Date.now() / 1000) + 600, // 10 min TTL
        })
        await ctx.executeCommand(realtimeCommand)

        // Check for goal conversions
        if (ctx.getGoals) {
          const goals = await ctx.getGoals(payload.s)
          if (goals.length > 0) {
            const matcher = new GoalMatcher(goals)
            const matches = matcher.matchPageView(pageView)
            // Note: Conversions are typically tracked during aggregation, not real-time
            // This could be extended to store real-time conversion events
          }
        }
      }
      else if (payload.e === 'event') {
        // Custom event
        const eventProps = payload.p || {}
        const customEvent: CustomEvent = {
          id: AnalyticsStore.generateId(),
          siteId: payload.s,
          visitorId,
          sessionId,
          name: String(eventProps.name || 'unknown'),
          value: typeof eventProps.value === 'number' ? eventProps.value : undefined,
          properties: eventProps as Record<string, string | number | boolean>,
          path: parsedUrl.pathname,
          timestamp,
        }

        const eventCommand = this.store.recordCustomEventCommand(customEvent)
        await ctx.executeCommand(eventCommand)

        // Update session event count
        if (session) {
          session.eventCount += 1
          session.endedAt = timestamp
          const sessionCommand = this.store.upsertSessionCommand(session)
          await ctx.executeCommand(sessionCommand)

          if (ctx.sessionStore) {
            await ctx.sessionStore.set(`${payload.s}:${sessionId}`, session, 1800)
          }
        }
      }
      else if (payload.e === 'outbound') {
        // Outbound link click - tracked as custom event
        const customEvent: CustomEvent = {
          id: AnalyticsStore.generateId(),
          siteId: payload.s,
          visitorId,
          sessionId,
          name: 'outbound_click',
          properties: { url: String(payload.p?.url || '') },
          path: parsedUrl.pathname,
          timestamp,
        }

        const eventCommand = this.store.recordCustomEventCommand(customEvent)
        await ctx.executeCommand(eventCommand)
      }

      // Return 1x1 transparent GIF or empty response
      return {
        status: 204,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
        body: null,
      }
    }
    catch (error) {
      console.error('Collect error:', error)
      return this.errorResponse(500, 'Internal server error')
    }
  }

  /**
   * GET /sites - List sites for current user
   */
  async handleListSites(
    req: AnalyticsRequest,
    ctx: HandlerContext,
    ownerId: string,
  ): Promise<AnalyticsResponse> {
    try {
      const command = this.store.listSitesByOwnerCommand(ownerId)
      const result = await ctx.executeCommand(command) as { Items?: unknown[] }

      return {
        status: 200,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: {
          sites: result.Items || [],
        },
      }
    }
    catch (error) {
      console.error('List sites error:', error)
      return this.errorResponse(500, 'Failed to list sites')
    }
  }

  /**
   * POST /sites - Create a new site
   */
  async handleCreateSite(
    req: AnalyticsRequest,
    ctx: HandlerContext,
    ownerId: string,
  ): Promise<AnalyticsResponse> {
    try {
      const body = req.body as Partial<Site>

      if (!body.name || !body.domains?.length) {
        return this.errorResponse(400, 'Missing required fields: name, domains')
      }

      const now = new Date()
      const site: Site = {
        id: AnalyticsStore.generateId(),
        name: body.name,
        domains: body.domains,
        timezone: body.timezone || 'UTC',
        isActive: true,
        ownerId,
        settings: body.settings || this.getDefaultSiteSettings(),
        createdAt: now,
        updatedAt: now,
      }

      const command = this.store.createSiteCommand(site)
      await ctx.executeCommand(command)

      return {
        status: 201,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: { site },
      }
    }
    catch (error) {
      console.error('Create site error:', error)
      return this.errorResponse(500, 'Failed to create site')
    }
  }

  /**
   * GET /sites/:siteId - Get site details
   */
  async handleGetSite(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const { siteId } = req.params

      if (!siteId) {
        return this.errorResponse(400, 'Missing siteId')
      }

      const command = this.store.getSiteCommand(siteId)
      const result = await ctx.executeCommand(command) as { Item?: unknown }

      if (!result.Item) {
        return this.errorResponse(404, 'Site not found')
      }

      return {
        status: 200,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: { site: result.Item },
      }
    }
    catch (error) {
      console.error('Get site error:', error)
      return this.errorResponse(500, 'Failed to get site')
    }
  }

  /**
   * GET /sites/:siteId/stats - Get dashboard stats
   */
  async handleGetStats(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const { siteId } = req.params
      const { start, end, period, compare } = req.query

      if (!siteId) {
        return this.errorResponse(400, 'Missing siteId')
      }

      // Parse date range
      const startDate = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Default: last 7 days
      const endDate = end ? new Date(end) : new Date()

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return this.errorResponse(400, 'Invalid date format')
      }

      const dateRange = { start: startDate, end: endDate }
      const queries = ctx.queryApi.generateDashboardQueries({
        siteId,
        dateRange,
        includeComparison: compare === 'true',
        includeRealtime: true,
        includeGoals: true,
        topLimit: 10,
      })

      // Execute queries in parallel
      const [aggregatedResult, topPagesResult, realtimeResult, goalsResult, previousResult] = await Promise.all([
        ctx.executeCommand(queries.aggregatedStats),
        ctx.executeCommand(queries.topPages),
        queries.realtimeStats ? ctx.executeCommand(queries.realtimeStats) : null,
        queries.goals ? ctx.executeCommand(queries.goals) : null,
        queries.previousPeriodStats ? ctx.executeCommand(queries.previousPeriodStats) : null,
      ])

      // Process results
      const stats = (aggregatedResult as { Items?: unknown[] })?.Items || []
      const previousStats = previousResult ? (previousResult as { Items?: unknown[] })?.Items || [] : undefined

      const summary = AnalyticsQueryAPI.processSummary(
        stats as Parameters<typeof AnalyticsQueryAPI.processSummary>[0],
        previousStats as Parameters<typeof AnalyticsQueryAPI.processSummary>[1],
      )
      const timeSeries = AnalyticsQueryAPI.processTimeSeries(
        stats as Parameters<typeof AnalyticsQueryAPI.processTimeSeries>[0],
      )

      return {
        status: 200,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: {
          summary,
          timeSeries,
          topPages: (topPagesResult as { Items?: unknown[] })?.Items || [],
          realtime: realtimeResult ? (realtimeResult as { Items?: unknown[] })?.Items || [] : null,
          goals: goalsResult ? (goalsResult as { Items?: unknown[] })?.Items || [] : null,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            period: period || AnalyticsQueryAPI.determinePeriod(dateRange),
          },
        },
      }
    }
    catch (error) {
      console.error('Get stats error:', error)
      return this.errorResponse(500, 'Failed to get stats')
    }
  }

  /**
   * GET /sites/:siteId/realtime - Get realtime stats
   */
  async handleGetRealtime(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const { siteId } = req.params
      const minutes = Number.parseInt(req.query.minutes || '5', 10)

      if (!siteId) {
        return this.errorResponse(400, 'Missing siteId')
      }

      const command = this.store.getRealtimeStatsCommand(siteId, minutes)
      const result = await ctx.executeCommand(command) as { Items?: unknown[] }

      const realtimeData = AnalyticsQueryAPI.processRealtimeData(
        (result.Items || []) as Parameters<typeof AnalyticsQueryAPI.processRealtimeData>[0],
      )

      return {
        status: 200,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: realtimeData,
      }
    }
    catch (error) {
      console.error('Get realtime error:', error)
      return this.errorResponse(500, 'Failed to get realtime stats')
    }
  }

  /**
   * GET /sites/:siteId/script - Get tracking script
   */
  handleGetScript(req: AnalyticsRequest): AnalyticsResponse {
    const { siteId } = req.params
    const apiEndpoint = req.query.api || `${req.headers.host}${this.config.basePath}`

    if (!siteId) {
      return this.errorResponse(400, 'Missing siteId')
    }

    const script = generateTrackingScript({
      siteId,
      apiEndpoint: apiEndpoint.startsWith('http') ? apiEndpoint : `https://${apiEndpoint}`,
      honorDnt: req.query.dnt !== 'false',
      trackHashChanges: req.query.hash === 'true',
      trackOutboundLinks: req.query.outbound !== 'false',
    })

    return {
      status: 200,
      headers: {
        ...this.getCorsHeaders(req.headers.origin),
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600',
      },
      body: script,
    }
  }

  /**
   * GET /sites/:siteId/goals - List goals
   */
  async handleListGoals(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const { siteId } = req.params

      if (!siteId) {
        return this.errorResponse(400, 'Missing siteId')
      }

      const command = this.store.listGoalsCommand(siteId)
      const result = await ctx.executeCommand(command) as { Items?: unknown[] }

      return {
        status: 200,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: { goals: result.Items || [] },
      }
    }
    catch (error) {
      console.error('List goals error:', error)
      return this.errorResponse(500, 'Failed to list goals')
    }
  }

  /**
   * POST /sites/:siteId/goals - Create a goal
   */
  async handleCreateGoal(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const { siteId } = req.params
      const body = req.body as Partial<Goal>

      if (!siteId) {
        return this.errorResponse(400, 'Missing siteId')
      }

      if (!body.name || !body.type || !body.pattern || !body.matchType) {
        return this.errorResponse(400, 'Missing required fields: name, type, pattern, matchType')
      }

      const now = new Date()
      const goal: Goal = {
        id: AnalyticsStore.generateId(),
        siteId,
        name: body.name,
        type: body.type,
        pattern: body.pattern,
        matchType: body.matchType,
        value: body.value,
        isActive: body.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      }

      const command = this.store.createGoalCommand(goal)
      await ctx.executeCommand(command)

      return {
        status: 201,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: { goal },
      }
    }
    catch (error) {
      console.error('Create goal error:', error)
      return this.errorResponse(500, 'Failed to create goal')
    }
  }

  /**
   * GET /sites/:siteId/pages - Get top pages
   */
  async handleGetTopPages(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const { siteId } = req.params
      const { start, end, limit } = req.query

      if (!siteId) {
        return this.errorResponse(400, 'Missing siteId')
      }

      const startDate = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const endDate = end ? new Date(end) : new Date()
      const dateRange = { start: startDate, end: endDate }
      const period = AnalyticsQueryAPI.determinePeriod(dateRange)
      const periodStart = AnalyticsStore.getPeriodStart(endDate, period)

      const command = this.store.getTopPagesCommand(
        siteId,
        period,
        periodStart,
        Number.parseInt(limit || '10', 10),
      )
      const result = await ctx.executeCommand(command) as { Items?: unknown[] }

      return {
        status: 200,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: { pages: result.Items || [] },
      }
    }
    catch (error) {
      console.error('Get top pages error:', error)
      return this.errorResponse(500, 'Failed to get top pages')
    }
  }

  /**
   * POST /aggregate - Trigger aggregation (for scheduled jobs)
   */
  async handleAggregate(
    req: AnalyticsRequest,
    ctx: HandlerContext,
  ): Promise<AnalyticsResponse> {
    try {
      const body = req.body as {
        siteId: string
        period: AggregationPeriod
        windowStart?: string
        windowEnd?: string
      }

      if (!body.siteId || !body.period) {
        return this.errorResponse(400, 'Missing required fields: siteId, period')
      }

      // Create job config
      const config = body.windowStart && body.windowEnd
        ? {
            siteId: body.siteId,
            period: body.period,
            windowStart: new Date(body.windowStart),
            windowEnd: new Date(body.windowEnd),
            deleteRawEvents: body.period === 'hour',
          }
        : AggregationPipeline.createJobConfig(body.siteId, body.period)

      // Fetch raw data for the window
      // Note: In production, this would query DynamoDB for the raw events
      // For now, return the job config and let the caller handle data fetching
      return {
        status: 200,
        headers: {
          ...this.getCorsHeaders(req.headers.origin),
          'Content-Type': 'application/json',
        },
        body: {
          message: 'Aggregation job created',
          config,
          nextScheduledTimes: AggregationPipeline.getScheduledJobTimes(),
        },
      }
    }
    catch (error) {
      console.error('Aggregate error:', error)
      return this.errorResponse(500, 'Failed to create aggregation job')
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Create error response
   */
  private errorResponse(status: number, message: string): AnalyticsResponse {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
      body: { error: message },
    }
  }

  /**
   * Get default site settings
   */
  private getDefaultSiteSettings(): SiteSettings {
    return {
      collectGeolocation: false,
      trackReferrers: true,
      trackUtmParams: true,
      trackDeviceType: true,
      publicDashboard: false,
      excludedPaths: [],
      excludedIps: [],
      dataRetentionDays: 365,
    }
  }

  /**
   * Get store instance
   */
  getStore(): AnalyticsStore {
    return this.store
  }

  /**
   * Get query API instance
   */
  getQueryAPI(): AnalyticsQueryAPI {
    return this.queryApi
  }

  /**
   * Get pipeline instance
   */
  getPipeline(): AggregationPipeline {
    return this.pipeline
  }
}

// ============================================================================
// Framework Adapters
// ============================================================================

/**
 * Create a Bun/Hono compatible router handler
 */
export function createBunRouter(api: AnalyticsAPI, executeCommand: HandlerContext['executeCommand']) {
  const ctx = api.createContext(executeCommand)

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url)
      const path = url.pathname
      const method = request.method

      // Parse request into AnalyticsRequest format
      const req: AnalyticsRequest = {
        method,
        path,
        params: {},
        query: Object.fromEntries(url.searchParams),
        body: method !== 'GET' ? await request.json().catch(() => ({})) : {},
        headers: Object.fromEntries(request.headers as unknown as Iterable<[string, string]>),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      }

      // Route matching (simplified - use a proper router in production)
      let response: AnalyticsResponse

      if (method === 'OPTIONS') {
        response = api.handleOptions(req)
      }
      else if (method === 'POST' && path.endsWith('/collect')) {
        response = await api.handleCollect(req, ctx)
      }
      else if (method === 'GET' && path.match(/\/sites\/[^/]+\/stats$/)) {
        req.params.siteId = path.split('/').slice(-2)[0]
        response = await api.handleGetStats(req, ctx)
      }
      else if (method === 'GET' && path.match(/\/sites\/[^/]+\/realtime$/)) {
        req.params.siteId = path.split('/').slice(-2)[0]
        response = await api.handleGetRealtime(req, ctx)
      }
      else if (method === 'GET' && path.match(/\/sites\/[^/]+\/script$/)) {
        req.params.siteId = path.split('/').slice(-2)[0]
        response = api.handleGetScript(req)
      }
      else if (method === 'GET' && path.match(/\/sites\/[^/]+\/goals$/)) {
        req.params.siteId = path.split('/').slice(-2)[0]
        response = await api.handleListGoals(req, ctx)
      }
      else if (method === 'POST' && path.match(/\/sites\/[^/]+\/goals$/)) {
        req.params.siteId = path.split('/').slice(-2)[0]
        response = await api.handleCreateGoal(req, ctx)
      }
      else if (method === 'GET' && path.match(/\/sites\/[^/]+\/pages$/)) {
        req.params.siteId = path.split('/').slice(-2)[0]
        response = await api.handleGetTopPages(req, ctx)
      }
      else if (method === 'GET' && path.match(/\/sites\/[^/]+$/)) {
        req.params.siteId = path.split('/').pop()!
        response = await api.handleGetSite(req, ctx)
      }
      else {
        response = {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Not found' },
        }
      }

      return new Response(
        response.body ? JSON.stringify(response.body) : null,
        {
          status: response.status,
          headers: response.headers,
        },
      )
    },
  }
}

/**
 * Create AWS Lambda handler
 */
export function createLambdaHandler(api: AnalyticsAPI, executeCommand: HandlerContext['executeCommand']) {
  const ctx = api.createContext(executeCommand)

  return async (event: {
    httpMethod: string
    path: string
    pathParameters?: Record<string, string>
    queryStringParameters?: Record<string, string>
    body?: string
    headers: Record<string, string>
    requestContext?: { identity?: { sourceIp?: string } }
  }) => {
    const req: AnalyticsRequest = {
      method: event.httpMethod,
      path: event.path,
      params: event.pathParameters || {},
      query: event.queryStringParameters || {},
      body: event.body ? JSON.parse(event.body) : {},
      headers: event.headers,
      ip: event.requestContext?.identity?.sourceIp,
      userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
    }

    let response: AnalyticsResponse

    // Route based on path and method
    if (req.method === 'OPTIONS') {
      response = api.handleOptions(req)
    }
    else if (req.method === 'POST' && req.path.endsWith('/collect')) {
      response = await api.handleCollect(req, ctx)
    }
    else if (req.method === 'GET' && req.params.siteId && req.path.endsWith('/stats')) {
      response = await api.handleGetStats(req, ctx)
    }
    else if (req.method === 'GET' && req.params.siteId && req.path.endsWith('/realtime')) {
      response = await api.handleGetRealtime(req, ctx)
    }
    else if (req.method === 'GET' && req.params.siteId && req.path.endsWith('/script')) {
      response = api.handleGetScript(req)
    }
    else if (req.method === 'GET' && req.params.siteId && req.path.endsWith('/goals')) {
      response = await api.handleListGoals(req, ctx)
    }
    else if (req.method === 'POST' && req.params.siteId && req.path.endsWith('/goals')) {
      response = await api.handleCreateGoal(req, ctx)
    }
    else if (req.method === 'GET' && req.params.siteId && !req.path.includes('/')) {
      response = await api.handleGetSite(req, ctx)
    }
    else if (req.method === 'POST' && req.path.endsWith('/aggregate')) {
      response = await api.handleAggregate(req, ctx)
    }
    else {
      response = {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Not found' },
      }
    }

    return {
      statusCode: response.status,
      headers: response.headers,
      body: response.body ? JSON.stringify(response.body) : '',
    }
  }
}
