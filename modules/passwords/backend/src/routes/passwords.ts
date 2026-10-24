import { Router } from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import prisma from '../prisma'

const router = Router()

// Express 4 : renvoie les promesses rejetées au handler d'erreurs
const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

const parseId = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const optStr = (v: unknown, max: number) =>
  typeof v === 'string' && v.length <= max ? v : v == null ? null : undefined

// Le mot de passe arrive déjà chiffré par le navigateur : le serveur ne le voit jamais en clair
function parseBody(body: any) {
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const username = optStr(body?.username, 191)
  const note = optStr(body?.note, 2000)

  if (!title || title.length > 191) return null
  if (!password || password.length > 8192) return null
  if (username === undefined || note === undefined) return null

  return { title, username, password, note }
}

router.get('/', ah(async (req, res) => {
  res.json(
    await prisma.passwords.findMany({
      where: { user_id: req.user!.user_id, is_deleted: false },
      orderBy: { title: 'asc' },
    })
  )
}))

router.post('/', ah(async (req, res) => {
  const data = parseBody(req.body)
  if (!data) return res.status(400).json({ error: 'Champs invalides' })

  const created = await prisma.passwords.create({
    data: { ...data, user_id: req.user!.user_id },
  })
  res.status(201).json(created)
}))

router.put('/:id', ah(async (req, res) => {
  const id = parseId(req.params.id)
  const data = parseBody(req.body)
  if (!id || !data) return res.status(400).json({ error: 'Champs invalides' })

  const { count } = await prisma.passwords.updateMany({
    where: { password_id: id, user_id: req.user!.user_id },
    data,
  })
  if (count === 0) return res.status(404).json({ error: 'Mot de passe introuvable' })

  res.json(await prisma.passwords.findUnique({ where: { password_id: id } }))
}))

router.delete('/:id', ah(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Identifiant invalide' })

  const { count } = await prisma.passwords.deleteMany({
    where: { password_id: id, user_id: req.user!.user_id },
  })
  if (count === 0) return res.status(404).json({ error: 'Mot de passe introuvable' })
  res.status(204).send()
}))

// Un utilisateur ne peut modifier que ses propres favoris
router.patch('/:id/is_stared', ah(async (req, res) => {
  const id = parseId(req.params.id)
  const { is_stared } = req.body ?? {}
  if (!id || typeof is_stared !== 'boolean') {
    return res.status(400).json({ error: 'Champs invalides' })
  }

  const { count } = await prisma.passwords.updateMany({
    where: { password_id: id, user_id: req.user!.user_id },
    data: { is_stared },
  })
  if (count === 0) return res.status(404).json({ error: 'Mot de passe introuvable' })

  res.json(await prisma.passwords.findUnique({ where: { password_id: id } }))
}))

// Logo d'un site (proxy logo.dev : le token reste côté serveur, réservé aux utilisateurs connectés)
const DOMAIN = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/

router.get('/logo', ah(async (req, res) => {
  const domain = String(req.query.domain ?? '').toLowerCase()
  if (!DOMAIN.test(domain) || !process.env.LOGO_DEV_TOKEN) return res.status(404).end()

  try {
    const response = await fetch(
      `https://img.logo.dev/${domain}?fallback=404&token=${process.env.LOGO_DEV_TOKEN}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return res.status(404).end()

    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png')
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.send(Buffer.from(await response.arrayBuffer()))
  } catch {
    res.status(404).end()
  }
}))

export default router
