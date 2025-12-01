/**
 * Bun Server Example for Analytics API
 *
 * This example shows how to run the analytics API as a standalone Bun server.
 *
 * @example
 * ```bash
 * # Start the server
 * bun run examples/analytics-bun-server.ts
 *
 * # Or with environment variables
 * ANALYTICS_TABLE=my-analytics-table PORT=3000 bun run examples/analytics-bun-server.ts
 * ```
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  AnalyticsAPI,
  type AnalyticsRequest,
  type AnalyticsResponse,
  type HandlerContext,
} from '../src/analytics'

// ============================================================================
// Configuration
// ============================================================================

const config = {
  port: Number.parseInt(process.env.PORT || '3000', 10),
  tableName: process.env.ANALYTICS_TABLE || 'analytics',
  region: process.env.AWS_REGION || 'us-east-1',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
}

// ============================================================================
// DynamoDB Client Setup
// ============================================================================

const client = new DynamoDBClient({ region: config.region })
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

/**
 * Execute a DynamoDB command
 */
async function executeCommand(
  command: { command: string, input: Record<string, unknown> },
): Promise<unknown> {
  const { command: cmd, input } = command

  switch (cmd) {
    case 'GetItem':
      return docClient.send(new GetCommand(input as Parameters<typeof GetCommand>[0]))
    case 'PutItem':
      return docClient.send(new PutCommand(input as Parameters<typeof PutCommand>[0]))
    case 'UpdateItem':
      return docClient.send(new UpdateCommand(input as Parameters<typeof UpdateCommand>[0]))
    case 'DeleteItem':
      return docClient.send(new DeleteCommand(input as Parameters<typeof DeleteCommand>[0]))
    case 'Query':
      return docClient.send(new QueryCommand(input as Parameters<typeof QueryCommand>[0]))
    default:
      throw new Error(`Unknown command: ${cmd}`)
  }
}

// ============================================================================
// Analytics API
// ============================================================================

const api = new AnalyticsAPI({
  tableName: config.tableName,
  corsOrigins: config.corsOrigins,
  useTtl: true,
  basePath: '/api/analytics',
})

const ctx = api.createContext(executeCommand)

// ============================================================================
// Request Parser
// ============================================================================

async function parseRequest(request: Request, url: URL): Promise<AnalyticsRequest> {
  let body = {}
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.json()
    }
    catch {
      body = {}
    }
  }

  return {
    method: request.method,
    path: url.pathname,
    params: {}, // Will be populated by router
    query: Object.fromEntries(url.searchParams),
    body,
    headers: Object.fromEntries(request.headers),
    ip: request.headers.get('x-forwarded-for')
      || request.headers.get('cf-connecting-ip')
      || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  }
}

function formatResponse(response: AnalyticsResponse): Response {
  return new Response(
    response.body ? JSON.stringify(response.body) : null,
    {
      status: response.status,
      headers: response.headers,
    },
  )
}

// ============================================================================
// Route Matching
// ============================================================================

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: (req: AnalyticsRequest, ctx: HandlerContext, params: Record<string, string>) => Promise<AnalyticsResponse> | AnalyticsResponse
}

const routes: Route[] = [
  // Collect endpoint (tracking script posts here)
  {
    method: 'POST',
    pattern: /^\/api\/analytics\/collect$/,
    paramNames: [],
    handler: (req, ctx) => api.handleCollect(req, ctx),
  },

  // Sites
  {
    method: 'GET',
    pattern: /^\/api\/analytics\/sites$/,
    paramNames: [],
    handler: (req, ctx) => api.handleListSites(req, ctx, 'demo-user'), // Replace with auth
  },
  {
    method: 'POST',
    pattern: /^\/api\/analytics\/sites$/,
    paramNames: [],
    handler: (req, ctx) => api.handleCreateSite(req, ctx, 'demo-user'),
  },
  {
    method: 'GET',
    pattern: /^\/api\/analytics\/sites\/([^/]+)$/,
    paramNames: ['siteId'],
    handler: (req, ctx) => api.handleGetSite(req, ctx),
  },

  // Stats
  {
    method: 'GET',
    pattern: /^\/api\/analytics\/sites\/([^/]+)\/stats$/,
    paramNames: ['siteId'],
    handler: (req, ctx) => api.handleGetStats(req, ctx),
  },
  {
    method: 'GET',
    pattern: /^\/api\/analytics\/sites\/([^/]+)\/realtime$/,
    paramNames: ['siteId'],
    handler: (req, ctx) => api.handleGetRealtime(req, ctx),
  },
  {
    method: 'GET',
    pattern: /^\/api\/analytics\/sites\/([^/]+)\/pages$/,
    paramNames: ['siteId'],
    handler: (req, ctx) => api.handleGetTopPages(req, ctx),
  },

  // Script
  {
    method: 'GET',
    pattern: /^\/api\/analytics\/sites\/([^/]+)\/script$/,
    paramNames: ['siteId'],
    handler: req => api.handleGetScript(req),
  },

  // Goals
  {
    method: 'GET',
    pattern: /^\/api\/analytics\/sites\/([^/]+)\/goals$/,
    paramNames: ['siteId'],
    handler: (req, ctx) => api.handleListGoals(req, ctx),
  },
  {
    method: 'POST',
    pattern: /^\/api\/analytics\/sites\/([^/]+)\/goals$/,
    paramNames: ['siteId'],
    handler: (req, ctx) => api.handleCreateGoal(req, ctx),
  },

  // Aggregation (admin/cron endpoint)
  {
    method: 'POST',
    pattern: /^\/api\/analytics\/aggregate$/,
    paramNames: [],
    handler: (req, ctx) => api.handleAggregate(req, ctx),
  },
]

function matchRoute(method: string, path: string): { route: Route, params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method)
      continue

    const match = path.match(route.pattern)
    if (match) {
      const params: Record<string, string> = {}
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1]
      })
      return { route, params }
    }
  }
  return null
}

// ============================================================================
// Bun Server
// ============================================================================

console.log(`Starting Analytics API server...`)
console.log(`  Table: ${config.tableName}`)
console.log(`  Region: ${config.region}`)
console.log(`  Port: ${config.port}`)

Bun.serve({
  port: config.port,

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return formatResponse(api.handleOptions({
        method: 'OPTIONS',
        path: url.pathname,
        params: {},
        query: {},
        body: {},
        headers: Object.fromEntries(request.headers),
      }))
    }

    // Health check
    if (url.pathname === '/health' || url.pathname === '/api/analytics/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Match route
    const matched = matchRoute(request.method, url.pathname)

    if (!matched) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const req = await parseRequest(request, url)
      req.params = matched.params

      const response = await matched.route.handler(req, ctx, matched.params)
      return formatResponse(response)
    }
    catch (error) {
      console.error('Request error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
})

console.log(`\nServer running at http://localhost:${config.port}`)
console.log(`\nAvailable endpoints:`)
console.log(`  POST /api/analytics/collect          - Receive tracking events`)
console.log(`  GET  /api/analytics/sites            - List sites`)
console.log(`  POST /api/analytics/sites            - Create site`)
console.log(`  GET  /api/analytics/sites/:id        - Get site`)
console.log(`  GET  /api/analytics/sites/:id/stats  - Get dashboard stats`)
console.log(`  GET  /api/analytics/sites/:id/realtime - Get realtime stats`)
console.log(`  GET  /api/analytics/sites/:id/pages  - Get top pages`)
console.log(`  GET  /api/analytics/sites/:id/script - Get tracking script`)
console.log(`  GET  /api/analytics/sites/:id/goals  - List goals`)
console.log(`  POST /api/analytics/sites/:id/goals  - Create goal`)
console.log(`  POST /api/analytics/aggregate        - Trigger aggregation`)
console.log(`  GET  /health                         - Health check`)
