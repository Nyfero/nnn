// Teste le SDK serveur contre un faux core HTTP.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import express from 'express'
import {
  coreAuth,
  registerModule,
  requireModuleSecret,
} from '../src/server/index.js'

const listen = (server) =>
  new Promise((r) =>
    server.listen(0, '127.0.0.1', () => r(server.address().port))
  )

function fakeCore() {
  const calls = { introspect: 0, register: [] }
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const send = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
      }
      if (req.url === '/api/core/introspect') {
        calls.introspect++
        if (req.headers['x-module-secret'] !== 's3cret') return send(401, {})
        const t = req.headers.authorization
        if (t === 'Bearer good') {
          return send(200, {
            active: true,
            user_id: 7,
            email: 'a@b.fr',
            firstName: 'A',
            lastName: 'B',
            isAdmin: false,
          })
        }
        if (t === 'Bearer noaccess') return send(403, { error: 'non' })
        return send(401, { active: false })
      }
      if (req.url === '/api/core/modules/register') {
        calls.register.push({ headers: req.headers, body: JSON.parse(body) })
        return send(200, { ok: true })
      }
      send(404, {})
    })
  })
  return { server, calls }
}

test('coreAuth : accepte, refuse, cache et transmet les codes', async () => {
  const core = fakeCore()
  const corePort = await listen(core.server)

  const app = express()
  app.get(
    '/me',
    coreAuth({
      coreUrl: `http://127.0.0.1:${corePort}`,
      moduleId: 'passwords',
      moduleSecret: 's3cret',
    }),
    (req, res) => res.json(req.user)
  )
  const appPort = await listen(http.createServer(app))
  const call = (token) =>
    fetch(`http://127.0.0.1:${appPort}/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

  assert.equal((await call()).status, 401)

  const ok = await call('good')
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).user_id, 7)

  await call('good') // servi par le cache
  assert.equal(core.calls.introspect, 1)

  const bad = await call('bad')
  assert.equal(bad.status, 401)
  assert.equal((await bad.json()).code, 'TOKEN_INVALID')

  assert.equal((await call('noaccess')).status, 403)
  core.server.close()
})

test('coreAuth : core injoignable -> 503', async () => {
  const app = express()
  app.get(
    '/me',
    coreAuth({
      coreUrl: 'http://127.0.0.1:1',
      moduleId: 'm',
      moduleSecret: 'x',
    }),
    (_q, r) => r.end()
  )
  const port = await listen(http.createServer(app))
  const res = await fetch(`http://127.0.0.1:${port}/me`, {
    headers: { Authorization: 'Bearer x' },
  })
  assert.equal(res.status, 503)
})

test('registerModule : envoie id, secret et manifeste', async () => {
  const core = fakeCore()
  const port = await listen(core.server)
  const reg = registerModule({
    coreUrl: `http://127.0.0.1:${port}`,
    id: 'passwords',
    secret: 's3cret',
    name: 'Mots de passe',
    icon: 'security',
    path: '/passwords',
    version: '1.0.0',
    internalUrl: 'http://passwords-backend:3000',
    log: { log() {}, warn() {} },
  })
  await new Promise((r) => setTimeout(r, 200))
  reg.stop()
  core.server.close()

  assert.equal(core.calls.register.length, 1)
  const { headers, body } = core.calls.register[0]
  assert.equal(headers['x-module-id'], 'passwords')
  assert.equal(headers['x-module-secret'], 's3cret')
  assert.deepEqual(body, {
    name: 'Mots de passe',
    icon: 'security',
    path: '/passwords',
    version: '1.0.0',
    internal_url: 'http://passwords-backend:3000',
  })
})

test('requireModuleSecret : refuse un mauvais secret', async () => {
  const app = express()
  app.delete('/x', requireModuleSecret('s3cret'), (_q, r) =>
    r.json({ ok: true })
  )
  const port = await listen(http.createServer(app))
  const url = `http://127.0.0.1:${port}/x`
  assert.equal((await fetch(url, { method: 'DELETE' })).status, 401)
  assert.equal(
    (
      await fetch(url, {
        method: 'DELETE',
        headers: { 'X-Module-Secret': 'nope' },
      })
    ).status,
    401
  )
  assert.equal(
    (
      await fetch(url, {
        method: 'DELETE',
        headers: { 'X-Module-Secret': 's3cret' },
      })
    ).status,
    200
  )
})
