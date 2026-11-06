import prisma from '../prisma'
import {
  filterAccessibleModules,
  hasAdminRole,
  pickStorageQuota,
} from '../utils/accessRules'
import { getModuleSecret } from '../utils/moduleSecret'

// Ré-exportés : d'autres fichiers les importent depuis ce module
export { hasAdminRole, getModuleSecret }

// Modules utilisables = (modules des rôles) ∪ (exceptions individuelles userModules),
// restreints aux modules activés. Les admins ont accès à tous les modules activés.
export async function accessibleModules(userId: number, isAdmin: boolean) {
  const enabled = await prisma.modules.findMany({
    where: { is_enabled: true },
    select: {
      module_id: true,
      name: true,
      icon: true,
      path: true,
      version: true,
    },
    orderBy: { name: 'asc' },
  })
  if (isAdmin) return enabled

  const [roles, direct] = await Promise.all([
    prisma.roles.findMany({
      where: { userRoles: { some: { user_id: userId } } },
      include: { roleModules: true },
    }),
    prisma.userModules.findMany({
      where: { user_id: userId },
      select: { module_id: true },
    }),
  ])

  return filterAccessibleModules(
    enabled,
    roles,
    direct.map((d) => d.module_id)
  )
}

// Quota de stockage en Mo : null = illimité. Cumul de rôles : le plus élevé gagne.
export async function storageQuotaMb(
  userId: number,
  isAdmin: boolean
): Promise<number | null> {
  if (isAdmin) return null
  const roles = await prisma.roles.findMany({
    where: { userRoles: { some: { user_id: userId } } },
    select: { storage_quota_mb: true },
  })
  return pickStorageQuota(roles)
}

// Prévient les modules qu'un utilisateur a été supprimé (ils purgent leurs données)
export async function notifyUserDeleted(userId: number) {
  const mods = await prisma.modules.findMany({
    where: { internal_url: { not: null } },
  })
  const results = await Promise.allSettled(
    mods.map(async (m) => {
      const secret = getModuleSecret(m.module_id)
      if (!secret) return
      const res = await fetch(
        `${m.internal_url}/api/${m.module_id}/internal/users/${userId}`,
        {
          method: 'DELETE',
          headers: { 'X-Module-Secret': secret },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!res.ok) throw new Error(`${m.module_id}: HTTP ${res.status}`)
    })
  )
  results.forEach((r) => {
    if (r.status === 'rejected')
      console.error('[modules] Purge utilisateur échouée :', r.reason)
  })
}
