import { describe, expect, it } from 'bun:test'
import {
  calculateAxisTicks,
  calculateChange,
  dateRangePresets,
  formatCompact,
  formatDate,
  formatDateRange,
  formatDuration,
  formatNumber,
  formatPercentage,
  getDateRangeFromPreset,
} from '../src/analytics/dashboard/utils'

describe('Dashboard Utilities', () => {
  describe('formatNumber', () => {
    it('should format integers', () => {
      expect(formatNumber(1000)).toBe('1,000')
      expect(formatNumber(1234567)).toBe('1,234,567')
    })

    it('should format with decimals', () => {
      expect(formatNumber(1234.5678, 2)).toBe('1,234.57')
    })
  })

  describe('formatCompact', () => {
    it('should format small numbers as-is', () => {
      expect(formatCompact(999)).toBe('999')
    })

    it('should format thousands with K', () => {
      expect(formatCompact(1000)).toBe('1.0K')
      expect(formatCompact(1500)).toBe('1.5K')
      expect(formatCompact(999999)).toBe('1000.0K')
    })

    it('should format millions with M', () => {
      expect(formatCompact(1000000)).toBe('1.0M')
      expect(formatCompact(2500000)).toBe('2.5M')
    })

    it('should format billions with B', () => {
      expect(formatCompact(1000000000)).toBe('1.0B')
    })
  })

  describe('formatPercentage', () => {
    it('should format decimal to percentage', () => {
      expect(formatPercentage(0.5)).toBe('50.0%')
      expect(formatPercentage(0.123, 1)).toBe('12.3%')
      expect(formatPercentage(1)).toBe('100.0%')
    })
  })

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms')
    })

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s')
      expect(formatDuration(45000)).toBe('45s')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s')
      expect(formatDuration(120000)).toBe('2m')
    })

    it('should format hours and minutes', () => {
      expect(formatDuration(3600000)).toBe('1h')
      expect(formatDuration(5400000)).toBe('1h 30m')
    })
  })

  describe('formatDate', () => {
    const testDate = new Date('2024-03-15T14:30:00')

    it('should format short date', () => {
      const result = formatDate(testDate, 'short')
      expect(result).toContain('Mar')
      expect(result).toContain('15')
    })

    it('should format long date', () => {
      const result = formatDate(testDate, 'long')
      expect(result).toContain('March')
      expect(result).toContain('15')
      expect(result).toContain('2024')
    })

    it('should accept string dates', () => {
      const result = formatDate('2024-03-15', 'short')
      expect(result).toContain('Mar')
    })
  })

  describe('formatDateRange', () => {
    it('should format date range', () => {
      const start = new Date('2024-03-01')
      const end = new Date('2024-03-15')
      const result = formatDateRange(start, end)
      expect(result).toContain('Mar')
    })

    it('should handle same day', () => {
      const date = new Date('2024-03-15')
      const result = formatDateRange(date, date)
      expect(result).toContain('Mar')
      expect(result).not.toContain(' - ')
    })
  })

  describe('calculateChange', () => {
    it('should calculate positive change', () => {
      expect(calculateChange(150, 100)).toBe(0.5)
    })

    it('should calculate negative change', () => {
      expect(calculateChange(50, 100)).toBe(-0.5)
    })

    it('should handle zero previous value', () => {
      expect(calculateChange(100, 0)).toBe(1)
      expect(calculateChange(0, 0)).toBe(0)
    })
  })

  describe('calculateAxisTicks', () => {
    it('should generate nice tick values', () => {
      const ticks = calculateAxisTicks(0, 100, 5)
      expect(ticks.length).toBeGreaterThan(0)
      expect(ticks[0]).toBe(0)
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100)
    })

    it('should handle large ranges', () => {
      const ticks = calculateAxisTicks(0, 10000, 5)
      expect(ticks.every(t => t >= 0)).toBe(true)
    })
  })

  describe('dateRangePresets', () => {
    it('should have expected presets', () => {
      const presetValues = dateRangePresets.map(p => p.value)
      expect(presetValues).toContain('today')
      expect(presetValues).toContain('yesterday')
      expect(presetValues).toContain('7d')
      expect(presetValues).toContain('30d')
    })

    it('should return valid date ranges', () => {
      for (const preset of dateRangePresets) {
        const range = preset.getRange()
        expect(range.start).toBeInstanceOf(Date)
        expect(range.end).toBeInstanceOf(Date)
        expect(range.start.getTime()).toBeLessThanOrEqual(range.end.getTime())
      }
    })
  })

  describe('getDateRangeFromPreset', () => {
    it('should return date range for valid preset', () => {
      const range = getDateRangeFromPreset('7d')
      expect(range).not.toBeNull()
      expect(range!.start).toBeInstanceOf(Date)
      expect(range!.end).toBeInstanceOf(Date)
    })

    it('should return null for invalid preset', () => {
      const range = getDateRangeFromPreset('invalid')
      expect(range).toBeNull()
    })
  })
})

describe('Dashboard Types', () => {
  it('should export all required types', async () => {
    const dashboardModule = await import('../src/analytics/dashboard')

    // Check components exist (they'll be DefineComponent types)
    expect(dashboardModule.AnalyticsDashboard).toBeDefined()
    expect(dashboardModule.StatCard).toBeDefined()
    expect(dashboardModule.RealtimeCounter).toBeDefined()
    expect(dashboardModule.TopList).toBeDefined()
    expect(dashboardModule.TimeSeriesChart).toBeDefined()
    expect(dashboardModule.DateRangePicker).toBeDefined()
    expect(dashboardModule.DeviceBreakdown).toBeDefined()

    // Check composables
    expect(dashboardModule.AnalyticsClient).toBeDefined()
    expect(dashboardModule.createAnalyticsComposable).toBeDefined()
    expect(dashboardModule.createRealtimePoller).toBeDefined()
    expect(dashboardModule.useAnalytics).toBeDefined()

    // Check themes
    expect(dashboardModule.defaultTheme).toBeDefined()
    expect(dashboardModule.darkTheme).toBeDefined()

    // Check utilities
    expect(dashboardModule.formatNumber).toBeDefined()
    expect(dashboardModule.formatCompact).toBeDefined()
    expect(dashboardModule.formatPercentage).toBeDefined()
    expect(dashboardModule.formatDuration).toBeDefined()
    expect(dashboardModule.formatDate).toBeDefined()
    expect(dashboardModule.dateRangePresets).toBeDefined()
    expect(dashboardModule.calculateAxisTicks).toBeDefined()
  })
})

describe('AnalyticsClient', () => {
  it('should be constructible with config', async () => {
    const { AnalyticsClient } = await import('../src/analytics/dashboard')

    const client = new AnalyticsClient({
      baseUrl: 'https://api.example.com',
      siteId: 'test-site',
    })

    expect(client).toBeInstanceOf(AnalyticsClient)
  })

  it('should accept custom headers', async () => {
    const { AnalyticsClient } = await import('../src/analytics/dashboard')

    const client = new AnalyticsClient({
      baseUrl: 'https://api.example.com',
      siteId: 'test-site',
      headers: {
        Authorization: 'Bearer token123',
      },
    })

    expect(client).toBeInstanceOf(AnalyticsClient)
  })
})

describe('createAnalyticsComposable', () => {
  it('should create composable with methods', async () => {
    const { createAnalyticsComposable } = await import('../src/analytics/dashboard')

    const composable = createAnalyticsComposable({
      baseUrl: 'https://api.example.com',
      siteId: 'test-site',
    })

    expect(composable.client).toBeDefined()
    expect(composable.getInitialDateRange).toBeDefined()
    expect(composable.fetchStats).toBeDefined()
    expect(composable.fetchRealtime).toBeDefined()
    expect(composable.fetchTopPages).toBeDefined()
    expect(composable.fetchTopReferrers).toBeDefined()
    expect(composable.fetchDevices).toBeDefined()
    expect(composable.fetchTimeSeries).toBeDefined()
  })

  it('should compute initial date range based on preset', async () => {
    const { createAnalyticsComposable } = await import('../src/analytics/dashboard')

    const composable7d = createAnalyticsComposable({
      baseUrl: 'https://api.example.com',
      siteId: 'test-site',
      initialDateRange: '7d',
    })

    const range7d = composable7d.getInitialDateRange()
    const daysDiff = Math.round((range7d.end.getTime() - range7d.start.getTime()) / (1000 * 60 * 60 * 24))
    expect(daysDiff).toBeGreaterThanOrEqual(6)
    expect(daysDiff).toBeLessThanOrEqual(8)

    const composable30d = createAnalyticsComposable({
      baseUrl: 'https://api.example.com',
      siteId: 'test-site',
      initialDateRange: '30d',
    })

    const range30d = composable30d.getInitialDateRange()
    const daysDiff30 = Math.round((range30d.end.getTime() - range30d.start.getTime()) / (1000 * 60 * 60 * 24))
    expect(daysDiff30).toBeGreaterThanOrEqual(29)
    expect(daysDiff30).toBeLessThanOrEqual(31)
  })
})

describe('createRealtimePoller', () => {
  it('should create poller with start/stop methods', async () => {
    const { createRealtimePoller } = await import('../src/analytics/dashboard')

    const poller = createRealtimePoller(
      {
        baseUrl: 'https://api.example.com',
        siteId: 'test-site',
      },
      () => {},
      5000,
    )

    expect(poller.start).toBeDefined()
    expect(poller.stop).toBeDefined()
    expect(typeof poller.start).toBe('function')
    expect(typeof poller.stop).toBe('function')
  })
})
