import { loadConfig } from 'c12'
import type { Config } from './types'

// Get loaded config
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

export { config }
