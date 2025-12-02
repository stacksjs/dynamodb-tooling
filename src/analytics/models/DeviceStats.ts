import type { Model } from './types'

/**
 * Device/Browser stats
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: DEVICESTATS#{PERIOD}#{periodStart}#{dimension}#{value}
 */
export default {
  name: 'DeviceStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'period', 'periodStart', 'dimension', 'value'], // Composite key
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

    dimension: {
      required: true,
      fillable: true,
      validation: {
        rule: 'enum:device,browser,os,screen',
      },
      comment: 'Type of device dimension',
    },

    value: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'e.g., "mobile", "Chrome", "Windows", "1920x1080"',
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
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (stats: { siteId: string }) => `SITE#${stats.siteId}`,
    sk: (stats: { period: string, periodStart: string, dimension: string, value: string }) =>
      `DEVICESTATS#${stats.period.toUpperCase()}#${stats.periodStart}#${stats.dimension}#${stats.value}`,
  },
} satisfies Model
