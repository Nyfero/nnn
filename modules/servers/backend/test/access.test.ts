import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleTo } from '../src/utils/access'
import { requireAdmin } from '../src/middlewares/requireAdmin'
import { ah, parseId } from '../src/utils/http'

// Faux objets Express minimaux
const fakeRes = () => {
  const res: any = { statusCode: 200, body: undefined }
  res.status = (code: number) => ((res.statusCode = code), res)
  res.json = (body: unknown) => ((res.body = body), res)
  return res
}

test('visibleTo : l\'admin voit tous les serveurs (aucun filtre)', () => {
  assert.deepEqual(visibleTo({ user_id: 1, isAdmin: true }), {})
})

test('visibleTo : un utilisateur ne voit que les serveurs où il a une permission', () => {
  assert.deepEqual(visibleTo({ user_id: 42, isAdmin: false }), { permissions: { some: { user_id: 42 } } })
})

test('visibleTo : le filtre dépend de l\'utilisateur demandé (pas d\'état partagé)', () => {
  const a = visibleTo({ user_id: 1, isAdmin: false })
  const b = visibleTo({ user_id: 2, isAdmin: false })
  assert.equal((a as any).permissions.some.user_id, 1)
  assert.equal((b as any).permissions.some.user_id, 2)
})

test('requireAdmin : refuse sans utilisateur ou sans droit admin (403)', () => {
  for (const user of [undefined, null, {}, { isAdmin: false }, { isAdmin: 0 }, { isAdmin: undefined }]) {
    const res = fakeRes()
    let nextCalled = false
    requireAdmin({ user } as any, res, () => { nextCalled = true })
    assert.equal(res.statusCode, 403, `user ${JSON.stringify(user)}`)
    assert.equal(nextCalled, false)
    assert.match(res.body.error, /administrateurs/)
  }
})

test('requireAdmin : laisse passer un admin', () => {
  const res = fakeRes()
  let nextCalled = false
  requireAdmin({ user: { user_id: 1, isAdmin: true } } as any, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

test('parseId : entiers strictement positifs seulement', () => {
  assert.equal(parseId('7'), 7)
  for (const bad of ['0', '-3', '2.5', 'abc', '', undefined, 'NaN']) {
    assert.equal(parseId(bad), null, `devrait refuser ${String(bad)}`)
  }
})

test('ah : transmet à next() une erreur levée dans un gestionnaire asynchrone', async () => {
  const boom = new Error('boom')
  let received: unknown
  ah(async () => { throw boom })({} as any, {} as any, (e?: unknown) => { received = e })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(received, boom)
})

test('ah : sans erreur, next() n\'est pas appelé', async () => {
  let called = false
  ah(async () => 'ok')({} as any, {} as any, () => { called = true })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(called, false)
})
