// Coffres chiffrés (côté navigateur uniquement : le serveur ne voit ni clés, ni noms, ni contenus).
//
//   secret du coffre (32 octets aléatoires)  ──chiffré par la clé du module──>  wrapped_key (stocké sur le serveur)
//   secret ──HKDF──> clé AES-GCM "enc" (noms + contenus)  et  clé HMAC "idx" (index d'unicité des noms)
//
// Contenu d'un fichier : suite de blocs de 1 Mio :  IV(12) | chiffré | tag(16)
//   donnée authentifiée de chaque bloc = numéro du bloc (4 octets) + drapeau « dernier bloc » (1 octet)
//   -> un bloc déplacé, supprimé ou un fichier tronqué est détecté au déchiffrement.
// Nom : base64url( IV(12) | chiffré+tag ). Index de nom : HMAC-SHA256 du nom normalisé (unicité sans révéler le nom).

export const CHUNK = 1024 * 1024
export const IV_LEN = 12
export const TAG_LEN = 16
export const OVERHEAD = IV_LEN + TAG_LEN
export const MAX_NAME_LENGTH = 200
// Le fichier chiffré est assemblé en mémoire avant l'envoi (et déchiffré en mémoire au téléchargement)
export const MAX_VAULT_FILE = 300 * 1024 * 1024

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const SALT = encoder.encode('myprout-files-vault-v1')

// ───────── base64url ─────────
export function toB64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
export function fromB64(str) {
  const b = atob(str.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

// ───────── Clés ─────────
// `moduleKey` : clé AES-GCM du module (HKDF(master_key, "module:files")), voir getModuleKey du SDK
export async function createVaultSecret(moduleKey) {
  const secret = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, moduleKey, secret))
  const out = new Uint8Array(IV_LEN + ct.length)
  out.set(iv)
  out.set(ct, IV_LEN)
  return toB64(out) // à envoyer au serveur (wrapped_key)
}

export async function openVault(wrappedKey, moduleKey) {
  const raw = fromB64(wrappedKey)
  const secret = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, IV_LEN) }, moduleKey, raw.subarray(IV_LEN))
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey'])
  const derive = (info, algo, usages) =>
    crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode(info) }, base, algo, false, usages)
  return {
    enc: await derive('enc', { name: 'AES-GCM', length: 256 }, ['encrypt', 'decrypt']),
    idx: await derive('idx', { name: 'HMAC', hash: 'SHA-256', length: 256 }, ['sign']),
  }
}

// ───────── Noms ─────────
export async function encryptName(vault, name) {
  if (name.length > MAX_NAME_LENGTH) throw new Error(`Nom trop long dans un coffre (${MAX_NAME_LENGTH} caractères maximum)`)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.enc, encoder.encode(name)))
  const out = new Uint8Array(IV_LEN + ct.length)
  out.set(iv)
  out.set(ct, IV_LEN)
  return toB64(out)
}

export async function decryptName(vault, blob) {
  const raw = fromB64(blob)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, IV_LEN) }, vault.enc, raw.subarray(IV_LEN))
  return decoder.decode(pt)
}

export async function nameKey(vault, name) {
  return hex(await crypto.subtle.sign('HMAC', vault.idx, encoder.encode(name.normalize('NFC').toLowerCase())))
}

// { name, name_key } prêts à être envoyés au serveur
export async function sealName(vault, name) {
  return { name: await encryptName(vault, name), name_key: await nameKey(vault, name) }
}

// ───────── Contenus ─────────
const chunkCount = (plainSize) => Math.max(1, Math.ceil(plainSize / CHUNK))
export const encryptedSize = (plainSize) => plainSize + OVERHEAD * chunkCount(plainSize)

export function plainSize(encSize) {
  if (encSize < OVERHEAD) return 0
  return encSize - OVERHEAD * Math.ceil(encSize / (CHUNK + OVERHEAD))
}

const aad = (index, last) => {
  const a = new Uint8Array(5)
  new DataView(a.buffer).setUint32(0, index)
  a[4] = last ? 1 : 0
  return a
}

export async function encryptFile(vault, file, onProgress) {
  const n = chunkCount(file.size)
  const parts = []
  for (let i = 0; i < n; i++) {
    const plain = await file.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer()
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(i, i === n - 1) }, vault.enc, plain)
    const part = new Uint8Array(IV_LEN + ct.byteLength)
    part.set(iv)
    part.set(new Uint8Array(ct), IV_LEN)
    parts.push(part)
    onProgress?.((i + 1) / n)
  }
  return new Blob(parts, { type: 'application/octet-stream' })
}

// `stream` : ReadableStream des octets chiffrés (response.body ou blob.stream()), `encSize` : taille annoncée par le serveur
export async function decryptFile(vault, stream, encSize, onProgress) {
  if (encSize < OVERHEAD) throw new Error('Fichier chiffré invalide')
  const full = CHUNK + OVERHEAD
  const n = Math.ceil(encSize / full)
  const lastLen = encSize - (n - 1) * full
  if (lastLen < OVERHEAD) throw new Error('Fichier chiffré invalide')

  const reader = stream.getReader()
  const parts = []
  let buf = new Uint8Array(0)
  let index = 0
  const need = () => (index === n - 1 ? lastLen : full)

  for (;;) {
    while (index < n && buf.length >= need()) {
      const len = need()
      const piece = buf.subarray(0, len)
      try {
        parts.push(
          await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: piece.subarray(0, IV_LEN), additionalData: aad(index, index === n - 1) },
            vault.enc,
            piece.subarray(IV_LEN)
          )
        )
      } catch {
        throw new Error('Déchiffrement impossible : fichier corrompu, modifié ou mauvaise clé')
      }
      buf = buf.slice(len)
      index++
      onProgress?.(index / n)
    }
    if (index === n) break
    const { value, done } = await reader.read()
    if (done) throw new Error('Fichier tronqué')
    const next = new Uint8Array(buf.length + value.length)
    next.set(buf)
    next.set(value, buf.length)
    buf = next
  }
  if (buf.length) throw new Error('Données inattendues après la fin du fichier')
  return new Blob(parts)
}
