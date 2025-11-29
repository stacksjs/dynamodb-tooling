// ============================================================================
// CLI Commands Index
// ============================================================================

import type { CAC } from 'cac'
import { registerLocalCommands } from './local'
import { registerMigrateCommands } from './migrate'
import { registerQueryCommands } from './query'
import { registerSeedCommands } from './seed'
import { registerTableCommands } from './table'
import { registerUtilityCommands } from './utility'

export { registerLocalCommands } from './local'
export { registerMigrateCommands } from './migrate'
export { registerQueryCommands } from './query'
export { registerSeedCommands } from './seed'
export { registerTableCommands } from './table'
export { registerUtilityCommands } from './utility'

/**
 * Register all CLI commands
 */
export function registerAllCommands(cli: CAC): void {
  registerTableCommands(cli)
  registerMigrateCommands(cli)
  registerQueryCommands(cli)
  registerSeedCommands(cli)
  registerUtilityCommands(cli)
  registerLocalCommands(cli)
}
