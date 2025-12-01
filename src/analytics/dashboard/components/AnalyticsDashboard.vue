<script setup lang="ts">
/**
 * AnalyticsDashboard Component
 *
 * Main dashboard layout combining all analytics components.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type {
  AnalyticsApiConfig,
  DashboardSummary,
  DateRange,
  RealtimeData,
  TimeSeriesDataPoint,
  TopItem,
} from '../types'
import { createAnalyticsComposable, createRealtimePoller } from '../composables/useAnalytics'
import DateRangePicker from './DateRangePicker.vue'
import DeviceBreakdown from './DeviceBreakdown.vue'
import RealtimeCounter from './RealtimeCounter.vue'
import StatCard from './StatCard.vue'
import TimeSeriesChart from './TimeSeriesChart.vue'
import TopList from './TopList.vue'

const props = withDefaults(defineProps<{
  config: AnalyticsApiConfig
  refreshInterval?: number
  realtimeInterval?: number
}>(), {
  refreshInterval: 60000, // 1 minute
  realtimeInterval: 5000, // 5 seconds
})

// State
const loading = ref(true)
const error = ref<Error | null>(null)
const stats = ref<DashboardSummary | null>(null)
const realtime = ref<RealtimeData | null>(null)
const timeSeries = ref<TimeSeriesDataPoint[]>([])
const topPages = ref<TopItem[]>([])
const topReferrers = ref<TopItem[]>([])
const devices = ref<TopItem[]>([])
const dateRange = ref<DateRange>({
  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  end: new Date(),
  preset: '7d',
})

// Analytics composable
const analytics = createAnalyticsComposable({
  ...props.config,
  initialDateRange: '7d',
})

// Realtime poller
let realtimePoller: ReturnType<typeof createRealtimePoller> | null = null

// Fetch all data
async function fetchData() {
  loading.value = true
  error.value = null

  try {
    const [
      statsData,
      timeSeriesData,
      pagesData,
      referrersData,
      devicesData,
    ] = await Promise.all([
      analytics.fetchStats(dateRange.value),
      analytics.fetchTimeSeries(dateRange.value),
      analytics.fetchTopPages(dateRange.value, 10),
      analytics.fetchTopReferrers(dateRange.value, 10),
      analytics.fetchDevices(dateRange.value),
    ])

    stats.value = statsData
    timeSeries.value = timeSeriesData
    topPages.value = pagesData
    topReferrers.value = referrersData
    devices.value = devicesData
  }
  catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err))
  }
  finally {
    loading.value = false
  }
}

// Handle realtime updates
function handleRealtimeUpdate(data: RealtimeData) {
  realtime.value = data
}

// Refresh interval
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchData()

  // Start realtime polling
  realtimePoller = createRealtimePoller(props.config, handleRealtimeUpdate, props.realtimeInterval)
  realtimePoller.start()

  // Start auto-refresh
  if (props.refreshInterval > 0) {
    refreshTimer = setInterval(fetchData, props.refreshInterval)
  }
})

onUnmounted(() => {
  realtimePoller?.stop()
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})

// Watch date range changes
watch(dateRange, fetchData)

// Computed
const hasData = computed(() => stats.value !== null)
</script>

<template>
  <div class="analytics-dashboard min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Analytics Dashboard
        </h1>
        <p class="text-gray-500 text-sm mt-1">
          Track your website performance
        </p>
      </div>

      <div class="flex items-center gap-4">
        <DateRangePicker v-model="dateRange" />

        <button
          type="button"
          class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          title="Refresh"
          :disabled="loading"
          @click="fetchData"
        >
          <svg
            class="w-5 h-5"
            :class="{ 'animate-spin': loading }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="error"
      class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
    >
      <p class="font-medium">Error loading analytics</p>
      <p class="text-sm mt-1">{{ error.message }}</p>
      <button
        type="button"
        class="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        @click="fetchData"
      >
        Try again
      </button>
    </div>

    <!-- Realtime counter -->
    <div class="mb-6">
      <RealtimeCounter
        :count="realtime?.currentVisitors ?? 0"
        :loading="!realtime"
      >
        <template #details>
          <p v-if="realtime" class="mt-2 text-sm text-gray-500">
            {{ realtime.pageViewsLastHour }} page views in the last hour
          </p>
        </template>
      </RealtimeCounter>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Page Views"
        :value="stats?.pageViews ?? 0"
        :change="stats?.change?.pageViews"
        change-label="vs previous period"
        :loading="loading"
      />
      <StatCard
        title="Unique Visitors"
        :value="stats?.uniqueVisitors ?? 0"
        :change="stats?.change?.uniqueVisitors"
        change-label="vs previous period"
        :loading="loading"
      />
      <StatCard
        title="Bounce Rate"
        :value="stats?.bounceRate ?? 0"
        :change="stats?.change?.bounceRate"
        change-label="vs previous period"
        format="percentage"
        :loading="loading"
      />
      <StatCard
        title="Avg. Session Duration"
        :value="stats?.avgSessionDuration ?? 0"
        :change="stats?.change?.avgSessionDuration"
        change-label="vs previous period"
        format="duration"
        :loading="loading"
      />
    </div>

    <!-- Time series chart -->
    <div class="mb-6">
      <TimeSeriesChart
        :data="timeSeries"
        :loading="loading"
        :height="350"
        :metrics="['pageViews', 'uniqueVisitors']"
      />
    </div>

    <!-- Bottom grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Top pages -->
      <TopList
        title="Top Pages"
        :items="topPages"
        :loading="loading"
        empty-message="No page views yet"
      />

      <!-- Top referrers -->
      <TopList
        title="Top Referrers"
        :items="topReferrers"
        :loading="loading"
        empty-message="No referrer data"
      />

      <!-- Devices -->
      <DeviceBreakdown
        :devices="devices"
        :loading="loading"
      />
    </div>

    <!-- Slot for additional content -->
    <slot name="footer" />
  </div>
</template>

<style scoped>
.analytics-dashboard {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
