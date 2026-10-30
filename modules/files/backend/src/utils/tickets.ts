import crypto from 'node:crypto'

// Lien de téléchargement signé et à durée limitée : le navigateur ne peut pas envoyer
// d'en-tête Authorization sur un <a href>, <img src> ou <video src>.
export interface Ticket {
  n: number // node_id
  u: number // user_id
  i: boolean // affichage en ligne autorisé
  e: number // expiration (ms)
}

const mac = (data: string, secret: string) =>
  crypto.createHmac('sha256', `files-ticket:${secret}`).update(data).digest()

export function signTicket(t: Omit<Ticket, 'e'>, ttlMs: number, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...t, e: now + ttlMs })).toString('base64url')
  return `${body}.${mac(body, secret).toString('base64url')}`
}

export function verifyTicket(token: string, secret: string, now = Date.now()): Ticket | null {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const expected = mac(parts[0], secret)
  const given = Buffer.from(parts[1], 'base64url')
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
  try {
    const t = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    if (!Number.isInteger(t.n) || !Number.isInteger(t.u) || typeof t.e !== 'number' || t.e < now) return null
    return { n: t.n, u: t.u, i: !!t.i, e: t.e }
  } catch {
    return null
  }
}
