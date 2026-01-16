import type { StreamEvent, StreamRecord } from '../src/streams'
import { beforeEach, describe, expect, it } from 'bun:test'
import {
  createStreamProcessor,

  StreamProcessor,

} from '../src/streams'

describe('Streams Processing', () => {
  describe('StreamProcessor Creation', () => {
    it('should create a stream processor with default config', () => {
      const processor = createStreamProcessor()
      expect(processor).toBeInstanceOf(StreamProcessor)
    })

    it('should create a stream processor with custom config', () => {
      const processor = createStreamProcessor({
        concurrency: 5,
        errorMode: 'throw',
        metrics: false,
      })
      expect(processor).toBeInstanceOf(StreamProcessor)
    })

    it('should create a stream processor with retry config', () => {
      const processor = createStreamProcessor({
        retry: {
          enabled: true,
          maxRetries: 5,
          backoffMs: 200,
        },
      })
      expect(processor).toBeInstanceOf(StreamProcessor)
    })

    it('should create a stream processor with filter', () => {
      const processor = createStreamProcessor({
        filter: record => record.eventType === 'INSERT',
      })
      expect(processor).toBeInstanceOf(StreamProcessor)
    })

    it('should create a stream processor with transform', () => {
      const processor = createStreamProcessor({
        transform: record => ({ ...record, tableName: `prefixed_${record.tableName}` }),
      })
      expect(processor).toBeInstanceOf(StreamProcessor)
    })
  })

  describe('Handler Registration', () => {
    let processor: StreamProcessor

    beforeEach(() => {
      processor = createStreamProcessor()
    })

    it('should add a global handler', () => {
      processor.addHandler(async () => {})
      expect(processor).toBeDefined()
    })

    it('should chain handler additions', () => {
      const result = processor
        .addHandler(async () => {})
        .addHandler(async () => {})
      expect(result).toBe(processor)
    })

    it('should add entity handler with all event types', () => {
      processor.addEntityHandler({
        entityType: 'User',
        onInsert: async () => {},
        onModify: async () => {},
        onRemove: async () => {},
        onAny: async () => {},
      })
      expect(processor).toBeDefined()
    })

    it('should add entity handler with partial event types', () => {
      processor.addEntityHandler({
        entityType: 'User',
        onInsert: async () => {},
      })
      expect(processor).toBeDefined()
    })

    it('should add handler for specific event type using on()', () => {
      processor.on('INSERT', async () => {})
      processor.on('MODIFY', async () => {})
      processor.on('REMOVE', async () => {})
      expect(processor).toBeDefined()
    })

    it('should add INSERT handler using onInsert()', () => {
      const result = processor.onInsert(async () => {})
      expect(result).toBe(processor)
    })

    it('should add MODIFY handler using onModify()', () => {
      const result = processor.onModify(async () => {})
      expect(result).toBe(processor)
    })

    it('should add REMOVE handler using onRemove()', () => {
      const result = processor.onRemove(async () => {})
      expect(result).toBe(processor)
    })

    it('should support multiple entity handlers for different types', () => {
      processor
        .addEntityHandler({ entityType: 'User', onInsert: async () => {} })
        .addEntityHandler({ entityType: 'Order', onInsert: async () => {} })
        .addEntityHandler({ entityType: 'Product', onInsert: async () => {} })
      expect(processor).toBeDefined()
    })
  })

  describe('Statistics', () => {
    let processor: StreamProcessor

    beforeEach(() => {
      processor = createStreamProcessor()
    })

    it('should have initial stats', () => {
      const stats = processor.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalProcessed).toBe(0)
      expect(stats.errors).toBe(0)
      expect(stats.byEventType).toEqual({ INSERT: 0, MODIFY: 0, REMOVE: 0 })
      expect(stats.byEntityType).toEqual({})
    })

    it('should have processing time stats', () => {
      const stats = processor.getStats()
      expect(stats.processingTime).toBeDefined()
      expect(stats.processingTime.total).toBe(0)
      expect(stats.processingTime.average).toBe(0)
      expect(stats.processingTime.min).toBe(Infinity)
      expect(stats.processingTime.max).toBe(0)
    })

    it('should reset stats', () => {
      processor.resetStats()
      const stats = processor.getStats()
      expect(stats.totalProcessed).toBe(0)
    })

    it('should return a copy of stats (not reference)', () => {
      const stats1 = processor.getStats()
      const stats2 = processor.getStats()
      expect(stats1).not.toBe(stats2)
      expect(stats1).toEqual(stats2)
    })
  })

  describe('Record Processing', () => {
    it('should process a single record', async () => {
      let processed = false
      const processor = createStreamProcessor()
      processor.addHandler(async () => {
        processed = true
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      expect(processed).toBe(true)
    })

    it('should process record with entity type', async () => {
      let entityProcessed = false
      const processor = createStreamProcessor()
      processor.addEntityHandler({
        entityType: 'User',
        onInsert: async () => {
          entityProcessed = true
        },
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      expect(entityProcessed).toBe(true)
    })

    it('should filter records', async () => {
      let processed = false
      const processor = createStreamProcessor({
        filter: record => record.eventType === 'INSERT',
      })
      processor.addHandler(async () => {
        processed = true
      })

      const record: StreamRecord = {
        eventType: 'REMOVE',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      expect(processed).toBe(false)
    })

    it('should transform records', async () => {
      let receivedTableName = ''
      const processor = createStreamProcessor({
        transform: record => ({ ...record, tableName: 'transformed_table' }),
      })
      processor.addHandler(async (record) => {
        receivedTableName = record.tableName
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'original_table',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      expect(receivedTableName).toBe('transformed_table')
    })

    it('should update stats after processing', async () => {
      const processor = createStreamProcessor()
      processor.addHandler(async () => {})

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      const stats = processor.getStats()
      expect(stats.totalProcessed).toBe(1)
      expect(stats.byEventType.INSERT).toBe(1)
      expect(stats.byEntityType.User).toBe(1)
      expect(stats.lastProcessedAt).toBeDefined()
    })
  })

  describe('Event Processing', () => {
    it('should process a stream event with multiple records', async () => {
      let processedCount = 0
      const processor = createStreamProcessor()
      processor.addHandler(async () => {
        processedCount++
      })

      const event: StreamEvent = {
        records: [
          { eventType: 'INSERT', tableName: 'Users', keys: { pk: 'USER#1' }, timestamp: Date.now(), sequenceNumber: '1' },
          { eventType: 'INSERT', tableName: 'Users', keys: { pk: 'USER#2' }, timestamp: Date.now(), sequenceNumber: '2' },
          { eventType: 'INSERT', tableName: 'Users', keys: { pk: 'USER#3' }, timestamp: Date.now(), sequenceNumber: '3' },
        ],
      }

      await processor.processEvent(event)
      expect(processedCount).toBe(3)
    })

    it('should process events concurrently within batch limit', async () => {
      const executionOrder: number[] = []
      const processor = createStreamProcessor({ concurrency: 2 })
      processor.addHandler(async (record) => {
        executionOrder.push(Number.parseInt(record.keys.pk.split('#')[1]))
      })

      const event: StreamEvent = {
        records: [
          { eventType: 'INSERT', tableName: 'Users', keys: { pk: 'USER#1' }, timestamp: Date.now(), sequenceNumber: '1' },
          { eventType: 'INSERT', tableName: 'Users', keys: { pk: 'USER#2' }, timestamp: Date.now(), sequenceNumber: '2' },
          { eventType: 'INSERT', tableName: 'Users', keys: { pk: 'USER#3' }, timestamp: Date.now(), sequenceNumber: '3' },
          { eventType: 'INSERT', tableName: 'Users', keys: { pk: 'USER#4' }, timestamp: Date.now(), sequenceNumber: '4' },
        ],
      }

      await processor.processEvent(event)
      expect(executionOrder).toHaveLength(4)
    })

    it('should handle empty event', async () => {
      const processor = createStreamProcessor()
      processor.addHandler(async () => {})

      const event: StreamEvent = { records: [] }
      await processor.processEvent(event)

      const stats = processor.getStats()
      expect(stats.totalProcessed).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should throw error in throw mode', async () => {
      const processor = createStreamProcessor({ errorMode: 'throw' })
      processor.addHandler(async () => {
        throw new Error('Test error')
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await expect(processor.processRecord(record)).rejects.toThrow('Test error')
    })

    it('should skip error in skip mode', async () => {
      const processor = createStreamProcessor({ errorMode: 'skip' })
      processor.addHandler(async () => {
        throw new Error('Test error')
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      const stats = processor.getStats()
      expect(stats.errors).toBe(1)
    })

    it('should log error in log mode (default)', async () => {
      const processor = createStreamProcessor({ errorMode: 'log' })
      processor.addHandler(async () => {
        throw new Error('Test error')
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      const stats = processor.getStats()
      expect(stats.errors).toBe(1)
    })

    it('should retry on error when retry is enabled', async () => {
      let attempts = 0
      const processor = createStreamProcessor({
        errorMode: 'throw',
        retry: { enabled: true, maxRetries: 2, backoffMs: 10 },
      })
      processor.addHandler(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Retry me')
        }
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await processor.processRecord(record)
      expect(attempts).toBe(3) // Initial + 2 retries
    })

    it('should fail after max retries', async () => {
      let attempts = 0
      const processor = createStreamProcessor({
        errorMode: 'throw',
        retry: { enabled: true, maxRetries: 2, backoffMs: 10 },
      })
      processor.addHandler(async () => {
        attempts++
        throw new Error('Always fail')
      })

      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      await expect(processor.processRecord(record)).rejects.toThrow('Always fail')
      expect(attempts).toBe(3) // Initial + 2 retries
    })
  })

  describe('Lambda Event Parsing', () => {
    it('should parse Lambda DynamoDB stream event', () => {
      const lambdaEvent = {
        Records: [
          {
            eventID: 'evt-1',
            eventName: 'INSERT',
            eventSource: 'aws:dynamodb',
            eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/Users/stream/2024-01-01',
            dynamodb: {
              ApproximateCreationDateTime: 1704067200,
              Keys: { pk: { S: 'USER#123' }, sk: { S: 'PROFILE' } },
              NewImage: { pk: { S: 'USER#123' }, name: { S: 'John' }, _et: { S: 'User' } },
              SequenceNumber: '123456',
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          },
        ],
      }

      const event = StreamProcessor.parseLambdaEvent(lambdaEvent)
      expect(event.records).toHaveLength(1)
      expect(event.records[0].eventType).toBe('INSERT')
      expect(event.records[0].keys.pk).toBe('USER#123')
      expect(event.records[0].keys.sk).toBe('PROFILE')
      expect(event.records[0].entityType).toBe('User')
      expect(event.records[0].eventId).toBe('evt-1')
      expect(event.sourceArn).toContain('Users')
    })

    it('should handle empty Lambda event', () => {
      const lambdaEvent = { Records: [] }
      const event = StreamProcessor.parseLambdaEvent(lambdaEvent)
      expect(event.records).toHaveLength(0)
    })

    it('should handle Lambda event without Records', () => {
      const lambdaEvent = {}
      const event = StreamProcessor.parseLambdaEvent(lambdaEvent)
      expect(event.records).toHaveLength(0)
    })

    it('should parse numeric keys', () => {
      const lambdaEvent = {
        Records: [
          {
            eventID: 'evt-1',
            eventName: 'INSERT',
            dynamodb: {
              Keys: { pk: { N: '12345' } },
              SequenceNumber: '1',
            },
          },
        ],
      }

      const event = StreamProcessor.parseLambdaEvent(lambdaEvent)
      expect(event.records[0].keys.pk).toBe('12345')
    })

    it('should extract entity type from old image when new image is missing', () => {
      const lambdaEvent = {
        Records: [
          {
            eventID: 'evt-1',
            eventName: 'REMOVE',
            dynamodb: {
              Keys: { pk: { S: 'USER#123' } },
              OldImage: { pk: { S: 'USER#123' }, _et: { S: 'User' } },
              SequenceNumber: '1',
            },
          },
        ],
      }

      const event = StreamProcessor.parseLambdaEvent(lambdaEvent)
      expect(event.records[0].entityType).toBe('User')
    })
  })

  describe('Change Data Capture (CDC)', () => {
    it('should extract CDC for INSERT event', () => {
      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123', sk: 'PROFILE' },
        newImage: { pk: 'USER#123', name: 'John', age: 30 },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.type).toBe('INSERT')
      expect(cdc.entityType).toBe('User')
      expect(cdc.pk).toBe('USER#123')
      expect(cdc.sk).toBe('PROFILE')
      expect(cdc.after).toEqual(record.newImage)
      expect(cdc.before).toBeUndefined()
      expect(cdc.changedAttributes).toBeUndefined()
    })

    it('should extract CDC for REMOVE event', () => {
      const record: StreamRecord = {
        eventType: 'REMOVE',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        oldImage: { pk: 'USER#123', name: 'John', age: 30 },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.type).toBe('REMOVE')
      expect(cdc.before).toEqual(record.oldImage)
      expect(cdc.after).toBeUndefined()
    })

    it('should extract CDC for MODIFY event with changed attributes', () => {
      const record: StreamRecord = {
        eventType: 'MODIFY',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        oldImage: { pk: 'USER#123', name: 'John', age: 30 },
        newImage: { pk: 'USER#123', name: 'John', age: 31 },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.type).toBe('MODIFY')
      expect(cdc.before).toEqual(record.oldImage)
      expect(cdc.after).toEqual(record.newImage)
      expect(cdc.changedAttributes).toContain('age')
      expect(cdc.changedAttributes).not.toContain('name')
      expect(cdc.oldValues).toEqual({ age: 30 })
      expect(cdc.newValues).toEqual({ age: 31 })
    })

    it('should detect added attributes in MODIFY', () => {
      const record: StreamRecord = {
        eventType: 'MODIFY',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        oldImage: { pk: 'USER#123', name: 'John' },
        newImage: { pk: 'USER#123', name: 'John', email: 'john@example.com' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.changedAttributes).toContain('email')
      expect(cdc.newValues?.email).toBe('john@example.com')
      expect(cdc.oldValues?.email).toBeUndefined()
    })

    it('should detect removed attributes in MODIFY', () => {
      const record: StreamRecord = {
        eventType: 'MODIFY',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        oldImage: { pk: 'USER#123', name: 'John', email: 'john@example.com' },
        newImage: { pk: 'USER#123', name: 'John' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.changedAttributes).toContain('email')
      expect(cdc.oldValues?.email).toBe('john@example.com')
      expect(cdc.newValues?.email).toBeUndefined()
    })

    it('should handle complex nested object changes', () => {
      const record: StreamRecord = {
        eventType: 'MODIFY',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        oldImage: { pk: 'USER#123', address: { city: 'NYC' } },
        newImage: { pk: 'USER#123', address: { city: 'LA' } },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.changedAttributes).toContain('address')
    })
  })

  describe('Entity Handler Execution', () => {
    it('should call onInsert for INSERT events', async () => {
      let insertCalled = false
      let modifyCalled = false
      let removeCalled = false

      const processor = createStreamProcessor()
      processor.addEntityHandler({
        entityType: 'User',
        onInsert: async () => { insertCalled = true },
        onModify: async () => { modifyCalled = true },
        onRemove: async () => { removeCalled = true },
      })

      await processor.processRecord({
        eventType: 'INSERT',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      expect(insertCalled).toBe(true)
      expect(modifyCalled).toBe(false)
      expect(removeCalled).toBe(false)
    })

    it('should call onModify for MODIFY events', async () => {
      let modifyCalled = false
      const processor = createStreamProcessor()
      processor.addEntityHandler({
        entityType: 'User',
        onModify: async () => { modifyCalled = true },
      })

      await processor.processRecord({
        eventType: 'MODIFY',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      expect(modifyCalled).toBe(true)
    })

    it('should call onRemove for REMOVE events', async () => {
      let removeCalled = false
      const processor = createStreamProcessor()
      processor.addEntityHandler({
        entityType: 'User',
        onRemove: async () => { removeCalled = true },
      })

      await processor.processRecord({
        eventType: 'REMOVE',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      expect(removeCalled).toBe(true)
    })

    it('should call onAny for all event types', async () => {
      let anyCalls = 0
      const processor = createStreamProcessor()
      processor.addEntityHandler({
        entityType: 'User',
        onAny: async () => { anyCalls++ },
      })

      await processor.processRecord({
        eventType: 'INSERT',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#1' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      await processor.processRecord({
        eventType: 'MODIFY',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#2' },
        timestamp: Date.now(),
        sequenceNumber: '2',
      })

      await processor.processRecord({
        eventType: 'REMOVE',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#3' },
        timestamp: Date.now(),
        sequenceNumber: '3',
      })

      expect(anyCalls).toBe(3)
    })

    it('should not call entity handler for unmatched entity type', async () => {
      let called = false
      const processor = createStreamProcessor()
      processor.addEntityHandler({
        entityType: 'Order',
        onInsert: async () => { called = true },
      })

      await processor.processRecord({
        eventType: 'INSERT',
        tableName: 'Users',
        entityType: 'User',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      expect(called).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle record without entity type', async () => {
      let processed = false
      const processor = createStreamProcessor()
      processor.addHandler(async () => { processed = true })

      await processor.processRecord({
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      expect(processed).toBe(true)
    })

    it('should handle record without sort key', async () => {
      let receivedKeys: { pk: string, sk?: string } | null = null
      const processor = createStreamProcessor()
      processor.addHandler(async (record) => {
        receivedKeys = record.keys
      })

      await processor.processRecord({
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      const keys = receivedKeys as { pk: string, sk?: string } | null
      expect(keys?.pk).toBe('USER#123')
      expect(keys?.sk).toBeUndefined()
    })

    it('should handle empty newImage and oldImage', () => {
      const record: StreamRecord = {
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.after).toBeUndefined()
      expect(cdc.before).toBeUndefined()
    })

    it('should handle MODIFY without images', () => {
      const record: StreamRecord = {
        eventType: 'MODIFY',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      }

      const cdc = StreamProcessor.extractCDC(record)
      expect(cdc.changedAttributes).toBeUndefined()
    })

    it('should handle multiple handlers with different return types', async () => {
      let syncHandlerCalled = false
      let asyncHandlerCalled = false

      const processor = createStreamProcessor()
      processor.addHandler(() => { syncHandlerCalled = true })
      processor.addHandler(async () => { asyncHandlerCalled = true })

      await processor.processRecord({
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      expect(syncHandlerCalled).toBe(true)
      expect(asyncHandlerCalled).toBe(true)
    })

    it('should handle processing time stats edge case with disabled metrics', async () => {
      const processor = createStreamProcessor({ metrics: false })
      processor.addHandler(async () => {})

      await processor.processRecord({
        eventType: 'INSERT',
        tableName: 'Users',
        keys: { pk: 'USER#123' },
        timestamp: Date.now(),
        sequenceNumber: '1',
      })

      const stats = processor.getStats()
      expect(stats.totalProcessed).toBe(0) // Not tracked when metrics disabled
    })
  })
})
