import type { Request, Response, NextFunction, RequestHandler } from 'express'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
  }
}

// Express 4 : renvoie les promesses rejetées au handler d'erreurs
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

export const parseId = (v: unknown) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Identifiant de dossier optionnel : absent / "root" / null = racine
export const optId = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '' || v === 'root') return null
  const n = parseId(v)
  if (n === null) throw new HttpError(400, 'Identifiant invalide')
  return n
}
