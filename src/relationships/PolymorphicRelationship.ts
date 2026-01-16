// ============================================================================
// Polymorphic Relationships - Support for Polymorphic Associations
// ============================================================================

/**
 * Polymorphic type mapping
 */
export interface PolymorphicTypeMap {
  [typeName: string]: {
    entityType: string
    pkPrefix: string
    skPrefix?: string
  }
}

/**
 * Polymorphic relationship configuration
 */
export interface PolymorphicConfig {
  /** Name of the relationship */
  name: string
  /** Type discriminator attribute */
  typeAttribute: string
  /** ID attribute */
  idAttribute: string
  /** Type mappings */
  types: PolymorphicTypeMap
}

/**
 * Morphable interface for polymorphic relations
 */
export interface Morphable {
  /** Get the morph type */
  getMorphType: () => string
  /** Get the morph ID */
  getMorphId: () => string
}

/**
 * Polymorphic relationship result
 */
export interface PolymorphicResult<T = unknown> {
  /** The resolved entity */
  entity: T
  /** The entity type */
  type: string
  /** The entity ID */
  id: string
}

/**
 * Polymorphic relationship manager
 */
export class PolymorphicRelationshipManager {
  private configs: Map<string, PolymorphicConfig> = new Map()

  /**
   * Register a polymorphic relationship
   */
  register(config: PolymorphicConfig): this {
    this.configs.set(config.name, config)
    return this
  }

  /**
   * Get polymorphic key attributes for an item
   */
  getMorphAttributes(
    relationshipName: string,
    typeName: string,
    id: string,
  ): { type: string, id: string } | null {
    const config = this.configs.get(relationshipName)
    if (!config)
      return null

    const typeMapping = config.types[typeName]
    if (!typeMapping)
      return null

    return {
      type: typeName,
      id,
    }
  }

  /**
   * Build query to fetch polymorphic related item
   */
  buildMorphQuery(
    relationshipName: string,
    typeName: string,
    id: string,
  ): {
    tableName: string
    pk: string
    sk?: string
  } | null {
    const config = this.configs.get(relationshipName)
    if (!config)
      return null

    const typeMapping = config.types[typeName]
    if (!typeMapping)
      return null

    const pk = `${typeMapping.pkPrefix}${id}`
    const sk = typeMapping.skPrefix
      ? `${typeMapping.skPrefix}${id}`
      : undefined

    return {
      tableName: typeMapping.entityType,
      pk,
      sk,
    }
  }

  /**
   * Extract morph info from an item
   */
  extractMorphInfo(
    relationshipName: string,
    item: Record<string, unknown>,
  ): { type: string, id: string } | null {
    const config = this.configs.get(relationshipName)
    if (!config)
      return null

    const type = item[config.typeAttribute] as string
    const id = item[config.idAttribute] as string

    if (!type || !id)
      return null

    return { type, id }
  }

  /**
   * Set morph attributes on an item
   */
  setMorphAttributes(
    relationshipName: string,
    item: Record<string, unknown>,
    typeName: string,
    id: string,
  ): Record<string, unknown> {
    const config = this.configs.get(relationshipName)
    if (!config)
      return item

    return {
      ...item,
      [config.typeAttribute]: typeName,
      [config.idAttribute]: id,
    }
  }

  /**
   * Get all registered relationship names
   */
  getRelationshipNames(): string[] {
    return Array.from(this.configs.keys())
  }

  /**
   * Get configuration for a relationship
   */
  getConfig(name: string): PolymorphicConfig | undefined {
    return this.configs.get(name)
  }
}

/**
 * Create a polymorphic relationship manager
 */
export function createPolymorphicManager(): PolymorphicRelationshipManager {
  return new PolymorphicRelationshipManager()
}

/**
 * Helper to define morphTo relationship
 */
export function morphTo(config: {
  name: string
  typeAttribute?: string
  idAttribute?: string
  types: PolymorphicTypeMap
}): PolymorphicConfig {
  return {
    name: config.name,
    typeAttribute: config.typeAttribute ?? `${config.name}Type`,
    idAttribute: config.idAttribute ?? `${config.name}Id`,
    types: config.types,
  }
}

/**
 * Helper to define morphMany relationship
 */
export function morphMany(config: {
  name: string
  foreignTypeAttribute?: string
  foreignIdAttribute?: string
  localType: string
}): {
    name: string
    foreignTypeAttribute: string
    foreignIdAttribute: string
    localType: string
  } {
  return {
    name: config.name,
    foreignTypeAttribute: config.foreignTypeAttribute ?? 'morphableType',
    foreignIdAttribute: config.foreignIdAttribute ?? 'morphableId',
    localType: config.localType,
  }
}

/**
 * Build GSI key for polymorphic queries
 */
export function buildPolymorphicGSIKey(type: string, id: string): string {
  return `MORPH#${type}#${id}`
}

/**
 * Parse polymorphic GSI key
 */
export function parsePolymorphicGSIKey(key: string): { type: string, id: string } | null {
  const match = key.match(/^MORPH#([^#]+)#(.+)$/)
  if (!match)
    return null

  return {
    type: match[1],
    id: match[2],
  }
}
