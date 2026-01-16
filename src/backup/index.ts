// ============================================================================
// DynamoDB Backup & Restore
// ============================================================================

export {
  type BackupDetails,
  BackupManager,
  type BackupStatus,
  type BackupType,
  createBackupManager,
  type CreateBackupOptions,
  type ListBackupsOptions,
  type PITRDescription,
  type PITRStatus,
  type RestoreOptions,
  type ScheduledBackupConfig,
} from './BackupManager'
