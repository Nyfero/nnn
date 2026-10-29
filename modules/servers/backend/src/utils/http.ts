import type { Request, Response, NextFunction, RequestHandler } from 'express'

// Express 4 : renvoie les promesses rejetées au handler d'erreurs
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

export const parseId = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}
