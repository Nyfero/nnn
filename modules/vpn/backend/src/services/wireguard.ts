import { readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import prisma from '../prisma'
import { SHARED_DIR, SUBNET } from '../config'

const PEERS_FILE = path.join(SHARED_DIR, 'peers.conf')

// Clé publique WireGuard : 32 octets en base64 (rejette aussi tout caractère parasite)
export const isPublicKey = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[A-Za-z0-9+/]{43}=$/.test(v) &&
  Buffer.from(v, 'base64').length === 32 &&
  Buffer.from(v, 'base64').toString('base64') === v

// ───────── Pairs : le backend décrit l'état voulu, le conteneur WireGuard l'applique ─────────
// (le backend n'a aucun privilège réseau et ne touche jamais à la clé privée du serveur)
let queue: Promise<void> = Promise.resolve()

async function writePeers() {
  const devices = await prisma.devices.findMany({
    where: { is_enabled: true },
    orderBy: { ip_index: 'asc' },
    select: { public_key: true, ip_index: true },
  })
  const content = devices
    .map(
      (d) =>
        `[Peer]\nPublicKey = ${d.public_key}\nAllowedIPs = ${SUBNET}.${d.ip_index}/32\n`
    )
    .join('\n')
  const tmp = `${PEERS_FILE}.tmp`
  await writeFile(tmp, content, { mode: 0o644 })
  await rename(tmp, PEERS_FILE) // remplacement atomique
}

// Les écritures sont sérialisées : deux requêtes simultanées ne s'écrasent pas
export function syncPeers(): Promise<void> {
  queue = queue.then(writePeers, writePeers)
  return queue
}

// ───────── Clé publique du serveur (publiée par le conteneur WireGuard) ─────────
let serverKey: string | null = null
export async function readServerPublicKey(): Promise<string | null> {
  if (serverKey) return serverKey
  try {
    const key = (await readFile(path.join(SHARED_DIR, 'server.pub'), 'utf-8')).trim()
    if (isPublicKey(key)) serverKey = key
  } catch {
    /* le conteneur WireGuard n'a pas encore démarré */
  }
  return serverKey
}

// ───────── État des pairs (dernier handshake, trafic) ─────────
export interface PeerStatus {
  latest_handshake: number // secondes epoch, 0 = jamais
  rx: number
  tx: number
}

// Format de `wg show wg0 dump` (sans la ligne d'interface) :
// clé publique, psk, endpoint, allowed-ips, handshake, rx, tx, keepalive
export async function readStatus(): Promise<Map<string, PeerStatus> | null> {
  try {
    const file = path.join(SHARED_DIR, 'status.txt')
    const [raw, info] = await Promise.all([readFile(file, 'utf-8'), stat(file)])
    if (Date.now() - info.mtimeMs > 30_000) return null // conteneur WireGuard à l'arrêt
    const peers = new Map<string, PeerStatus>()
    for (const line of raw.split('\n')) {
      const f = line.split('\t')
      if (f.length < 8) continue
      peers.set(f[0], {
        latest_handshake: Number(f[4]) || 0,
        rx: Number(f[5]) || 0,
        tx: Number(f[6]) || 0,
      })
    }
    return peers
  } catch {
    return null
  }
}
