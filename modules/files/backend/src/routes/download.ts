import { Router } from 'express'
import { pipeline } from 'node:stream'
import prisma from '../prisma'
import { config } from '../config'
import { ah, HttpError } from '../utils/http'
import { INLINE_SAFE } from '../utils/names'
import { verifyTicket } from '../utils/tickets'
import { getBackend } from '../storage'

// Monté AVANT coreAuth : l'autorisation est portée par le lien signé (POST /nodes/:id/link).
const router = Router()

router.get('/:token', ah(async (req, res) => {
  const ticket = verifyTicket(req.params.token, config.moduleSecret)
  if (!ticket) throw new HttpError(403, 'Lien invalide ou expiré')

  const node = await prisma.nodes.findFirst({
    where: { node_id: ticket.n, user_id: ticket.u, is_folder: false, status: 'ready', trashed_at: null },
  })
  if (!node || !node.storage_backend || !node.storage_key) throw new HttpError(404, 'Fichier introuvable')

  const backend = getBackend(node.storage_backend)
  const size = Number(node.size)
  const mime = node.mime ?? 'application/octet-stream'
  const inline = ticket.i && INLINE_SAFE.has(mime)

  // Plage d'octets (lecture vidéo/audio, reprise de téléchargement). Plages multiples : ignorées.
  let start = 0
  let end = size - 1
  let status = 200
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') {
      start = Math.max(0, size - Number(m[2]))
    } else {
      start = Number(m[1])
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
    }
    if (start > end || start >= size) {
      res.status(416).set('Content-Range', `bytes */${size}`).end()
      return
    }
    status = 206
    res.set('Content-Range', `bytes ${start}-${end}/${size}`)
  }

  const ascii = node.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  res.status(status).set({
    'Content-Type': inline ? mime : 'application/octet-stream',
    'Content-Length': String(size === 0 ? 0 : end - start + 1),
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(node.name)}`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'",
  })
  if (size === 0) {
    res.end()
    return
  }
  pipeline(backend.read(node.storage_key, { start, end }), res, () => {})
}))

export default router
