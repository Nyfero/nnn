import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSize } from '../src/utils/size'
import { cleanName, cleanEncName, cleanNameKey, cleanWrappedKey, numberedName, mimeFor, INLINE_SAFE } from '../src/utils/names'
import { signTicket, verifyTicket } from '../src/utils/tickets'

test('parseSize : unités et valeurs par défaut', () => {
  assert.equal(parseSize('5GB', 0), 5 * 1024 ** 3)
  assert.equal(parseSize('500 mb', 0), 500 * 1024 ** 2)
  assert.equal(parseSize('1.5TiB', 0), 1.5 * 1024 ** 4)
  assert.equal(parseSize('1024', 0), 1024)
  assert.equal(parseSize(undefined, 42), 42)
  assert.throws(() => parseSize('beaucoup', 0))
})

test('cleanName : refuse chemins et caractères de contrôle', () => {
  assert.equal(cleanName('  rapport.pdf '), 'rapport.pdf')
  for (const bad of ['', '.', '..', 'a/b', 'a\\b', 'a\u0000b', 'x'.repeat(256), 42, null]) {
    assert.throws(() => cleanName(bad), `devrait refuser ${String(bad)}`)
  }
})

test('numberedName', () => {
  assert.equal(numberedName('photo.jpg', 0), 'photo.jpg')
  assert.equal(numberedName('photo.jpg', 2), 'photo (2).jpg')
  assert.equal(numberedName('Makefile', 1), 'Makefile (1)')
})

test('mime : déduit de l\'extension, HTML et SVG jamais affichés en ligne', () => {
  assert.equal(mimeFor('a.PNG'), 'image/png')
  assert.equal(mimeFor('a.inconnu'), 'application/octet-stream')
  assert.ok(!INLINE_SAFE.has(mimeFor('x.html')))
  assert.ok(!INLINE_SAFE.has(mimeFor('x.svg')))
  assert.ok(INLINE_SAFE.has(mimeFor('x.mp4')))
})

test('tickets : signature, expiration, falsification', () => {
  const t = signTicket({ n: 7, u: 3, i: true }, 1000, 'secret', 1_000)
  assert.deepEqual(verifyTicket(t, 'secret', 1_500), { n: 7, u: 3, i: true, e: 2_000 })
  assert.equal(verifyTicket(t, 'secret', 2_001), null, 'expiré')
  assert.equal(verifyTicket(t, 'autre', 1_500), null, 'mauvais secret')
  const [body, sig] = t.split('.')
  const forged = Buffer.from(JSON.stringify({ n: 8, u: 3, i: true, e: 9e15 })).toString('base64url')
  assert.equal(verifyTicket(`${forged}.${sig}`, 'secret', 1_500), null, 'corps modifié')
  assert.equal(verifyTicket(body, 'secret', 1_500), null)
  assert.equal(verifyTicket('a.b.c', 'secret'), null)
})

test('coffres : le serveur n\'accepte que des noms chiffrés bien formés', () => {
  const blob = 'A'.repeat(60)
  assert.equal(cleanEncName(blob), blob)
  for (const bad of ['court', 'a b'.repeat(20), 'é'.repeat(50), 'A'.repeat(1537), 7, null]) assert.throws(() => cleanEncName(bad))
  assert.equal(cleanNameKey('a'.repeat(64)), 'a'.repeat(64))
  for (const bad of ['A'.repeat(64), 'a'.repeat(63), '', null]) assert.throws(() => cleanNameKey(bad))
  assert.equal(cleanWrappedKey('B'.repeat(80)), 'B'.repeat(80))
  assert.throws(() => cleanWrappedKey('B'.repeat(10)))
})
