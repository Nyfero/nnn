import type { Request, Response, NextFunction, RequestHandler } from 'express'

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

// Express 4 ne gère pas les promesses rejetées : on les renvoie au handler d'erreurs
export const ah =
  (fn: Handler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }
