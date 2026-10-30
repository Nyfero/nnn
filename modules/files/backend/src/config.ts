import { parseSize } from './utils/size'

const GiB = 1024 ** 3

const unlimitedOr = (v: string | undefined, fallback: number): number | null =>
  v?.trim().toLowerCase() === 'unlimited' ? null : parseSize(v, fallback)

// Backends supplémentaires : FILES_EXTRA_BACKENDS="archive=/mnt/archive,disk2=/mnt/disk2"
function parseExtra(v: string | undefined): { name: string; path: string }[] {
  if (!v?.trim()) return []
  return v.split(',').map((entry) => {
    const [name, ...rest] = entry.split('=')
    const p = rest.join('=').trim()
    if (!/^[a-z0-9-]{1,32}$/.test(name.trim()) || !p) {
      throw new Error(`FILES_EXTRA_BACKENDS invalide : "${entry}" (attendu nom=/chemin)`)
    }
    return { name: name.trim(), path: p }
  })
}

export const config = {
  moduleId: process.env.MODULE_ID ?? 'files',
  moduleSecret: process.env.MODULE_SECRET ?? '',
  coreUrl: process.env.CORE_URL ?? 'http://core-backend:3000',
  port: Number(process.env.PORT ?? 3000),

  // Stockage
  storagePath: process.env.FILES_STORAGE_PATH ?? '/data/files', // backend "local"
  extraBackends: parseExtra(process.env.FILES_EXTRA_BACKENDS),
  defaultBackend: process.env.FILES_DEFAULT_BACKEND ?? 'local', // reçoit les nouveaux fichiers

  // Limites
  defaultQuotaBytes: unlimitedOr(process.env.FILES_DEFAULT_QUOTA, 1 * GiB), // null = illimité
  minFreeBytes: parseSize(process.env.FILES_MIN_FREE, 1 * GiB), // espace disque à toujours garder libre
  maxUploadBytes: parseSize(process.env.FILES_MAX_UPLOAD, 0), // 0 = pas de limite par fichier

  // Corbeille : jours avant suppression définitive
  trashDays: Math.max(1, Number(process.env.FILES_TRASH_DAYS ?? 7)),

  // Durée de validité des liens de téléchargement
  downloadTtlMs: 10 * 60 * 1000,
  inlineTtlMs: 60 * 60 * 1000,
}
