import { Router } from 'express'
import prisma from '../prisma'
import { ah, parseId } from '../utils/http'
import { CONTAINER_NAME, inspect, serverView } from '../docker'

// Monté sous /api/servers/admin, après coreAuth + requireAdmin
const router = Router()

function parseBody(body: any) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const container = typeof body?.container === 'string' ? body.container.trim() : ''
  const description =
    typeof body?.description === 'string' && body.description.trim() ? body.description.trim() : null
  const ids: unknown[] = Array.isArray(body?.user_ids) ? body.user_ids : []

  if (!name || name.length > 100) return null
  if (!CONTAINER_NAME.test(container)) return null
  if (description && description.length > 255) return null
  if (ids.length > 500 || !ids.every((n) => Number.isInteger(n) && (n as number) > 0)) return null

  return { name, container, description, user_ids: [...new Set(ids as number[])] }
}

// Évite les fautes de frappe : le conteneur doit exister et ne pas être un conteneur Myprout
async function containerProblem(container: string) {
  const state = await inspect(container)
  if (state.status === 'missing') return 'Conteneur introuvable sur cet hôte Docker'
  if (state.protected) return 'Ce conteneur fait partie de Myprout et ne peut pas être géré ici'
  return null
}

const isDuplicate = (e: unknown) => (e as { code?: string })?.code === 'P2002'

router.get(
  '/',
  ah(async (_req, res) => {
    const servers = await prisma.servers.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { select: { user_id: true } } },
    })
    res.json(
      await Promise.all(
        servers.map(async ({ permissions, ...s }) => ({
          ...(await serverView(s)),
          container: s.container,
          user_ids: permissions.map((p) => p.user_id),
        }))
      )
    )
  })
)

router.post(
  '/',
  ah(async (req, res) => {
    const data = parseBody(req.body)
    if (!data) return res.status(400).json({ error: 'Champs invalides' })

    const problem = await containerProblem(data.container)
    if (problem) return res.status(400).json({ error: problem })

    try {
      const { user_ids, ...fields } = data
      const created = await prisma.servers.create({
        data: { ...fields, permissions: { create: user_ids.map((user_id) => ({ user_id })) } },
      })
      res.status(201).json(created)
    } catch (e) {
      if (isDuplicate(e)) return res.status(409).json({ error: 'Ce conteneur est déjà déclaré' })
      throw e
    }
  })
)

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id)
    const data = parseBody(req.body)
    if (!id || !data) return res.status(400).json({ error: 'Champs invalides' })

    const existing = await prisma.servers.findUnique({ where: { server_id: id } })
    if (!existing) return res.status(404).json({ error: 'Serveur introuvable' })

    if (existing.container !== data.container) {
      const problem = await containerProblem(data.container)
      if (problem) return res.status(400).json({ error: problem })
    }

    try {
      const { user_ids, ...fields } = data
      await prisma.$transaction([
        prisma.servers.update({ where: { server_id: id }, data: fields }),
        prisma.serverPermissions.deleteMany({ where: { server_id: id } }),
        prisma.serverPermissions.createMany({
          data: user_ids.map((user_id) => ({ server_id: id, user_id })),
        }),
      ])
      res.json({ ok: true })
    } catch (e) {
      if (isDuplicate(e)) return res.status(409).json({ error: 'Ce conteneur est déjà déclaré' })
      throw e
    }
  })
)

router.delete(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' })

    const { count } = await prisma.servers.deleteMany({ where: { server_id: id } })
    if (count === 0) return res.status(404).json({ error: 'Serveur introuvable' })
    res.status(204).send() // le conteneur lui-même n'est jamais touché
  })
)

export default router
