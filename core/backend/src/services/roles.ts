import type { PrismaClient } from '@prisma/client'
import prisma from '../prisma'
import { ROLE_DEFAULTS } from '../config'

// Crée les rôles et applique leurs valeurs par défaut UNE fois (colonne `initialized`).
// Ne touche plus aux rôles déjà initialisés : les réglages de l'admin sont conservés.
export async function ensureRoles(db: PrismaClient = prisma) {
  for (const [role, def] of Object.entries(ROLE_DEFAULTS)) {
    const existing = await db.roles.findUnique({ where: { role } })
    if (existing?.initialized) continue

    const fields = {
      description: def.description,
      all_modules: def.all_modules,
      storage_quota_mb: def.storage_quota_mb,
      initialized: true,
    }
    const saved = await db.roles.upsert({
      where: { role },
      update: fields,
      create: { role, ...fields },
    })
    await db.roleModules.deleteMany({ where: { role_id: saved.role_id } })
    await db.roleModules.createMany({
      data: def.modules.map((module_id) => ({
        role_id: saved.role_id,
        module_id,
      })),
    })
  }
}
