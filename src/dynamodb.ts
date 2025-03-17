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
import { config } from './config'
import { exists } from './utils'

const debug = Debug('dynamodb-local')
const JARNAME = 'DynamoDBLocal.jar'

export const runningProcesses: { [port: number]: Subprocess } = {}

export const dynamoDb = {
  async launch(options?: LaunchOptions): Promise<Subprocess | undefined> {
    const {
      port = 8000,
      dbPath = '',
      additionalArgs = ['-sharedDb'],
      verbose = false,
      detached = false,
      javaOpts = '',
    } = options ?? {}

    if (runningProcesses[port])
      return runningProcesses[port]

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
    ]

    // console.log('args', ...args)
    // console.log('javaOpts', javaOpts)
    // console.log('dbPath', dbPath)

    debug('Launching DynamoDB Local with args:', args)

    try {
      await this.install()

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

    // eslint-disable-next-line no-console
    console.log('Installing DynamoDB locally...')
    const downloadUrl = config.downloadUrl
    await new Promise((resolve, reject) => {
      https
        .get(downloadUrl, (response) => {
          if (response.statusCode !== 200)
            return reject(new Error(`Failed to download DynamoDB Local: ${response.statusCode}`))

          response
            .pipe(zlib.createUnzip())
            // @ts-expect-error: Ignoring type error due to external library incompatibility
            .pipe(tar.extract({ cwd: config.installPath }))
            .on('finish', resolve)
            .on('error', reject)
        })
        .on('error', reject)
    })
  },
}
