import * as path from 'node:path'
import * as os from 'node:os'
import type { Config } from './src/types'

export default {
  port: 8000,
  dbPath: '',
  detached: false,
  additionalArgs: [],
  javaOpts: '',
  installPath: path.join(os.tmpdir(), 'dynamodb-local'),
  downloadUrl: 'https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.tar.gz', // the official download URL
} satisfies Config
