import type { Model } from '@stacksjs/types'

/**
 * UTM Campaign stats
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: CAMPSTATS#{PERIOD}#{periodStart}#{utmSource}[#{utmCampaign}]
 */
export default {
  name: 'CampaignStats',
  table: 'analytics', // Single-table design
  primaryKey: ['siteId', 'period', 'periodStart', 'utmSource'], // Composite key
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

    utmSource: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    utmMedium: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    utmCampaign: {
      fillable: true,
      validation: {
        rule: 'string',
      },
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

    conversions: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Custom events marked as goals',
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
    sk: (stats: { period: string, periodStart: string, utmSource: string, utmCampaign?: string }) =>
      `CAMPSTATS#${stats.period.toUpperCase()}#${stats.periodStart}#${stats.utmSource}${stats.utmCampaign ? `#${stats.utmCampaign}` : ''}`,
  },
} satisfies Model
