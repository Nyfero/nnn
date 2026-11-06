import { CONTAINER_NAME } from '../docker'

// Corps d'un serveur déclaré par l'admin (logique pure : testable sans Prisma ni Docker)
export function parseServerBody(body: any) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const container = typeof body?.container === 'string' ? body.container.trim() : ''
  const description =
    typeof body?.description === 'string' && body.description.trim() ? body.description.trim() : null
  const ids: unknown[] = Array.isArray(body?.user_ids) ? body.user_ids : []

  if (!name || name.length > 100) return null
  if (!CONTAINER_NAME.test(container)) return null
  if (description && description.length > 255) return null
  if (ids.length > 500 || !ids.every((n) => Number.isInteger(n) && (n as number) > 0)) return null

  return { name, container, description, user_ids: [...new Set(ids as number[])] }
}
