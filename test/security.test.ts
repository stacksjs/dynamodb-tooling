import { describe, expect, it, beforeEach } from 'bun:test'
import {
  EncryptionManager,
  createEncryptionManager,
  AccessControlManager,
  createAccessControlManager,
  AuditLogger,
  createAuditLogger,
  InMemoryAuditStorage,
} from '../src/security'

describe('Security', () => {
  describe('Encryption', () => {
    const masterKey = Buffer.alloc(32, 'a').toString('base64')

    describe('EncryptionManager Creation', () => {
      it('should create an encryption manager', () => {
        const manager = createEncryptionManager({ masterKey })
        expect(manager).toBeInstanceOf(EncryptionManager)
      })

      it('should generate a valid key', () => {
        const key = EncryptionManager.generateKeyBase64()
        expect(key).toBeDefined()
        expect(typeof key).toBe('string')
        expect(key.length).toBeGreaterThan(40)
      })

      it('should generate unique keys', () => {
        const key1 = EncryptionManager.generateKeyBase64()
        const key2 = EncryptionManager.generateKeyBase64()
        expect(key1).not.toBe(key2)
      })
    })

    describe('Encryption and Decryption', () => {
      let manager: EncryptionManager

      beforeEach(() => {
        manager = createEncryptionManager({ masterKey })
      })

      it('should encrypt and decrypt a string', () => {
        const plaintext = 'sensitive-data'
        const encrypted = manager.encrypt(plaintext)
        const decrypted = manager.decrypt(encrypted)

        expect(decrypted).toBe(plaintext)
      })

      it('should produce different ciphertext for same plaintext', () => {
        const plaintext = 'test'
        const encrypted1 = manager.encrypt(plaintext)
        const encrypted2 = manager.encrypt(plaintext)

        // Due to random IV, ciphertexts should differ
        expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
      })

      it('should encrypt empty string', () => {
        const encrypted = manager.encrypt('')
        const decrypted = manager.decrypt(encrypted)
        expect(decrypted).toBe('')
      })

      it('should encrypt long strings', () => {
        const plaintext = 'a'.repeat(10000)
        const encrypted = manager.encrypt(plaintext)
        const decrypted = manager.decrypt(encrypted)
        expect(decrypted).toBe(plaintext)
      })

      it('should encrypt unicode strings', () => {
        const plaintext = '你好世界 🔐 Привет'
        const encrypted = manager.encrypt(plaintext)
        const decrypted = manager.decrypt(encrypted)
        expect(decrypted).toBe(plaintext)
      })

      it('should encrypt special characters', () => {
        const plaintext = '!@#$%^&*()_+-=[]{}|;:",.<>?/\\'
        const encrypted = manager.encrypt(plaintext)
        const decrypted = manager.decrypt(encrypted)
        expect(decrypted).toBe(plaintext)
      })

      it('should include metadata in encryption result', () => {
        const encrypted = manager.encrypt('test')
        expect(encrypted.ciphertext).toBeDefined()
        expect(encrypted.metadata).toBeDefined()
        expect(encrypted.metadata.iv).toBeDefined()
        expect(encrypted.metadata.authTag).toBeDefined()
      })

      it('should not expose plaintext in encrypted result', () => {
        const plaintext = 'secret-password'
        const encrypted = manager.encrypt(plaintext)

        expect(encrypted.ciphertext).not.toContain(plaintext)
        expect(encrypted.metadata.iv).not.toContain(plaintext)
      })
    })

    describe('Encryption Edge Cases', () => {
      let manager: EncryptionManager

      beforeEach(() => {
        manager = createEncryptionManager({ masterKey })
      })

      it('should handle JSON strings', () => {
        const json = JSON.stringify({ secret: 'value', nested: { data: [1, 2, 3] } })
        const encrypted = manager.encrypt(json)
        const decrypted = manager.decrypt(encrypted) as string
        expect(JSON.parse(decrypted)).toEqual(JSON.parse(json))
      })

      it('should handle newlines in plaintext', () => {
        const plaintext = 'line1\nline2\nline3'
        const encrypted = manager.encrypt(plaintext)
        const decrypted = manager.decrypt(encrypted)
        expect(decrypted).toBe(plaintext)
      })

      it('should handle null bytes in plaintext', () => {
        const plaintext = 'before\x00after'
        const encrypted = manager.encrypt(plaintext)
        const decrypted = manager.decrypt(encrypted)
        expect(decrypted).toBe(plaintext)
      })
    })
  })

  describe('Access Control', () => {
    describe('AccessControlManager Creation', () => {
      it('should create an access control manager', () => {
        const manager = createAccessControlManager()
        expect(manager).toBeInstanceOf(AccessControlManager)
      })
    })

    describe('Role Management', () => {
      let manager: AccessControlManager

      beforeEach(() => {
        manager = createAccessControlManager()
      })

      it('should register a role', () => {
        manager.registerRole({
          id: 'admin',
          name: 'Administrator',
          permissions: [
            {
              id: 'admin-all',
              actions: ['*'],
              resources: [{ table: '*' }],
              effect: 'allow',
            },
          ],
        })

        const role = manager.getRole('admin')
        expect(role).toBeDefined()
        expect(role?.name).toBe('Administrator')
      })

      it('should register multiple roles', () => {
        manager.registerRole({
          id: 'admin',
          name: 'Admin',
          permissions: [{ id: 'p1', actions: ['*'], resources: [{ table: '*' }], effect: 'allow' }],
        })
        manager.registerRole({
          id: 'user',
          name: 'User',
          permissions: [{ id: 'p2', actions: ['read'], resources: [{ table: '*' }], effect: 'allow' }],
        })

        expect(manager.getRole('admin')).toBeDefined()
        expect(manager.getRole('user')).toBeDefined()
      })

      it('should update existing role', () => {
        manager.registerRole({
          id: 'test',
          name: 'Original',
          permissions: [],
        })
        manager.registerRole({
          id: 'test',
          name: 'Updated',
          permissions: [],
        })

        const role = manager.getRole('test')
        expect(role?.name).toBe('Updated')
      })

      it('should return undefined for non-existent role', () => {
        const role = manager.getRole('nonexistent')
        expect(role).toBeUndefined()
      })
    })

    describe('Permission Checking', () => {
      let manager: AccessControlManager

      beforeEach(() => {
        manager = createAccessControlManager()
        manager.registerRole({
          id: 'reader',
          name: 'Reader',
          permissions: [
            {
              id: 'read-all',
              actions: ['read', 'query'],
              resources: [{ table: '*' }],
              effect: 'allow',
            },
          ],
        })
        manager.registerRole({
          id: 'writer',
          name: 'Writer',
          permissions: [
            {
              id: 'write-users',
              actions: ['write', 'create', 'update', 'delete'],
              resources: [{ table: 'users' }],
              effect: 'allow',
            },
          ],
        })
      })

      it('should allow permitted action', () => {
        const result = manager.checkAccess(
          'read',
          { table: 'users' },
          { roles: ['reader'] },
        )
        expect(result.allowed).toBe(true)
      })

      it('should deny unpermitted action', () => {
        const result = manager.checkAccess(
          'delete',
          { table: 'users' },
          { roles: ['reader'] },
        )
        expect(result.allowed).toBe(false)
      })

      it('should check table-specific permissions', () => {
        const usersResult = manager.checkAccess(
          'write',
          { table: 'users' },
          { roles: ['writer'] },
        )
        expect(usersResult.allowed).toBe(true)

        const ordersResult = manager.checkAccess(
          'write',
          { table: 'orders' },
          { roles: ['writer'] },
        )
        expect(ordersResult.allowed).toBe(false)
      })

      it('should handle multiple roles', () => {
        const result = manager.checkAccess(
          'write',
          { table: 'users' },
          { roles: ['reader', 'writer'] },
        )
        expect(result.allowed).toBe(true)
      })

      it('should handle wildcard action', () => {
        manager.registerRole({
          id: 'superadmin',
          name: 'Super Admin',
          permissions: [
            {
              id: 'super-all',
              actions: ['*'],
              resources: [{ table: '*' }],
              effect: 'allow',
            },
          ],
        })

        const result = manager.checkAccess(
          'read', // Wildcard action should match any valid action
          { table: 'any-table' },
          { roles: ['superadmin'] },
        )
        expect(result.allowed).toBe(true)
      })

      it('should handle no roles', () => {
        const result = manager.checkAccess(
          'read',
          { table: 'users' },
          { roles: [] },
        )
        expect(result.allowed).toBe(false)
      })
    })

    describe('Deny Permissions', () => {
      let manager: AccessControlManager

      beforeEach(() => {
        manager = createAccessControlManager()
      })

      it('should deny with explicit deny effect', () => {
        manager.registerRole({
          id: 'limited',
          name: 'Limited',
          permissions: [
            {
              id: 'allow-read',
              actions: ['read'],
              resources: [{ table: '*' }],
              effect: 'allow',
            },
            {
              id: 'deny-secrets',
              actions: ['read'],
              resources: [{ table: 'secrets' }],
              effect: 'deny',
            },
          ],
        })

        const usersResult = manager.checkAccess(
          'read',
          { table: 'users' },
          { roles: ['limited'] },
        )
        expect(usersResult.allowed).toBe(true)

        const secretsResult = manager.checkAccess(
          'read',
          { table: 'secrets' },
          { roles: ['limited'] },
        )
        expect(secretsResult.allowed).toBe(false)
      })
    })
  })

  describe('Audit Logging', () => {
    describe('AuditLogger Creation', () => {
      it('should create an audit logger', () => {
        const logger = createAuditLogger({
          enabled: true,
          storage: [new InMemoryAuditStorage()],
        })
        expect(logger).toBeInstanceOf(AuditLogger)
      })

      it('should create with multiple storage backends', () => {
        const storage1 = new InMemoryAuditStorage()
        const storage2 = new InMemoryAuditStorage()
        const logger = createAuditLogger({
          enabled: true,
          storage: [storage1, storage2],
        })
        expect(logger).toBeInstanceOf(AuditLogger)
      })
    })

    describe('Audit Event Logging', () => {
      let logger: AuditLogger
      let storage: InMemoryAuditStorage

      beforeEach(() => {
        storage = new InMemoryAuditStorage()
        logger = createAuditLogger({
          enabled: true,
          storage: [storage],
          async: false,
        })
      })

      it('should log audit events', async () => {
        await logger.log({
          type: 'READ',
          status: 'SUCCESS',
          actor: { userId: 'user-123' },
          target: { tableName: 'users', pk: 'USER#123' },
          operation: { name: 'GetItem' },
        })

        const events = await storage.query({})
        expect(events.events.length).toBeGreaterThan(0)
      })

      it('should log READ events', async () => {
        await logger.log({
          type: 'READ',
          status: 'SUCCESS',
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'Query' },
        })

        const events = await storage.query({})
        expect(events.events[0].type).toBe('READ')
      })

      it('should log CREATE events', async () => {
        await logger.create(
          'users',
          { pk: 'USER#123', name: 'John' },
          { userId: 'admin' },
        )

        const events = await storage.query({})
        expect(events.events[0].type).toBe('CREATE')
      })

      it('should log UPDATE events', async () => {
        await logger.update(
          'users',
          { pk: 'USER#123' },
          { name: 'Jane' },
          { userId: 'admin' },
        )

        const events = await storage.query({})
        expect(events.events[0].type).toBe('UPDATE')
      })

      it('should log DELETE events', async () => {
        await logger.delete(
          'users',
          { pk: 'USER#123' },
          { userId: 'admin' },
        )

        const events = await storage.query({})
        expect(events.events[0].type).toBe('DELETE')
      })

      it('should capture timestamp', async () => {
        const before = Date.now()
        await logger.log({
          type: 'READ',
          status: 'SUCCESS',
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })
        const after = Date.now()

        const events = await storage.query({})
        const eventTime = events.events[0].timestamp.getTime()
        expect(eventTime).toBeGreaterThanOrEqual(before)
        expect(eventTime).toBeLessThanOrEqual(after)
      })

      it('should capture actor information', async () => {
        await logger.log({
          type: 'READ',
          status: 'SUCCESS',
          actor: { userId: 'user-456', ipAddress: '192.168.1.1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })

        const events = await storage.query({})
        expect(events.events[0].actor.userId).toBe('user-456')
      })
    })

    describe('InMemory Audit Storage', () => {
      let storage: InMemoryAuditStorage

      beforeEach(() => {
        storage = new InMemoryAuditStorage()
      })

      it('should store and retrieve events', async () => {
        await storage.store({
          id: '1',
          type: 'READ',
          status: 'SUCCESS',
          timestamp: new Date(),
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })

        const result = await storage.query({})
        expect(result.events).toHaveLength(1)
      })

      it('should store multiple events', async () => {
        for (let i = 0; i < 5; i++) {
          await storage.store({
            id: String(i),
            type: 'READ',
            status: 'SUCCESS',
            timestamp: new Date(),
            actor: { userId: 'user-1' },
            target: { tableName: 'users' },
            operation: { name: 'GetItem' },
          })
        }

        const result = await storage.query({})
        expect(result.events).toHaveLength(5)
      })

      it('should query by type', async () => {
        await storage.store({
          id: '1',
          type: 'READ',
          status: 'SUCCESS',
          timestamp: new Date(),
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })
        await storage.store({
          id: '2',
          type: 'CREATE',
          status: 'SUCCESS',
          timestamp: new Date(),
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'PutItem' },
        })

        const reads = await storage.query({ type: 'READ' })
        expect(reads.events).toHaveLength(1)
        expect(reads.events[0].type).toBe('READ')
      })

      it('should query by actor', async () => {
        await storage.store({
          id: '1',
          type: 'READ',
          status: 'SUCCESS',
          timestamp: new Date(),
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })
        await storage.store({
          id: '2',
          type: 'READ',
          status: 'SUCCESS',
          timestamp: new Date(),
          actor: { userId: 'user-2' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })

        const result = await storage.query({ userId: 'user-1' })
        expect(result.events).toHaveLength(1)
        expect(result.events[0].actor.userId).toBe('user-1')
      })

      it('should query by time range', async () => {
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - 3600000)
        const thirtyMinutesAgo = new Date(now.getTime() - 1800000)

        await storage.store({
          id: '1',
          type: 'READ',
          status: 'SUCCESS',
          timestamp: oneHourAgo,
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })
        await storage.store({
          id: '2',
          type: 'READ',
          status: 'SUCCESS',
          timestamp: now,
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })

        const result = await storage.query({
          startTime: thirtyMinutesAgo,
        })
        expect(result.events).toHaveLength(1)
      })

      it('should support pagination limit', async () => {
        for (let i = 0; i < 10; i++) {
          await storage.store({
            id: String(i),
            type: 'READ',
            status: 'SUCCESS',
            timestamp: new Date(),
            actor: { userId: 'user-1' },
            target: { tableName: 'users' },
            operation: { name: 'GetItem' },
          })
        }

        const result = await storage.query({ limit: 5 })
        expect(result.events).toHaveLength(5)
      })
    })

    describe('Disabled Audit Logging', () => {
      it('should not log when disabled', async () => {
        const storage = new InMemoryAuditStorage()
        const logger = createAuditLogger({
          enabled: false,
          storage: [storage],
          async: false,
        })

        await logger.log({
          type: 'READ',
          status: 'SUCCESS',
          actor: { userId: 'user-1' },
          target: { tableName: 'users' },
          operation: { name: 'GetItem' },
        })

        const events = await storage.query({})
        expect(events.events).toHaveLength(0)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent audit logging', async () => {
      const storage = new InMemoryAuditStorage()
      const logger = createAuditLogger({
        enabled: true,
        storage: [storage],
        async: false,
      })

      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          logger.log({
            type: 'READ',
            status: 'SUCCESS',
            actor: { userId: `user-${i}` },
            target: { tableName: 'users' },
            operation: { name: 'GetItem' },
          }),
        )
      }

      await Promise.all(promises)
      const events = await storage.query({})
      expect(events.events).toHaveLength(100)
    })

    it('should handle empty permissions array', () => {
      const manager = createAccessControlManager()
      manager.registerRole({
        id: 'empty',
        name: 'Empty Role',
        permissions: [],
      })

      const result = manager.checkAccess(
        'read',
        { table: 'users' },
        { roles: ['empty'] },
      )
      expect(result.allowed).toBe(false)
    })

    it('should handle special characters in table names for access control', () => {
      const manager = createAccessControlManager()
      manager.registerRole({
        id: 'test',
        name: 'Test',
        permissions: [
          {
            id: 'p1',
            actions: ['read'],
            resources: [{ table: 'my-table_v2.test' }],
            effect: 'allow',
          },
        ],
      })

      const result = manager.checkAccess(
        'read',
        { table: 'my-table_v2.test' },
        { roles: ['test'] },
      )
      expect(result.allowed).toBe(true)
    })
  })
})
