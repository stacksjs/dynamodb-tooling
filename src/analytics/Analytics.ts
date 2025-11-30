// ============================================================================
// Analytics - Privacy-Focused Web Analytics for DynamoDB Single-Table Design
// ============================================================================
// Inspired by Fathom Analytics - simple, privacy-first analytics
// Designed for DynamoDB single-table pattern with efficient access patterns

/**
 * Site/Website being tracked
 */
export interface Site {
  /** Unique site ID */
  id: string
  /** Site name */
  name: string
  /** Domain(s) for this site */
  domains: string[]
  /** Site timezone */
  timezone: string
  /** Whether site is active */
  isActive: boolean
  /** Owner user ID */
  ownerId: string
  /** Site settings */
  settings: SiteSettings
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
}

/**
 * Site settings
 */
export interface SiteSettings {
  /** Whether to collect IP-based geolocation (privacy setting) */
  collectGeolocation: boolean
  /** Whether to track referrers */
  trackReferrers: boolean
  /** Whether to track UTM parameters */
  trackUtmParams: boolean
  /** Whether to track device type */
  trackDeviceType: boolean
  /** Custom domain for tracking script */
  customDomain?: string
  /** Public dashboard enabled */
  publicDashboard: boolean
  /** Public dashboard password (hashed) */
  publicDashboardPassword?: string
  /** Excluded paths (regex patterns) */
  excludedPaths: string[]
  /** Excluded IPs */
  excludedIps: string[]
  /** Data retention days (0 = forever) */
  dataRetentionDays: number
}

/**
 * Page view event (raw event - stored temporarily for aggregation)
 */
export interface PageView {
  /** Unique page view ID */
  id: string
  /** Site ID */
  siteId: string
  /** Visitor ID (hashed, anonymous) */
  visitorId: string
  /** Session ID */
  sessionId: string
  /** Page path */
  path: string
  /** Page hostname */
  hostname: string
  /** Page title (optional) */
  title?: string
  /** Referrer URL */
  referrer?: string
  /** Referrer source (e.g., google, twitter, direct) */
  referrerSource?: string
  /** UTM source */
  utmSource?: string
  /** UTM medium */
  utmMedium?: string
  /** UTM campaign */
  utmCampaign?: string
  /** UTM content */
  utmContent?: string
  /** UTM term */
  utmTerm?: string
  /** Country code (ISO 3166-1 alpha-2) */
  country?: string
  /** Region/state */
  region?: string
  /** City */
  city?: string
  /** Device type */
  deviceType?: DeviceType
  /** Browser name */
  browser?: string
  /** Browser version */
  browserVersion?: string
  /** Operating system */
  os?: string
  /** OS version */
  osVersion?: string
  /** Screen width */
  screenWidth?: number
  /** Screen height */
  screenHeight?: number
  /** Is unique (first page view in session) */
  isUnique: boolean
  /** Is bounce (only page view in session) */
  isBounce: boolean
  /** Time on page (milliseconds) - updated on next page view or session end */
  timeOnPage?: number
  /** Timestamp */
  timestamp: Date
  /** TTL for auto-deletion after aggregation */
  ttl?: number
}

/**
 * Device type
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

/**
 * Custom event (non-pageview events like button clicks, form submissions)
 */
export interface CustomEvent {
  /** Unique event ID */
  id: string
  /** Site ID */
  siteId: string
  /** Visitor ID (hashed, anonymous) */
  visitorId: string
  /** Session ID */
  sessionId: string
  /** Event name */
  name: string
  /** Event value (optional, for revenue tracking etc.) */
  value?: number
  /** Event properties */
  properties?: Record<string, string | number | boolean>
  /** Page path where event occurred */
  path: string
  /** Timestamp */
  timestamp: Date
  /** TTL for auto-deletion after aggregation */
  ttl?: number
}

/**
 * Session (visitor session)
 */
export interface Session {
  /** Session ID */
  id: string
  /** Site ID */
  siteId: string
  /** Visitor ID (hashed, anonymous) */
  visitorId: string
  /** Entry page path */
  entryPath: string
  /** Exit page path */
  exitPath: string
  /** Referrer URL */
  referrer?: string
  /** Referrer source */
  referrerSource?: string
  /** UTM parameters */
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  /** Country code */
  country?: string
  /** Device type */
  deviceType?: DeviceType
  /** Browser */
  browser?: string
  /** OS */
  os?: string
  /** Page view count */
  pageViewCount: number
  /** Event count */
  eventCount: number
  /** Is bounce (single page session) */
  isBounce: boolean
  /** Session duration (milliseconds) */
  duration: number
  /** Session start */
  startedAt: Date
  /** Session end (last activity) */
  endedAt: Date
  /** TTL for auto-deletion */
  ttl?: number
}

/**
 * Time period for aggregations
 */
export type AggregationPeriod = 'hour' | 'day' | 'month'

/**
 * Aggregated stats (pre-computed for fast dashboard queries)
 */
export interface AggregatedStats {
  /** Site ID */
  siteId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp (ISO string for consistency) */
  periodStart: string
  /** Page views */
  pageViews: number
  /** Unique visitors */
  uniqueVisitors: number
  /** Sessions */
  sessions: number
  /** Bounces */
  bounces: number
  /** Bounce rate (0-1) */
  bounceRate: number
  /** Average session duration (milliseconds) */
  avgSessionDuration: number
  /** Average pages per session */
  avgPagesPerSession: number
  /** Total time on site (milliseconds) */
  totalTimeOnSite: number
  /** New visitors */
  newVisitors: number
  /** Returning visitors */
  returningVisitors: number
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
}

/**
 * Page-level aggregated stats
 */
export interface PageStats {
  /** Site ID */
  siteId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp */
  periodStart: string
  /** Page path */
  path: string
  /** Page title (most recent) */
  title?: string
  /** Page views */
  pageViews: number
  /** Unique visitors */
  uniqueVisitors: number
  /** Entries (sessions starting on this page) */
  entries: number
  /** Exits (sessions ending on this page) */
  exits: number
  /** Bounces */
  bounces: number
  /** Average time on page (milliseconds) */
  avgTimeOnPage: number
  /** Exit rate (0-1) */
  exitRate: number
}

/**
 * Referrer stats
 */
export interface ReferrerStats {
  /** Site ID */
  siteId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp */
  periodStart: string
  /** Referrer source (e.g., google, twitter, direct) */
  source: string
  /** Full referrer URL (for non-grouped view) */
  referrer?: string
  /** Visitors from this referrer */
  visitors: number
  /** Page views from this referrer */
  pageViews: number
  /** Bounce rate (0-1) */
  bounceRate: number
  /** Average session duration (milliseconds) */
  avgSessionDuration: number
}

/**
 * Geographic stats
 */
export interface GeoStats {
  /** Site ID */
  siteId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp */
  periodStart: string
  /** Country code */
  country: string
  /** Region (optional, for country drilldown) */
  region?: string
  /** City (optional, for region drilldown) */
  city?: string
  /** Visitors */
  visitors: number
  /** Page views */
  pageViews: number
  /** Bounce rate */
  bounceRate: number
}

/**
 * Device/Browser stats
 */
export interface DeviceStats {
  /** Site ID */
  siteId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp */
  periodStart: string
  /** Dimension type */
  dimension: 'device' | 'browser' | 'os' | 'screen'
  /** Dimension value (e.g., "mobile", "Chrome", "Windows", "1920x1080") */
  value: string
  /** Visitors */
  visitors: number
  /** Page views */
  pageViews: number
  /** Bounce rate */
  bounceRate: number
}

/**
 * UTM Campaign stats
 */
export interface CampaignStats {
  /** Site ID */
  siteId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp */
  periodStart: string
  /** UTM source */
  utmSource: string
  /** UTM medium */
  utmMedium?: string
  /** UTM campaign */
  utmCampaign?: string
  /** Visitors */
  visitors: number
  /** Page views */
  pageViews: number
  /** Conversions (custom events marked as goals) */
  conversions: number
  /** Conversion rate (0-1) */
  conversionRate: number
  /** Revenue (if tracking) */
  revenue: number
  /** Bounce rate */
  bounceRate: number
}

/**
 * Custom event stats
 */
export interface EventStats {
  /** Site ID */
  siteId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp */
  periodStart: string
  /** Event name */
  eventName: string
  /** Total occurrences */
  count: number
  /** Unique visitors who triggered event */
  uniqueVisitors: number
  /** Total value (for revenue tracking) */
  totalValue: number
  /** Average value per event */
  avgValue: number
}

/**
 * Goal/Conversion definition
 */
export interface Goal {
  /** Goal ID */
  id: string
  /** Site ID */
  siteId: string
  /** Goal name */
  name: string
  /** Goal type */
  type: GoalType
  /** Match pattern (path pattern or event name) */
  pattern: string
  /** Match type */
  matchType: 'exact' | 'contains' | 'regex'
  /** Revenue value per conversion (optional) */
  value?: number
  /** Is active */
  isActive: boolean
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
}

/**
 * Goal type
 */
export type GoalType = 'pageview' | 'event'

/**
 * Goal stats (conversions)
 */
export interface GoalStats {
  /** Site ID */
  siteId: string
  /** Goal ID */
  goalId: string
  /** Period type */
  period: AggregationPeriod
  /** Period start timestamp */
  periodStart: string
  /** Conversions */
  conversions: number
  /** Unique visitors who converted */
  uniqueConversions: number
  /** Conversion rate (0-1) */
  conversionRate: number
  /** Total revenue */
  revenue: number
}

/**
 * Real-time stats (last 5 minutes, stored with short TTL)
 */
export interface RealtimeStats {
  /** Site ID */
  siteId: string
  /** Minute bucket (ISO timestamp truncated to minute) */
  minute: string
  /** Current visitors (active in this minute) */
  currentVisitors: number
  /** Page views in this minute */
  pageViews: number
  /** Active pages (path -> visitor count) */
  activePages: Record<string, number>
  /** TTL (auto-delete after 10 minutes) */
  ttl: number
}

// ============================================================================
// Analytics Store - DynamoDB Operations
// ============================================================================

/**
 * Analytics store options
 */
export interface AnalyticsStoreOptions {
  /** Table name */
  tableName: string
  /** Whether to use TTL for raw events */
  useTtl?: boolean
  /** TTL duration for raw events (seconds, default 30 days) */
  rawEventTtl?: number
  /** TTL duration for hourly aggregates (seconds, default 90 days) */
  hourlyAggregateTtl?: number
  /** TTL duration for daily aggregates (seconds, default 2 years) */
  dailyAggregateTtl?: number
}

/**
 * DynamoDB key patterns for analytics entities
 */
export const AnalyticsKeyPatterns = {
  // Sites
  site: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (siteId: string) => `SITE#${siteId}`,
    gsi1pk: (ownerId: string) => `OWNER#${ownerId}`,
    gsi1sk: (siteId: string) => `SITE#${siteId}`,
  },

  // Page Views (raw events)
  pageView: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (timestamp: Date, pageViewId: string) => `PV#${timestamp.toISOString()}#${pageViewId}`,
    gsi1pk: (siteId: string, date: string) => `SITE#${siteId}#DATE#${date}`,
    gsi1sk: (path: string, pageViewId: string) => `PATH#${path}#${pageViewId}`,
    gsi2pk: (siteId: string, visitorId: string) => `SITE#${siteId}#VISITOR#${visitorId}`,
    gsi2sk: (timestamp: Date) => `PV#${timestamp.toISOString()}`,
  },

  // Sessions
  session: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (sessionId: string) => `SESSION#${sessionId}`,
    gsi1pk: (siteId: string, date: string) => `SITE#${siteId}#SESSIONS#${date}`,
    gsi1sk: (sessionId: string) => `SESSION#${sessionId}`,
  },

  // Custom Events
  customEvent: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (timestamp: Date, eventId: string) => `EVENT#${timestamp.toISOString()}#${eventId}`,
    gsi1pk: (siteId: string, eventName: string) => `SITE#${siteId}#EVENTNAME#${eventName}`,
    gsi1sk: (timestamp: Date) => `EVENT#${timestamp.toISOString()}`,
  },

  // Aggregated Stats (daily/hourly/monthly)
  aggregatedStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (period: AggregationPeriod, periodStart: string) => `STATS#${period.toUpperCase()}#${periodStart}`,
  },

  // Page Stats
  pageStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (period: AggregationPeriod, periodStart: string, path: string) =>
      `PAGESTATS#${period.toUpperCase()}#${periodStart}#${encodeURIComponent(path)}`,
    gsi1pk: (siteId: string, period: AggregationPeriod, periodStart: string) =>
      `SITE#${siteId}#PAGESTATS#${period.toUpperCase()}#${periodStart}`,
    gsi1sk: (pageViews: number, path: string) =>
      `PV#${String(pageViews).padStart(10, '0')}#${encodeURIComponent(path)}`,
  },

  // Referrer Stats
  referrerStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (period: AggregationPeriod, periodStart: string, source: string) =>
      `REFSTATS#${period.toUpperCase()}#${periodStart}#${source}`,
  },

  // Geo Stats
  geoStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (period: AggregationPeriod, periodStart: string, country: string, region?: string) =>
      `GEOSTATS#${period.toUpperCase()}#${periodStart}#${country}${region ? `#${region}` : ''}`,
  },

  // Device Stats
  deviceStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (period: AggregationPeriod, periodStart: string, dimension: string, value: string) =>
      `DEVICESTATS#${period.toUpperCase()}#${periodStart}#${dimension}#${value}`,
  },

  // Campaign Stats
  campaignStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (period: AggregationPeriod, periodStart: string, utmSource: string, utmCampaign?: string) =>
      `CAMPSTATS#${period.toUpperCase()}#${periodStart}#${utmSource}${utmCampaign ? `#${utmCampaign}` : ''}`,
  },

  // Event Stats
  eventStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (period: AggregationPeriod, periodStart: string, eventName: string) =>
      `EVENTSTATS#${period.toUpperCase()}#${periodStart}#${eventName}`,
  },

  // Goals
  goal: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (goalId: string) => `GOAL#${goalId}`,
  },

  // Goal Stats
  goalStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (goalId: string, period: AggregationPeriod, periodStart: string) =>
      `GOALSTATS#${goalId}#${period.toUpperCase()}#${periodStart}`,
  },

  // Realtime Stats
  realtimeStats: {
    pk: (siteId: string) => `SITE#${siteId}`,
    sk: (minute: string) => `REALTIME#${minute}`,
  },
} as const

/**
 * Analytics Store for DynamoDB
 */
export class AnalyticsStore {
  private options: Required<AnalyticsStoreOptions>

  constructor(options: AnalyticsStoreOptions) {
    this.options = {
      useTtl: true,
      rawEventTtl: 30 * 24 * 60 * 60, // 30 days
      hourlyAggregateTtl: 90 * 24 * 60 * 60, // 90 days
      dailyAggregateTtl: 2 * 365 * 24 * 60 * 60, // 2 years
      ...options,
    }
  }

  // ==========================================================================
  // Site Operations
  // ==========================================================================

  /**
   * Generate command to create a site
   */
  createSiteCommand(site: Site): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: Record<string, unknown>
      ConditionExpression: string
    }
  } {
    const keys = AnalyticsKeyPatterns.site
    return {
      command: 'PutItem',
      input: {
        TableName: this.options.tableName,
        Item: {
          pk: { S: keys.pk(site.id) },
          sk: { S: keys.sk(site.id) },
          gsi1pk: { S: keys.gsi1pk(site.ownerId) },
          gsi1sk: { S: keys.gsi1sk(site.id) },
          id: { S: site.id },
          name: { S: site.name },
          domains: { L: site.domains.map(d => ({ S: d })) },
          timezone: { S: site.timezone },
          isActive: { BOOL: site.isActive },
          ownerId: { S: site.ownerId },
          settings: { S: JSON.stringify(site.settings) },
          createdAt: { S: site.createdAt.toISOString() },
          updatedAt: { S: site.updatedAt.toISOString() },
          _et: { S: 'Site' },
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      },
    }
  }

  /**
   * Generate command to get a site by ID
   */
  getSiteCommand(siteId: string): {
    command: 'GetItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.site
    return {
      command: 'GetItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(siteId) },
          sk: { S: keys.sk(siteId) },
        },
      },
    }
  }

  /**
   * Generate command to list sites by owner
   */
  listSitesByOwnerCommand(ownerId: string): {
    command: 'Query'
    input: {
      TableName: string
      IndexName: string
      KeyConditionExpression: string
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.site
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: keys.gsi1pk(ownerId) },
        },
      },
    }
  }

  // ==========================================================================
  // Page View Operations
  // ==========================================================================

  /**
   * Generate command to record a page view
   */
  recordPageViewCommand(pageView: PageView): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.pageView
    const date = pageView.timestamp.toISOString().split('T')[0]
    const ttl = this.options.useTtl
      ? Math.floor(Date.now() / 1000) + this.options.rawEventTtl
      : undefined

    const item: Record<string, unknown> = {
      pk: { S: keys.pk(pageView.siteId) },
      sk: { S: keys.sk(pageView.timestamp, pageView.id) },
      gsi1pk: { S: keys.gsi1pk(pageView.siteId, date) },
      gsi1sk: { S: keys.gsi1sk(pageView.path, pageView.id) },
      gsi2pk: { S: keys.gsi2pk(pageView.siteId, pageView.visitorId) },
      gsi2sk: { S: keys.gsi2sk(pageView.timestamp) },
      id: { S: pageView.id },
      siteId: { S: pageView.siteId },
      visitorId: { S: pageView.visitorId },
      sessionId: { S: pageView.sessionId },
      path: { S: pageView.path },
      hostname: { S: pageView.hostname },
      isUnique: { BOOL: pageView.isUnique },
      isBounce: { BOOL: pageView.isBounce },
      timestamp: { S: pageView.timestamp.toISOString() },
      _et: { S: 'PageView' },
    }

    // Add optional fields
    if (pageView.title) item.title = { S: pageView.title }
    if (pageView.referrer) item.referrer = { S: pageView.referrer }
    if (pageView.referrerSource) item.referrerSource = { S: pageView.referrerSource }
    if (pageView.utmSource) item.utmSource = { S: pageView.utmSource }
    if (pageView.utmMedium) item.utmMedium = { S: pageView.utmMedium }
    if (pageView.utmCampaign) item.utmCampaign = { S: pageView.utmCampaign }
    if (pageView.utmContent) item.utmContent = { S: pageView.utmContent }
    if (pageView.utmTerm) item.utmTerm = { S: pageView.utmTerm }
    if (pageView.country) item.country = { S: pageView.country }
    if (pageView.region) item.region = { S: pageView.region }
    if (pageView.city) item.city = { S: pageView.city }
    if (pageView.deviceType) item.deviceType = { S: pageView.deviceType }
    if (pageView.browser) item.browser = { S: pageView.browser }
    if (pageView.browserVersion) item.browserVersion = { S: pageView.browserVersion }
    if (pageView.os) item.os = { S: pageView.os }
    if (pageView.osVersion) item.osVersion = { S: pageView.osVersion }
    if (pageView.screenWidth) item.screenWidth = { N: String(pageView.screenWidth) }
    if (pageView.screenHeight) item.screenHeight = { N: String(pageView.screenHeight) }
    if (pageView.timeOnPage !== undefined) item.timeOnPage = { N: String(pageView.timeOnPage) }
    if (ttl) item.ttl = { N: String(ttl) }

    return {
      command: 'PutItem',
      input: {
        TableName: this.options.tableName,
        Item: item,
      },
    }
  }

  /**
   * Generate command to query page views for a date range
   */
  queryPageViewsCommand(
    siteId: string,
    startDate: Date,
    endDate: Date,
    options?: { path?: string, limit?: number },
  ): {
    command: 'Query'
    input: {
      TableName: string
      KeyConditionExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
      FilterExpression?: string
      Limit?: number
      ScanIndexForward: boolean
    }
  } {
    const keys = AnalyticsKeyPatterns.pageView
    const startSk = keys.sk(startDate, '')
    const endSk = keys.sk(endDate, 'zzz')

    const input: {
      TableName: string
      KeyConditionExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
      FilterExpression?: string
      Limit?: number
      ScanIndexForward: boolean
    } = {
      TableName: this.options.tableName,
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {
        ':pk': { S: keys.pk(siteId) },
        ':start': { S: startSk },
        ':end': { S: endSk },
      },
      ScanIndexForward: false,
    }

    if (options?.path) {
      input.FilterExpression = '#path = :path'
      input.ExpressionAttributeNames['#path'] = 'path'
      input.ExpressionAttributeValues[':path'] = { S: options.path }
    }

    if (options?.limit) {
      input.Limit = options.limit
    }

    return {
      command: 'Query',
      input,
    }
  }

  // ==========================================================================
  // Session Operations
  // ==========================================================================

  /**
   * Generate command to create/update a session
   */
  upsertSessionCommand(session: Session): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.session
    const date = session.startedAt.toISOString().split('T')[0]
    const ttl = this.options.useTtl
      ? Math.floor(Date.now() / 1000) + this.options.rawEventTtl
      : undefined

    const item: Record<string, unknown> = {
      pk: { S: keys.pk(session.siteId) },
      sk: { S: keys.sk(session.id) },
      gsi1pk: { S: keys.gsi1pk(session.siteId, date) },
      gsi1sk: { S: keys.gsi1sk(session.id) },
      id: { S: session.id },
      siteId: { S: session.siteId },
      visitorId: { S: session.visitorId },
      entryPath: { S: session.entryPath },
      exitPath: { S: session.exitPath },
      pageViewCount: { N: String(session.pageViewCount) },
      eventCount: { N: String(session.eventCount) },
      isBounce: { BOOL: session.isBounce },
      duration: { N: String(session.duration) },
      startedAt: { S: session.startedAt.toISOString() },
      endedAt: { S: session.endedAt.toISOString() },
      _et: { S: 'Session' },
    }

    // Add optional fields
    if (session.referrer) item.referrer = { S: session.referrer }
    if (session.referrerSource) item.referrerSource = { S: session.referrerSource }
    if (session.utmSource) item.utmSource = { S: session.utmSource }
    if (session.utmMedium) item.utmMedium = { S: session.utmMedium }
    if (session.utmCampaign) item.utmCampaign = { S: session.utmCampaign }
    if (session.country) item.country = { S: session.country }
    if (session.deviceType) item.deviceType = { S: session.deviceType }
    if (session.browser) item.browser = { S: session.browser }
    if (session.os) item.os = { S: session.os }
    if (ttl) item.ttl = { N: String(ttl) }

    return {
      command: 'PutItem',
      input: {
        TableName: this.options.tableName,
        Item: item,
      },
    }
  }

  // ==========================================================================
  // Custom Event Operations
  // ==========================================================================

  /**
   * Generate command to record a custom event
   */
  recordCustomEventCommand(event: CustomEvent): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.customEvent
    const ttl = this.options.useTtl
      ? Math.floor(Date.now() / 1000) + this.options.rawEventTtl
      : undefined

    const item: Record<string, unknown> = {
      pk: { S: keys.pk(event.siteId) },
      sk: { S: keys.sk(event.timestamp, event.id) },
      gsi1pk: { S: keys.gsi1pk(event.siteId, event.name) },
      gsi1sk: { S: keys.gsi1sk(event.timestamp) },
      id: { S: event.id },
      siteId: { S: event.siteId },
      visitorId: { S: event.visitorId },
      sessionId: { S: event.sessionId },
      name: { S: event.name },
      path: { S: event.path },
      timestamp: { S: event.timestamp.toISOString() },
      _et: { S: 'CustomEvent' },
    }

    if (event.value !== undefined) item.value = { N: String(event.value) }
    if (event.properties) item.properties = { S: JSON.stringify(event.properties) }
    if (ttl) item.ttl = { N: String(ttl) }

    return {
      command: 'PutItem',
      input: {
        TableName: this.options.tableName,
        Item: item,
      },
    }
  }

  // ==========================================================================
  // Aggregated Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert aggregated stats
   */
  upsertAggregatedStatsCommand(stats: AggregatedStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.aggregatedStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.period, stats.periodStart) },
        },
        UpdateExpression: `
          SET #pv = if_not_exists(#pv, :zero) + :pv,
              #uv = if_not_exists(#uv, :zero) + :uv,
              #sessions = if_not_exists(#sessions, :zero) + :sessions,
              #bounces = if_not_exists(#bounces, :zero) + :bounces,
              #totalTime = if_not_exists(#totalTime, :zero) + :totalTime,
              #newVisitors = if_not_exists(#newVisitors, :zero) + :newVisitors,
              #retVisitors = if_not_exists(#retVisitors, :zero) + :retVisitors,
              #updatedAt = :now,
              #et = :et
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#pv': 'pageViews',
          '#uv': 'uniqueVisitors',
          '#sessions': 'sessions',
          '#bounces': 'bounces',
          '#totalTime': 'totalTimeOnSite',
          '#newVisitors': 'newVisitors',
          '#retVisitors': 'returningVisitors',
          '#updatedAt': 'updatedAt',
          '#et': '_et',
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':pv': { N: String(stats.pageViews) },
          ':uv': { N: String(stats.uniqueVisitors) },
          ':sessions': { N: String(stats.sessions) },
          ':bounces': { N: String(stats.bounces) },
          ':totalTime': { N: String(stats.totalTimeOnSite) },
          ':newVisitors': { N: String(stats.newVisitors) },
          ':retVisitors': { N: String(stats.returningVisitors) },
          ':zero': { N: '0' },
          ':now': { S: new Date().toISOString() },
          ':et': { S: 'AggregatedStats' },
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  /**
   * Generate command to get aggregated stats for a date range
   */
  getAggregatedStatsCommand(
    siteId: string,
    period: AggregationPeriod,
    startPeriod: string,
    endPeriod: string,
  ): {
    command: 'Query'
    input: {
      TableName: string
      KeyConditionExpression: string
      ExpressionAttributeValues: Record<string, unknown>
      ScanIndexForward: boolean
    }
  } {
    const keys = AnalyticsKeyPatterns.aggregatedStats
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':pk': { S: keys.pk(siteId) },
          ':start': { S: keys.sk(period, startPeriod) },
          ':end': { S: keys.sk(period, endPeriod) },
        },
        ScanIndexForward: true,
      },
    }
  }

  // ==========================================================================
  // Page Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert page stats
   */
  upsertPageStatsCommand(stats: PageStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.pageStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.period, stats.periodStart, stats.path) },
        },
        UpdateExpression: `
          SET #pv = if_not_exists(#pv, :zero) + :pv,
              #uv = if_not_exists(#uv, :zero) + :uv,
              #entries = if_not_exists(#entries, :zero) + :entries,
              #exits = if_not_exists(#exits, :zero) + :exits,
              #bounces = if_not_exists(#bounces, :zero) + :bounces,
              gsi1pk = :gsi1pk,
              gsi1sk = :gsi1sk,
              #path = :path,
              #et = :et
              ${stats.title ? ', #title = :title' : ''}
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#pv': 'pageViews',
          '#uv': 'uniqueVisitors',
          '#entries': 'entries',
          '#exits': 'exits',
          '#bounces': 'bounces',
          '#path': 'path',
          '#et': '_et',
          ...(stats.title ? { '#title': 'title' } : {}),
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':pv': { N: String(stats.pageViews) },
          ':uv': { N: String(stats.uniqueVisitors) },
          ':entries': { N: String(stats.entries) },
          ':exits': { N: String(stats.exits) },
          ':bounces': { N: String(stats.bounces) },
          ':gsi1pk': { S: keys.gsi1pk(stats.siteId, stats.period, stats.periodStart) },
          ':gsi1sk': { S: keys.gsi1sk(stats.pageViews, stats.path) },
          ':path': { S: stats.path },
          ':zero': { N: '0' },
          ':et': { S: 'PageStats' },
          ...(stats.title ? { ':title': { S: stats.title } } : {}),
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  /**
   * Generate command to get top pages for a period
   */
  getTopPagesCommand(
    siteId: string,
    period: AggregationPeriod,
    periodStart: string,
    limit: number = 10,
  ): {
    command: 'Query'
    input: {
      TableName: string
      IndexName: string
      KeyConditionExpression: string
      ExpressionAttributeValues: Record<string, unknown>
      Limit: number
      ScanIndexForward: boolean
    }
  } {
    const keys = AnalyticsKeyPatterns.pageStats
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: keys.gsi1pk(siteId, period, periodStart) },
        },
        Limit: limit,
        ScanIndexForward: false, // Descending order by page views
      },
    }
  }

  // ==========================================================================
  // Referrer Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert referrer stats
   */
  upsertReferrerStatsCommand(stats: ReferrerStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.referrerStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.period, stats.periodStart, stats.source) },
        },
        UpdateExpression: `
          SET #visitors = if_not_exists(#visitors, :zero) + :visitors,
              #pv = if_not_exists(#pv, :zero) + :pv,
              #source = :source,
              #et = :et
              ${stats.referrer ? ', #referrer = :referrer' : ''}
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#visitors': 'visitors',
          '#pv': 'pageViews',
          '#source': 'source',
          '#et': '_et',
          ...(stats.referrer ? { '#referrer': 'referrer' } : {}),
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':visitors': { N: String(stats.visitors) },
          ':pv': { N: String(stats.pageViews) },
          ':source': { S: stats.source },
          ':zero': { N: '0' },
          ':et': { S: 'ReferrerStats' },
          ...(stats.referrer ? { ':referrer': { S: stats.referrer } } : {}),
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  // ==========================================================================
  // Goal Operations
  // ==========================================================================

  /**
   * Generate command to create a goal
   */
  createGoalCommand(goal: Goal): {
    command: 'PutItem'
    input: {
      TableName: string
      Item: Record<string, unknown>
      ConditionExpression: string
    }
  } {
    const keys = AnalyticsKeyPatterns.goal
    return {
      command: 'PutItem',
      input: {
        TableName: this.options.tableName,
        Item: {
          pk: { S: keys.pk(goal.siteId) },
          sk: { S: keys.sk(goal.id) },
          id: { S: goal.id },
          siteId: { S: goal.siteId },
          name: { S: goal.name },
          type: { S: goal.type },
          pattern: { S: goal.pattern },
          matchType: { S: goal.matchType },
          isActive: { BOOL: goal.isActive },
          createdAt: { S: goal.createdAt.toISOString() },
          updatedAt: { S: goal.updatedAt.toISOString() },
          _et: { S: 'Goal' },
          ...(goal.value !== undefined ? { value: { N: String(goal.value) } } : {}),
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      },
    }
  }

  /**
   * Generate command to list goals for a site
   */
  listGoalsCommand(siteId: string): {
    command: 'Query'
    input: {
      TableName: string
      KeyConditionExpression: string
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.goal
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': { S: keys.pk(siteId) },
          ':skPrefix': { S: 'GOAL#' },
        },
      },
    }
  }

  // ==========================================================================
  // Realtime Stats Operations
  // ==========================================================================

  /**
   * Generate command to update realtime stats
   */
  updateRealtimeStatsCommand(stats: RealtimeStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.realtimeStats

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.minute) },
        },
        UpdateExpression: `
          SET #cv = :cv,
              #pv = if_not_exists(#pv, :zero) + :pvInc,
              #activePages = :activePages,
              #ttl = :ttl,
              #et = :et
        `.trim(),
        ExpressionAttributeNames: {
          '#cv': 'currentVisitors',
          '#pv': 'pageViews',
          '#activePages': 'activePages',
          '#ttl': 'ttl',
          '#et': '_et',
        },
        ExpressionAttributeValues: {
          ':cv': { N: String(stats.currentVisitors) },
          ':pvInc': { N: '1' },
          ':activePages': { S: JSON.stringify(stats.activePages) },
          ':ttl': { N: String(stats.ttl) },
          ':zero': { N: '0' },
          ':et': { S: 'RealtimeStats' },
        },
      },
    }
  }

  /**
   * Generate command to get realtime stats (last N minutes)
   */
  getRealtimeStatsCommand(siteId: string, minutes: number = 5): {
    command: 'Query'
    input: {
      TableName: string
      KeyConditionExpression: string
      ExpressionAttributeValues: Record<string, unknown>
      ScanIndexForward: boolean
      Limit: number
    }
  } {
    const keys = AnalyticsKeyPatterns.realtimeStats
    const now = new Date()
    const startMinute = new Date(now.getTime() - minutes * 60 * 1000)
      .toISOString()
      .slice(0, 16) // Truncate to minute

    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        KeyConditionExpression: 'pk = :pk AND sk >= :start',
        ExpressionAttributeValues: {
          ':pk': { S: keys.pk(siteId) },
          ':start': { S: keys.sk(startMinute) },
        },
        ScanIndexForward: false,
        Limit: minutes,
      },
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Get TTL timestamp for a period type
   */
  private getTtlForPeriod(period: AggregationPeriod): number | undefined {
    if (!this.options.useTtl) return undefined

    const now = Math.floor(Date.now() / 1000)
    switch (period) {
      case 'hour':
        return now + this.options.hourlyAggregateTtl
      case 'day':
        return now + this.options.dailyAggregateTtl
      case 'month':
        return undefined // Monthly aggregates kept forever
      default:
        return undefined
    }
  }

  /**
   * Get period start string for a date
   */
  static getPeriodStart(date: Date, period: AggregationPeriod): string {
    const iso = date.toISOString()
    switch (period) {
      case 'hour':
        return iso.slice(0, 13) + ':00:00.000Z' // 2024-01-15T14:00:00.000Z
      case 'day':
        return iso.slice(0, 10) // 2024-01-15
      case 'month':
        return iso.slice(0, 7) // 2024-01
      default:
        return iso.slice(0, 10)
    }
  }

  /**
   * Generate a unique ID
   */
  static generateId(): string {
    return crypto.randomUUID()
  }

  /**
   * Hash a visitor identifier (for privacy)
   */
  static async hashVisitorId(
    ip: string,
    userAgent: string,
    siteId: string,
    salt: string,
  ): Promise<string> {
    const data = `${ip}|${userAgent}|${siteId}|${salt}`
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Parse referrer to get source
   */
  static parseReferrerSource(referrer: string | undefined): string {
    if (!referrer) return 'direct'

    try {
      const url = new URL(referrer)
      const hostname = url.hostname.toLowerCase()

      // Search engines
      if (hostname.includes('google')) return 'google'
      if (hostname.includes('bing')) return 'bing'
      if (hostname.includes('yahoo')) return 'yahoo'
      if (hostname.includes('duckduckgo')) return 'duckduckgo'
      if (hostname.includes('baidu')) return 'baidu'
      if (hostname.includes('yandex')) return 'yandex'

      // Social media - order matters for substring matches
      if (hostname.includes('facebook') || hostname.includes('fb.')) return 'facebook'
      if (hostname.includes('reddit')) return 'reddit' // Check before twitter since reddit contains 't.co'
      if (hostname.includes('twitter') || hostname === 't.co' || hostname.endsWith('.t.co')) return 'twitter'
      if (hostname.includes('linkedin')) return 'linkedin'
      if (hostname.includes('instagram')) return 'instagram'
      if (hostname.includes('pinterest')) return 'pinterest'
      if (hostname.includes('youtube')) return 'youtube'
      if (hostname.includes('tiktok')) return 'tiktok'

      // Return the domain as source
      return hostname.replace('www.', '')
    }
    catch {
      return 'unknown'
    }
  }

  /**
   * Parse user agent for device info
   */
  static parseUserAgent(userAgent: string): {
    deviceType: DeviceType
    browser: string
    browserVersion: string
    os: string
    osVersion: string
  } {
    // Simple UA parsing - in production, use a proper UA parser library
    const ua = userAgent.toLowerCase()

    // Device type - check tablet first since iPad contains "mobile" in some UAs
    let deviceType: DeviceType = 'desktop'
    if (/ipad|tablet|playbook|silk/i.test(ua)) {
      deviceType = 'tablet'
    }
    else if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
      deviceType = 'mobile'
    }

    // Browser detection
    let browser = 'Unknown'
    let browserVersion = ''
    if (ua.includes('firefox')) {
      browser = 'Firefox'
      browserVersion = ua.match(/firefox\/([\d.]+)/)?.[1] ?? ''
    }
    else if (ua.includes('edg')) {
      browser = 'Edge'
      browserVersion = ua.match(/edg\/([\d.]+)/)?.[1] ?? ''
    }
    else if (ua.includes('chrome')) {
      browser = 'Chrome'
      browserVersion = ua.match(/chrome\/([\d.]+)/)?.[1] ?? ''
    }
    else if (ua.includes('safari')) {
      browser = 'Safari'
      browserVersion = ua.match(/version\/([\d.]+)/)?.[1] ?? ''
    }

    // OS detection - check mobile OS first since they may contain "mac os" pattern
    let os = 'Unknown'
    let osVersion = ''
    if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS'
      osVersion = ua.match(/os ([\d_]+)/)?.[1]?.replace(/_/g, '.') ?? ''
    }
    else if (ua.includes('android')) {
      os = 'Android'
      osVersion = ua.match(/android ([\d.]+)/)?.[1] ?? ''
    }
    else if (ua.includes('windows')) {
      os = 'Windows'
      if (ua.includes('windows nt 10')) osVersion = '10'
      else if (ua.includes('windows nt 11')) osVersion = '11'
    }
    else if (ua.includes('mac os')) {
      os = 'macOS'
      osVersion = ua.match(/mac os x ([\d_]+)/)?.[1]?.replace(/_/g, '.') ?? ''
    }
    else if (ua.includes('linux')) {
      os = 'Linux'
    }

    return { deviceType, browser, browserVersion, os, osVersion }
  }
}

// ============================================================================
// Analytics Aggregator - Background Job for Rolling Up Stats
// ============================================================================

/**
 * Aggregator options
 */
export interface AggregatorOptions {
  /** Analytics store instance */
  store: AnalyticsStore
  /** Batch size for processing events */
  batchSize?: number
}

/**
 * Analytics Aggregator for rolling up raw events into aggregated stats
 */
export class AnalyticsAggregator {
  private store: AnalyticsStore
  private batchSize: number

  constructor(options: AggregatorOptions) {
    this.store = options.store
    this.batchSize = options.batchSize ?? 100
  }

  /**
   * Generate hourly aggregation stats from page views
   * This would typically be run as a scheduled job
   */
  aggregateHourlyStats(
    siteId: string,
    hourStart: Date,
    pageViews: PageView[],
    sessions: Session[],
  ): AggregatedStats {
    const periodStart = AnalyticsStore.getPeriodStart(hourStart, 'hour')

    // Calculate unique visitors using Set
    const uniqueVisitors = new Set(pageViews.map(pv => pv.visitorId))

    // Calculate bounce rate
    const bounces = sessions.filter(s => s.isBounce).length
    const bounceRate = sessions.length > 0 ? bounces / sessions.length : 0

    // Calculate average session duration
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0)
    const avgSessionDuration = sessions.length > 0 ? totalDuration / sessions.length : 0

    // Calculate pages per session
    const totalPages = sessions.reduce((sum, s) => sum + s.pageViewCount, 0)
    const avgPagesPerSession = sessions.length > 0 ? totalPages / sessions.length : 0

    // Identify new vs returning visitors (simplified - in production, check against visitor history)
    const newVisitors = uniqueVisitors.size // Simplified
    const returningVisitors = 0 // Would need historical data

    return {
      siteId,
      period: 'hour',
      periodStart,
      pageViews: pageViews.length,
      uniqueVisitors: uniqueVisitors.size,
      sessions: sessions.length,
      bounces,
      bounceRate,
      avgSessionDuration,
      avgPagesPerSession,
      totalTimeOnSite: totalDuration,
      newVisitors,
      returningVisitors,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  /**
   * Generate page-level stats from page views
   */
  aggregatePageStats(
    siteId: string,
    period: AggregationPeriod,
    periodStart: Date,
    pageViews: PageView[],
  ): PageStats[] {
    const periodStartStr = AnalyticsStore.getPeriodStart(periodStart, period)

    // Group by path
    const pathGroups = new Map<string, PageView[]>()
    for (const pv of pageViews) {
      const existing = pathGroups.get(pv.path) || []
      existing.push(pv)
      pathGroups.set(pv.path, existing)
    }

    const results: PageStats[] = []
    for (const [path, views] of pathGroups) {
      const uniqueVisitors = new Set(views.map(v => v.visitorId))
      const entries = views.filter(v => v.isUnique).length
      const bounces = views.filter(v => v.isBounce).length
      const exits = views.length // Simplified - would need session data

      // Calculate average time on page
      const timesOnPage = views.filter(v => v.timeOnPage !== undefined).map(v => v.timeOnPage!)
      const avgTimeOnPage = timesOnPage.length > 0
        ? timesOnPage.reduce((a, b) => a + b, 0) / timesOnPage.length
        : 0

      results.push({
        siteId,
        period,
        periodStart: periodStartStr,
        path,
        title: views[views.length - 1]?.title,
        pageViews: views.length,
        uniqueVisitors: uniqueVisitors.size,
        entries,
        exits,
        bounces,
        avgTimeOnPage,
        exitRate: views.length > 0 ? exits / views.length : 0,
      })
    }

    return results
  }

  /**
   * Generate referrer stats from sessions
   */
  aggregateReferrerStats(
    siteId: string,
    period: AggregationPeriod,
    periodStart: Date,
    sessions: Session[],
  ): ReferrerStats[] {
    const periodStartStr = AnalyticsStore.getPeriodStart(periodStart, period)

    // Group by referrer source
    const sourceGroups = new Map<string, Session[]>()
    for (const session of sessions) {
      const source = session.referrerSource || 'direct'
      const existing = sourceGroups.get(source) || []
      existing.push(session)
      sourceGroups.set(source, existing)
    }

    const results: ReferrerStats[] = []
    for (const [source, groupSessions] of sourceGroups) {
      const visitors = new Set(groupSessions.map(s => s.visitorId))
      const pageViews = groupSessions.reduce((sum, s) => sum + s.pageViewCount, 0)
      const bounces = groupSessions.filter(s => s.isBounce).length
      const totalDuration = groupSessions.reduce((sum, s) => sum + s.duration, 0)

      results.push({
        siteId,
        period,
        periodStart: periodStartStr,
        source,
        visitors: visitors.size,
        pageViews,
        bounceRate: groupSessions.length > 0 ? bounces / groupSessions.length : 0,
        avgSessionDuration: groupSessions.length > 0 ? totalDuration / groupSessions.length : 0,
      })
    }

    return results
  }

  /**
   * Generate geographic stats from sessions
   */
  aggregateGeoStats(
    siteId: string,
    period: AggregationPeriod,
    periodStart: Date,
    sessions: Session[],
  ): GeoStats[] {
    const periodStartStr = AnalyticsStore.getPeriodStart(periodStart, period)

    // Group by country
    const countryGroups = new Map<string, Session[]>()
    for (const session of sessions) {
      const country = session.country || 'Unknown'
      const existing = countryGroups.get(country) || []
      existing.push(session)
      countryGroups.set(country, existing)
    }

    const results: GeoStats[] = []
    for (const [country, groupSessions] of countryGroups) {
      const visitors = new Set(groupSessions.map(s => s.visitorId))
      const pageViews = groupSessions.reduce((sum, s) => sum + s.pageViewCount, 0)
      const bounces = groupSessions.filter(s => s.isBounce).length

      results.push({
        siteId,
        period,
        periodStart: periodStartStr,
        country,
        visitors: visitors.size,
        pageViews,
        bounceRate: groupSessions.length > 0 ? bounces / groupSessions.length : 0,
      })
    }

    return results
  }

  /**
   * Generate device stats from sessions
   */
  aggregateDeviceStats(
    siteId: string,
    period: AggregationPeriod,
    periodStart: Date,
    sessions: Session[],
  ): DeviceStats[] {
    const periodStartStr = AnalyticsStore.getPeriodStart(periodStart, period)
    const results: DeviceStats[] = []

    // Group by device type
    const deviceGroups = this.groupByDimension(sessions, 'deviceType')
    for (const [value, groupSessions] of deviceGroups) {
      results.push(this.createDeviceStats(siteId, period, periodStartStr, 'device', value, groupSessions))
    }

    // Group by browser
    const browserGroups = this.groupByDimension(sessions, 'browser')
    for (const [value, groupSessions] of browserGroups) {
      results.push(this.createDeviceStats(siteId, period, periodStartStr, 'browser', value, groupSessions))
    }

    // Group by OS
    const osGroups = this.groupByDimension(sessions, 'os')
    for (const [value, groupSessions] of osGroups) {
      results.push(this.createDeviceStats(siteId, period, periodStartStr, 'os', value, groupSessions))
    }

    return results
  }

  private groupByDimension(
    sessions: Session[],
    dimension: keyof Session,
  ): Map<string, Session[]> {
    const groups = new Map<string, Session[]>()
    for (const session of sessions) {
      const value = String(session[dimension] || 'Unknown')
      const existing = groups.get(value) || []
      existing.push(session)
      groups.set(value, existing)
    }
    return groups
  }

  private createDeviceStats(
    siteId: string,
    period: AggregationPeriod,
    periodStart: string,
    dimension: DeviceStats['dimension'],
    value: string,
    sessions: Session[],
  ): DeviceStats {
    const visitors = new Set(sessions.map(s => s.visitorId))
    const pageViews = sessions.reduce((sum, s) => sum + s.pageViewCount, 0)
    const bounces = sessions.filter(s => s.isBounce).length

    return {
      siteId,
      period,
      periodStart,
      dimension,
      value,
      visitors: visitors.size,
      pageViews,
      bounceRate: sessions.length > 0 ? bounces / sessions.length : 0,
    }
  }
}

// ============================================================================
// Tracking Script Generator
// ============================================================================

/**
 * Options for generating tracking script
 */
export interface TrackingScriptOptions {
  /** Site ID */
  siteId: string
  /** API endpoint URL */
  apiEndpoint: string
  /** Whether to respect Do Not Track */
  honorDnt?: boolean
  /** Whether to track hash changes as page views */
  trackHashChanges?: boolean
  /** Whether to track outbound links */
  trackOutboundLinks?: boolean
  /** Custom domain for script (optional) */
  customDomain?: string
}

/**
 * Generate minimal tracking script
 */
export function generateTrackingScript(options: TrackingScriptOptions): string {
  return `
<!-- Analytics -->
<script data-site="${options.siteId}" data-api="${options.apiEndpoint}" defer>
(function(){
  'use strict';
  var d=document,w=window,n=navigator,s=d.currentScript;
  var site=s.dataset.site,api=s.dataset.api;
  ${options.honorDnt ? 'if(n.doNotTrack==="1")return;' : ''}
  var q=[],sid=Math.random().toString(36).slice(2);
  function t(e,p){
    var x=new XMLHttpRequest();
    x.open('POST',api+'/collect',true);
    x.setRequestHeader('Content-Type','application/json');
    x.send(JSON.stringify({
      s:site,sid:sid,e:e,p:p||{},
      u:location.href,r:d.referrer,t:d.title,
      sw:screen.width,sh:screen.height
    }));
  }
  function pv(){t('pageview');}
  ${options.trackHashChanges ? "w.addEventListener('hashchange',pv);" : ''}
  ${options.trackOutboundLinks ? `
  d.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(a&&a.hostname!==location.hostname){
      t('outbound',{url:a.href});
    }
  });` : ''}
  if(d.readyState==='complete')pv();
  else w.addEventListener('load',pv);
  w.fathom={track:function(n,v){t('event',{name:n,value:v});}};
})();
</script>
`.trim()
}
