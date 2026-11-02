import prisma from '../prisma'
import { syncPeers } from './wireguard'

// Le core est la source de vérité des rôles. Toutes les minutes, on lui demande qui est admin
// ou détient l'un des rôles autorisés (et a accès au module) et on suspend / réactive les appareils en conséquence.
// Si le core est injoignable, RIEN ne change : on ne coupe personne sur une panne.
export function startReconcile(opts: {
  coreUrl: string
  moduleId: string
  secret: string
  roles: string[]
  everyMs: number
}) {
  let running = false

  const run = async () => {
    if (running) return
    running = true
    try {
      const res = await fetch(`${opts.coreUrl}/api/core/modules/access?roles=${encodeURIComponent(opts.roles.join(','))}`, {
        headers: { 'X-Module-Id': opts.moduleId, 'X-Module-Secret': opts.secret },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const { user_ids } = (await res.json()) as { user_ids: number[] }
        const allowed = new Set(user_ids)
        const devices = await prisma.devices.findMany({
          select: { device_id: true, user_id: true, is_enabled: true },
        })
        const enable = devices
          .filter((d) => !d.is_enabled && allowed.has(d.user_id))
          .map((d) => d.device_id)
        const disable = devices
          .filter((d) => d.is_enabled && !allowed.has(d.user_id))
          .map((d) => d.device_id)

        if (enable.length) {
          await prisma.devices.updateMany({
            where: { device_id: { in: enable } },
            data: { is_enabled: true },
          })
        }
        if (disable.length) {
          await prisma.devices.updateMany({
            where: { device_id: { in: disable } },
            data: { is_enabled: false },
          })
        }
        if (enable.length || disable.length) {
          console.log(
            `[vpn] accès mis à jour : ${enable.length} appareil(s) réactivé(s), ${disable.length} suspendu(s)`
          )
        }
      } else {
        console.warn(`[vpn] contrôle d'accès impossible (HTTP ${res.status}), état inchangé`)
      }
      // Réécrit aussi le fichier des pairs : rattrape une écriture qui aurait échoué
      await syncPeers()
    } catch (err) {
      console.warn('[vpn] contrôle d\'accès impossible, état inchangé :', (err as Error).message)
    } finally {
      running = false
    }
  }

  run()
  const timer = setInterval(run, opts.everyMs)
  return { stop: () => clearInterval(timer) }
}
