import type { Model } from './types'

/**
 * Goal stats (conversions)
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: GOALSTATS#{goalId}#{PERIOD}#{periodStart}
 */
export default {
  name: 'GoalStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'goalId', 'period', 'periodStart'], // Composite key
  autoIncrement: false,

  traits: {
    useTtl: true,
  },

  belongsTo: ['Site', 'Goal'],

  attributes: {
    siteId: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    goalId: {
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

    conversions: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    uniqueConversions: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Unique visitors who converted',
    },

    conversionRate: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: '0-1 decimal',
    },

    revenue: {
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
    sk: (stats: { goalId: string, period: string, periodStart: string }) =>
      `GOALSTATS#${stats.goalId}#${stats.period.toUpperCase()}#${stats.periodStart}`,
  },
} satisfies Model
