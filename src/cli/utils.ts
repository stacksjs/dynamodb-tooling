// ============================================================================
// CLI Utilities
// ============================================================================

import nodeProcess from 'node:process'

/**
 * Exit the CLI with an error code
 */
export function exitWithError(code: number = 1): never {
  nodeProcess.exit(code)
}

/**
 * Handle CLI command errors uniformly
 */
export function handleError(error: unknown): never {
  console.error('Error:', error instanceof Error ? error.message : error)
  exitWithError(1)
}
