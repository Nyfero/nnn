import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { TTL } from '../config'

let privateKey: Buffer | undefined
let publicKey: Buffer | undefined

const getPrivateKey = () =>
  (privateKey ??= fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH as string))
const getPublicKey = () =>
  (publicKey ??= fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH as string))

export interface AccessPayload {
  user_id: number
  sid: number
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: TTL.ACCESS_SECONDS,
  })
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] })
  if (typeof decoded === 'string') throw new Error('Token invalide')
  return { user_id: decoded.user_id, sid: decoded.sid }
}

// Tokens à usage unique (email, activation, reset) et refresh tokens : opaques
export const randomToken = (): string => crypto.randomBytes(32).toString('hex')

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex')

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}
