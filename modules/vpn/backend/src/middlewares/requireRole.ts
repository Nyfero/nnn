import type { Request, Response, NextFunction } from 'express'

// À placer après coreAuth : admin, ou membre d'au moins un des rôles autorisés
export const requireRole =
  (allowed: string[]) => (req: Request, res: Response, next: NextFunction) => {
    const u = req.user
    if (u && (u.isAdmin || u.roles.some((r) => allowed.includes(r)))) return next()
    res.status(403).json({ error: 'Le VPN est réservé aux membres de la famille' })
  }
