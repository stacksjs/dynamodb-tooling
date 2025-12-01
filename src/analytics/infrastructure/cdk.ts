/**
 * AWS CDK Construct for Analytics DynamoDB Table
 *
 * This module provides CDK constructs for deploying the analytics
 * infrastructure to AWS.
 *
 * @example
 * ```typescript
 * import { AnalyticsTable } from 'dynamodb-tooling/analytics/infrastructure/cdk'
 *
 * const analytics = new AnalyticsTable(this, 'Analytics', {
 *   tableName: 'my-analytics',
 *   billingMode: BillingMode.PAY_PER_REQUEST,
 * })
 *
 * // Access the table
 * analytics.table.grantReadWriteData(myLambda)
 * ```
 *
 * Note: This module exports construct props and a helper function
 * to generate the CDK code since we can't import CDK directly
 * (it's a peer dependency).
 */

// ============================================================================
// CDK Props Types
// ============================================================================

export interface AnalyticsTableProps {
  /** Table name (default: 'analytics') */
  tableName?: string
  /** Billing mode */
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED'
  /** Read capacity units (if PROVISIONED) */
  readCapacity?: number
  /** Write capacity units (if PROVISIONED) */
  writeCapacity?: number
  /** Enable Point-in-Time Recovery */
  pointInTimeRecovery?: boolean
  /** Enable DynamoDB Streams */
  stream?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
  /** TTL attribute name */
  timeToLiveAttribute?: string
  /** Removal policy */
  removalPolicy?: 'DESTROY' | 'RETAIN' | 'SNAPSHOT'
  /** Enable encryption */
  encryption?: 'AWS_MANAGED' | 'CUSTOMER_MANAGED' | 'DEFAULT'
  /** KMS key for encryption (if CUSTOMER_MANAGED) */
  encryptionKey?: string
  /** Enable deletion protection */
  deletionProtection?: boolean
  /** Tags */
  tags?: Record<string, string>
}

export interface AnalyticsApiProps extends AnalyticsTableProps {
  /** API stage name */
  stageName?: string
  /** CORS allowed origins */
  corsOrigins?: string[]
  /** Lambda memory size */
  memorySize?: number
  /** Lambda timeout (seconds) */
  timeout?: number
  /** Lambda code path */
  codePath?: string
  /** Enable aggregation scheduled functions */
  enableAggregation?: boolean
}

// ============================================================================
// CDK Code Generator
// ============================================================================

/**
 * Generate CDK TypeScript code for analytics infrastructure
 */
export function generateCdkCode(props: AnalyticsApiProps = {}): string {
  const config = {
    tableName: props.tableName || 'analytics',
    billingMode: props.billingMode || 'PAY_PER_REQUEST',
    readCapacity: props.readCapacity || 5,
    writeCapacity: props.writeCapacity || 5,
    pointInTimeRecovery: props.pointInTimeRecovery ?? true,
    stream: props.stream,
    timeToLiveAttribute: props.timeToLiveAttribute || 'ttl',
    removalPolicy: props.removalPolicy || 'RETAIN',
    encryption: props.encryption || 'AWS_MANAGED',
    deletionProtection: props.deletionProtection ?? false,
    stageName: props.stageName || 'prod',
    corsOrigins: props.corsOrigins || ['*'],
    memorySize: props.memorySize || 256,
    timeout: props.timeout || 30,
    codePath: props.codePath || 'dist/lambda',
    enableAggregation: props.enableAggregation ?? true,
    tags: props.tags || {},
  }

  return `import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { Construct } from 'constructs'

export interface AnalyticsStackProps extends cdk.StackProps {
  tableName?: string
  stageName?: string
  corsOrigins?: string[]
}

export class AnalyticsStack extends cdk.Stack {
  public readonly table: dynamodb.Table
  public readonly api: apigateway.HttpApi

  constructor(scope: Construct, id: string, props: AnalyticsStackProps = {}) {
    super(scope, id, props)

    const tableName = props.tableName || '${config.tableName}'
    const stageName = props.stageName || '${config.stageName}'
    const corsOrigins = props.corsOrigins || ${JSON.stringify(config.corsOrigins)}

    // ========================================================================
    // DynamoDB Table
    // ========================================================================

    this.table = new dynamodb.Table(this, 'AnalyticsTable', {
      tableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.${config.billingMode},
      ${config.billingMode === 'PROVISIONED' ? `readCapacity: ${config.readCapacity},\n      writeCapacity: ${config.writeCapacity},` : ''}
      pointInTimeRecovery: ${config.pointInTimeRecovery},
      ${config.stream ? `stream: dynamodb.StreamViewType.${config.stream},` : ''}
      timeToLiveAttribute: '${config.timeToLiveAttribute}',
      removalPolicy: cdk.RemovalPolicy.${config.removalPolicy},
      encryption: dynamodb.TableEncryption.${config.encryption},
      deletionProtection: ${config.deletionProtection},
    })

    // GSI1: Owner lookups, date-based queries
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI2: Visitor lookups
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // ========================================================================
    // Lambda Functions
    // ========================================================================

    const commonLambdaProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: ${config.memorySize},
      timeout: cdk.Duration.seconds(${config.timeout}),
      environment: {
        ANALYTICS_TABLE: tableName,
        NODE_ENV: stageName,
      },
    }

    const collectFn = new lambda.Function(this, 'CollectFunction', {
      ...commonLambdaProps,
      handler: 'index.collectHandler',
      code: lambda.Code.fromAsset('${config.codePath}'),
      description: 'Collect analytics events',
    })

    const statsFn = new lambda.Function(this, 'StatsFunction', {
      ...commonLambdaProps,
      handler: 'index.statsHandler',
      code: lambda.Code.fromAsset('${config.codePath}'),
      description: 'Get analytics statistics',
    })

    const realtimeFn = new lambda.Function(this, 'RealtimeFunction', {
      ...commonLambdaProps,
      handler: 'index.realtimeHandler',
      code: lambda.Code.fromAsset('${config.codePath}'),
      description: 'Get realtime analytics',
    })

    const sitesFn = new lambda.Function(this, 'SitesFunction', {
      ...commonLambdaProps,
      handler: 'index.sitesHandler',
      code: lambda.Code.fromAsset('${config.codePath}'),
      description: 'Manage analytics sites',
    })

    const goalsFn = new lambda.Function(this, 'GoalsFunction', {
      ...commonLambdaProps,
      handler: 'index.goalsHandler',
      code: lambda.Code.fromAsset('${config.codePath}'),
      description: 'Manage analytics goals',
    })

    const scriptFn = new lambda.Function(this, 'ScriptFunction', {
      ...commonLambdaProps,
      handler: 'index.scriptHandler',
      code: lambda.Code.fromAsset('${config.codePath}'),
      description: 'Generate tracking script',
    })

    // Grant permissions
    this.table.grantReadWriteData(collectFn)
    this.table.grantReadData(statsFn)
    this.table.grantReadData(realtimeFn)
    this.table.grantReadWriteData(sitesFn)
    this.table.grantReadWriteData(goalsFn)

    // ========================================================================
    // API Gateway
    // ========================================================================

    this.api = new apigateway.HttpApi(this, 'AnalyticsApi', {
      apiName: \`\${tableName}-api\`,
      corsPreflight: {
        allowOrigins: corsOrigins,
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    // Routes
    this.api.addRoutes({
      path: '/api/analytics/collect',
      methods: [apigateway.HttpMethod.POST],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('CollectIntegration', collectFn),
    })

    this.api.addRoutes({
      path: '/api/analytics/sites/{siteId}/stats',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('StatsIntegration', statsFn),
    })

    this.api.addRoutes({
      path: '/api/analytics/sites/{siteId}/realtime',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('RealtimeIntegration', realtimeFn),
    })

    this.api.addRoutes({
      path: '/api/analytics/sites',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('SitesIntegration', sitesFn),
    })

    this.api.addRoutes({
      path: '/api/analytics/sites/{siteId}',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('SiteIntegration', sitesFn),
    })

    this.api.addRoutes({
      path: '/api/analytics/sites/{siteId}/goals',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('GoalsIntegration', goalsFn),
    })

    this.api.addRoutes({
      path: '/api/analytics/sites/{siteId}/script',
      methods: [apigateway.HttpMethod.GET],
      integration: new apigatewayIntegrations.HttpLambdaIntegration('ScriptIntegration', scriptFn),
    })

${config.enableAggregation ? `
    // ========================================================================
    // Aggregation Scheduled Functions
    // ========================================================================

    const aggregationFn = new lambda.Function(this, 'AggregationFunction', {
      ...commonLambdaProps,
      handler: 'index.aggregationHandler',
      code: lambda.Code.fromAsset('${config.codePath}'),
      description: 'Run analytics aggregation',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    })

    this.table.grantReadWriteData(aggregationFn)

    // Hourly aggregation
    new events.Rule(this, 'HourlyAggregation', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [
        new targets.LambdaFunction(aggregationFn, {
          event: events.RuleTargetInput.fromObject({ period: 'hour' }),
        }),
      ],
    })

    // Daily aggregation (midnight UTC)
    new events.Rule(this, 'DailyAggregation', {
      schedule: events.Schedule.cron({ hour: '0', minute: '0' }),
      targets: [
        new targets.LambdaFunction(aggregationFn, {
          event: events.RuleTargetInput.fromObject({ period: 'day' }),
        }),
      ],
    })

    // Monthly aggregation (1st of month, midnight UTC)
    new events.Rule(this, 'MonthlyAggregation', {
      schedule: events.Schedule.cron({ day: '1', hour: '0', minute: '0' }),
      targets: [
        new targets.LambdaFunction(aggregationFn, {
          event: events.RuleTargetInput.fromObject({ period: 'month' }),
        }),
      ],
    })
` : ''}

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'Analytics DynamoDB table name',
    })

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'Analytics DynamoDB table ARN',
    })

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Analytics API endpoint',
    })
  }
}

// ========================================================================
// App Entry Point
// ========================================================================

const app = new cdk.App()

new AnalyticsStack(app, 'AnalyticsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  ${Object.keys(config.tags).length > 0 ? `tags: ${JSON.stringify(config.tags)},` : ''}
})

app.synth()
`
}

/**
 * Generate minimal CDK code for just the table (no API)
 */
export function generateCdkTableCode(props: AnalyticsTableProps = {}): string {
  const config = {
    tableName: props.tableName || 'analytics',
    billingMode: props.billingMode || 'PAY_PER_REQUEST',
    readCapacity: props.readCapacity || 5,
    writeCapacity: props.writeCapacity || 5,
    pointInTimeRecovery: props.pointInTimeRecovery ?? true,
    stream: props.stream,
    timeToLiveAttribute: props.timeToLiveAttribute || 'ttl',
    removalPolicy: props.removalPolicy || 'RETAIN',
    encryption: props.encryption || 'AWS_MANAGED',
    deletionProtection: props.deletionProtection ?? false,
  }

  return `import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export class AnalyticsTableConstruct extends Construct {
  public readonly table: dynamodb.Table

  constructor(scope: Construct, id: string) {
    super(scope, id)

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: '${config.tableName}',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.${config.billingMode},
      ${config.billingMode === 'PROVISIONED' ? `readCapacity: ${config.readCapacity},\n      writeCapacity: ${config.writeCapacity},` : ''}
      pointInTimeRecovery: ${config.pointInTimeRecovery},
      ${config.stream ? `stream: dynamodb.StreamViewType.${config.stream},` : ''}
      timeToLiveAttribute: '${config.timeToLiveAttribute}',
      removalPolicy: cdk.RemovalPolicy.${config.removalPolicy},
      encryption: dynamodb.TableEncryption.${config.encryption},
      deletionProtection: ${config.deletionProtection},
    })

    // GSI1: Owner lookups, date-based queries
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI2: Visitor lookups
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
  }
}
`
}

// ============================================================================
// CreateTable Input Generator (for AWS SDK)
// ============================================================================

/**
 * Generate CreateTableInput for AWS SDK
 */
export function generateCreateTableInput(props: AnalyticsTableProps = {}): Record<string, unknown> {
  const config = {
    tableName: props.tableName || 'analytics',
    billingMode: props.billingMode || 'PAY_PER_REQUEST',
    readCapacity: props.readCapacity || 5,
    writeCapacity: props.writeCapacity || 5,
  }

  const input: Record<string, unknown> = {
    TableName: config.tableName,
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'gsi1pk', AttributeType: 'S' },
      { AttributeName: 'gsi1sk', AttributeType: 'S' },
      { AttributeName: 'gsi2pk', AttributeType: 'S' },
      { AttributeName: 'gsi2sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    BillingMode: config.billingMode,
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'gsi1pk', KeyType: 'HASH' },
          { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ...(config.billingMode === 'PROVISIONED' && {
          ProvisionedThroughput: {
            ReadCapacityUnits: config.readCapacity,
            WriteCapacityUnits: config.writeCapacity,
          },
        }),
      },
      {
        IndexName: 'GSI2',
        KeySchema: [
          { AttributeName: 'gsi2pk', KeyType: 'HASH' },
          { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ...(config.billingMode === 'PROVISIONED' && {
          ProvisionedThroughput: {
            ReadCapacityUnits: config.readCapacity,
            WriteCapacityUnits: config.writeCapacity,
          },
        }),
      },
    ],
  }

  if (config.billingMode === 'PROVISIONED') {
    input.ProvisionedThroughput = {
      ReadCapacityUnits: config.readCapacity,
      WriteCapacityUnits: config.writeCapacity,
    }
  }

  return input
}
