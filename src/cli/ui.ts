// ============================================================================
// CLI UI Utilities
// ============================================================================
// Enhanced console output with colors, spinners, tables, and formatting

import nodeProcess from 'node:process'

// ============================================================================
// ANSI Color Codes
// ============================================================================

const isColorSupported = nodeProcess.stdout.isTTY && !nodeProcess.env.NO_COLOR

const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  italic: isColorSupported ? '\x1b[3m' : '',
  underline: isColorSupported ? '\x1b[4m' : '',

  // Foreground colors
  black: isColorSupported ? '\x1b[30m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  white: isColorSupported ? '\x1b[37m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',

  // Background colors
  bgRed: isColorSupported ? '\x1b[41m' : '',
  bgGreen: isColorSupported ? '\x1b[42m' : '',
  bgYellow: isColorSupported ? '\x1b[43m' : '',
  bgBlue: isColorSupported ? '\x1b[44m' : '',
}

// ============================================================================
// Text Formatting
// ============================================================================

export const c = {
  reset: (s: string): string => `${colors.reset}${s}${colors.reset}`,
  bold: (s: string): string => `${colors.bold}${s}${colors.reset}`,
  dim: (s: string): string => `${colors.dim}${s}${colors.reset}`,
  italic: (s: string): string => `${colors.italic}${s}${colors.reset}`,
  underline: (s: string): string => `${colors.underline}${s}${colors.reset}`,

  black: (s: string): string => `${colors.black}${s}${colors.reset}`,
  red: (s: string): string => `${colors.red}${s}${colors.reset}`,
  green: (s: string): string => `${colors.green}${s}${colors.reset}`,
  yellow: (s: string): string => `${colors.yellow}${s}${colors.reset}`,
  blue: (s: string): string => `${colors.blue}${s}${colors.reset}`,
  magenta: (s: string): string => `${colors.magenta}${s}${colors.reset}`,
  cyan: (s: string): string => `${colors.cyan}${s}${colors.reset}`,
  white: (s: string): string => `${colors.white}${s}${colors.reset}`,
  gray: (s: string): string => `${colors.gray}${s}${colors.reset}`,

  // Semantic colors
  success: (s: string): string => `${colors.green}${s}${colors.reset}`,
  error: (s: string): string => `${colors.red}${s}${colors.reset}`,
  warning: (s: string): string => `${colors.yellow}${s}${colors.reset}`,
  info: (s: string): string => `${colors.blue}${s}${colors.reset}`,
  muted: (s: string): string => `${colors.gray}${s}${colors.reset}`,

  // Combined styles
  header: (s: string): string => `${colors.bold}${colors.cyan}${s}${colors.reset}`,
  subheader: (s: string): string => `${colors.bold}${colors.white}${s}${colors.reset}`,
  label: (s: string): string => `${colors.dim}${s}${colors.reset}`,
  value: (s: string): string => `${colors.bold}${s}${colors.reset}`,
  code: (s: string): string => `${colors.cyan}${s}${colors.reset}`,
  path: (s: string): string => `${colors.underline}${colors.blue}${s}${colors.reset}`,
}

// ============================================================================
// Icons
// ============================================================================

export const icons = {
  success: isColorSupported ? '✓' : '[OK]',
  error: isColorSupported ? '✗' : '[ERROR]',
  warning: isColorSupported ? '⚠' : '[WARN]',
  info: isColorSupported ? 'ℹ' : '[INFO]',
  bullet: isColorSupported ? '•' : '*',
  arrow: isColorSupported ? '→' : '->',
  arrowRight: isColorSupported ? '›' : '>',
  check: isColorSupported ? '✓' : '[x]',
  cross: isColorSupported ? '✗' : '[X]',
  circle: isColorSupported ? '○' : '[ ]',
  circleFilled: isColorSupported ? '●' : '[*]',
  triangleRight: isColorSupported ? '▶' : '>',
  triangleDown: isColorSupported ? '▼' : 'v',
  box: isColorSupported ? '□' : '[ ]',
  boxChecked: isColorSupported ? '☑' : '[x]',
  star: isColorSupported ? '★' : '*',
  sparkles: isColorSupported ? '✨' : '*',
  rocket: isColorSupported ? '🚀' : '[LAUNCH]',
  database: isColorSupported ? '🗄' : '[DB]',
  table: isColorSupported ? '📋' : '[TABLE]',
  key: isColorSupported ? '🔑' : '[KEY]',
  lock: isColorSupported ? '🔒' : '[LOCK]',
  link: isColorSupported ? '🔗' : '[LINK]',
  clock: isColorSupported ? '⏱' : '[TIME]',
  lightning: isColorSupported ? '⚡' : '[FAST]',
}

// ============================================================================
// Spinner
// ============================================================================

const spinnerFrames = isColorSupported
  ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  : ['-', '\\', '|', '/']

export interface Spinner {
  start: (message?: string) => void
  stop: (finalMessage?: string) => void
  update: (message: string) => void
  succeed: (message?: string) => void
  fail: (message?: string) => void
  warn: (message?: string) => void
}

export function createSpinner(initialMessage = ''): Spinner {
  let intervalId: ReturnType<typeof setInterval> | null = null
  let frameIndex = 0
  let currentMessage = initialMessage

  const clearLine = (): void => {
    if (nodeProcess.stdout.isTTY) {
      nodeProcess.stdout.write('\r\x1b[K')
    }
  }

  const render = (): void => {
    clearLine()
    const frame = c.cyan(spinnerFrames[frameIndex])
    nodeProcess.stdout.write(`${frame} ${currentMessage}`)
    frameIndex = (frameIndex + 1) % spinnerFrames.length
  }

  return {
    start(message?: string): void {
      if (message) currentMessage = message
      if (!nodeProcess.stdout.isTTY) {
        console.log(currentMessage)
        return
      }
      intervalId = setInterval(render, 80)
      render()
    },

    stop(finalMessage?: string): void {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      clearLine()
      if (finalMessage) {
        console.log(finalMessage)
      }
    },

    update(message: string): void {
      currentMessage = message
    },

    succeed(message?: string): void {
      this.stop(`${c.success(icons.success)} ${message ?? currentMessage}`)
    },

    fail(message?: string): void {
      this.stop(`${c.error(icons.error)} ${message ?? currentMessage}`)
    },

    warn(message?: string): void {
      this.stop(`${c.warning(icons.warning)} ${message ?? currentMessage}`)
    },
  }
}

// ============================================================================
// Progress Bar
// ============================================================================

export interface ProgressBar {
  start: (total: number, message?: string) => void
  update: (current: number, message?: string) => void
  stop: (message?: string) => void
}

export function createProgressBar(width = 30): ProgressBar {
  let total = 0
  let currentMessage = ''

  const render = (current: number): void => {
    if (!nodeProcess.stdout.isTTY) return

    const percent = Math.min(100, Math.floor((current / total) * 100))
    const filled = Math.floor((current / total) * width)
    const empty = width - filled

    const bar = c.green('█'.repeat(filled)) + c.gray('░'.repeat(empty))
    const percentStr = `${percent}%`.padStart(4)

    nodeProcess.stdout.write(`\r${bar} ${c.bold(percentStr)} ${c.dim(currentMessage)}`)
  }

  return {
    start(t: number, message = ''): void {
      total = t
      currentMessage = message
      if (!nodeProcess.stdout.isTTY) {
        console.log(`Progress: 0/${total} ${message}`)
        return
      }
      render(0)
    },

    update(current: number, message?: string): void {
      if (message) currentMessage = message
      if (!nodeProcess.stdout.isTTY) {
        const percent = Math.floor((current / total) * 100)
        if (percent % 25 === 0) {
          console.log(`Progress: ${current}/${total} (${percent}%)`)
        }
        return
      }
      render(current)
    },

    stop(message?: string): void {
      if (nodeProcess.stdout.isTTY) {
        nodeProcess.stdout.write('\r\x1b[K')
      }
      if (message) {
        console.log(message)
      }
    },
  }
}

// ============================================================================
// Table Formatting
// ============================================================================

export interface TableColumn {
  key: string
  header: string
  width?: number
  align?: 'left' | 'right' | 'center'
  format?: (value: unknown) => string
}

export interface TableOptions {
  columns: TableColumn[]
  border?: boolean
  headerColor?: (s: string) => string
  compact?: boolean
}

export function formatTable(
  data: Record<string, unknown>[],
  options: TableOptions,
): string {
  const { columns, border = true, headerColor = c.bold, compact = false } = options

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerWidth = col.header.length
    const dataWidth = data.reduce((max, row) => {
      const value = col.format
        ? col.format(row[col.key])
        : String(row[col.key] ?? '')
      return Math.max(max, stripAnsi(value).length)
    }, 0)
    return col.width ?? Math.max(headerWidth, dataWidth)
  })

  // Formatting helpers
  const pad = (s: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string => {
    const strLen = stripAnsi(s).length
    const padding = width - strLen
    if (padding <= 0) return s.slice(0, width)

    switch (align) {
      case 'right':
        return ' '.repeat(padding) + s
      case 'center': {
        const left = Math.floor(padding / 2)
        const right = padding - left
        return ' '.repeat(left) + s + ' '.repeat(right)
      }
      default:
        return s + ' '.repeat(padding)
    }
  }

  const lines: string[] = []

  // Border characters
  const b = border
    ? {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
        leftT: '├',
        rightT: '┤',
        topT: '┬',
        bottomT: '┴',
        cross: '┼',
      }
    : {
        topLeft: '',
        topRight: '',
        bottomLeft: '',
        bottomRight: '',
        horizontal: '',
        vertical: ' ',
        leftT: '',
        rightT: '',
        topT: '',
        bottomT: '',
        cross: '',
      }

  // Top border
  if (border) {
    lines.push(
      c.dim(b.topLeft + widths.map(w => b.horizontal.repeat(w + 2)).join(b.topT) + b.topRight),
    )
  }

  // Header
  const headerCells = columns.map((col, i) =>
    pad(headerColor(col.header), widths[i], col.align),
  )
  lines.push(`${c.dim(b.vertical)} ${headerCells.join(` ${c.dim(b.vertical)} `)} ${c.dim(b.vertical)}`)

  // Header separator
  if (border) {
    lines.push(
      c.dim(b.leftT + widths.map(w => b.horizontal.repeat(w + 2)).join(b.cross) + b.rightT),
    )
  }

  // Data rows
  for (const row of data) {
    const cells = columns.map((col, i) => {
      const value = col.format
        ? col.format(row[col.key])
        : String(row[col.key] ?? '')
      return pad(value, widths[i], col.align)
    })
    lines.push(`${c.dim(b.vertical)} ${cells.join(` ${c.dim(b.vertical)} `)} ${c.dim(b.vertical)}`)

    if (!compact && border && data.indexOf(row) < data.length - 1) {
      lines.push(
        c.dim(b.leftT + widths.map(w => b.horizontal.repeat(w + 2)).join(b.cross) + b.rightT),
      )
    }
  }

  // Bottom border
  if (border) {
    lines.push(
      c.dim(b.bottomLeft + widths.map(w => b.horizontal.repeat(w + 2)).join(b.bottomT) + b.bottomRight),
    )
  }

  return lines.join('\n')
}

// ============================================================================
// Box / Panel
// ============================================================================

export interface BoxOptions {
  title?: string
  padding?: number
  borderColor?: (s: string) => string
  titleColor?: (s: string) => string
  width?: number
}

export function box(content: string, options: BoxOptions = {}): string {
  const {
    title,
    padding = 1,
    borderColor = c.dim,
    titleColor = c.bold,
    width: maxWidth,
  } = options

  const lines = content.split('\n')
  const contentWidth = maxWidth
    ?? Math.max(...lines.map(l => stripAnsi(l).length), title ? stripAnsi(title).length : 0)
  const innerWidth = contentWidth + padding * 2

  const result: string[] = []

  // Top border with optional title
  if (title) {
    const titleStr = ` ${titleColor(title)} `
    const titleLen = stripAnsi(titleStr).length
    const remaining = innerWidth - titleLen
    const left = Math.floor(remaining / 2)
    const right = remaining - left
    result.push(borderColor('┌' + '─'.repeat(left) + titleStr + '─'.repeat(right) + '┐'))
  }
  else {
    result.push(borderColor('┌' + '─'.repeat(innerWidth) + '┐'))
  }

  // Top padding
  for (let i = 0; i < padding; i++) {
    result.push(borderColor('│') + ' '.repeat(innerWidth) + borderColor('│'))
  }

  // Content
  for (const line of lines) {
    const lineLen = stripAnsi(line).length
    const leftPad = ' '.repeat(padding)
    const rightPad = ' '.repeat(innerWidth - padding - lineLen)
    result.push(borderColor('│') + leftPad + line + rightPad + borderColor('│'))
  }

  // Bottom padding
  for (let i = 0; i < padding; i++) {
    result.push(borderColor('│') + ' '.repeat(innerWidth) + borderColor('│'))
  }

  // Bottom border
  result.push(borderColor('└' + '─'.repeat(innerWidth) + '┘'))

  return result.join('\n')
}

// ============================================================================
// Tree View
// ============================================================================

export interface TreeNode {
  label: string
  children?: TreeNode[]
  icon?: string
  color?: (s: string) => string
}

export function formatTree(nodes: TreeNode[], prefix = ''): string {
  const lines: string[] = []

  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1
    const connector = isLast ? '└── ' : '├── '
    const icon = node.icon ? `${node.icon} ` : ''
    const label = node.color ? node.color(node.label) : node.label

    lines.push(`${prefix}${c.dim(connector)}${icon}${label}`)

    if (node.children && node.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ')
      lines.push(formatTree(node.children, childPrefix))
    }
  })

  return lines.join('\n')
}

// ============================================================================
// Key-Value List
// ============================================================================

export interface KeyValueOptions {
  labelWidth?: number
  separator?: string
  labelColor?: (s: string) => string
  valueColor?: (s: string) => string
}

export function formatKeyValue(
  data: Record<string, unknown>,
  options: KeyValueOptions = {},
): string {
  const {
    labelWidth = Math.max(...Object.keys(data).map(k => k.length)),
    separator = ':',
    labelColor = c.dim,
    valueColor = c.reset,
  } = options

  return Object.entries(data)
    .map(([key, value]) => {
      const paddedKey = key.padEnd(labelWidth)
      return `${labelColor(paddedKey)} ${separator} ${valueColor(String(value))}`
    })
    .join('\n')
}

// ============================================================================
// Diff Formatting
// ============================================================================

export function formatDiff(added: string[], removed: string[], modified: string[] = []): string {
  const lines: string[] = []

  for (const item of removed) {
    lines.push(c.red(`- ${item}`))
  }
  for (const item of added) {
    lines.push(c.green(`+ ${item}`))
  }
  for (const item of modified) {
    lines.push(c.yellow(`~ ${item}`))
  }

  return lines.join('\n')
}

// ============================================================================
// Messages
// ============================================================================

export function success(message: string): void {
  console.log(`${c.success(icons.success)} ${message}`)
}

export function error(message: string): void {
  console.log(`${c.error(icons.error)} ${message}`)
}

export function warning(message: string): void {
  console.log(`${c.warning(icons.warning)} ${message}`)
}

export function info(message: string): void {
  console.log(`${c.info(icons.info)} ${message}`)
}

export function bullet(message: string): void {
  console.log(`  ${c.dim(icons.bullet)} ${message}`)
}

export function step(number: number, total: number, message: string): void {
  const progress = c.dim(`[${number}/${total}]`)
  console.log(`${progress} ${message}`)
}

export function header(title: string, subtitle?: string): void {
  console.log()
  console.log(c.header(title))
  if (subtitle) {
    console.log(c.muted(subtitle))
  }
  console.log()
}

export function divider(char = '─', width = 60): void {
  console.log(c.dim(char.repeat(width)))
}

export function newline(): void {
  console.log()
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Strip ANSI escape codes from string
 */
export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(s: string, maxLength: number): string {
  if (stripAnsi(s).length <= maxLength) return s
  return s.slice(0, maxLength - 1) + '…'
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * Format number with commas
 */
export function formatNumber(n: number): string {
  return n.toLocaleString()
}
