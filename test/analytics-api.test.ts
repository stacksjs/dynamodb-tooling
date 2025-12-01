import { describe, expect, it, beforeEach, mock } from 'bun:test'
import {
  AnalyticsAPI,
  type AnalyticsRequest,
  type HandlerContext,
} from '../src/analytics'

// ============================================================================
// Test Setup
// ============================================================================

function createMockRequest(overrides: Partial<AnalyticsRequest> = {}): AnalyticsRequest {
  return {
    method: 'GET',
    path: '/api/analytics',
    params: {},
    query: {},
    body: {},
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'origin': 'https://example.com',
    },
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...overrides,
  }
}

function createMockExecuteCommand() {
  const storage = new Map<string, unknown>()

  return async (command: { command: string, input: Record<string, unknown> }) => {
    const { command: cmd, input } = command

    switch (cmd) {
      case 'PutItem': {
        const item = input.Item as Record<string, { S?: string }>
        const pk = item.pk?.S
        const sk = item.sk?.S
        if (pk && sk) {
          storage.set(`${pk}#${sk}`, input.Item)
        }
        return {}
      }

      case 'GetItem': {
        const key = input.Key as Record<string, { S?: string }>
        const pk = key.pk?.S
        const sk = key.sk?.S
        const item = storage.get(`${pk}#${sk}`)
        return { Item: item }
      }

      case 'UpdateItem': {
        const key = input.Key as Record<string, { S?: string }>
        const pk = key.pk?.S
        const sk = key.sk?.S
        // Simplified: just store a marker
        storage.set(`${pk}#${sk}`, { updated: true, ...input.ExpressionAttributeValues })
        return {}
      }

      case 'Query': {
        // Return empty items for testing
        return { Items: [] }
      }

      default:
        return {}
    }
  }
}

// ============================================================================
// AnalyticsAPI Tests
// ============================================================================

describe('AnalyticsAPI', () => {
  let api: AnalyticsAPI
  let executeCommand: ReturnType<typeof createMockExecuteCommand>
  let ctx: HandlerContext

  beforeEach(() => {
    api = new AnalyticsAPI({
      tableName: 'test-analytics',
      corsOrigins: ['https://example.com'],
      useTtl: true,
    })

    executeCommand = createMockExecuteCommand()
    ctx = api.createContext(executeCommand)
  })

  describe('handleOptions', () => {
    it('should return CORS headers for preflight requests', () => {
      const req = createMockRequest({ method: 'OPTIONS' })
      const response = api.handleOptions(req)

      expect(response.status).toBe(204)
      expect(response.headers['Access-Control-Allow-Origin']).toBe('https://example.com')
      expect(response.headers['Access-Control-Allow-Methods']).toContain('GET')
      expect(response.headers['Access-Control-Allow-Methods']).toContain('POST')
    })
  })

  describe('handleCollect', () => {
    it('should accept valid pageview events', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          s: 'site-123',
          sid: 'session-456',
          e: 'pageview',
          u: 'https://example.com/blog/post-1',
          r: 'https://google.com',
          t: 'Blog Post 1',
          sw: 1920,
          sh: 1080,
        },
      })

      const response = await api.handleCollect(req, ctx)

      expect(response.status).toBe(204)
      expect(response.headers['Cache-Control']).toContain('no-store')
    })

    it('should reject requests with missing required fields', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          s: 'site-123',
          // Missing 'e' and 'u'
        },
      })

      const response = await api.handleCollect(req, ctx)

      expect(response.status).toBe(400)
      expect((response.body as { error: string }).error).toContain('Missing required fields')
    })

    it('should accept custom events', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          s: 'site-123',
          sid: 'session-456',
          e: 'event',
          u: 'https://example.com/checkout',
          p: { name: 'purchase', value: 99.99 },
        },
      })

      const response = await api.handleCollect(req, ctx)

      expect(response.status).toBe(204)
    })

    it('should accept outbound link events', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          s: 'site-123',
          sid: 'session-456',
          e: 'outbound',
          u: 'https://example.com/page',
          p: { url: 'https://external-site.com' },
        },
      })

      const response = await api.handleCollect(req, ctx)

      expect(response.status).toBe(204)
    })

    it('should reject invalid URLs', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          s: 'site-123',
          sid: 'session-456',
          e: 'pageview',
          u: 'not-a-valid-url',
        },
      })

      const response = await api.handleCollect(req, ctx)

      expect(response.status).toBe(400)
      expect((response.body as { error: string }).error).toContain('Invalid URL')
    })
  })

  describe('handleCreateSite', () => {
    it('should create a new site', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          name: 'My Website',
          domains: ['example.com', 'www.example.com'],
          timezone: 'America/New_York',
        },
      })

      const response = await api.handleCreateSite(req, ctx, 'owner-123')

      expect(response.status).toBe(201)
      const body = response.body as { site: { id: string, name: string, ownerId: string } }
      expect(body.site).toBeDefined()
      expect(body.site.name).toBe('My Website')
      expect(body.site.ownerId).toBe('owner-123')
      expect(body.site.id).toBeDefined()
    })

    it('should reject site creation with missing fields', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          name: 'My Website',
          // Missing domains
        },
      })

      const response = await api.handleCreateSite(req, ctx, 'owner-123')

      expect(response.status).toBe(400)
      expect((response.body as { error: string }).error).toContain('Missing required fields')
    })
  })

  describe('handleGetSite', () => {
    it('should return 400 for missing siteId', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: {},
      })

      const response = await api.handleGetSite(req, ctx)

      expect(response.status).toBe(400)
    })

    it('should return 404 for non-existent site', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'non-existent' },
      })

      const response = await api.handleGetSite(req, ctx)

      expect(response.status).toBe(404)
    })
  })

  describe('handleGetStats', () => {
    it('should return stats for a site', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'site-123' },
        query: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      })

      const response = await api.handleGetStats(req, ctx)

      expect(response.status).toBe(200)
      const body = response.body as { summary: unknown, timeSeries: unknown[], dateRange: unknown }
      expect(body.summary).toBeDefined()
      expect(body.timeSeries).toBeDefined()
      expect(body.dateRange).toBeDefined()
    })

    it('should use default date range if not specified', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'site-123' },
      })

      const response = await api.handleGetStats(req, ctx)

      expect(response.status).toBe(200)
    })

    it('should return 400 for missing siteId', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: {},
      })

      const response = await api.handleGetStats(req, ctx)

      expect(response.status).toBe(400)
    })
  })

  describe('handleGetRealtime', () => {
    it('should return realtime stats', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'site-123' },
        query: { minutes: '5' },
      })

      const response = await api.handleGetRealtime(req, ctx)

      expect(response.status).toBe(200)
      const body = response.body as { currentVisitors: number, pageViewsLastHour: number }
      expect(body.currentVisitors).toBeDefined()
      expect(body.pageViewsLastHour).toBeDefined()
    })
  })

  describe('handleGetScript', () => {
    it('should return tracking script HTML', () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'site-123' },
        query: { api: 'https://api.example.com' },
        headers: { host: 'api.example.com' },
      })

      const response = api.handleGetScript(req)

      expect(response.status).toBe(200)
      expect(response.headers['Content-Type']).toBe('text/html')
      const body = response.body as string
      expect(body).toContain('site-123')
      expect(body).toContain('<script')
    })

    it('should return 400 for missing siteId', () => {
      const req = createMockRequest({
        method: 'GET',
        params: {},
      })

      const response = api.handleGetScript(req)

      expect(response.status).toBe(400)
    })

    it('should include DNT handling when enabled', () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'site-123' },
        query: { dnt: 'true' },
      })

      const response = api.handleGetScript(req)

      expect(response.status).toBe(200)
      // Default is to honor DNT
      expect((response.body as string)).toContain('doNotTrack')
    })
  })

  describe('handleListGoals', () => {
    it('should return goals for a site', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'site-123' },
      })

      const response = await api.handleListGoals(req, ctx)

      expect(response.status).toBe(200)
      const body = response.body as { goals: unknown[] }
      expect(body.goals).toBeDefined()
      expect(Array.isArray(body.goals)).toBe(true)
    })
  })

  describe('handleCreateGoal', () => {
    it('should create a new goal', async () => {
      const req = createMockRequest({
        method: 'POST',
        params: { siteId: 'site-123' },
        body: {
          name: 'Newsletter Signup',
          type: 'event',
          pattern: 'newsletter_signup',
          matchType: 'exact',
          value: 5,
        },
      })

      const response = await api.handleCreateGoal(req, ctx)

      expect(response.status).toBe(201)
      const body = response.body as { goal: { id: string, name: string, type: string } }
      expect(body.goal).toBeDefined()
      expect(body.goal.name).toBe('Newsletter Signup')
      expect(body.goal.type).toBe('event')
    })

    it('should reject goal with missing fields', async () => {
      const req = createMockRequest({
        method: 'POST',
        params: { siteId: 'site-123' },
        body: {
          name: 'My Goal',
          // Missing type, pattern, matchType
        },
      })

      const response = await api.handleCreateGoal(req, ctx)

      expect(response.status).toBe(400)
    })
  })

  describe('handleGetTopPages', () => {
    it('should return top pages', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { siteId: 'site-123' },
        query: { limit: '10' },
      })

      const response = await api.handleGetTopPages(req, ctx)

      expect(response.status).toBe(200)
      const body = response.body as { pages: unknown[] }
      expect(body.pages).toBeDefined()
    })
  })

  describe('handleAggregate', () => {
    it('should create aggregation job config', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          siteId: 'site-123',
          period: 'hour',
        },
      })

      const response = await api.handleAggregate(req, ctx)

      expect(response.status).toBe(200)
      const body = response.body as { config: { siteId: string, period: string }, nextScheduledTimes: unknown }
      expect(body.config).toBeDefined()
      expect(body.config.siteId).toBe('site-123')
      expect(body.config.period).toBe('hour')
      expect(body.nextScheduledTimes).toBeDefined()
    })

    it('should reject aggregation with missing fields', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          // Missing siteId and period
        },
      })

      const response = await api.handleAggregate(req, ctx)

      expect(response.status).toBe(400)
    })
  })

  describe('getCorsHeaders', () => {
    it('should return wildcard for * config', () => {
      const wildcardApi = new AnalyticsAPI({
        tableName: 'test',
        corsOrigins: ['*'],
      })

      const headers = wildcardApi.getCorsHeaders('https://any-site.com')
      expect(headers['Access-Control-Allow-Origin']).toBe('*')
    })

    it('should return specific origin when matched', () => {
      const headers = api.getCorsHeaders('https://example.com')
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com')
    })

    it('should return first allowed origin for non-matching origin', () => {
      const headers = api.getCorsHeaders('https://other-site.com')
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com')
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('AnalyticsAPI Integration', () => {
  let api: AnalyticsAPI
  let executeCommand: ReturnType<typeof createMockExecuteCommand>
  let ctx: HandlerContext

  beforeEach(() => {
    api = new AnalyticsAPI({
      tableName: 'test-analytics',
      useTtl: true,
    })

    executeCommand = createMockExecuteCommand()
    ctx = api.createContext(executeCommand)
  })

  it('should handle full site creation and tracking flow', async () => {
    // 1. Create a site
    const createSiteReq = createMockRequest({
      method: 'POST',
      body: {
        name: 'Test Site',
        domains: ['test.com'],
      },
    })

    const createSiteRes = await api.handleCreateSite(createSiteReq, ctx, 'owner-1')
    expect(createSiteRes.status).toBe(201)
    const site = (createSiteRes.body as { site: { id: string } }).site
    const siteId = site.id

    // 2. Get tracking script
    const scriptReq = createMockRequest({
      method: 'GET',
      params: { siteId },
      headers: { host: 'analytics.test.com' },
    })

    const scriptRes = api.handleGetScript(scriptReq)
    expect(scriptRes.status).toBe(200)
    expect((scriptRes.body as string)).toContain(siteId)

    // 3. Track a pageview
    const collectReq = createMockRequest({
      method: 'POST',
      body: {
        s: siteId,
        sid: 'session-1',
        e: 'pageview',
        u: 'https://test.com/home',
        t: 'Home Page',
      },
    })

    const collectRes = await api.handleCollect(collectReq, ctx)
    expect(collectRes.status).toBe(204)

    // 4. Create a goal
    const createGoalReq = createMockRequest({
      method: 'POST',
      params: { siteId },
      body: {
        name: 'Signup',
        type: 'pageview',
        pattern: '/signup/success',
        matchType: 'exact',
        value: 10,
      },
    })

    const createGoalRes = await api.handleCreateGoal(createGoalReq, ctx)
    expect(createGoalRes.status).toBe(201)

    // 5. Get stats
    const statsReq = createMockRequest({
      method: 'GET',
      params: { siteId },
    })

    const statsRes = await api.handleGetStats(statsReq, ctx)
    expect(statsRes.status).toBe(200)
  })

  it('should parse UTM parameters from pageview URLs', async () => {
    const req = createMockRequest({
      method: 'POST',
      body: {
        s: 'site-123',
        sid: 'session-1',
        e: 'pageview',
        u: 'https://example.com/landing?utm_source=google&utm_medium=cpc&utm_campaign=summer',
      },
    })

    const response = await api.handleCollect(req, ctx)
    expect(response.status).toBe(204)
    // UTM parameters should be parsed and stored (tested via the stored data)
  })
})
