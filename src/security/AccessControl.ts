// ============================================================================
// Access Control - Fine-Grained Access Control for DynamoDB
// ============================================================================

/**
 * Permission action
 */
export type PermissionAction =
  | 'read'
  | 'write'
  | 'delete'
  | 'query'
  | 'scan'
  | 'create'
  | 'update'
  | '*'

/**
 * Permission resource
 */
export interface PermissionResource {
  /** Table name (or * for all) */
  table: string
  /** Entity type (or * for all) */
  entityType?: string
  /** Attribute restrictions */
  attributes?: {
    /** Allowed attributes to read */
    read?: string[] | '*'
    /** Allowed attributes to write */
    write?: string[] | '*'
  }
  /** Condition expression */
  condition?: AccessCondition
}

/**
 * Access condition
 */
export interface AccessCondition {
  /** Condition type */
  type: 'attribute' | 'pk-prefix' | 'sk-prefix' | 'tenant' | 'owner' | 'custom'
  /** Attribute name (for attribute condition) */
  attribute?: string
  /** Operator */
  operator?: '=' | '!=' | 'in' | 'not-in' | 'contains' | 'begins-with'
  /** Value or value resolver */
  value?: unknown | (() => unknown)
  /** Custom condition function */
  evaluate?: (item: Record<string, unknown>, context: AccessContext) => boolean
}

/**
 * Permission definition
 */
export interface Permission {
  /** Permission ID */
  id: string
  /** Actions allowed */
  actions: PermissionAction[]
  /** Resources this permission applies to */
  resources: PermissionResource[]
  /** Permission effect */
  effect: 'allow' | 'deny'
  /** Priority (higher = evaluated first) */
  priority?: number
}

/**
 * Role definition
 */
export interface Role {
  /** Role ID */
  id: string
  /** Role name */
  name: string
  /** Description */
  description?: string
  /** Permissions */
  permissions: Permission[]
  /** Parent roles (for inheritance) */
  inherits?: string[]
}

/**
 * Access context (current user/request info)
 */
export interface AccessContext {
  /** User ID */
  userId?: string
  /** Tenant ID */
  tenantId?: string
  /** User roles */
  roles: string[]
  /** Custom attributes */
  attributes?: Record<string, unknown>
  /** Request metadata */
  request?: {
    ip?: string
    userAgent?: string
    timestamp?: Date
  }
}

/**
 * Access check result
 */
export interface AccessCheckResult {
  /** Whether access is allowed */
  allowed: boolean
  /** Reason for denial (if denied) */
  reason?: string
  /** Matched permission */
  matchedPermission?: Permission
  /** Filtered attributes (if attribute-level access control) */
  allowedAttributes?: string[]
}

/**
 * Access control manager
 */
export class AccessControlManager {
  private roles: Map<string, Role> = new Map()
  private permissions: Map<string, Permission> = new Map()

  /**
   * Register a role
   */
  registerRole(role: Role): this {
    this.roles.set(role.id, role)

    // Register role's permissions
    for (const permission of role.permissions) {
      this.permissions.set(permission.id, permission)
    }

    return this
  }

  /**
   * Register a permission
   */
  registerPermission(permission: Permission): this {
    this.permissions.set(permission.id, permission)
    return this
  }

  /**
   * Get role by ID
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId)
  }

  /**
   * Get all permissions for a user context
   */
  getPermissionsForContext(context: AccessContext): Permission[] {
    const permissions: Permission[] = []
    const processedRoles = new Set<string>()

    const processRole = (roleId: string) => {
      if (processedRoles.has(roleId)) return
      processedRoles.add(roleId)

      const role = this.roles.get(roleId)
      if (!role) return

      // Process inherited roles first
      if (role.inherits) {
        for (const inheritedRoleId of role.inherits) {
          processRole(inheritedRoleId)
        }
      }

      permissions.push(...role.permissions)
    }

    for (const roleId of context.roles) {
      processRole(roleId)
    }

    // Sort by priority (higher first)
    return permissions.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  /**
   * Check if an action is allowed on a resource
   */
  checkAccess(
    action: PermissionAction,
    resource: { table: string, entityType?: string, item?: Record<string, unknown> },
    context: AccessContext,
  ): AccessCheckResult {
    const permissions = this.getPermissionsForContext(context)

    // Process deny rules first (deny takes precedence)
    for (const permission of permissions.filter(p => p.effect === 'deny')) {
      if (this.matchesPermission(permission, action, resource, context)) {
        return {
          allowed: false,
          reason: `Denied by permission: ${permission.id}`,
          matchedPermission: permission,
        }
      }
    }

    // Then process allow rules
    for (const permission of permissions.filter(p => p.effect === 'allow')) {
      if (this.matchesPermission(permission, action, resource, context)) {
        const allowedAttributes = this.getAllowedAttributes(
          permission,
          action,
          resource,
        )

        return {
          allowed: true,
          matchedPermission: permission,
          allowedAttributes,
        }
      }
    }

    return {
      allowed: false,
      reason: 'No matching permission found',
    }
  }

  /**
   * Filter item attributes based on access control
   */
  filterAttributes(
    item: Record<string, unknown>,
    action: 'read' | 'write',
    resource: { table: string, entityType?: string },
    context: AccessContext,
  ): Record<string, unknown> {
    const checkResult = this.checkAccess(action, resource, context)

    if (!checkResult.allowed) {
      return {}
    }

    if (!checkResult.allowedAttributes || checkResult.allowedAttributes.includes('*')) {
      return item
    }

    const filtered: Record<string, unknown> = {}
    for (const attr of checkResult.allowedAttributes) {
      if (attr in item) {
        filtered[attr] = item[attr]
      }
    }

    return filtered
  }

  /**
   * Create a condition that restricts access to owned items
   */
  static ownerCondition(ownerAttribute: string = 'ownerId'): AccessCondition {
    return {
      type: 'owner',
      attribute: ownerAttribute,
      evaluate: (item, context) => {
        return item[ownerAttribute] === context.userId
      },
    }
  }

  /**
   * Create a condition that restricts access to tenant items
   */
  static tenantCondition(tenantAttribute: string = 'tenantId'): AccessCondition {
    return {
      type: 'tenant',
      attribute: tenantAttribute,
      evaluate: (item, context) => {
        return item[tenantAttribute] === context.tenantId
      },
    }
  }

  /**
   * Create a condition based on partition key prefix
   */
  static pkPrefixCondition(prefix: string): AccessCondition {
    return {
      type: 'pk-prefix',
      value: prefix,
      evaluate: (item) => {
        const pk = item.pk as string
        return pk?.startsWith(prefix) || false
      },
    }
  }

  private matchesPermission(
    permission: Permission,
    action: PermissionAction,
    resource: { table: string, entityType?: string, item?: Record<string, unknown> },
    context: AccessContext,
  ): boolean {
    // Check action
    if (!permission.actions.includes('*') && !permission.actions.includes(action)) {
      return false
    }

    // Check resources
    const matchesResource = permission.resources.some((permResource) => {
      // Check table
      if (permResource.table !== '*' && permResource.table !== resource.table) {
        return false
      }

      // Check entity type
      if (
        permResource.entityType
        && permResource.entityType !== '*'
        && permResource.entityType !== resource.entityType
      ) {
        return false
      }

      // Check condition
      if (permResource.condition && resource.item) {
        return this.evaluateCondition(permResource.condition, resource.item, context)
      }

      return true
    })

    return matchesResource
  }

  private evaluateCondition(
    condition: AccessCondition,
    item: Record<string, unknown>,
    context: AccessContext,
  ): boolean {
    if (condition.evaluate) {
      return condition.evaluate(item, context)
    }

    if (!condition.attribute) {
      return true
    }

    const itemValue = item[condition.attribute]
    const conditionValue = typeof condition.value === 'function'
      ? condition.value()
      : condition.value

    switch (condition.operator) {
      case '=':
        return itemValue === conditionValue
      case '!=':
        return itemValue !== conditionValue
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(itemValue)
      case 'not-in':
        return Array.isArray(conditionValue) && !conditionValue.includes(itemValue)
      case 'contains':
        return typeof itemValue === 'string' && itemValue.includes(String(conditionValue))
      case 'begins-with':
        return typeof itemValue === 'string' && itemValue.startsWith(String(conditionValue))
      default:
        return true
    }
  }

  private getAllowedAttributes(
    permission: Permission,
    action: PermissionAction,
    resource: { table: string, entityType?: string },
  ): string[] | undefined {
    for (const permResource of permission.resources) {
      if (
        (permResource.table === '*' || permResource.table === resource.table)
        && (!permResource.entityType
          || permResource.entityType === '*'
          || permResource.entityType === resource.entityType)
      ) {
        const actionKey = action === 'read' || action === 'query' || action === 'scan'
          ? 'read'
          : 'write'

        const attrs = permResource.attributes?.[actionKey]
        if (attrs === '*') {
          return ['*']
        }
        if (Array.isArray(attrs)) {
          return attrs
        }
      }
    }

    return undefined
  }
}

/**
 * Create an access control manager
 */
export function createAccessControlManager(): AccessControlManager {
  return new AccessControlManager()
}

/**
 * Built-in roles type
 */
export interface BuiltInRolesType {
  admin: Role
  reader: Role
  user: Role
}

/**
 * Built-in roles
 */
export const BuiltInRoles: BuiltInRolesType = {
  /** Full admin access */
  admin: {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access to all resources',
    permissions: [
      {
        id: 'admin-all',
        actions: ['*'],
        resources: [{ table: '*' }],
        effect: 'allow',
        priority: 1000,
      },
    ],
  },

  /** Read-only access */
  reader: {
    id: 'reader',
    name: 'Reader',
    description: 'Read-only access to all resources',
    permissions: [
      {
        id: 'reader-read',
        actions: ['read', 'query', 'scan'],
        resources: [{ table: '*' }],
        effect: 'allow',
        priority: 100,
      },
    ],
  },

  /** Standard user (CRUD on own items) */
  user: {
    id: 'user',
    name: 'User',
    description: 'CRUD access to own items',
    permissions: [
      {
        id: 'user-own',
        actions: ['read', 'write', 'delete', 'create', 'update', 'query'],
        resources: [
          {
            table: '*',
            condition: AccessControlManager.ownerCondition(),
          },
        ],
        effect: 'allow',
        priority: 50,
      },
    ],
  },
}
