import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isKeyBlob,
  isQA,
  isQuestionList,
  isSalt,
  isStr,
  normalizeAnswer,
  normalizeEmail,
} from '../src/utils/validators'
// Le client (navigateur) et le serveur doivent normaliser les réponses de la même façon,
// sinon la clé de récupération dérivée des réponses ne serait plus retrouvée.
import { normalizeAnswer as clientNormalizeAnswer } from '../../../packages/sdk/src/client/crypto.js'
import { SECURITY_QUESTION_COUNT, TTL } from '../src/config'

const hex = (n: number) => 'ab'.repeat(n / 2)

test('isSalt : 64 caractères hexadécimaux en minuscules', () => {
  assert.ok(isSalt(hex(64)))
  assert.ok(isSalt('0123456789abcdef'.repeat(4)))
  for (const bad of [hex(62), hex(66), 'AB'.repeat(32), 'g'.repeat(64), `${hex(64)}\n`, '', null, undefined, 42, {}]) {
    assert.ok(!isSalt(bad), `devrait refuser ${JSON.stringify(bad)}`)
  }
})

test('isKeyBlob : iv(24) : tag(32) : clé chiffrée(64), en hexadécimal minuscule', () => {
  assert.ok(isKeyBlob(`${hex(24)}:${hex(32)}:${hex(64)}`))
  const bad = [
    `${hex(22)}:${hex(32)}:${hex(64)}`, // iv trop court
    `${hex(24)}:${hex(30)}:${hex(64)}`, // tag trop court
    `${hex(24)}:${hex(32)}:${hex(62)}`, // chiffré trop court
    `${hex(24)}:${hex(32)}`, // partie manquante
    `${hex(24)}:${hex(32)}:${hex(64)}:${hex(8)}`, // partie en trop
    `${hex(24)}:${hex(32)}:${hex(64)}\n`,
    `${'AB'.repeat(12)}:${hex(32)}:${hex(64)}`, // majuscules
    '', null, undefined, 7,
  ]
  for (const b of bad) assert.ok(!isKeyBlob(b), `devrait refuser ${JSON.stringify(b)}`)
})

test('isStr : non vide, longueur maximale (255 par défaut)', () => {
  assert.ok(isStr('a'))
  assert.ok(isStr('a'.repeat(255)))
  assert.ok(!isStr('a'.repeat(256)))
  assert.ok(!isStr(''))
  assert.ok(isStr('abc', 3))
  assert.ok(!isStr('abcd', 3))
  for (const bad of [null, undefined, 1, true, {}, ['a']]) assert.ok(!isStr(bad), `devrait refuser ${JSON.stringify(bad)}`)
})

test('normalizeEmail : espaces retirés et minuscules', () => {
  assert.equal(normalizeEmail('  Foo.Bar@Example.COM \n'), 'foo.bar@example.com')
})

test('normalizeAnswer : minuscules, espaces supprimés, accents conservés', () => {
  assert.equal(normalizeAnswer('  Ma Réponse\tSecrète \n'), 'maréponsesecrète')
  assert.equal(normalizeAnswer('PARIS'), normalizeAnswer(' paris '))
  assert.equal(normalizeAnswer('a b'), 'ab')
  assert.equal(normalizeAnswer(''), '')
})

test('normalizeAnswer : identique côté client et côté serveur', () => {
  const samples = ['Paris', '  Saint Étienne ', 'Ça va ?', 'a b', 'TAB\there', 'ÉCOLE', '日本 語', 'ǅ', 'İstanbul', '']
  for (const s of samples) {
    assert.equal(normalizeAnswer(s), clientNormalizeAnswer(s), `divergence pour ${JSON.stringify(s)}`)
  }
})

test('isQA : question (80 max) et réponse (30 max) non vides', () => {
  assert.ok(isQA({ question: 'Ville de naissance ?', answer: 'Lyon' }))
  assert.ok(isQA({ question: 'q'.repeat(80), answer: 'a'.repeat(30) }))
  assert.ok(!isQA({ question: 'q'.repeat(81), answer: 'a' }))
  assert.ok(!isQA({ question: 'q', answer: 'a'.repeat(31) }))
  for (const bad of [null, undefined, 'texte', 42, [], {}, { question: 'q' }, { answer: 'a' }, { question: '', answer: 'a' }, { question: 'q', answer: 3 }]) {
    assert.ok(!isQA(bad), `devrait refuser ${JSON.stringify(bad)}`)
  }
})

test('isQuestionList : exactement le nombre de questions imposé, toutes valides', () => {
  const qa = (i: number) => ({ question: `Question ${i} ?`, answer: `réponse${i}` })
  const list = (n: number) => Array.from({ length: n }, (_, i) => qa(i))
  assert.equal(SECURITY_QUESTION_COUNT, 3)
  assert.ok(isQuestionList(list(SECURITY_QUESTION_COUNT)))
  assert.ok(!isQuestionList(list(SECURITY_QUESTION_COUNT - 1)))
  assert.ok(!isQuestionList(list(SECURITY_QUESTION_COUNT + 1)))
  assert.ok(!isQuestionList([]))
  assert.ok(!isQuestionList([...list(2), { question: 'q', answer: '' }]))
  for (const bad of [null, undefined, 'abc', 3, {}]) assert.ok(!isQuestionList(bad))
})

test('durées de vie : cohérentes entre elles', () => {
  assert.ok(TTL.ACCESS_SECONDS * 1000 < TTL.REFRESH_MS, 'le jeton d\'accès expire avant le refresh')
  assert.ok(TTL.RESET_VERIFIED_MS <= TTL.RESET_MS, 'l\'étape validée ne dure pas plus que le lien de reset')
  assert.ok(TTL.REFRESH_GRACE_MS > 0 && TTL.REFRESH_GRACE_MS < 60_000)
})
