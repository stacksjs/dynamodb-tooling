// ============================================================================
// Branded/Opaque Types for DynamoDB Keys
// ============================================================================

/**
 * Brand symbol for type branding
 */
declare const Brand: unique symbol

/**
 * Base branded type helper
 */
export type Branded<T, B extends string> = T & { readonly [Brand]: B }

// ============================================================================
// Key Types
// ============================================================================

/**
 * Branded partition key type - prevents mixing keys from different entities
 * @template Entity - The entity type this key belongs to
 */
export type PartitionKey<Entity extends string = string> = Branded<string, `PartitionKey_${Entity}`>

/**
 * Branded sort key type - prevents mixing keys from different entities
 * @template Entity - The entity type this key belongs to
 */
export type SortKey<Entity extends string = string> = Branded<string, `SortKey_${Entity}`>

/**
 * GSI partition key types
 */
export type GSI1PK<Entity extends string = string> = Branded<string, `GSI1PK_${Entity}`>
export type GSI1SK<Entity extends string = string> = Branded<string, `GSI1SK_${Entity}`>
export type GSI2PK<Entity extends string = string> = Branded<string, `GSI2PK_${Entity}`>
export type GSI2SK<Entity extends string = string> = Branded<string, `GSI2SK_${Entity}`>
export type GSI3PK<Entity extends string = string> = Branded<string, `GSI3PK_${Entity}`>
export type GSI3SK<Entity extends string = string> = Branded<string, `GSI3SK_${Entity}`>
export type GSI4PK<Entity extends string = string> = Branded<string, `GSI4PK_${Entity}`>
export type GSI4SK<Entity extends string = string> = Branded<string, `GSI4SK_${Entity}`>
export type GSI5PK<Entity extends string = string> = Branded<string, `GSI5PK_${Entity}`>
export type GSI5SK<Entity extends string = string> = Branded<string, `GSI5SK_${Entity}`>

/**
 * Entity type literal type
 * @template Name - The entity name
 */
export type EntityType<Name extends string> = Branded<Name, 'EntityType'>

// ============================================================================
// Key Constructors
// ============================================================================

/**
 * Create a type-safe partition key
 * @param entityType - The entity type prefix (e.g., 'USER')
 * @param id - The entity ID
 * @returns A branded partition key
 */
export function pk<Entity extends string>(
  entityType: Entity,
  id: string | number,
): PartitionKey<Entity> {
  return `${entityType}#${id}` as PartitionKey<Entity>
}

/**
 * Create a type-safe sort key
 * @param entityType - The entity type prefix (e.g., 'USER')
 * @param id - The entity ID
 * @returns A branded sort key
 */
export function sk<Entity extends string>(
  entityType: Entity,
  id: string | number,
): SortKey<Entity> {
  return `${entityType}#${id}` as SortKey<Entity>
}

/**
 * Create a composite sort key with multiple segments
 * @param segments - Array of [type, id] pairs
 * @returns A branded sort key
 */
export function compositeSk<Entity extends string>(
  ...segments: Array<[string, string | number]>
): SortKey<Entity> {
  return segments.map(([type, id]) => `${type}#${id}`).join('#') as SortKey<Entity>
}

/**
 * Create GSI1 partition key
 */
export function gsi1pk<Entity extends string>(
  entityType: Entity,
  id: string | number,
): GSI1PK<Entity> {
  return `${entityType}#${id}` as GSI1PK<Entity>
}

/**
 * Create GSI1 sort key
 */
export function gsi1sk<Entity extends string>(
  entityType: Entity,
  id: string | number,
): GSI1SK<Entity> {
  return `${entityType}#${id}` as GSI1SK<Entity>
}

// ============================================================================
// Key Extraction Utilities
// ============================================================================

/**
 * Extract entity type from a partition key
 */
export function extractEntityType<K extends string>(key: K): string {
  const match = key.match(/^([A-Z_]+)#/)
  return match ? match[1] : ''
}

/**
 * Extract ID from a partition key
 */
export function extractId<K extends string>(key: K): string {
  const parts = key.split('#')
  return parts.length > 1 ? parts[1] : ''
}

/**
 * Check if a key matches an entity type
 */
export function isEntityKey<Entity extends string>(
  key: string,
  entityType: Entity,
): key is PartitionKey<Entity> {
  return key.startsWith(`${entityType}#`)
}

// ============================================================================
// Template Literal Types for Key Validation
// ============================================================================

/**
 * Template literal type for partition key format validation
 */
export type PKFormat<Entity extends string = string> = `${Entity}#${string}`

/**
 * Template literal type for sort key format validation
 */
export type SKFormat<Entity extends string = string> = `${Entity}#${string}`

/**
 * Template literal type for GSI key format
 */
export type GSIKeyFormat<Entity extends string = string> = `${Entity}#${string}`

/**
 * Composite key format with multiple segments
 */
export type CompositeKeyFormat<
  Entity1 extends string = string,
  Entity2 extends string = string,
> = `${Entity1}#${string}#${Entity2}#${string}`

// ============================================================================
// Key Type Guards
// ============================================================================

/**
 * Type guard for partition key format
 */
export function isValidPKFormat(key: string): key is PKFormat {
  return /^[A-Z_]+#.+$/.test(key)
}

/**
 * Type guard for sort key format
 */
export function isValidSKFormat(key: string): key is SKFormat {
  return /^[A-Z_]+#.+$/.test(key)
}

/**
 * Type guard for composite key format
 */
export function isValidCompositeFormat(key: string): key is CompositeKeyFormat {
  return /^[A-Z_]+#.+#[A-Z_]+#.+$/.test(key)
}

// ============================================================================
// Entity Type Extraction from Keys
// ============================================================================

/**
 * Extract entity type from a partition key (type-level)
 */
export type ExtractEntityFromPK<K extends string> = K extends `${infer Entity}#${string}`
  ? Entity
  : never

/**
 * Extract entity type from a sort key (type-level)
 */
export type ExtractEntityFromSK<K extends string> = K extends `${infer Entity}#${string}`
  ? Entity
  : never

/**
 * Extract ID portion from a key (type-level)
 */
export type ExtractIdFromKey<K extends string> = K extends `${string}#${infer Id}`
  ? Id
  : never

// ============================================================================
// Key Composite Type Helpers
// ============================================================================

/**
 * DynamoDB key pair type
 */
export interface KeyPair<Entity extends string = string> {
  pk: PartitionKey<Entity>
  sk: SortKey<Entity>
}

/**
 * Full key set including GSI keys
 */
export interface FullKeySet<Entity extends string = string> extends KeyPair<Entity> {
  gsi1pk?: GSI1PK<Entity>
  gsi1sk?: GSI1SK<Entity>
  gsi2pk?: GSI2PK<Entity>
  gsi2sk?: GSI2SK<Entity>
  gsi3pk?: GSI3PK<Entity>
  gsi3sk?: GSI3SK<Entity>
  gsi4pk?: GSI4PK<Entity>
  gsi4sk?: GSI4SK<Entity>
  gsi5pk?: GSI5PK<Entity>
  gsi5sk?: GSI5SK<Entity>
}

// ============================================================================
// Key Builder Class
// ============================================================================

/**
 * Type-safe key builder for constructing DynamoDB keys
 */
export class KeyBuilder<Entity extends string> {
  private readonly entityType: Entity
  private readonly delimiter: string

  constructor(entityType: Entity, delimiter: string = '#') {
    this.entityType = entityType
    this.delimiter = delimiter
  }

  /**
   * Build a partition key
   */
  pk(id: string | number): PartitionKey<Entity> {
    return `${this.entityType}${this.delimiter}${id}` as PartitionKey<Entity>
  }

  /**
   * Build a sort key
   */
  sk(id: string | number): SortKey<Entity> {
    return `${this.entityType}${this.delimiter}${id}` as SortKey<Entity>
  }

  /**
   * Build a sort key with additional segments
   */
  skWithSegments(...segments: Array<[string, string | number]>): SortKey<Entity> {
    const parts = [`${this.entityType}${this.delimiter}${segments[0][1]}`]
    for (let i = 1; i < segments.length; i++) {
      parts.push(`${segments[i][0]}${this.delimiter}${segments[i][1]}`)
    }
    return parts.join(this.delimiter) as SortKey<Entity>
  }

  /**
   * Build a key pair
   */
  keyPair(id: string | number): KeyPair<Entity> {
    return {
      pk: this.pk(id),
      sk: this.sk(id),
    }
  }

  /**
   * Build GSI1 keys
   */
  gsi1(pkId: string | number, skId: string | number): { gsi1pk: GSI1PK<Entity>, gsi1sk: GSI1SK<Entity> } {
    return {
      gsi1pk: `${this.entityType}${this.delimiter}${pkId}` as GSI1PK<Entity>,
      gsi1sk: `${this.entityType}${this.delimiter}${skId}` as GSI1SK<Entity>,
    }
  }
}

/**
 * Create a key builder for an entity type
 */
export function keyBuilder<Entity extends string>(
  entityType: Entity,
  delimiter?: string,
): KeyBuilder<Entity> {
  return new KeyBuilder(entityType, delimiter)
}
