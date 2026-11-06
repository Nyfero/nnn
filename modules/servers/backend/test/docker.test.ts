import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

// Faux proxy Docker local : on vérifie ce que le module lui envoie, sans Docker ni réseau externe.
type Reply = { status: number; body?: unknown }
const calls: { method: string; url: string }[] = []
let reply: (method: string, url: string) => Reply = () => ({ status: 404 })

const fake = http.createServer((req, res) => {
  calls.push({ method: req.method!, url: req.url! })
  const r = reply(req.method!, req.url!)
  res.statusCode = r.status
  if (r.body !== undefined) {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(r.body))
  } else {
    res.end()
  }
})
await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve))
process.env.DOCKER_API_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`
process.env.PROTECTED_PROJECT = 'myprout'
// Importé après avoir fixé l'environnement : docker.ts lit l'URL au chargement
const docker = await import('../src/docker')
const { inspect, act, serverView, isAction, CONTAINER_NAME, DockerError } = docker

after(() => {
  fake.closeAllConnections()
  fake.close()
})

const running = {
  State: { Status: 'running', Running: true, StartedAt: '2026-01-01T10:00:00Z', Health: { Status: 'healthy' } },
  Config: { Labels: {} },
}
const exited = { State: { Status: 'exited', Running: false, StartedAt: '2026-01-01T10:00:00Z' }, Config: { Labels: {} } }
const ofProject = (project: string) => ({ ...exited, Config: { Labels: { 'com.docker.compose.project': project } } })

const reset = () => {
  calls.length = 0
  reply = () => ({ status: 404 })
}

test('CONTAINER_NAME : accepte les noms de conteneur Docker usuels', () => {
  for (const ok of ['mc', 'mc-server_1.2', 'A', 'valheim', 'a'.repeat(128)]) {
    assert.ok(CONTAINER_NAME.test(ok), `devrait accepter ${ok}`)
  }
})

test('CONTAINER_NAME : refuse ce qui pourrait sortir du chemin /containers/<nom>', () => {
  const bad = ['', '-x', '.x', '_x', 'a b', 'a/b', 'a;b', '../x', 'a?b=1', 'a#b', 'é', 'a'.repeat(129), 'x\ny']
  for (const b of bad) assert.ok(!CONTAINER_NAME.test(b), `devrait refuser ${JSON.stringify(b)}`)
})

test('isAction : seulement start, stop, restart', () => {
  for (const ok of ['start', 'stop', 'restart']) assert.ok(isAction(ok))
  for (const bad of ['kill', 'exec', 'rm', 'START', '', 'constructor', 'toString', 'start ']) {
    assert.ok(!isAction(bad), `devrait refuser ${JSON.stringify(bad)}`)
  }
})

test('inspect : conteneur en fonctionnement', async () => {
  reset()
  reply = () => ({ status: 200, body: running })
  assert.deepEqual(await inspect('mc'), {
    status: 'running',
    running: true,
    startedAt: '2026-01-01T10:00:00Z',
    health: 'healthy',
    protected: false,
  })
  assert.deepEqual(calls, [{ method: 'GET', url: '/containers/mc/json' }])
})

test('inspect : conteneur arrêté (pas de date de démarrage, pas de healthcheck)', async () => {
  reset()
  reply = () => ({ status: 200, body: exited })
  assert.deepEqual(await inspect('mc'), {
    status: 'exited',
    running: false,
    startedAt: null,
    health: null,
    protected: false,
  })
})

test('inspect : conteneur inexistant (404) -> missing, sans erreur', async () => {
  reset()
  assert.deepEqual(await inspect('absent'), {
    status: 'missing',
    running: false,
    startedAt: null,
    health: null,
    protected: false,
  })
})

test('inspect : réponse sans détails -> unknown', async () => {
  reset()
  reply = () => ({ status: 200, body: {} })
  assert.deepEqual(await inspect('mc'), {
    status: 'unknown',
    running: false,
    startedAt: null,
    health: null,
    protected: false,
  })
})

test('inspect : un conteneur du projet Myprout est marqué protégé, pas ceux d\'un autre projet', async () => {
  reset()
  reply = () => ({ status: 200, body: ofProject('myprout') })
  assert.equal((await inspect('core')).protected, true)
  reply = () => ({ status: 200, body: ofProject('autre-projet') })
  assert.equal((await inspect('mc')).protected, false)
})

test('inspect : le nom est encodé dans l\'URL (pas de remontée de chemin)', async () => {
  reset()
  await inspect('../x')
  assert.equal(calls[0].url, '/containers/..%2Fx/json')
})

test('inspect : réponse Docker en erreur -> DockerError 502', async () => {
  reset()
  reply = () => ({ status: 500 })
  await assert.rejects(inspect('mc'), (e: any) => e instanceof DockerError && e.status === 502 && /500/.test(e.message))
})

test('act : conteneur introuvable -> 404, aucune action envoyée', async () => {
  reset()
  await assert.rejects(act('absent', 'start'), (e: any) => e instanceof DockerError && e.status === 404)
  assert.ok(calls.every((c) => c.method === 'GET'), 'aucun POST')
})

test('act : conteneur Myprout -> 403, aucune action envoyée (le module ne peut pas s\'éteindre lui-même)', async () => {
  reset()
  reply = () => ({ status: 200, body: ofProject('myprout') })
  for (const action of ['start', 'stop', 'restart'] as const) {
    await assert.rejects(act('core-backend', action), (e: any) => e instanceof DockerError && e.status === 403)
  }
  assert.ok(calls.every((c) => c.method === 'GET'), 'aucun POST')
})

test('act : start sans délai d\'arrêt, puis état relu', async () => {
  reset()
  reply = (method) => (method === 'POST' ? { status: 204 } : { status: 200, body: running })
  const state = await act('mc', 'start')
  assert.equal(state.running, true)
  assert.deepEqual(calls, [
    { method: 'GET', url: '/containers/mc/json' },
    { method: 'POST', url: '/containers/mc/start' },
    { method: 'GET', url: '/containers/mc/json' },
  ])
})

test('act : stop et restart laissent 20 s au jeu pour sauvegarder', async () => {
  for (const action of ['stop', 'restart'] as const) {
    reset()
    reply = (method) => (method === 'POST' ? { status: 204 } : { status: 200, body: exited })
    await act('mc', action)
    assert.equal(calls.find((c) => c.method === 'POST')!.url, `/containers/mc/${action}?t=20`)
  }
})

test('act : 304 (déjà dans cet état) est un succès', async () => {
  reset()
  reply = (method) => (method === 'POST' ? { status: 304 } : { status: 200, body: running })
  await assert.doesNotReject(act('mc', 'start'))
})

test('act : refus de Docker (403, 409, 500) -> DockerError 502', async (t) => {
  t.mock.method(console, 'error', () => {}) // l'erreur est journalisée : on évite le bruit
  for (const status of [403, 409, 500]) {
    reset()
    reply = (method) => (method === 'POST' ? { status } : { status: 200, body: exited })
    await assert.rejects(
      act('mc', 'start'),
      (e: any) => e instanceof DockerError && e.status === 502 && e.message.includes(String(status)),
      `statut ${status}`
    )
  }
})

test('serverView : fusionne la fiche du serveur et son état en direct', async () => {
  reset()
  reply = () => ({ status: 200, body: running })
  const view = await serverView({ server_id: 7, name: 'Minecraft', description: 'survie', container: 'mc' })
  assert.deepEqual(view, {
    server_id: 7,
    name: 'Minecraft',
    description: 'survie',
    status: 'running',
    running: true,
    startedAt: '2026-01-01T10:00:00Z',
    health: 'healthy',
    protected: false,
  })
})

test('serverView : une erreur Docker ne casse pas la liste (carte « indisponible »)', async () => {
  reset()
  reply = () => ({ status: 500 })
  const view: any = await serverView({ server_id: 7, name: 'Minecraft', description: null, container: 'mc' })
  assert.equal(view.status, 'unknown')
  assert.equal(view.running, false)
  assert.equal(view.protected, false)
  assert.match(view.error, /500/)
  assert.equal(view.name, 'Minecraft')
})

// En dernier : arrête le faux Docker pour simuler un proxy injoignable
test('Docker injoignable -> DockerError 503, et la liste reste affichable', async () => {
  fake.closeAllConnections()
  await new Promise<void>((resolve) => fake.close(() => resolve()))
  await assert.rejects(inspect('mc'), (e: any) => e instanceof DockerError && e.status === 503)
  await assert.rejects(act('mc', 'start'), (e: any) => e instanceof DockerError && e.status === 503)
  const view: any = await serverView({ server_id: 1, name: 'x', description: null, container: 'mc' })
  assert.equal(view.status, 'unknown')
  assert.match(view.error, /injoignable/)
})
