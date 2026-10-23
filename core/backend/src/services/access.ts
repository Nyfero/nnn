import prisma from '../prisma'
import { ROLES } from '../config'

export const hasAdminRole = (user: { userRoles: { role: { role: string } }[] }) =>
  user.userRoles.some((ur) => ur.role.role === ROLES.ADMIN)

// Modules utilisables par un utilisateur. Les admins ont accès à tous les modules activés.
export async function accessibleModules(userId: number, isAdmin: boolean) {
  return prisma.modules.findMany({
    where: isAdmin
      ? { is_enabled: true }
      : { is_enabled: true, userModules: { some: { user_id: userId } } },
    select: { module_id: true, name: true, icon: true, path: true, version: true },
    orderBy: { name: 'asc' },
  })
}

export async function grantAutoModules(userId: number) {
  const auto = await prisma.modules.findMany({
    where: { auto_grant: true },
    select: { module_id: true },
  })
  if (auto.length === 0) return
  await prisma.userModules.createMany({
    data: auto.map((m) => ({ user_id: userId, module_id: m.module_id })),
    skipDuplicates: true,
  })
}

export function getModuleSecret(moduleId: string): string | undefined {
  return process.env[`MODULE_SECRET_${moduleId.toUpperCase().replace(/-/g, '_')}`]
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
