import type { Model } from '@stacksjs/types'

/**
 * Referrer stats
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: REFSTATS#{PERIOD}#{periodStart}#{source}
 */
export default {
  name: 'ReferrerStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'period', 'periodStart', 'source'], // Composite key
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

    source: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Referrer source (e.g., google, twitter, direct)',
    },

    referrer: {
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Full referrer URL (for non-grouped view)',
    },

    visitors: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
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
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (stats: { siteId: string }) => `SITE#${stats.siteId}`,
    sk: (stats: { period: string, periodStart: string, source: string }) =>
      `REFSTATS#${stats.period.toUpperCase()}#${stats.periodStart}#${stats.source}`,
  },
} satisfies Model
