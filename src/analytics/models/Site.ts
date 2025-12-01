import type { Model } from '@stacksjs/types'

/**
 * Site/Website being tracked
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: SITE#{siteId}
 * - GSI1PK: OWNER#{ownerId}
 * - GSI1SK: SITE#{siteId}
 */
export default {
  name: 'Site',
  table: 'analytics', // Single-table design
  primaryKey: 'id',
  autoIncrement: false, // Use UUID

  traits: {
    useUuid: true,
    useTimestamps: true,
  },

  belongsTo: ['User'], // Owner relationship

  hasMany: [
    'PageView',
    'Session',
    'CustomEvent',
    'Goal',
  ],

  attributes: {
    id: {
      required: true,
      unique: true,
      validation: {
        rule: 'string',
      },
    },

    name: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
        message: {
          required: 'Site name is required',
        },
      },
    },

    domains: {
      required: true,
      fillable: true,
      validation: {
        rule: 'array',
      },
      cast: 'array',
    },

    timezone: {
      required: true,
      fillable: true,
      default: 'UTC',
      validation: {
        rule: 'string',
      },
    },

    isActive: {
      required: true,
      fillable: true,
      default: true,
      validation: {
        rule: 'boolean',
      },
      cast: 'boolean',
    },

    ownerId: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    // Embedded settings object
    settings: {
      required: true,
      fillable: true,
      cast: 'json',
      default: {
        collectGeolocation: false,
        trackReferrers: true,
        trackUtmParams: true,
        trackDeviceType: true,
        publicDashboard: false,
        excludedPaths: [],
        excludedIps: [],
        dataRetentionDays: 0,
      },
    },
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (site: { id: string }) => `SITE#${site.id}`,
    sk: (site: { id: string }) => `SITE#${site.id}`,
    gsi1pk: (site: { ownerId: string }) => `OWNER#${site.ownerId}`,
    gsi1sk: (site: { id: string }) => `SITE#${site.id}`,
  },
} satisfies Model
