import type { Subprocess } from 'bun'
import type { LaunchOptions } from './types'
import * as fs from 'node:fs'
import * as https from 'node:https'
import * as path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import * as zlib from 'node:zlib'
import Debug from 'debug'
import * as tar from 'tar'
import { getConfig } from './config'
import { exists } from './utils'

const debug = Debug('dynamodb-local')
const JARNAME = 'DynamoDBLocal.jar'
const DOCKER_IMAGE = 'amazon/dynamodb-local:latest'

export const runningProcesses: { [port: number]: Subprocess } = {}
export const runningContainers: { [port: number]: string } = {}

export const dynamoDb = {
  async launch(options?: LaunchOptions): Promise<Subprocess | undefined> {
    const config = await getConfig()
    const {
      port = config.local.port,
      dbPath = config.local.dbPath,
      additionalArgs = config.local.additionalArgs,
      verbose = false,
      detached = config.local.detached,
      javaOpts = config.local.javaOpts,
      useDocker = false,
    } = options ?? {}

    if (runningProcesses[port])
      return runningProcesses[port]

    // Use Docker if requested
    if (useDocker) {
      return this.launchDocker({ port, dbPath, verbose, detached })
    }

    const args = [
      '-Xrs',
      '-Djava.library.path=./DynamoDBLocal_lib',
      javaOpts,
      '-jar',
      JARNAME,
      '-port',
      port.toString(),
      ...(dbPath ? ['-dbPath', dbPath] : ['-inMemory']),
      ...additionalArgs,
    ].filter(Boolean)

    debug('Launching DynamoDB Local with args:', args)

    try {
      await this.install()

      const child = Bun.spawn(['java', ...args], {
        cwd: config.local.installPath,
        onExit: (proc, exitCode, signalCode, error) => {
          if (exitCode !== 0 && verbose)
            debug('Local DynamoDB exit code:', exitCode)
          if (error)
            debug('Local DynamoDB error:', error)
        },
      })

      if (!child.pid)
        throw new Error('Unable to launch DynamoDBLocal process')

      if (!detached)
        process.on('exit', () => child.kill())

      runningProcesses[port] = child
      return child
    }
    catch (error) {
      debug('Error launching DynamoDB Local:', error)
      throw error
    }
  },

  /**
   * Launch DynamoDB Local using Docker
   */
  async launchDocker(options: {
    port?: number
    dbPath?: string | null
    verbose?: boolean
    detached?: boolean
  }): Promise<Subprocess | undefined> {
    const config = await getConfig()
    const {
      port = config.local.port,
      dbPath = config.local.dbPath,
      verbose = false,
      detached = config.local.detached,
    } = options

    const containerName = `dynamodb-local-${port}`

    // Check if container already exists and is running
    const checkResult = Bun.spawnSync(['docker', 'ps', '-q', '-f', `name=${containerName}`])
    const existingContainer = checkResult.stdout.toString().trim()
    if (existingContainer) {
      debug(`DynamoDB Local container already running on port ${port}`)
      // Return a fake subprocess that represents the running container
      if (runningProcesses[port])
        return runningProcesses[port]
    }

    // Stop and remove any existing container with same name
    Bun.spawnSync(['docker', 'rm', '-f', containerName], { stdout: 'ignore', stderr: 'ignore' })

    const dockerArgs = [
      'run',
      '--rm',
      '-d',
      '--name',
      containerName,
      '-p',
      `${port}:8000`,
    ]

    // Add volume mount if dbPath is specified
    if (dbPath) {
      const absoluteDbPath = path.resolve(dbPath)
      await fs.promises.mkdir(absoluteDbPath, { recursive: true })
      dockerArgs.push('-v', `${absoluteDbPath}:/home/dynamodblocal/data`)
      dockerArgs.push(DOCKER_IMAGE, '-jar', 'DynamoDBLocal.jar', '-dbPath', '/home/dynamodblocal/data')
    }
    else {
      dockerArgs.push(DOCKER_IMAGE)
    }

    debug('Launching DynamoDB Local with Docker:', dockerArgs)

    try {
      const child = Bun.spawn(['docker', ...dockerArgs], {
        onExit: (proc, exitCode, signalCode, error) => {
          if (exitCode !== 0 && verbose)
            debug('Docker container exit code:', exitCode)
          if (error)
            debug('Docker container error:', error)
        },
      })

      // Wait a moment for container to start
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Verify container is running
      const verifyResult = Bun.spawnSync(['docker', 'ps', '-q', '-f', `name=${containerName}`])
      const runningContainer = verifyResult.stdout.toString().trim()
      if (!runningContainer) {
        throw new Error('Failed to start DynamoDB Local Docker container')
      }

      runningContainers[port] = containerName

      if (!detached) {
        process.on('exit', () => {
          Bun.spawnSync(['docker', 'stop', containerName], { stdout: 'ignore', stderr: 'ignore' })
        })
      }

      runningProcesses[port] = child
      return child
    }
    catch (error) {
      debug('Error launching DynamoDB Local via Docker:', error)
      throw error
    }
  },

  stop(port: number): void {
    const proc = runningProcesses[port]
    const containerName = runningContainers[port]

    if (containerName) {
      // Stop Docker container
      Bun.spawnSync(['docker', 'stop', containerName], { stdout: 'ignore', stderr: 'ignore' })
      delete runningContainers[port]
    }

    if (proc) {
      proc.kill('SIGKILL')
      delete runningProcesses[port]
    }
  },

  async install(): Promise<void> {
    const config = await getConfig()
    const installPathExists = await exists(config.local.installPath)
    if (!installPathExists)
      await promisify(fs.mkdir)(config.local.installPath)

    const jarPath = path.join(config.local.installPath, JARNAME)
    const jarExists = await exists(jarPath)
    if (jarExists)
      return

    // eslint-disable-next-line no-console
    console.log('Installing DynamoDB locally...')
    const downloadUrl = config.local.downloadUrl
    await new Promise((resolve, reject) => {
      https
        .get(downloadUrl, (response) => {
          if (response.statusCode !== 200)
            return reject(new Error(`Failed to download DynamoDB Local: ${response.statusCode}`))

          response
            .pipe(zlib.createUnzip())
            .pipe(tar.extract({ cwd: config.local.installPath }))
            .on('finish', resolve)
            .on('error', reject)
        })
        .on('error', reject)
    })
  },
}
