// Primitives crypto partagées par le core et les modules.
// Formats identiques à ceux du serveur (seed admin) : "iv:tag:ciphertext" en hex.

const encoder = new TextEncoder()

export const hexToBytes = (hex) =>
  Uint8Array.from(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)))

export const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

export const randomHex = (bytes = 32) =>
  bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)))

export const generateMasterKeyHex = () => randomHex(32)
export const generateSalt = () => randomHex(32)

// Doit rester identique à core/backend/src/utils/validators.ts
export const normalizeAnswer = (a) => a.toLowerCase().replace(/\s/g, '').trim()

// La KEK de récupération est dérivée des réponses (dans l'ordre des questions)
export const recoveryPassphrase = (answers) =>
  answers.map(normalizeAnswer).join('')

// KEK = PBKDF2(secret, sel) -> clé AES-GCM 256 (non extractable)
export async function deriveKek(secret, saltHex) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: 310000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Chiffre une clé (hex) avec une KEK -> "iv:tag:ciphertext"
export async function encryptKey(keyHex, kek) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      kek,
      hexToBytes(keyHex)
    )
  )
  const tag = encrypted.slice(-16)
  const ciphertext = encrypted.slice(0, -16)
  return [bytesToHex(iv), bytesToHex(tag), bytesToHex(ciphertext)].join(':')
}

export async function decryptKey(blob, kek) {
  const [ivHex, tagHex, ctHex] = blob.split(':')
  const ct = hexToBytes(ctHex)
  const tag = hexToBytes(tagHex)
  const combined = new Uint8Array(ct.length + tag.length)
  combined.set(ct, 0)
  combined.set(tag, ct.length)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(ivHex) },
    kek,
    combined
  )
  return bytesToHex(new Uint8Array(decrypted))
}

// Clé maître -> CryptoKey HKDF non extractable (utilisable pour dériver, jamais exportable)
export const importMasterKey = (masterKeyHex) =>
  crypto.subtle.importKey('raw', hexToBytes(masterKeyHex), 'HKDF', false, [
    'deriveKey',
  ])

// Clé AES-GCM propre à un module : HKDF(master_key, "module:<id>")
export const deriveModuleKey = (masterKey, moduleId) =>
  crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('myprout-hkdf-v1'),
      info: encoder.encode(`module:${moduleId}`),
    },
    masterKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
