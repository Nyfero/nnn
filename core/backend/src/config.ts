export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  FAMILLE: 'FAMILLE',
  GAMER: 'GAMER',
  AMIS: 'AMIS',
} as const

// Valeurs appliquées une seule fois par rôle (ensuite c'est l'admin qui décide).
// modules : autorisés si all_modules = false, exclus si all_modules = true.
export const ROLE_DEFAULTS: Record<
  string,
  {
    description: string
    all_modules: boolean
    modules: string[]
    storage_quota_mb: number | null
  }
> = {
  [ROLES.ADMIN]: {
    description: 'Tous les droits',
    all_modules: true,
    modules: [],
    storage_quota_mb: null,
  },
  [ROLES.USER]: {
    description: 'Gestionnaire de mots de passe',
    all_modules: false,
    modules: ['passwords'],
    storage_quota_mb: 0,
  },
  [ROLES.FAMILLE]: {
    description: 'Tous les modules sauf le serveur',
    all_modules: true,
    modules: ['servers'],
    storage_quota_mb: 2 * 1024, // 2 Go
  },
  [ROLES.GAMER]: {
    description: 'Module serveur',
    all_modules: false,
    modules: ['servers'],
    storage_quota_mb: 0,
  },
  [ROLES.AMIS]: {
    description: 'Comme la famille, avec moins de stockage',
    all_modules: true,
    modules: ['servers'],
    storage_quota_mb: 1024, // 1 Go
  },
}

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
