// ============================================================================
// Security
// ============================================================================

export {
  EncryptionManager,
  createEncryptionManager,
  KeyRotationManager,
  createKeyRotationManager,
  type EncryptionAlgorithm,
  type KeyDerivationFunction,
  type EncryptedFieldMetadata,
  type EncryptionConfig,
  type EncryptionResult,
  type EncryptedAttribute,
  type KeyRotationConfig,
} from './Encryption'

export {
  AccessControlManager,
  createAccessControlManager,
  BuiltInRoles,
  type PermissionAction,
  type PermissionResource,
  type AccessCondition,
  type Permission,
  type Role,
  type AccessContext,
  type AccessCheckResult,
} from './AccessControl'

export {
  AuditLogger,
  createAuditLogger,
  InMemoryAuditStorage,
  DynamoDBCommandAuditStorage,
  type AuditEventType,
  type AuditEventStatus,
  type AuditEvent,
  type AuditStorage,
  type AuditQueryOptions,
  type AuditQueryResult,
  type AuditLoggerConfig,
} from './Audit'
