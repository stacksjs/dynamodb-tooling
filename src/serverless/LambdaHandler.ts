// ============================================================================
// Lambda Handler - Serverless Integration for DynamoDB
// ============================================================================

/**
 * Lambda context type
 */
export interface LambdaContext {
  functionName: string
  functionVersion: string
  invokedFunctionArn: string
  memoryLimitInMB: string
  awsRequestId: string
  logGroupName: string
  logStreamName: string
  getRemainingTimeInMillis: () => number
  callbackWaitsForEmptyEventLoop: boolean
}

/**
 * API Gateway proxy event
 */
export interface APIGatewayEvent {
  httpMethod: string
  path: string
  pathParameters?: Record<string, string> | null
  queryStringParameters?: Record<string, string> | null
  headers?: Record<string, string>
  body?: string | null
  isBase64Encoded?: boolean
  requestContext?: {
    requestId?: string
    stage?: string
    identity?: {
      sourceIp?: string
      userAgent?: string
    }
  }
}

/**
 * API Gateway proxy response
 */
export interface APIGatewayResponse {
  statusCode: number
  headers?: Record<string, string>
  body: string
  isBase64Encoded?: boolean
}

/**
 * DynamoDB stream event
 */
export interface DynamoDBStreamEvent {
  Records: Array<{
    eventID: string
    eventName: 'INSERT' | 'MODIFY' | 'REMOVE'
    eventVersion: string
    eventSource: string
    awsRegion: string
    eventSourceARN: string
    dynamodb: {
      ApproximateCreationDateTime?: number
      Keys: Record<string, { S?: string, N?: string, B?: string }>
      NewImage?: Record<string, unknown>
      OldImage?: Record<string, unknown>
      SequenceNumber: string
      SizeBytes: number
      StreamViewType: string
    }
  }>
}

/**
 * SQS event
 */
export interface SQSEvent {
  Records: Array<{
    messageId: string
    receiptHandle: string
    body: string
    attributes: Record<string, string>
    messageAttributes: Record<string, { stringValue?: string, binaryValue?: string, dataType: string }>
    md5OfBody: string
    eventSource: string
    eventSourceARN: string
    awsRegion: string
  }>
}

/**
 * Handler result
 */
export interface HandlerResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

/**
 * Route handler function type - can return HandlerResult or APIGatewayResponse directly
 */
export type RouteHandler = (
  event: APIGatewayEvent,
  context: LambdaContext,
) => Promise<HandlerResult | APIGatewayResponse | { statusCode: number, body: string }>

/**
 * Route definition for API handler
 */
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'
  path: string
  handler: RouteHandler
  middleware?: Array<(event: APIGatewayEvent, context: LambdaContext) => Promise<void>>
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  origins: string[] | '*'
  methods?: string[]
  headers?: string[]
  credentials?: boolean
  maxAge?: number
}

/**
 * Lambda handler builder for API Gateway
 */
export class APIHandler {
  private routes: RouteDefinition[] = []
  private globalMiddleware: Array<(event: APIGatewayEvent, context: LambdaContext) => Promise<void>> = []
  private corsConfig?: CORSConfig
  private errorHandler?: (error: Error, event: APIGatewayEvent) => APIGatewayResponse

  /**
   * Add CORS support
   */
  cors(config: CORSConfig): this {
    this.corsConfig = config
    return this
  }

  /**
   * Add global middleware
   */
  use(middleware: (event: APIGatewayEvent, context: LambdaContext) => Promise<void>): this {
    this.globalMiddleware.push(middleware)
    return this
  }

  /**
   * Add GET route
   */
  get(path: string, handler: RouteDefinition['handler']): this {
    return this.addRoute('GET', path, handler)
  }

  /**
   * Add POST route
   */
  post(path: string, handler: RouteDefinition['handler']): this {
    return this.addRoute('POST', path, handler)
  }

  /**
   * Add PUT route
   */
  put(path: string, handler: RouteDefinition['handler']): this {
    return this.addRoute('PUT', path, handler)
  }

  /**
   * Add PATCH route
   */
  patch(path: string, handler: RouteDefinition['handler']): this {
    return this.addRoute('PATCH', path, handler)
  }

  /**
   * Add DELETE route
   */
  delete(path: string, handler: RouteDefinition['handler']): this {
    return this.addRoute('DELETE', path, handler)
  }

  /**
   * Set custom error handler
   */
  onError(handler: (error: Error, event: APIGatewayEvent) => APIGatewayResponse): this {
    this.errorHandler = handler
    return this
  }

  /**
   * Handle a request directly (convenience method)
   */
  async handle(event: APIGatewayEvent, context?: LambdaContext): Promise<APIGatewayResponse> {
    const handler = this.build()
    return handler(event, context ?? this.createDefaultContext())
  }

  private createDefaultContext(): LambdaContext {
    return {
      functionName: 'test',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test',
      logStreamName: '2024/01/01/[$LATEST]test',
      getRemainingTimeInMillis: () => 30000,
      callbackWaitsForEmptyEventLoop: true,
    }
  }

  /**
   * Build the Lambda handler
   */
  build(): (event: APIGatewayEvent, context: LambdaContext) => Promise<APIGatewayResponse> {
    return async (event: APIGatewayEvent, context: LambdaContext): Promise<APIGatewayResponse> => {
      // Handle CORS preflight
      if (event.httpMethod === 'OPTIONS' && this.corsConfig) {
        return this.buildCORSResponse()
      }

      try {
        // Run global middleware
        for (const middleware of this.globalMiddleware) {
          await middleware(event, context)
        }

        // Find matching route
        const route = this.findRoute(event.httpMethod, event.path)
        if (!route) {
          return this.buildResponse(404, { error: { code: 'NOT_FOUND', message: 'Route not found' } })
        }

        // Run route middleware
        if (route.middleware) {
          for (const middleware of route.middleware) {
            await middleware(event, context)
          }
        }

        // Execute handler
        const result = await route.handler(event, context)

        // Check if result is a direct response (has statusCode) or HandlerResult
        if ('statusCode' in result) {
          // Direct response format
          return result as APIGatewayResponse
        }
        else if ('success' in result) {
          // HandlerResult format
          if (result.success) {
            return this.buildResponse(200, result.data)
          }
          else {
            return this.buildResponse(400, { error: result.error })
          }
        }
        else {
          // Assume it's data to return
          return this.buildResponse(200, result)
        }
      }
      catch (error) {
        if (this.errorHandler) {
          return this.errorHandler(error instanceof Error ? error : new Error(String(error)), event)
        }

        const err = error instanceof Error ? error : new Error(String(error))
        return this.buildResponse(500, {
          error: {
            code: 'INTERNAL_ERROR',
            message: err.message,
          },
        })
      }
    }
  }

  private addRoute(method: RouteDefinition['method'], path: string, handler: RouteDefinition['handler']): this {
    this.routes.push({ method, path, handler })
    return this
  }

  private findRoute(method: string, path: string): RouteDefinition | undefined {
    return this.routes.find((route) => {
      if (route.method !== method)
        return false

      // Simple path matching (supports :param style)
      const routeParts = route.path.split('/')
      const pathParts = path.split('/')

      if (routeParts.length !== pathParts.length)
        return false

      return routeParts.every((part, i) => {
        if (part.startsWith(':'))
          return true
        return part === pathParts[i]
      })
    })
  }

  private buildResponse(statusCode: number, body: unknown): APIGatewayResponse {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.corsConfig) {
      const origins = this.corsConfig.origins
      headers['Access-Control-Allow-Origin'] = origins === '*' ? '*' : origins.join(', ')

      if (this.corsConfig.credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true'
      }
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify(body),
    }
  }

  private buildCORSResponse(): APIGatewayResponse {
    const headers: Record<string, string> = {}

    if (this.corsConfig) {
      const origins = this.corsConfig.origins
      headers['Access-Control-Allow-Origin'] = origins === '*' ? '*' : origins.join(', ')
      headers['Access-Control-Allow-Methods'] = this.corsConfig.methods?.join(', ') || 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      headers['Access-Control-Allow-Headers'] = this.corsConfig.headers?.join(', ') || 'Content-Type, Authorization'

      if (this.corsConfig.credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true'
      }

      if (this.corsConfig.maxAge) {
        headers['Access-Control-Max-Age'] = String(this.corsConfig.maxAge)
      }
    }

    return {
      statusCode: 204,
      headers,
      body: '',
    }
  }
}

/**
 * Stream handler builder for DynamoDB Streams
 */
export class StreamHandler {
  private handlers: Map<string, (record: DynamoDBStreamEvent['Records'][0]) => Promise<void>> = new Map()
  private errorHandler?: (error: Error, record: DynamoDBStreamEvent['Records'][0]) => Promise<void>
  private batchSize = 10
  private parallelProcessing = false

  /**
   * Handle INSERT events
   */
  onInsert(handler: (record: DynamoDBStreamEvent['Records'][0]) => Promise<void>): this {
    this.handlers.set('INSERT', handler)
    return this
  }

  /**
   * Handle MODIFY events
   */
  onModify(handler: (record: DynamoDBStreamEvent['Records'][0]) => Promise<void>): this {
    this.handlers.set('MODIFY', handler)
    return this
  }

  /**
   * Handle REMOVE events
   */
  onRemove(handler: (record: DynamoDBStreamEvent['Records'][0]) => Promise<void>): this {
    this.handlers.set('REMOVE', handler)
    return this
  }

  /**
   * Handle all events
   */
  onAny(handler: (record: DynamoDBStreamEvent['Records'][0]) => Promise<void>): this {
    this.handlers.set('*', handler)
    return this
  }

  /**
   * Set error handler
   */
  onError(handler: (error: Error, record: DynamoDBStreamEvent['Records'][0]) => Promise<void>): this {
    this.errorHandler = handler
    return this
  }

  /**
   * Enable parallel processing
   */
  parallel(enabled: boolean = true): this {
    this.parallelProcessing = enabled
    return this
  }

  /**
   * Build the Lambda handler
   */
  build(): (event: DynamoDBStreamEvent, context: LambdaContext) => Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> {
    return async (event: DynamoDBStreamEvent): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> => {
      const failures: Array<{ itemIdentifier: string }> = []

      const processRecord = async (record: DynamoDBStreamEvent['Records'][0]): Promise<void> => {
        try {
          // Try specific handler first
          const specificHandler = this.handlers.get(record.eventName)
          if (specificHandler) {
            await specificHandler(record)
          }

          // Then try catch-all handler
          const anyHandler = this.handlers.get('*')
          if (anyHandler) {
            await anyHandler(record)
          }
        }
        catch (error) {
          if (this.errorHandler) {
            await this.errorHandler(error instanceof Error ? error : new Error(String(error)), record)
          }
          failures.push({ itemIdentifier: record.eventID })
        }
      }

      if (this.parallelProcessing) {
        await Promise.all(event.Records.map(processRecord))
      }
      else {
        for (const record of event.Records) {
          await processRecord(record)
        }
      }

      return { batchItemFailures: failures }
    }
  }
}

/**
 * SQS handler builder
 */
export class SQSHandler {
  private messageHandler?: (message: SQSEvent['Records'][0]) => Promise<void>
  private errorHandler?: (error: Error, message: SQSEvent['Records'][0]) => Promise<void>
  private parallelProcessing = false

  /**
   * Handle messages
   */
  onMessage(handler: (message: SQSEvent['Records'][0]) => Promise<void>): this {
    this.messageHandler = handler
    return this
  }

  /**
   * Set error handler
   */
  onError(handler: (error: Error, message: SQSEvent['Records'][0]) => Promise<void>): this {
    this.errorHandler = handler
    return this
  }

  /**
   * Enable parallel processing
   */
  parallel(enabled: boolean = true): this {
    this.parallelProcessing = enabled
    return this
  }

  /**
   * Build the Lambda handler
   */
  build(): (event: SQSEvent, context: LambdaContext) => Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> {
    return async (event: SQSEvent): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> => {
      const failures: Array<{ itemIdentifier: string }> = []

      if (!this.messageHandler) {
        throw new Error('No message handler defined')
      }

      const processMessage = async (record: SQSEvent['Records'][0]): Promise<void> => {
        try {
          await this.messageHandler!(record)
        }
        catch (error) {
          if (this.errorHandler) {
            await this.errorHandler(error instanceof Error ? error : new Error(String(error)), record)
          }
          failures.push({ itemIdentifier: record.messageId })
        }
      }

      if (this.parallelProcessing) {
        await Promise.all(event.Records.map(processMessage))
      }
      else {
        for (const record of event.Records) {
          await processMessage(record)
        }
      }

      return { batchItemFailures: failures }
    }
  }
}

/**
 * Create an API handler
 */
/**
 * Options for creating an API handler
 */
export interface APIHandlerOptions {
  cors?: boolean | CORSConfig
  defaultHeaders?: Record<string, string>
  basePath?: string
  /** Custom error handler */
  errorHandler?: (error: Error, event: APIGatewayEvent) => APIGatewayResponse
}

export function createAPIHandler(options?: APIHandlerOptions): APIHandler {
  const handler = new APIHandler()

  if (options?.cors) {
    const corsConfig: CORSConfig = typeof options.cors === 'boolean'
      ? { origins: '*' }
      : options.cors
    handler.cors(corsConfig)
  }

  return handler
}

/**
 * Create a stream handler
 */
export function createStreamHandler(): StreamHandler {
  return new StreamHandler()
}

/**
 * Create an SQS handler
 */
export function createSQSHandler(): SQSHandler {
  return new SQSHandler()
}

/**
 * Parse JSON body from API Gateway event
 */
export function parseBody<T = unknown>(event: APIGatewayEvent): T | null {
  if (!event.body)
    return null

  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body

    return JSON.parse(body) as T
  }
  catch {
    return null
  }
}

/**
 * Extract path parameters
 */
export function getPathParams(event: APIGatewayEvent): Record<string, string> {
  return event.pathParameters || {}
}

/**
 * Extract query parameters
 */
export function getQueryParams(event: APIGatewayEvent): Record<string, string> {
  return event.queryStringParameters || {}
}

/**
 * Get header value (case-insensitive)
 */
export function getHeader(event: APIGatewayEvent, name: string): string | undefined {
  if (!event.headers)
    return undefined

  const lowerName = name.toLowerCase()
  for (const [key, value] of Object.entries(event.headers)) {
    if (key.toLowerCase() === lowerName) {
      return value
    }
  }

  return undefined
}
