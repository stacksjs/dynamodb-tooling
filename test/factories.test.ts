import { describe, expect, it } from 'bun:test'
import {
  Factory,
  randomBool,
  randomElement,
  randomInt,
  uniqueEmail,
  uniqueUsername,
} from '../src/factories'

describe('Factory System', () => {
  describe('Factory Definition', () => {
    it('should define and retrieve a factory', () => {
      Factory.define('TestUser', {
        entityType: 'TEST_USER',
        definition: () => ({
          id: crypto.randomUUID(),
          name: 'Test User',
        }),
      })

      expect(Factory.has('TestUser')).toBe(true)
    })

    it('should list factory names', () => {
      Factory.define('TestPost', {
        entityType: 'TEST_POST',
        definition: () => ({
          id: crypto.randomUUID(),
          title: 'Test Post',
        }),
      })

      const names = Factory.names()
      expect(names).toContain('TestUser')
      expect(names).toContain('TestPost')
    })
  })

  describe('Factory Builder', () => {
    it('should make items without persisting', () => {
      Factory.define('MakeTest', {
        entityType: 'MAKE_TEST',
        definition: () => ({
          id: crypto.randomUUID(),
          value: 'test',
        }),
      })

      const items = Factory.for<{ id: string, value: string }>('MakeTest')
        .count(3)
        .make()

      expect(items).toHaveLength(3)
      expect(items[0].id).toBeDefined()
      expect(items[0].value).toBe('test')
    })

    it('should make a single item with makeOne', () => {
      Factory.define('MakeOneTest', {
        entityType: 'MAKE_ONE_TEST',
        definition: () => ({
          id: crypto.randomUUID(),
          value: 'single',
        }),
      })

      const item = Factory.for<{ id: string, value: string }>('MakeOneTest').makeOne()

      expect(item.id).toBeDefined()
      expect(item.value).toBe('single')
    })

    it('should apply states', () => {
      Factory.define('StateTest', {
        entityType: 'STATE_TEST',
        definition: () => ({
          id: crypto.randomUUID(),
          status: 'active',
          role: 'user',
        }),
        states: {
          inactive: { status: 'inactive' },
          admin: { role: 'admin' },
        },
      })

      const item = Factory.for<{ id: string, status: string, role: string }>('StateTest')
        .state('inactive')
        .state('admin')
        .makeOne()

      expect(item.status).toBe('inactive')
      expect(item.role).toBe('admin')
    })

    it('should apply overrides', () => {
      Factory.define('OverrideTest', {
        entityType: 'OVERRIDE_TEST',
        definition: () => ({
          id: crypto.randomUUID(),
          name: 'Default Name',
        }),
      })

      const item = Factory.for<{ id: string, name: string }>('OverrideTest')
        .override({ name: 'Custom Name' })
        .makeOne()

      expect(item.name).toBe('Custom Name')
    })

    it('should apply sequence for unique values', () => {
      Factory.define('SequenceTest', {
        entityType: 'SEQUENCE_TEST',
        definition: () => ({
          id: crypto.randomUUID(),
          order: 0,
        }),
      })

      const items = Factory.for<{ id: string, order: number }>('SequenceTest')
        .sequence('order', index => index + 1)
        .count(5)
        .make()

      expect(items[0].order).toBe(1)
      expect(items[1].order).toBe(2)
      expect(items[4].order).toBe(5)
    })

    it('should get raw attributes', () => {
      Factory.define('RawTest', {
        entityType: 'RAW_TEST',
        definition: () => ({
          id: crypto.randomUUID(),
          data: 'raw',
        }),
      })

      const raw = Factory.for<{ id: string, data: string }>('RawTest')
        .count(2)
        .raw()

      expect(raw).toHaveLength(2)
      expect(raw[0].data).toBe('raw')
    })
  })

  describe('Helper Functions', () => {
    describe('uniqueEmail', () => {
      it('should generate unique emails', () => {
        const email1 = uniqueEmail()
        const email2 = uniqueEmail()

        expect(email1).toContain('@')
        expect(email1).toContain('example.com')
        expect(email1).not.toBe(email2)
      })

      it('should use custom domain', () => {
        const email = uniqueEmail('test.org')
        expect(email).toContain('@test.org')
      })
    })

    describe('uniqueUsername', () => {
      it('should generate unique usernames', () => {
        const username1 = uniqueUsername()
        const username2 = uniqueUsername()

        expect(username1).toContain('user')
        expect(username1).not.toBe(username2)
      })

      it('should use custom prefix', () => {
        const username = uniqueUsername('admin')
        expect(username).toContain('admin')
      })
    })

    describe('randomInt', () => {
      it('should generate random integers in range', () => {
        for (let i = 0; i < 100; i++) {
          const value = randomInt(1, 10)
          expect(value).toBeGreaterThanOrEqual(1)
          expect(value).toBeLessThanOrEqual(10)
        }
      })
    })

    describe('randomElement', () => {
      it('should pick random element from array', () => {
        const array = ['a', 'b', 'c']
        const element = randomElement(array)
        expect(array).toContain(element)
      })
    })

    describe('randomBool', () => {
      it('should return boolean', () => {
        const value = randomBool()
        expect(typeof value).toBe('boolean')
      })

      it('should respect probability', () => {
        // With probability 0, should always be false
        expect(randomBool(0)).toBe(false)

        // With probability 1, should always be true
        expect(randomBool(1)).toBe(true)
      })
    })
  })
})
