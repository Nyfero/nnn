import { Router } from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { devices as Device } from '@prisma/client'
import prisma from '../prisma'
import { DNS, ENDPOINT, MAX_DEVICES, SUBNET } from '../config'
import {
  isPublicKey,
  readServerPublicKey,
  readStatus,
  syncPeers,
  type PeerStatus,
} from '../services/wireguard'

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

const CONNECTED_WINDOW_S = 180 // un tunnel actif refait un handshake toutes les ~2 minutes

const toDto = (d: Device, peers: Map<string, PeerStatus> | null) => {
  const p = peers?.get(d.public_key)
  const now = Date.now() / 1000
  return {
    device_id: d.device_id,
    name: d.name,
    ip: `${SUBNET}.${d.ip_index}`,
    public_key: d.public_key,
    is_enabled: d.is_enabled,
    created_at: d.created_at,
    encrypted_config: d.encrypted_config,
    status: p
      ? {
          connected:
            d.is_enabled &&
            p.latest_handshake > 0 &&
            now - p.latest_handshake < CONNECTED_WINDOW_S,
          last_handshake: p.latest_handshake || null,
          rx: p.rx,
          tx: p.tx,
        }
      : null,
  }
}

async function serverInfo() {
  const server_public_key = await readServerPublicKey()
  if (!server_public_key || !ENDPOINT) return null
  return { server_public_key, endpoint: ENDPOINT, dns: DNS, max_devices: MAX_DEVICES }
}

const isUniqueError = (e: unknown, field?: string) => {
  const err = e as { code?: string; meta?: { target?: unknown } }
  if (err?.code !== 'P2002') return false
  return field ? String(err.meta?.target ?? '').includes(field) : true
}

// ─── Paramètres du serveur (pour construire la configuration côté client) ────
router.get(
  '/info',
  ah(async (_req, res) => {
    const info = await serverInfo()
    if (!info) {
      return res.status(503).json({ error: 'Le serveur VPN démarre ou n\'est pas configuré' })
    }
    res.json(info)
  })
)

// ─── Mes appareils ───────────────────────────────────────────────────────────
router.get(
  '/devices',
  ah(async (req, res) => {
    const [list, peers] = await Promise.all([
      prisma.devices.findMany({
        where: { user_id: req.user!.user_id },
        orderBy: { created_at: 'asc' },
      }),
      readStatus(),
    ])
    res.json(list.map((d) => toDto(d, peers)))
  })
)

// Le client envoie le NOM et la clé PUBLIQUE ; le serveur attribue une IP.
router.post(
  '/devices',
  ah(async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const publicKey = req.body?.public_key
    if (!name || name.length > 64 || /[<>]/.test(name) || !isPublicKey(publicKey)) {
      return res.status(400).json({ error: 'Champs invalides' })
    }

    const info = await serverInfo()
    if (!info) {
      return res.status(503).json({ error: 'Le serveur VPN démarre ou n\'est pas configuré' })
    }

    const userId = req.user!.user_id
    if ((await prisma.devices.count({ where: { user_id: userId } })) >= MAX_DEVICES) {
      return res
        .status(409)
        .json({ error: `Limite de ${MAX_DEVICES} appareils atteinte` })
    }

    // Plus petite IP libre ; en cas de course (deux créations simultanées), on retente
    for (let attempt = 0; attempt < 5; attempt++) {
      const used = new Set(
        (await prisma.devices.findMany({ select: { ip_index: true } })).map((d) => d.ip_index)
      )
      let ip = 2
      while (used.has(ip)) ip++
      if (ip > 254) {
        return res.status(507).json({ error: 'Plus d\'adresse disponible dans le VPN' })
      }

      try {
        const device = await prisma.devices.create({
          data: { user_id: userId, name, public_key: publicKey, ip_index: ip },
        })
        await syncPeers()
        return res.status(201).json({ device: toDto(device, null), server: info })
      } catch (e) {
        if (isUniqueError(e, 'public_key')) {
          return res.status(409).json({ error: 'Cette clé est déjà enregistrée' })
        }
        if (!isUniqueError(e)) throw e
        // sinon : IP prise entre-temps, on boucle
      }
    }
    res.status(503).json({ error: 'Création impossible, réessayez' })
  })
)

// Configuration complète (avec la clé privée), chiffrée par le navigateur : le serveur
// la stocke sans pouvoir la lire. Elle permet de la ré-afficher plus tard.
router.put(
  '/devices/:id/config',
  ah(async (req, res) => {
    const id = parseId(req.params.id)
    const cfg = req.body?.encrypted_config
    if (!id || typeof cfg !== 'string' || cfg.length === 0 || cfg.length > 8192) {
      return res.status(400).json({ error: 'Champs invalides' })
    }
    const { count } = await prisma.devices.updateMany({
      where: { device_id: id, user_id: req.user!.user_id },
      data: { encrypted_config: cfg },
    })
    if (count === 0) return res.status(404).json({ error: 'Appareil introuvable' })
    res.status(204).send()
  })
)

router.delete(
  '/devices/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' })
    const { count } = await prisma.devices.deleteMany({
      where: { device_id: id, user_id: req.user!.user_id },
    })
    if (count === 0) return res.status(404).json({ error: 'Appareil introuvable' })
    await syncPeers()
    res.status(204).send()
  })
)

export default router
