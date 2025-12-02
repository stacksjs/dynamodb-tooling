/**
 * CloudFormation Template Generator for Analytics DynamoDB Table
 *
 * Generates CloudFormation JSON/YAML for deploying the analytics
 * single-table design to AWS.
 */

export interface CloudFormationConfig {
  /** Stack name */
  stackName?: string
  /** Table name */
  tableName?: string
  /** Billing mode */
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED'
  /** Provisioned capacity (if billingMode is PROVISIONED) */
  provisionedCapacity?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  /** Enable Point-in-Time Recovery */
  enablePitr?: boolean
  /** Enable DynamoDB Streams */
  enableStreams?: boolean
  /** Stream view type */
  streamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
  /** TTL attribute name */
  ttlAttributeName?: string
  /** Enable server-side encryption */
  enableEncryption?: boolean
  /** KMS key ARN for encryption (optional, uses AWS managed key if not specified) */
  kmsKeyArn?: string
  /** Tags to apply to resources */
  tags?: Record<string, string>
  /** Enable deletion protection */
  deletionProtection?: boolean
}

const defaultConfig: Required<CloudFormationConfig> = {
  stackName: 'analytics-dynamodb',
  tableName: 'analytics',
  billingMode: 'PAY_PER_REQUEST',
  provisionedCapacity: {
    readCapacityUnits: 5,
    writeCapacityUnits: 5,
  },
  enablePitr: true,
  enableStreams: false,
  streamViewType: 'NEW_AND_OLD_IMAGES',
  ttlAttributeName: 'ttl',
  enableEncryption: true,
  kmsKeyArn: '',
  tags: {},
  deletionProtection: false,
}

/**
 * Analytics table attribute definitions
 */
const attributeDefinitions = [
  { AttributeName: 'pk', AttributeType: 'S' },
  { AttributeName: 'sk', AttributeType: 'S' },
  { AttributeName: 'gsi1pk', AttributeType: 'S' },
  { AttributeName: 'gsi1sk', AttributeType: 'S' },
  { AttributeName: 'gsi2pk', AttributeType: 'S' },
  { AttributeName: 'gsi2sk', AttributeType: 'S' },
]

/**
 * Analytics table key schema
 */
const keySchema = [
  { AttributeName: 'pk', KeyType: 'HASH' },
  { AttributeName: 'sk', KeyType: 'RANGE' },
]

/**
 * Global Secondary Index definitions for analytics
 *
 * GSI1: Owner lookups, date-based queries
 *   - Sites by owner: gsi1pk=OWNER#{ownerId}, gsi1sk=SITE#{siteId}
 *   - PageViews by date: gsi1pk=SITE#{id}#DATE#{date}, gsi1sk=PATH#{path}
 *   - Sessions by date: gsi1pk=SITE#{id}#SESSIONS#{date}
 *   - Events by name: gsi1pk=SITE#{id}#EVENTNAME#{name}
 *   - Goals by site: gsi1pk=SITE#{id}#GOAL#{goalId}
 *   - Page stats by period: gsi1pk=SITE#{id}#PAGESTATS#{period}#{start}
 *
 * GSI2: Visitor lookups
 *   - PageViews by visitor: gsi2pk=SITE#{id}#VISITOR#{visitorId}
 */
function getGsiDefinitions(config: Required<CloudFormationConfig>) {
  const projection = { ProjectionType: 'ALL' }

  const gsis = [
    {
      IndexName: 'GSI1',
      KeySchema: [
        { AttributeName: 'gsi1pk', KeyType: 'HASH' },
        { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
      ],
      Projection: projection,
    },
    {
      IndexName: 'GSI2',
      KeySchema: [
        { AttributeName: 'gsi2pk', KeyType: 'HASH' },
        { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
      ],
      Projection: projection,
    },
  ]

  // Add provisioned capacity if not on-demand
  if (config.billingMode === 'PROVISIONED') {
    return gsis.map(gsi => ({
      ...gsi,
      ProvisionedThroughput: {
        ReadCapacityUnits: config.provisionedCapacity.readCapacityUnits,
        WriteCapacityUnits: config.provisionedCapacity.writeCapacityUnits,
      },
    }))
  }

  return gsis
}

/**
 * Generate CloudFormation template for analytics table
 */
export function generateCloudFormationTemplate(
  userConfig: CloudFormationConfig = {},
): Record<string, unknown> {
  const config = { ...defaultConfig, ...userConfig }

  const tableProperties: Record<string, unknown> = {
    TableName: config.tableName,
    AttributeDefinitions: attributeDefinitions,
    KeySchema: keySchema,
    GlobalSecondaryIndexes: getGsiDefinitions(config),
    BillingMode: config.billingMode,
  }

  // Add provisioned capacity if not on-demand
  if (config.billingMode === 'PROVISIONED') {
    tableProperties.ProvisionedThroughput = {
      ReadCapacityUnits: config.provisionedCapacity.readCapacityUnits,
      WriteCapacityUnits: config.provisionedCapacity.writeCapacityUnits,
    }
  }

  // TTL configuration
  if (config.ttlAttributeName) {
    tableProperties.TimeToLiveSpecification = {
      AttributeName: config.ttlAttributeName,
      Enabled: true,
    }
  }

  // Stream configuration
  if (config.enableStreams) {
    tableProperties.StreamSpecification = {
      StreamViewType: config.streamViewType,
    }
  }

  // Server-side encryption
  if (config.enableEncryption) {
    tableProperties.SSESpecification = {
      SSEEnabled: true,
      ...(config.kmsKeyArn && {
        SSEType: 'KMS',
        KMSMasterKeyId: config.kmsKeyArn,
      }),
    }
  }

  // Point-in-time recovery
  if (config.enablePitr) {
    tableProperties.PointInTimeRecoverySpecification = {
      PointInTimeRecoveryEnabled: true,
    }
  }

  // Deletion protection
  if (config.deletionProtection) {
    tableProperties.DeletionProtectionEnabled = true
  }

  // Tags
  if (Object.keys(config.tags).length > 0) {
    tableProperties.Tags = Object.entries(config.tags).map(([Key, Value]) => ({
      Key,
      Value,
    }))
  }

  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'DynamoDB table for privacy-focused web analytics (single-table design)',

    Parameters: {
      Environment: {
        Type: 'String',
        Default: 'production',
        AllowedValues: ['development', 'staging', 'production'],
        Description: 'Deployment environment',
      },
    },

    Resources: {
      AnalyticsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: tableProperties,
      },
    },

    Outputs: {
      TableName: {
        Description: 'Analytics DynamoDB table name',
        Value: { Ref: 'AnalyticsTable' },
        Export: {
          Name: { 'Fn::Sub': '${AWS::StackName}-TableName' },
        },
      },
      TableArn: {
        Description: 'Analytics DynamoDB table ARN',
        Value: { 'Fn::GetAtt': ['AnalyticsTable', 'Arn'] },
        Export: {
          Name: { 'Fn::Sub': '${AWS::StackName}-TableArn' },
        },
      },
      ...(config.enableStreams && {
        StreamArn: {
          Description: 'DynamoDB Stream ARN',
          Value: { 'Fn::GetAtt': ['AnalyticsTable', 'StreamArn'] },
          Export: {
            Name: { 'Fn::Sub': '${AWS::StackName}-StreamArn' },
          },
        },
      }),
    },
  }
}

/**
 * Generate CloudFormation template as JSON string
 */
export function generateCloudFormationJson(
  config: CloudFormationConfig = {},
  pretty = true,
): string {
  const template = generateCloudFormationTemplate(config)
  return pretty ? JSON.stringify(template, null, 2) : JSON.stringify(template)
}

/**
 * Generate CloudFormation template as YAML string
 */
export function generateCloudFormationYaml(
  config: CloudFormationConfig = {},
): string {
  const template = generateCloudFormationTemplate(config)
  return jsonToYaml(template)
}

/**
 * Simple JSON to YAML converter (handles CloudFormation intrinsic functions)
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent)

  if (obj === null || obj === undefined) {
    return 'null'
  }

  if (typeof obj === 'string') {
    // Handle multi-line strings or strings with special characters
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"')}"`
    }
    return obj
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj)
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0)
      return '[]'
    return obj
      .map((item) => {
        const value = jsonToYaml(item, indent + 1)
        if (typeof item === 'object' && item !== null) {
          return `${spaces}- ${value.trim().replace(/^\s+/gm, match => `${spaces}  ${match.slice(spaces.length + 2)}`)}`
        }
        return `${spaces}- ${value}`
      })
      .join('\n')
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>)
    if (entries.length === 0)
      return '{}'

    // Handle CloudFormation intrinsic functions
    if (entries.length === 1) {
      const [key, value] = entries[0]
      if (key === 'Ref') {
        return `!Ref ${value}`
      }
      if (key === 'Fn::Sub') {
        return `!Sub "${value}"`
      }
      if (key === 'Fn::GetAtt') {
        if (Array.isArray(value)) {
          return `!GetAtt ${(value as string[]).join('.')}`
        }
        return `!GetAtt ${value}`
      }
      if (key === 'Fn::Join') {
        const [delimiter, parts] = value as [string, unknown[]]
        return `!Join\n${spaces}  - "${delimiter}"\n${spaces}  - ${jsonToYaml(parts, indent + 2)}`
      }
    }

    return entries
      .map(([key, value]) => {
        const yamlValue = jsonToYaml(value, indent + 1)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${yamlValue}`
        }
        if (Array.isArray(value)) {
          return `${spaces}${key}:\n${yamlValue}`
        }
        return `${spaces}${key}: ${yamlValue}`
      })
      .join('\n')
  }

  return String(obj)
}

/**
 * Generate SAM (Serverless Application Model) template
 * Includes Lambda functions for API endpoints
 */
export function generateSamTemplate(config: CloudFormationConfig = {}): Record<string, unknown> {
  const cfnTemplate = generateCloudFormationTemplate(config)
  const mergedConfig = { ...defaultConfig, ...config }

  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Transform: 'AWS::Serverless-2016-10-31',
    Description: 'Privacy-focused web analytics with DynamoDB and Lambda',

    Globals: {
      Function: {
        Runtime: 'nodejs20.x',
        Timeout: 30,
        MemorySize: 256,
        Environment: {
          Variables: {
            ANALYTICS_TABLE: { Ref: 'AnalyticsTable' },
            NODE_ENV: { Ref: 'Environment' },
          },
        },
        Architectures: ['arm64'],
      },
    },

    Parameters: {
      ...((cfnTemplate as Record<string, unknown>).Parameters as Record<string, unknown> || {}),
      CorsOrigins: {
        Type: 'String',
        Default: '*',
        Description: 'CORS allowed origins (comma-separated)',
      },
    },

    Resources: {
      // DynamoDB Table
      AnalyticsTable: (cfnTemplate as Record<string, unknown>).Resources
        ? ((cfnTemplate as Record<string, unknown>).Resources as Record<string, unknown>).AnalyticsTable
        : {},

      // API Gateway
      AnalyticsApi: {
        Type: 'AWS::Serverless::HttpApi',
        Properties: {
          StageName: { Ref: 'Environment' },
          CorsConfiguration: {
            AllowOrigins: [{ Ref: 'CorsOrigins' }],
            AllowMethods: ['GET', 'POST', 'OPTIONS'],
            AllowHeaders: ['Content-Type', 'Authorization'],
          },
        },
      },

      // Lambda Functions
      CollectFunction: {
        Type: 'AWS::Serverless::Function',
        Properties: {
          Handler: 'index.collectHandler',
          CodeUri: './dist/lambda',
          Description: 'Collect analytics events',
          Events: {
            Api: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/collect',
                Method: 'POST',
              },
            },
          },
          Policies: [
            {
              DynamoDBCrudPolicy: {
                TableName: { Ref: 'AnalyticsTable' },
              },
            },
          ],
        },
      },

      StatsFunction: {
        Type: 'AWS::Serverless::Function',
        Properties: {
          Handler: 'index.statsHandler',
          CodeUri: './dist/lambda',
          Description: 'Get analytics statistics',
          Events: {
            Api: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites/{siteId}/stats',
                Method: 'GET',
              },
            },
          },
          Policies: [
            {
              DynamoDBReadPolicy: {
                TableName: { Ref: 'AnalyticsTable' },
              },
            },
          ],
        },
      },

      RealtimeFunction: {
        Type: 'AWS::Serverless::Function',
        Properties: {
          Handler: 'index.realtimeHandler',
          CodeUri: './dist/lambda',
          Description: 'Get realtime analytics',
          Events: {
            Api: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites/{siteId}/realtime',
                Method: 'GET',
              },
            },
          },
          Policies: [
            {
              DynamoDBReadPolicy: {
                TableName: { Ref: 'AnalyticsTable' },
              },
            },
          ],
        },
      },

      SitesFunction: {
        Type: 'AWS::Serverless::Function',
        Properties: {
          Handler: 'index.sitesHandler',
          CodeUri: './dist/lambda',
          Description: 'Manage analytics sites',
          Events: {
            List: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites',
                Method: 'GET',
              },
            },
            Create: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites',
                Method: 'POST',
              },
            },
            Get: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites/{siteId}',
                Method: 'GET',
              },
            },
          },
          Policies: [
            {
              DynamoDBCrudPolicy: {
                TableName: { Ref: 'AnalyticsTable' },
              },
            },
          ],
        },
      },

      GoalsFunction: {
        Type: 'AWS::Serverless::Function',
        Properties: {
          Handler: 'index.goalsHandler',
          CodeUri: './dist/lambda',
          Description: 'Manage analytics goals',
          Events: {
            List: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites/{siteId}/goals',
                Method: 'GET',
              },
            },
            Create: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites/{siteId}/goals',
                Method: 'POST',
              },
            },
          },
          Policies: [
            {
              DynamoDBCrudPolicy: {
                TableName: { Ref: 'AnalyticsTable' },
              },
            },
          ],
        },
      },

      ScriptFunction: {
        Type: 'AWS::Serverless::Function',
        Properties: {
          Handler: 'index.scriptHandler',
          CodeUri: './dist/lambda',
          Description: 'Generate tracking script',
          Events: {
            Api: {
              Type: 'HttpApi',
              Properties: {
                ApiId: { Ref: 'AnalyticsApi' },
                Path: '/api/analytics/sites/{siteId}/script',
                Method: 'GET',
              },
            },
          },
        },
      },

      AggregationFunction: {
        Type: 'AWS::Serverless::Function',
        Properties: {
          Handler: 'index.aggregationHandler',
          CodeUri: './dist/lambda',
          Description: 'Run analytics aggregation',
          Timeout: 300,
          MemorySize: 512,
          Events: {
            HourlySchedule: {
              Type: 'Schedule',
              Properties: {
                Schedule: 'rate(1 hour)',
                Input: '{"period": "hour"}',
              },
            },
            DailySchedule: {
              Type: 'Schedule',
              Properties: {
                Schedule: 'cron(0 0 * * ? *)',
                Input: '{"period": "day"}',
              },
            },
            MonthlySchedule: {
              Type: 'Schedule',
              Properties: {
                Schedule: 'cron(0 0 1 * ? *)',
                Input: '{"period": "month"}',
              },
            },
          },
          Policies: [
            {
              DynamoDBCrudPolicy: {
                TableName: { Ref: 'AnalyticsTable' },
              },
            },
          ],
        },
      },
    },

    Outputs: {
      ...((cfnTemplate as Record<string, unknown>).Outputs || {}),
      ApiEndpoint: {
        Description: 'Analytics API endpoint',
        Value: {
          'Fn::Sub': 'https://${AnalyticsApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}',
        },
      },
    },
  }
}

/**
 * Generate SAM template as YAML string
 */
export function generateSamYaml(config: CloudFormationConfig = {}): string {
  const template = generateSamTemplate(config)
  return jsonToYaml(template)
}
