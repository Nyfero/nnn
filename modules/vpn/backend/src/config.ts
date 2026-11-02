const int = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export const MODULE_ID = process.env.MODULE_ID ?? 'vpn'

// Rôles autorisés à utiliser le VPN (en plus des admins). Les rôles et leurs modules sont gérés
// par le core ; ce filtre supplémentaire réserve le VPN aux personnes de confiance.
export const ALLOWED_ROLES = (process.env.VPN_ALLOWED_ROLES ?? 'FAMILLE')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean)

// Dossier partagé avec le conteneur WireGuard :
//   peers.conf  (écrit ici)      liste des pairs autorisés
//   server.pub  (écrit par wg)   clé publique du serveur
//   status.txt  (écrit par wg)   état des pairs (dernier handshake, trafic)
export const SHARED_DIR = process.env.VPN_SHARED_DIR ?? '/shared'

// Trois premiers octets du réseau privé du VPN (le serveur est en .1)
export const SUBNET = process.env.VPN_SUBNET ?? '10.8.0'
export const DNS = process.env.VPN_DNS ?? '1.1.1.1, 1.0.0.1'
export const MAX_DEVICES = int(process.env.VPN_MAX_DEVICES, 5)
export const RECONCILE_MS = int(process.env.VPN_RECONCILE_MS, 60_000)

export const ENDPOINT: string | null = (() => {
  if (process.env.VPN_ENDPOINT) return process.env.VPN_ENDPOINT
  try {
    return `${new URL(process.env.FRONTEND_URL ?? '').hostname}:51820`
  } catch {
    return null
  }
})()

// Ces valeurs sont recopiées telles quelles dans les configurations : on refuse tout ce qui
// pourrait y injecter une ligne supplémentaire.
if (!ALLOWED_ROLES.every((r) => /^[A-Z_]{1,64}$/.test(r))) {
  throw new Error('VPN_ALLOWED_ROLES invalide (noms de rôles en majuscules, séparés par des virgules)')
}
if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(SUBNET)) {
  throw new Error('VPN_SUBNET invalide (attendu : trois octets, ex. 10.8.0)')
}
if (!/^[0-9a-fA-F:., ]{1,100}$/.test(DNS)) {
  throw new Error('VPN_DNS invalide (adresses IP séparées par des virgules)')
}
if (ENDPOINT && !/^[A-Za-z0-9.-]+:\d{1,5}$/.test(ENDPOINT)) {
  throw new Error('VPN_ENDPOINT invalide (attendu : hote:port, ex. myprout.fr:51820)')
}
