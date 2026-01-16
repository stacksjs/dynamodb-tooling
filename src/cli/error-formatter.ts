// ============================================================================
// CLI Error Formatter
// ============================================================================
// Context-aware error formatting with suggestions and help

import nodeProcess from 'node:process'
import {
  ConditionalCheckFailedError,
  DynamoDBInternalError,
  DynamoDBValidationError,
  isDynamoDBError,
  isRetryableError,
  ItemCollectionSizeLimitExceededError,
  ItemNotFoundError,
  ProvisionedThroughputExceededError,
  RequestLimitExceededError,
  ResourceInUseError,
  ResourceNotFoundError,
  ServiceUnavailableError,
  ThrottlingError,
  TransactionCancelledError,
} from '../types/errors'
import { box, c, icons } from './ui'

// ============================================================================
// Error Context
// ============================================================================

export interface ErrorContext {
  command?: string
  tableName?: string
  model?: string
  operation?: string
  keys?: { pk?: string, sk?: string }
  timestamp?: Date
}

// ============================================================================
// Suggestion Types
// ============================================================================

interface ErrorSuggestion {
  title: string
  description?: string
  command?: string
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format an error with context and suggestions
 */
export function formatError(error: unknown, context: ErrorContext = {}): string {
  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(`${c.error(icons.error)} ${c.bold(c.red('Error'))}`)
  lines.push('')

  // Error message
  const message = error instanceof Error ? error.message : String(error)
  lines.push(c.red(message))
  lines.push('')

  // Error details (for DynamoDB errors)
  if (isDynamoDBError(error)) {
    lines.push(formatDynamoDBErrorDetails(error))
    lines.push('')
  }

  // Context
  if (Object.keys(context).length > 0) {
    lines.push(c.dim('Context:'))
    if (context.command)
      lines.push(`  ${c.dim('Command:')} ${context.command}`)
    if (context.tableName)
      lines.push(`  ${c.dim('Table:')} ${context.tableName}`)
    if (context.model)
      lines.push(`  ${c.dim('Model:')} ${context.model}`)
    if (context.operation)
      lines.push(`  ${c.dim('Operation:')} ${context.operation}`)
    if (context.keys) {
      lines.push(`  ${c.dim('Keys:')} pk=${context.keys.pk}${context.keys.sk ? `, sk=${context.keys.sk}` : ''}`)
    }
    lines.push('')
  }

  // Suggestions
  const suggestions = getSuggestionsForError(error, context)
  if (suggestions.length > 0) {
    lines.push(c.yellow('Suggestions:'))
    for (const suggestion of suggestions) {
      lines.push(`  ${icons.arrowRight} ${suggestion.title}`)
      if (suggestion.description) {
        lines.push(`    ${c.dim(suggestion.description)}`)
      }
      if (suggestion.command) {
        lines.push(`    ${c.cyan(`$ ${suggestion.command}`)}`)
      }
    }
    lines.push('')
  }

  // Stack trace (only in verbose/debug mode)
  if (nodeProcess.env.DEBUG && error instanceof Error && error.stack) {
    lines.push(c.dim('Stack trace:'))
    lines.push(c.dim(error.stack.split('\n').slice(1).join('\n')))
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format DynamoDB-specific error details
 */
function formatDynamoDBErrorDetails(error: unknown): string {
  const lines: string[] = []

  lines.push(c.dim('Error Details:'))

  if (error instanceof ItemNotFoundError) {
    lines.push(`  ${c.dim('Type:')} Item Not Found`)
    lines.push(`  ${c.dim('Model:')} ${error.model}`)
    lines.push(`  ${c.dim('Keys:')} pk=${error.keys.pk}${error.keys.sk ? `, sk=${error.keys.sk}` : ''}`)
    lines.push(`  ${c.dim('Retryable:')} ${c.red('No')}`)
  }
  else if (error instanceof DynamoDBValidationError) {
    lines.push(`  ${c.dim('Type:')} Validation Error`)
    lines.push(`  ${c.dim('Model:')} ${error.model}`)
    lines.push(`  ${c.dim('Fields with errors:')}`)
    for (const [field, errors] of Object.entries(error.fieldErrors)) {
      lines.push(`    ${c.yellow(field)}: ${errors.join(', ')}`)
    }
  }
  else if (error instanceof ConditionalCheckFailedError) {
    lines.push(`  ${c.dim('Type:')} Conditional Check Failed`)
    lines.push(`  ${c.dim('Model:')} ${error.model}`)
    if (error.expectedVersion !== undefined) {
      lines.push(`  ${c.dim('Expected Version:')} ${error.expectedVersion}`)
      lines.push(`  ${c.dim('Actual Version:')} ${error.actualVersion ?? 'unknown'}`)
    }
  }
  else if (error instanceof TransactionCancelledError) {
    lines.push(`  ${c.dim('Type:')} Transaction Cancelled`)
    lines.push(`  ${c.dim('Reasons:')}`)
    error.cancellationReasons.forEach((reason, i) => {
      if (reason.Code !== 'None') {
        lines.push(`    Item ${i}: ${reason.Code}${reason.Message ? ` - ${reason.Message}` : ''}`)
      }
    })
    lines.push(`  ${c.dim('Retryable:')} ${error.retryable ? c.green('Yes') : c.red('No')}`)
  }
  else if (error instanceof ProvisionedThroughputExceededError) {
    lines.push(`  ${c.dim('Type:')} Throughput Exceeded`)
    lines.push(`  ${c.dim('Table:')} ${error.tableName}`)
    lines.push(`  ${c.dim('Retryable:')} ${c.green('Yes')}`)
    if (error.retryAfterMs) {
      lines.push(`  ${c.dim('Retry After:')} ${error.retryAfterMs}ms`)
    }
  }
  else if (error instanceof ResourceNotFoundError) {
    lines.push(`  ${c.dim('Type:')} Resource Not Found`)
    lines.push(`  ${c.dim('Resource Type:')} ${error.resourceType}`)
    lines.push(`  ${c.dim('Resource Name:')} ${error.resourceName}`)
  }
  else if (error instanceof ResourceInUseError) {
    lines.push(`  ${c.dim('Type:')} Resource In Use`)
    lines.push(`  ${c.dim('Resource:')} ${error.resourceName}`)
    lines.push(`  ${c.dim('Status:')} ${error.status}`)
    lines.push(`  ${c.dim('Retryable:')} ${c.green('Yes')} (wait for resource to become available)`)
  }
  else if (error instanceof ItemCollectionSizeLimitExceededError) {
    lines.push(`  ${c.dim('Type:')} Item Collection Size Limit`)
    lines.push(`  ${c.dim('Table:')} ${error.tableName}`)
    lines.push(`  ${c.dim('Partition Key:')} ${error.partitionKey}`)
  }
  else if (error instanceof RequestLimitExceededError || error instanceof ThrottlingError) {
    lines.push(`  ${c.dim('Type:')} Request Throttled`)
    lines.push(`  ${c.dim('Retryable:')} ${c.green('Yes')} (with exponential backoff)`)
    const retryMs = error instanceof RequestLimitExceededError ? error.retryAfterMs : (error as ThrottlingError).retryAfterMs
    if (retryMs) {
      lines.push(`  ${c.dim('Retry After:')} ${retryMs}ms`)
    }
  }
  else if (error instanceof DynamoDBInternalError || error instanceof ServiceUnavailableError) {
    lines.push(`  ${c.dim('Type:')} Service Error`)
    lines.push(`  ${c.dim('Retryable:')} ${c.green('Yes')} (service should recover)`)
    if (error instanceof DynamoDBInternalError && error.requestId) {
      lines.push(`  ${c.dim('Request ID:')} ${error.requestId}`)
    }
  }

  return lines.join('\n')
}

/**
 * Get suggestions for how to resolve the error
 */
function getSuggestionsForError(error: unknown, context: ErrorContext): ErrorSuggestion[] {
  const suggestions: ErrorSuggestion[] = []

  if (error instanceof ItemNotFoundError) {
    suggestions.push({
      title: 'Verify the item exists',
      command: `dbtooling query:get --pk "${error.keys.pk}"${error.keys.sk ? ` --sk "${error.keys.sk}"` : ''}`,
    })
    suggestions.push({
      title: 'List items in the table',
      command: 'dbtooling query:scan --limit 10',
    })
    suggestions.push({
      title: 'Check for typos in the key values',
      description: 'Ensure partition key and sort key values match exactly',
    })
  }
  else if (error instanceof DynamoDBValidationError) {
    suggestions.push({
      title: 'Review model schema',
      command: `dbtooling models:show ${error.model}`,
    })
    suggestions.push({
      title: 'Check required fields',
      description: `Ensure all required fields are provided for ${error.model}`,
    })
    const fields = error.getErrorFields()
    if (fields.length > 0) {
      suggestions.push({
        title: `Fix validation errors for: ${fields.join(', ')}`,
        description: 'See field-specific errors above',
      })
    }
  }
  else if (error instanceof ConditionalCheckFailedError) {
    suggestions.push({
      title: 'Refresh and retry',
      description: 'The item was modified by another process. Fetch the latest version and retry.',
    })
    suggestions.push({
      title: 'Review concurrent access patterns',
      description: 'Consider using transactions for complex operations',
    })
  }
  else if (error instanceof TransactionCancelledError) {
    if (error.isConflict()) {
      suggestions.push({
        title: 'Transaction conflict detected',
        description: 'Another transaction is operating on the same items. Retry with exponential backoff.',
      })
    }
    const conditionalFailures = error.getConditionalCheckFailures()
    if (conditionalFailures.length > 0) {
      suggestions.push({
        title: `Conditional check failed for items: ${conditionalFailures.join(', ')}`,
        description: 'Review the conditions for these items',
      })
    }
  }
  else if (error instanceof ProvisionedThroughputExceededError) {
    suggestions.push({
      title: 'Consider enabling on-demand capacity',
      command: 'dbtooling table:update --billing-mode PAY_PER_REQUEST',
    })
    suggestions.push({
      title: 'Increase provisioned capacity',
      command: 'dbtooling table:update --read-capacity 100 --write-capacity 100',
    })
    suggestions.push({
      title: 'Implement exponential backoff',
      description: 'Use the built-in retry handler with backoff',
    })
  }
  else if (error instanceof ResourceNotFoundError) {
    if (error.resourceType === 'Table') {
      suggestions.push({
        title: 'Create the table',
        command: 'dbtooling table:create',
      })
      suggestions.push({
        title: 'List available tables',
        command: 'dbtooling table:list',
      })
      suggestions.push({
        title: 'Check table name in config',
        command: 'dbtooling config',
      })
    }
    else if (error.resourceType === 'Index') {
      suggestions.push({
        title: 'Run migrations to create the index',
        command: 'dbtooling migrate',
      })
    }
  }
  else if (error instanceof ResourceInUseError) {
    suggestions.push({
      title: 'Wait for the resource to become available',
      command: `dbtooling table:wait ${error.resourceName}`,
    })
  }
  else if (error instanceof ItemCollectionSizeLimitExceededError) {
    suggestions.push({
      title: 'Review your partition key design',
      description: 'Item collections for a single partition key cannot exceed 10GB',
    })
    suggestions.push({
      title: 'Consider sharding the partition key',
      description: 'Add a suffix to distribute items across partitions',
    })
    suggestions.push({
      title: 'Archive old items',
      description: 'Move historical data to a separate table or S3',
    })
  }
  else if (isRetryableError(error)) {
    suggestions.push({
      title: 'Retry with exponential backoff',
      description: 'The error is transient and should resolve on retry',
    })
  }

  // Generic suggestions based on context
  if (context.command) {
    suggestions.push({
      title: 'Get help for this command',
      command: `dbtooling ${context.command} --help`,
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Check the documentation',
      description: 'Visit the DynamoDB Tooling docs for more information',
    })
    suggestions.push({
      title: 'Enable debug mode for more details',
      command: 'DEBUG=1 dbtooling <command>',
    })
  }

  return suggestions
}

// ============================================================================
// Error Display
// ============================================================================

/**
 * Display an error with full formatting
 */
export function displayError(error: unknown, context: ErrorContext = {}): void {
  console.error(formatError(error, context))
}

/**
 * Display a simple error message
 */
export function displaySimpleError(message: string): void {
  console.error(`${c.error(icons.error)} ${message}`)
}

/**
 * Display a warning
 */
export function displayWarning(message: string, suggestions?: string[]): void {
  console.log()
  console.log(`${c.warning(icons.warning)} ${c.bold(c.yellow('Warning'))}`)
  console.log()
  console.log(c.yellow(message))

  if (suggestions && suggestions.length > 0) {
    console.log()
    console.log(c.dim('Suggestions:'))
    for (const suggestion of suggestions) {
      console.log(`  ${icons.arrowRight} ${suggestion}`)
    }
  }
  console.log()
}

/**
 * Display a confirmation prompt message
 */
export function displayConfirmation(
  title: string,
  details: string[],
  warning?: string,
): void {
  console.log()
  console.log(box(
    [
      c.bold(title),
      '',
      ...details.map(d => `  ${icons.bullet} ${d}`),
      ...(warning ? ['', c.yellow(`${icons.warning} ${warning}`)] : []),
    ].join('\n'),
    { borderColor: warning ? c.yellow : c.cyan, padding: 1 },
  ))
  console.log()
}

// ============================================================================
// Exit Handlers
// ============================================================================

/**
 * Exit with formatted error
 */
export function exitWithError(error: unknown, context: ErrorContext = {}): never {
  displayError(error, context)
  nodeProcess.exit(1)
}

/**
 * Handle CLI command errors uniformly (enhanced version)
 */
export function handleCommandError(error: unknown, command?: string): never {
  exitWithError(error, { command, timestamp: new Date() })
}
