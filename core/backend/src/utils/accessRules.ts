import { ROLES } from '../config'

// Règles d'accès aux modules et quotas (logique pure, sans Prisma : testable seule)

export const hasAdminRole = (user: {
  userRoles: { role: { role: string } }[]
}) => user.userRoles.some((ur) => ur.role.role === ROLES.ADMIN)

export interface RoleAccess {
  all_modules: boolean
  roleModules: { module_id: string }[]
}

// Modules utilisables = (modules des rôles) ∪ (exceptions individuelles), restreints aux modules activés.
// all_modules : la liste du rôle contient les exclusions ; sinon, les modules autorisés.
export function filterAccessibleModules<M extends { module_id: string }>(
  enabled: M[],
  roles: RoleAccess[],
  directModuleIds: string[]
): M[] {
  const allowed = new Set(directModuleIds)
  for (const role of roles) {
    const listed = new Set(role.roleModules.map((m) => m.module_id))
    for (const m of enabled) {
      if (
        role.all_modules ? !listed.has(m.module_id) : listed.has(m.module_id)
      ) {
        allowed.add(m.module_id)
      }
    }
  }
  return enabled.filter((m) => allowed.has(m.module_id))
}

// Quota de stockage en Mo d'un non-admin : null = illimité. Cumul de rôles : le plus élevé gagne.
export function pickStorageQuota(
  roles: { storage_quota_mb: number | null }[]
): number | null {
  if (roles.length === 0) return 0
  if (roles.some((r) => r.storage_quota_mb === null)) return null
  return Math.max(...roles.map((r) => r.storage_quota_mb as number))
}
