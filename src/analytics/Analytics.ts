// ============================================================================
// Analytics - Privacy-Focused Web Analytics for DynamoDB Single-Table Design
// ============================================================================
// Inspired by Fathom Analytics - simple, privacy-first analytics
// Designed for DynamoDB single-table pattern with efficient access patterns
//
// Types are defined in ./types.ts and models in ./models/
// ============================================================================

// Import types from types.ts for internal use
// Note: Some types are defined locally in this file and exported directly
import {
  type AggregatedStats,
  type AggregationPeriod,
  type AnalyticsStoreOptions,
  type CampaignStats,
  type CustomEvent,
  type DeviceStats,
  type DeviceType,
  type EventStats,
  type GeoStats,
  type Goal,
  type GoalStats,
  type GoalType,
  type PageStats,
  type PageView,
  type RealtimeStats,
  type ReferrerStats,
  type Session,
  type Site,
  type SiteSettings,
} from './types'

// Re-export types from types.ts
export type {
  AggregatedStats,
  AggregationPeriod,
  AnalyticsStoreOptions,
  CampaignStats,
  CustomEvent,
  DeviceStats,
  DeviceType,
  EventStats,
  GeoStats,
  Goal,
  GoalStats,
  GoalType,
  PageStats,
  PageView,
  RealtimeStats,
  ReferrerStats,
  Session,
  Site,
  SiteSettings,
}

// ============================================================================
// Analytics Store - DynamoDB Operations
// ============================================================================

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
    if (pageView.title)
      item.title = { S: pageView.title }
    if (pageView.referrer)
      item.referrer = { S: pageView.referrer }
    if (pageView.referrerSource)
      item.referrerSource = { S: pageView.referrerSource }
    if (pageView.utmSource)
      item.utmSource = { S: pageView.utmSource }
    if (pageView.utmMedium)
      item.utmMedium = { S: pageView.utmMedium }
    if (pageView.utmCampaign)
      item.utmCampaign = { S: pageView.utmCampaign }
    if (pageView.utmContent)
      item.utmContent = { S: pageView.utmContent }
    if (pageView.utmTerm)
      item.utmTerm = { S: pageView.utmTerm }
    if (pageView.country)
      item.country = { S: pageView.country }
    if (pageView.region)
      item.region = { S: pageView.region }
    if (pageView.city)
      item.city = { S: pageView.city }
    if (pageView.deviceType)
      item.deviceType = { S: pageView.deviceType }
    if (pageView.browser)
      item.browser = { S: pageView.browser }
    if (pageView.browserVersion)
      item.browserVersion = { S: pageView.browserVersion }
    if (pageView.os)
      item.os = { S: pageView.os }
    if (pageView.osVersion)
      item.osVersion = { S: pageView.osVersion }
    if (pageView.screenWidth)
      item.screenWidth = { N: String(pageView.screenWidth) }
    if (pageView.screenHeight)
      item.screenHeight = { N: String(pageView.screenHeight) }
    if (pageView.timeOnPage !== undefined)
      item.timeOnPage = { N: String(pageView.timeOnPage) }
    if (ttl)
      item.ttl = { N: String(ttl) }

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
    if (session.referrer)
      item.referrer = { S: session.referrer }
    if (session.referrerSource)
      item.referrerSource = { S: session.referrerSource }
    if (session.utmSource)
      item.utmSource = { S: session.utmSource }
    if (session.utmMedium)
      item.utmMedium = { S: session.utmMedium }
    if (session.utmCampaign)
      item.utmCampaign = { S: session.utmCampaign }
    if (session.country)
      item.country = { S: session.country }
    if (session.deviceType)
      item.deviceType = { S: session.deviceType }
    if (session.browser)
      item.browser = { S: session.browser }
    if (session.os)
      item.os = { S: session.os }
    if (ttl)
      item.ttl = { N: String(ttl) }

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

    if (event.value !== undefined)
      item.value = { N: String(event.value) }
    if (event.properties)
      item.properties = { S: JSON.stringify(event.properties) }
    if (ttl)
      item.ttl = { N: String(ttl) }

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
  // Geo Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert geo stats
   */
  upsertGeoStatsCommand(stats: GeoStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.geoStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.period, stats.periodStart, stats.country, stats.region) },
        },
        UpdateExpression: `
          SET #visitors = if_not_exists(#visitors, :zero) + :visitors,
              #pv = if_not_exists(#pv, :zero) + :pv,
              #country = :country,
              #et = :et
              ${stats.region ? ', #region = :region' : ''}
              ${stats.city ? ', #city = :city' : ''}
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#visitors': 'visitors',
          '#pv': 'pageViews',
          '#country': 'country',
          '#et': '_et',
          ...(stats.region ? { '#region': 'region' } : {}),
          ...(stats.city ? { '#city': 'city' } : {}),
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':visitors': { N: String(stats.visitors) },
          ':pv': { N: String(stats.pageViews) },
          ':country': { S: stats.country },
          ':zero': { N: '0' },
          ':et': { S: 'GeoStats' },
          ...(stats.region ? { ':region': { S: stats.region } } : {}),
          ...(stats.city ? { ':city': { S: stats.city } } : {}),
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  /**
   * Generate command to get geo stats for a period
   */
  getGeoStatsCommand(
    siteId: string,
    period: AggregationPeriod,
    periodStart: string,
    limit: number = 10,
  ): {
      command: 'Query'
      input: {
        TableName: string
        KeyConditionExpression: string
        ExpressionAttributeValues: Record<string, unknown>
        Limit: number
      }
    } {
    const keys = AnalyticsKeyPatterns.geoStats
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': { S: keys.pk(siteId) },
          ':skPrefix': { S: `GEOSTATS#${period.toUpperCase()}#${periodStart}` },
        },
        Limit: limit,
      },
    }
  }

  // ==========================================================================
  // Device Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert device stats
   */
  upsertDeviceStatsCommand(stats: DeviceStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.deviceStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.period, stats.periodStart, stats.dimension, stats.value) },
        },
        UpdateExpression: `
          SET #visitors = if_not_exists(#visitors, :zero) + :visitors,
              #pv = if_not_exists(#pv, :zero) + :pv,
              #dimension = :dimension,
              #value = :value,
              #et = :et
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#visitors': 'visitors',
          '#pv': 'pageViews',
          '#dimension': 'dimension',
          '#value': 'value',
          '#et': '_et',
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':visitors': { N: String(stats.visitors) },
          ':pv': { N: String(stats.pageViews) },
          ':dimension': { S: stats.dimension },
          ':value': { S: stats.value },
          ':zero': { N: '0' },
          ':et': { S: 'DeviceStats' },
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  /**
   * Generate command to get device stats for a period
   */
  getDeviceStatsCommand(
    siteId: string,
    period: AggregationPeriod,
    periodStart: string,
    dimension?: 'device' | 'browser' | 'os' | 'screen',
  ): {
      command: 'Query'
      input: {
        TableName: string
        KeyConditionExpression: string
        ExpressionAttributeValues: Record<string, unknown>
        FilterExpression?: string
        ExpressionAttributeNames?: Record<string, string>
      }
    } {
    const keys = AnalyticsKeyPatterns.deviceStats
    const input: ReturnType<typeof this.getDeviceStatsCommand>['input'] = {
      TableName: this.options.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': { S: keys.pk(siteId) },
        ':skPrefix': { S: `DEVICESTATS#${period.toUpperCase()}#${periodStart}` },
      },
    }

    if (dimension) {
      input.FilterExpression = '#dim = :dim'
      input.ExpressionAttributeNames = { '#dim': 'dimension' }
      input.ExpressionAttributeValues[':dim'] = { S: dimension }
    }

    return { command: 'Query', input }
  }

  // ==========================================================================
  // Event Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert event stats
   */
  upsertEventStatsCommand(stats: EventStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.eventStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.period, stats.periodStart, stats.eventName) },
        },
        UpdateExpression: `
          SET #count = if_not_exists(#count, :zero) + :count,
              #uv = if_not_exists(#uv, :zero) + :uv,
              #totalValue = if_not_exists(#totalValue, :zero) + :totalValue,
              #eventName = :eventName,
              #et = :et
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#count': 'count',
          '#uv': 'uniqueVisitors',
          '#totalValue': 'totalValue',
          '#eventName': 'eventName',
          '#et': '_et',
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':count': { N: String(stats.count) },
          ':uv': { N: String(stats.uniqueVisitors) },
          ':totalValue': { N: String(stats.totalValue) },
          ':eventName': { S: stats.eventName },
          ':zero': { N: '0' },
          ':et': { S: 'EventStats' },
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  /**
   * Generate command to get event stats for a period
   */
  getEventStatsCommand(
    siteId: string,
    period: AggregationPeriod,
    periodStart: string,
  ): {
      command: 'Query'
      input: {
        TableName: string
        KeyConditionExpression: string
        ExpressionAttributeValues: Record<string, unknown>
      }
    } {
    const keys = AnalyticsKeyPatterns.eventStats
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': { S: keys.pk(siteId) },
          ':skPrefix': { S: `EVENTSTATS#${period.toUpperCase()}#${periodStart}` },
        },
      },
    }
  }

  // ==========================================================================
  // Goal Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert goal stats
   */
  upsertGoalStatsCommand(stats: GoalStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.goalStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.goalId, stats.period, stats.periodStart) },
        },
        UpdateExpression: `
          SET #conversions = if_not_exists(#conversions, :zero) + :conversions,
              #uniqueConv = if_not_exists(#uniqueConv, :zero) + :uniqueConv,
              #revenue = if_not_exists(#revenue, :zero) + :revenue,
              #goalId = :goalId,
              #et = :et
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#conversions': 'conversions',
          '#uniqueConv': 'uniqueConversions',
          '#revenue': 'revenue',
          '#goalId': 'goalId',
          '#et': '_et',
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':conversions': { N: String(stats.conversions) },
          ':uniqueConv': { N: String(stats.uniqueConversions) },
          ':revenue': { N: String(stats.revenue) },
          ':goalId': { S: stats.goalId },
          ':zero': { N: '0' },
          ':et': { S: 'GoalStats' },
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  /**
   * Generate command to get goal stats for a period
   */
  getGoalStatsCommand(
    siteId: string,
    goalId: string,
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
    const keys = AnalyticsKeyPatterns.goalStats
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':pk': { S: keys.pk(siteId) },
          ':start': { S: keys.sk(goalId, period, startPeriod) },
          ':end': { S: keys.sk(goalId, period, endPeriod) },
        },
        ScanIndexForward: true,
      },
    }
  }

  // ==========================================================================
  // Campaign Stats Operations
  // ==========================================================================

  /**
   * Generate command to upsert campaign stats
   */
  upsertCampaignStatsCommand(stats: CampaignStats): {
    command: 'UpdateItem'
    input: {
      TableName: string
      Key: Record<string, unknown>
      UpdateExpression: string
      ExpressionAttributeNames: Record<string, string>
      ExpressionAttributeValues: Record<string, unknown>
    }
  } {
    const keys = AnalyticsKeyPatterns.campaignStats
    const ttl = this.getTtlForPeriod(stats.period)

    return {
      command: 'UpdateItem',
      input: {
        TableName: this.options.tableName,
        Key: {
          pk: { S: keys.pk(stats.siteId) },
          sk: { S: keys.sk(stats.period, stats.periodStart, stats.utmSource, stats.utmCampaign) },
        },
        UpdateExpression: `
          SET #visitors = if_not_exists(#visitors, :zero) + :visitors,
              #pv = if_not_exists(#pv, :zero) + :pv,
              #conversions = if_not_exists(#conversions, :zero) + :conversions,
              #revenue = if_not_exists(#revenue, :zero) + :revenue,
              #utmSource = :utmSource,
              #et = :et
              ${stats.utmMedium ? ', #utmMedium = :utmMedium' : ''}
              ${stats.utmCampaign ? ', #utmCampaign = :utmCampaign' : ''}
              ${ttl ? ', #ttl = :ttl' : ''}
        `.trim(),
        ExpressionAttributeNames: {
          '#visitors': 'visitors',
          '#pv': 'pageViews',
          '#conversions': 'conversions',
          '#revenue': 'revenue',
          '#utmSource': 'utmSource',
          '#et': '_et',
          ...(stats.utmMedium ? { '#utmMedium': 'utmMedium' } : {}),
          ...(stats.utmCampaign ? { '#utmCampaign': 'utmCampaign' } : {}),
          ...(ttl ? { '#ttl': 'ttl' } : {}),
        },
        ExpressionAttributeValues: {
          ':visitors': { N: String(stats.visitors) },
          ':pv': { N: String(stats.pageViews) },
          ':conversions': { N: String(stats.conversions) },
          ':revenue': { N: String(stats.revenue) },
          ':utmSource': { S: stats.utmSource },
          ':zero': { N: '0' },
          ':et': { S: 'CampaignStats' },
          ...(stats.utmMedium ? { ':utmMedium': { S: stats.utmMedium } } : {}),
          ...(stats.utmCampaign ? { ':utmCampaign': { S: stats.utmCampaign } } : {}),
          ...(ttl ? { ':ttl': { N: String(ttl) } } : {}),
        },
      },
    }
  }

  /**
   * Generate command to get campaign stats for a period
   */
  getCampaignStatsCommand(
    siteId: string,
    period: AggregationPeriod,
    periodStart: string,
  ): {
      command: 'Query'
      input: {
        TableName: string
        KeyConditionExpression: string
        ExpressionAttributeValues: Record<string, unknown>
      }
    } {
    const keys = AnalyticsKeyPatterns.campaignStats
    return {
      command: 'Query',
      input: {
        TableName: this.options.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': { S: keys.pk(siteId) },
          ':skPrefix': { S: `CAMPSTATS#${period.toUpperCase()}#${periodStart}` },
        },
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
    if (!this.options.useTtl)
      return undefined

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
        return `${iso.slice(0, 13)}:00:00.000Z` // 2024-01-15T14:00:00.000Z
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
    if (!referrer)
      return 'direct'

    try {
      const url = new URL(referrer)
      const hostname = url.hostname.toLowerCase()

      // Search engines
      if (hostname.includes('google'))
        return 'google'
      if (hostname.includes('bing'))
        return 'bing'
      if (hostname.includes('yahoo'))
        return 'yahoo'
      if (hostname.includes('duckduckgo'))
        return 'duckduckgo'
      if (hostname.includes('baidu'))
        return 'baidu'
      if (hostname.includes('yandex'))
        return 'yandex'

      // Social media - order matters for substring matches
      if (hostname.includes('facebook') || hostname.includes('fb.'))
        return 'facebook'
      if (hostname.includes('reddit'))
        return 'reddit' // Check before twitter since reddit contains 't.co'
      if (hostname.includes('twitter') || hostname === 't.co' || hostname.endsWith('.t.co'))
        return 'twitter'
      if (hostname.includes('linkedin'))
        return 'linkedin'
      if (hostname.includes('instagram'))
        return 'instagram'
      if (hostname.includes('pinterest'))
        return 'pinterest'
      if (hostname.includes('youtube'))
        return 'youtube'
      if (hostname.includes('tiktok'))
        return 'tiktok'

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
      if (ua.includes('windows nt 10'))
        osVersion = '10'
      else if (ua.includes('windows nt 11'))
        osVersion = '11'
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
// Goal Matcher - Match PageViews/Events to Goal Definitions
// ============================================================================

/**
 * Result of a goal match check
 */
export interface GoalMatchResult {
  /** Whether the goal was matched */
  matched: boolean
  /** The goal that was matched */
  goal: Goal
  /** The value attributed to this conversion */
  value: number
  /** The item that triggered the match (pageview or event) */
  trigger: PageView | CustomEvent
  /** Timestamp of the conversion */
  timestamp: Date
}

/**
 * Conversion record for storage
 */
export interface Conversion {
  /** Unique conversion ID */
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
  value: number
  /** Path where conversion occurred */
  path: string
  /** Timestamp */
  timestamp: Date
  /** TTL for auto-deletion */
  ttl?: number
}

/**
 * Goal Matcher for checking if pageviews/events match goal definitions
 */
export class GoalMatcher {
  private goals: Goal[]
  private compiledPatterns: Map<string, RegExp>

  constructor(goals: Goal[]) {
    this.goals = goals.filter(g => g.isActive)
    this.compiledPatterns = new Map()

    // Pre-compile regex patterns for performance
    for (const goal of this.goals) {
      if (goal.matchType === 'regex') {
        try {
          this.compiledPatterns.set(goal.id, new RegExp(goal.pattern))
        }
        catch {
          // Invalid regex - skip this goal
          console.warn(`Invalid regex pattern for goal ${goal.id}: ${goal.pattern}`)
        }
      }
    }
  }

  /**
   * Check if a pageview matches any pageview-type goals
   */
  matchPageView(pageView: PageView): GoalMatchResult[] {
    const results: GoalMatchResult[] = []

    for (const goal of this.goals) {
      if (goal.type !== 'pageview')
        continue

      if (this.matchesPattern(pageView.path, goal)) {
        results.push({
          matched: true,
          goal,
          value: goal.value ?? 0,
          trigger: pageView,
          timestamp: pageView.timestamp,
        })
      }
    }

    return results
  }

  /**
   * Check if a custom event matches any event-type goals
   */
  matchEvent(event: CustomEvent): GoalMatchResult[] {
    const results: GoalMatchResult[] = []

    for (const goal of this.goals) {
      if (goal.type !== 'event')
        continue

      if (this.matchesPattern(event.name, goal)) {
        results.push({
          matched: true,
          goal,
          value: event.value ?? goal.value ?? 0,
          trigger: event,
          timestamp: event.timestamp,
        })
      }
    }

    return results
  }

  /**
   * Check if a value matches a goal's pattern
   */
  private matchesPattern(value: string, goal: Goal): boolean {
    switch (goal.matchType) {
      case 'exact':
        return value === goal.pattern

      case 'contains':
        return value.includes(goal.pattern)

      case 'regex': {
        const regex = this.compiledPatterns.get(goal.id)
        return regex ? regex.test(value) : false
      }

      default:
        return false
    }
  }

  /**
   * Get all active goals
   */
  getActiveGoals(): Goal[] {
    return this.goals
  }

  /**
   * Create a conversion record from a goal match
   */
  static createConversion(
    siteId: string,
    match: GoalMatchResult,
  ): Conversion {
    const trigger = match.trigger
    return {
      id: AnalyticsStore.generateId(),
      siteId,
      goalId: match.goal.id,
      visitorId: trigger.visitorId,
      sessionId: trigger.sessionId,
      value: match.value,
      path: trigger.path,
      timestamp: match.timestamp,
    }
  }
}

// ============================================================================
// Analytics Query API - High-Level Dashboard Queries
// ============================================================================

/**
 * Date range for queries
 */
export interface DateRange {
  start: Date
  end: Date
}

/**
 * Dashboard summary data
 */
export interface DashboardSummary {
  /** Total page views in period */
  pageViews: number
  /** Unique visitors in period */
  uniqueVisitors: number
  /** Total sessions in period */
  sessions: number
  /** Bounce rate (0-1) */
  bounceRate: number
  /** Average session duration (ms) */
  avgSessionDuration: number
  /** Average pages per session */
  avgPagesPerSession: number
  /** Comparison with previous period */
  comparison?: {
    pageViewsChange: number
    visitorsChange: number
    bounceRateChange: number
  }
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: string
  pageViews: number
  uniqueVisitors: number
  sessions: number
  bounceRate: number
}

/**
 * Top item (page, referrer, country, etc.)
 */
export interface TopItem {
  name: string
  value: number
  percentage: number
  change?: number
}

/**
 * Dashboard data response
 */
export interface DashboardData {
  summary: DashboardSummary
  timeSeries: TimeSeriesPoint[]
  topPages: TopItem[]
  topReferrers: TopItem[]
  topCountries: TopItem[]
  topDevices: TopItem[]
  topBrowsers: TopItem[]
  goals?: GoalPerformance[]
  realtime?: RealtimeData
}

/**
 * Goal performance data
 */
export interface GoalPerformance {
  goalId: string
  goalName: string
  conversions: number
  conversionRate: number
  revenue: number
}

/**
 * Realtime dashboard data
 */
export interface RealtimeData {
  currentVisitors: number
  pageViewsLastHour: number
  topActivePages: TopItem[]
}

/**
 * Query options
 */
export interface QueryOptions {
  /** Site ID */
  siteId: string
  /** Date range */
  dateRange: DateRange
  /** Whether to include comparison with previous period */
  includeComparison?: boolean
  /** Whether to include realtime data */
  includeRealtime?: boolean
  /** Whether to include goal performance */
  includeGoals?: boolean
  /** Limit for top items */
  topLimit?: number
  /** Timezone for date calculations */
  timezone?: string
}

/**
 * Analytics Query API for dashboard data
 */
export class AnalyticsQueryAPI {
  private store: AnalyticsStore

  constructor(store: AnalyticsStore) {
    this.store = store
  }

  /**
   * Determine the best aggregation period for a date range
   */
  static determinePeriod(dateRange: DateRange): AggregationPeriod {
    const diffMs = dateRange.end.getTime() - dateRange.start.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffDays <= 2) {
      return 'hour'
    }
    else if (diffDays <= 90) {
      return 'day'
    }
    else {
      return 'month'
    }
  }

  /**
   * Get the previous period for comparison
   */
  static getPreviousPeriod(dateRange: DateRange): DateRange {
    const diffMs = dateRange.end.getTime() - dateRange.start.getTime()
    return {
      start: new Date(dateRange.start.getTime() - diffMs),
      end: new Date(dateRange.start.getTime() - 1),
    }
  }

  /**
   * Generate query commands for fetching dashboard data
   * Returns an object with all the DynamoDB commands needed
   */
  generateDashboardQueries(options: QueryOptions): {
    aggregatedStats: ReturnType<AnalyticsStore['getAggregatedStatsCommand']>
    topPages: ReturnType<AnalyticsStore['getTopPagesCommand']>
    realtimeStats?: ReturnType<AnalyticsStore['getRealtimeStatsCommand']>
    goals?: ReturnType<AnalyticsStore['listGoalsCommand']>
    previousPeriodStats?: ReturnType<AnalyticsStore['getAggregatedStatsCommand']>
  } {
    const period = AnalyticsQueryAPI.determinePeriod(options.dateRange)
    const startPeriod = AnalyticsStore.getPeriodStart(options.dateRange.start, period)
    const endPeriod = AnalyticsStore.getPeriodStart(options.dateRange.end, period)
    const limit = options.topLimit ?? 10

    const queries: ReturnType<AnalyticsQueryAPI['generateDashboardQueries']> = {
      aggregatedStats: this.store.getAggregatedStatsCommand(
        options.siteId,
        period,
        startPeriod,
        endPeriod,
      ),
      topPages: this.store.getTopPagesCommand(
        options.siteId,
        period,
        endPeriod, // Use end date for most recent stats
        limit,
      ),
    }

    if (options.includeRealtime) {
      queries.realtimeStats = this.store.getRealtimeStatsCommand(options.siteId, 5)
    }

    if (options.includeGoals) {
      queries.goals = this.store.listGoalsCommand(options.siteId)
    }

    if (options.includeComparison) {
      const prevPeriod = AnalyticsQueryAPI.getPreviousPeriod(options.dateRange)
      const prevStartPeriod = AnalyticsStore.getPeriodStart(prevPeriod.start, period)
      const prevEndPeriod = AnalyticsStore.getPeriodStart(prevPeriod.end, period)

      queries.previousPeriodStats = this.store.getAggregatedStatsCommand(
        options.siteId,
        period,
        prevStartPeriod,
        prevEndPeriod,
      )
    }

    return queries
  }

  /**
   * Process aggregated stats results into dashboard summary
   */
  static processSummary(
    stats: AggregatedStats[],
    previousStats?: AggregatedStats[],
  ): DashboardSummary {
    // Sum up all stats in the period
    const totals = stats.reduce(
      (acc, s) => ({
        pageViews: acc.pageViews + s.pageViews,
        uniqueVisitors: acc.uniqueVisitors + s.uniqueVisitors,
        sessions: acc.sessions + s.sessions,
        bounces: acc.bounces + s.bounces,
        totalTime: acc.totalTime + s.totalTimeOnSite,
        totalPages: acc.totalPages + (s.sessions * s.avgPagesPerSession),
      }),
      { pageViews: 0, uniqueVisitors: 0, sessions: 0, bounces: 0, totalTime: 0, totalPages: 0 },
    )

    const summary: DashboardSummary = {
      pageViews: totals.pageViews,
      uniqueVisitors: totals.uniqueVisitors,
      sessions: totals.sessions,
      bounceRate: totals.sessions > 0 ? totals.bounces / totals.sessions : 0,
      avgSessionDuration: totals.sessions > 0 ? totals.totalTime / totals.sessions : 0,
      avgPagesPerSession: totals.sessions > 0 ? totals.totalPages / totals.sessions : 0,
    }

    if (previousStats && previousStats.length > 0) {
      const prevTotals = previousStats.reduce(
        (acc, s) => ({
          pageViews: acc.pageViews + s.pageViews,
          uniqueVisitors: acc.uniqueVisitors + s.uniqueVisitors,
          bounces: acc.bounces + s.bounces,
          sessions: acc.sessions + s.sessions,
        }),
        { pageViews: 0, uniqueVisitors: 0, bounces: 0, sessions: 0 },
      )

      const prevBounceRate = prevTotals.sessions > 0 ? prevTotals.bounces / prevTotals.sessions : 0

      summary.comparison = {
        pageViewsChange: prevTotals.pageViews > 0
          ? ((totals.pageViews - prevTotals.pageViews) / prevTotals.pageViews) * 100
          : 0,
        visitorsChange: prevTotals.uniqueVisitors > 0
          ? ((totals.uniqueVisitors - prevTotals.uniqueVisitors) / prevTotals.uniqueVisitors) * 100
          : 0,
        bounceRateChange: summary.bounceRate - prevBounceRate,
      }
    }

    return summary
  }

  /**
   * Convert aggregated stats to time series data
   */
  static processTimeSeries(stats: AggregatedStats[]): TimeSeriesPoint[] {
    return stats
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
      .map(s => ({
        timestamp: s.periodStart,
        pageViews: s.pageViews,
        uniqueVisitors: s.uniqueVisitors,
        sessions: s.sessions,
        bounceRate: s.bounceRate,
      }))
  }

  /**
   * Process page stats into top items
   */
  static processTopPages(pageStats: PageStats[], totalPageViews: number): TopItem[] {
    return pageStats
      .sort((a, b) => b.pageViews - a.pageViews)
      .map(p => ({
        name: p.path,
        value: p.pageViews,
        percentage: totalPageViews > 0 ? (p.pageViews / totalPageViews) * 100 : 0,
      }))
  }

  /**
   * Process referrer stats into top items
   */
  static processTopReferrers(referrerStats: ReferrerStats[], totalVisitors: number): TopItem[] {
    return referrerStats
      .sort((a, b) => b.visitors - a.visitors)
      .map(r => ({
        name: r.source,
        value: r.visitors,
        percentage: totalVisitors > 0 ? (r.visitors / totalVisitors) * 100 : 0,
      }))
  }

  /**
   * Process geo stats into top items
   */
  static processTopCountries(geoStats: GeoStats[], totalVisitors: number): TopItem[] {
    return geoStats
      .filter(g => !g.region) // Only country-level stats
      .sort((a, b) => b.visitors - a.visitors)
      .map(g => ({
        name: g.country,
        value: g.visitors,
        percentage: totalVisitors > 0 ? (g.visitors / totalVisitors) * 100 : 0,
      }))
  }

  /**
   * Process device stats into top items
   */
  static processTopDevices(
    deviceStats: DeviceStats[],
    dimension: 'device' | 'browser' | 'os',
    totalVisitors: number,
  ): TopItem[] {
    return deviceStats
      .filter(d => d.dimension === dimension)
      .sort((a, b) => b.visitors - a.visitors)
      .map(d => ({
        name: d.value,
        value: d.visitors,
        percentage: totalVisitors > 0 ? (d.visitors / totalVisitors) * 100 : 0,
      }))
  }

  /**
   * Process realtime stats
   */
  static processRealtimeData(
    realtimeStats: RealtimeStats[],
  ): RealtimeData {
    // Sum up recent minutes
    const currentVisitors = realtimeStats.length > 0
      ? realtimeStats[0].currentVisitors
      : 0

    const pageViewsLastHour = realtimeStats.reduce((sum, s) => sum + s.pageViews, 0)

    // Aggregate active pages across all minutes
    const activePageCounts = new Map<string, number>()
    for (const stat of realtimeStats) {
      for (const [page, count] of Object.entries(stat.activePages)) {
        activePageCounts.set(page, (activePageCounts.get(page) ?? 0) + count)
      }
    }

    const totalActive = Array.from(activePageCounts.values()).reduce((a, b) => a + b, 0)
    const topActivePages: TopItem[] = Array.from(activePageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalActive > 0 ? (value / totalActive) * 100 : 0,
      }))

    return {
      currentVisitors,
      pageViewsLastHour,
      topActivePages,
    }
  }

  /**
   * Process goal stats into performance data
   */
  static processGoalPerformance(
    goals: Goal[],
    goalStats: GoalStats[],
    totalVisitors: number,
  ): GoalPerformance[] {
    return goals.map((goal) => {
      const stats = goalStats.filter(gs => gs.goalId === goal.id)
      const totalConversions = stats.reduce((sum, s) => sum + s.conversions, 0)
      const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0)

      return {
        goalId: goal.id,
        goalName: goal.name,
        conversions: totalConversions,
        conversionRate: totalVisitors > 0 ? totalConversions / totalVisitors : 0,
        revenue: totalRevenue,
      }
    })
  }
}

// ============================================================================
// Aggregation Pipeline - Scheduled Job Utilities
// ============================================================================

/**
 * Pipeline job configuration
 */
export interface PipelineJobConfig {
  /** Site ID to process */
  siteId: string
  /** Period to aggregate */
  period: AggregationPeriod
  /** Start time for aggregation window */
  windowStart: Date
  /** End time for aggregation window */
  windowEnd: Date
  /** Whether to delete raw events after aggregation */
  deleteRawEvents?: boolean
}

/**
 * Pipeline job result
 */
export interface PipelineJobResult {
  /** Job configuration */
  config: PipelineJobConfig
  /** Whether the job succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Number of page views processed */
  pageViewsProcessed: number
  /** Number of sessions processed */
  sessionsProcessed: number
  /** Number of events processed */
  eventsProcessed: number
  /** Number of conversions tracked */
  conversionsTracked: number
  /** Commands generated for DynamoDB writes */
  commands: Array<{
    command: string
    input: Record<string, unknown>
  }>
  /** Processing duration (ms) */
  durationMs: number
}

/**
 * Aggregation job status
 */
export interface AggregationJobStatus {
  /** Job ID */
  jobId: string
  /** Site ID */
  siteId: string
  /** Period being aggregated */
  period: AggregationPeriod
  /** Job status */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** Start time */
  startedAt?: Date
  /** Completion time */
  completedAt?: Date
  /** Error if failed */
  error?: string
  /** Progress percentage (0-100) */
  progress: number
}

/**
 * Aggregation Pipeline for scheduled processing of analytics data
 */
export class AggregationPipeline {
  private store: AnalyticsStore
  private aggregator: AnalyticsAggregator

  constructor(store: AnalyticsStore, aggregator?: AnalyticsAggregator) {
    this.store = store
    this.aggregator = aggregator ?? new AnalyticsAggregator({ store })
  }

  /**
   * Generate commands to run an aggregation job
   * This processes raw events and generates aggregated stats
   */
  runAggregationJob(
    config: PipelineJobConfig,
    pageViews: PageView[],
    sessions: Session[],
    events: CustomEvent[],
    goals: Goal[],
  ): PipelineJobResult {
    const startTime = Date.now()
    const commands: PipelineJobResult['commands'] = []
    let conversionsTracked = 0

    try {
      // 1. Generate aggregated stats
      const aggregatedStats = this.aggregator.aggregateHourlyStats(
        config.siteId,
        config.windowStart,
        pageViews,
        sessions,
      )
      // Adjust period if not hourly
      aggregatedStats.period = config.period
      aggregatedStats.periodStart = AnalyticsStore.getPeriodStart(config.windowStart, config.period)

      const statsCmd = this.store.upsertAggregatedStatsCommand(aggregatedStats)
      commands.push({ command: statsCmd.command, input: statsCmd.input })

      // 2. Generate page stats
      const pageStats = this.aggregator.aggregatePageStats(
        config.siteId,
        config.period,
        config.windowStart,
        pageViews,
      )
      for (const ps of pageStats) {
        const cmd = this.store.upsertPageStatsCommand(ps)
        commands.push({ command: cmd.command, input: cmd.input })
      }

      // 3. Generate referrer stats
      const referrerStats = this.aggregator.aggregateReferrerStats(
        config.siteId,
        config.period,
        config.windowStart,
        sessions,
      )
      for (const rs of referrerStats) {
        const cmd = this.store.upsertReferrerStatsCommand(rs)
        commands.push({ command: cmd.command, input: cmd.input })
      }

      // 4. Generate geo stats
      const geoStats = this.aggregator.aggregateGeoStats(
        config.siteId,
        config.period,
        config.windowStart,
        sessions,
      )
      for (const gs of geoStats) {
        const cmd = this.store.upsertGeoStatsCommand(gs)
        commands.push({ command: cmd.command, input: cmd.input })
      }

      // 5. Generate device stats
      const deviceStats = this.aggregator.aggregateDeviceStats(
        config.siteId,
        config.period,
        config.windowStart,
        sessions,
      )
      for (const ds of deviceStats) {
        const cmd = this.store.upsertDeviceStatsCommand(ds)
        commands.push({ command: cmd.command, input: cmd.input })
      }

      // 6. Process goal conversions
      if (goals.length > 0) {
        const goalMatcher = new GoalMatcher(goals)
        const conversions: Conversion[] = []

        // Match pageviews to goals
        for (const pv of pageViews) {
          const matches = goalMatcher.matchPageView(pv)
          for (const match of matches) {
            conversions.push(GoalMatcher.createConversion(config.siteId, match))
          }
        }

        // Match events to goals
        for (const event of events) {
          const matches = goalMatcher.matchEvent(event)
          for (const match of matches) {
            conversions.push(GoalMatcher.createConversion(config.siteId, match))
          }
        }

        conversionsTracked = conversions.length

        // Generate goal stats grouped by goal
        const goalGroups = new Map<string, Conversion[]>()
        for (const conv of conversions) {
          const existing = goalGroups.get(conv.goalId) ?? []
          existing.push(conv)
          goalGroups.set(conv.goalId, existing)
        }

        for (const [goalId, convs] of goalGroups) {
          const goalStats = this.createGoalStats(
            config.siteId,
            goalId,
            config.period,
            config.windowStart,
            convs,
            aggregatedStats.uniqueVisitors,
          )
          const cmd = this.store.upsertGoalStatsCommand(goalStats)
          commands.push({ command: cmd.command, input: cmd.input })
        }
      }

      // 7. Generate event stats
      const eventStats = this.aggregateEventStats(
        config.siteId,
        config.period,
        config.windowStart,
        events,
      )
      for (const es of eventStats) {
        const cmd = this.store.upsertEventStatsCommand(es)
        commands.push({ command: cmd.command, input: cmd.input })
      }

      return {
        config,
        success: true,
        pageViewsProcessed: pageViews.length,
        sessionsProcessed: sessions.length,
        eventsProcessed: events.length,
        conversionsTracked,
        commands,
        durationMs: Date.now() - startTime,
      }
    }
    catch (error) {
      return {
        config,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        pageViewsProcessed: 0,
        sessionsProcessed: 0,
        eventsProcessed: 0,
        conversionsTracked: 0,
        commands,
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Get the next scheduled job times for a site
   */
  static getScheduledJobTimes(now: Date = new Date()): {
    hourly: Date
    daily: Date
    monthly: Date
  } {
    // Hourly: next hour boundary
    const hourly = new Date(now)
    hourly.setMinutes(0, 0, 0)
    hourly.setHours(hourly.getHours() + 1)

    // Daily: next midnight UTC
    const daily = new Date(now)
    daily.setUTCHours(0, 0, 0, 0)
    daily.setUTCDate(daily.getUTCDate() + 1)

    // Monthly: first of next month UTC
    const monthly = new Date(now)
    monthly.setUTCHours(0, 0, 0, 0)
    monthly.setUTCDate(1)
    monthly.setUTCMonth(monthly.getUTCMonth() + 1)

    return { hourly, daily, monthly }
  }

  /**
   * Generate a cron expression for aggregation jobs
   */
  static getCronExpression(period: AggregationPeriod): string {
    switch (period) {
      case 'hour':
        return '0 * * * *' // Every hour at minute 0
      case 'day':
        return '0 0 * * *' // Every day at midnight
      case 'month':
        return '0 0 1 * *' // First day of every month
      default:
        return '0 * * * *'
    }
  }

  /**
   * Get the aggregation window for a period
   */
  static getAggregationWindow(period: AggregationPeriod, referenceTime: Date = new Date()): {
    start: Date
    end: Date
  } {
    const end = new Date(referenceTime)

    switch (period) {
      case 'hour': {
        // Previous hour
        end.setMinutes(0, 0, 0)
        const start = new Date(end)
        start.setHours(start.getHours() - 1)
        return { start, end }
      }
      case 'day': {
        // Previous day
        end.setUTCHours(0, 0, 0, 0)
        const start = new Date(end)
        start.setUTCDate(start.getUTCDate() - 1)
        return { start, end }
      }
      case 'month': {
        // Previous month
        end.setUTCDate(1)
        end.setUTCHours(0, 0, 0, 0)
        const start = new Date(end)
        start.setUTCMonth(start.getUTCMonth() - 1)
        return { start, end }
      }
      default:
        return { start: end, end }
    }
  }

  /**
   * Create a job configuration for a site and period
   */
  static createJobConfig(
    siteId: string,
    period: AggregationPeriod,
    referenceTime?: Date,
  ): PipelineJobConfig {
    const window = AggregationPipeline.getAggregationWindow(period, referenceTime)
    return {
      siteId,
      period,
      windowStart: window.start,
      windowEnd: window.end,
      deleteRawEvents: period === 'hour', // Only delete after hourly aggregation
    }
  }

  /**
   * Helper to aggregate event stats
   */
  private aggregateEventStats(
    siteId: string,
    period: AggregationPeriod,
    periodStart: Date,
    events: CustomEvent[],
  ): EventStats[] {
    const periodStartStr = AnalyticsStore.getPeriodStart(periodStart, period)

    // Group by event name
    const eventGroups = new Map<string, CustomEvent[]>()
    for (const event of events) {
      const existing = eventGroups.get(event.name) ?? []
      existing.push(event)
      eventGroups.set(event.name, existing)
    }

    const results: EventStats[] = []
    for (const [eventName, groupEvents] of eventGroups) {
      const uniqueVisitors = new Set(groupEvents.map(e => e.visitorId))
      const values = groupEvents.filter(e => e.value !== undefined).map(e => e.value!)
      const totalValue = values.reduce((a, b) => a + b, 0)

      results.push({
        siteId,
        period,
        periodStart: periodStartStr,
        eventName,
        count: groupEvents.length,
        uniqueVisitors: uniqueVisitors.size,
        totalValue,
        avgValue: values.length > 0 ? totalValue / values.length : 0,
      })
    }

    return results
  }

  /**
   * Helper to create goal stats
   */
  private createGoalStats(
    siteId: string,
    goalId: string,
    period: AggregationPeriod,
    periodStart: Date,
    conversions: Conversion[],
    totalVisitors: number,
  ): GoalStats {
    const periodStartStr = AnalyticsStore.getPeriodStart(periodStart, period)
    const uniqueConversions = new Set(conversions.map(c => c.visitorId))
    const revenue = conversions.reduce((sum, c) => sum + c.value, 0)

    return {
      siteId,
      goalId,
      period,
      periodStart: periodStartStr,
      conversions: conversions.length,
      uniqueConversions: uniqueConversions.size,
      conversionRate: totalVisitors > 0 ? uniqueConversions.size / totalVisitors : 0,
      revenue,
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
  ${options.trackHashChanges ? 'w.addEventListener(\'hashchange\',pv);' : ''}
  ${options.trackOutboundLinks
    ? `
  d.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(a&&a.hostname!==location.hostname){
      t('outbound',{url:a.href});
    }
  });`
    : ''}
  if(d.readyState==='complete')pv();
  else w.addEventListener('load',pv);
  w.fathom={track:function(n,v){t('event',{name:n,value:v});}};
})();
</script>
`.trim()
}
