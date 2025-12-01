<script setup lang="ts">
/**
 * StatCard Component
 *
 * Displays a single stat with optional change indicator.
 */
import { computed } from 'vue'
import type { StatCardProps } from '../types'
import {
  formatChange,
  formatCompact,
  formatCurrency,
  formatDuration,
  formatPercentage,
} from '../utils'

const props = withDefaults(defineProps<StatCardProps>(), {
  format: 'number',
  loading: false,
})

const formattedValue = computed(() => {
  if (typeof props.value === 'string')
    return props.value

  switch (props.format) {
    case 'percentage':
      return formatPercentage(props.value)
    case 'duration':
      return formatDuration(props.value)
    case 'currency':
      return formatCurrency(props.value)
    case 'number':
    default:
      return formatCompact(props.value)
  }
})

const changeClass = computed(() => {
  if (props.change === undefined)
    return ''
  // For bounce rate, negative is good
  const isPositiveGood = props.title.toLowerCase() !== 'bounce rate'
  const isGood = isPositiveGood ? props.change >= 0 : props.change <= 0
  return isGood ? 'text-green-600' : 'text-red-600'
})

const formattedChange = computed(() => {
  if (props.change === undefined)
    return ''
  return formatChange(props.change)
})
</script>

<template>
  <div class="stat-card bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-gray-500">
        {{ title }}
      </h3>
      <span v-if="icon" class="text-gray-400">
        <slot name="icon">
          {{ icon }}
        </slot>
      </span>
    </div>

    <div class="mt-2">
      <template v-if="loading">
        <div class="animate-pulse">
          <div class="h-8 bg-gray-200 rounded w-24" />
          <div class="h-4 bg-gray-200 rounded w-16 mt-2" />
        </div>
      </template>
      <template v-else>
        <p class="text-3xl font-semibold text-gray-900">
          {{ formattedValue }}
        </p>
        <p v-if="change !== undefined" class="mt-1 text-sm" :class="changeClass">
          <span>{{ formattedChange }}</span>
          <span v-if="changeLabel" class="text-gray-500 ml-1">{{ changeLabel }}</span>
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  transition: box-shadow 0.2s ease;
}
.stat-card:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>
