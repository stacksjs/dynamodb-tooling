// ============================================================================
// CLI Module Index
// ============================================================================

// Commands
export {
  registerAllCommands,
  registerLocalCommands,
  registerMigrateCommands,
  registerModelsCommands,
  registerQueryCommands,
  registerSchemaCommands,
  registerSeedCommands,
  registerTableCommands,
  registerUtilityCommands,
} from './commands'

// Error Formatting
export {
  displayConfirmation,
  displayError,
  displaySimpleError,
  displayWarning,
  exitWithError,
  formatError,
  handleCommandError,
  type ErrorContext,
} from './error-formatter'

// UI Utilities
export {
  // Colors and formatting
  c,
  // Icons
  icons,
  // Spinner
  createSpinner,
  type Spinner,
  // Progress bar
  createProgressBar,
  type ProgressBar,
  // Table formatting
  formatTable,
  type TableColumn,
  type TableOptions,
  // Box/Panel
  box,
  type BoxOptions,
  // Tree view
  formatTree,
  type TreeNode,
  // Key-value list
  formatKeyValue,
  type KeyValueOptions,
  // Diff formatting
  formatDiff,
  // Message helpers
  success,
  error,
  warning,
  info,
  bullet,
  step,
  header,
  divider,
  newline,
  // String helpers
  stripAnsi,
  truncate,
  formatBytes,
  formatDuration,
  formatNumber,
} from './ui'
