import type { Model } from '@stacksjs/types'

/**
 * Custom event stats
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: EVENTSTATS#{PERIOD}#{periodStart}#{eventName}
 */
export default {
  name: 'EventStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'period', 'periodStart', 'eventName'], // Composite key
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

    period: {
      required: true,
      fillable: true,
      validation: {
        rule: 'enum:hour,day,month',
      },
    },

    periodStart: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    eventName: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    count: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Total occurrences',
    },

    uniqueVisitors: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Unique visitors who triggered event',
    },

    totalValue: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'For revenue tracking',
    },

    avgValue: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Average value per event',
    },
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (stats: { siteId: string }) => `SITE#${stats.siteId}`,
    sk: (stats: { period: string, periodStart: string, eventName: string }) =>
      `EVENTSTATS#${stats.period.toUpperCase()}#${stats.periodStart}#${stats.eventName}`,
  },
} satisfies Model
