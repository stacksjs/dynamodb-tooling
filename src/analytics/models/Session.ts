import type { Model } from '@stacksjs/types'

/**
 * Visitor session
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: SESSION#{sessionId}
 * - GSI1PK: SITE#{siteId}#SESSIONS#{date}
 * - GSI1SK: SESSION#{sessionId}
 */
export default {
  name: 'Session',
  table: 'analytics', // Single-table design
  primaryKey: 'id',
  autoIncrement: false,

  traits: {
    useUuid: true,
    useTtl: true,
  },

  belongsTo: ['Site'],

  hasMany: ['PageView', 'CustomEvent'],

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

    entryPath: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'First page in session',
    },

    exitPath: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Last page in session',
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

    // Geolocation
    country: {
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

    os: {
      fillable: true,
      validation: {
        rule: 'string',
      },
    },

    // Session metrics
    pageViewCount: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    eventCount: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
    },

    isBounce: {
      required: true,
      fillable: true,
      default: true,
      validation: {
        rule: 'boolean',
      },
      cast: 'boolean',
      comment: 'Single page session',
    },

    duration: {
      required: true,
      fillable: true,
      default: 0,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Session duration in milliseconds',
    },

    startedAt: {
      required: true,
      fillable: true,
      validation: {
        rule: 'date',
      },
      cast: 'datetime',
    },

    endedAt: {
      required: true,
      fillable: true,
      validation: {
        rule: 'date',
      },
      cast: 'datetime',
      comment: 'Last activity timestamp',
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
    pk: (session: { siteId: string }) => `SITE#${session.siteId}`,
    sk: (session: { id: string }) => `SESSION#${session.id}`,
    gsi1pk: (session: { siteId: string, startedAt: Date }) =>
      `SITE#${session.siteId}#SESSIONS#${session.startedAt.toISOString().split('T')[0]}`,
    gsi1sk: (session: { id: string }) => `SESSION#${session.id}`,
  },
} satisfies Model
