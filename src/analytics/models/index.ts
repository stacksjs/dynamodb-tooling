/**
 * Analytics Models Index
 *
 * This module exports all Stacks-compatible model definitions
 * for the privacy-focused web analytics system.
 */

// Aggregation stats
export { default as AggregatedStatsModel } from './AggregatedStats'
export { default as CampaignStatsModel } from './CampaignStats'
export { default as ConversionModel } from './Conversion'
export { default as CustomEventModel } from './CustomEvent'
export { default as DeviceStatsModel } from './DeviceStats'
export { default as EventStatsModel } from './EventStats'

export { default as GeoStatsModel } from './GeoStats'
export { default as GoalModel } from './Goal'
export { default as GoalStatsModel } from './GoalStats'
export { default as PageStatsModel } from './PageStats'
export { default as PageViewModel } from './PageView'
export { default as RealtimeStatsModel } from './RealtimeStats'
export { default as ReferrerStatsModel } from './ReferrerStats'
export { default as SessionModel } from './Session'
// Core entities
export { default as SiteModel } from './Site'

/**
 * All analytics models for batch processing
 */
export const analyticsModels = [
  // Core entities
  'Site',
  'PageView',
  'Session',
  'CustomEvent',
  'Goal',
  'Conversion',
  // Aggregation stats
  'AggregatedStats',
  'PageStats',
  'ReferrerStats',
  'GeoStats',
  'DeviceStats',
  'CampaignStats',
  'EventStats',
  'GoalStats',
  'RealtimeStats',
] as const

export type AnalyticsModelName = typeof analyticsModels[number]
