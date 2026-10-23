import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import prisma from './prisma'
import { ROLES } from './config'
import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import moduleRoutes from './routes/modules'
import { cleanupExpired } from './services/sessions'

const app = express()
app.set('trust proxy', 1) // derrière Caddy : req.ip fiable pour le rate limit

// En production tout passe par la même origine (proxy) : CORS n'est utile qu'en dev
// (Vite sur :5173). Une origine inconnue n'obtient simplement pas d'en-têtes CORS.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),
].filter(Boolean) as string[]

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/core/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/core/auth', authRoutes)
app.use('/api/core/admin', adminRoutes)
app.use('/api/core', moduleRoutes)

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur' })
})

async function main() {
  // Les rôles sont référencés par leur nom, jamais par un id codé en dur
  for (const role of Object.values(ROLES)) {
    await prisma.roles.upsert({ where: { role }, update: {}, create: { role } })
  }

  setInterval(() => cleanupExpired().catch(console.error), 60 * 60 * 1000)
  await cleanupExpired()

  const PORT = Number(process.env.PORT ?? 3000)
  app.listen(PORT, () => console.log(`[core] http://localhost:${PORT}`))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
