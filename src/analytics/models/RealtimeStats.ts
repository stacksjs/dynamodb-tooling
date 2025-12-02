import type { Model } from './types'

/**
 * Real-time stats (last 5 minutes, stored with short TTL)
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: REALTIME#{minute}
 */
export default {
  name: 'RealtimeStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'minute'], // Composite key
  autoIncrement: false,

  traits: {
    useTtl: true,
  },

  belongsTo: ['Site'],

  attributes: {
    siteId: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    minute: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'ISO timestamp truncated to minute',
    },

    currentVisitors: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Active visitors in this minute',
    },

    pageViews: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Page views in this minute',
    },

    activePages: {
      required: true,
      fillable: true,
      cast: 'json',
      default: {},
      comment: 'Map of path -> visitor count',
    },

    ttl: {
      required: true,
      fillable: true,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Auto-delete after 10 minutes',
    },
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (stats: { siteId: string }) => `SITE#${stats.siteId}`,
    sk: (stats: { minute: string }) => `REALTIME#${stats.minute}`,
  },
} satisfies Model
