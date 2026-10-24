// Vérifie que la crypto client et la crypto serveur (seed admin) sont interopérables.
// Lancer : npm test -w packages/sdk   (utilise tsx pour importer le TypeScript du core)
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {
  createVault,
  decryptMasterKeyHex,
  recoverMasterKeyHex,
  rewrapForNewPassword,
  VaultError,
} from '../src/client/vault.js'
import { importMasterKey, deriveModuleKey } from '../src/client/crypto.js'
import {
  deriveKek as serverKek,
  encryptKey as serverEncrypt,
  generateMasterKey,
  generateSalt,
} from '../../../core/backend/src/utils/crypto.ts'

const ANSWERS = ['Rex', 'Lyon', 'Paul']
const user = (v) => ({
  kek_salt: v.kek_salt,
  encrypted_master_key: v.encrypted_master_key,
})

function serverDecrypt(blob, kek) {
  const [iv, tag, ct] = blob.split(':').map((h) => Buffer.from(h, 'hex'))
  const d = crypto.createDecipheriv('aes-256-gcm', kek, iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString('hex')
}

test('createVault : les deux blobs contiennent la même clé maître', async () => {
  const v = await createVault('Secret!123', ANSWERS)
  const a = await decryptMasterKeyHex('Secret!123', user(v))
  const b = await recoverMasterKeyHex(ANSWERS, v)
  assert.equal(a, b)
  assert.equal(a.length, 64)
})

test('mauvais mot de passe / mauvaises réponses : erreur', async () => {
  const v = await createVault('Secret!123', ANSWERS)
  await assert.rejects(decryptMasterKeyHex('autre', user(v)), VaultError)
  await assert.rejects(recoverMasterKeyHex(['a', 'b', 'c'], v), VaultError)
})

test('la normalisation des réponses ignore casse et espaces', async () => {
  const v = await createVault('pw', ANSWERS)
  const hex = await recoverMasterKeyHex([' REX ', 'ly on', 'PAUL'], v)
  assert.equal(hex, await decryptMasterKeyHex('pw', user(v)))
})

test('client -> serveur : le serveur déchiffre un blob client', async () => {
  const v = await createVault('Secret!123', ANSWERS)
  const kek = await serverKek('Secret!123', Buffer.from(v.kek_salt, 'hex'))
  assert.equal(
    serverDecrypt(v.encrypted_master_key, kek),
    await decryptMasterKeyHex('Secret!123', user(v))
  )
})

test('serveur -> client : le client déchiffre le blob du seed admin', async () => {
  const masterKey = generateMasterKey()
  const kek_salt = generateSalt()
  const kek = await serverKek('AdminPw!1', Buffer.from(kek_salt, 'hex'))
  const encrypted_master_key = serverEncrypt(masterKey, kek)
  assert.equal(
    await decryptMasterKeyHex('AdminPw!1', { kek_salt, encrypted_master_key }),
    masterKey
  )
})

test('changement de mot de passe : même clé maître, nouveau sel', async () => {
  const v = await createVault('ancien', ANSWERS)
  const next = await rewrapForNewPassword('ancien', 'nouveau', user(v))
  assert.notEqual(next.kek_salt, v.kek_salt)
  assert.equal(
    await decryptMasterKeyHex('nouveau', next),
    await decryptMasterKeyHex('ancien', user(v))
  )
  await assert.rejects(rewrapForNewPassword('faux', 'x', user(v)), VaultError)
})

test('HKDF : clés de module déterministes, distinctes entre modules', async () => {
  const hex = generateMasterKey()
  const master = await importMasterKey(hex)
  assert.equal(master.extractable, false)

  const enc = async (key) => {
    const iv = new Uint8Array(12)
    return Buffer.from(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode('test')
      )
    ).toString('hex')
  }
  const a1 = await enc(await deriveModuleKey(master, 'passwords'))
  const a2 = await enc(
    await deriveModuleKey(await importMasterKey(hex), 'passwords')
  )
  const b = await enc(await deriveModuleKey(master, 'files'))
  assert.equal(a1, a2)
  assert.notEqual(a1, b)
})
