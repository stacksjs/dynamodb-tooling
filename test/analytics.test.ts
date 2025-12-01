import { describe, expect, it, beforeEach } from 'bun:test'
import {
  AggregationPipeline,
  AnalyticsAggregator,
  AnalyticsKeyPatterns,
  AnalyticsQueryAPI,
  AnalyticsStore,
  generateTrackingScript,
  GoalMatcher,
  type AggregatedStats,
  type CustomEvent,
  type DateRange,
  type DeviceStats,
  type EventStats,
  type GeoStats,
  type Goal,
  type GoalStats,
  type PageStats,
  type PageView,
  type RealtimeStats,
  type ReferrerStats,
  type Session,
  type Site,
  type SiteSettings,
} from '../src/analytics'

// ============================================================================
// AnalyticsKeyPatterns Tests
// ============================================================================

describe('AnalyticsKeyPatterns', () => {
  describe('site keys', () => {
    it('should generate site pk', () => {
      const pk = AnalyticsKeyPatterns.site.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate site sk', () => {
      const sk = AnalyticsKeyPatterns.site.sk('site-123')
      expect(sk).toBe('SITE#site-123')
    })

    it('should generate site gsi1pk for owner lookup', () => {
      const gsi1pk = AnalyticsKeyPatterns.site.gsi1pk('owner-456')
      expect(gsi1pk).toBe('OWNER#owner-456')
    })

    it('should generate site gsi1sk', () => {
      const gsi1sk = AnalyticsKeyPatterns.site.gsi1sk('site-123')
      expect(gsi1sk).toBe('SITE#site-123')
    })
  })

  describe('pageView keys', () => {
    it('should generate pageView pk', () => {
      const pk = AnalyticsKeyPatterns.pageView.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate pageView sk with timestamp and id', () => {
      const timestamp = new Date('2024-01-15T14:30:00.000Z')
      const sk = AnalyticsKeyPatterns.pageView.sk(timestamp, 'pv-123')
      expect(sk).toBe('PV#2024-01-15T14:30:00.000Z#pv-123')
    })

    it('should generate pageView gsi1pk for date-based queries', () => {
      const gsi1pk = AnalyticsKeyPatterns.pageView.gsi1pk('site-123', '2024-01-15')
      expect(gsi1pk).toBe('SITE#site-123#DATE#2024-01-15')
    })

    it('should generate pageView gsi1sk for path queries', () => {
      const gsi1sk = AnalyticsKeyPatterns.pageView.gsi1sk('/blog/post-1', 'pv-123')
      expect(gsi1sk).toBe('PATH#/blog/post-1#pv-123')
    })

    it('should generate pageView gsi2pk for visitor queries', () => {
      const gsi2pk = AnalyticsKeyPatterns.pageView.gsi2pk('site-123', 'visitor-hash')
      expect(gsi2pk).toBe('SITE#site-123#VISITOR#visitor-hash')
    })
  })

  describe('session keys', () => {
    it('should generate session pk', () => {
      const pk = AnalyticsKeyPatterns.session.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate session sk', () => {
      const sk = AnalyticsKeyPatterns.session.sk('session-456')
      expect(sk).toBe('SESSION#session-456')
    })

    it('should generate session gsi1pk for date-based queries', () => {
      const gsi1pk = AnalyticsKeyPatterns.session.gsi1pk('site-123', '2024-01-15')
      expect(gsi1pk).toBe('SITE#site-123#SESSIONS#2024-01-15')
    })
  })

  describe('customEvent keys', () => {
    it('should generate customEvent pk', () => {
      const pk = AnalyticsKeyPatterns.customEvent.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate customEvent sk', () => {
      const timestamp = new Date('2024-01-15T14:30:00.000Z')
      const sk = AnalyticsKeyPatterns.customEvent.sk(timestamp, 'event-789')
      expect(sk).toBe('EVENT#2024-01-15T14:30:00.000Z#event-789')
    })

    it('should generate customEvent gsi1pk for event name queries', () => {
      const gsi1pk = AnalyticsKeyPatterns.customEvent.gsi1pk('site-123', 'button_click')
      expect(gsi1pk).toBe('SITE#site-123#EVENTNAME#button_click')
    })
  })

  describe('aggregatedStats keys', () => {
    it('should generate aggregatedStats pk', () => {
      const pk = AnalyticsKeyPatterns.aggregatedStats.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate aggregatedStats sk for hourly period', () => {
      const sk = AnalyticsKeyPatterns.aggregatedStats.sk('hour', '2024-01-15T14:00:00.000Z')
      expect(sk).toBe('STATS#HOUR#2024-01-15T14:00:00.000Z')
    })

    it('should generate aggregatedStats sk for daily period', () => {
      const sk = AnalyticsKeyPatterns.aggregatedStats.sk('day', '2024-01-15')
      expect(sk).toBe('STATS#DAY#2024-01-15')
    })

    it('should generate aggregatedStats sk for monthly period', () => {
      const sk = AnalyticsKeyPatterns.aggregatedStats.sk('month', '2024-01')
      expect(sk).toBe('STATS#MONTH#2024-01')
    })
  })

  describe('pageStats keys', () => {
    it('should generate pageStats pk', () => {
      const pk = AnalyticsKeyPatterns.pageStats.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate pageStats sk with encoded path', () => {
      const sk = AnalyticsKeyPatterns.pageStats.sk('day', '2024-01-15', '/blog/my post')
      expect(sk).toBe('PAGESTATS#DAY#2024-01-15#%2Fblog%2Fmy%20post')
    })

    it('should generate pageStats gsi1pk for top pages query', () => {
      const gsi1pk = AnalyticsKeyPatterns.pageStats.gsi1pk('site-123', 'day', '2024-01-15')
      expect(gsi1pk).toBe('SITE#site-123#PAGESTATS#DAY#2024-01-15')
    })

    it('should generate pageStats gsi1sk with padded page views', () => {
      const gsi1sk = AnalyticsKeyPatterns.pageStats.gsi1sk(1234, '/blog')
      expect(gsi1sk).toBe('PV#0000001234#%2Fblog')
    })
  })

  describe('goal keys', () => {
    it('should generate goal pk', () => {
      const pk = AnalyticsKeyPatterns.goal.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate goal sk', () => {
      const sk = AnalyticsKeyPatterns.goal.sk('goal-456')
      expect(sk).toBe('GOAL#goal-456')
    })
  })

  describe('realtimeStats keys', () => {
    it('should generate realtimeStats pk', () => {
      const pk = AnalyticsKeyPatterns.realtimeStats.pk('site-123')
      expect(pk).toBe('SITE#site-123')
    })

    it('should generate realtimeStats sk with minute', () => {
      const sk = AnalyticsKeyPatterns.realtimeStats.sk('2024-01-15T14:30')
      expect(sk).toBe('REALTIME#2024-01-15T14:30')
    })
  })
})

// ============================================================================
// AnalyticsStore Tests
// ============================================================================

describe('AnalyticsStore', () => {
  let store: AnalyticsStore

  beforeEach(() => {
    store = new AnalyticsStore({
      tableName: 'analytics-table',
      useTtl: true,
      rawEventTtl: 2592000, // 30 days
    })
  })

  describe('creation', () => {
    it('should create store with default options', () => {
      const defaultStore = new AnalyticsStore({ tableName: 'test-table' })
      expect(defaultStore).toBeDefined()
    })

    it('should create store with custom options', () => {
      const customStore = new AnalyticsStore({
        tableName: 'custom-table',
        useTtl: false,
        rawEventTtl: 86400,
      })
      expect(customStore).toBeDefined()
    })
  })

  describe('site commands', () => {
    it('should generate createSiteCommand', () => {
      const site: Site = {
        id: 'site-123',
        name: 'My Website',
        domains: ['example.com', 'www.example.com'],
        timezone: 'America/New_York',
        isActive: true,
        ownerId: 'user-456',
        settings: {
          collectGeolocation: false,
          trackReferrers: true,
          trackUtmParams: true,
          trackDeviceType: true,
          publicDashboard: false,
          excludedPaths: [],
          excludedIps: [],
          dataRetentionDays: 365,
        },
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
        updatedAt: new Date('2024-01-15T00:00:00.000Z'),
      }

      const command = store.createSiteCommand(site)

      expect(command.command).toBe('PutItem')
      expect(command.input.TableName).toBe('analytics-table')
      expect(command.input.Item.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Item.sk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Item.gsi1pk).toEqual({ S: 'OWNER#user-456' })
      expect(command.input.Item.name).toEqual({ S: 'My Website' })
      expect(command.input.Item._et).toEqual({ S: 'Site' })
      expect(command.input.ConditionExpression).toBe('attribute_not_exists(pk)')
    })

    it('should generate getSiteCommand', () => {
      const command = store.getSiteCommand('site-123')

      expect(command.command).toBe('GetItem')
      expect(command.input.TableName).toBe('analytics-table')
      expect(command.input.Key.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Key.sk).toEqual({ S: 'SITE#site-123' })
    })

    it('should generate listSitesByOwnerCommand', () => {
      const command = store.listSitesByOwnerCommand('user-456')

      expect(command.command).toBe('Query')
      expect(command.input.IndexName).toBe('GSI1')
      expect(command.input.KeyConditionExpression).toBe('gsi1pk = :pk')
      expect(command.input.ExpressionAttributeValues[':pk']).toEqual({ S: 'OWNER#user-456' })
    })
  })

  describe('pageView commands', () => {
    it('should generate recordPageViewCommand', () => {
      const pageView: PageView = {
        id: 'pv-123',
        siteId: 'site-123',
        visitorId: 'visitor-hash',
        sessionId: 'session-456',
        path: '/blog/post-1',
        hostname: 'example.com',
        title: 'Blog Post 1',
        referrer: 'https://google.com',
        referrerSource: 'google',
        country: 'US',
        deviceType: 'desktop',
        browser: 'Chrome',
        isUnique: true,
        isBounce: false,
        timestamp: new Date('2024-01-15T14:30:00.000Z'),
      }

      const command = store.recordPageViewCommand(pageView)

      expect(command.command).toBe('PutItem')
      expect(command.input.TableName).toBe('analytics-table')
      expect(command.input.Item.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Item.path).toEqual({ S: '/blog/post-1' })
      expect(command.input.Item.visitorId).toEqual({ S: 'visitor-hash' })
      expect(command.input.Item.isUnique).toEqual({ BOOL: true })
      expect(command.input.Item._et).toEqual({ S: 'PageView' })
      expect(command.input.Item.ttl).toBeDefined()
    })

    it('should include optional fields when present', () => {
      const pageView: PageView = {
        id: 'pv-124',
        siteId: 'site-123',
        visitorId: 'visitor-hash',
        sessionId: 'session-456',
        path: '/checkout',
        hostname: 'example.com',
        utmSource: 'facebook',
        utmMedium: 'cpc',
        utmCampaign: 'summer-sale',
        screenWidth: 1920,
        screenHeight: 1080,
        timeOnPage: 45000,
        isUnique: false,
        isBounce: false,
        timestamp: new Date('2024-01-15T14:30:00.000Z'),
      }

      const command = store.recordPageViewCommand(pageView)

      expect(command.input.Item.utmSource).toEqual({ S: 'facebook' })
      expect(command.input.Item.utmMedium).toEqual({ S: 'cpc' })
      expect(command.input.Item.utmCampaign).toEqual({ S: 'summer-sale' })
      expect(command.input.Item.screenWidth).toEqual({ N: '1920' })
      expect(command.input.Item.screenHeight).toEqual({ N: '1080' })
      expect(command.input.Item.timeOnPage).toEqual({ N: '45000' })
    })

    it('should generate queryPageViewsCommand', () => {
      const startDate = new Date('2024-01-15T00:00:00.000Z')
      const endDate = new Date('2024-01-15T23:59:59.999Z')

      const command = store.queryPageViewsCommand('site-123', startDate, endDate)

      expect(command.command).toBe('Query')
      expect(command.input.KeyConditionExpression).toBe('pk = :pk AND sk BETWEEN :start AND :end')
      expect(command.input.ExpressionAttributeValues[':pk']).toEqual({ S: 'SITE#site-123' })
      expect(command.input.ScanIndexForward).toBe(false)
    })

    it('should generate queryPageViewsCommand with path filter', () => {
      const startDate = new Date('2024-01-15T00:00:00.000Z')
      const endDate = new Date('2024-01-15T23:59:59.999Z')

      const command = store.queryPageViewsCommand('site-123', startDate, endDate, {
        path: '/blog',
        limit: 100,
      })

      expect(command.input.FilterExpression).toBe('#path = :path')
      expect(command.input.ExpressionAttributeNames!['#path']).toBe('path')
      expect(command.input.ExpressionAttributeValues[':path']).toEqual({ S: '/blog' })
      expect(command.input.Limit).toBe(100)
    })
  })

  describe('session commands', () => {
    it('should generate upsertSessionCommand', () => {
      const session: Session = {
        id: 'session-456',
        siteId: 'site-123',
        visitorId: 'visitor-hash',
        entryPath: '/home',
        exitPath: '/contact',
        referrer: 'https://google.com',
        referrerSource: 'google',
        country: 'US',
        deviceType: 'desktop',
        browser: 'Chrome',
        os: 'Windows',
        pageViewCount: 5,
        eventCount: 2,
        isBounce: false,
        duration: 180000,
        startedAt: new Date('2024-01-15T14:30:00.000Z'),
        endedAt: new Date('2024-01-15T14:33:00.000Z'),
      }

      const command = store.upsertSessionCommand(session)

      expect(command.command).toBe('PutItem')
      expect(command.input.Item.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Item.sk).toEqual({ S: 'SESSION#session-456' })
      expect(command.input.Item.pageViewCount).toEqual({ N: '5' })
      expect(command.input.Item.duration).toEqual({ N: '180000' })
      expect(command.input.Item._et).toEqual({ S: 'Session' })
    })
  })

  describe('customEvent commands', () => {
    it('should generate recordCustomEventCommand', () => {
      const event: CustomEvent = {
        id: 'event-789',
        siteId: 'site-123',
        visitorId: 'visitor-hash',
        sessionId: 'session-456',
        name: 'button_click',
        value: 29.99,
        properties: { button: 'checkout', plan: 'pro' },
        path: '/pricing',
        timestamp: new Date('2024-01-15T14:30:00.000Z'),
      }

      const command = store.recordCustomEventCommand(event)

      expect(command.command).toBe('PutItem')
      expect(command.input.Item.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Item.name).toEqual({ S: 'button_click' })
      expect(command.input.Item.value).toEqual({ N: '29.99' })
      expect(command.input.Item.properties).toEqual({ S: '{"button":"checkout","plan":"pro"}' })
      expect(command.input.Item._et).toEqual({ S: 'CustomEvent' })
    })
  })

  describe('aggregatedStats commands', () => {
    it('should generate upsertAggregatedStatsCommand', () => {
      const stats: AggregatedStats = {
        siteId: 'site-123',
        period: 'hour',
        periodStart: '2024-01-15T14:00:00.000Z',
        pageViews: 150,
        uniqueVisitors: 75,
        sessions: 80,
        bounces: 20,
        bounceRate: 0.25,
        avgSessionDuration: 120000,
        avgPagesPerSession: 1.875,
        totalTimeOnSite: 9600000,
        newVisitors: 50,
        returningVisitors: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const command = store.upsertAggregatedStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.Key.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Key.sk).toEqual({ S: 'STATS#HOUR#2024-01-15T14:00:00.000Z' })
      expect(command.input.UpdateExpression).toContain('#pv = if_not_exists(#pv, :zero) + :pv')
      expect(command.input.ExpressionAttributeValues[':pv']).toEqual({ N: '150' })
      expect(command.input.ExpressionAttributeValues[':uv']).toEqual({ N: '75' })
    })

    it('should generate getAggregatedStatsCommand', () => {
      const command = store.getAggregatedStatsCommand(
        'site-123',
        'day',
        '2024-01-01',
        '2024-01-31',
      )

      expect(command.command).toBe('Query')
      expect(command.input.KeyConditionExpression).toBe('pk = :pk AND sk BETWEEN :start AND :end')
      expect(command.input.ExpressionAttributeValues[':start']).toEqual({ S: 'STATS#DAY#2024-01-01' })
      expect(command.input.ExpressionAttributeValues[':end']).toEqual({ S: 'STATS#DAY#2024-01-31' })
      expect(command.input.ScanIndexForward).toBe(true)
    })
  })

  describe('pageStats commands', () => {
    it('should generate upsertPageStatsCommand', () => {
      const stats: PageStats = {
        siteId: 'site-123',
        period: 'day',
        periodStart: '2024-01-15',
        path: '/blog/post-1',
        title: 'Blog Post 1',
        pageViews: 250,
        uniqueVisitors: 200,
        entries: 150,
        exits: 100,
        bounces: 50,
        avgTimeOnPage: 45000,
        exitRate: 0.4,
      }

      const command = store.upsertPageStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.ExpressionAttributeValues[':pv']).toEqual({ N: '250' })
      expect(command.input.ExpressionAttributeValues[':path']).toEqual({ S: '/blog/post-1' })
    })

    it('should generate getTopPagesCommand', () => {
      const command = store.getTopPagesCommand('site-123', 'day', '2024-01-15', 20)

      expect(command.command).toBe('Query')
      expect(command.input.IndexName).toBe('GSI1')
      expect(command.input.Limit).toBe(20)
      expect(command.input.ScanIndexForward).toBe(false)
    })
  })

  describe('referrerStats commands', () => {
    it('should generate upsertReferrerStatsCommand', () => {
      const stats: ReferrerStats = {
        siteId: 'site-123',
        period: 'day',
        periodStart: '2024-01-15',
        source: 'google',
        referrer: 'https://google.com/search?q=test',
        visitors: 100,
        pageViews: 250,
        bounceRate: 0.3,
        avgSessionDuration: 120000,
      }

      const command = store.upsertReferrerStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.ExpressionAttributeValues[':visitors']).toEqual({ N: '100' })
      expect(command.input.ExpressionAttributeValues[':source']).toEqual({ S: 'google' })
    })
  })

  describe('goal commands', () => {
    it('should generate createGoalCommand', () => {
      const goal: Goal = {
        id: 'goal-123',
        siteId: 'site-123',
        name: 'Newsletter Signup',
        type: 'event',
        pattern: 'newsletter_signup',
        matchType: 'exact',
        value: 5.0,
        isActive: true,
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
        updatedAt: new Date('2024-01-15T00:00:00.000Z'),
      }

      const command = store.createGoalCommand(goal)

      expect(command.command).toBe('PutItem')
      expect(command.input.Item.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Item.sk).toEqual({ S: 'GOAL#goal-123' })
      expect(command.input.Item.name).toEqual({ S: 'Newsletter Signup' })
      expect(command.input.Item.type).toEqual({ S: 'event' })
      expect(command.input.Item.value).toEqual({ N: '5' })
      expect(command.input.Item._et).toEqual({ S: 'Goal' })
    })

    it('should generate listGoalsCommand', () => {
      const command = store.listGoalsCommand('site-123')

      expect(command.command).toBe('Query')
      expect(command.input.KeyConditionExpression).toBe('pk = :pk AND begins_with(sk, :skPrefix)')
      expect(command.input.ExpressionAttributeValues[':skPrefix']).toEqual({ S: 'GOAL#' })
    })
  })

  describe('realtimeStats commands', () => {
    it('should generate updateRealtimeStatsCommand', () => {
      const stats: RealtimeStats = {
        siteId: 'site-123',
        minute: '2024-01-15T14:30',
        currentVisitors: 25,
        pageViews: 50,
        activePages: {
          '/home': 10,
          '/blog': 8,
          '/pricing': 7,
        },
        ttl: Math.floor(Date.now() / 1000) + 600,
      }

      const command = store.updateRealtimeStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.Key.pk).toEqual({ S: 'SITE#site-123' })
      expect(command.input.Key.sk).toEqual({ S: 'REALTIME#2024-01-15T14:30' })
      expect(command.input.ExpressionAttributeValues[':cv']).toEqual({ N: '25' })
    })

    it('should generate getRealtimeStatsCommand', () => {
      const command = store.getRealtimeStatsCommand('site-123', 10)

      expect(command.command).toBe('Query')
      expect(command.input.Limit).toBe(10)
      expect(command.input.ScanIndexForward).toBe(false)
    })
  })

  describe('static helpers', () => {
    describe('getPeriodStart', () => {
      it('should get hourly period start', () => {
        const date = new Date('2024-01-15T14:30:45.123Z')
        const periodStart = AnalyticsStore.getPeriodStart(date, 'hour')
        expect(periodStart).toBe('2024-01-15T14:00:00.000Z')
      })

      it('should get daily period start', () => {
        const date = new Date('2024-01-15T14:30:45.123Z')
        const periodStart = AnalyticsStore.getPeriodStart(date, 'day')
        expect(periodStart).toBe('2024-01-15')
      })

      it('should get monthly period start', () => {
        const date = new Date('2024-01-15T14:30:45.123Z')
        const periodStart = AnalyticsStore.getPeriodStart(date, 'month')
        expect(periodStart).toBe('2024-01')
      })
    })

    describe('generateId', () => {
      it('should generate unique IDs', () => {
        const id1 = AnalyticsStore.generateId()
        const id2 = AnalyticsStore.generateId()

        expect(id1).toBeDefined()
        expect(id2).toBeDefined()
        expect(id1).not.toBe(id2)
      })

      it('should generate UUID format', () => {
        const id = AnalyticsStore.generateId()
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      })
    })

    describe('hashVisitorId', () => {
      it('should hash visitor data', async () => {
        const hash = await AnalyticsStore.hashVisitorId(
          '192.168.1.1',
          'Mozilla/5.0',
          'site-123',
          'daily-salt',
        )

        expect(hash).toBeDefined()
        expect(hash).toHaveLength(64) // SHA-256 produces 64 hex chars
      })

      it('should produce different hashes for different inputs', async () => {
        const hash1 = await AnalyticsStore.hashVisitorId('192.168.1.1', 'Mozilla/5.0', 'site-123', 'salt1')
        const hash2 = await AnalyticsStore.hashVisitorId('192.168.1.2', 'Mozilla/5.0', 'site-123', 'salt1')

        expect(hash1).not.toBe(hash2)
      })

      it('should produce same hash for same inputs', async () => {
        const hash1 = await AnalyticsStore.hashVisitorId('192.168.1.1', 'Mozilla/5.0', 'site-123', 'salt')
        const hash2 = await AnalyticsStore.hashVisitorId('192.168.1.1', 'Mozilla/5.0', 'site-123', 'salt')

        expect(hash1).toBe(hash2)
      })
    })

    describe('parseReferrerSource', () => {
      it('should return direct for no referrer', () => {
        expect(AnalyticsStore.parseReferrerSource(undefined)).toBe('direct')
        expect(AnalyticsStore.parseReferrerSource('')).toBe('direct')
      })

      it('should identify Google', () => {
        expect(AnalyticsStore.parseReferrerSource('https://www.google.com/search?q=test')).toBe('google')
        expect(AnalyticsStore.parseReferrerSource('https://google.co.uk/')).toBe('google')
      })

      it('should identify Bing', () => {
        expect(AnalyticsStore.parseReferrerSource('https://www.bing.com/search?q=test')).toBe('bing')
      })

      it('should identify social media', () => {
        expect(AnalyticsStore.parseReferrerSource('https://www.facebook.com/')).toBe('facebook')
        expect(AnalyticsStore.parseReferrerSource('https://t.co/abc123')).toBe('twitter')
        expect(AnalyticsStore.parseReferrerSource('https://twitter.com/user/status/123')).toBe('twitter')
        expect(AnalyticsStore.parseReferrerSource('https://www.linkedin.com/feed')).toBe('linkedin')
        expect(AnalyticsStore.parseReferrerSource('https://www.reddit.com/r/programming')).toBe('reddit')
        expect(AnalyticsStore.parseReferrerSource('https://www.youtube.com/watch?v=123')).toBe('youtube')
      })

      it('should return domain for unknown referrers', () => {
        expect(AnalyticsStore.parseReferrerSource('https://www.example.com/page')).toBe('example.com')
        expect(AnalyticsStore.parseReferrerSource('https://blog.mysite.org/')).toBe('blog.mysite.org')
      })

      it('should return unknown for invalid URLs', () => {
        expect(AnalyticsStore.parseReferrerSource('not-a-url')).toBe('unknown')
      })
    })

    describe('parseUserAgent', () => {
      it('should identify desktop Chrome on Windows', () => {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        const result = AnalyticsStore.parseUserAgent(ua)

        expect(result.deviceType).toBe('desktop')
        expect(result.browser).toBe('Chrome')
        expect(result.browserVersion).toBe('120.0.0.0')
        expect(result.os).toBe('Windows')
        expect(result.osVersion).toBe('10')
      })

      it('should identify mobile Safari on iOS', () => {
        const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
        const result = AnalyticsStore.parseUserAgent(ua)

        expect(result.deviceType).toBe('mobile')
        expect(result.browser).toBe('Safari')
        expect(result.os).toBe('iOS')
      })

      it('should identify tablet iPad', () => {
        const ua = 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
        const result = AnalyticsStore.parseUserAgent(ua)

        expect(result.deviceType).toBe('tablet')
      })

      it('should identify Firefox on Linux', () => {
        const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
        const result = AnalyticsStore.parseUserAgent(ua)

        expect(result.browser).toBe('Firefox')
        expect(result.browserVersion).toBe('121.0')
        expect(result.os).toBe('Linux')
      })

      it('should identify Edge browser', () => {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        const result = AnalyticsStore.parseUserAgent(ua)

        expect(result.browser).toBe('Edge')
        expect(result.browserVersion).toBe('120.0.0.0')
      })

      it('should identify Android device', () => {
        const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        const result = AnalyticsStore.parseUserAgent(ua)

        expect(result.deviceType).toBe('mobile')
        expect(result.os).toBe('Android')
        expect(result.osVersion).toBe('14')
      })
    })
  })
})

// ============================================================================
// AnalyticsAggregator Tests
// ============================================================================

describe('AnalyticsAggregator', () => {
  let store: AnalyticsStore
  let aggregator: AnalyticsAggregator

  beforeEach(() => {
    store = new AnalyticsStore({ tableName: 'analytics-table' })
    aggregator = new AnalyticsAggregator({ store, batchSize: 50 })
  })

  describe('aggregateHourlyStats', () => {
    it('should aggregate hourly stats from page views and sessions', () => {
      const hourStart = new Date('2024-01-15T14:00:00.000Z')

      const pageViews: PageView[] = [
        createPageView('pv-1', 'visitor-1', 'session-1', '/home', true, false),
        createPageView('pv-2', 'visitor-1', 'session-1', '/about', false, false),
        createPageView('pv-3', 'visitor-2', 'session-2', '/home', true, true),
        createPageView('pv-4', 'visitor-3', 'session-3', '/pricing', true, false),
        createPageView('pv-5', 'visitor-3', 'session-3', '/checkout', false, false),
      ]

      const sessions: Session[] = [
        createSession('session-1', 'visitor-1', 2, false, 120000),
        createSession('session-2', 'visitor-2', 1, true, 5000),
        createSession('session-3', 'visitor-3', 2, false, 180000),
      ]

      const stats = aggregator.aggregateHourlyStats('site-123', hourStart, pageViews, sessions)

      expect(stats.siteId).toBe('site-123')
      expect(stats.period).toBe('hour')
      expect(stats.periodStart).toBe('2024-01-15T14:00:00.000Z')
      expect(stats.pageViews).toBe(5)
      expect(stats.uniqueVisitors).toBe(3)
      expect(stats.sessions).toBe(3)
      expect(stats.bounces).toBe(1)
      expect(stats.bounceRate).toBeCloseTo(0.333, 2)
      expect(stats.avgSessionDuration).toBeCloseTo(101666.67, 0)
      expect(stats.avgPagesPerSession).toBeCloseTo(1.67, 2)
    })

    it('should handle empty data', () => {
      const hourStart = new Date('2024-01-15T14:00:00.000Z')

      const stats = aggregator.aggregateHourlyStats('site-123', hourStart, [], [])

      expect(stats.pageViews).toBe(0)
      expect(stats.uniqueVisitors).toBe(0)
      expect(stats.sessions).toBe(0)
      expect(stats.bounceRate).toBe(0)
      expect(stats.avgSessionDuration).toBe(0)
    })
  })

  describe('aggregatePageStats', () => {
    it('should aggregate page-level stats', () => {
      const periodStart = new Date('2024-01-15T00:00:00.000Z')

      const pageViews: PageView[] = [
        createPageView('pv-1', 'visitor-1', 'session-1', '/home', true, false, 30000),
        createPageView('pv-2', 'visitor-2', 'session-2', '/home', true, true, 5000),
        createPageView('pv-3', 'visitor-3', 'session-3', '/home', true, false, 60000),
        createPageView('pv-4', 'visitor-1', 'session-1', '/about', false, false, 20000),
        createPageView('pv-5', 'visitor-4', 'session-4', '/about', true, false, 45000),
      ]

      const stats = aggregator.aggregatePageStats('site-123', 'day', periodStart, pageViews)

      expect(stats).toHaveLength(2)

      const homeStats = stats.find(s => s.path === '/home')!
      expect(homeStats.pageViews).toBe(3)
      expect(homeStats.uniqueVisitors).toBe(3)
      expect(homeStats.entries).toBe(3)
      expect(homeStats.bounces).toBe(1)
      expect(homeStats.avgTimeOnPage).toBeCloseTo(31666.67, 0)

      const aboutStats = stats.find(s => s.path === '/about')!
      expect(aboutStats.pageViews).toBe(2)
      expect(aboutStats.uniqueVisitors).toBe(2)
      expect(aboutStats.entries).toBe(1)
    })
  })

  describe('aggregateReferrerStats', () => {
    it('should aggregate referrer stats from sessions', () => {
      const periodStart = new Date('2024-01-15T00:00:00.000Z')

      const sessions: Session[] = [
        createSession('session-1', 'visitor-1', 3, false, 120000, 'google'),
        createSession('session-2', 'visitor-2', 1, true, 5000, 'google'),
        createSession('session-3', 'visitor-3', 2, false, 90000, 'twitter'),
        createSession('session-4', 'visitor-4', 4, false, 180000, 'direct'),
      ]

      const stats = aggregator.aggregateReferrerStats('site-123', 'day', periodStart, sessions)

      expect(stats).toHaveLength(3)

      const googleStats = stats.find(s => s.source === 'google')!
      expect(googleStats.visitors).toBe(2)
      expect(googleStats.pageViews).toBe(4)
      expect(googleStats.bounceRate).toBe(0.5)

      const twitterStats = stats.find(s => s.source === 'twitter')!
      expect(twitterStats.visitors).toBe(1)
      expect(twitterStats.pageViews).toBe(2)

      const directStats = stats.find(s => s.source === 'direct')!
      expect(directStats.visitors).toBe(1)
      expect(directStats.bounceRate).toBe(0)
    })
  })

  describe('aggregateGeoStats', () => {
    it('should aggregate geographic stats from sessions', () => {
      const periodStart = new Date('2024-01-15T00:00:00.000Z')

      const sessions: Session[] = [
        createSessionWithCountry('session-1', 'visitor-1', 3, false, 'US'),
        createSessionWithCountry('session-2', 'visitor-2', 1, true, 'US'),
        createSessionWithCountry('session-3', 'visitor-3', 2, false, 'GB'),
        createSessionWithCountry('session-4', 'visitor-4', 4, false, 'DE'),
      ]

      const stats = aggregator.aggregateGeoStats('site-123', 'day', periodStart, sessions)

      expect(stats).toHaveLength(3)

      const usStats = stats.find(s => s.country === 'US')!
      expect(usStats.visitors).toBe(2)
      expect(usStats.pageViews).toBe(4)
      expect(usStats.bounceRate).toBe(0.5)

      const gbStats = stats.find(s => s.country === 'GB')!
      expect(gbStats.visitors).toBe(1)
    })
  })

  describe('aggregateDeviceStats', () => {
    it('should aggregate device stats from sessions', () => {
      const periodStart = new Date('2024-01-15T00:00:00.000Z')

      const sessions: Session[] = [
        createSessionWithDevice('session-1', 'visitor-1', 3, false, 'desktop', 'Chrome', 'Windows'),
        createSessionWithDevice('session-2', 'visitor-2', 1, true, 'mobile', 'Safari', 'iOS'),
        createSessionWithDevice('session-3', 'visitor-3', 2, false, 'mobile', 'Chrome', 'Android'),
        createSessionWithDevice('session-4', 'visitor-4', 4, false, 'desktop', 'Firefox', 'Linux'),
      ]

      const stats = aggregator.aggregateDeviceStats('site-123', 'day', periodStart, sessions)

      // Should have stats for device, browser, and OS dimensions
      const deviceStats = stats.filter(s => s.dimension === 'device')
      expect(deviceStats).toHaveLength(2) // desktop, mobile

      const desktopStats = deviceStats.find(s => s.value === 'desktop')!
      expect(desktopStats.visitors).toBe(2)
      expect(desktopStats.pageViews).toBe(7)

      const mobileStats = deviceStats.find(s => s.value === 'mobile')!
      expect(mobileStats.visitors).toBe(2)
      expect(mobileStats.bounceRate).toBe(0.5)

      const browserStats = stats.filter(s => s.dimension === 'browser')
      expect(browserStats).toHaveLength(3) // Chrome, Safari, Firefox

      const osStats = stats.filter(s => s.dimension === 'os')
      expect(osStats).toHaveLength(4) // Windows, iOS, Android, Linux
    })
  })
})

// ============================================================================
// generateTrackingScript Tests
// ============================================================================

describe('generateTrackingScript', () => {
  it('should generate basic tracking script', () => {
    const script = generateTrackingScript({
      siteId: 'site-123',
      apiEndpoint: 'https://api.example.com',
    })

    expect(script).toContain('data-site="site-123"')
    expect(script).toContain('data-api="https://api.example.com"')
    expect(script).toContain("x.open('POST',api+'/collect',true)")
    expect(script).toContain('fathom')
  })

  it('should include DNT check when honorDnt is true', () => {
    const script = generateTrackingScript({
      siteId: 'site-123',
      apiEndpoint: 'https://api.example.com',
      honorDnt: true,
    })

    expect(script).toContain('doNotTrack')
    expect(script).toContain('return')
  })

  it('should not include DNT check when honorDnt is false', () => {
    const script = generateTrackingScript({
      siteId: 'site-123',
      apiEndpoint: 'https://api.example.com',
      honorDnt: false,
    })

    expect(script).not.toContain('doNotTrack')
  })

  it('should include hash change tracking when enabled', () => {
    const script = generateTrackingScript({
      siteId: 'site-123',
      apiEndpoint: 'https://api.example.com',
      trackHashChanges: true,
    })

    expect(script).toContain('hashchange')
  })

  it('should include outbound link tracking when enabled', () => {
    const script = generateTrackingScript({
      siteId: 'site-123',
      apiEndpoint: 'https://api.example.com',
      trackOutboundLinks: true,
    })

    expect(script).toContain('outbound')
    expect(script).toContain("e.target.closest('a')")
  })

  it('should generate valid HTML', () => {
    const script = generateTrackingScript({
      siteId: 'site-123',
      apiEndpoint: 'https://api.example.com',
    })

    expect(script).toMatch(/^<!--.*-->/)
    expect(script).toContain('<script')
    expect(script).toContain('</script>')
  })
})

// ============================================================================
// Helper Functions
// ============================================================================

function createPageView(
  id: string,
  visitorId: string,
  sessionId: string,
  path: string,
  isUnique: boolean,
  isBounce: boolean,
  timeOnPage?: number,
): PageView {
  return {
    id,
    siteId: 'site-123',
    visitorId,
    sessionId,
    path,
    hostname: 'example.com',
    isUnique,
    isBounce,
    timeOnPage,
    timestamp: new Date('2024-01-15T14:30:00.000Z'),
  }
}

function createSession(
  id: string,
  visitorId: string,
  pageViewCount: number,
  isBounce: boolean,
  duration: number,
  referrerSource?: string,
): Session {
  return {
    id,
    siteId: 'site-123',
    visitorId,
    entryPath: '/home',
    exitPath: '/contact',
    referrerSource,
    pageViewCount,
    eventCount: 0,
    isBounce,
    duration,
    startedAt: new Date('2024-01-15T14:00:00.000Z'),
    endedAt: new Date('2024-01-15T14:02:00.000Z'),
  }
}

function createSessionWithCountry(
  id: string,
  visitorId: string,
  pageViewCount: number,
  isBounce: boolean,
  country: string,
): Session {
  return {
    ...createSession(id, visitorId, pageViewCount, isBounce, 60000),
    country,
  }
}

function createSessionWithDevice(
  id: string,
  visitorId: string,
  pageViewCount: number,
  isBounce: boolean,
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown',
  browser: string,
  os: string,
): Session {
  return {
    ...createSession(id, visitorId, pageViewCount, isBounce, 60000),
    deviceType,
    browser,
    os,
  }
}

function createGoal(
  id: string,
  type: 'pageview' | 'event',
  pattern: string,
  matchType: 'exact' | 'contains' | 'regex',
  value?: number,
): Goal {
  return {
    id,
    siteId: 'site-123',
    name: `Goal ${id}`,
    type,
    pattern,
    matchType,
    value,
    isActive: true,
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-01-15T00:00:00.000Z'),
  }
}

function createCustomEvent(
  id: string,
  visitorId: string,
  sessionId: string,
  name: string,
  value?: number,
): CustomEvent {
  return {
    id,
    siteId: 'site-123',
    visitorId,
    sessionId,
    name,
    value,
    path: '/checkout',
    timestamp: new Date('2024-01-15T14:30:00.000Z'),
  }
}

// ============================================================================
// GoalMatcher Tests
// ============================================================================

describe('GoalMatcher', () => {
  describe('matchPageView', () => {
    it('should match exact pageview patterns', () => {
      const goals = [createGoal('goal-1', 'pageview', '/checkout/success', 'exact', 29.99)]
      const matcher = new GoalMatcher(goals)

      const matchingPv = createPageView('pv-1', 'visitor-1', 'session-1', '/checkout/success', true, false)
      const nonMatchingPv = createPageView('pv-2', 'visitor-1', 'session-1', '/checkout', true, false)

      const matches = matcher.matchPageView(matchingPv)
      expect(matches).toHaveLength(1)
      expect(matches[0].matched).toBe(true)
      expect(matches[0].goal.id).toBe('goal-1')
      expect(matches[0].value).toBe(29.99)

      const noMatches = matcher.matchPageView(nonMatchingPv)
      expect(noMatches).toHaveLength(0)
    })

    it('should match contains pageview patterns', () => {
      const goals = [createGoal('goal-1', 'pageview', '/blog/', 'contains')]
      const matcher = new GoalMatcher(goals)

      const matchingPv = createPageView('pv-1', 'visitor-1', 'session-1', '/blog/my-post', true, false)
      const nonMatchingPv = createPageView('pv-2', 'visitor-1', 'session-1', '/about', true, false)

      const matches = matcher.matchPageView(matchingPv)
      expect(matches).toHaveLength(1)

      const noMatches = matcher.matchPageView(nonMatchingPv)
      expect(noMatches).toHaveLength(0)
    })

    it('should match regex pageview patterns', () => {
      const goals = [createGoal('goal-1', 'pageview', '^/products/\\d+$', 'regex')]
      const matcher = new GoalMatcher(goals)

      const matchingPv = createPageView('pv-1', 'visitor-1', 'session-1', '/products/123', true, false)
      const nonMatchingPv = createPageView('pv-2', 'visitor-1', 'session-1', '/products/abc', true, false)

      const matches = matcher.matchPageView(matchingPv)
      expect(matches).toHaveLength(1)

      const noMatches = matcher.matchPageView(nonMatchingPv)
      expect(noMatches).toHaveLength(0)
    })

    it('should match multiple goals', () => {
      const goals = [
        createGoal('goal-1', 'pageview', '/checkout', 'contains'),
        createGoal('goal-2', 'pageview', '/checkout/success', 'exact', 50),
      ]
      const matcher = new GoalMatcher(goals)

      const pv = createPageView('pv-1', 'visitor-1', 'session-1', '/checkout/success', true, false)
      const matches = matcher.matchPageView(pv)

      expect(matches).toHaveLength(2)
    })

    it('should ignore inactive goals', () => {
      const goals = [{
        ...createGoal('goal-1', 'pageview', '/checkout', 'exact'),
        isActive: false,
      }]
      const matcher = new GoalMatcher(goals)

      const pv = createPageView('pv-1', 'visitor-1', 'session-1', '/checkout', true, false)
      const matches = matcher.matchPageView(pv)

      expect(matches).toHaveLength(0)
    })

    it('should not match event-type goals to pageviews', () => {
      const goals = [createGoal('goal-1', 'event', 'purchase', 'exact')]
      const matcher = new GoalMatcher(goals)

      const pv = createPageView('pv-1', 'visitor-1', 'session-1', 'purchase', true, false)
      const matches = matcher.matchPageView(pv)

      expect(matches).toHaveLength(0)
    })
  })

  describe('matchEvent', () => {
    it('should match exact event patterns', () => {
      const goals = [createGoal('goal-1', 'event', 'purchase', 'exact', 99.99)]
      const matcher = new GoalMatcher(goals)

      const matchingEvent = createCustomEvent('evt-1', 'visitor-1', 'session-1', 'purchase', 149.99)
      const nonMatchingEvent = createCustomEvent('evt-2', 'visitor-1', 'session-1', 'add_to_cart')

      const matches = matcher.matchEvent(matchingEvent)
      expect(matches).toHaveLength(1)
      expect(matches[0].value).toBe(149.99) // Event value takes precedence

      const noMatches = matcher.matchEvent(nonMatchingEvent)
      expect(noMatches).toHaveLength(0)
    })

    it('should match contains event patterns', () => {
      const goals = [createGoal('goal-1', 'event', 'signup', 'contains')]
      const matcher = new GoalMatcher(goals)

      const matchingEvent = createCustomEvent('evt-1', 'visitor-1', 'session-1', 'newsletter_signup')
      const matches = matcher.matchEvent(matchingEvent)

      expect(matches).toHaveLength(1)
    })

    it('should use goal value when event has no value', () => {
      const goals = [createGoal('goal-1', 'event', 'signup', 'exact', 10)]
      const matcher = new GoalMatcher(goals)

      const event = createCustomEvent('evt-1', 'visitor-1', 'session-1', 'signup')
      const matches = matcher.matchEvent(event)

      expect(matches).toHaveLength(1)
      expect(matches[0].value).toBe(10)
    })
  })

  describe('createConversion', () => {
    it('should create conversion from goal match', () => {
      const goals = [createGoal('goal-1', 'pageview', '/checkout', 'exact', 50)]
      const matcher = new GoalMatcher(goals)

      const pv = createPageView('pv-1', 'visitor-1', 'session-1', '/checkout', true, false)
      const matches = matcher.matchPageView(pv)

      const conversion = GoalMatcher.createConversion('site-123', matches[0])

      expect(conversion.siteId).toBe('site-123')
      expect(conversion.goalId).toBe('goal-1')
      expect(conversion.visitorId).toBe('visitor-1')
      expect(conversion.sessionId).toBe('session-1')
      expect(conversion.value).toBe(50)
      expect(conversion.path).toBe('/checkout')
      expect(conversion.id).toBeDefined()
    })
  })
})

// ============================================================================
// AnalyticsQueryAPI Tests
// ============================================================================

describe('AnalyticsQueryAPI', () => {
  let store: AnalyticsStore
  let queryApi: AnalyticsQueryAPI

  beforeEach(() => {
    store = new AnalyticsStore({ tableName: 'analytics-table' })
    queryApi = new AnalyticsQueryAPI(store)
  })

  describe('determinePeriod', () => {
    it('should return hour for ranges <= 2 days', () => {
      const range: DateRange = {
        start: new Date('2024-01-15T00:00:00Z'),
        end: new Date('2024-01-16T12:00:00Z'),
      }
      expect(AnalyticsQueryAPI.determinePeriod(range)).toBe('hour')
    })

    it('should return day for ranges <= 90 days', () => {
      const range: DateRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-02-15T00:00:00Z'),
      }
      expect(AnalyticsQueryAPI.determinePeriod(range)).toBe('day')
    })

    it('should return month for ranges > 90 days', () => {
      const range: DateRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-06-01T00:00:00Z'),
      }
      expect(AnalyticsQueryAPI.determinePeriod(range)).toBe('month')
    })
  })

  describe('getPreviousPeriod', () => {
    it('should calculate previous period correctly', () => {
      const range: DateRange = {
        start: new Date('2024-01-15T00:00:00Z'),
        end: new Date('2024-01-22T00:00:00Z'),
      }

      const prevPeriod = AnalyticsQueryAPI.getPreviousPeriod(range)

      expect(prevPeriod.start.toISOString()).toBe('2024-01-08T00:00:00.000Z')
      expect(prevPeriod.end.getTime()).toBeLessThan(range.start.getTime())
    })
  })

  describe('generateDashboardQueries', () => {
    it('should generate basic dashboard queries', () => {
      const queries = queryApi.generateDashboardQueries({
        siteId: 'site-123',
        dateRange: {
          start: new Date('2024-01-15T00:00:00Z'),
          end: new Date('2024-01-22T00:00:00Z'),
        },
      })

      expect(queries.aggregatedStats).toBeDefined()
      expect(queries.aggregatedStats.command).toBe('Query')
      expect(queries.topPages).toBeDefined()
      expect(queries.topPages.command).toBe('Query')
    })

    it('should include realtime stats when requested', () => {
      const queries = queryApi.generateDashboardQueries({
        siteId: 'site-123',
        dateRange: {
          start: new Date('2024-01-15T00:00:00Z'),
          end: new Date('2024-01-22T00:00:00Z'),
        },
        includeRealtime: true,
      })

      expect(queries.realtimeStats).toBeDefined()
    })

    it('should include goals when requested', () => {
      const queries = queryApi.generateDashboardQueries({
        siteId: 'site-123',
        dateRange: {
          start: new Date('2024-01-15T00:00:00Z'),
          end: new Date('2024-01-22T00:00:00Z'),
        },
        includeGoals: true,
      })

      expect(queries.goals).toBeDefined()
    })

    it('should include comparison period when requested', () => {
      const queries = queryApi.generateDashboardQueries({
        siteId: 'site-123',
        dateRange: {
          start: new Date('2024-01-15T00:00:00Z'),
          end: new Date('2024-01-22T00:00:00Z'),
        },
        includeComparison: true,
      })

      expect(queries.previousPeriodStats).toBeDefined()
    })
  })

  describe('processSummary', () => {
    it('should process aggregated stats into summary', () => {
      const stats: AggregatedStats[] = [
        {
          siteId: 'site-123',
          period: 'day',
          periodStart: '2024-01-15',
          pageViews: 100,
          uniqueVisitors: 50,
          sessions: 60,
          bounces: 15,
          bounceRate: 0.25,
          avgSessionDuration: 120000,
          avgPagesPerSession: 1.67,
          totalTimeOnSite: 7200000,
          newVisitors: 40,
          returningVisitors: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          siteId: 'site-123',
          period: 'day',
          periodStart: '2024-01-16',
          pageViews: 150,
          uniqueVisitors: 75,
          sessions: 80,
          bounces: 20,
          bounceRate: 0.25,
          avgSessionDuration: 150000,
          avgPagesPerSession: 1.87,
          totalTimeOnSite: 12000000,
          newVisitors: 50,
          returningVisitors: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const summary = AnalyticsQueryAPI.processSummary(stats)

      expect(summary.pageViews).toBe(250)
      expect(summary.uniqueVisitors).toBe(125)
      expect(summary.sessions).toBe(140)
      expect(summary.bounceRate).toBeCloseTo(0.25, 2)
    })

    it('should calculate comparison when previous stats provided', () => {
      const currentStats: AggregatedStats[] = [{
        siteId: 'site-123',
        period: 'day',
        periodStart: '2024-01-15',
        pageViews: 200,
        uniqueVisitors: 100,
        sessions: 100,
        bounces: 25,
        bounceRate: 0.25,
        avgSessionDuration: 120000,
        avgPagesPerSession: 2,
        totalTimeOnSite: 12000000,
        newVisitors: 80,
        returningVisitors: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]

      const previousStats: AggregatedStats[] = [{
        siteId: 'site-123',
        period: 'day',
        periodStart: '2024-01-14',
        pageViews: 100,
        uniqueVisitors: 50,
        sessions: 50,
        bounces: 15,
        bounceRate: 0.3,
        avgSessionDuration: 100000,
        avgPagesPerSession: 2,
        totalTimeOnSite: 5000000,
        newVisitors: 40,
        returningVisitors: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]

      const summary = AnalyticsQueryAPI.processSummary(currentStats, previousStats)

      expect(summary.comparison).toBeDefined()
      expect(summary.comparison!.pageViewsChange).toBe(100) // 100% increase
      expect(summary.comparison!.visitorsChange).toBe(100) // 100% increase
    })
  })

  describe('processTimeSeries', () => {
    it('should convert stats to sorted time series', () => {
      const stats: AggregatedStats[] = [
        {
          siteId: 'site-123', period: 'day', periodStart: '2024-01-16',
          pageViews: 150, uniqueVisitors: 75, sessions: 80, bounces: 20, bounceRate: 0.25,
          avgSessionDuration: 150000, avgPagesPerSession: 1.87, totalTimeOnSite: 12000000,
          newVisitors: 50, returningVisitors: 25, createdAt: new Date(), updatedAt: new Date(),
        },
        {
          siteId: 'site-123', period: 'day', periodStart: '2024-01-15',
          pageViews: 100, uniqueVisitors: 50, sessions: 60, bounces: 15, bounceRate: 0.25,
          avgSessionDuration: 120000, avgPagesPerSession: 1.67, totalTimeOnSite: 7200000,
          newVisitors: 40, returningVisitors: 10, createdAt: new Date(), updatedAt: new Date(),
        },
      ]

      const timeSeries = AnalyticsQueryAPI.processTimeSeries(stats)

      expect(timeSeries).toHaveLength(2)
      expect(timeSeries[0].timestamp).toBe('2024-01-15')
      expect(timeSeries[1].timestamp).toBe('2024-01-16')
    })
  })

  describe('processTopPages', () => {
    it('should process page stats into top items with percentages', () => {
      const pageStats: PageStats[] = [
        {
          siteId: 'site-123', period: 'day', periodStart: '2024-01-15',
          path: '/home', pageViews: 100, uniqueVisitors: 80, entries: 70,
          exits: 30, bounces: 10, avgTimeOnPage: 45000, exitRate: 0.3,
        },
        {
          siteId: 'site-123', period: 'day', periodStart: '2024-01-15',
          path: '/about', pageViews: 50, uniqueVisitors: 40, entries: 30,
          exits: 20, bounces: 5, avgTimeOnPage: 60000, exitRate: 0.4,
        },
      ]

      const topPages = AnalyticsQueryAPI.processTopPages(pageStats, 150)

      expect(topPages).toHaveLength(2)
      expect(topPages[0].name).toBe('/home')
      expect(topPages[0].percentage).toBeCloseTo(66.67, 1)
      expect(topPages[1].name).toBe('/about')
      expect(topPages[1].percentage).toBeCloseTo(33.33, 1)
    })
  })

  describe('processRealtimeData', () => {
    it('should aggregate realtime stats', () => {
      const realtimeStats: RealtimeStats[] = [
        {
          siteId: 'site-123', minute: '2024-01-15T14:30',
          currentVisitors: 25, pageViews: 50,
          activePages: { '/home': 10, '/blog': 8 },
          ttl: Math.floor(Date.now() / 1000) + 600,
        },
        {
          siteId: 'site-123', minute: '2024-01-15T14:29',
          currentVisitors: 22, pageViews: 45,
          activePages: { '/home': 8, '/pricing': 7 },
          ttl: Math.floor(Date.now() / 1000) + 540,
        },
      ]

      const realtimeData = AnalyticsQueryAPI.processRealtimeData(realtimeStats)

      expect(realtimeData.currentVisitors).toBe(25)
      expect(realtimeData.pageViewsLastHour).toBe(95)
      expect(realtimeData.topActivePages).toHaveLength(3)
    })
  })
})

// ============================================================================
// AggregationPipeline Tests
// ============================================================================

describe('AggregationPipeline', () => {
  let store: AnalyticsStore
  let pipeline: AggregationPipeline

  beforeEach(() => {
    store = new AnalyticsStore({ tableName: 'analytics-table' })
    pipeline = new AggregationPipeline(store)
  })

  describe('getScheduledJobTimes', () => {
    it('should calculate next hourly job time', () => {
      const now = new Date('2024-01-15T14:30:00Z')
      const times = AggregationPipeline.getScheduledJobTimes(now)

      expect(times.hourly.getHours()).toBe(15)
      expect(times.hourly.getMinutes()).toBe(0)
    })

    it('should calculate next daily job time', () => {
      const now = new Date('2024-01-15T14:30:00Z')
      const times = AggregationPipeline.getScheduledJobTimes(now)

      expect(times.daily.getUTCDate()).toBe(16)
      expect(times.daily.getUTCHours()).toBe(0)
    })

    it('should calculate next monthly job time', () => {
      const now = new Date('2024-01-15T14:30:00Z')
      const times = AggregationPipeline.getScheduledJobTimes(now)

      expect(times.monthly.getUTCMonth()).toBe(1) // February
      expect(times.monthly.getUTCDate()).toBe(1)
    })
  })

  describe('getCronExpression', () => {
    it('should return correct cron for hourly', () => {
      expect(AggregationPipeline.getCronExpression('hour')).toBe('0 * * * *')
    })

    it('should return correct cron for daily', () => {
      expect(AggregationPipeline.getCronExpression('day')).toBe('0 0 * * *')
    })

    it('should return correct cron for monthly', () => {
      expect(AggregationPipeline.getCronExpression('month')).toBe('0 0 1 * *')
    })
  })

  describe('getAggregationWindow', () => {
    it('should return previous hour window', () => {
      const now = new Date('2024-01-15T14:30:00Z')
      const window = AggregationPipeline.getAggregationWindow('hour', now)

      expect(window.start.getHours()).toBe(13)
      expect(window.end.getHours()).toBe(14)
    })

    it('should return previous day window', () => {
      const now = new Date('2024-01-15T14:30:00Z')
      const window = AggregationPipeline.getAggregationWindow('day', now)

      expect(window.start.getUTCDate()).toBe(14)
      expect(window.end.getUTCDate()).toBe(15)
    })

    it('should return previous month window', () => {
      const now = new Date('2024-02-15T14:30:00Z')
      const window = AggregationPipeline.getAggregationWindow('month', now)

      expect(window.start.getUTCMonth()).toBe(0) // January
      expect(window.end.getUTCMonth()).toBe(1) // February
    })
  })

  describe('createJobConfig', () => {
    it('should create job config with correct window', () => {
      const config = AggregationPipeline.createJobConfig(
        'site-123',
        'hour',
        new Date('2024-01-15T14:30:00Z'),
      )

      expect(config.siteId).toBe('site-123')
      expect(config.period).toBe('hour')
      expect(config.deleteRawEvents).toBe(true)
    })

    it('should not delete raw events for daily aggregation', () => {
      const config = AggregationPipeline.createJobConfig('site-123', 'day')
      expect(config.deleteRawEvents).toBe(false)
    })
  })

  describe('runAggregationJob', () => {
    it('should run aggregation job and generate commands', () => {
      const config = AggregationPipeline.createJobConfig(
        'site-123',
        'hour',
        new Date('2024-01-15T14:30:00Z'),
      )

      const pageViews: PageView[] = [
        createPageView('pv-1', 'visitor-1', 'session-1', '/home', true, false),
        createPageView('pv-2', 'visitor-2', 'session-2', '/about', true, true),
      ]

      const sessions: Session[] = [
        createSession('session-1', 'visitor-1', 2, false, 120000),
        createSession('session-2', 'visitor-2', 1, true, 5000),
      ]

      const result = pipeline.runAggregationJob(config, pageViews, sessions, [], [])

      expect(result.success).toBe(true)
      expect(result.pageViewsProcessed).toBe(2)
      expect(result.sessionsProcessed).toBe(2)
      expect(result.commands.length).toBeGreaterThan(0)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should track goal conversions', () => {
      const config = AggregationPipeline.createJobConfig(
        'site-123',
        'hour',
        new Date('2024-01-15T14:30:00Z'),
      )

      const pageViews: PageView[] = [
        createPageView('pv-1', 'visitor-1', 'session-1', '/checkout/success', true, false),
      ]

      const sessions: Session[] = [
        createSession('session-1', 'visitor-1', 1, false, 60000),
      ]

      const goals: Goal[] = [
        createGoal('goal-1', 'pageview', '/checkout/success', 'exact', 50),
      ]

      const result = pipeline.runAggregationJob(config, pageViews, sessions, [], goals)

      expect(result.success).toBe(true)
      expect(result.conversionsTracked).toBe(1)
    })

    it('should process custom events and track event-based goals', () => {
      const config = AggregationPipeline.createJobConfig(
        'site-123',
        'hour',
        new Date('2024-01-15T14:30:00Z'),
      )

      const events: CustomEvent[] = [
        createCustomEvent('evt-1', 'visitor-1', 'session-1', 'purchase', 99.99),
        createCustomEvent('evt-2', 'visitor-2', 'session-2', 'add_to_cart'),
      ]

      const goals: Goal[] = [
        createGoal('goal-1', 'event', 'purchase', 'exact', 0),
      ]

      const result = pipeline.runAggregationJob(config, [], [], events, goals)

      expect(result.success).toBe(true)
      expect(result.eventsProcessed).toBe(2)
      expect(result.conversionsTracked).toBe(1)
    })
  })
})

// ============================================================================
// Additional AnalyticsStore Command Tests
// ============================================================================

describe('AnalyticsStore - Additional Commands', () => {
  let store: AnalyticsStore

  beforeEach(() => {
    store = new AnalyticsStore({ tableName: 'analytics-table', useTtl: true })
  })

  describe('geoStats commands', () => {
    it('should generate upsertGeoStatsCommand', () => {
      const stats: GeoStats = {
        siteId: 'site-123',
        period: 'day',
        periodStart: '2024-01-15',
        country: 'US',
        visitors: 100,
        pageViews: 250,
        bounceRate: 0.3,
      }

      const command = store.upsertGeoStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.ExpressionAttributeValues[':country']).toEqual({ S: 'US' })
      expect(command.input.ExpressionAttributeValues[':visitors']).toEqual({ N: '100' })
    })

    it('should generate getGeoStatsCommand', () => {
      const command = store.getGeoStatsCommand('site-123', 'day', '2024-01-15')

      expect(command.command).toBe('Query')
      expect(command.input.KeyConditionExpression).toContain('begins_with')
    })
  })

  describe('deviceStats commands', () => {
    it('should generate upsertDeviceStatsCommand', () => {
      const stats: DeviceStats = {
        siteId: 'site-123',
        period: 'day',
        periodStart: '2024-01-15',
        dimension: 'device',
        value: 'mobile',
        visitors: 50,
        pageViews: 100,
        bounceRate: 0.4,
      }

      const command = store.upsertDeviceStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.ExpressionAttributeValues[':dimension']).toEqual({ S: 'device' })
      expect(command.input.ExpressionAttributeValues[':value']).toEqual({ S: 'mobile' })
    })

    it('should generate getDeviceStatsCommand with dimension filter', () => {
      const command = store.getDeviceStatsCommand('site-123', 'day', '2024-01-15', 'browser')

      expect(command.command).toBe('Query')
      expect(command.input.FilterExpression).toBe('#dim = :dim')
      expect(command.input.ExpressionAttributeValues![':dim']).toEqual({ S: 'browser' })
    })
  })

  describe('eventStats commands', () => {
    it('should generate upsertEventStatsCommand', () => {
      const stats: EventStats = {
        siteId: 'site-123',
        period: 'day',
        periodStart: '2024-01-15',
        eventName: 'button_click',
        count: 50,
        uniqueVisitors: 30,
        totalValue: 500,
        avgValue: 10,
      }

      const command = store.upsertEventStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.ExpressionAttributeValues[':eventName']).toEqual({ S: 'button_click' })
      expect(command.input.ExpressionAttributeValues[':count']).toEqual({ N: '50' })
    })
  })

  describe('goalStats commands', () => {
    it('should generate upsertGoalStatsCommand', () => {
      const stats: GoalStats = {
        siteId: 'site-123',
        goalId: 'goal-456',
        period: 'day',
        periodStart: '2024-01-15',
        conversions: 25,
        uniqueConversions: 20,
        conversionRate: 0.1,
        revenue: 500,
      }

      const command = store.upsertGoalStatsCommand(stats)

      expect(command.command).toBe('UpdateItem')
      expect(command.input.ExpressionAttributeValues[':goalId']).toEqual({ S: 'goal-456' })
      expect(command.input.ExpressionAttributeValues[':conversions']).toEqual({ N: '25' })
      expect(command.input.ExpressionAttributeValues[':revenue']).toEqual({ N: '500' })
    })

    it('should generate getGoalStatsCommand', () => {
      const command = store.getGoalStatsCommand(
        'site-123',
        'goal-456',
        'day',
        '2024-01-01',
        '2024-01-31',
      )

      expect(command.command).toBe('Query')
      expect(command.input.KeyConditionExpression).toContain('BETWEEN')
    })
  })
})
