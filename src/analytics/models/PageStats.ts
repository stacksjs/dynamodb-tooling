import type { Model } from '@stacksjs/types'

/**
 * Page-level aggregated stats
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: PAGESTATS#{PERIOD}#{periodStart}#{path}
 * - GSI1PK: SITE#{siteId}#PAGESTATS#{PERIOD}#{periodStart}
 * - GSI1SK: PV#{pageViews}#{path} (for sorting by page views)
 */
export default {
  name: 'PageStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'period', 'periodStart', 'path'], // Composite key
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

    path: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    title: {
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Most recent page title',
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

    entries: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Sessions starting on this page',
    },

    exits: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Sessions ending on this page',
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

    avgTimeOnPage: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Milliseconds',
    },

    exitRate: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: '0-1 decimal',
    },
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (stats: { siteId: string }) => `SITE#${stats.siteId}`,
    sk: (stats: { period: string, periodStart: string, path: string }) =>
      `PAGESTATS#${stats.period.toUpperCase()}#${stats.periodStart}#${encodeURIComponent(stats.path)}`,
    gsi1pk: (stats: { siteId: string, period: string, periodStart: string }) =>
      `SITE#${stats.siteId}#PAGESTATS#${stats.period.toUpperCase()}#${stats.periodStart}`,
    gsi1sk: (stats: { pageViews: number, path: string }) =>
      `PV#${String(stats.pageViews).padStart(10, '0')}#${encodeURIComponent(stats.path)}`,
  },
} satisfies Model
