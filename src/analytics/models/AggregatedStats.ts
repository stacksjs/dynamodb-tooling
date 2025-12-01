import type { Model } from '@stacksjs/types'

/**
 * Aggregated stats (pre-computed for fast dashboard queries)
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: STATS#{PERIOD}#{periodStart}
 */
export default {
  name: 'AggregatedStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'period', 'periodStart'], // Composite key
  autoIncrement: false,

  traits: {
    useTimestamps: true,
    useTtl: true, // Hourly stats can be TTL'd after time
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

    period: {
      required: true,
      fillable: true,
      validation: {
        rule: 'enum:hour,day,month',
      },
      comment: 'Aggregation period type',
    },

    periodStart: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Period start timestamp (ISO string)',
    },

    pageViews: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    uniqueVisitors: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    sessions: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    bounces: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    bounceRate: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: '0-1 decimal',
    },

    avgSessionDuration: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Milliseconds',
    },

    avgPagesPerSession: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    totalTimeOnSite: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Milliseconds',
    },

    newVisitors: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    returningVisitors: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (stats: { siteId: string }) => `SITE#${stats.siteId}`,
    sk: (stats: { period: string, periodStart: string }) =>
      `STATS#${stats.period.toUpperCase()}#${stats.periodStart}`,
  },
} satisfies Model
