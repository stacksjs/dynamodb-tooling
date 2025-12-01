/**
 * Analytics Dashboard Module
 *
 * Vue 3 dashboard components and utilities for displaying
 * privacy-focused analytics data.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { AnalyticsDashboard } from '@stacksjs/dynamodb-tooling/analytics/dashboard'
 *
 * const config = {
 *   baseUrl: '/api/analytics',
 *   siteId: 'my-site',
 * }
 * </script>
 *
 * <template>
 *   <AnalyticsDashboard :config="config" />
 * </template>
 * ```
 */

// Components
export {
  AnalyticsDashboard,
  DateRangePicker,
  DeviceBreakdown,
  RealtimeCounter,
  StatCard,
  TimeSeriesChart,
  TopList,
} from './components'

// Composables
export {
  AnalyticsClient,
  createAnalyticsComposable,
  createRealtimePoller,
  fetchDashboardData,
} from './composables/useAnalytics'

// Re-export as useAnalytics alias for convenience
export { createAnalyticsComposable as useAnalytics } from './composables/useAnalytics'

// Types
export type {
  AnalyticsApiConfig,
  ChartProps,
  DashboardSummary,
  DashboardTheme,
  DateRange,
  RealtimeCounterProps,
  RealtimeData,
  StatCardProps,
  TimeSeriesDataPoint,
  TopItem,
  TopListProps,
} from './types'

// Theme
export { defaultTheme, darkTheme } from './types'

// Utilities
export {
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
  type DateRangePreset,
} from './utils'

// Re-export with common alias names
export { calculateChange as calculatePercentageChange } from './utils'
export { getDateRangeFromPreset as getDateRangePreset } from './utils'
