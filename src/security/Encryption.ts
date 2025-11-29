// ============================================================================
// Encryption - Client-Side Encryption for DynamoDB
// ============================================================================

import { createHash, createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto'

/**
 * Encryption algorithm
 */
export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'aes-128-gcm'

/**
 * Key derivation function
 */
export type KeyDerivationFunction = 'pbkdf2' | 'scrypt' | 'argon2'

/**
 * Encrypted field metadata
 */
export interface EncryptedFieldMetadata {
  /** Algorithm used */
  algorithm: EncryptionAlgorithm
  /** Initialization vector (base64) */
  iv: string
  /** Auth tag for GCM (base64) */
  authTag?: string
  /** Key ID (for key rotation) */
  keyId?: string
  /** Version */
  version: number
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Encryption algorithm */
  algorithm?: EncryptionAlgorithm
  /** Master key (32 bytes for AES-256) */
  masterKey: string | Buffer
  /** Key ID for key rotation */
  keyId?: string
  /** Fields to encrypt (attribute paths) */
  encryptedFields?: string[]
  /** Fields to never encrypt */
  excludeFields?: string[]
  /** Enable deterministic encryption for searchable fields */
  deterministicFields?: string[]
}

/**
 * Encryption result
 */
export interface EncryptionResult {
  /** Encrypted data (base64) */
  ciphertext: string
  /** Metadata */
  metadata: EncryptedFieldMetadata
}

/**
 * Client-side encryption manager
 */
export class EncryptionManager {
  private config: Required<Omit<EncryptionConfig, 'masterKey'>> & { masterKey: Buffer }
  private keyCache: Map<string, Buffer> = new Map()

  constructor(config: EncryptionConfig) {
    const masterKey = typeof config.masterKey === 'string'
      ? Buffer.from(config.masterKey, 'base64')
      : config.masterKey

    if (masterKey.length < 32) {
      throw new Error('Master key must be at least 32 bytes for AES-256')
    }

    this.config = {
      algorithm: 'aes-256-gcm',
      keyId: 'default',
      encryptedFields: [],
      excludeFields: ['pk', 'sk', '_et', '_ct', '_md'],
      deterministicFields: [],
      ...config,
      masterKey,
    }
  }

  /**
   * Encrypt a single value
   */
  encrypt(value: unknown, fieldPath?: string): EncryptionResult {
    const plaintext = JSON.stringify(value)

    // Use deterministic encryption for searchable fields
    const isDeterministic = fieldPath && this.config.deterministicFields.includes(fieldPath)

    const iv = isDeterministic
      ? this.deriveIV(plaintext) // Same plaintext = same IV for searchability
      : randomBytes(this.getIVLength())

    const key = this.deriveKey(this.config.keyId)

    if (this.config.algorithm.includes('gcm')) {
      return this.encryptGCM(plaintext, key, iv)
    }
    else {
      return this.encryptCBC(plaintext, key, iv)
    }
  }

  /**
   * Decrypt a single value
   */
  decrypt(encrypted: EncryptionResult): unknown {
    const { ciphertext, metadata } = encrypted
    const key = this.deriveKey(metadata.keyId || this.config.keyId)
    const iv = Buffer.from(metadata.iv, 'base64')

    let plaintext: string

    if (metadata.algorithm.includes('gcm')) {
      if (!metadata.authTag) {
        throw new Error('Auth tag required for GCM decryption')
      }
      plaintext = this.decryptGCM(ciphertext, key, iv, metadata.authTag)
    }
    else {
      plaintext = this.decryptCBC(ciphertext, key, iv)
    }

    return JSON.parse(plaintext)
  }

  /**
   * Encrypt an item (all configured fields)
   */
  encryptItem(item: Record<string, unknown>): Record<string, unknown> {
    const result = { ...item }

    for (const [key, value] of Object.entries(item)) {
      if (this.shouldEncrypt(key)) {
        const encrypted = this.encrypt(value, key)
        result[key] = {
          __encrypted: true,
          ...encrypted,
        }
      }
    }

    return result
  }

  /**
   * Decrypt an item (all encrypted fields)
   */
  decryptItem(item: Record<string, unknown>): Record<string, unknown> {
    const result = { ...item }

    for (const [key, value] of Object.entries(item)) {
      if (this.isEncryptedValue(value)) {
        const encrypted = value as { __encrypted: boolean, ciphertext: string, metadata: EncryptedFieldMetadata }
        result[key] = this.decrypt({
          ciphertext: encrypted.ciphertext,
          metadata: encrypted.metadata,
        })
      }
    }

    return result
  }

  /**
   * Generate a new encryption key
   */
  static generateKey(length: number = 32): Buffer {
    return randomBytes(length)
  }

  /**
   * Generate a new key as base64 string
   */
  static generateKeyBase64(length: number = 32): string {
    return randomBytes(length).toString('base64')
  }

  /**
   * Hash a value (for blind indexing)
   */
  hash(value: unknown, salt?: string): string {
    const data = JSON.stringify(value)
    const hash = createHash('sha256')
    if (salt) {
      hash.update(salt)
    }
    hash.update(data)
    return hash.digest('base64')
  }

  /**
   * Create a blind index for encrypted searchable fields
   */
  createBlindIndex(value: unknown, indexName: string): string {
    const salt = this.deriveKey(`blind_index_${indexName}`).toString('base64')
    return this.hash(value, salt)
  }

  private shouldEncrypt(fieldPath: string): boolean {
    // Never encrypt excluded fields
    if (this.config.excludeFields.includes(fieldPath)) {
      return false
    }

    // If specific fields are configured, only encrypt those
    if (this.config.encryptedFields.length > 0) {
      return this.config.encryptedFields.includes(fieldPath)
    }

    // Default: encrypt all non-excluded fields
    return true
  }

  private isEncryptedValue(value: unknown): boolean {
    return (
      typeof value === 'object'
      && value !== null
      && '__encrypted' in value
      && (value as { __encrypted: boolean }).__encrypted === true
    )
  }

  private encryptGCM(plaintext: string, key: Buffer, iv: Buffer): EncryptionResult {
    const cipher = createCipheriv(this.config.algorithm, key.subarray(0, 32), iv) as ReturnType<typeof createCipheriv> & { getAuthTag(): Buffer }
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
    ciphertext += cipher.final('base64')
    const authTag = cipher.getAuthTag()

    return {
      ciphertext,
      metadata: {
        algorithm: this.config.algorithm,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyId: this.config.keyId,
        version: 1,
      },
    }
  }

  private decryptGCM(ciphertext: string, key: Buffer, iv: Buffer, authTag: string): string {
    const decipher = createDecipheriv(this.config.algorithm, key.subarray(0, 32), iv) as ReturnType<typeof createDecipheriv> & { setAuthTag(tag: Buffer): void }
    decipher.setAuthTag(Buffer.from(authTag, 'base64'))
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8')
    plaintext += decipher.final('utf8')
    return plaintext
  }

  private encryptCBC(plaintext: string, key: Buffer, iv: Buffer): EncryptionResult {
    const cipher = createCipheriv('aes-256-cbc', key.subarray(0, 32), iv)
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
    ciphertext += cipher.final('base64')

    return {
      ciphertext,
      metadata: {
        algorithm: 'aes-256-cbc',
        iv: iv.toString('base64'),
        keyId: this.config.keyId,
        version: 1,
      },
    }
  }

  private decryptCBC(ciphertext: string, key: Buffer, iv: Buffer): string {
    const decipher = createDecipheriv('aes-256-cbc', key.subarray(0, 32), iv)
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8')
    plaintext += decipher.final('utf8')
    return plaintext
  }

  private deriveKey(keyId: string): Buffer {
    const cached = this.keyCache.get(keyId)
    if (cached) return cached

    const derived = pbkdf2Sync(
      this.config.masterKey,
      `dynamodb_key_${keyId}`,
      100000,
      32,
      'sha256',
    )

    this.keyCache.set(keyId, derived)
    return derived
  }

  private deriveIV(data: string): Buffer {
    // Deterministic IV based on data content (for searchable encryption)
    const hash = createHash('sha256')
      .update(this.config.masterKey)
      .update(data)
      .digest()

    return hash.subarray(0, this.getIVLength())
  }

  private getIVLength(): number {
    if (this.config.algorithm.includes('gcm')) {
      return 12 // GCM uses 96-bit IV
    }
    return 16 // CBC uses 128-bit IV
  }
}

/**
 * Create an encryption manager
 */
export function createEncryptionManager(config: EncryptionConfig): EncryptionManager {
  return new EncryptionManager(config)
}

/**
 * Attribute-level encryption decorator
 */
export interface EncryptedAttribute {
  /** Mark field as encrypted */
  encrypted: true
  /** Use deterministic encryption (searchable) */
  deterministic?: boolean
  /** Create blind index for searching */
  blindIndex?: boolean
  /** Blind index name */
  blindIndexName?: string
}

/**
 * Key rotation configuration
 */
export interface KeyRotationConfig {
  /** Current key ID */
  currentKeyId: string
  /** Previous key IDs (for decryption) */
  previousKeyIds: string[]
  /** Key store */
  keys: Map<string, Buffer>
}

/**
 * Key rotation manager
 */
export class KeyRotationManager {
  private config: KeyRotationConfig
  private encryptionManagers: Map<string, EncryptionManager> = new Map()

  constructor(config: KeyRotationConfig) {
    this.config = config

    // Create encryption manager for each key
    for (const [keyId, key] of config.keys) {
      this.encryptionManagers.set(
        keyId,
        createEncryptionManager({
          masterKey: key,
          keyId,
        }),
      )
    }
  }

  /**
   * Encrypt with current key
   */
  encrypt(value: unknown, fieldPath?: string): EncryptionResult {
    const manager = this.encryptionManagers.get(this.config.currentKeyId)
    if (!manager) {
      throw new Error(`No encryption manager for key ${this.config.currentKeyId}`)
    }
    return manager.encrypt(value, fieldPath)
  }

  /**
   * Decrypt (auto-detect key from metadata)
   */
  decrypt(encrypted: EncryptionResult): unknown {
    const keyId = encrypted.metadata.keyId || this.config.currentKeyId
    const manager = this.encryptionManagers.get(keyId)

    if (!manager) {
      throw new Error(`No encryption manager for key ${keyId}`)
    }

    return manager.decrypt(encrypted)
  }

  /**
   * Re-encrypt with current key
   */
  reencrypt(encrypted: EncryptionResult, fieldPath?: string): EncryptionResult {
    const plaintext = this.decrypt(encrypted)
    return this.encrypt(plaintext, fieldPath)
  }

  /**
   * Check if item needs re-encryption (uses old key)
   */
  needsReencryption(item: Record<string, unknown>): boolean {
    for (const value of Object.values(item)) {
      if (this.isEncryptedValue(value)) {
        const encrypted = value as unknown as { metadata: EncryptedFieldMetadata }
        if (encrypted.metadata.keyId !== this.config.currentKeyId) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Re-encrypt entire item
   */
  reencryptItem(item: Record<string, unknown>): Record<string, unknown> {
    const result = { ...item }

    for (const [key, value] of Object.entries(item)) {
      if (this.isEncryptedValue(value)) {
        const encrypted = value as unknown as { ciphertext: string, metadata: EncryptedFieldMetadata }
        const reencrypted = this.reencrypt({
          ciphertext: encrypted.ciphertext,
          metadata: encrypted.metadata,
        }, key)

        result[key] = {
          __encrypted: true,
          ...reencrypted,
        }
      }
    }

    return result
  }

  private isEncryptedValue(value: unknown): boolean {
    return (
      typeof value === 'object'
      && value !== null
      && '__encrypted' in value
      && (value as { __encrypted: boolean }).__encrypted === true
    )
  }
}

/**
 * Create a key rotation manager
 */
export function createKeyRotationManager(config: KeyRotationConfig): KeyRotationManager {
  return new KeyRotationManager(config)
}
