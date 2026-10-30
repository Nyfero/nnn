import path from 'node:path'
import { HttpError } from './http'

export function cleanName(v: unknown): string {
  if (typeof v !== 'string') throw new HttpError(400, 'Nom invalide')
  const name = v.normalize('NFC').trim()
  if (!name || name.length > 255 || name === '.' || name === '..' || /[\\\/\u0000-\u001f\u007f]/.test(name)) {
    throw new HttpError(400, 'Nom invalide (1 à 255 caractères, sans / ni \\)')
  }
  return name
}

// Coffres : le client envoie le nom chiffré (base64url) et un index HMAC. Le serveur ne peut que contrôler le format.
export function cleanEncName(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{38,1536}$/.test(v)) throw new HttpError(400, 'Nom chiffré invalide')
  return v
}
export function cleanNameKey(v: unknown): string {
  if (typeof v !== 'string' || !/^[0-9a-f]{64}$/.test(v)) throw new HttpError(400, 'Index de nom invalide')
  return v
}
export function cleanWrappedKey(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{40,1024}$/.test(v)) throw new HttpError(400, 'Clé de coffre invalide')
  return v
}

// "photo.jpg" -> "photo (2).jpg"
export function numberedName(name: string, i: number): string {
  if (i === 0) return name
  const ext = path.extname(name)
  return `${ext ? name.slice(0, -ext.length) : name} (${i})${ext}`
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', csv: 'text/csv', json: 'application/json',
  zip: 'application/zip', html: 'text/html', doc: 'application/msword', xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

// Le type vient uniquement de l'extension (jamais du Content-Type envoyé par le client)
export const mimeFor = (name: string) =>
  MIME[path.extname(name).slice(1).toLowerCase()] ?? 'application/octet-stream'

// Types affichables dans le navigateur. Tout le reste est forcé en téléchargement
// (un HTML/SVG servi en ligne depuis la même origine permettrait de voler la session).
export const INLINE_SAFE = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/flac',
  'text/plain',
])
