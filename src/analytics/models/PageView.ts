import type { Model } from './types'

/**
 * Page view event (raw event - stored temporarily for aggregation)
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: PV#{timestamp}#{pageViewId}
 * - GSI1PK: SITE#{siteId}#DATE#{date}
 * - GSI1SK: PATH#{path}#{pageViewId}
 * - GSI2PK: SITE#{siteId}#VISITOR#{visitorId}
 * - GSI2SK: PV#{timestamp}
 */
export default {
  name: 'PageView',
  table: 'analytics', // Single-table design
  primaryKey: 'id',
  autoIncrement: false,

  traits: {
    useUuid: true,
    useTtl: true, // Auto-delete after aggregation
  },

  belongsTo: ['Site', 'Session'],

  attributes: {
    id: {
      required: true,
      unique: true,
      validation: {
        rule: 'string',
      },
    },

    siteId: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    visitorId: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Hashed, anonymous visitor identifier',
    },

    sessionId: {
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

    hostname: {
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
    },

    referrer: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    referrerSource: {
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'e.g., google, twitter, direct',
    },

    // UTM parameters
    utmSource: {
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

    utmContent: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    utmTerm: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    // Geolocation (privacy-sensitive)
    country: {
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
    },

    city: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    // Device information
    deviceType: {
      fillable: true,
      validation: {
        rule: 'enum:desktop,mobile,tablet,unknown',
      },
    },

    browser: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    browserVersion: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    os: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    osVersion: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    screenWidth: {
      fillable: true,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    screenHeight: {
      fillable: true,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    // Session metrics
    isUnique: {
      required: true,
      fillable: true,
      default: false,
      validation: {
        rule: 'boolean',
      },
      cast: 'boolean',
      comment: 'First page view in session',
    },

    isBounce: {
      required: true,
      fillable: true,
      default: true,
      validation: {
        rule: 'boolean',
      },
      cast: 'boolean',
      comment: 'Only page view in session',
    },

    timeOnPage: {
      fillable: true,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Milliseconds - updated on next page view or session end',
    },

    timestamp: {
      required: true,
      fillable: true,
      validation: {
        rule: 'date',
      },
      cast: 'datetime',
    },

    ttl: {
      fillable: true,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Unix timestamp for DynamoDB TTL auto-deletion',
    },
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (pv: { siteId: string }) => `SITE#${pv.siteId}`,
    sk: (pv: { timestamp: Date, id: string }) =>
      `PV#${pv.timestamp.toISOString()}#${pv.id}`,
    gsi1pk: (pv: { siteId: string, timestamp: Date }) =>
      `SITE#${pv.siteId}#DATE#${pv.timestamp.toISOString().split('T')[0]}`,
    gsi1sk: (pv: { path: string, id: string }) =>
      `PATH#${pv.path}#${pv.id}`,
    gsi2pk: (pv: { siteId: string, visitorId: string }) =>
      `SITE#${pv.siteId}#VISITOR#${pv.visitorId}`,
    gsi2sk: (pv: { timestamp: Date }) =>
      `PV#${pv.timestamp.toISOString()}`,
  },
} satisfies Model
