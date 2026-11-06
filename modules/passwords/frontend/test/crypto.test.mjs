import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptPassword, encryptPassword } from '../src/utils/crypto.js'

// Même type de clé que getModuleKey : AES-GCM 256 bits non extractable
const newKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
const b64bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes))

test('chiffrer puis déchiffrer rend le texte d\'origine', async () => {
  const key = await newKey()
  for (const text of ['hunter2', 'x', 'Pässwörd ☃ 🔑 日本語', 'a b\tc\nd', '"; DROP TABLE passwords;--']) {
    assert.equal(await decryptPassword(await encryptPassword(text, key), key), text)
  }
})

test('chaîne vide et long mot de passe', async () => {
  const key = await newKey()
  assert.equal(await decryptPassword(await encryptPassword('', key), key), '')
  const long = 'é'.repeat(3000)
  assert.equal(await decryptPassword(await encryptPassword(long, key), key), long)
})

test('le chiffré est du base64 qui ne contient pas le clair', async () => {
  const key = await newKey()
  const secret = 'SuperSecret-12345'
  const encrypted = await encryptPassword(secret, key)
  assert.match(encrypted, /^[A-Za-z0-9+/]+={0,2}$/)
  assert.ok(!encrypted.includes(secret))
  assert.ok(!Buffer.from(encrypted, 'base64').toString('latin1').includes(secret))
})

test('format : IV de 12 octets + texte chiffré + tag GCM de 16 octets', async () => {
  const key = await newKey()
  const text = 'abcdef'
  const bytes = b64bytes(await encryptPassword(text, key))
  assert.equal(bytes.length, 12 + new TextEncoder().encode(text).length + 16)
})

test('IV aléatoire : deux chiffrements du même texte diffèrent', async () => {
  const key = await newKey()
  const a = await encryptPassword('même texte', key)
  const b = await encryptPassword('même texte', key)
  assert.notEqual(a, b)
  assert.notDeepEqual(b64bytes(a).slice(0, 12), b64bytes(b).slice(0, 12))
})

test('une autre clé (autre module ou autre utilisateur) ne peut pas déchiffrer', async () => {
  const encrypted = await encryptPassword('secret', await newKey())
  await assert.rejects(decryptPassword(encrypted, await newKey()))
})

test('un chiffré modifié est refusé (intégrité GCM)', async () => {
  const key = await newKey()
  const bytes = b64bytes(await encryptPassword('secret', key))
  for (const index of [0, 12, bytes.length - 1]) {
    const tampered = bytes.slice()
    tampered[index] ^= 0x01
    await assert.rejects(decryptPassword(toB64(tampered), key), `octet ${index} modifié`)
  }
})

test('un chiffré tronqué ou invalide est refusé', async () => {
  const key = await newKey()
  const bytes = b64bytes(await encryptPassword('secret', key))
  await assert.rejects(decryptPassword(toB64(bytes.slice(0, bytes.length - 1)), key))
  await assert.rejects(decryptPassword(toB64(bytes.slice(0, 12)), key))
  await assert.rejects(decryptPassword('', key))
  await assert.rejects(decryptPassword('pas du base64 !!!', key))
})
