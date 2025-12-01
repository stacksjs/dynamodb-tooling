<script setup lang="ts">
/**
 * TimeSeriesChart Component
 *
 * Displays a time series chart with multiple metrics.
 * Uses Canvas for rendering (no external dependencies).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ChartProps, DashboardTheme, TimeSeriesDataPoint } from '../types'
import { defaultTheme } from '../types'
import { calculateAxisTicks, formatCompact, formatDate } from '../utils'

const props = withDefaults(defineProps<ChartProps & { theme?: DashboardTheme }>(), {
  height: 300,
  showLegend: true,
  metrics: () => ['pageViews', 'uniqueVisitors'],
  loading: false,
  theme: () => defaultTheme,
})

const emit = defineEmits<{
  (e: 'point-hover', point: TimeSeriesDataPoint | null): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const hoveredPoint = ref<TimeSeriesDataPoint | null>(null)
const hoveredIndex = ref<number | null>(null)

const chartColors = computed(() => ({
  pageViews: props.theme.chart.pageViews,
  uniqueVisitors: props.theme.chart.visitors,
  sessions: props.theme.chart.sessions,
}))

const maxValue = computed(() => {
  if (!props.data.length)
    return 100
  let max = 0
  for (const point of props.data) {
    for (const metric of props.metrics) {
      max = Math.max(max, point[metric] || 0)
    }
  }
  return max || 100
})

const yTicks = computed(() => calculateAxisTicks(0, maxValue.value, 5))

function drawChart() {
  const canvas = canvasRef.value
  if (!canvas)
    return

  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  if (!props.data.length)
    return

  // Draw grid lines
  ctx.strokeStyle = props.theme.chart.grid
  ctx.lineWidth = 1

  for (const tick of yTicks.value) {
    const y = padding.top + chartHeight - (tick / maxValue.value) * chartHeight
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()

    // Y-axis labels
    ctx.fillStyle = props.theme.textSecondary
    ctx.font = '12px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(formatCompact(tick), padding.left - 8, y + 4)
  }

  // Draw X-axis labels
  const xStep = Math.ceil(props.data.length / 7) // Show ~7 labels
  ctx.textAlign = 'center'
  for (let i = 0; i < props.data.length; i += xStep) {
    const x = padding.left + (i / (props.data.length - 1)) * chartWidth
    ctx.fillText(formatDate(props.data[i].date, 'short'), x, height - padding.bottom + 20)
  }

  // Draw lines for each metric
  for (const metric of props.metrics) {
    const color = chartColors.value[metric as keyof typeof chartColors.value]

    // Draw area fill
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top + chartHeight)

    for (let i = 0; i < props.data.length; i++) {
      const x = padding.left + (i / (props.data.length - 1)) * chartWidth
      const value = props.data[i][metric] || 0
      const y = padding.top + chartHeight - (value / maxValue.value) * chartHeight

      if (i === 0) {
        ctx.lineTo(x, y)
      }
      else {
        ctx.lineTo(x, y)
      }
    }

    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight)
    ctx.closePath()

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight)
    gradient.addColorStop(0, `${color}30`)
    gradient.addColorStop(1, `${color}05`)
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw line
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2

    for (let i = 0; i < props.data.length; i++) {
      const x = padding.left + (i / (props.data.length - 1)) * chartWidth
      const value = props.data[i][metric] || 0
      const y = padding.top + chartHeight - (value / maxValue.value) * chartHeight

      if (i === 0) {
        ctx.moveTo(x, y)
      }
      else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    // Draw points
    ctx.fillStyle = color
    for (let i = 0; i < props.data.length; i++) {
      const x = padding.left + (i / (props.data.length - 1)) * chartWidth
      const value = props.data[i][metric] || 0
      const y = padding.top + chartHeight - (value / maxValue.value) * chartHeight

      ctx.beginPath()
      ctx.arc(x, y, hoveredIndex.value === i ? 5 : 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Draw hover indicator
  if (hoveredIndex.value !== null && hoveredIndex.value < props.data.length) {
    const x = padding.left + (hoveredIndex.value / (props.data.length - 1)) * chartWidth

    ctx.strokeStyle = props.theme.border
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(x, padding.top)
    ctx.lineTo(x, padding.top + chartHeight)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function handleMouseMove(event: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas || !props.data.length)
    return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const padding = { left: 50, right: 20 }
  const chartWidth = rect.width - padding.left - padding.right

  const relativeX = (x - padding.left) / chartWidth
  const index = Math.round(relativeX * (props.data.length - 1))

  if (index >= 0 && index < props.data.length) {
    hoveredIndex.value = index
    hoveredPoint.value = props.data[index]
    emit('point-hover', props.data[index])
  }
  else {
    hoveredIndex.value = null
    hoveredPoint.value = null
    emit('point-hover', null)
  }

  drawChart()
}

function handleMouseLeave() {
  hoveredIndex.value = null
  hoveredPoint.value = null
  emit('point-hover', null)
  drawChart()
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  drawChart()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      drawChart()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(() => props.data, drawChart, { deep: true })
watch(() => props.metrics, drawChart)
</script>

<template>
  <div
    ref="containerRef"
    class="time-series-chart bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
  >
    <!-- Legend -->
    <div v-if="showLegend" class="flex items-center gap-4 mb-4">
      <div
        v-for="metric in metrics"
        :key="metric"
        class="flex items-center gap-2 text-sm"
      >
        <div
          class="w-3 h-3 rounded-full"
          :style="{ backgroundColor: chartColors[metric as keyof typeof chartColors] }"
        />
        <span class="text-gray-600 capitalize">
          {{ metric.replace(/([A-Z])/g, ' $1').trim() }}
        </span>
      </div>
    </div>

    <!-- Tooltip -->
    <div
      v-if="hoveredPoint"
      class="mb-2 p-2 bg-gray-50 rounded text-sm"
    >
      <div class="font-medium">{{ formatDate(hoveredPoint.date, 'long') }}</div>
      <div class="flex gap-4 mt-1">
        <span v-for="metric in metrics" :key="metric">
          <span
            class="inline-block w-2 h-2 rounded-full mr-1"
            :style="{ backgroundColor: chartColors[metric as keyof typeof chartColors] }"
          />
          {{ formatCompact((hoveredPoint as Record<string, number>)[metric] || 0) }}
        </span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="animate-pulse" :style="{ height: `${height}px` }">
      <div class="h-full bg-gray-200 rounded" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!data.length"
      class="flex items-center justify-center text-gray-500"
      :style="{ height: `${height}px` }"
    >
      No data available
    </div>

    <!-- Chart -->
    <canvas
      v-else
      ref="canvasRef"
      :style="{ width: '100%', height: `${height}px` }"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    />
  </div>
</template>

<style scoped>
.time-series-chart {
  transition: box-shadow 0.2s ease;
}
.time-series-chart:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
canvas {
  display: block;
}
</style>
