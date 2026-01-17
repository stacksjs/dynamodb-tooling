// ============================================================================
// Query Analyzer - Analyze and Optimize DynamoDB Queries
// ============================================================================

/**
 * Query operation type
 */
export type QueryOperationType = 'GetItem' | 'Query' | 'Scan' | 'PutItem' | 'UpdateItem' | 'DeleteItem' | 'BatchGetItem' | 'BatchWriteItem' | 'TransactGetItems' | 'TransactWriteItems'

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  /** Operation type */
  operation: QueryOperationType
  /** Overall efficiency score (0-100) */
  score: number
  /** Analysis summary */
  summary: string
  /** Issues found */
  issues: QueryIssue[]
  /** Recommendations */
  recommendations: QueryRecommendation[]
  /** Estimated cost */
  estimatedCost: {
    readUnits: number
    writeUnits: number
    estimatedCostUsd: number
  }
  /** Query characteristics */
  characteristics: QueryCharacteristics
}

/**
 * Query issue
 */
export interface QueryIssue {
  /** Issue severity */
  severity: 'critical' | 'warning' | 'info'
  /** Issue code */
  code: string
  /** Issue message */
  message: string
  /** Affected component */
  component: string
}

/**
 * Query recommendation
 */
export interface QueryRecommendation {
  /** Recommendation priority */
  priority: 'high' | 'medium' | 'low'
  /** Recommendation */
  recommendation: string
  /** Expected improvement */
  expectedImprovement?: string
  /** Code example */
  example?: string
}

/**
 * Query characteristics
 */
export interface QueryCharacteristics {
  /** Uses partition key */
  usesPartitionKey: boolean
  /** Uses sort key */
  usesSortKey: boolean
  /** Uses index */
  usesIndex: boolean
  /** Index name */
  indexName?: string
  /** Is a full table scan */
  isFullScan: boolean
  /** Uses filter expression */
  usesFilter: boolean
  /** Has filter expression (alias for usesFilter) */
  hasFilter: boolean
  /** Uses projection */
  usesProjection: boolean
  /** Is consistent read */
  consistentRead: boolean
  /** Uses pagination */
  usesPagination: boolean
  /** Is a point read (GetItem) */
  isPointRead: boolean
  /** Is a write operation */
  isWrite: boolean
  /** Estimated items scanned */
  estimatedItemsScanned: number
  /** Estimated items returned */
  estimatedItemsReturned: number
}

/**
 * Query input for analysis
 */
export interface QueryInput {
  /** Operation type */
  operation: QueryOperationType
  /** Table name (optional for batch/transact operations) */
  tableName?: string
  /** Key condition expression */
  keyConditionExpression?: string
  /** Filter expression */
  filterExpression?: string
  /** Projection expression */
  projectionExpression?: string
  /** Update expression (for UpdateItem) */
  updateExpression?: string
  /** Expression attribute names */
  expressionAttributeNames?: Record<string, string>
  /** Expression attribute values */
  expressionAttributeValues?: Record<string, unknown>
  /** Index name */
  indexName?: string
  /** Consistent read */
  consistentRead?: boolean
  /** Limit */
  limit?: number
  /** Scan index forward */
  scanIndexForward?: boolean
  /** Key (for GetItem) */
  key?: Record<string, unknown>
  /** Item (for PutItem) */
  item?: Record<string, unknown>
  /** Request items for BatchGetItem/BatchWriteItem */
  requestItems?: Record<string, unknown>
  /** Transact items for TransactGetItems/TransactWriteItems */
  transactItems?: unknown[]
}

/**
 * Table metadata for analysis
 */
export interface TableMetadata {
  /** Table name */
  tableName: string
  /** Partition key name */
  partitionKey: string
  /** Sort key name */
  sortKey?: string
  /** Global secondary indexes */
  gsis?: Array<{
    indexName: string
    partitionKey: string
    sortKey?: string
  }>
  /** Local secondary indexes */
  lsis?: Array<{
    indexName: string
    sortKey: string
  }>
  /** Average item size in bytes */
  averageItemSize?: number
  /** Total item count */
  itemCount?: number
}

/**
 * Query analyzer
 */
export class QueryAnalyzer {
  private tableMetadata: Map<string, TableMetadata> = new Map()

  /**
   * Register table metadata
   */
  registerTable(metadata: TableMetadata): this {
    this.tableMetadata.set(metadata.tableName, metadata)
    return this
  }

  /**
   * Analyze a query
   */
  analyze(input: QueryInput): QueryAnalysis {
    const issues: QueryIssue[] = []
    const recommendations: QueryRecommendation[] = []
    const metadata = input.tableName ? this.tableMetadata.get(input.tableName) : undefined

    // Analyze characteristics
    const characteristics = this.analyzeCharacteristics(input, metadata)

    // Check for issues
    this.checkForIssues(input, characteristics, metadata, issues, recommendations)

    // Calculate score
    const score = this.calculateScore(issues, characteristics)

    // Estimate cost
    const estimatedCost = this.estimateCost(input, characteristics, metadata)

    // Generate summary
    const summary = this.generateSummary(input, characteristics, score)

    return {
      operation: input.operation,
      score,
      summary,
      issues,
      recommendations,
      estimatedCost,
      characteristics,
    }
  }

  /**
   * Analyze query to suggest optimal index
   */
  suggestIndex(input: QueryInput): {
    suggestion: string
    indexType: 'GSI' | 'LSI' | 'none'
    keySchema?: {
      partitionKey: string
      sortKey?: string
    }
  } {
    const metadata = input.tableName ? this.tableMetadata.get(input.tableName) : undefined
    if (!metadata) {
      return { suggestion: 'Cannot suggest index without table metadata', indexType: 'none' }
    }

    // Check if query already uses an efficient key condition
    if (input.keyConditionExpression) {
      // Extract attributes from key condition
      const attributes = this.extractAttributesFromExpression(
        input.keyConditionExpression,
        input.expressionAttributeNames,
      )

      // Check if using table's primary key
      if (attributes.includes(metadata.partitionKey)) {
        return {
          suggestion: 'Query already uses table primary key',
          indexType: 'none',
        }
      }

      // Check existing GSIs
      if (metadata.gsis) {
        for (const gsi of metadata.gsis) {
          if (attributes.includes(gsi.partitionKey)) {
            return {
              suggestion: `Consider using existing GSI: ${gsi.indexName}`,
              indexType: 'GSI',
              keySchema: {
                partitionKey: gsi.partitionKey,
                sortKey: gsi.sortKey,
              },
            }
          }
        }
      }

      // Suggest new GSI based on filter expression
      if (input.filterExpression) {
        const filterAttrs = this.extractAttributesFromExpression(
          input.filterExpression,
          input.expressionAttributeNames,
        )

        if (filterAttrs.length > 0) {
          return {
            suggestion: `Create GSI with partition key on frequently filtered attribute: ${filterAttrs[0]}`,
            indexType: 'GSI',
            keySchema: {
              partitionKey: filterAttrs[0],
              sortKey: filterAttrs.length > 1 ? filterAttrs[1] : undefined,
            },
          }
        }
      }
    }

    // For scan operations
    if (input.operation === 'Scan' && input.filterExpression) {
      const filterAttrs = this.extractAttributesFromExpression(
        input.filterExpression,
        input.expressionAttributeNames,
      )

      if (filterAttrs.length > 0) {
        return {
          suggestion: `Convert Scan to Query by creating GSI with partition key: ${filterAttrs[0]}`,
          indexType: 'GSI',
          keySchema: {
            partitionKey: filterAttrs[0],
          },
        }
      }
    }

    return { suggestion: 'No index suggestion available', indexType: 'none' }
  }

  /**
   * Explain a query in human-readable format
   */
  explain(input: QueryInput): string {
    const _metadata = input.tableName ? this.tableMetadata.get(input.tableName) : undefined
    const lines: string[] = []

    lines.push(`Operation: ${input.operation}`)
    lines.push(`Table: ${input.tableName ?? 'N/A'}`)

    if (input.indexName) {
      lines.push(`Index: ${input.indexName}`)
    }

    if (input.keyConditionExpression) {
      lines.push(`Key Condition: ${this.humanizeExpression(input.keyConditionExpression, input.expressionAttributeNames, input.expressionAttributeValues)}`)
    }

    if (input.filterExpression) {
      lines.push(`Filter: ${this.humanizeExpression(input.filterExpression, input.expressionAttributeNames, input.expressionAttributeValues)}`)
    }

    if (input.projectionExpression) {
      lines.push(`Projection: ${this.humanizeExpression(input.projectionExpression, input.expressionAttributeNames)}`)
    }

    if (input.limit) {
      lines.push(`Limit: ${input.limit} items`)
    }

    lines.push(`Consistent Read: ${input.consistentRead ? 'Yes' : 'No (eventual consistency)'}`)

    // Access pattern analysis
    lines.push('')
    lines.push('Access Pattern:')

    if (input.operation === 'GetItem') {
      lines.push('  - Direct item lookup by primary key')
      lines.push('  - Most efficient operation (1 RCU for items up to 4KB)')
    }
    else if (input.operation === 'Query') {
      if (input.indexName) {
        lines.push(`  - Query using secondary index: ${input.indexName}`)
      }
      else {
        lines.push('  - Query using table primary key')
      }
      lines.push('  - Efficient if partition key is specified')
    }
    else if (input.operation === 'Scan') {
      lines.push('  - FULL TABLE SCAN - reads every item')
      lines.push('  - Very expensive for large tables')
      lines.push('  - Consider using Query with appropriate index')
    }

    // Cost estimation
    const analysis = this.analyze(input)
    lines.push('')
    lines.push('Estimated Cost:')
    lines.push(`  - Read Capacity Units: ${analysis.estimatedCost.readUnits}`)
    lines.push(`  - Write Capacity Units: ${analysis.estimatedCost.writeUnits}`)
    lines.push(`  - Estimated USD: $${analysis.estimatedCost.estimatedCostUsd.toFixed(6)}`)

    return lines.join('\n')
  }

  private analyzeCharacteristics(input: QueryInput, metadata?: TableMetadata): QueryCharacteristics {
    const usesPartitionKey = this.usesPartitionKey(input, metadata)
    const usesSortKey = this.usesSortKey(input, metadata)
    const isFullScan = input.operation === 'Scan'
    const usesFilter = !!input.filterExpression
    const isPointRead = input.operation === 'GetItem'
    const writeOperations: QueryOperationType[] = ['PutItem', 'UpdateItem', 'DeleteItem', 'BatchWriteItem', 'TransactWriteItems']
    const isWrite = writeOperations.includes(input.operation)

    // Estimate items scanned
    let estimatedItemsScanned = 0
    let estimatedItemsReturned = 0

    if (metadata?.itemCount) {
      if (isFullScan) {
        estimatedItemsScanned = metadata.itemCount
        estimatedItemsReturned = input.limit
          ? Math.min(input.limit, metadata.itemCount)
          : metadata.itemCount
      }
      else if (input.operation === 'Query') {
        // Estimate based on partition key selectivity
        estimatedItemsScanned = Math.ceil(metadata.itemCount / 100) // Rough estimate
        estimatedItemsReturned = input.limit
          ? Math.min(input.limit, estimatedItemsScanned)
          : estimatedItemsScanned
      }
      else if (input.operation === 'GetItem') {
        estimatedItemsScanned = 1
        estimatedItemsReturned = 1
      }
    }

    return {
      usesPartitionKey,
      usesSortKey,
      usesIndex: !!input.indexName,
      indexName: input.indexName,
      isFullScan,
      usesFilter,
      hasFilter: usesFilter,
      usesProjection: !!input.projectionExpression,
      consistentRead: input.consistentRead ?? false,
      usesPagination: !!input.limit,
      isPointRead,
      isWrite,
      estimatedItemsScanned,
      estimatedItemsReturned,
    }
  }

  private checkForIssues(
    input: QueryInput,
    characteristics: QueryCharacteristics,
    metadata: TableMetadata | undefined,
    issues: QueryIssue[],
    recommendations: QueryRecommendation[],
  ): void {
    // Full table scan
    if (characteristics.isFullScan) {
      issues.push({
        severity: 'critical',
        code: 'FULL_TABLE_SCAN',
        message: 'Operation performs a full table scan',
        component: 'operation',
      })
      recommendations.push({
        priority: 'high',
        recommendation: 'Convert Scan to Query operation using a partition key',
        expectedImprovement: 'Significant reduction in RCU consumption and latency',
      })
    }

    // Filter without key condition (except for Scan)
    if (input.filterExpression && !input.keyConditionExpression && input.operation !== 'Scan') {
      issues.push({
        severity: 'warning',
        code: 'FILTER_WITHOUT_KEY',
        message: 'Filter expression used without key condition',
        component: 'filter',
      })
    }

    // Large limit without pagination token consideration
    if (input.limit && input.limit > 100) {
      issues.push({
        severity: 'info',
        code: 'LARGE_LIMIT',
        message: `Large limit value (${input.limit}) may result in timeout or high RCU consumption`,
        component: 'limit',
      })
      recommendations.push({
        priority: 'medium',
        recommendation: 'Consider implementing pagination with smaller page sizes',
        expectedImprovement: 'Better response times and cost control',
      })
    }

    // No projection with large items
    if (!characteristics.usesProjection && metadata?.averageItemSize && metadata.averageItemSize > 1000) {
      issues.push({
        severity: 'warning',
        code: 'NO_PROJECTION',
        message: 'No projection expression used with potentially large items',
        component: 'projection',
      })
      recommendations.push({
        priority: 'medium',
        recommendation: 'Add projection expression to return only needed attributes',
        expectedImprovement: 'Reduced data transfer and potentially lower RCU',
      })
    }

    // Consistent read when not necessary
    if (characteristics.consistentRead) {
      issues.push({
        severity: 'info',
        code: 'CONSISTENT_READ',
        message: 'Consistent read doubles RCU consumption',
        component: 'consistency',
      })
      recommendations.push({
        priority: 'low',
        recommendation: 'Consider if eventual consistency is acceptable for this use case',
        expectedImprovement: '50% reduction in RCU consumption',
      })
    }

    // Filter expression doing work that could be in key condition
    if (input.filterExpression && metadata) {
      const filterAttrs = this.extractAttributesFromExpression(
        input.filterExpression,
        input.expressionAttributeNames,
      )

      // Check if filter uses sort key when it could be in key condition
      if (metadata.sortKey && filterAttrs.includes(metadata.sortKey)) {
        issues.push({
          severity: 'warning',
          code: 'SORT_KEY_IN_FILTER',
          message: 'Sort key used in filter expression instead of key condition',
          component: 'filter',
        })
        recommendations.push({
          priority: 'high',
          recommendation: 'Move sort key condition to KeyConditionExpression',
          expectedImprovement: 'Reduced items scanned and RCU consumption',
        })
      }
    }
  }

  private calculateScore(issues: QueryIssue[], characteristics: QueryCharacteristics): number {
    let score = 100

    // Deduct for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 55  // Ensure full table scans score <= 50
          break
        case 'warning':
          score -= 15
          break
        case 'info':
          score -= 5
          break
      }
    }

    // Bonus for good practices
    if (characteristics.usesProjection)
      score += 5
    if (characteristics.usesPartitionKey && !characteristics.isFullScan)
      score += 10
    if (characteristics.usesSortKey && !characteristics.isFullScan)
      score += 5
    if (characteristics.usesPagination)
      score += 5

    // Query operations start with a good base score if not a scan
    if (!characteristics.isFullScan && !characteristics.isPointRead) {
      // Query operation - give reasonable score even without full metadata
      score = Math.min(score, 90)  // Cap at 90 for non-point-read queries
    }

    return Math.max(0, Math.min(100, score))
  }

  private estimateCost(
    input: QueryInput,
    characteristics: QueryCharacteristics,
    metadata?: TableMetadata,
  ): { readUnits: number, writeUnits: number, estimatedCostUsd: number } {
    const avgItemSize = metadata?.averageItemSize ?? 1000 // 1KB default
    const itemCount = metadata?.itemCount ?? 1000

    let readUnits = 0
    let writeUnits = 0

    // Calculate based on operation type
    switch (input.operation) {
      case 'GetItem':
        readUnits = Math.ceil(avgItemSize / 4096)
        break
      case 'Query':
      case 'Scan': {
        const itemsScanned = characteristics.estimatedItemsScanned || itemCount
        readUnits = Math.ceil((itemsScanned * avgItemSize) / 4096)
        break
      }
      case 'PutItem':
      case 'DeleteItem':
        writeUnits = Math.ceil(avgItemSize / 1024)
        break
      case 'UpdateItem':
        writeUnits = Math.ceil(avgItemSize / 1024)
        break
      case 'BatchGetItem':
        readUnits = Math.ceil((25 * avgItemSize) / 4096) // Assume max batch size
        break
      case 'BatchWriteItem':
        writeUnits = Math.ceil((25 * avgItemSize) / 1024) // Assume max batch size
        break
    }

    // Double for consistent reads
    if (characteristics.consistentRead) {
      readUnits *= 2
    }

    // Pricing (approximate, varies by region)
    const readCostPer = 0.00000025 // $0.25 per million RCU
    const writeCostPer = 0.00000125 // $1.25 per million WCU

    const estimatedCostUsd = (readUnits * readCostPer) + (writeUnits * writeCostPer)

    return { readUnits, writeUnits, estimatedCostUsd }
  }

  private generateSummary(
    input: QueryInput,
    characteristics: QueryCharacteristics,
    score: number,
  ): string {
    const parts: string[] = []

    if (score >= 80) {
      parts.push('Well-optimized query.')
    }
    else if (score >= 60) {
      parts.push('Query has room for optimization.')
    }
    else if (score >= 40) {
      parts.push('Query needs optimization.')
    }
    else {
      parts.push('Query is inefficient and should be redesigned.')
    }

    if (characteristics.isFullScan) {
      parts.push('Full table scan detected.')
    }

    if (characteristics.usesIndex) {
      parts.push(`Uses index: ${characteristics.indexName}.`)
    }

    return parts.join(' ')
  }

  private usesPartitionKey(input: QueryInput, metadata?: TableMetadata): boolean {
    if (input.operation === 'GetItem' && input.key) {
      return true
    }

    if (!input.keyConditionExpression || !metadata) {
      return false
    }

    const attrs = this.extractAttributesFromExpression(
      input.keyConditionExpression,
      input.expressionAttributeNames,
    )

    return attrs.includes(metadata.partitionKey)
  }

  private usesSortKey(input: QueryInput, metadata?: TableMetadata): boolean {
    if (input.operation === 'GetItem' && input.key) {
      if (metadata?.sortKey) {
        return metadata.sortKey in input.key
      }
      // Check for common sort key names
      return 'sk' in input.key || 'SK' in input.key || 'sortKey' in input.key
    }

    if (!input.keyConditionExpression)
      return false

    const attrs = this.extractAttributesFromExpression(
      input.keyConditionExpression,
      input.expressionAttributeNames,
    )

    // If metadata has sort key, check if it's used
    if (metadata?.sortKey) {
      return attrs.includes(metadata.sortKey)
    }

    // Check for common sort key patterns in expression (sk, begins_with, BETWEEN on second key)
    const expr = input.keyConditionExpression.toLowerCase()
    const hasAndClause = expr.includes(' and ')
    if (hasAndClause) {
      // Check for common sort key names or functions that typically use sort keys
      return attrs.some(attr => ['sk', 'sortkey', 'sort_key'].includes(attr.toLowerCase())) ||
        expr.includes('begins_with') ||
        expr.includes('between')
    }

    return false
  }

  private extractAttributesFromExpression(
    expression: string,
    names?: Record<string, string>,
  ): string[] {
    const attributes: string[] = []

    // Find #name patterns
    const namePattern = /#(\w+)/g
    let match: RegExpExecArray | null
    while ((match = namePattern.exec(expression)) !== null) {
      const placeholder = match[1]
      const actualName = names?.[`#${placeholder}`] ?? placeholder
      attributes.push(actualName)
    }

    // Also find direct attribute names (simple cases)
    const directPattern = /\b([a-z_]\w*)\s*[=<>]/gi
    while ((match = directPattern.exec(expression)) !== null) {
      if (!match[1].startsWith(':')) {
        attributes.push(match[1])
      }
    }

    return [...new Set(attributes)]
  }

  private humanizeExpression(
    expression: string,
    names?: Record<string, string>,
    values?: Record<string, unknown>,
  ): string {
    let result = expression

    // Replace name placeholders
    if (names) {
      for (const [placeholder, name] of Object.entries(names)) {
        result = result.replace(new RegExp(placeholder.replace('#', '\\#'), 'g'), name)
      }
    }

    // Replace value placeholders
    if (values) {
      for (const [placeholder, value] of Object.entries(values)) {
        result = result.replace(
          new RegExp(placeholder.replace(':', '\\:'), 'g'),
          JSON.stringify(value),
        )
      }
    }

    return result
  }
}

/**
 * Query analyzer options
 */
export interface QueryAnalyzerOptions {
  /** Warn on scan operations */
  warnOnScan?: boolean
  /** Warn on missing index */
  warnOnMissingIndex?: boolean
}

/**
 * Create a query analyzer
 */
export function createQueryAnalyzer(_options?: QueryAnalyzerOptions): QueryAnalyzer {
  return new QueryAnalyzer()
}
