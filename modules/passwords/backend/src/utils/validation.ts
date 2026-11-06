// Validation des entrées du module passwords (logique pure, sans Prisma : testable seule)

export const parseId = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Chaîne de `max` caractères au plus ; null si absente ; undefined si invalide
export const optStr = (v: unknown, max: number) =>
  typeof v === 'string' && v.length <= max ? v : v == null ? null : undefined

// Le mot de passe arrive déjà chiffré par le navigateur : le serveur ne le voit jamais en clair
export function parseBody(body: any) {
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const username = optStr(body?.username, 191)
  const note = optStr(body?.note, 2000)

  if (!title || title.length > 191) return null
  if (!password || password.length > 8192) return null
  if (username === undefined || note === undefined) return null

  return { title, username, password, note }
}

// Nom de domaine accepté par le proxy de logos (en minuscules)
export const DOMAIN = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/
