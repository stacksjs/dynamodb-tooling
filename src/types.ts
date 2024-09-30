export interface Config {
  defaultTableName: string
  port: number
  dbPath: string
  detached: boolean
  additionalArgs: string[]
  javaOpts: string
  installPath: string
  downloadUrl: string
}

export type LaunchOptions = Partial<Pick<Config, 'port' | 'dbPath' | 'detached' | 'additionalArgs' | 'javaOpts'>> & {
  // any additional properties not in Config
  verbose?: boolean
}
