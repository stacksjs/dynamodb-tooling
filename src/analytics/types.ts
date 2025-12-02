/**
 * Analytics TypeScript Types
 *
 * These interfaces are derived from the Stacks model definitions
 * in the ./models directory. They provide TypeScript typing for
 * the analytics system.
 *
 * @see ./models for Stacks model definitions
 */

// ============================================================================
// Core Entity Types
// ============================================================================

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
 * Device type
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

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
 * Goal type
 */
export type GoalType = 'pageview' | 'event'

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
 * Conversion record (goal completion)
 */
export interface Conversion {
  /** Conversion ID */
  id: string
  /** Site ID */
  siteId: string
  /** Goal ID */
  goalId: string
  /** Visitor ID */
  visitorId: string
  /** Session ID */
  sessionId: string
  /** Conversion value */
  value?: number
  /** Page path where conversion occurred */
  path: string
  /** Referrer source */
  referrerSource?: string
  /** UTM source */
  utmSource?: string
  /** UTM campaign */
  utmCampaign?: string
  /** Timestamp */
  timestamp: Date
  /** TTL */
  ttl?: number
}

// ============================================================================
// Aggregation Types
// ============================================================================

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
// Query & Dashboard Types
// ============================================================================

/**
 * Date range for queries
 */
export interface DateRange {
  start: Date
  end: Date
}

/**
 * Query options
 */
export interface QueryOptions {
  siteId: string
  dateRange: DateRange
  includeComparison?: boolean
  groupBy?: 'hour' | 'day' | 'month'
}

/**
 * Dashboard summary data
 */
export interface DashboardSummary {
  pageViews: number
  uniqueVisitors: number
  sessions: number
  bounceRate: number
  avgSessionDuration: number
  avgPagesPerSession: number
  change?: {
    pageViews: number
    uniqueVisitors: number
    sessions: number
    bounceRate: number
    avgSessionDuration: number
  }
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  date: string
  pageViews: number
  uniqueVisitors: number
  sessions: number
}

/**
 * Top item (page, referrer, etc.)
 */
export interface TopItem {
  name: string
  value: number
  percentage: number
}

/**
 * Realtime data
 */
export interface RealtimeData {
  currentVisitors: number
  pageViewsLastHour: number
  topActivePages: TopItem[]
}

/**
 * Dashboard data
 */
export interface DashboardData {
  summary: DashboardSummary
  timeSeries: TimeSeriesPoint[]
  topPages: TopItem[]
  topReferrers: TopItem[]
  deviceBreakdown: TopItem[]
  realtime?: RealtimeData
}

// ============================================================================
// Goal Matching Types
// ============================================================================

/**
 * Goal match result
 */
export interface GoalMatchResult {
  goalId: string
  goalName: string
  value?: number
  matchedAt: Date
  matchedPath: string
  matchedEvent?: string
}

/**
 * Goal performance metrics
 */
export interface GoalPerformance {
  goalId: string
  goalName: string
  conversions: number
  conversionRate: number
  revenue: number
  topConvertingPages: TopItem[]
  topConvertingSources: TopItem[]
}

// ============================================================================
// Aggregation Pipeline Types
// ============================================================================

/**
 * Aggregation job status
 */
export interface AggregationJobStatus {
  jobId: string
  siteId: string
  period: AggregationPeriod
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  error?: string
  stats?: {
    pageViewsProcessed: number
    sessionsProcessed: number
    eventsProcessed: number
  }
}

/**
 * Pipeline job configuration
 */
export interface PipelineJobConfig {
  siteId: string
  period: AggregationPeriod
  windowStart: Date
  windowEnd: Date
  processPageViews: boolean
  processSessions: boolean
  processEvents: boolean
  processGoals: boolean
}

/**
 * Pipeline job result
 */
export interface PipelineJobResult {
  success: boolean
  aggregatedStats?: AggregatedStats
  pageStats?: PageStats[]
  referrerStats?: ReferrerStats[]
  geoStats?: GeoStats[]
  deviceStats?: DeviceStats[]
  campaignStats?: CampaignStats[]
  eventStats?: EventStats[]
  goalStats?: GoalStats[]
  errors?: string[]
}

// ============================================================================
// Tracking Script Types
// ============================================================================

/**
 * Tracking script options
 */
export interface TrackingScriptOptions {
  siteId: string
  apiEndpoint?: string
  honorDnt?: boolean
  trackHashChanges?: boolean
  trackOutboundLinks?: boolean
}

// ============================================================================
// Store Types
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
 * Aggregator options
 */
export interface AggregatorOptions {
  /** Analytics store instance */
  store: unknown // AnalyticsStore - using unknown to avoid circular dependency
  /** Batch size for processing events */
  batchSize?: number
}
