import { describe, expect, it, beforeEach } from 'bun:test'
import {
  Logger,
  createLogger,
  defaultLogger,
  ConsoleTransport,
  MetricsRegistry,
  createMetricsRegistry,
  defaultMetrics,
  Tracer,
  createTracer,
  defaultTracer,
} from '../src/observability'

describe('Observability', () => {
  describe('Logger', () => {
    describe('Logger Creation', () => {
      it('should create a logger with default config', () => {
        const logger = createLogger()
        expect(logger).toBeInstanceOf(Logger)
      })

      it('should create a logger with specific level', () => {
        const logger = createLogger({ level: 'debug' })
        expect(logger).toBeInstanceOf(Logger)
      })

      it('should have a default logger', () => {
        expect(defaultLogger).toBeInstanceOf(Logger)
      })

      it('should create logger with transports', () => {
        const transport = new ConsoleTransport({ level: 'info' })
        const logger = createLogger({
          level: 'info',
          transports: [transport],
        })
        expect(logger).toBeDefined()
      })

      it('should create logger with all log levels', () => {
        const levels = ['debug', 'info', 'warn', 'error'] as const
        for (const level of levels) {
          const logger = createLogger({ level })
          expect(logger).toBeInstanceOf(Logger)
        }
      })
    })

    describe('Logging Methods', () => {
      let logger: Logger

      beforeEach(() => {
        logger = createLogger({ level: 'debug' })
      })

      it('should log debug messages', () => {
        expect(() => logger.debug('Debug message')).not.toThrow()
      })

      it('should log info messages', () => {
        expect(() => logger.info('Info message')).not.toThrow()
      })

      it('should log warn messages', () => {
        expect(() => logger.warn('Warning message')).not.toThrow()
      })

      it('should log error messages', () => {
        expect(() => logger.error('Error message')).not.toThrow()
      })

      it('should log with metadata', () => {
        expect(() => logger.info('Message', { userId: '123', action: 'test' })).not.toThrow()
      })

      it('should log error with Error object', () => {
        const error = new Error('Test error')
        expect(() => logger.error('Failed operation', { error })).not.toThrow()
      })

      it('should log with nested metadata', () => {
        expect(() => logger.info('Message', {
          user: { id: '123', name: 'Test' },
          request: { method: 'GET', path: '/api' },
        })).not.toThrow()
      })
    })

    describe('Log Levels', () => {
      it('should respect log level filtering', () => {
        const logger = createLogger({ level: 'warn' })
        // These should not throw but debug/info should be filtered
        expect(() => logger.debug('Debug')).not.toThrow()
        expect(() => logger.info('Info')).not.toThrow()
        expect(() => logger.warn('Warn')).not.toThrow()
        expect(() => logger.error('Error')).not.toThrow()
      })
    })

    describe('Console Transport', () => {
      it('should create console transport', () => {
        const transport = new ConsoleTransport({ level: 'info' })
        expect(transport).toBeDefined()
      })

      it('should create console transport with all levels', () => {
        const levels = ['debug', 'info', 'warn', 'error'] as const
        for (const level of levels) {
          const transport = new ConsoleTransport({ level })
          expect(transport).toBeDefined()
        }
      })
    })
  })

  describe('Metrics', () => {
    describe('MetricsRegistry Creation', () => {
      it('should create a metrics registry', () => {
        const registry = createMetricsRegistry()
        expect(registry).toBeInstanceOf(MetricsRegistry)
      })

      it('should have default metrics', () => {
        expect(defaultMetrics).toBeInstanceOf(MetricsRegistry)
      })
    })

    describe('Counters', () => {
      let registry: MetricsRegistry

      beforeEach(() => {
        registry = createMetricsRegistry()
      })

      it('should increment counter', () => {
        registry.increment('requests', { method: 'GET' })
        const value = registry.getCounter('requests', { method: 'GET' })
        expect(value).toBe(1)
      })

      it('should increment counter multiple times', () => {
        registry.increment('requests', { method: 'GET' })
        registry.increment('requests', { method: 'GET' })
        registry.increment('requests', { method: 'GET' })
        const value = registry.getCounter('requests', { method: 'GET' })
        expect(value).toBe(3)
      })

      it('should track counters with different labels', () => {
        registry.increment('requests', { method: 'GET' })
        registry.increment('requests', { method: 'POST' })
        registry.increment('requests', { method: 'GET' })

        expect(registry.getCounter('requests', { method: 'GET' })).toBe(2)
        expect(registry.getCounter('requests', { method: 'POST' })).toBe(1)
      })

      it('should return 0 for non-existent counter', () => {
        const value = registry.getCounter('nonexistent', {})
        expect(value).toBe(0)
      })

      it('should handle empty labels', () => {
        registry.increment('simple_counter', {})
        expect(registry.getCounter('simple_counter', {})).toBe(1)
      })

      it('should handle complex label values', () => {
        registry.increment('requests', {
          method: 'GET',
          path: '/api/users',
          status: '200',
        })
        expect(registry.getCounter('requests', {
          method: 'GET',
          path: '/api/users',
          status: '200',
        })).toBe(1)
      })
    })

    describe('Gauges', () => {
      let registry: MetricsRegistry

      beforeEach(() => {
        registry = createMetricsRegistry()
      })

      it('should set gauge value', () => {
        registry.gauge('active_connections', 42, { pool: 'main' })
        const value = registry.getGauge('active_connections', { pool: 'main' })
        expect(value).toBe(42)
      })

      it('should update gauge value', () => {
        registry.gauge('temperature', 20, { sensor: '1' })
        registry.gauge('temperature', 25, { sensor: '1' })
        const value = registry.getGauge('temperature', { sensor: '1' })
        expect(value).toBe(25)
      })

      it('should track gauges with different labels', () => {
        registry.gauge('cpu_usage', 30, { core: '0' })
        registry.gauge('cpu_usage', 50, { core: '1' })

        expect(registry.getGauge('cpu_usage', { core: '0' })).toBe(30)
        expect(registry.getGauge('cpu_usage', { core: '1' })).toBe(50)
      })

      it('should return undefined for non-existent gauge', () => {
        const value = registry.getGauge('nonexistent', {})
        expect(value).toBeUndefined()
      })

      it('should handle negative gauge values', () => {
        registry.gauge('delta', -10, {})
        expect(registry.getGauge('delta', {})).toBe(-10)
      })

      it('should handle floating point gauge values', () => {
        registry.gauge('ratio', 0.75, {})
        expect(registry.getGauge('ratio', {})).toBe(0.75)
      })
    })

    describe('Histograms', () => {
      let registry: MetricsRegistry

      beforeEach(() => {
        registry = createMetricsRegistry()
      })

      it('should observe histogram values', () => {
        registry.observe('latency', 100, { operation: 'query' })
        const stats = registry.getHistogramStats('latency', { operation: 'query' })

        expect(stats).toBeDefined()
        expect(stats?.count).toBe(1)
        expect(stats?.sum).toBe(100)
      })

      it('should calculate histogram statistics', () => {
        registry.observe('response_time', 100, { endpoint: '/api' })
        registry.observe('response_time', 200, { endpoint: '/api' })
        registry.observe('response_time', 300, { endpoint: '/api' })

        const stats = registry.getHistogramStats('response_time', { endpoint: '/api' })

        expect(stats?.count).toBe(3)
        expect(stats?.sum).toBe(600)
        expect(stats?.avg).toBe(200)
      })

      it('should track histograms with different labels', () => {
        registry.observe('duration', 50, { type: 'read' })
        registry.observe('duration', 100, { type: 'write' })
        registry.observe('duration', 75, { type: 'read' })

        const readStats = registry.getHistogramStats('duration', { type: 'read' })
        const writeStats = registry.getHistogramStats('duration', { type: 'write' })

        expect(readStats?.count).toBe(2)
        expect(writeStats?.count).toBe(1)
      })

      it('should return undefined for non-existent histogram', () => {
        const stats = registry.getHistogramStats('nonexistent', {})
        expect(stats).toBeUndefined()
      })

      it('should calculate average correctly', () => {
        registry.observe('time', 10, {})
        registry.observe('time', 20, {})
        registry.observe('time', 30, {})

        const stats = registry.getHistogramStats('time', {})
        expect(stats?.avg).toBe(20)
      })
    })

    describe('DynamoDB Metrics', () => {
      let registry: MetricsRegistry

      beforeEach(() => {
        registry = createMetricsRegistry()
      })

      it('should track operation duration', () => {
        registry.observe('dynamodb_operation_duration_ms', 50, {
          operation: 'Query',
          table: 'Users',
          status: 'success',
        })

        const stats = registry.getHistogramStats('dynamodb_operation_duration_ms', {
          operation: 'Query',
          table: 'Users',
          status: 'success',
        })

        expect(stats?.count).toBe(1)
      })

      it('should track consumed capacity', () => {
        registry.observe('dynamodb_consumed_capacity', 5.5, {
          operation: 'Query',
          table: 'Users',
        })

        const stats = registry.getHistogramStats('dynamodb_consumed_capacity', {
          operation: 'Query',
          table: 'Users',
        })

        expect(stats?.sum).toBe(5.5)
      })
    })
  })

  describe('Tracing', () => {
    describe('Tracer Creation', () => {
      it('should create a tracer', () => {
        const tracer = createTracer()
        expect(tracer).toBeInstanceOf(Tracer)
      })

      it('should have a default tracer', () => {
        expect(defaultTracer).toBeInstanceOf(Tracer)
      })

      it('should create tracer with service name', () => {
        const tracer = createTracer({ serviceName: 'my-service' })
        expect(tracer).toBeInstanceOf(Tracer)
      })
    })

    describe('Spans', () => {
      let tracer: Tracer

      beforeEach(() => {
        tracer = createTracer()
      })

      it('should create a span', () => {
        const span = tracer.startSpan('test-operation')
        expect(span).toBeDefined()
        span.end()
      })

      it('should have trace and span IDs', () => {
        const span = tracer.startSpan('test-operation')
        const data = span.getData()

        expect(data.traceId).toBeDefined()
        expect(data.spanId).toBeDefined()
        expect(data.traceId.length).toBeGreaterThan(0)
        expect(data.spanId.length).toBeGreaterThan(0)

        span.end()
      })

      it('should have operation name', () => {
        const span = tracer.startSpan('my-operation')
        const data = span.getData()

        expect(data.name).toBe('my-operation')
        span.end()
      })

      it('should track span duration', () => {
        const span = tracer.startSpan('test')
        span.end()
        const data = span.getData()

        expect(data.startTime).toBeDefined()
        expect(data.endTime).toBeDefined()
        expect(data.durationMs).toBeGreaterThanOrEqual(0)
      })

      it('should support span attributes', () => {
        const span = tracer.startSpan('test')
        span.setAttribute('key', 'value')
        const data = span.getData()

        expect(data.attributes.key).toBe('value')
        span.end()
      })

      it('should support multiple attributes', () => {
        const span = tracer.startSpan('test')
        span.setAttribute('a', '1')
        span.setAttribute('b', '2')
        span.setAttribute('c', '3')
        const data = span.getData()

        expect(data.attributes.a).toBe('1')
        expect(data.attributes.b).toBe('2')
        expect(data.attributes.c).toBe('3')
        span.end()
      })

      it('should support setAttributes for bulk update', () => {
        const span = tracer.startSpan('test')
        span.setAttributes({
          key1: 'value1',
          key2: 'value2',
        })
        const data = span.getData()

        expect(data.attributes.key1).toBe('value1')
        expect(data.attributes.key2).toBe('value2')
        span.end()
      })

      it('should support span events', () => {
        const span = tracer.startSpan('test')
        span.addEvent('event-name', { detail: 'info' })
        const data = span.getData()

        expect(data.events).toBeDefined()
        expect(data.events.length).toBeGreaterThan(0)
        span.end()
      })

      it('should support span status', () => {
        const span = tracer.startSpan('test')
        span.setStatus('OK')
        const data = span.getData()

        expect(data.status).toBe('OK')
        span.end()
      })

      it('should support error status', () => {
        const span = tracer.startSpan('test')
        span.setStatus('ERROR', 'Something went wrong')
        const data = span.getData()

        expect(data.status).toBe('ERROR')
        span.end()
      })

      it('should record exception', () => {
        const span = tracer.startSpan('test')
        const error = new Error('Test error')
        span.recordException(error)
        const data = span.getData()

        expect(data.events.some(e => e.name === 'exception')).toBe(true)
        span.end()
      })
    })

    describe('DynamoDB Spans', () => {
      let tracer: Tracer

      beforeEach(() => {
        tracer = createTracer()
      })

      it('should create DynamoDB span', () => {
        const span = tracer.startDynamoDBSpan('Query', { tableName: 'Users' })

        expect(span).toBeDefined()
        const data = span.getData()
        expect(data.name).toBe('DynamoDB.Query')

        span.end()
      })

      it('should include db.operation attribute', () => {
        const span = tracer.startDynamoDBSpan('GetItem', { tableName: 'Users' })
        const data = span.getData()

        expect(data.attributes['db.operation']).toBe('GetItem')
        span.end()
      })

      it('should include table name attribute', () => {
        const span = tracer.startDynamoDBSpan('Scan', { tableName: 'Orders' })
        const data = span.getData()

        expect(data.attributes['aws.dynamodb.table_names']).toEqual(['Orders'])
        span.end()
      })

      it('should support all DynamoDB operations', () => {
        const operations = ['GetItem', 'PutItem', 'UpdateItem', 'DeleteItem', 'Query', 'Scan', 'BatchGetItem', 'BatchWriteItem']

        for (const op of operations) {
          const span = tracer.startDynamoDBSpan(op, { tableName: 'Test' })
          expect(span.getData().name).toBe(`DynamoDB.${op}`)
          span.end()
        }
      })

      it('should support index name for Query/Scan', () => {
        const span = tracer.startDynamoDBSpan('Query', {
          tableName: 'Users',
          indexName: 'GSI1',
        })
        const data = span.getData()

        expect(data.attributes['aws.dynamodb.index_name']).toBe('GSI1')
        span.end()
      })
    })

    describe('Child Spans', () => {
      let tracer: Tracer

      beforeEach(() => {
        tracer = createTracer()
      })

      it('should create child span', () => {
        const parentSpan = tracer.startSpan('parent')
        const childSpan = tracer.startSpan('child', { parent: parentSpan })

        const parentData = parentSpan.getData()
        const childData = childSpan.getData()

        expect(childData.parentSpanId).toBe(parentData.spanId)
        expect(childData.traceId).toBe(parentData.traceId)

        childSpan.end()
        parentSpan.end()
      })

      it('should support nested child spans', () => {
        const root = tracer.startSpan('root')
        const child1 = tracer.startSpan('child1', { parent: root })
        const child2 = tracer.startSpan('child2', { parent: child1 })

        expect(child2.getData().traceId).toBe(root.getData().traceId)

        child2.end()
        child1.end()
        root.end()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string metric names', () => {
      const registry = createMetricsRegistry()
      registry.increment('', {})
      expect(registry.getCounter('', {})).toBe(1)
    })

    it('should handle special characters in metric names', () => {
      const registry = createMetricsRegistry()
      registry.increment('my.metric:name_test', {})
      expect(registry.getCounter('my.metric:name_test', {})).toBe(1)
    })

    it('should handle very large metric values', () => {
      const registry = createMetricsRegistry()
      registry.gauge('large', Number.MAX_SAFE_INTEGER, {})
      expect(registry.getGauge('large', {})).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should handle very small metric values', () => {
      const registry = createMetricsRegistry()
      registry.gauge('small', Number.MIN_VALUE, {})
      expect(registry.getGauge('small', {})).toBe(Number.MIN_VALUE)
    })

    it('should handle empty span name', () => {
      const tracer = createTracer()
      const span = tracer.startSpan('')
      expect(span.getData().name).toBe('')
      span.end()
    })

    it('should handle unicode in span names', () => {
      const tracer = createTracer()
      const span = tracer.startSpan('操作名')
      expect(span.getData().name).toBe('操作名')
      span.end()
    })

    it('should handle many concurrent spans', () => {
      const tracer = createTracer()
      const spans = []

      for (let i = 0; i < 100; i++) {
        spans.push(tracer.startSpan(`span-${i}`))
      }

      expect(spans).toHaveLength(100)

      for (const span of spans) {
        span.end()
      }
    })

    it('should handle many metrics with different labels', () => {
      const registry = createMetricsRegistry()

      for (let i = 0; i < 100; i++) {
        registry.increment('requests', { id: String(i) })
      }

      // Each should be independent
      expect(registry.getCounter('requests', { id: '50' })).toBe(1)
    })
  })
})
