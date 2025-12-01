<script setup lang="ts">
/**
 * RealtimeCounter Component
 *
 * Displays current visitor count with pulsing indicator.
 */
import { computed } from 'vue'
import type { RealtimeCounterProps } from '../types'
import { formatCompact } from '../utils'

const props = withDefaults(defineProps<RealtimeCounterProps>(), {
  label: 'visitors right now',
  pulseColor: '#22c55e',
  loading: false,
})

const formattedCount = computed(() => formatCompact(props.count))
</script>

<template>
  <div class="realtime-counter bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <div class="flex items-center gap-3">
      <!-- Pulsing indicator -->
      <div class="relative">
        <div
          class="w-3 h-3 rounded-full animate-pulse"
          :style="{ backgroundColor: pulseColor }"
        />
        <div
          class="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-75"
          :style="{ backgroundColor: pulseColor }"
        />
      </div>

      <div v-if="loading" class="animate-pulse">
        <div class="h-10 bg-gray-200 rounded w-16" />
        <div class="h-4 bg-gray-200 rounded w-24 mt-1" />
      </div>

      <div v-else>
        <span class="text-4xl font-bold text-gray-900">
          {{ formattedCount }}
        </span>
        <span class="ml-2 text-gray-500 text-sm">
          {{ label }}
        </span>
      </div>
    </div>

    <slot name="details" />
  </div>
</template>

<style scoped>
.realtime-counter {
  transition: box-shadow 0.2s ease;
}
.realtime-counter:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>
