import { PrismaClient } from '@prisma/client'

// Les scripts lancés via `docker compose exec` n'héritent pas du DATABASE_URL construit par l'entrypoint
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const e = encodeURIComponent
  const v = process.env
  process.env.DATABASE_URL = `mysql://${e(v.DB_USER ?? '')}:${e(v.DB_PASSWORD ?? '')}@${v.DB_HOST}:3306/${v.DB_NAME}`
}

export default new PrismaClient()
