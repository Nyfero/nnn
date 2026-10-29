import type { Request, Response, NextFunction } from 'express'

// À placer après coreAuth (req.user est rempli par le core)
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Accès refusé : réservé aux administrateurs' })
  }
  next()
}
