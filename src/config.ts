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

// Lazy-loaded config to avoid top-level await (enables bun --compile)
let _config: Config | null = null

export async function getConfig(): Promise<Config> {
  if (!_config) {
    _config = await loadConfig({
  name: 'dynamodb',
  cwd: resolve(__dirname, '..'),
  defaultConfig,
})
  }
  return _config
}

// For backwards compatibility - synchronous access with default fallback
export const config: Config = defaultConfig
