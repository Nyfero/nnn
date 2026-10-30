import type { Prisma } from '@prisma/client'
import prisma from '../prisma'
import { config } from '../config'

type Db = Prisma.TransactionClient

// accounts.quota_bytes : null = quota par défaut, -1 = illimité, sinon octets
export async function ensureAccount(userId: number) {
  await prisma.accounts.createMany({ data: [{ user_id: userId }], skipDuplicates: true })
}

/** Quota par défaut en octets, null = illimité. */
export async function getDefaultQuota(db: Db = prisma): Promise<number | null> {
  const row = await db.settings.findUnique({ where: { key: 'default_quota_bytes' } })
  if (!row) return config.defaultQuotaBytes
  return row.value === 'unlimited' ? null : Number(row.value)
}

export async function setDefaultQuota(value: number | null) {
  const v = value === null ? 'unlimited' : String(value)
  await prisma.settings.upsert({
    where: { key: 'default_quota_bytes' },
    update: { value: v },
    create: { key: 'default_quota_bytes', value: v },
  })
}

export const resolveQuota = (custom: bigint | null | undefined, def: number | null): number | null =>
  custom === null || custom === undefined ? def : custom < 0n ? null : Number(custom)

export async function usedBytes(db: Db, userId: number) {
  const r = await db.nodes.aggregate({ _sum: { size: true }, where: { user_id: userId, is_folder: false } })
  return Number(r._sum.size ?? 0n)
}

export async function usage(db: Db, userId: number) {
  const account = await db.accounts.findUnique({ where: { user_id: userId } })
  const quota = resolveQuota(account?.quota_bytes, await getDefaultQuota(db))
  const used = await usedBytes(db, userId)
  const trash = await db.nodes.aggregate({
    _sum: { size: true },
    where: { user_id: userId, is_folder: false, trashed_at: { not: null } },
  })
  return {
    trash_bytes: Number(trash._sum.size ?? 0n), // inclus dans used_bytes : la corbeille compte dans le quota
    quota_bytes: quota, // null = illimité
    used_bytes: used,
    free_bytes: quota === null ? null : Math.max(0, quota - used),
  }
}

// Sérialise les opérations d'un même utilisateur (vérification de quota + création, noms uniques).
export async function withUserLock<T>(userId: number, fn: (tx: Db) => Promise<T>): Promise<T> {
  await ensureAccount(userId)
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT user_id FROM accounts WHERE user_id = ${userId} FOR UPDATE`
      return fn(tx)
    },
    { timeout: 30_000, maxWait: 10_000 }
  )
}
