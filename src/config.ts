import type { Config } from './types'
import { resolve } from 'node:path'
import { loadConfig } from 'bunfig'

export const defaultConfig: Config = {
  port: 8000,
  defaultTableName: 'MyOfflineTable',
  dbPath: '',
  detached: false,
  additionalArgs: ['-sharedDb'],
  javaOpts: '',
  installPath: 'dynamodb-local',
  downloadUrl: 'https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz',
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: Config = await loadConfig({
  name: 'dynamodb',
  cwd: resolve(__dirname, '..'),
  defaultConfig,
})
