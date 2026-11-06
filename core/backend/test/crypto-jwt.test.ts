import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import { decodeKeyBlob } from './helpers'
import { deriveKek, encryptKey, generateMasterKey, generateSalt } from '../src/utils/crypto'
import { isKeyBlob, isSalt } from '../src/utils/validators'
import { TTL } from '../src/config'

// Clés RSA jetables écrites dans un dossier temporaire : jwt.ts les lit à la première utilisation
const keypair = () =>
  crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
const main = keypair()
const other = keypair()
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myprout-jwt-test-'))
fs.writeFileSync(path.join(dir, 'private.pem'), main.privateKey)
fs.writeFileSync(path.join(dir, 'public.pem'), main.publicKey)
process.env.JWT_PRIVATE_KEY_PATH = path.join(dir, 'private.pem')
process.env.JWT_PUBLIC_KEY_PATH = path.join(dir, 'public.pem')
after(() => fs.rmSync(dir, { recursive: true, force: true }))

const { signAccessToken, verifyAccessToken, randomToken, hashToken, safeEqual } = await import('../src/utils/jwt')

const b64url = (v: unknown) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')

// ── Jetons d'accès ───────────────────────────────────────────────────────────

test('jeton d\'accès : signé en RS256, relu avec user_id et sid, expire après 15 min', () => {
  const token = signAccessToken({ user_id: 7, sid: 12 })
  assert.deepEqual(verifyAccessToken(token), { user_id: 7, sid: 12 })
  const { header, payload } = jwt.decode(token, { complete: true }) as any
  assert.equal(header.alg, 'RS256')
  assert.equal(payload.exp - payload.iat, TTL.ACCESS_SECONDS)
})

test('jeton d\'accès : charge falsifiée (autre user_id, signature conservée) refusée', () => {
  const [h, , s] = signAccessToken({ user_id: 7, sid: 1 }).split('.')
  const forged = `${h}.${b64url({ user_id: 1, sid: 1, iat: 1, exp: 9_999_999_999 })}.${s}`
  assert.throws(() => verifyAccessToken(forged))
})

test('jeton d\'accès : signé avec une autre clé refusé', () => {
  const token = jwt.sign({ user_id: 1, sid: 1 }, other.privateKey, { algorithm: 'RS256', expiresIn: 60 })
  assert.throws(() => verifyAccessToken(token))
})

test('jeton d\'accès : algorithme "none" refusé', () => {
  const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ user_id: 1, sid: 1 })}.`
  assert.throws(() => verifyAccessToken(token))
})

test('jeton d\'accès : confusion RS256/HS256 (clé publique utilisée comme secret HMAC) refusée', () => {
  const head = b64url({ alg: 'HS256', typ: 'JWT' })
  const body = b64url({ user_id: 1, sid: 1, exp: 9_999_999_999 })
  const sig = crypto.createHmac('sha256', main.publicKey).update(`${head}.${body}`).digest('base64url')
  assert.throws(() => verifyAccessToken(`${head}.${body}.${sig}`))
})

test('jeton d\'accès : seul RS256 est accepté (même clé, autre algorithme RSA refusé)', () => {
  for (const algorithm of ['RS384', 'RS512'] as const) {
    const token = jwt.sign({ user_id: 1, sid: 1 }, main.privateKey, { algorithm, expiresIn: 60 })
    assert.throws(() => verifyAccessToken(token), /algorithm/i, algorithm)
  }
})

test('jeton d\'accès : expiré refusé', () => {
  const token = jwt.sign({ user_id: 1, sid: 1 }, main.privateKey, { algorithm: 'RS256', expiresIn: -10 })
  assert.throws(() => verifyAccessToken(token), /expired/i)
})

test('jeton d\'accès : chaînes invalides refusées', () => {
  for (const bad of ['', 'abc', 'a.b.c', 'a.b', '....']) assert.throws(() => verifyAccessToken(bad), `jeton ${JSON.stringify(bad)}`)
})

// ── Jetons opaques ───────────────────────────────────────────────────────────

test('randomToken : 64 caractères hexadécimaux, jamais deux fois le même', () => {
  const tokens = new Set(Array.from({ length: 200 }, () => randomToken()))
  assert.equal(tokens.size, 200)
  for (const t of tokens) assert.match(t, /^[0-9a-f]{64}$/)
})

test('hashToken : SHA-256 déterministe, différent du jeton', () => {
  const t = randomToken()
  assert.equal(hashToken(t), hashToken(t))
  assert.notEqual(hashToken(t), t)
  assert.notEqual(hashToken(t), hashToken(randomToken()))
  assert.equal(hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('safeEqual : égalité exacte, longueurs différentes refusées sans erreur', () => {
  assert.ok(safeEqual('secret', 'secret'))
  assert.ok(!safeEqual('secret', 'Secret'))
  assert.ok(!safeEqual('secret', 'secre'))
  assert.ok(!safeEqual('', 'a'))
  assert.ok(safeEqual('', ''))
})

// ── Clé maître : formats identiques au client ────────────────────────────────

test('generateSalt et generateMasterKey : 32 octets aléatoires en hexadécimal', () => {
  const salt = generateSalt()
  const key = generateMasterKey()
  assert.ok(isSalt(salt))
  assert.match(key, /^[0-9a-f]{64}$/)
  assert.notEqual(generateSalt(), salt)
  assert.notEqual(generateMasterKey(), key)
})

test('deriveKek : 32 octets, déterministe, dépend du mot de passe et du sel', async () => {
  const salt = Buffer.from(generateSalt(), 'hex')
  const a = await deriveKek('mot de passe', salt)
  assert.equal(a.length, 32)
  assert.deepEqual(a, await deriveKek('mot de passe', salt))
  assert.notDeepEqual(a, await deriveKek('autre mot de passe', salt))
  assert.notDeepEqual(a, await deriveKek('mot de passe', Buffer.from(generateSalt(), 'hex')))
})

test('encryptKey : format iv:tag:chiffré accepté par le validateur, relisible avec la bonne KEK seulement', async () => {
  const salt = Buffer.from(generateSalt(), 'hex')
  const kek = await deriveKek('mot de passe', salt)
  const masterKey = generateMasterKey()

  const blob = encryptKey(masterKey, kek)
  assert.ok(isKeyBlob(blob), 'le blob doit passer isKeyBlob (contrat avec le client)')
  assert.equal(decodeKeyBlob(blob, kek), masterKey)

  assert.throws(() => decodeKeyBlob(blob, crypto.randomBytes(32)), 'mauvaise KEK')
  const [iv, tag, enc] = blob.split(':')
  const flipped = `${iv}:${tag}:${(parseInt(enc[0], 16) ^ 1).toString(16)}${enc.slice(1)}`
  assert.throws(() => decodeKeyBlob(flipped, kek), 'chiffré modifié (intégrité GCM)')
})

test('encryptKey : IV aléatoire, donc deux blobs différents pour la même clé', async () => {
  const kek = await deriveKek('x', Buffer.from(generateSalt(), 'hex'))
  const key = generateMasterKey()
  assert.notEqual(encryptKey(key, kek), encryptKey(key, kek))
})
