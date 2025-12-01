import { describe, expect, it } from 'bun:test'
import {
  generateAccessPatternMatrix,
  generateAnalyticsDesignDoc,
  generateAnalyticsSingleTableDesign,
  getAllAnalyticsModels,
  getAnalyticsModel,
  getAnalyticsModelNames,
} from '../src/analytics/model-connector'
import {
  generateAwsCliCommands,
  generateCdkCode,
  generateCdkTableCode,
  generateCloudFormationJson,
  generateCloudFormationTemplate,
  generateCloudFormationYaml,
  generateCreateTableInput,
  generateSamTemplate,
} from '../src/analytics/infrastructure'

describe('Analytics Infrastructure', () => {
  describe('CloudFormation', () => {
    it('should generate CloudFormation template', () => {
      const template = generateCloudFormationTemplate()

      expect(template).toHaveProperty('AWSTemplateFormatVersion')
      expect(template).toHaveProperty('Resources')
      expect(template).toHaveProperty('Outputs')

      const resources = template.Resources as Record<string, unknown>
      expect(resources).toHaveProperty('AnalyticsTable')
    })

    it('should generate template with custom config', () => {
      const template = generateCloudFormationTemplate({
        tableName: 'my-analytics',
        billingMode: 'PROVISIONED',
        provisionedCapacity: {
          readCapacityUnits: 10,
          writeCapacityUnits: 10,
        },
        enablePitr: true,
        enableStreams: true,
        streamViewType: 'NEW_AND_OLD_IMAGES',
      })

      const resources = template.Resources as Record<string, { Properties?: Record<string, unknown> }>
      const tableProps = resources.AnalyticsTable.Properties

      expect(tableProps?.TableName).toBe('my-analytics')
      expect(tableProps?.BillingMode).toBe('PROVISIONED')
      expect(tableProps?.StreamSpecification).toBeDefined()
    })

    it('should generate CloudFormation JSON', () => {
      const json = generateCloudFormationJson()

      expect(typeof json).toBe('string')
      expect(() => JSON.parse(json)).not.toThrow()

      const parsed = JSON.parse(json)
      expect(parsed.AWSTemplateFormatVersion).toBe('2010-09-09')
    })

    it('should generate CloudFormation YAML', () => {
      const yaml = generateCloudFormationYaml()

      expect(typeof yaml).toBe('string')
      expect(yaml).toContain('AWSTemplateFormatVersion')
      expect(yaml).toContain('AnalyticsTable')
    })

    it('should include GSI definitions', () => {
      const template = generateCloudFormationTemplate()
      const resources = template.Resources as Record<string, { Properties?: { GlobalSecondaryIndexes?: unknown[] } }>
      const gsis = resources.AnalyticsTable.Properties?.GlobalSecondaryIndexes

      expect(Array.isArray(gsis)).toBe(true)
      expect(gsis?.length).toBe(2)
      expect(gsis?.[0]).toHaveProperty('IndexName', 'GSI1')
      expect(gsis?.[1]).toHaveProperty('IndexName', 'GSI2')
    })

    it('should include TTL configuration', () => {
      const template = generateCloudFormationTemplate({ ttlAttributeName: 'ttl' })
      const resources = template.Resources as Record<string, { Properties?: { TimeToLiveSpecification?: unknown } }>
      const ttl = resources.AnalyticsTable.Properties?.TimeToLiveSpecification

      expect(ttl).toBeDefined()
    })
  })

  describe('SAM Template', () => {
    it('should generate SAM template with Lambda functions', () => {
      const template = generateSamTemplate()

      expect(template).toHaveProperty('Transform', 'AWS::Serverless-2016-10-31')
      expect(template).toHaveProperty('Globals')

      const resources = template.Resources as Record<string, unknown>
      expect(resources).toHaveProperty('AnalyticsTable')
      expect(resources).toHaveProperty('CollectFunction')
      expect(resources).toHaveProperty('StatsFunction')
      expect(resources).toHaveProperty('AggregationFunction')
    })

    it('should include API Gateway', () => {
      const template = generateSamTemplate()
      const resources = template.Resources as Record<string, unknown>

      expect(resources).toHaveProperty('AnalyticsApi')
    })

    it('should include scheduled aggregation', () => {
      const template = generateSamTemplate()
      const resources = template.Resources as Record<string, { Properties?: { Events?: Record<string, unknown> } }>
      const aggFn = resources.AggregationFunction

      expect(aggFn.Properties?.Events).toHaveProperty('HourlySchedule')
      expect(aggFn.Properties?.Events).toHaveProperty('DailySchedule')
      expect(aggFn.Properties?.Events).toHaveProperty('MonthlySchedule')
    })
  })

  describe('CDK Code Generation', () => {
    it('should generate CDK TypeScript code', () => {
      const code = generateCdkCode()

      expect(code).toContain('import * as cdk from')
      expect(code).toContain('import * as dynamodb from')
      expect(code).toContain('class AnalyticsStack')
      expect(code).toContain('new dynamodb.Table')
      expect(code).toContain('addGlobalSecondaryIndex')
    })

    it('should include Lambda functions', () => {
      const code = generateCdkCode({ enableAggregation: true })

      expect(code).toContain('new lambda.Function')
      expect(code).toContain('CollectFunction')
      expect(code).toContain('StatsFunction')
      expect(code).toContain('AggregationFunction')
    })

    it('should include API Gateway routes', () => {
      const code = generateCdkCode()

      expect(code).toContain('new apigateway.HttpApi')
      expect(code).toContain('/api/analytics/collect')
      expect(code).toContain('/api/analytics/sites')
    })

    it('should generate table-only CDK code', () => {
      const code = generateCdkTableCode()

      expect(code).toContain('class AnalyticsTableConstruct')
      expect(code).toContain('new dynamodb.Table')
      expect(code).not.toContain('new lambda.Function')
    })

    it('should respect config options', () => {
      const code = generateCdkCode({
        tableName: 'custom-analytics',
        billingMode: 'PROVISIONED',
        readCapacity: 20,
        writeCapacity: 20,
      })

      expect(code).toContain('custom-analytics')
      expect(code).toContain('BillingMode.PROVISIONED')
    })
  })

  describe('CreateTable Input', () => {
    it('should generate valid CreateTableInput', () => {
      const input = generateCreateTableInput()

      expect(input).toHaveProperty('TableName', 'analytics')
      expect(input).toHaveProperty('AttributeDefinitions')
      expect(input).toHaveProperty('KeySchema')
      expect(input).toHaveProperty('GlobalSecondaryIndexes')
      expect(input).toHaveProperty('BillingMode', 'PAY_PER_REQUEST')
    })

    it('should include all required attributes', () => {
      const input = generateCreateTableInput()
      const attrs = input.AttributeDefinitions as Array<{ AttributeName: string }>

      const attrNames = attrs.map(a => a.AttributeName)
      expect(attrNames).toContain('pk')
      expect(attrNames).toContain('sk')
      expect(attrNames).toContain('gsi1pk')
      expect(attrNames).toContain('gsi1sk')
      expect(attrNames).toContain('gsi2pk')
      expect(attrNames).toContain('gsi2sk')
    })

    it('should support provisioned capacity', () => {
      const input = generateCreateTableInput({
        billingMode: 'PROVISIONED',
        readCapacity: 15,
        writeCapacity: 15,
      })

      expect(input).toHaveProperty('ProvisionedThroughput')
      const throughput = input.ProvisionedThroughput as { ReadCapacityUnits: number }
      expect(throughput.ReadCapacityUnits).toBe(15)
    })
  })

  describe('AWS CLI Commands', () => {
    it('should generate bash script', () => {
      const script = generateAwsCliCommands()

      expect(script).toContain('#!/bin/bash')
      expect(script).toContain('aws dynamodb create-table')
      expect(script).toContain('--table-name')
      expect(script).toContain('--key-schema')
      expect(script).toContain('--global-secondary-indexes')
    })

    it('should include TTL and PITR commands', () => {
      const script = generateAwsCliCommands()

      expect(script).toContain('update-time-to-live')
      expect(script).toContain('update-continuous-backups')
    })

    it('should use custom table name', () => {
      const script = generateAwsCliCommands({ tableName: 'my-table' })

      expect(script).toContain('TABLE_NAME="my-table"')
    })
  })
})

describe('Analytics Model Connector', () => {
  describe('Model Registry', () => {
    it('should return all model names', () => {
      const names = getAnalyticsModelNames()

      expect(names).toContain('Site')
      expect(names).toContain('PageView')
      expect(names).toContain('Session')
      expect(names).toContain('Goal')
      expect(names).toContain('AggregatedStats')
      expect(names.length).toBe(15)
    })

    it('should get individual model', () => {
      const site = getAnalyticsModel('Site')

      expect(site).toBeDefined()
      expect(site?.name).toBe('Site')
      expect(site?.attributes).toHaveProperty('id')
      expect(site?.attributes).toHaveProperty('name')
    })

    it('should return undefined for unknown model', () => {
      const unknown = getAnalyticsModel('NonExistent')
      expect(unknown).toBeUndefined()
    })

    it('should get all models', () => {
      const models = getAllAnalyticsModels()

      expect(models.length).toBe(15)
      expect(models.every(m => m.name)).toBe(true)
    })
  })

  describe('Single-Table Design Generation', () => {
    it('should generate complete design', () => {
      const design = generateAnalyticsSingleTableDesign()

      expect(design).toHaveProperty('tableName', 'analytics')
      expect(design).toHaveProperty('keySchema')
      expect(design).toHaveProperty('globalSecondaryIndexes')
      expect(design).toHaveProperty('entities')
      expect(design).toHaveProperty('accessPatterns')
    })

    it('should include all entities', () => {
      const design = generateAnalyticsSingleTableDesign()

      expect(design.entities.length).toBe(15)

      const entityNames = design.entities.map(e => e.name)
      expect(entityNames).toContain('Site')
      expect(entityNames).toContain('PageView')
      expect(entityNames).toContain('Session')
    })

    it('should generate key patterns for each entity', () => {
      const design = generateAnalyticsSingleTableDesign()

      const site = design.entities.find(e => e.name === 'Site')
      expect(site?.keyPattern.pk).toBe('SITE#{id}')
      expect(site?.keyPattern.sk).toBe('SITE#{id}')
      expect(site?.keyPattern.gsi1pk).toBe('OWNER#{ownerId}')

      const pageView = design.entities.find(e => e.name === 'PageView')
      expect(pageView?.keyPattern.pk).toBe('SITE#{siteId}')
      expect(pageView?.keyPattern.sk).toContain('PV#')
    })

    it('should generate access patterns', () => {
      const design = generateAnalyticsSingleTableDesign()

      expect(design.accessPatterns.length).toBeGreaterThan(0)

      const getSiteById = design.accessPatterns.find(p => p.name === 'GetSiteById')
      expect(getSiteById).toBeDefined()
      expect(getSiteById?.operation).toBe('Get')
    })

    it('should include GSI definitions', () => {
      const design = generateAnalyticsSingleTableDesign()

      expect(design.globalSecondaryIndexes.length).toBe(2)
      expect(design.globalSecondaryIndexes[0].indexName).toBe('GSI1')
      expect(design.globalSecondaryIndexes[1].indexName).toBe('GSI2')
    })

    it('should support custom table name', () => {
      const design = generateAnalyticsSingleTableDesign('custom-table')
      expect(design.tableName).toBe('custom-table')
    })
  })

  describe('Documentation Generation', () => {
    it('should generate markdown documentation', () => {
      const doc = generateAnalyticsDesignDoc()

      expect(doc).toContain('# Analytics Single-Table Design')
      expect(doc).toContain('## Table Schema')
      expect(doc).toContain('## Entities')
      expect(doc).toContain('## Access Patterns')
    })

    it('should include entity details', () => {
      const doc = generateAnalyticsDesignDoc()

      expect(doc).toContain('### Site')
      expect(doc).toContain('### PageView')
      expect(doc).toContain('**Key Pattern:**')
      expect(doc).toContain('**Attributes:**')
    })

    it('should generate access pattern matrix', () => {
      const matrix = generateAccessPatternMatrix()

      expect(matrix).toContain('# Analytics Access Pattern Matrix')
      expect(matrix).toContain('| Entity |')
      expect(matrix).toContain('| Site |')
      expect(matrix).toContain('✅')
    })
  })

  describe('Entity Design', () => {
    it('should extract attributes correctly', () => {
      const design = generateAnalyticsSingleTableDesign()
      const pageView = design.entities.find(e => e.name === 'PageView')

      expect(pageView?.attributes).toBeDefined()
      expect(pageView?.attributes.some(a => a.name === 'path')).toBe(true)
      expect(pageView?.attributes.some(a => a.name === 'siteId')).toBe(true)
    })

    it('should extract relationships', () => {
      const design = generateAnalyticsSingleTableDesign()
      const site = design.entities.find(e => e.name === 'Site')

      expect(site?.relationships).toBeDefined()
      expect(site?.relationships.some(r => r.type === 'hasMany' && r.target === 'PageView')).toBe(true)
    })

    it('should infer DynamoDB types', () => {
      const design = generateAnalyticsSingleTableDesign()
      const aggregatedStats = design.entities.find(e => e.name === 'AggregatedStats')

      const pageViews = aggregatedStats?.attributes.find(a => a.name === 'pageViews')
      expect(pageViews?.dynamoType).toBe('N')

      const bounceRate = aggregatedStats?.attributes.find(a => a.name === 'bounceRate')
      expect(bounceRate?.dynamoType).toBe('N')
    })
  })
})
