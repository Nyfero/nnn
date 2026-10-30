export const UNITS = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }

export function formatBytes(n) {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} o`
  const units = ['Ko', 'Mo', 'Go', 'To', 'Po']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < units.length - 1)
  return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)} ${units[i]}`
}

export const formatQuota = (n) => (n === null || n === undefined ? 'Illimité' : formatBytes(n))

export const formatDate = (d) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export const daysLeft = (expiresAt) => Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 86_400_000))

// 3 221 225 472 -> { value: 3, unit: 'GB' }
export function splitBytes(bytes) {
  const b = bytes ?? 1 * UNITS.GB
  const unit = b >= UNITS.TB ? 'TB' : b >= UNITS.GB ? 'GB' : 'MB'
  return { value: Math.round((b / UNITS[unit]) * 100) / 100, unit }
}

// Dans un coffre le serveur ne connaît pas le nom : le type est déduit du nom déchiffré, côté navigateur
const EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  m4a: 'audio/mp4', flac: 'audio/flac', pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', zip: 'application/zip',
}
export const mimeFromName = (name) => EXT[name.split('.').pop().toLowerCase()] ?? 'application/octet-stream'

// "photo.jpg" -> "photo (2).jpg"
export function numberedName(name, i) {
  if (i === 0) return name
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`
}

const PREVIEW = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm)|audio\/(mpeg|ogg|wav|mp4|flac))$/
export const isPreviewable = (n) => !n.is_folder && PREVIEW.test(n.display_mime ?? '')

export function iconFor(n) {
  if (n.is_vault) return 'lock'
  if (n.is_folder) return 'folder'
  const m = n.display_mime ?? ''
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'movie'
  if (m.startsWith('audio/')) return 'audiotrack'
  if (m === 'application/pdf') return 'picture_as_pdf'
  if (m === 'application/zip') return 'folder_zip'
  if (m.startsWith('text/')) return 'description'
  return 'insert_drive_file'
}
