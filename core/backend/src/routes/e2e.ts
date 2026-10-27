import { Router } from 'express'
import { safeEqual } from '../utils/jwt'
import { clearMailbox, readMailbox } from '../services/email/testMailbox'

// Monté uniquement si E2E_MODE=true. Protégé par un jeton dédié.
const router = Router()

router.use((req, res, next) => {
  const token = req.header('X-E2E-Token') ?? ''
  if (!process.env.E2E_TOKEN || !safeEqual(token, process.env.E2E_TOKEN)) {
    return res.status(404).end()
  }
  next()
})

router.get('/mailbox', (req, res) => {
  res.json(readMailbox(typeof req.query.to === 'string' ? req.query.to : undefined))
})

router.delete('/mailbox', (_req, res) => {
  clearMailbox()
  res.json({ ok: true })
})

export default router
