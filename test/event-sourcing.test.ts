import type { DomainEvent } from '../src'
import { describe, expect, it } from 'bun:test'
import {
  AggregateRoot,
  createEventStore,
  EventStore,
} from '../src'

describe('EventStore', () => {
  describe('creation', () => {
    it('should create an event store', () => {
      const store = createEventStore({ tableName: 'Events' })
      expect(store).toBeInstanceOf(EventStore)
    })

    it('should create store with custom options', () => {
      const store = createEventStore({
        tableName: 'Events',
        snapshotFrequency: 10,
        eventTTL: 86400,
      })
      expect(store).toBeInstanceOf(EventStore)
    })

    it('should create store with partition strategy', () => {
      const store = createEventStore({
        tableName: 'Events',
        partitionStrategy: 'aggregate',
      })
      expect(store).toBeInstanceOf(EventStore)
    })
  })

  describe('append event', () => {
    it('should generate append event command', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserCreated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 1,
        data: { name: 'John' },
      })

      expect(command.command).toBe('PutItem')
      expect(command.input.TableName).toBe('Events')
      expect(command.input.Item.eventType.S).toBe('UserCreated')
    })

    it('should include aggregate information', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserCreated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 1,
        data: {},
      })

      expect(command.input.Item.aggregateId.S).toBe('123')
      expect(command.input.Item.aggregateType.S).toBe('User')
    })

    it('should include version', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserUpdated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 5,
        data: { name: 'Jane' },
      })

      expect(command.input.Item.version.N).toBe('5')
    })

    it('should include event data', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserCreated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 1,
        data: { name: 'John', email: 'john@test.com' },
      })

      const dataString = command.input.Item.data.S
      const data = JSON.parse(dataString)
      expect(data.name).toBe('John')
      expect(data.email).toBe('john@test.com')
    })

    it('should include timestamp', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserCreated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 1,
        data: {},
      })

      expect(command.input.Item.timestamp.S).toBeDefined()
    })

    it('should include event ID', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserCreated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 1,
        data: {},
      })

      expect(command.input.Item.eventId.S).toBeDefined()
    })

    it('should generate unique event IDs', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command1 = store.appendEvent({
        eventType: 'Event1',
        aggregateId: '123',
        aggregateType: 'Test',
        version: 1,
        data: {},
      })

      const command2 = store.appendEvent({
        eventType: 'Event2',
        aggregateId: '123',
        aggregateType: 'Test',
        version: 2,
        data: {},
      })

      expect(command1.input.Item.eventId.S).not.toBe(command2.input.Item.eventId.S)
    })

    it('should include metadata if provided', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserCreated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 1,
        data: {},
        metadata: { correlationId: 'corr-123', causationId: 'cause-456' },
      })

      expect(command.input.Item.metadata).toBeDefined()
    })
  })

  describe('get events', () => {
    it('should generate get events command', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.getEventsCommand('User', '123')

      expect(command.command).toBe('Query')
      expect(command.input.TableName).toBe('Events')
    })

    it('should query by aggregate', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.getEventsCommand('User', '123')

      expect(command.input.KeyConditionExpression).toContain('pk')
    })

    it('should support version range', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.getEventsCommand('User', '123', {
        fromVersion: 5,
        toVersion: 10,
      })

      expect(command.input.KeyConditionExpression).toContain('sk')
    })

    it('should support limit', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.getEventsCommand('User', '123', { limit: 100 })

      expect(command.input.Limit).toBe(100)
    })

    it('should support ascending/descending order', () => {
      const store = createEventStore({ tableName: 'Events' })

      const ascCommand = store.getEventsCommand('User', '123', { ascending: true })
      const descCommand = store.getEventsCommand('User', '123', { ascending: false })

      expect(ascCommand.input.ScanIndexForward).toBe(true)
      expect(descCommand.input.ScanIndexForward).toBe(false)
    })
  })

  describe('parse events', () => {
    it('should parse events from DynamoDB response', () => {
      const store = createEventStore({ tableName: 'Events' })

      const items = [
        {
          pk: { S: 'AGG#User#123' },
          sk: { S: 'EVENT#0000000001' },
          eventId: { S: 'evt-1' },
          eventType: { S: 'UserCreated' },
          aggregateId: { S: '123' },
          aggregateType: { S: 'User' },
          version: { N: '1' },
          data: { S: '{"name":"John"}' },
          timestamp: { S: '2024-01-01T00:00:00.000Z' },
        },
      ]

      const events = store.parseEvents(items)
      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('UserCreated')
      expect(events[0].data).toEqual({ name: 'John' })
    })

    it('should parse multiple events', () => {
      const store = createEventStore({ tableName: 'Events' })

      const items = [
        {
          pk: { S: 'AGG#User#123' },
          sk: { S: 'EVENT#0000000001' },
          eventId: { S: 'evt-1' },
          eventType: { S: 'UserCreated' },
          aggregateId: { S: '123' },
          aggregateType: { S: 'User' },
          version: { N: '1' },
          data: { S: '{}' },
          timestamp: { S: '2024-01-01T00:00:00.000Z' },
        },
        {
          pk: { S: 'AGG#User#123' },
          sk: { S: 'EVENT#0000000002' },
          eventId: { S: 'evt-2' },
          eventType: { S: 'UserUpdated' },
          aggregateId: { S: '123' },
          aggregateType: { S: 'User' },
          version: { N: '2' },
          data: { S: '{}' },
          timestamp: { S: '2024-01-01T01:00:00.000Z' },
        },
      ]

      const events = store.parseEvents(items)
      expect(events).toHaveLength(2)
      expect(events[0].version).toBe(1)
      expect(events[1].version).toBe(2)
    })

    it('should parse event metadata', () => {
      const store = createEventStore({ tableName: 'Events' })

      const items = [
        {
          pk: { S: 'AGG#User#123' },
          sk: { S: 'EVENT#0000000001' },
          eventId: { S: 'evt-1' },
          eventType: { S: 'UserCreated' },
          aggregateId: { S: '123' },
          aggregateType: { S: 'User' },
          version: { N: '1' },
          data: { S: '{}' },
          timestamp: { S: '2024-01-01T00:00:00.000Z' },
          metadata: { S: '{"correlationId":"corr-123"}' },
        },
      ]

      const events = store.parseEvents(items)
      expect(events[0].metadata?.correlationId).toBe('corr-123')
    })

    it('should handle empty items array', () => {
      const store = createEventStore({ tableName: 'Events' })

      const events = store.parseEvents([])
      expect(events).toHaveLength(0)
    })
  })

  describe('snapshots', () => {
    it('should check snapshot frequency', () => {
      const store = createEventStore({
        tableName: 'Events',
        snapshotFrequency: 10,
      })

      expect(store.shouldSnapshot(10)).toBe(true)
      expect(store.shouldSnapshot(20)).toBe(true)
      expect(store.shouldSnapshot(15)).toBe(false)
    })

    it('should handle default snapshot frequency', () => {
      const store = createEventStore({ tableName: 'Events' })

      // Default should be reasonable (e.g., every 100 events)
      expect(store.shouldSnapshot(100)).toBe(true)
    })

    it('should generate save snapshot command', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.saveSnapshotCommand({
        aggregateType: 'User',
        aggregateId: '123',
        version: 10,
        state: { name: 'John', age: 30 },
      })

      expect(command.command).toBe('PutItem')
      expect((command.input.Item.version as { N: string }).N).toBe('10')
    })

    it('should generate get snapshot command', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.getSnapshotCommand('User', '123')

      expect(command.command).toBe('Query')
    })

    it('should parse snapshot', () => {
      const store = createEventStore({ tableName: 'Events' })

      const item = {
        pk: { S: 'SNAPSHOT#User#123' },
        aggregateId: { S: '123' },
        aggregateType: { S: 'User' },
        version: { N: '10' },
        state: { S: '{"name":"John","age":30}' },
        timestamp: { S: '2024-01-01T00:00:00.000Z' },
      }

      const snapshot = store.parseSnapshot<{ name: string, age: number }>(item)
      expect(snapshot?.version).toBe(10)
      expect(snapshot?.state.name).toBe('John')
    })
  })

  describe('optimistic concurrency', () => {
    it('should include condition expression for version', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEvent({
        eventType: 'UserUpdated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 5,
        data: {},
      })

      expect(command.input.ConditionExpression).toBeDefined()
    })

    it('should support optimistic locking', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.appendEventWithLock({
        eventType: 'UserUpdated',
        aggregateId: '123',
        aggregateType: 'User',
        version: 5,
        data: {},
      }, 4) // expectedVersion as second argument

      expect(command.input.ConditionExpression).toContain('attribute_not_exists')
    })
  })

  describe('event stream projections', () => {
    it('should generate projection query', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.createProjectionQuery('User', {
        eventTypes: ['UserCreated', 'UserUpdated'],
        fromTimestamp: new Date('2024-01-01T00:00:00.000Z'),
      })

      expect(command.command).toBe('Scan')
    })

    it('should filter by event type', () => {
      const store = createEventStore({ tableName: 'Events' })

      const command = store.createProjectionQuery('User', {
        eventTypes: ['UserCreated'],
      })

      expect(command.input.FilterExpression).toContain('eventType')
    })
  })
})

describe('AggregateRoot', () => {
  describe('creation', () => {
    it('should create an aggregate root', () => {
      class UserAggregate extends AggregateRoot {
        name = ''

        apply(event: any) {
          if (event.eventType === 'UserCreated') {
            this.name = event.data.name
          }
        }
      }

      const user = new UserAggregate('user-123')
      expect(user.id).toBe('user-123')
    })

    it('should initialize with version 0', () => {
      class TestAggregate extends AggregateRoot {
        apply() {}
      }

      const agg = new TestAggregate('123')
      expect(agg.version).toBe(0)
    })

    it('should start with empty uncommitted events', () => {
      class TestAggregate extends AggregateRoot {
        apply() {}
      }

      const agg = new TestAggregate('123')
      expect(agg.getUncommittedEvents()).toHaveLength(0)
    })
  })

  describe('event application', () => {
    it('should apply events and update state', () => {
      class UserAggregate extends AggregateRoot {
        name = ''
        email = ''

        apply(event: any) {
          switch (event.eventType) {
            case 'UserCreated':
              this.name = event.data.name
              this.email = event.data.email
              break
            case 'NameChanged':
              this.name = event.data.newName
              break
          }
        }
      }

      const user = new UserAggregate('user-123')
      user.loadFromHistory([
        { eventType: 'UserCreated', data: { name: 'John', email: 'john@test.com' }, version: 1 },
        { eventType: 'NameChanged', data: { newName: 'Jane' }, version: 2 },
      ] as unknown as DomainEvent[])

      expect(user.name).toBe('Jane')
      expect(user.email).toBe('john@test.com')
      expect(user.version).toBe(2)
    })

    it('should update version after applying events', () => {
      class TestAggregate extends AggregateRoot {
        apply() {}
      }

      const agg = new TestAggregate('123')
      agg.loadFromHistory([
        { eventType: 'Event1', data: {}, version: 1 },
        { eventType: 'Event2', data: {}, version: 2 },
        { eventType: 'Event3', data: {}, version: 3 },
      ] as unknown as DomainEvent[])

      expect(agg.version).toBe(3)
    })

    it('should handle empty event history', () => {
      class TestAggregate extends AggregateRoot {
        apply() {}
      }

      const agg = new TestAggregate('123')
      agg.loadFromHistory([])

      expect(agg.version).toBe(0)
    })
  })

  describe('raising events', () => {
    it('should raise new events', () => {
      class UserAggregate extends AggregateRoot {
        name = ''

        apply(event: any) {
          if (event.eventType === 'UserCreated') {
            this.name = event.data.name
          }
        }

        create(name: string) {
          this.raiseEvent('UserCreated', { name })
        }
      }

      const user = new UserAggregate('user-123')
      user.create('John')

      expect(user.name).toBe('John')
      expect(user.getUncommittedEvents()).toHaveLength(1)
    })

    it('should increment version when raising events', () => {
      class TestAggregate extends AggregateRoot {
        apply() {}

        doSomething() {
          this.raiseEvent('SomethingDone', {})
        }
      }

      const agg = new TestAggregate('123')
      agg.doSomething()
      agg.doSomething()

      expect(agg.version).toBe(2)
    })

    it('should track uncommitted events', () => {
      class TestAggregate extends AggregateRoot {
        apply() {}

        doSomething() {
          this.raiseEvent('SomethingDone', {})
        }
      }

      const agg = new TestAggregate('123')
      agg.doSomething()
      agg.doSomething()
      agg.doSomething()

      expect(agg.getUncommittedEvents()).toHaveLength(3)
    })

    it('should clear uncommitted events after marking committed', () => {
      class TestAggregate extends AggregateRoot {
        apply() {}

        doSomething() {
          this.raiseEvent('SomethingDone', {})
        }
      }

      const agg = new TestAggregate('123')
      agg.doSomething()
      agg.markChangesAsCommitted()

      expect(agg.getUncommittedEvents()).toHaveLength(0)
    })
  })

  describe('snapshots', () => {
    it('should create snapshot of current state', () => {
      class UserAggregate extends AggregateRoot {
        name = ''
        email = ''

        apply(event: any) {
          if (event.eventType === 'UserCreated') {
            this.name = event.data.name
            this.email = event.data.email
          }
        }

        getState() {
          return { name: this.name, email: this.email }
        }
      }

      const user = new UserAggregate('user-123')
      user.loadFromHistory([
        { eventType: 'UserCreated', data: { name: 'John', email: 'john@test.com' }, version: 1 },
      ] as unknown as DomainEvent[])

      const snapshot = user.createSnapshot()
      expect(snapshot.version).toBe(1)
      expect((snapshot.state as { name: string }).name).toBe('John')
    })

    it('should restore from snapshot', () => {
      class UserAggregate extends AggregateRoot {
        name = ''
        email = ''

        apply(event: any) {
          if (event.eventType === 'NameChanged') {
            this.name = event.data.newName
          }
        }

        restoreFromSnapshot(snapshot: any) {
          this.name = snapshot.state.name
          this.email = snapshot.state.email
          this.version = snapshot.version
        }
      }

      const user = new UserAggregate('user-123')
      user.restoreFromSnapshot({
        version: 10,
        state: { name: 'John', email: 'john@test.com' },
      })

      expect(user.version).toBe(10)
      expect(user.name).toBe('John')
    })

    it('should apply events after snapshot', () => {
      class UserAggregate extends AggregateRoot {
        name = ''
        email = ''

        apply(event: any) {
          if (event.eventType === 'NameChanged') {
            this.name = event.data.newName
          }
        }

        restoreFromSnapshot(snapshot: any) {
          this.name = snapshot.state.name
          this.email = snapshot.state.email
          this.version = snapshot.version
        }
      }

      const user = new UserAggregate('user-123')
      user.restoreFromSnapshot({
        version: 10,
        state: { name: 'John', email: 'john@test.com' },
      })
      user.loadFromHistory([
        { eventType: 'NameChanged', data: { newName: 'Jane' }, version: 11 },
      ] as unknown as DomainEvent[])

      expect(user.version).toBe(11)
      expect(user.name).toBe('Jane')
    })
  })

  describe('validation', () => {
    it('should validate before raising events', () => {
      class BankAccount extends AggregateRoot {
        balance = 0

        apply(event: any) {
          switch (event.eventType) {
            case 'Deposited':
              this.balance += event.data.amount
              break
            case 'Withdrawn':
              this.balance -= event.data.amount
              break
          }
        }

        deposit(amount: number) {
          if (amount <= 0)
            throw new Error('Amount must be positive')
          this.raiseEvent('Deposited', { amount })
        }

        withdraw(amount: number) {
          if (amount <= 0)
            throw new Error('Amount must be positive')
          if (amount > this.balance)
            throw new Error('Insufficient funds')
          this.raiseEvent('Withdrawn', { amount })
        }
      }

      const account = new BankAccount('acc-123')
      account.deposit(100)

      expect(() => account.withdraw(150)).toThrow('Insufficient funds')
      expect(account.balance).toBe(100)
    })
  })
})

describe('edge cases', () => {
  it('should handle events with complex nested data', () => {
    const store = createEventStore({ tableName: 'Events' })

    const command = store.appendEvent({
      eventType: 'ComplexEvent',
      aggregateId: '123',
      aggregateType: 'Test',
      version: 1,
      data: {
        nested: {
          deeply: {
            value: [1, 2, 3],
          },
        },
      },
    })

    const parsed = JSON.parse(command.input.Item.data.S)
    expect(parsed.nested.deeply.value).toEqual([1, 2, 3])
  })

  it('should handle very large version numbers', () => {
    const store = createEventStore({ tableName: 'Events' })

    const command = store.appendEvent({
      eventType: 'Event',
      aggregateId: '123',
      aggregateType: 'Test',
      version: 999999999,
      data: {},
    })

    expect(command.input.Item.version.N).toBe('999999999')
  })

  it('should handle unicode in event data', () => {
    const store = createEventStore({ tableName: 'Events' })

    const command = store.appendEvent({
      eventType: 'Event',
      aggregateId: '123',
      aggregateType: 'Test',
      version: 1,
      data: { message: '你好世界 👋' },
    })

    const parsed = JSON.parse(command.input.Item.data.S)
    expect(parsed.message).toBe('你好世界 👋')
  })

  it('should handle empty event data', () => {
    const store = createEventStore({ tableName: 'Events' })

    const command = store.appendEvent({
      eventType: 'EmptyEvent',
      aggregateId: '123',
      aggregateType: 'Test',
      version: 1,
      data: {},
    })

    expect(command.input.Item.data.S).toBe('{}')
  })

  it('should handle null values in event data', () => {
    const store = createEventStore({ tableName: 'Events' })

    const command = store.appendEvent({
      eventType: 'Event',
      aggregateId: '123',
      aggregateType: 'Test',
      version: 1,
      data: { nullValue: null },
    })

    const parsed = JSON.parse(command.input.Item.data.S)
    expect(parsed.nullValue).toBeNull()
  })
})
