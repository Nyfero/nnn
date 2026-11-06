import test from 'node:test'
import assert from 'node:assert/strict'
import { extractDomain, filterPasswords, groupByLetter, isValidDomain } from '../src/utils/passwordsList.js'

const list = [
  { password_id: 1, title: 'GitHub', username: 'Moi@Example.com' },
  { password_id: 2, title: 'gmail', username: null },
  { password_id: 3, title: '1Password', username: 'admin' },
  { password_id: 4, title: 'Amazon', username: undefined },
]

test('filterPasswords : sans recherche, la liste est rendue telle quelle', () => {
  assert.equal(filterPasswords(list, ''), list)
  assert.equal(filterPasswords(list, undefined), list)
})

test('filterPasswords : par titre, insensible à la casse', () => {
  assert.deepEqual(filterPasswords(list, 'GIT').map((p) => p.password_id), [1])
  assert.deepEqual(filterPasswords(list, 'mail').map((p) => p.password_id), [2])
})

test('filterPasswords : par identifiant, même quand il est absent sur d\'autres entrées', () => {
  assert.deepEqual(filterPasswords(list, 'moi@example').map((p) => p.password_id), [1])
  assert.deepEqual(filterPasswords(list, 'admin').map((p) => p.password_id), [3])
})

test('filterPasswords : aucun résultat', () => {
  assert.deepEqual(filterPasswords(list, 'introuvable'), [])
  assert.deepEqual(filterPasswords([], 'a'), [])
})

test('groupByLetter : initiales en majuscules, groupes triés, ordre conservé dans un groupe', () => {
  const groups = groupByLetter(list)
  assert.deepEqual(groups.map((g) => g.letter), ['1', 'A', 'G'])
  const g = groups.find((x) => x.letter === 'G')
  assert.deepEqual(g.passwords.map((p) => p.password_id), [1, 2], 'GitHub et gmail ensemble, ordre d\'origine')
})

test('groupByLetter : liste vide', () => {
  assert.deepEqual(groupByLetter([]), [])
})

test('extractDomain : titre simple, domaine complet, URL', () => {
  assert.equal(extractDomain('github'), 'github.com')
  assert.equal(extractDomain('  GitHub.com '), 'github.com')
  assert.equal(extractDomain('https://www.example.fr/page?x=1'), 'www.example.fr')
  assert.equal(extractDomain('http://exemple.org'), 'exemple.org')
})

test('extractDomain : valeur vide ou URL invalide', () => {
  for (const bad of ['', null, undefined, 'http://']) {
    assert.equal(extractDomain(bad), null, `valeur ${JSON.stringify(bad)}`)
  }
})

test('isValidDomain : accepte un nom de domaine, refuse le reste', () => {
  for (const ok of ['example.com', 'sub.example.co.uk', 'my-site.fr']) {
    assert.ok(isValidDomain(ok), `devrait accepter ${ok}`)
  }
  for (const bad of [null, undefined, '', 'example', 'exa mple.com', 'example.com/x', 'a@b.com', 'http://example.com']) {
    assert.ok(!isValidDomain(bad), `devrait refuser ${JSON.stringify(bad)}`)
  }
})

test('titre -> domaine -> validation : un titre quelconque n\'envoie rien d\'étrange au serveur', () => {
  for (const title of ['Mon site perso', 'HTTPS://Example.com/x', 'a/b', '../../etc', 'x?y=1']) {
    assert.ok(!isValidDomain(extractDomain(title)), `${JSON.stringify(title)} ne doit pas donner de domaine valide`)
  }
  assert.ok(isValidDomain(extractDomain('netflix')))
})
