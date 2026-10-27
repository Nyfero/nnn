import type { Request, Response, NextFunction } from 'express'

// Limiteur en mémoire (suffisant pour une instance unique)
export function rateLimit(windowMs: number, max: number) {
  if (process.env.E2E_MODE === 'true') {
    return (_req: Request, _res: Response, next: NextFunction) => next()
  }

  const hits = new Map<string, { count: number; reset: number }>()

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const key = req.ip ?? 'unknown'

    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    }

    const entry = hits.get(key)
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs })
      return next()
    }
    if (++entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000))
      return res
        .status(429)
        .json({ error: 'Trop de tentatives, réessayez plus tard' })
    }
    next()
  }
}
