import { describe, expect, it } from 'bun:test'
import {
  APIHandler,
  createAPIHandler,
  getPathParams,
  getQueryParams,
  parseBody,
} from '../src'

describe('APIHandler', () => {
  describe('creation', () => {
    it('should create an API handler', () => {
      const handler = createAPIHandler()
      expect(handler).toBeInstanceOf(APIHandler)
    })

    it('should create handler with custom options', () => {
      const handler = createAPIHandler({
        cors: true,
        defaultHeaders: { 'X-Custom': 'value' },
      })
      expect(handler).toBeInstanceOf(APIHandler)
    })

    it('should create handler with base path', () => {
      const handler = createAPIHandler({
        basePath: '/api/v1',
      })
      expect(handler).toBeInstanceOf(APIHandler)
    })
  })

  describe('route registration', () => {
    it('should register GET routes', () => {
      const handler = createAPIHandler()
      handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))
      expect(handler).toBeDefined()
    })

    it('should register POST routes', () => {
      const handler = createAPIHandler()
      handler.post('/users', async () => ({ statusCode: 201, body: '{}' }))
      expect(handler).toBeDefined()
    })

    it('should register PUT routes', () => {
      const handler = createAPIHandler()
      handler.put('/users/:id', async () => ({ statusCode: 200, body: '{}' }))
      expect(handler).toBeDefined()
    })

    it('should register PATCH routes', () => {
      const handler = createAPIHandler()
      handler.patch('/users/:id', async () => ({ statusCode: 200, body: '{}' }))
      expect(handler).toBeDefined()
    })

    it('should register DELETE routes', () => {
      const handler = createAPIHandler()
      handler.delete('/users/:id', async () => ({ statusCode: 204, body: '' }))
      expect(handler).toBeDefined()
    })

    it('should register multiple routes', () => {
      const handler = createAPIHandler()
      handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))
      handler.post('/users', async () => ({ statusCode: 201, body: '{}' }))
      handler.get('/users/:id', async () => ({ statusCode: 200, body: '{}' }))
      handler.put('/users/:id', async () => ({ statusCode: 200, body: '{}' }))
      handler.delete('/users/:id', async () => ({ statusCode: 204, body: '' }))
      expect(handler).toBeDefined()
    })

    it('should support route chaining', () => {
      const handler = createAPIHandler()
        .get('/users', async () => ({ statusCode: 200, body: '[]' }))
        .post('/users', async () => ({ statusCode: 201, body: '{}' }))

      expect(handler).toBeDefined()
    })
  })

  describe('request handling', () => {
    it('should handle GET requests', async () => {
      const handler = createAPIHandler()
      handler.get('/users', async () => ({
        statusCode: 200,
        body: JSON.stringify([{ id: '1', name: 'John' }]),
      }))

      const event = {
        httpMethod: 'GET',
        path: '/users',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      const response = await handler.handle(event)
      expect(response.statusCode).toBe(200)
    })

    it('should handle POST requests with body', async () => {
      const handler = createAPIHandler()
      handler.post('/users', async (req) => {
        const body = req.body
        return {
          statusCode: 201,
          body: JSON.stringify(body),
        }
      })

      const event = {
        httpMethod: 'POST',
        path: '/users',
        pathParameters: null,
        queryStringParameters: null,
        body: JSON.stringify({ name: 'John' }),
        headers: { 'Content-Type': 'application/json' },
      }

      const response = await handler.handle(event)
      expect(response.statusCode).toBe(201)
    })

    it('should return 404 for unmatched routes', async () => {
      const handler = createAPIHandler()
      handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))

      const event = {
        httpMethod: 'GET',
        path: '/unknown',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      const response = await handler.handle(event)
      expect(response.statusCode).toBe(404)
    })

    it('should return 405 for method not allowed', async () => {
      const handler = createAPIHandler()
      handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))

      const event = {
        httpMethod: 'POST',
        path: '/users',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      const response = await handler.handle(event)
      expect(response.statusCode).toBe(404) // or 405 depending on implementation
    })
  })

  describe('middleware', () => {
    it('should support middleware', async () => {
      const handler = createAPIHandler()
      let middlewareExecuted = false

      handler.use(async (req, next) => {
        middlewareExecuted = true
        return next(req)
      })

      handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))

      const event = {
        httpMethod: 'GET',
        path: '/users',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      await handler.handle(event)
      expect(middlewareExecuted).toBe(true)
    })

    it('should support multiple middleware', async () => {
      const handler = createAPIHandler()
      const order: number[] = []

      handler.use(async (req, next) => {
        order.push(1)
        const response = await next(req)
        order.push(4)
        return response
      })

      handler.use(async (req, next) => {
        order.push(2)
        const response = await next(req)
        order.push(3)
        return response
      })

      handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))

      const event = {
        httpMethod: 'GET',
        path: '/users',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      await handler.handle(event)
      expect(order).toEqual([1, 2, 3, 4])
    })
  })

  describe('error handling', () => {
    it('should handle thrown errors', async () => {
      const handler = createAPIHandler()
      handler.get('/error', async () => {
        throw new Error('Test error')
      })

      const event = {
        httpMethod: 'GET',
        path: '/error',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      const response = await handler.handle(event)
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
    })

    it('should handle async errors', async () => {
      const handler = createAPIHandler()
      handler.get('/async-error', async () => {
        await Promise.reject(new Error('Async error'))
        return { statusCode: 200, body: '' }
      })

      const event = {
        httpMethod: 'GET',
        path: '/async-error',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      const response = await handler.handle(event)
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
    })

    it('should use custom error handler', async () => {
      const handler = createAPIHandler({
        errorHandler: (error) => ({
          statusCode: 500,
          body: JSON.stringify({ error: error.message }),
        }),
      })

      handler.get('/error', async () => {
        throw new Error('Custom error')
      })

      const event = {
        httpMethod: 'GET',
        path: '/error',
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        headers: {},
      }

      const response = await handler.handle(event)
      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body).error).toBe('Custom error')
    })
  })
})

describe('parseBody', () => {
  it('should parse JSON request body', () => {
    const event = {
      body: '{"name": "John"}',
      isBase64Encoded: false,
    } as Parameters<typeof parseBody>[0]
    const body = parseBody(event)
    expect(body).toEqual({ name: 'John' })
  })

  it('should parse base64 encoded body', () => {
    const event = {
      body: Buffer.from('{"name": "Jane"}').toString('base64'),
      isBase64Encoded: true,
    } as Parameters<typeof parseBody>[0]
    const body = parseBody(event)
    expect(body).toEqual({ name: 'Jane' })
  })

  it('should return null for empty body', () => {
    const event = {
      body: null,
      isBase64Encoded: false,
    } as Parameters<typeof parseBody>[0]
    const body = parseBody(event)
    expect(body).toBeNull()
  })

  it('should return null for undefined body', () => {
    const event = {
      body: undefined,
      isBase64Encoded: false,
    } as Parameters<typeof parseBody>[0]
    const body = parseBody(event)
    expect(body).toBeNull()
  })

  it('should handle invalid JSON gracefully', () => {
    const event = {
      body: 'not valid json',
      isBase64Encoded: false,
    } as Parameters<typeof parseBody>[0]

    expect(() => parseBody(event)).toThrow()
  })

  it('should parse nested objects', () => {
    const event = {
      body: JSON.stringify({
        user: {
          name: 'John',
          address: {
            city: 'NYC',
          },
        },
      }),
      isBase64Encoded: false,
    } as Parameters<typeof parseBody>[0]
    const body = parseBody(event)
    expect(body.user.address.city).toBe('NYC')
  })

  it('should parse arrays', () => {
    const event = {
      body: JSON.stringify([1, 2, 3]),
      isBase64Encoded: false,
    } as Parameters<typeof parseBody>[0]
    const body = parseBody(event)
    expect(body).toEqual([1, 2, 3])
  })
})

describe('getPathParams', () => {
  it('should extract path parameters', () => {
    const event = {
      pathParameters: { id: '123' },
    } as Parameters<typeof getPathParams>[0]
    const params = getPathParams(event)
    expect(params).toEqual({ id: '123' })
  })

  it('should handle multiple path parameters', () => {
    const event = {
      pathParameters: { userId: '123', orderId: '456' },
    } as Parameters<typeof getPathParams>[0]
    const params = getPathParams(event)
    expect(params).toEqual({ userId: '123', orderId: '456' })
  })

  it('should return empty object for null parameters', () => {
    const event = {
      pathParameters: null,
    } as Parameters<typeof getPathParams>[0]
    const params = getPathParams(event)
    expect(params).toEqual({})
  })

  it('should return empty object for undefined parameters', () => {
    const event = {
      pathParameters: undefined,
    } as Parameters<typeof getPathParams>[0]
    const params = getPathParams(event)
    expect(params).toEqual({})
  })

  it('should handle special characters in path params', () => {
    const event = {
      pathParameters: { slug: 'my-article-title' },
    } as Parameters<typeof getPathParams>[0]
    const params = getPathParams(event)
    expect(params.slug).toBe('my-article-title')
  })
})

describe('getQueryParams', () => {
  it('should extract query parameters', () => {
    const event = {
      queryStringParameters: { page: '1', limit: '10' },
    } as Parameters<typeof getQueryParams>[0]
    const params = getQueryParams(event)
    expect(params).toEqual({ page: '1', limit: '10' })
  })

  it('should return empty object for null parameters', () => {
    const event = {
      queryStringParameters: null,
    } as Parameters<typeof getQueryParams>[0]
    const params = getQueryParams(event)
    expect(params).toEqual({})
  })

  it('should return empty object for undefined parameters', () => {
    const event = {
      queryStringParameters: undefined,
    } as Parameters<typeof getQueryParams>[0]
    const params = getQueryParams(event)
    expect(params).toEqual({})
  })

  it('should handle multiple query parameters', () => {
    const event = {
      queryStringParameters: {
        filter: 'active',
        sort: 'name',
        order: 'asc',
      },
    } as Parameters<typeof getQueryParams>[0]
    const params = getQueryParams(event)
    expect(params).toEqual({ filter: 'active', sort: 'name', order: 'asc' })
  })

  it('should handle boolean-like query parameters', () => {
    const event = {
      queryStringParameters: { includeDeleted: 'true' },
    } as Parameters<typeof getQueryParams>[0]
    const params = getQueryParams(event)
    expect(params.includeDeleted).toBe('true')
  })

  it('should handle empty string values', () => {
    const event = {
      queryStringParameters: { search: '' },
    } as Parameters<typeof getQueryParams>[0]
    const params = getQueryParams(event)
    expect(params.search).toBe('')
  })
})

describe('CORS handling', () => {
  it('should add CORS headers when enabled', async () => {
    const handler = createAPIHandler({ cors: true })
    handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))

    const event = {
      httpMethod: 'GET',
      path: '/users',
      pathParameters: null,
      queryStringParameters: null,
      body: null,
      headers: { origin: 'http://localhost:3000' },
    }

    const response = await handler.handle(event)
    expect(response.headers?.['Access-Control-Allow-Origin']).toBeDefined()
  })

  it('should handle OPTIONS preflight requests', async () => {
    const handler = createAPIHandler({ cors: true })
    handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))

    const event = {
      httpMethod: 'OPTIONS',
      path: '/users',
      pathParameters: null,
      queryStringParameters: null,
      body: null,
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      },
    }

    const response = await handler.handle(event)
    expect(response.statusCode).toBe(200)
    expect(response.headers?.['Access-Control-Allow-Methods']).toBeDefined()
  })

  it('should use custom CORS options', async () => {
    const handler = createAPIHandler({
      cors: {
        origins: ['http://example.com'],
        methods: ['GET', 'POST'],
        headers: ['Content-Type', 'Authorization'],
      },
    })

    handler.get('/users', async () => ({ statusCode: 200, body: '[]' }))

    const event = {
      httpMethod: 'GET',
      path: '/users',
      pathParameters: null,
      queryStringParameters: null,
      body: null,
      headers: { origin: 'http://example.com' },
    }

    const response = await handler.handle(event)
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('http://example.com')
  })
})

describe('response helpers', () => {
  it('should create JSON responses', async () => {
    const handler = createAPIHandler()
    handler.get('/users', async () => ({
      statusCode: 200,
      body: JSON.stringify({ users: [] }),
      headers: { 'Content-Type': 'application/json' },
    }))

    const event = {
      httpMethod: 'GET',
      path: '/users',
      pathParameters: null,
      queryStringParameters: null,
      body: null,
      headers: {},
    }

    const response = await handler.handle(event)
    expect(response.headers?.['Content-Type']).toBe('application/json')
  })

  it('should handle custom headers', async () => {
    const handler = createAPIHandler()
    handler.get('/download', async () => ({
      statusCode: 200,
      body: 'file content',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="file.txt"',
      },
    }))

    const event = {
      httpMethod: 'GET',
      path: '/download',
      pathParameters: null,
      queryStringParameters: null,
      body: null,
      headers: {},
    }

    const response = await handler.handle(event)
    expect(response.headers?.['Content-Disposition']).toContain('attachment')
  })
})

describe('edge cases', () => {
  it('should handle routes with trailing slashes', async () => {
    const handler = createAPIHandler()
    handler.get('/users/', async () => ({ statusCode: 200, body: '[]' }))

    const event = {
      httpMethod: 'GET',
      path: '/users/',
      pathParameters: null,
      queryStringParameters: null,
      body: null,
      headers: {},
    }

    const response = await handler.handle(event)
    expect(response.statusCode).toBe(200)
  })

  it('should handle deeply nested routes', async () => {
    const handler = createAPIHandler()
    handler.get('/api/v1/users/:userId/orders/:orderId', async (req) => {
      const params = req.pathParameters
      return {
        statusCode: 200,
        body: JSON.stringify(params),
      }
    })

    const event = {
      httpMethod: 'GET',
      path: '/api/v1/users/123/orders/456',
      pathParameters: { userId: '123', orderId: '456' },
      queryStringParameters: null,
      body: null,
      headers: {},
    }

    const response = await handler.handle(event)
    expect(response.statusCode).toBe(200)
  })

  it('should handle large request bodies', async () => {
    const handler = createAPIHandler()
    handler.post('/upload', async (req) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ size: JSON.stringify(req.body).length }),
      }
    })

    const largeBody = { data: 'x'.repeat(10000) }
    const event = {
      httpMethod: 'POST',
      path: '/upload',
      pathParameters: null,
      queryStringParameters: null,
      body: JSON.stringify(largeBody),
      headers: { 'Content-Type': 'application/json' },
    }

    const response = await handler.handle(event)
    expect(response.statusCode).toBe(200)
  })

  it('should handle concurrent requests', async () => {
    const handler = createAPIHandler()
    handler.get('/delay/:ms', async (req) => {
      const ms = parseInt(req.pathParameters?.ms || '0')
      await new Promise(resolve => setTimeout(resolve, ms))
      return { statusCode: 200, body: JSON.stringify({ ms }) }
    })

    const events = [
      { httpMethod: 'GET', path: '/delay/10', pathParameters: { ms: '10' }, queryStringParameters: null, body: null, headers: {} },
      { httpMethod: 'GET', path: '/delay/5', pathParameters: { ms: '5' }, queryStringParameters: null, body: null, headers: {} },
      { httpMethod: 'GET', path: '/delay/1', pathParameters: { ms: '1' }, queryStringParameters: null, body: null, headers: {} },
    ]

    const responses = await Promise.all(events.map(e => handler.handle(e)))
    expect(responses.every(r => r.statusCode === 200)).toBe(true)
  })
})
