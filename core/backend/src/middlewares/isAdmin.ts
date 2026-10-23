import type { Request, Response, NextFunction } from 'express'

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' })
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ error: 'Accès refusé : réservé aux administrateurs' })
  }
  next()
}
