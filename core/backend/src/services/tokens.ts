import prisma from '../prisma'
import { hashToken, randomToken } from '../utils/jwt'

// Crée un token à usage unique (remplace les anciens du même type pour cet utilisateur)
export async function issueToken(userId: number, type: string, ttlMs: number | null) {
  const raw = randomToken()
  await prisma.$transaction([
    prisma.tokens.deleteMany({ where: { user_id: userId, type } }),
    prisma.tokens.create({
      data: {
        user_id: userId,
        token_hash: hashToken(raw),
        type,
        expires_at: ttlMs ? new Date(Date.now() + ttlMs) : null,
      },
    }),
  ])
  return raw
}

export async function lookupToken(raw: unknown, type: string) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) {
    return { ok: false, status: 400, error: 'Token manquant' } as const
  }
  const record = await prisma.tokens.findFirst({
    where: { token_hash: hashToken(raw), type },
    include: { user: true },
  })
  if (!record) {
    return { ok: false, status: 400, error: 'Token invalide ou déjà utilisé' } as const
  }
  if (record.expires_at && record.expires_at < new Date()) {
    return { ok: false, status: 401, error: 'Token expiré' } as const
  }
  return { ok: true, record } as const
}
