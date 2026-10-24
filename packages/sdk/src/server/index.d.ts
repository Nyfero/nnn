import type { RequestHandler } from 'express'

export interface CoreUser {
  user_id: number
  email: string
  firstName: string
  lastName: string
  isAdmin: boolean
}

export function coreAuth(options: {
  coreUrl: string
  moduleId: string
  moduleSecret: string
  cacheTtlMs?: number
}): RequestHandler

export function requireModuleSecret(secret: string): RequestHandler

export function registerModule(options: {
  coreUrl: string
  id: string
  secret: string
  name: string
  icon?: string
  path: string
  version?: string
  internalUrl?: string
  heartbeatMs?: number
  log?: Pick<Console, 'log' | 'warn'>
}): { stop(): void }
