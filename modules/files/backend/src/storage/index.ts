import crypto from 'node:crypto'
import { config } from '../config'
import { HttpError } from '../utils/http'
import { LocalBackend } from './local'
import type { StorageBackend } from './types'

const backends = new Map<string, StorageBackend>()

export async function initStorage() {
  backends.clear()
  const list: StorageBackend[] = [
    new LocalBackend('local', config.storagePath),
    ...config.extraBackends.map((b) => new LocalBackend(b.name, b.path)),
  ]
  for (const b of list) {
    if (backends.has(b.name)) throw new Error(`Backend de stockage en double : ${b.name}`)
    await b.init() // échoue clairement si le dossier n'est pas monté / pas accessible en écriture
    backends.set(b.name, b)
    console.log(`[files] stockage "${b.name}" -> ${b.describe()}`)
  }
  if (!backends.has(config.defaultBackend)) {
    throw new Error(`FILES_DEFAULT_BACKEND="${config.defaultBackend}" inconnu (disponibles : ${[...backends.keys()].join(', ')})`)
  }
}

export const getBackend = (name: string): StorageBackend => {
  const b = backends.get(name)
  if (!b) throw new HttpError(503, `Stockage "${name}" indisponible`, 'BACKEND_UNAVAILABLE')
  return b
}
export const defaultBackend = () => getBackend(config.defaultBackend)
export const allBackends = () => [...backends.values()]

// Clé aléatoire : u<user>/<2 car.>/<uuid>. Indépendante du nom du fichier et du backend.
export const newKey = (userId: number) => {
  const id = crypto.randomUUID()
  return `u${userId}/${id.slice(0, 2)}/${id}`
}
