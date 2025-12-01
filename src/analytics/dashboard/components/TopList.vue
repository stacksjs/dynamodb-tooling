<script setup lang="ts">
/**
 * TopList Component
 *
 * Displays a list of top items (pages, referrers, etc.) with bars.
 */
import { computed } from 'vue'
import type { TopListProps } from '../types'
import { formatCompact, formatPercentage } from '../utils'

const props = withDefaults(defineProps<TopListProps>(), {
  showPercentage: true,
  maxItems: 10,
  emptyMessage: 'No data available',
  loading: false,
})

const displayItems = computed(() =>
  props.items.slice(0, props.maxItems),
)

const maxValue = computed(() =>
  Math.max(...props.items.map(item => item.value), 1),
)
</script>

<template>
  <div class="top-list bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <h3 class="text-sm font-medium text-gray-900 mb-4">
      {{ title }}
    </h3>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="animate-pulse">
        <div class="flex justify-between mb-1">
          <div class="h-4 bg-gray-200 rounded w-32" />
          <div class="h-4 bg-gray-200 rounded w-12" />
        </div>
        <div class="h-2 bg-gray-200 rounded" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="items.length === 0" class="text-center py-8 text-gray-500">
      {{ emptyMessage }}
    </div>

    <!-- Items list -->
    <div v-else class="space-y-3">
      <div
        v-for="(item, index) in displayItems"
        :key="index"
        class="group"
      >
        <div class="flex items-center justify-between text-sm mb-1">
          <span class="text-gray-900 truncate flex-1 mr-2" :title="item.name">
            {{ item.name }}
          </span>
          <span class="text-gray-600 tabular-nums flex-shrink-0">
            {{ formatCompact(item.value) }}
            <span v-if="showPercentage" class="text-gray-400 ml-1">
              ({{ formatPercentage(item.percentage) }})
            </span>
          </span>
        </div>

        <!-- Progress bar -->
        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-indigo-500 rounded-full transition-all duration-300"
            :style="{ width: `${(item.value / maxValue) * 100}%` }"
          />
        </div>
      </div>
    </div>

    <!-- View more slot -->
    <slot name="footer" />
  </div>
</template>

<style scoped>
.top-list {
  transition: box-shadow 0.2s ease;
}
.top-list:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>
