import { loadConfig } from 'c12'

export interface Config {
  installPath: string
  downloadUrl: string
}

// Get loaded config
const { config } = await loadConfig({
  name: 'dynamodb',
  defaultConfig: {
    installPath: 'dynamodb-local',
    downloadUrl: 'https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz',
  },
}) as { config: Config }

export { config }
