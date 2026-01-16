// ============================================================================
// Data Generator - Test Data Generation for DynamoDB
// ============================================================================

/**
 * Generator function type
 */
export type GeneratorFn<T = unknown> = () => T

/**
 * Field generator configuration
 */
export interface FieldGenerator<T = unknown> {
  /** Generator function */
  generator: GeneratorFn<T>
  /** Field is optional (may be omitted) */
  optional?: boolean
  /** Probability of being included (0-1) for optional fields */
  probability?: number
}

/**
 * Schema definition for data generation
 */
export type GeneratorSchema = Record<string, FieldGenerator | GeneratorFn>

/**
 * Built-in generators
 */
export const generators = {
  /**
   * Generate a UUID v4
   */
  uuid: (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  },

  /**
   * Generate a random string
   */
  string: (options?: { length?: number, charset?: string }): string => {
    const length = options?.length ?? 10
    const charset = options?.charset ?? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)]
    }
    return result
  },

  /**
   * Generate a random integer
   */
  integer: (options?: { min?: number, max?: number }): number => {
    const min = options?.min ?? 0
    const max = options?.max ?? 1000000
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  /**
   * Generate a random float
   */
  float: (options?: { min?: number, max?: number, decimals?: number }): number => {
    const min = options?.min ?? 0
    const max = options?.max ?? 1000
    const decimals = options?.decimals ?? 2
    const value = Math.random() * (max - min) + min
    return Number(value.toFixed(decimals))
  },

  /**
   * Generate a random boolean
   */
  boolean: (probability: number = 0.5): boolean => {
    return Math.random() < probability
  },

  /**
   * Generate a random date
   */
  date: (options?: { start?: Date, end?: Date }): Date => {
    const start = options?.start ?? new Date('2020-01-01')
    const end = options?.end ?? new Date()
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  },

  /**
   * Generate an ISO date string
   */
  isoDate: (options?: { start?: Date, end?: Date }): string => {
    return generators.date(options).toISOString()
  },

  /**
   * Generate a random email
   */
  email: (domainOrOptions?: string | { domain?: string }): string => {
    const localPart = generators.string({ length: 8, charset: 'abcdefghijklmnopqrstuvwxyz' })
    const domain = typeof domainOrOptions === 'string'
      ? domainOrOptions
      : domainOrOptions?.domain
    const d = domain ?? `${generators.string({ length: 6, charset: 'abcdefghijklmnopqrstuvwxyz' })}.com`
    return `${localPart}@${d}`
  },

  /**
   * Generate a random name
   */
  name: (): string => {
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`
  },

  /**
   * Generate a random first name
   */
  firstName: (): string => {
    const names = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen']
    return names[Math.floor(Math.random() * names.length)]
  },

  /**
   * Generate a random last name
   */
  lastName: (): string => {
    const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']
    return names[Math.floor(Math.random() * names.length)]
  },

  /**
   * Generate a random phone number
   */
  phone: (format?: string): string => {
    const f = format ?? '###-###-####'
    return f.replace(/#/g, () => String(Math.floor(Math.random() * 10)))
  },

  /**
   * Generate a random URL
   */
  url: (options?: { protocol?: string, tld?: string }): string => {
    const protocol = options?.protocol ?? 'https'
    const tld = options?.tld ?? 'com'
    const domain = generators.string({ length: 8, charset: 'abcdefghijklmnopqrstuvwxyz' })
    return `${protocol}://${domain}.${tld}`
  },

  /**
   * Pick a random value from an array
   */
  oneOf: <T>(values: T[]): T => {
    return values[Math.floor(Math.random() * values.length)]
  },

  /**
   * Pick random values from an array
   */
  someOf: <T>(values: T[], options?: { min?: number, max?: number }): T[] => {
    const min = options?.min ?? 1
    const max = options?.max ?? values.length
    const count = generators.integer({ min, max: Math.min(max, values.length) })
    const shuffled = [...values].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  },

  /**
   * Generate a random array
   */
  array: <T>(generator: GeneratorFn<T>, options?: { min?: number, max?: number }): T[] => {
    const min = options?.min ?? 1
    const max = options?.max ?? 5
    const count = generators.integer({ min, max })
    return Array.from({ length: count }, generator)
  },

  /**
   * Generate a random object from schema
   */
  object: (schema: GeneratorSchema): Record<string, unknown> => {
    const result: Record<string, unknown> = {}

    for (const [key, config] of Object.entries(schema)) {
      if (typeof config === 'function') {
        result[key] = config()
      }
      else {
        const { generator, optional, probability = 0.5 } = config
        if (!optional || Math.random() < probability) {
          result[key] = generator()
        }
      }
    }

    return result
  },

  /**
   * Generate a DynamoDB partition key
   */
  pk: (entityType: string, idGenerator?: GeneratorFn<string>): string => {
    const id = idGenerator ? idGenerator() : generators.uuid()
    return `${entityType.toUpperCase()}#${id}`
  },

  /**
   * Generate a DynamoDB sort key
   */
  sk: (prefix: string, ...parts: (string | GeneratorFn<string>)[]): string => {
    const resolvedParts = parts.map(p => typeof p === 'function' ? p() : p)
    return [prefix, ...resolvedParts].join('#')
  },

  /**
   * Generate a timestamp in DynamoDB format
   */
  timestamp: (): string => {
    return new Date().toISOString()
  },

  /**
   * Generate lorem ipsum text
   */
  lorem: (options?: { words?: number, sentences?: number, paragraphs?: number }): string => {
    const loremWords = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat']

    if (options?.paragraphs) {
      return Array.from({ length: options.paragraphs }, () =>
        generators.lorem({ sentences: generators.integer({ min: 3, max: 6 }) })).join('\n\n')
    }

    if (options?.sentences) {
      return Array.from({ length: options.sentences }, () => {
        const wordCount = generators.integer({ min: 5, max: 15 })
        const words = Array.from({ length: wordCount }, () =>
          loremWords[Math.floor(Math.random() * loremWords.length)])
        words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1)
        return `${words.join(' ')}.`
      }).join(' ')
    }

    const wordCount = options?.words ?? 10
    return Array.from({ length: wordCount }, () =>
      loremWords[Math.floor(Math.random() * loremWords.length)]).join(' ')
  },

  /**
   * Generate a constant value
   */
  constant: <T>(value: T): T => value,

  /**
   * Generate a sequential value
   */
  sequence: (start: number = 1): GeneratorFn<number> => {
    let current = start
    return () => current++
  },

  /**
   * Generate with custom function
   */
  custom: <T>(fn: GeneratorFn<T>): T => fn(),

  /**
   * Generate a weighted random selection
   */
  weighted: <T>(options: Array<{ value: T, weight: number }>): T => {
    const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0)
    let random = Math.random() * totalWeight

    for (const option of options) {
      random -= option.weight
      if (random <= 0) {
        return option.value
      }
    }

    return options[options.length - 1].value
  },
}

/**
 * Data generator for creating test data
 */
export class DataGenerator {
  private schema: GeneratorSchema

  constructor(schema: GeneratorSchema) {
    this.schema = schema
  }

  /**
   * Generate a single item
   */
  generate(): Record<string, unknown> {
    return generators.object(this.schema)
  }

  /**
   * Generate multiple items
   */
  generateMany(count: number): Record<string, unknown>[] {
    return Array.from({ length: count }, () => this.generate())
  }

  /**
   * Generate items with overrides
   */
  generateWith(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      ...this.generate(),
      ...overrides,
    }
  }

  /**
   * Generate items in batches (for batch write)
   */
  * generateBatches(totalCount: number, batchSize: number = 25): Generator<Record<string, unknown>[]> {
    let remaining = totalCount
    while (remaining > 0) {
      const count = Math.min(remaining, batchSize)
      yield this.generateMany(count)
      remaining -= count
    }
  }
}

/**
 * Create a data generator
 */
export function createDataGenerator(schema: GeneratorSchema): DataGenerator {
  return new DataGenerator(schema)
}

/**
 * Entity generator builder
 */
export class EntityGeneratorBuilder {
  private schema: GeneratorSchema = {}
  private entityType: string

  constructor(entityType: string) {
    this.entityType = entityType

    // Add default DynamoDB fields
    this.schema.pk = { generator: () => generators.pk(entityType) }
    this.schema.sk = { generator: () => `${entityType.toUpperCase()}#${generators.uuid()}` }
    this.schema._et = { generator: () => entityType }
    this.schema._ct = { generator: generators.timestamp }
    this.schema._md = { generator: generators.timestamp }
  }

  /**
   * Add a field with generator
   */
  field(name: string, generator: GeneratorFn | FieldGenerator): this {
    this.schema[name] = typeof generator === 'function'
      ? { generator }
      : generator
    return this
  }

  /**
   * Add a string field
   */
  string(name: string, options?: { length?: number, optional?: boolean }): this {
    return this.field(name, {
      generator: () => generators.string({ length: options?.length }),
      optional: options?.optional,
    })
  }

  /**
   * Add an integer field
   */
  integer(name: string, options?: { min?: number, max?: number, optional?: boolean }): this {
    return this.field(name, {
      generator: () => generators.integer({ min: options?.min, max: options?.max }),
      optional: options?.optional,
    })
  }

  /**
   * Add an email field
   */
  email(name: string, options?: { domain?: string, optional?: boolean }): this {
    return this.field(name, {
      generator: () => generators.email(options?.domain),
      optional: options?.optional,
    })
  }

  /**
   * Add a date field
   */
  date(name: string, options?: { start?: Date, end?: Date, optional?: boolean }): this {
    return this.field(name, {
      generator: () => generators.isoDate({ start: options?.start, end: options?.end }),
      optional: options?.optional,
    })
  }

  /**
   * Add an enum field
   */
  enum(name: string, values: unknown[], options?: { optional?: boolean }): this {
    return this.field(name, {
      generator: () => generators.oneOf(values),
      optional: options?.optional,
    })
  }

  /**
   * Add a boolean field
   */
  boolean(name: string, options?: { probability?: number, optional?: boolean }): this {
    return this.field(name, {
      generator: () => generators.boolean(options?.probability),
      optional: options?.optional,
    })
  }

  /**
   * Add a UUID field
   */
  uuid(name: string, options?: { optional?: boolean }): this {
    return this.field(name, {
      generator: generators.uuid,
      optional: options?.optional,
    })
  }

  /**
   * Add an array field
   */
  array(name: string, generator: GeneratorFn, options?: { min?: number, max?: number, optional?: boolean }): this {
    return this.field(name, {
      generator: () => generators.array(generator, { min: options?.min, max: options?.max }),
      optional: options?.optional,
    })
  }

  /**
   * Custom sort key pattern
   */
  sortKey(pattern: string, ...parts: GeneratorFn<string>[]): this {
    this.schema.sk = {
      generator: () => generators.sk(pattern, ...parts),
    }
    return this
  }

  /**
   * Add a custom field with generator function
   */
  custom<T>(name: string, generator: GeneratorFn<T>, options?: { optional?: boolean }): this {
    return this.field(name, {
      generator,
      optional: options?.optional,
    })
  }

  /**
   * Build the data generator
   */
  build(): DataGenerator {
    return createDataGenerator(this.schema)
  }
}

/**
 * Create an entity generator builder
 */
export function entityGenerator(entityType: string): EntityGeneratorBuilder {
  return new EntityGeneratorBuilder(entityType)
}
