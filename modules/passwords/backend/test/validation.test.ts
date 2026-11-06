import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMAIN, optStr, parseBody, parseId } from '../src/utils/validation'

const valid = { title: 'GitHub', username: 'moi@example.com', password: 'AAAA', note: 'perso' }

test('parseId : accepte les entiers strictement positifs', () => {
  assert.equal(parseId('1'), 1)
  assert.equal(parseId('42'), 42)
})

test('parseId : refuse tout le reste', () => {
  for (const bad of ['0', '-1', '1.5', 'abc', '', undefined, 'NaN', 'Infinity']) {
    assert.equal(parseId(bad), null, `devrait refuser ${String(bad)}`)
  }
})

test('optStr : chaîne, absence et invalide', () => {
  assert.equal(optStr('abc', 5), 'abc')
  assert.equal(optStr('', 5), '')
  assert.equal(optStr('x'.repeat(5), 5), 'x'.repeat(5), 'longueur maximale acceptée')
  assert.equal(optStr('x'.repeat(6), 5), undefined, 'trop long')
  assert.equal(optStr(null, 5), null)
  assert.equal(optStr(undefined, 5), null)
  for (const bad of [42, true, {}, [], ['a']]) {
    assert.equal(optStr(bad, 5), undefined, `devrait refuser ${JSON.stringify(bad)}`)
  }
})

test('parseBody : corps valide', () => {
  assert.deepEqual(parseBody(valid), valid)
})

test('parseBody : username et note facultatifs (null)', () => {
  assert.deepEqual(parseBody({ title: 'a', password: 'b' }), {
    title: 'a',
    username: null,
    password: 'b',
    note: null,
  })
  assert.equal(parseBody({ ...valid, username: null, note: null })?.username, null)
})

test('parseBody : le titre est nettoyé et ne peut pas être vide', () => {
  assert.equal(parseBody({ ...valid, title: '  GitHub  ' })?.title, 'GitHub')
  for (const bad of ['', '   ', '\n\t', undefined, null, 12, {}]) {
    assert.equal(parseBody({ ...valid, title: bad }), null, `titre ${JSON.stringify(bad)}`)
  }
})

test('parseBody : bornes de longueur (titre 191, mot de passe chiffré 8192, identifiant 191, note 2000)', () => {
  assert.ok(parseBody({ ...valid, title: 'x'.repeat(191) }))
  assert.equal(parseBody({ ...valid, title: 'x'.repeat(192) }), null)

  assert.ok(parseBody({ ...valid, password: 'x'.repeat(8192) }))
  assert.equal(parseBody({ ...valid, password: 'x'.repeat(8193) }), null)

  assert.ok(parseBody({ ...valid, username: 'x'.repeat(191) }))
  assert.equal(parseBody({ ...valid, username: 'x'.repeat(192) }), null)

  assert.ok(parseBody({ ...valid, note: 'x'.repeat(2000) }))
  assert.equal(parseBody({ ...valid, note: 'x'.repeat(2001) }), null)
})

test('parseBody : le mot de passe (chiffré) est obligatoire et doit être une chaîne', () => {
  for (const bad of ['', undefined, null, 123, ['a'], {}]) {
    assert.equal(parseBody({ ...valid, password: bad }), null, `password ${JSON.stringify(bad)}`)
  }
})

test('parseBody : types invalides pour username et note', () => {
  for (const bad of [42, true, {}, ['a']]) {
    assert.equal(parseBody({ ...valid, username: bad }), null, `username ${JSON.stringify(bad)}`)
    assert.equal(parseBody({ ...valid, note: bad }), null, `note ${JSON.stringify(bad)}`)
  }
})

test('parseBody : corps absent ou de mauvais type', () => {
  for (const bad of [undefined, null, 'texte', 42, [], true]) {
    assert.equal(parseBody(bad), null, `corps ${JSON.stringify(bad)}`)
  }
})

test('parseBody : seuls les champs autorisés sortent (pas de user_id ni de password_id injectés)', () => {
  const out = parseBody({
    ...valid,
    user_id: 999,
    password_id: 1,
    is_stared: true,
    is_deleted: true,
    created_at: '2000-01-01',
  })
  assert.deepEqual(Object.keys(out!).sort(), ['note', 'password', 'title', 'username'])
})

test('parseBody : ne laisse pas passer un titre en tableau ou objet qui se convertit en chaîne', () => {
  assert.equal(parseBody({ ...valid, title: ['GitHub'] }), null)
  assert.equal(parseBody({ ...valid, title: { toString: () => 'x' } }), null)
})

test('DOMAIN : accepte des noms de domaine usuels (en minuscules)', () => {
  for (const ok of ['example.com', 'sub.example.co.uk', 'my-site.fr', 'a1.io', 'xn--nxasmq6b.com']) {
    assert.ok(DOMAIN.test(ok), `devrait accepter ${ok}`)
  }
})

test('DOMAIN : refuse ce qui ne serait pas un simple nom de domaine (pas de détournement de requête)', () => {
  const bad = [
    '',
    'localhost',
    'example',
    'a.b',
    'example.com/path',
    'example.com:8080',
    'user@example.com',
    'example.com?token=x',
    'example.com#frag',
    'http://example.com',
    'exa mple.com',
    'example..com',
    '.example.com',
    '127.0.0.1',
    'Example.COM',
    `${'a'.repeat(250)}.com`,
  ]
  for (const b of bad) assert.ok(!DOMAIN.test(b), `devrait refuser ${JSON.stringify(b)}`)
})

test('DOMAIN : sans état entre deux appels (pas de drapeau g)', () => {
  assert.ok(DOMAIN.test('example.com'))
  assert.ok(DOMAIN.test('example.com'))
  assert.ok(!DOMAIN.global && !DOMAIN.sticky)
})
