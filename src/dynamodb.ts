import process from 'node:process'
import * as fs from 'node:fs'
import * as https from 'node:https'
import * as zlib from 'node:zlib'
import * as path from 'node:path'
import { promisify } from 'node:util'
// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Subprocess } from 'bun'
import * as tar from 'tar'
import Debug from 'debug'
import { exists } from './utils'
import { config } from './config'

const debug = Debug('dynamodb-local')
const JARNAME = 'DynamoDBLocal.jar'
const runningProcesses: { [port: number]: Subprocess } = {}

export interface LaunchOptions {
  port: number
  dbPath?: string
  additionalArgs?: string[]
  verbose?: boolean
  detached?: boolean
  javaOpts?: string
}

export const dynamoDb = {
  async launch(options: LaunchOptions): Promise<Subprocess | undefined> {
    const { port, dbPath, additionalArgs = [], verbose = false, detached, javaOpts = '' } = options
    if (runningProcesses[port])
      return runningProcesses[port]

    const args = ['-Xrs', '-Djava.library.path=./DynamoDBLocal_lib', javaOpts, '-jar', JARNAME, '-port', port.toString(), ...(dbPath ? ['-dbPath', dbPath] : ['-inMemory']), ...additionalArgs]

    debug('Launching DynamoDB Local with args:', args)
    await this.install()

    try {
      const child = Bun.spawn(['java', ...args], {
        cwd: config.installPath,
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

  stop(port: number): void {
    const process = runningProcesses[port]
    if (process) {
      process.kill('SIGKILL')
      delete runningProcesses[port]
    }
  },

  async install(): Promise<void> {
    const installPathExists = await exists(config.installPath)
    if (!installPathExists)
      await promisify(fs.mkdir)(config.installPath)

    const jarPath = path.join(config.installPath, JARNAME)
    const jarExists = await exists(jarPath)
    if (jarExists)
      return

    debug('Installing DynamoDB Local...')
    const downloadUrl = config.downloadUrl
    await new Promise((resolve, reject) => {
      https.get(downloadUrl, (response) => {
        if (response.statusCode !== 200)
          return reject(new Error(`Failed to download DynamoDB Local: ${response.statusCode}`))

        response.pipe(zlib.createUnzip()).pipe(tar.extract({ cwd: config.installPath }))
          .on('finish', resolve)
          .on('error', reject)
      }).on('error', reject)
    })
  },
}
