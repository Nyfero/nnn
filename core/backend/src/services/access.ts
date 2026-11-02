import prisma from '../prisma'
import { ROLES } from '../config'

export const hasAdminRole = (user: {
  userRoles: { role: { role: string } }[]
}) => user.userRoles.some((ur) => ur.role.role === ROLES.ADMIN)

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

  const allowed = new Set(direct.map((d) => d.module_id))
  for (const role of roles) {
    const listed = new Set(role.roleModules.map((m) => m.module_id))
    for (const m of enabled) {
      // all_modules : la liste contient les exclusions ; sinon, les modules autorisés
      if (
        role.all_modules ? !listed.has(m.module_id) : listed.has(m.module_id)
      ) {
        allowed.add(m.module_id)
      }
    }
  }
  return enabled.filter((m) => allowed.has(m.module_id))
}

// Utilisateurs actifs ayant accès à un module ET (admin ou détenteur d'un des rôles donnés).
// Utilisé par les modules qui réservent une fonction sensible à certains rôles (ex. VPN) pour
// suspendre ce qui appartient à ceux qui ont perdu leurs droits.
// null = module inconnu (pas encore enregistré) : l'appelant ne doit rien en conclure.
export async function usersWithModuleAccess(
  moduleId: string,
  roles: string[]
): Promise<number[] | null> {
  if (!(await prisma.modules.findUnique({ where: { module_id: moduleId } }))) {
    return null
  }
  const users = await prisma.users.findMany({
    where: {
      is_active: true,
      userRoles: { some: { role: { role: { in: [ROLES.ADMIN, ...roles] } } } },
    },
    include: { userRoles: { include: { role: true } } },
  })
  const ids: number[] = []
  for (const u of users) {
    const modules = await accessibleModules(u.user_id, hasAdminRole(u))
    if (modules.some((m) => m.module_id === moduleId)) ids.push(u.user_id)
  }
  return ids
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
  if (roles.length === 0) return 0
  if (roles.some((r) => r.storage_quota_mb === null)) return null
  return Math.max(...roles.map((r) => r.storage_quota_mb as number))
}

export function getModuleSecret(moduleId: string): string | undefined {
  return process.env[
    `MODULE_SECRET_${moduleId.toUpperCase().replace(/-/g, '_')}`
  ]
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
