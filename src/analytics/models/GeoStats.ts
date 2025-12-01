import type { Model } from '@stacksjs/types'

/**
 * Geographic stats
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: GEOSTATS#{PERIOD}#{periodStart}#{country}[#{region}]
 */
export default {
  name: 'GeoStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'period', 'periodStart', 'country'], // Composite key
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

    country: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'ISO 3166-1 alpha-2 country code',
    },

    region: {
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'For country drilldown',
    },

    city: {
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'For region drilldown',
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
    sk: (stats: { period: string, periodStart: string, country: string, region?: string }) =>
      `GEOSTATS#${stats.period.toUpperCase()}#${stats.periodStart}#${stats.country}${stats.region ? `#${stats.region}` : ''}`,
  },
} satisfies Model
