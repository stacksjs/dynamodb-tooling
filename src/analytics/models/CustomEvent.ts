import type { Model } from './types'

/**
 * Custom event (non-pageview events like button clicks, form submissions)
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: EVENT#{timestamp}#{eventId}
 * - GSI1PK: SITE#{siteId}#EVENTNAME#{eventName}
 * - GSI1SK: EVENT#{timestamp}
 */
export default {
  name: 'CustomEvent',
  table: 'analytics', // Single-table design
  primaryKey: 'id',
  autoIncrement: false,

  traits: {
    useUuid: true,
    useTtl: true,
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

    name: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Event name (e.g., button_click, form_submit)',
    },

    value: {
      fillable: true,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Optional value for revenue tracking',
    },

    properties: {
      fillable: true,
      cast: 'json',
      comment: 'Custom event properties',
    },

    path: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Page path where event occurred',
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
    pk: (event: { siteId: string }) => `SITE#${event.siteId}`,
    sk: (event: { timestamp: Date, id: string }) =>
      `EVENT#${event.timestamp.toISOString()}#${event.id}`,
    gsi1pk: (event: { siteId: string, name: string }) =>
      `SITE#${event.siteId}#EVENTNAME#${event.name}`,
    gsi1sk: (event: { timestamp: Date }) =>
      `EVENT#${event.timestamp.toISOString()}`,
  },
} satisfies Model
