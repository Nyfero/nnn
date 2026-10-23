import { SECURITY_QUESTION_COUNT } from '../config'

const SALT = /^[0-9a-f]{64}$/
// iv (12 octets) : tag (16 octets) : clé chiffrée (32 octets)
const KEY_BLOB = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]{64}$/

export const isSalt = (v: unknown): v is string =>
  typeof v === 'string' && SALT.test(v)

export const isKeyBlob = (v: unknown): v is string =>
  typeof v === 'string' && KEY_BLOB.test(v)

export const isStr = (v: unknown, max = 255): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max

export const normalizeEmail = (e: string) => e.trim().toLowerCase()

// Doit rester identique côté client (dérivation de la KEK de récupération)
export const normalizeAnswer = (a: string) =>
  a.toLowerCase().replace(/\s/g, '').trim()

export interface QA {
  question: string
  answer: string
}

export const isQA = (q: unknown): q is QA =>
  !!q &&
  typeof q === 'object' &&
  isStr((q as QA).question, 80) &&
  isStr((q as QA).answer, 30)

export const isQuestionList = (v: unknown): v is QA[] =>
  Array.isArray(v) && v.length === SECURITY_QUESTION_COUNT && v.every(isQA)
