export const ROLES = { ADMIN: 'ADMIN', USER: 'USER' } as const

export const TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  ACTIVATE: 'activate',
  PASSWORD_RESET: 'password_reset',
  // Questions de sécurité validées : seul ce type autorise le reset effectif
  PASSWORD_RESET_VERIFIED: 'password_reset_verified',
} as const

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN

export const TTL = {
  ACCESS_SECONDS: 15 * 60,
  REFRESH_MS: 7 * DAY,
  EMAIL_VERIFICATION_MS: 7 * DAY,
  ACTIVATE_MS: 7 * DAY,
  RESET_MS: 60 * MIN,
  RESET_VERIFIED_MS: 15 * MIN,
  REFRESH_GRACE_MS: 30 * 1000,
}

export const SECURITY_QUESTION_COUNT = 3
