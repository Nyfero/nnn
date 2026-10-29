import { Router } from 'express'
import prisma from '../prisma'
import { ah, parseId } from '../utils/http'
import { act, isAction, serverView } from '../docker'

const router = Router()

// Admin : tous les serveurs. Utilisateur : ceux pour lesquels l'admin lui a donné la permission.
const visibleTo = (user: { user_id: number; isAdmin: boolean }) =>
  user.isAdmin ? {} : { permissions: { some: { user_id: user.user_id } } }

router.get(
  '/',
  ah(async (req, res) => {
    const servers = await prisma.servers.findMany({
      where: visibleTo(req.user!),
      orderBy: { name: 'asc' },
    })
    res.json(await Promise.all(servers.map(serverView)))
  })
)

// Une action à la fois par serveur (double clic, deux onglets)
const busy = new Set<number>()

router.post(
  '/:id/:action',
  ah(async (req, res) => {
    const id = parseId(req.params.id)
    const { action } = req.params
    if (!id || !isAction(action)) return res.status(400).json({ error: 'Requête invalide' })

    // Même réponse (404) si le serveur n'existe pas ou n'est pas autorisé : pas de fuite d'information
    const server = await prisma.servers.findFirst({
      where: { server_id: id, ...visibleTo(req.user!) },
    })
    if (!server) return res.status(404).json({ error: 'Serveur introuvable' })

    if (busy.has(id)) {
      return res.status(409).json({ error: 'Une action est déjà en cours sur ce serveur' })
    }
    busy.add(id)
    try {
      await act(server.container, action)
      console.log(`[servers] ${action} "${server.name}" par l'utilisateur ${req.user!.user_id}`)
      res.json(await serverView(server))
    } finally {
      busy.delete(id)
    }
  })
)

export default router
