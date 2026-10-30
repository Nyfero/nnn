import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import prisma from '../prisma'
import { config } from '../config'
import { ah, HttpError, parseId } from '../utils/http'
import { allBackends } from '../storage'
import { ensureAccount, getDefaultQuota, resolveQuota, setDefaultQuota } from '../services/quota'

const router = Router()

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Accès refusé : réservé aux administrateurs' })
  next()
})

const MAX_QUOTA = 2 ** 50 // 1 Pio

function parseQuota(v: unknown): number | null {
  if (v === 'unlimited') return null
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_QUOTA) return v
  throw new HttpError(400, 'Quota invalide')
}

// Vue d'ensemble : stockage, quota par défaut, quota et usage des comptes connus du module.
// (la liste complète des utilisateurs vient du core ; ceux absents d'ici utilisent le quota par défaut)
router.get('/overview', ah(async (_req, res) => {
  const [accounts, sums, def] = await Promise.all([
    prisma.accounts.findMany(),
    prisma.nodes.groupBy({ by: ['user_id'], where: { is_folder: false }, _sum: { size: true } }),
    getDefaultQuota(),
  ])
  const used = new Map(sums.map((s) => [s.user_id, Number(s._sum.size ?? 0n)]))
  const custom = new Map(accounts.map((a) => [a.user_id, a.quota_bytes]))

  const rows = [...new Set([...used.keys(), ...custom.keys()])].map((user_id) => {
    const q = custom.get(user_id) ?? null
    return {
      user_id,
      mode: q === null ? 'default' : q < 0n ? 'unlimited' : 'custom',
      quota_bytes: q !== null && q >= 0n ? Number(q) : null,
      effective_quota_bytes: resolveQuota(q, def),
      used_bytes: used.get(user_id) ?? 0,
    }
  })

  const backends = await Promise.all(
    allBackends().map(async (b) => {
      const cap = await b.capacity().catch(() => null)
      return {
        name: b.name,
        path: b.describe(),
        is_default: b.name === config.defaultBackend,
        total_bytes: cap?.totalBytes ?? null,
        free_bytes: cap?.freeBytes ?? null,
      }
    })
  )

  res.json({
    default_quota_bytes: def,
    min_free_bytes: config.minFreeBytes,
    used_total_bytes: [...used.values()].reduce((a, b) => a + b, 0),
    backends,
    accounts: rows,
  })
}))

// body : { quota_bytes: <octets> | "default" | "unlimited" }
router.put('/accounts/:user_id', ah(async (req, res) => {
  const id = parseId(req.params.user_id)
  const v = req.body?.quota_bytes
  if (!id) throw new HttpError(400, 'Identifiant invalide')

  const data = v === 'default' ? null : v === 'unlimited' ? -1n : BigInt(parseQuota(v) as number)
  await ensureAccount(id)
  await prisma.accounts.update({ where: { user_id: id }, data: { quota_bytes: data } })
  res.json({ ok: true })
}))

// body : { default_quota_bytes: <octets> | "unlimited" }
router.put('/settings', ah(async (req, res) => {
  await setDefaultQuota(parseQuota(req.body?.default_quota_bytes))
  res.json({ ok: true })
}))

export default router
