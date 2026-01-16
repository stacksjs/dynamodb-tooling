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
  type ErrorContext,
  exitWithError,
  formatError,
  handleCommandError,
} from './error-formatter'

// UI Utilities
export {
  // Box/Panel
  box,
  type BoxOptions,
  bullet,
  // Colors and formatting
  c,
  // Progress bar
  createProgressBar,
  // Spinner
  createSpinner,
  divider,
  error,
  formatBytes,
  // Diff formatting
  formatDiff,
  formatDuration,
  // Key-value list
  formatKeyValue,
  formatNumber,
  // Table formatting
  formatTable,
  // Tree view
  formatTree,
  header,
  // Icons
  icons,
  info,
  type KeyValueOptions,
  newline,
  type ProgressBar,
  type Spinner,
  step,
  // String helpers
  stripAnsi,
  // Message helpers
  success,
  type TableColumn,
  type TableOptions,
  type TreeNode,
  truncate,
  warning,
} from './ui'
