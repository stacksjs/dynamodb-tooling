import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import process from 'node:process'
import * as fs from 'node:fs'
import * as https from 'node:https'
import * as zlib from 'node:zlib'
import * as path from 'node:path'
import { promisify } from 'node:util'
import * as tar from 'tar'
import Debug from 'debug'
import { exists } from './utils'
import type { Config } from './config'
import { config } from './config'

interface LaunchOptions {
  /**
   * The port to run the local DynamoDB instance on
   */
  port: number
  /**
   * The path to the database file
   */
  dbPath?: string
  /**
   * Additional arguments to pass to the DynamoDBLocal process
   */
  additionalArgs?: string[]
  /**
   * Whether to log additional information
   */
  verbose?: boolean
  /**
   * Whether to run the process in detached mode
   */
  detached?: boolean
  /**
   * Additional options to pass to the JVM
   */
  javaOpts?: string
}

const debug = Debug('dynamodb-local')
const JARNAME = 'DynamoDBLocal.jar'
const runningProcesses: { [port: number]: ChildProcess } = {}

export const dynamoDb = {
  /**
   * Launches a new DynamoDBLocal process
   * @param options LaunchOptions - The options to use when launching the DynamoDBLocal process
   * @returns {Promise<ChildProcess | undefined>} A promise that resolves to the ChildProcess of the DynamoDBLocal instance.
   * @throws An error if the process fails to start
   */
  async launch({ port, dbPath, additionalArgs = [], verbose = false, detached, javaOpts = '' }: LaunchOptions): Promise<ChildProcess | undefined> {
    if (runningProcesses[port])
      return Promise.resolve(runningProcesses[port])

    if (dbPath)
      additionalArgs.push('-dbPath', dbPath)
    else
      additionalArgs.push('-inMemory')

    return this.install()
      .then(() => {
        let args = ['-Xrs', '-Djava.library.path=./DynamoDBLocal_lib', javaOpts, '-jar', JARNAME, '-port', port.toString()].filter(arg => !!arg)
        args = args.concat(additionalArgs)

        const child = spawn('java', args, {
          cwd: config.installPath,
          env: process.env,
          stdio: ['ignore', 'ignore', 'inherit'],
        })

        if (!child.pid)
          throw new Error('Unable to launch DynamoDBLocal process')

        child.on('error', (err) => {
          if (verbose)
            debug('local DynamoDB start error', err)

          throw new Error('Local DynamoDB failed to start.')
        }).on('close', (code) => {
          if (code !== null && code !== 0 && verbose)
            debug('Local DynamoDB failed to close with code', code)
        })

        if (!detached) {
          process.on('exit', () => {
            child.kill()
          })
        }

        runningProcesses[port] = child

        if (verbose)
          debug(`DynamoDbLocal(${child.pid}) started on port ${port} via java ${args.join(' ')} from CWD ${config.installPath}`)

        return child
      })
  },

  /**
   * Stops the DynamoDBLocal process running on the specified port
   * @param {number} port - The port to stop the DynamoDBLocal process on
   * @returns {void}
   */
  stop(port: number): void {
    const process = runningProcesses[port]
    if (process) {
      process.kill('SIGKILL')
      delete runningProcesses[port]
    }
  },

  /**
   * Stops the specified child process
   * @param {ChildProcess} child - The child process to stop
   * @returns {void}
   */
  stopChild(child: ChildProcess): void {
    if (child.pid) {
      debug('Stopped the child')
      child.kill()
    }
  },

  /**
   * Relaunches the DynamoDBLocal process on the specified port
   * @param {number} port - The port to run the local DynamoDB instance on
   * @param {string[]} [args] - Additional arguments to pass to the DynamoDBLocal process
   * @returns {void}
   */
  relaunch(port: number, ...args: string[]): void {
    this.stop(port)
    this.launch({ port, additionalArgs: args })
  },

  /**
   * Configures the installer with the specified configuration
   * @param {Partial<Config>} conf - The configuration to use
   * @returns {void}
   */
  configureInstaller(conf: Partial<Config>): void {
    if (conf.installPath)
      config.installPath = conf.installPath

    if (conf.downloadUrl)
      config.downloadUrl = conf.downloadUrl
  },

  /**
   * Installs the DynamoDBLocal instance
   * @returns {Promise<void>} A promise that resolves when the installation is complete
   */
  async install(): Promise<void> {
    debug('Checking for DynamoDB-Local in ', config.installPath)
    const mkdir = promisify(fs.mkdir)

    // Define an async function to encapsulate the logic
    const checkAndInstall = async () => {
      try {
        // Try accessing the JAR file to check if it exists
        await exists(path.join(config.installPath, JARNAME))
        // If the access call does not throw, the file exists, and we can return early
        return
      }
      catch {
        // If an error is caught, it means the file does not exist, and we proceed with the installation
        debug('DynamoDB Local not installed. Installing...')
      }

      if (!(await exists(config.installPath)))
        await mkdir(config.installPath)

      // Download and extract the tar.gz file
      fs.createWriteStream(path.join(config.installPath, JARNAME))

      return new Promise((resolve, reject) => {
        https.get(config.downloadUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Error getting DynamoDb local latest tar.gz location ${response.headers.location}: ${response.statusCode}`))
            return
          }
          response.pipe(zlib.createUnzip()).pipe(tar.extract({ cwd: config.installPath }))
            .on('finish', resolve)
            .on('error', reject)
        }).on('error', reject)
      })
    }

    // Call the async function and wait for it to complete
    await checkAndInstall()
  },
}
