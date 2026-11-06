import test from 'node:test'
import assert from 'node:assert/strict'
import { parseServerBody } from '../src/utils/validation'

const valid = { name: 'Minecraft', container: 'mc-server', description: 'Survie entre amis', user_ids: [1, 2, 3] }

test('parseServerBody : corps valide', () => {
  assert.deepEqual(parseServerBody(valid), valid)
})

test('parseServerBody : nettoyage des espaces et dédoublonnage des utilisateurs', () => {
  assert.deepEqual(
    parseServerBody({ name: '  Minecraft ', container: ' mc ', description: ' survie ', user_ids: [1, 2, 2, 3, 1] }),
    { name: 'Minecraft', container: 'mc', description: 'survie', user_ids: [1, 2, 3] }
  )
})

test('parseServerBody : description facultative (null si absente, vide ou non textuelle)', () => {
  for (const d of [undefined, null, '', '   ', 42, {}]) {
    assert.equal(parseServerBody({ ...valid, description: d })?.description, null, `description ${JSON.stringify(d)}`)
  }
})

test('parseServerBody : liste d\'utilisateurs facultative', () => {
  assert.deepEqual(parseServerBody({ name: 'a', container: 'b' })?.user_ids, [])
  assert.deepEqual(parseServerBody({ ...valid, user_ids: 'pas un tableau' })?.user_ids, [])
  assert.deepEqual(parseServerBody({ ...valid, user_ids: [] })?.user_ids, [])
})

test('parseServerBody : bornes (nom 100, description 255, 500 utilisateurs)', () => {
  assert.ok(parseServerBody({ ...valid, name: 'x'.repeat(100) }))
  assert.equal(parseServerBody({ ...valid, name: 'x'.repeat(101) }), null)

  assert.ok(parseServerBody({ ...valid, description: 'x'.repeat(255) }))
  assert.equal(parseServerBody({ ...valid, description: 'x'.repeat(256) }), null)

  const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
  assert.ok(parseServerBody({ ...valid, user_ids: ids(500) }))
  assert.equal(parseServerBody({ ...valid, user_ids: ids(501) }), null)
})

test('parseServerBody : nom obligatoire', () => {
  for (const bad of ['', '   ', undefined, null, 7, ['a']]) {
    assert.equal(parseServerBody({ ...valid, name: bad }), null, `nom ${JSON.stringify(bad)}`)
  }
})

test('parseServerBody : nom de conteneur strictement contrôlé', () => {
  for (const bad of ['', '  ', undefined, null, 7, '../etc', 'a/b', 'a b', '-x', 'a;rm -rf /', 'a'.repeat(129)]) {
    assert.equal(parseServerBody({ ...valid, container: bad }), null, `conteneur ${JSON.stringify(bad)}`)
  }
})

test('parseServerBody : identifiants d\'utilisateurs = entiers strictement positifs', () => {
  for (const bad of [0, -1, 1.5, '1', null, NaN, Infinity, {}, [1]]) {
    assert.equal(parseServerBody({ ...valid, user_ids: [1, bad] }), null, `id ${JSON.stringify(bad)}`)
  }
})

test('parseServerBody : corps absent ou de mauvais type', () => {
  for (const bad of [undefined, null, 'texte', 42, [], true]) {
    assert.equal(parseServerBody(bad), null, `corps ${JSON.stringify(bad)}`)
  }
})

test('parseServerBody : seuls les champs autorisés sortent', () => {
  const out = parseServerBody({ ...valid, server_id: 99, created_at: 'x', permissions: [] })
  assert.deepEqual(Object.keys(out!).sort(), ['container', 'description', 'name', 'user_ids'])
})
