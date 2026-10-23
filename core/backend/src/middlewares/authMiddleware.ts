import type { Request, Response, NextFunction } from 'express'
import prisma from '../prisma'
import { verifyAccessToken } from '../utils/jwt'
import { hasAdminRole } from '../services/access'
import { ah } from '../utils/asyncHandler'

// Valide le JWT (signature + expiration) puis la session en base (révocation)
export async function resolveAuth(authHeader?: string) {
  if (!authHeader?.startsWith('Bearer ')) return null

  let payload
  try {
    payload = verifyAccessToken(authHeader.slice(7))
  } catch {
    return null
  }

  const session = await prisma.sessions.findUnique({
    where: { session_id: payload.sid },
    include: { user: { include: { userRoles: { include: { role: true } } } } },
  })

  if (
    !session ||
    session.user_id !== payload.user_id ||
    session.expires_at < new Date() ||
    !session.user.is_active
  ) {
    return null
  }

  return {
    user: session.user,
    sid: session.session_id,
    isAdmin: hasAdminRole(session.user),
  }
}

export const authMiddleware = ah(
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = await resolveAuth(req.headers.authorization)
    if (!auth) {
      return res.status(401).json({ error: 'Token invalide, expiré ou révoqué' })
    }
    req.user = {
      user_id: auth.user.user_id,
      email: auth.user.email,
      isAdmin: auth.isAdmin,
      sid: auth.sid,
    }
    next()
  }
)
