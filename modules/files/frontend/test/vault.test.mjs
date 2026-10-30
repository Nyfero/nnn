import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHUNK, OVERHEAD, createVaultSecret, decryptFile, decryptName, encryptedSize, encryptFile,
  encryptName, nameKey, openVault, plainSize, sealName,
} from '../src/utils/vault.js'

const moduleKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
const newVault = async (mk) => openVault(await createVaultSecret(mk), mk)
const fileOf = (size) => {
  const data = new Uint8Array(size)
  for (let i = 0; i < size; i += 65536) crypto.getRandomValues(data.subarray(i, Math.min(size, i + 65536)))
  return new File([data], 'x.bin')
}
const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer())

test('clé du coffre : rechargeable avec la clé du module, illisible avec une autre', async () => {
  const mk = await moduleKey()
  const wrapped = await createVaultSecret(mk)
  const v1 = await openVault(wrapped, mk)
  const v2 = await openVault(wrapped, mk)
  assert.equal(await nameKey(v1, 'a'), await nameKey(v2, 'a'))
  await assert.rejects(openVault(wrapped, await moduleKey()))
})

test('noms : chiffrés (IV aléatoire), déchiffrables, index stable et propre à chaque coffre', async () => {
  const mk = await moduleKey()
  const v = await newVault(mk)
  const a = await encryptName(v, 'Impôts 2026.pdf')
  const b = await encryptName(v, 'Impôts 2026.pdf')
  assert.notEqual(a, b)
  assert.equal(await decryptName(v, a), 'Impôts 2026.pdf')
  assert.ok(!a.includes('Imp'))
  assert.equal(await nameKey(v, 'Rapport'), await nameKey(v, '  rapport'.trim()))
  assert.equal(await nameKey(v, 'É'), await nameKey(v, 'é'), 'insensible à la casse comme le reste du module')
  assert.notEqual(await nameKey(v, 'Rapport'), await nameKey(await newVault(mk), 'Rapport'))
  assert.match((await sealName(v, 'x')).name_key, /^[0-9a-f]{64}$/)
  await assert.rejects(encryptName(v, 'x'.repeat(201)))
})

test('tailles : encryptedSize et plainSize sont inverses', () => {
  for (const p of [0, 1, 100, CHUNK - 1, CHUNK, CHUNK + 1, 3 * CHUNK, 3 * CHUNK + 5]) {
    assert.equal(plainSize(encryptedSize(p)), p, `taille ${p}`)
  }
  assert.equal(encryptedSize(0), OVERHEAD)
})

test('fichiers : aller-retour (vide, petit, multi-blocs) avec taille annoncée exacte', async () => {
  const v = await newVault(await moduleKey())
  for (const size of [0, 1, 1000, CHUNK, CHUNK + 1, 2 * CHUNK + 123]) {
    const f = fileOf(size)
    const enc = await encryptFile(v, f)
    assert.equal(enc.size, encryptedSize(size))
    const dec = await decryptFile(v, enc.stream(), enc.size)
    assert.deepEqual(await bytes(dec), await bytes(f), `taille ${size}`)
  }
})

test('fichiers : altération, troncature, réordonnancement et mauvaise clé détectés', async () => {
  const mk = await moduleKey()
  const v = await newVault(mk)
  const enc = await encryptFile(v, fileOf(2 * CHUNK + 50))
  const raw = await bytes(enc)
  const full = CHUNK + OVERHEAD
  const run = (data, size = data.length, vault = v) => decryptFile(vault, new Blob([data]).stream(), size)

  const flipped = raw.slice()
  flipped[100] ^= 1
  await assert.rejects(run(flipped), /Déchiffrement impossible/)

  // dernier bloc retiré : la taille annoncée suit, mais le bloc n°1 n'est pas marqué « dernier »
  await assert.rejects(run(raw.slice(0, 2 * full)), /Déchiffrement impossible/)

  // blocs 0 et 1 échangés
  const swapped = raw.slice()
  swapped.set(raw.slice(full, 2 * full), 0)
  swapped.set(raw.slice(0, full), full)
  await assert.rejects(run(swapped), /Déchiffrement impossible/)

  // flux plus court que la taille annoncée
  await assert.rejects(run(raw.slice(0, raw.length - 10), raw.length), /tronqué/)
  // autre coffre
  await assert.rejects(run(raw, raw.length, await newVault(mk)), /Déchiffrement impossible/)
})
