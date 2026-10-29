// Client minimal de l'API Docker, via le proxy filtrant (docker-proxy).
// Le proxy n'autorise que : GET /containers/<nom>/json et POST /containers/<nom>/(start|stop|restart).

const API = process.env.DOCKER_API_URL ?? 'http://docker-proxy:2375'
// Les conteneurs de cette stack compose ne peuvent jamais être pilotés depuis le module
const PROTECTED_PROJECT = process.env.PROTECTED_PROJECT ?? 'myprout'

export const CONTAINER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/
export const ACTIONS = ['start', 'stop', 'restart'] as const
export type Action = (typeof ACTIONS)[number]
export const isAction = (v: string): v is Action => (ACTIONS as readonly string[]).includes(v)

export interface ContainerState {
  status: string // running | exited | restarting | paused | created | dead | missing | unknown
  running: boolean
  startedAt: string | null
  health: string | null // healthy | unhealthy | starting | null (pas de healthcheck)
  protected: boolean
}

export class DockerError extends Error {
  constructor(
    message: string,
    public status = 502
  ) {
    super(message)
  }
}

async function call(method: 'GET' | 'POST', path: string, timeoutMs = 10_000) {
  try {
    return await fetch(`${API}${path}`, { method, signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new DockerError('Docker est injoignable (proxy arrêté ?)', 503)
  }
}

export async function inspect(container: string): Promise<ContainerState> {
  const res = await call('GET', `/containers/${encodeURIComponent(container)}/json`)
  if (res.status === 404) {
    return { status: 'missing', running: false, startedAt: null, health: null, protected: false }
  }
  if (!res.ok) throw new DockerError(`Docker a répondu ${res.status}`)

  const c: any = await res.json()
  return {
    status: c.State?.Status ?? 'unknown',
    running: !!c.State?.Running,
    startedAt: c.State?.Running ? (c.State?.StartedAt ?? null) : null,
    health: c.State?.Health?.Status ?? null,
    protected: c.Config?.Labels?.['com.docker.compose.project'] === PROTECTED_PROJECT,
  }
}

export async function act(container: string, action: Action): Promise<ContainerState> {
  const before = await inspect(container)
  if (before.status === 'missing') throw new DockerError('Conteneur introuvable', 404)
  if (before.protected) {
    throw new DockerError('Ce conteneur fait partie de Myprout : action refusée', 403)
  }

  // stop / restart : 20 s laissées au jeu pour sauvegarder avant le SIGKILL
  const query = action === 'start' ? '' : '?t=20'
  const res = await call('POST', `/containers/${encodeURIComponent(container)}/${action}${query}`, 60_000)
  // 204 = fait, 304 = déjà dans cet état
  if (res.status !== 204 && res.status !== 304) {
    console.error(`[servers] ${action} ${container} : HTTP ${res.status}`, await res.text().catch(() => ''))
    throw new DockerError(`Docker a refusé l'action (${res.status})`)
  }
  return inspect(container)
}

interface ServerRow {
  server_id: number
  name: string
  description: string | null
  container: string
}

// Serveur + état en direct. Une erreur Docker ne casse pas la liste : la carte passe en « indisponible ».
export async function serverView(s: ServerRow) {
  const base = { server_id: s.server_id, name: s.name, description: s.description }
  try {
    return { ...base, ...(await inspect(s.container)) }
  } catch (e) {
    return {
      ...base,
      status: 'unknown',
      running: false,
      startedAt: null,
      health: null,
      protected: false,
      error: e instanceof DockerError ? e.message : 'Erreur inconnue',
    }
  }
}
