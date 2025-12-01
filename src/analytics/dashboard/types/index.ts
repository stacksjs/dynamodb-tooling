/**
 * Analytics Dashboard Types
 */

// ============================================================================
// Dashboard Data Types
// ============================================================================

export interface DashboardStats {
  pageViews: number
  uniqueVisitors: number
  sessions: number
  bounceRate: number
  avgSessionDuration: number
  avgPagesPerSession: number
}

export interface StatsChange {
  pageViews: number
  uniqueVisitors: number
  sessions: number
  bounceRate: number
  avgSessionDuration: number
}

export interface DashboardSummary extends DashboardStats {
  change?: StatsChange
}

export interface TimeSeriesDataPoint {
  date: string
  pageViews: number
  uniqueVisitors: number
  sessions: number
}

export interface TopItem {
  name: string
  value: number
  percentage: number
  change?: number
}

export interface RealtimeData {
  currentVisitors: number
  pageViewsLastHour: number
  topActivePages: TopItem[]
}

export interface DeviceBreakdown {
  desktop: number
  mobile: number
  tablet: number
}

export interface BrowserStats {
  name: string
  visitors: number
  percentage: number
}

export interface CountryStats {
  country: string
  countryCode: string
  visitors: number
  percentage: number
}

export interface GoalConversion {
  goalId: string
  goalName: string
  conversions: number
  conversionRate: number
  revenue: number
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface StatCardProps {
  title: string
  value: number | string
  change?: number
  changeLabel?: string
  icon?: string
  format?: 'number' | 'percentage' | 'duration' | 'currency'
  loading?: boolean
}

export interface TopListProps {
  title: string
  items: TopItem[]
  loading?: boolean
  showPercentage?: boolean
  maxItems?: number
  emptyMessage?: string
}

export interface ChartProps {
  data: TimeSeriesDataPoint[]
  loading?: boolean
  height?: number
  showLegend?: boolean
  metrics?: Array<'pageViews' | 'uniqueVisitors' | 'sessions'>
}

export interface RealtimeCounterProps {
  count: number
  label?: string
  pulseColor?: string
  loading?: boolean
}

export interface DateRangeOption {
  label: string
  value: string
  days: number
}

export interface DateRange {
  start: Date
  end: Date
  preset?: string
}

// ============================================================================
// API Types
// ============================================================================

export interface AnalyticsApiConfig {
  baseUrl: string
  siteId: string
  headers?: Record<string, string>
}

export interface FetchOptions {
  startDate?: Date
  endDate?: Date
  period?: 'hour' | 'day' | 'month'
  limit?: number
}

// ============================================================================
// Theme Types
// ============================================================================

export interface DashboardTheme {
  primary: string
  secondary: string
  success: string
  warning: string
  danger: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  chart: {
    pageViews: string
    visitors: string
    sessions: string
    grid: string
  }
}

export const defaultTheme: DashboardTheme = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#ffffff',
  surface: '#f8fafc',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  chart: {
    pageViews: '#6366f1',
    visitors: '#22c55e',
    sessions: '#f59e0b',
    grid: '#e2e8f0',
  },
}

export const darkTheme: DashboardTheme = {
  primary: '#818cf8',
  secondary: '#a78bfa',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#f87171',
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  border: '#334155',
  chart: {
    pageViews: '#818cf8',
    visitors: '#4ade80',
    sessions: '#fbbf24',
    grid: '#334155',
  },
}
