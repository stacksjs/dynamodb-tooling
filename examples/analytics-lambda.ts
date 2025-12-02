/**
 * AWS Lambda Handler Example for Analytics API
 *
 * This example shows how to deploy the analytics API as AWS Lambda functions.
 * Deploy using AWS SAM, Serverless Framework, or CDK.
 *
 * @example SAM template.yaml:
 * ```yaml
 * AWSTemplateFormatVersion: '2010-09-09'
 * Transform: AWS::Serverless-2016-10-31
 *
 * Globals:
 *   Function:
 *     Runtime: nodejs20.x
 *     Timeout: 30
 *     Environment:
 *       Variables:
 *         ANALYTICS_TABLE: !Ref AnalyticsTable
 *
 * Resources:
 *   AnalyticsTable:
 *     Type: AWS::DynamoDB::Table
 *     Properties:
 *       TableName: analytics
 *       BillingMode: PAY_PER_REQUEST
 *       AttributeDefinitions:
 *         - AttributeName: pk
 *           AttributeType: S
 *         - AttributeName: sk
 *           AttributeType: S
 *         - AttributeName: gsi1pk
 *           AttributeType: S
 *         - AttributeName: gsi1sk
 *           AttributeType: S
 *       KeySchema:
 *         - AttributeName: pk
 *           KeyType: HASH
 *         - AttributeName: sk
 *           KeyType: RANGE
 *       GlobalSecondaryIndexes:
 *         - IndexName: GSI1
 *           KeySchema:
 *             - AttributeName: gsi1pk
 *               KeyType: HASH
 *             - AttributeName: gsi1sk
 *               KeyType: RANGE
 *           Projection:
 *             ProjectionType: ALL
 *       TimeToLiveSpecification:
 *         AttributeName: ttl
 *         Enabled: true
 *
 *   CollectFunction:
 *     Type: AWS::Serverless::Function
 *     Properties:
 *       Handler: analytics-lambda.collectHandler
 *       Events:
 *         Api:
 *           Type: Api
 *           Properties:
 *             Path: /collect
 *             Method: POST
 *
 *   StatsFunction:
 *     Type: AWS::Serverless::Function
 *     Properties:
 *       Handler: analytics-lambda.statsHandler
 *       Events:
 *         Api:
 *           Type: Api
 *           Properties:
 *             Path: /sites/{siteId}/stats
 *             Method: GET
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
  createLambdaHandler,
  type HandlerContext,
} from '../src/analytics'

// ============================================================================
// DynamoDB Client Setup
// ============================================================================

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

// ============================================================================
// Command Executor
// ============================================================================

/**
 * Execute a DynamoDB command
 */
async function executeCommand(
  command: { command: string, input: Record<string, unknown> },
): Promise<unknown> {
  const { command: cmd, input } = command

  switch (cmd) {
    case 'GetItem':
      return docClient.send(new GetCommand(input as ConstructorParameters<typeof GetCommand>[0]))

    case 'PutItem':
      return docClient.send(new PutCommand(input as ConstructorParameters<typeof PutCommand>[0]))

    case 'UpdateItem':
      return docClient.send(new UpdateCommand(input as ConstructorParameters<typeof UpdateCommand>[0]))

    case 'DeleteItem':
      return docClient.send(new DeleteCommand(input as ConstructorParameters<typeof DeleteCommand>[0]))

    case 'Query':
      return docClient.send(new QueryCommand(input as ConstructorParameters<typeof QueryCommand>[0]))

    default:
      throw new Error(`Unknown command: ${cmd}`)
  }
}

// ============================================================================
// Analytics API Instance
// ============================================================================

const api = new AnalyticsAPI({
  tableName: process.env.ANALYTICS_TABLE || 'analytics',
  useTtl: true,
  rawEventTtl: 30 * 24 * 60 * 60, // 30 days
  basePath: '/api/analytics',
})

// ============================================================================
// Lambda Handlers
// ============================================================================

/**
 * Generic Lambda handler using the createLambdaHandler helper
 */
export const handler = createLambdaHandler(api, executeCommand)

/**
 * Collect endpoint handler (POST /collect)
 * Receives tracking events from the JavaScript snippet
 */
export async function collectHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)

  const req = parseRequest(event)
  const response = await api.handleCollect(req, ctx)

  return formatResponse(response)
}

/**
 * Get stats handler (GET /sites/{siteId}/stats)
 */
export async function statsHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)

  const req = parseRequest(event)
  const response = await api.handleGetStats(req, ctx)

  return formatResponse(response)
}

/**
 * Get realtime handler (GET /sites/{siteId}/realtime)
 */
export async function realtimeHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)

  const req = parseRequest(event)
  const response = await api.handleGetRealtime(req, ctx)

  return formatResponse(response)
}

/**
 * Get script handler (GET /sites/{siteId}/script)
 */
export function scriptHandler(event: AWSLambdaEvent) {
  const req = parseRequest(event)
  const response = api.handleGetScript(req)

  return formatResponse(response)
}

/**
 * List sites handler (GET /sites)
 */
export async function listSitesHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)
  const req = parseRequest(event)

  // Get owner ID from authorizer (e.g., Cognito)
  const ownerId = event.requestContext?.authorizer?.claims?.sub
    || event.requestContext?.authorizer?.principalId
    || 'anonymous'

  const response = await api.handleListSites(req, ctx, ownerId)

  return formatResponse(response)
}

/**
 * Create site handler (POST /sites)
 */
export async function createSiteHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)
  const req = parseRequest(event)

  const ownerId = event.requestContext?.authorizer?.claims?.sub
    || event.requestContext?.authorizer?.principalId
    || 'anonymous'

  const response = await api.handleCreateSite(req, ctx, ownerId)

  return formatResponse(response)
}

/**
 * Get site handler (GET /sites/{siteId})
 */
export async function getSiteHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)
  const req = parseRequest(event)
  const response = await api.handleGetSite(req, ctx)

  return formatResponse(response)
}

/**
 * List goals handler (GET /sites/{siteId}/goals)
 */
export async function listGoalsHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)
  const req = parseRequest(event)
  const response = await api.handleListGoals(req, ctx)

  return formatResponse(response)
}

/**
 * Create goal handler (POST /sites/{siteId}/goals)
 */
export async function createGoalHandler(event: AWSLambdaEvent) {
  const ctx = api.createContext(executeCommand)
  const req = parseRequest(event)
  const response = await api.handleCreateGoal(req, ctx)

  return formatResponse(response)
}

/**
 * Aggregation handler (for scheduled CloudWatch Events)
 */
export async function aggregationHandler(event: {
  period: 'hour' | 'day' | 'month'
  siteIds?: string[]
}) {
  const ctx = api.createContext(executeCommand)

  // If no specific sites, this would typically fetch all active sites
  const siteIds = event.siteIds || []

  const results = await Promise.all(
    siteIds.map(async (siteId) => {
      const req = {
        method: 'POST',
        path: '/aggregate',
        params: {},
        query: {},
        body: { siteId, period: event.period },
        headers: {},
      }

      return api.handleAggregate(req, ctx)
    }),
  )

  return {
    statusCode: 200,
    body: JSON.stringify({ results }),
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

interface AWSLambdaEvent {
  httpMethod: string
  path: string
  pathParameters?: Record<string, string>
  queryStringParameters?: Record<string, string>
  body?: string
  headers: Record<string, string>
  requestContext?: {
    identity?: { sourceIp?: string }
    authorizer?: {
      claims?: { sub?: string }
      principalId?: string
    }
  }
}

function parseRequest(event: AWSLambdaEvent) {
  return {
    method: event.httpMethod,
    path: event.path,
    params: event.pathParameters || {},
    query: event.queryStringParameters || {},
    body: event.body ? JSON.parse(event.body) : {},
    headers: Object.fromEntries(
      Object.entries(event.headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    ip: event.requestContext?.identity?.sourceIp,
    userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
  }
}

function formatResponse(response: { status: number, headers: Record<string, string>, body: unknown }) {
  return {
    statusCode: response.status,
    headers: {
      ...response.headers,
      'Content-Type': response.headers['Content-Type'] || 'application/json',
    },
    body: response.body ? JSON.stringify(response.body) : '',
  }
}
