import crypto from 'node:crypto'

const PBKDF2_ITERATIONS = 310000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha256'

export function deriveKek(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEYLEN,
      PBKDF2_DIGEST,
      (err, key) => (err ? reject(err) : resolve(key))
    )
  })
}

// Format "iv:tag:ciphertext" (hex), identique à celui du client
export function encryptKey(keyHex: string, kek: Buffer): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(keyHex, 'hex')),
    cipher.final(),
  ])
  return [
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

export const generateMasterKey = () => crypto.randomBytes(32).toString('hex')
export const generateSalt = () => crypto.randomBytes(32).toString('hex')
