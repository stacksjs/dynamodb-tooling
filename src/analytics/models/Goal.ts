import type { Model } from '@stacksjs/types'

/**
 * Goal/Conversion definition
 *
 * DynamoDB Keys:
 * - PK: SITE#{siteId}
 * - SK: GOAL#{goalId}
 */
export default {
  name: 'Goal',
  table: 'analytics', // Single-table design
  primaryKey: 'id',
  autoIncrement: false,

  traits: {
    useUuid: true,
    useTimestamps: true,
  },

  belongsTo: ['Site'],

  hasMany: ['Conversion'],

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

    name: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Human-readable goal name',
    },

    type: {
      required: true,
      fillable: true,
      validation: {
        rule: 'enum:pageview,event',
      },
      comment: 'Goal type - pageview or event based',
    },

    pattern: {
      required: true,
      fillable: true,
      validation: {
        rule: 'string',
      },
      comment: 'Match pattern (path pattern or event name)',
    },

    matchType: {
      required: true,
      fillable: true,
      default: 'exact',
      validation: {
        rule: 'enum:exact,contains,regex',
      },
    },

    value: {
      fillable: true,
      validation: {
        rule: 'number',
      },
      cast: 'number',
      comment: 'Revenue value per conversion',
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
  },

  // DynamoDB single-table key patterns
  dynamodb: {
    pk: (goal: { siteId: string }) => `SITE#${goal.siteId}`,
    sk: (goal: { id: string }) => `GOAL#${goal.id}`,
  },
} satisfies Model
