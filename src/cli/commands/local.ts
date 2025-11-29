// ============================================================================
// Local DynamoDB Development Commands
// ============================================================================

import type { CAC } from 'cac'
import { getConfig } from '../../config'
import { dynamoDb, runningProcesses } from '../../dynamodb'
import { handleError } from '../utils'

/**
 * Register local development commands
 */
export function registerLocalCommands(cli: CAC): void {
  // start - Start local DynamoDB
  cli
    .command('start', 'Start DynamoDB Local')
    .option('--port <port>', 'Port to run on', { default: 8000 })
    .option('--db-path <path>', 'Path to store data (default: in-memory)')
    .option('--detached', 'Run in background')
    .option('--verbose', 'Show verbose output')
    .action(async (options: {
      port: number
      dbPath?: string
      detached?: boolean
      verbose?: boolean
    }) => {
      try {
        console.log(`Starting DynamoDB Local on port ${options.port}...`)

        const proc = await dynamoDb.launch({
          port: options.port,
          dbPath: options.dbPath,
          detached: options.detached,
          verbose: options.verbose,
        })

        if (proc) {
          console.log(`DynamoDB Local started successfully (PID: ${proc.pid})`)
          console.log(`Endpoint: http://localhost:${options.port}`)

          if (options.dbPath) {
            console.log(`Data path: ${options.dbPath}`)
          }
          else {
            console.log('Mode: In-memory (data will be lost on stop)')
          }

          if (!options.detached) {
            console.log('\nPress Ctrl+C to stop')
          }
        }
      }
      catch (error) {
        console.error('Error starting DynamoDB Local:', error instanceof Error ? error.message : error)
        console.log('\nTroubleshooting:')
        console.log('  1. Ensure Java is installed: java -version')
        console.log('  2. Run: dbtooling install (to download DynamoDB Local)')
        handleError(error)
      }
    })

  // stop - Stop local DynamoDB
  cli
    .command('stop', 'Stop DynamoDB Local')
    .option('--port <port>', 'Port of instance to stop', { default: 8000 })
    .action(async (options: { port: number }) => {
      try {
        const running = runningProcesses[options.port]

        if (!running) {
          console.log(`No DynamoDB Local instance running on port ${options.port}`)
          return
        }

        dynamoDb.stop(options.port)
        console.log(`DynamoDB Local stopped on port ${options.port}`)
      }
      catch (error) {
        handleError(error)
      }
    })

  // status - Show status of local DynamoDB
  cli
    .command('status', 'Show status of DynamoDB Local')
    .action(async () => {
      try {
        const config = await getConfig()
        const ports = Object.keys(runningProcesses).map(Number)

        if (ports.length === 0) {
          console.log('No DynamoDB Local instances running')
          console.log(`\nDefault port: ${config.local.port}`)
          console.log('Run: dbtooling start')
          return
        }

        console.log('Running DynamoDB Local instances:')
        for (const port of ports) {
          const proc = runningProcesses[port]
          console.log(`  Port ${port}: PID ${proc.pid}`)
        }
      }
      catch (error) {
        handleError(error)
      }
    })

  // install - Install DynamoDB Local
  cli
    .command('install', 'Install DynamoDB Local')
    .option('--force', 'Force reinstall even if already installed')
    .action(async (options: { force?: boolean }) => {
      try {
        const config = await getConfig()

        if (options.force) {
          const fs = await import('node:fs/promises')
          try {
            await fs.rm(config.local.installPath, { recursive: true })
            console.log('Removed existing installation')
          }
          catch {
            // Ignore if doesn't exist
          }
        }

        console.log('Installing DynamoDB Local...')
        console.log(`Install path: ${config.local.installPath}`)

        await dynamoDb.install()

        console.log('DynamoDB Local installed successfully')
        console.log('Run: dbtooling start')
      }
      catch (error) {
        handleError(error)
      }
    })

  // reset - Stop, clear data, and start fresh
  cli
    .command('reset', 'Reset DynamoDB Local (stop, clear, start)')
    .option('--port <port>', 'Port to reset', { default: 8000 })
    .option('--force', 'Skip confirmation')
    .action(async (options: { port: number, force?: boolean }) => {
      try {
        if (!options.force) {
          console.log('WARNING: This will stop DynamoDB Local and clear all data!')
          console.log('Use --force to proceed.')
          return
        }

        // Stop if running
        if (runningProcesses[options.port]) {
          console.log(`Stopping DynamoDB Local on port ${options.port}...`)
          dynamoDb.stop(options.port)
        }

        // Start fresh (in-memory mode)
        console.log('Starting fresh DynamoDB Local instance...')
        const proc = await dynamoDb.launch({ port: options.port })

        if (proc) {
          console.log(`DynamoDB Local reset and running on port ${options.port}`)
        }
      }
      catch (error) {
        handleError(error)
      }
    })
}
