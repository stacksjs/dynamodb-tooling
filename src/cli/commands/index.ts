// ============================================================================
// CLI Commands Index
// ============================================================================

import type { CAC } from 'cac'
import { registerLocalCommands } from './local'
import { registerMigrateCommands } from './migrate'
import { registerQueryCommands } from './query'
import { registerTableCommands } from './table'
import { registerUtilityCommands } from './utility'

export { registerLocalCommands } from './local'
export { registerMigrateCommands } from './migrate'
export { registerQueryCommands } from './query'
export { registerTableCommands } from './table'
export { registerUtilityCommands } from './utility'

/**
 * Register all CLI commands
 */
export function registerAllCommands(cli: CAC): void {
  registerTableCommands(cli)
  registerMigrateCommands(cli)
  registerQueryCommands(cli)
  registerUtilityCommands(cli)
  registerLocalCommands(cli)
}
