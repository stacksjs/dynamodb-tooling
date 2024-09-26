import type { Config } from './types'
import { loadConfig } from 'c12'

// Define an async function to load the config
async function loadDynamoDBConfig() {
  const { config } = await loadConfig({
    name: 'dynamodb',
    defaultConfig: {
      port: 8000,
      dbPath: '',
      detached: false,
      additionalArgs: ['-sharedDb'],
      javaOpts: '',
      installPath: 'dynamodb-local',
      downloadUrl: 'https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz',
    },
  }) as { config: Config }

  return config
}

// Export the config (wrapped in a promise)
// eslint-disable-next-line antfu/no-top-level-await
export const config = await loadDynamoDBConfig()
