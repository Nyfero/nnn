// Logique pure d'affichage d'un serveur de jeu (état, bouton, durée de fonctionnement) : testable sans Vue

const BUSY_LABELS = { start: 'Démarrage…', stop: 'Arrêt…', restart: 'Redémarrage…' }

// { label, cls } affichés pour un serveur ; `busy` = action en cours ('start' | 'stop' | 'restart' | '')
export function stateView(server, busy = '') {
  if (busy) return { label: BUSY_LABELS[busy], cls: 'pending' }
  if (server.error) return { label: 'Indisponible', cls: 'error' }
  switch (server.status) {
    case 'running':
      if (server.health === 'starting') return { label: 'Démarrage…', cls: 'pending' }
      if (server.health === 'unhealthy') return { label: 'En ligne (instable)', cls: 'warn' }
      return { label: 'En ligne', cls: 'on' }
    case 'restarting':
      return { label: 'Redémarrage…', cls: 'pending' }
    case 'paused':
      return { label: 'En pause', cls: 'warn' }
    case 'missing':
      return { label: 'Conteneur introuvable', cls: 'error' }
    case 'unknown':
      return { label: 'Indisponible', cls: 'error' }
    default:
      return { label: 'Hors ligne', cls: 'off' }
  }
}

// Position du bouton : suit l'action en cours, sinon l'état réel
export const isSwitchOn = (server, busy = '') => (busy ? busy !== 'stop' : server.running)

// Aucune action possible pendant une action, en cas d'erreur, si le conteneur manque ou fait partie de Myprout
export const isDisabled = (server, busy = '') =>
  !!busy || !!server.error || server.status === 'missing' || server.protected

// "depuis 2 j 3 h 5 min" ; vide si le serveur n'est pas en cours de fonctionnement
export function uptimeLabel(server, busy, now) {
  if (busy || !server.running || !server.startedAt) return ''
  const sec = Math.max(0, Math.floor((now - Date.parse(server.startedAt)) / 1000))
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `depuis ${d ? d + ' j ' : ''}${d || h ? h + ' h ' : ''}${m} min`
}
