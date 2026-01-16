// ============================================================================
// Security
// ============================================================================

export {
  type AccessCheckResult,
  type AccessCondition,
  type AccessContext,
  AccessControlManager,
  BuiltInRoles,
  createAccessControlManager,
  type Permission,
  type PermissionAction,
  type PermissionResource,
  type Role,
} from './AccessControl'

export {
  type AuditEvent,
  type AuditEventStatus,
  type AuditEventType,
  AuditLogger,
  type AuditLoggerConfig,
  type AuditQueryOptions,
  type AuditQueryResult,
  type AuditStorage,
  createAuditLogger,
  DynamoDBCommandAuditStorage,
  InMemoryAuditStorage,
} from './Audit'

export {
  createEncryptionManager,
  createKeyRotationManager,
  type EncryptedAttribute,
  type EncryptedFieldMetadata,
  type EncryptionAlgorithm,
  type EncryptionConfig,
  EncryptionManager,
  type EncryptionResult,
  type KeyDerivationFunction,
  type KeyRotationConfig,
  KeyRotationManager,
} from './Encryption'
