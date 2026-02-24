declare module 'cac' {
  export class CAC {
    constructor(name?: string)
    command(name: string, description?: string): any
    help(): this
    version(version: string): this
    parse(argv?: string[]): any
    option(name: string, description?: string, config?: any): this
  }
  export function cac(_name?: string): CAC
  export default cac
}

declare module 'debug' {
  interface Debug {
    (formatter: string, ...args: any[]): void
    enabled: boolean
    namespace: string
  }
  interface DebugFactory {
    (namespace: string): Debug
  }
  const debug: DebugFactory
  export default debug
}
