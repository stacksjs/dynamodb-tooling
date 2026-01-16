// ============================================================================
// Logger - Structured Logging for DynamoDB Operations
// ============================================================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel
  /** Message */
  message: string
  /** Timestamp */
  timestamp: Date
  /** Operation type */
  operation?: string
  /** Table name */
  tableName?: string
  /** Duration in milliseconds */
  durationMs?: number
  /** Consumed capacity */
  consumedCapacity?: {
    readUnits?: number
    writeUnits?: number
  }
  /** Item count */
  itemCount?: number
  /** Error details */
  error?: {
    name: string
    message: string
    code?: string
    stack?: string
  }
  /** Additional context */
  context?: Record<string, unknown>
  /** Request ID */
  requestId?: string
  /** Tenant ID (if multi-tenant) */
  tenantId?: string
  /** Trace ID (for distributed tracing) */
  traceId?: string
  /** Span ID */
  spanId?: string
  /** Parent span ID */
  parentSpanId?: string
  /** Allow additional properties */
  [key: string]: unknown
}

/**
 * Log transport interface
 */
export interface LogTransport {
  /** Transport name */
  name: string
  /** Write log entry */
  write: (entry: LogEntry) => void | Promise<void>
  /** Flush pending logs */
  flush?: () => void | Promise<void>
  /** Close transport */
  close?: () => void | Promise<void>
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level */
  level: LogLevel
  /** Enable console output */
  console?: boolean
  /** Custom transports */
  transports?: LogTransport[]
  /** Default context to include in all logs */
  defaultContext?: Record<string, unknown>
  /** Enable JSON output */
  json?: boolean
  /** Enable timestamps */
  timestamps?: boolean
  /** Enable colorized output */
  colors?: boolean
  /** Redact sensitive fields */
  redactFields?: string[]
}

/**
 * Console transport
 */
export class ConsoleTransport implements LogTransport {
  name = 'console'
  private json: boolean
  private colors: boolean
  private redactFields: string[]

  private levelColors: Record<LogLevel, string> = {
    debug: '\x1B[90m', // gray
    info: '\x1B[36m', // cyan
    warn: '\x1B[33m', // yellow
    error: '\x1B[31m', // red
    fatal: '\x1B[35m', // magenta
  }

  private reset = '\x1B[0m'

  constructor(options?: { json?: boolean, colors?: boolean, redactFields?: string[], level?: LogLevel }) {
    this.json = options?.json ?? false
    this.colors = options?.colors ?? true
    this.redactFields = options?.redactFields ?? []
  }

  write(entry: LogEntry): void {
    const redacted = this.redactSensitive(entry)

    if (this.json) {
      console.log(JSON.stringify(redacted))
      return
    }

    const timestamp = entry.timestamp.toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    const color = this.colors ? this.levelColors[entry.level] : ''
    const reset = this.colors ? this.reset : ''

    let line = `${color}[${timestamp}] ${level}${reset} ${entry.message}`

    if (entry.operation) {
      line += ` [${entry.operation}]`
    }

    if (entry.tableName) {
      line += ` table=${entry.tableName}`
    }

    if (entry.durationMs !== undefined) {
      line += ` duration=${entry.durationMs}ms`
    }

    if (entry.itemCount !== undefined) {
      line += ` items=${entry.itemCount}`
    }

    if (entry.consumedCapacity) {
      if (entry.consumedCapacity.readUnits !== undefined) {
        line += ` RCU=${entry.consumedCapacity.readUnits}`
      }
      if (entry.consumedCapacity.writeUnits !== undefined) {
        line += ` WCU=${entry.consumedCapacity.writeUnits}`
      }
    }

    console.log(line)

    if (entry.error && (entry.level === 'error' || entry.level === 'fatal')) {
      console.error(`${color}Error: ${entry.error.message}${reset}`)
      if (entry.error.stack) {
        console.error(entry.error.stack)
      }
    }
  }

  private redactSensitive(entry: LogEntry): LogEntry {
    if (this.redactFields.length === 0) {
      return entry
    }

    const redacted = { ...entry }

    if (redacted.context) {
      redacted.context = this.redactObject(redacted.context)
    }

    return redacted
  }

  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (this.redactFields.includes(key.toLowerCase())) {
        result[key] = '[REDACTED]'
      }
      else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.redactObject(value as Record<string, unknown>)
      }
      else {
        result[key] = value
      }
    }

    return result
  }
}

/**
 * File transport for logging to files
 */
export class FileTransport implements LogTransport {
  name = 'file'
  private buffer: string[] = []
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private filePath: string
  private maxBufferSize: number

  constructor(options: { filePath: string, maxBufferSize?: number, flushIntervalMs?: number }) {
    this.filePath = options.filePath
    this.maxBufferSize = options.maxBufferSize ?? 100

    if (options.flushIntervalMs) {
      this.flushInterval = setInterval(() => this.flush(), options.flushIntervalMs)
    }
  }

  write(entry: LogEntry): void {
    this.buffer.push(JSON.stringify(entry))

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0)
      return

    const lines = this.buffer.splice(0, this.buffer.length)
    const content = `${lines.join('\n')}\n`

    // In a real implementation, this would append to file
    // For now, we'll use Bun's file API if available
    try {
      const file = Bun.file(this.filePath)
      const existing = await file.exists() ? await file.text() : ''
      await Bun.write(this.filePath, existing + content)
    }
    catch {
      // Fallback: just log to console if file writing fails
      console.error(`Failed to write to log file: ${this.filePath}`)
    }
  }

  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
}

/**
 * Logger for DynamoDB operations
 */
export class Logger {
  private config: Required<LoggerConfig>
  private transports: LogTransport[] = []
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  }

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: 'info',
      console: true,
      transports: [],
      defaultContext: {},
      json: false,
      timestamps: true,
      colors: true,
      redactFields: ['password', 'secret', 'token', 'apikey', 'api_key'],
      ...config,
    }

    if (this.config.console) {
      this.transports.push(
        new ConsoleTransport({
          json: this.config.json,
          colors: this.config.colors,
          redactFields: this.config.redactFields,
        }),
      )
    }

    this.transports.push(...this.config.transports)
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Partial<LogEntry>): void {
    this.log('debug', message, context)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Partial<LogEntry>): void {
    this.log('info', message, context)
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Partial<LogEntry>): void {
    this.log('warn', message, context)
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: Partial<LogEntry>): void {
    const errorDetails = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as { code?: string }).code,
        }
      : error
        ? { name: 'Error', message: String(error) }
        : undefined

    this.log('error', message, { ...context, error: errorDetails })
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error | unknown, context?: Partial<LogEntry>): void {
    const errorDetails = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as { code?: string }).code,
        }
      : error
        ? { name: 'Error', message: String(error) }
        : undefined

    this.log('fatal', message, { ...context, error: errorDetails })
  }

  /**
   * Log a DynamoDB operation
   */
  operation(
    operation: string,
    tableName: string,
    options: {
      durationMs?: number
      consumedCapacity?: { readUnits?: number, writeUnits?: number }
      itemCount?: number
      success?: boolean
      error?: Error
      context?: Record<string, unknown>
    },
  ): void {
    const level: LogLevel = options.success === false ? 'error' : 'info'
    const message = options.success === false
      ? `${operation} failed`
      : `${operation} completed`

    this.log(level, message, {
      operation,
      tableName,
      durationMs: options.durationMs,
      consumedCapacity: options.consumedCapacity,
      itemCount: options.itemCount,
      error: options.error
        ? {
            name: options.error.name,
            message: options.error.message,
            stack: options.error.stack,
            code: (options.error as { code?: string }).code,
          }
        : undefined,
      context: options.context,
    })
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    return new Logger({
      ...this.config,
      defaultContext: {
        ...this.config.defaultContext,
        ...context,
      },
    })
  }

  /**
   * Add a transport
   */
  addTransport(transport: LogTransport): this {
    this.transports.push(transport)
    return this
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.transports.map(t => t.flush?.()),
    )
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    await Promise.all(
      this.transports.map(t => t.close?.()),
    )
  }

  private log(level: LogLevel, message: string, context?: Partial<LogEntry>): void {
    if (this.levelPriority[level] < this.levelPriority[this.config.level]) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      ...this.config.defaultContext,
      ...context,
    }

    for (const transport of this.transports) {
      try {
        transport.write(entry)
      }
      catch (err) {
        console.error(`Logger transport ${transport.name} failed:`, err)
      }
    }
  }
}

/**
 * Create a logger instance
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config)
}

/**
 * Default logger instance
 */
export const defaultLogger: Logger = createLogger()
