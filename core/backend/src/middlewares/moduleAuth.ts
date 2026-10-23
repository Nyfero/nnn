import type { Request, Response, NextFunction } from 'express'
import { getModuleSecret } from '../services/access'
import { safeEqual } from '../utils/jwt'

export const moduleAuth = (req: Request, res: Response, next: NextFunction) => {
  const id = req.header('X-Module-Id')
  const secret = req.header('X-Module-Secret')

  if (!id || !secret || !/^[a-z0-9-]{1,64}$/.test(id)) {
    return res.status(401).json({ error: 'Module non authentifié' })
  }
  const expected = getModuleSecret(id)
  if (!expected || !safeEqual(secret, expected)) {
    return res.status(401).json({ error: 'Module non authentifié' })
  }

  req.moduleId = id
  next()
}
