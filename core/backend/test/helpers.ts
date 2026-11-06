import crypto from 'node:crypto'

// Déchiffre un blob "iv:tag:chiffré" (hex) avec la KEK, comme le fait le client (voir packages/sdk)
export function decodeKeyBlob(blob: string, kek: Buffer): string {
  const [iv, tag, enc] = blob.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(enc, 'hex')), decipher.final()]).toString('hex')
}
