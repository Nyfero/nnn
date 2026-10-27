import type { Response } from 'express'
import prisma from '../prisma'
import { TTL } from '../config'
import { hashToken, randomToken, signAccessToken } from '../utils/jwt'
import { accessibleModules, hasAdminRole } from './access'

export const REFRESH_COOKIE = 'refreshToken'
// Le cookie n'est envoyé qu'aux routes d'auth du core (même origine via le proxy)
const COOKIE_PATH = '/api/core/auth'

const baseCookie = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: COOKIE_PATH,
})

export const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, { ...baseCookie(), maxAge: TTL.REFRESH_MS })

export const clearRefreshCookie = (res: Response) =>
  res.clearCookie(REFRESH_COOKIE, baseCookie())

export async function createSession(userId: number, res: Response) {
  const refresh = randomToken()
  const session = await prisma.sessions.create({
    data: {
      user_id: userId,
      refresh_hash: hashToken(refresh),
      expires_at: new Date(Date.now() + TTL.REFRESH_MS),
    },
  })
  setRefreshCookie(res, refresh)
  return session
}

// Réponse commune login / refresh : JWT + profil + blobs de clé + modules autorisés
export async function buildAuthResponse(userId: number, sid: number) {
  const user = await prisma.users.findUniqueOrThrow({
    where: { user_id: userId },
    include: { userRoles: { include: { role: true } } },
  })
  const isAdmin = hasAdminRole(user)
  const modules = await accessibleModules(user.user_id, isAdmin)

  return {
    token: signAccessToken({ user_id: user.user_id, sid }),
    user: {
      user_id: user.user_id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin,
      kek_salt: user.kek_salt,
      encrypted_master_key: user.encrypted_master_key,
      modules,
    },
  }
}

export async function cleanupExpired() {
  const now = new Date()
  await prisma.tokens.deleteMany({ where: { expires_at: { lt: now } } })
  await prisma.sessions.deleteMany({ where: { expires_at: { lt: now } } })

  // Inscriptions jamais vérifiées : l'adresse est libérée une fois le lien expiré.
  // Les tokens associés partent en cascade.
  const { count } = await prisma.users.deleteMany({
    where: {
      is_email_verified: false,
      created_at: { lt: new Date(now.getTime() - TTL.EMAIL_VERIFICATION_MS) },
    },
  })
  if (count > 0)
    console.log(
      `[cleanup] ${count} inscription(s) non vérifiée(s) supprimée(s)`
    )
}
