/**
 * Analytics Dashboard Utilities
 */

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format a number with locale-aware separators
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format a number as compact (1.2K, 3.4M, etc.)
 */
export function formatCompact(value: number): string {
  if (value < 1000)
    return String(value)
  if (value < 1000000)
    return `${(value / 1000).toFixed(1)}K`
  if (value < 1000000000)
    return `${(value / 1000000).toFixed(1)}M`
  return `${(value / 1000000000).toFixed(1)}B`
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000)
    return `${ms}ms`

  const seconds = Math.floor(ms / 1000)
  if (seconds < 60)
    return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value)
}

/**
 * Format a change percentage with + or - sign
 */
export function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'time' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'long':
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    case 'time':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    default:
      return d.toLocaleDateString()
  }
}

/**
 * Format date range for display
 */
export function formatDateRange(start: Date, end: Date): string {
  const startStr = formatDate(start, 'short')
  const endStr = formatDate(end, 'short')

  if (startStr === endStr)
    return startStr

  return `${startStr} - ${endStr}`
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60)
    return 'just now'
  if (diffSeconds < 3600)
    return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400)
    return `${Math.floor(diffSeconds / 3600)}h ago`
  if (diffSeconds < 604800)
    return `${Math.floor(diffSeconds / 86400)}d ago`

  return formatDate(d, 'short')
}

// ============================================================================
// Date Range Helpers
// ============================================================================

export interface DateRangePreset {
  label: string
  value: string
  getRange: () => { start: Date, end: Date }
}

export const dateRangePresets: DateRangePreset[] = [
  {
    label: 'Today',
    value: 'today',
    getRange: () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      return { start, end: new Date() }
    },
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getRange: () => {
      const start = new Date()
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    },
  },
  {
    label: 'Last 7 days',
    value: '7d',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    },
  },
  {
    label: 'Last 30 days',
    value: '30d',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    },
  },
  {
    label: 'Last 90 days',
    value: '90d',
    getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 90)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    },
  },
  {
    label: 'This month',
    value: 'month',
    getRange: () => {
      const start = new Date()
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      return { start, end: new Date() }
    },
  },
  {
    label: 'Last month',
    value: 'lastMonth',
    getRange: () => {
      const end = new Date()
      end.setDate(0) // Last day of previous month
      end.setHours(23, 59, 59, 999)
      const start = new Date(end)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    },
  },
  {
    label: 'This year',
    value: 'year',
    getRange: () => {
      const start = new Date()
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: new Date() }
    },
  },
]

/**
 * Get date range from preset value
 */
export function getDateRangeFromPreset(preset: string): { start: Date, end: Date } | null {
  const found = dateRangePresets.find(p => p.value === preset)
  return found ? found.getRange() : null
}

// ============================================================================
// Chart Helpers
// ============================================================================

/**
 * Generate chart gradient
 */
export function createChartGradient(
  ctx: CanvasRenderingContext2D,
  color: string,
  height: number,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, `${color}40`)
  gradient.addColorStop(1, `${color}00`)
  return gradient
}

/**
 * Calculate nice axis ticks
 */
export function calculateAxisTicks(min: number, max: number, count = 5): number[] {
  const range = max - min
  const roughStep = range / (count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const residual = roughStep / magnitude

  let step: number
  if (residual > 5)
    step = 10 * magnitude
  else if (residual > 2)
    step = 5 * magnitude
  else if (residual > 1)
    step = 2 * magnitude
  else step = magnitude

  const ticks: number[] = []
  const start = Math.floor(min / step) * step
  for (let tick = start; tick <= max; tick += step) {
    ticks.push(tick)
  }

  return ticks
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Calculate percentage change between two values
 */
export function calculateChange(current: number, previous: number): number {
  if (previous === 0)
    return current > 0 ? 1 : 0
  return (current - previous) / previous
}

/**
 * Aggregate time series data by period
 */
export function aggregateTimeSeries<T extends { date: string }>(
  data: T[],
  period: 'hour' | 'day' | 'week' | 'month',
  aggregator: (items: T[]) => Omit<T, 'date'>,
): T[] {
  const grouped = new Map<string, T[]>()

  for (const item of data) {
    const date = new Date(item.date)
    let key: string

    switch (period) {
      case 'hour':
        key = `${date.toISOString().slice(0, 13)}:00:00`
        break
      case 'day':
        key = date.toISOString().slice(0, 10)
        break
      case 'week': {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().slice(0, 10)
        break
      }
      case 'month':
        key = date.toISOString().slice(0, 7)
        break
    }

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(item)
  }

  return Array.from(grouped.entries()).map(([date, items]) => ({
    date,
    ...aggregator(items),
  })) as T[]
}

/**
 * Fill missing dates in time series
 */
export function fillMissingDates<T extends { date: string }>(
  data: T[],
  startDate: Date,
  endDate: Date,
  defaultValue: Omit<T, 'date'>,
): T[] {
  const result: T[] = []
  const dataMap = new Map(data.map(d => [d.date.slice(0, 10), d]))

  const current = new Date(startDate)
  while (current <= endDate) {
    const dateKey = current.toISOString().slice(0, 10)
    const existing = dataMap.get(dateKey)

    if (existing) {
      result.push(existing)
    }
    else {
      result.push({ date: dateKey, ...defaultValue } as T)
    }

    current.setDate(current.getDate() + 1)
  }

  return result
}

// ============================================================================
// Color Helpers
// ============================================================================

/**
 * Convert hex to RGB
 */
export function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

/**
 * Add alpha to hex color
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb)
    return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/**
 * Generate color palette for charts
 */
export function generateColorPalette(baseColor: string, count: number): string[] {
  const colors: string[] = []
  const rgb = hexToRgb(baseColor)
  if (!rgb)
    return [baseColor]

  for (let i = 0; i < count; i++) {
    const factor = 1 - (i * 0.15)
    colors.push(
      `rgb(${Math.round(rgb.r * factor)}, ${Math.round(rgb.g * factor)}, ${Math.round(rgb.b * factor)})`,
    )
  }

  return colors
}
