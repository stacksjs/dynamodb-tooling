<script setup lang="ts">
/**
 * DeviceBreakdown Component
 *
 * Displays device type breakdown with icons and percentages.
 */
import { computed } from 'vue'
import type { TopItem } from '../types'
import { formatPercentage } from '../utils'

const props = withDefaults(defineProps<{
  devices: TopItem[]
  loading?: boolean
}>(), {
  loading: false,
})

const deviceIcons = {
  desktop: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
  mobile: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`,
  tablet: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`,
  unknown: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>`,
}

const deviceColors = {
  desktop: 'bg-blue-100 text-blue-600',
  mobile: 'bg-green-100 text-green-600',
  tablet: 'bg-purple-100 text-purple-600',
  unknown: 'bg-gray-100 text-gray-600',
}

const sortedDevices = computed(() => {
  return [...props.devices].sort((a, b) => b.value - a.value)
})

function getDeviceIcon(name: string): string {
  const key = name.toLowerCase() as keyof typeof deviceIcons
  return deviceIcons[key] || deviceIcons.unknown
}

function getDeviceColor(name: string): string {
  const key = name.toLowerCase() as keyof typeof deviceColors
  return deviceColors[key] || deviceColors.unknown
}
</script>

<template>
  <div class="device-breakdown bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <h3 class="text-sm font-medium text-gray-900 mb-4">
      Devices
    </h3>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="animate-pulse flex items-center gap-4">
        <div class="w-12 h-12 bg-gray-200 rounded-lg" />
        <div class="flex-1">
          <div class="h-4 bg-gray-200 rounded w-20 mb-2" />
          <div class="h-3 bg-gray-200 rounded w-12" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!devices.length" class="text-center py-8 text-gray-500">
      No device data available
    </div>

    <!-- Device list -->
    <div v-else class="space-y-4">
      <div
        v-for="device in sortedDevices"
        :key="device.name"
        class="flex items-center gap-4"
      >
        <div
          class="w-12 h-12 rounded-lg flex items-center justify-center"
          :class="getDeviceColor(device.name)"
          v-html="getDeviceIcon(device.name)"
        />
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-900 capitalize">{{ device.name }}</span>
            <span class="text-sm text-gray-600">{{ formatPercentage(device.percentage) }}</span>
          </div>
          <div class="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="getDeviceColor(device.name).replace('bg-', 'bg-').replace('-100', '-500')"
              :style="{ width: `${device.percentage * 100}%` }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-breakdown {
  transition: box-shadow 0.2s ease;
}
.device-breakdown:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>
