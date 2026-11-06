import test from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit } from '../src/middlewares/rateLimit'
import { escapeHtml, extractLinks, loadEmailTemplate, replaceVariables } from '../src/services/email/utils/helper'

// ── Limiteur de débit ────────────────────────────────────────────────────────

const fakeRes = () => {
  const res: any = { statusCode: 200, headers: {} as Record<string, unknown>, body: undefined }
  res.setHeader = (k: string, v: unknown) => { res.headers[k] = v }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: unknown) => ((res.body = b), res)
  return res
}
const hit = (mw: ReturnType<typeof rateLimit>, ip = '1.1.1.1') => {
  const res = fakeRes()
  let passed = false
  mw({ ip } as any, res, () => { passed = true })
  return { res, passed }
}

test('rateLimit : laisse passer jusqu\'au maximum puis répond 429 avec Retry-After', (t) => {
  let now = 1_000_000
  t.mock.method(Date, 'now', () => now)
  const mw = rateLimit(60_000, 3)

  for (let i = 0; i < 3; i++) assert.ok(hit(mw).passed, `requête ${i + 1}`)
  const blocked = hit(mw)
  assert.equal(blocked.passed, false)
  assert.equal(blocked.res.statusCode, 429)
  assert.match(blocked.res.body.error, /Trop de tentatives/)
  assert.equal(blocked.res.headers['Retry-After'], 60)

  now += 30_000
  assert.equal(hit(mw).res.headers['Retry-After'], 30, 'le délai d\'attente diminue avec le temps')
})

test('rateLimit : la fenêtre se réinitialise une fois écoulée', (t) => {
  let now = 5_000_000
  t.mock.method(Date, 'now', () => now)
  const mw = rateLimit(1_000, 1)
  assert.ok(hit(mw).passed)
  assert.ok(!hit(mw).passed)
  now += 1_001
  assert.ok(hit(mw).passed)
})

test('rateLimit : un compteur par adresse IP et par limiteur', (t) => {
  t.mock.method(Date, 'now', () => 9_000_000)
  const a = rateLimit(60_000, 1)
  const b = rateLimit(60_000, 1)
  assert.ok(hit(a, '1.1.1.1').passed)
  assert.ok(!hit(a, '1.1.1.1').passed)
  assert.ok(hit(a, '2.2.2.2').passed, 'une autre IP n\'est pas bloquée')
  assert.ok(hit(b, '1.1.1.1').passed, 'un autre limiteur a son propre compteur')
})

test('rateLimit : désactivé uniquement en mode E2E', () => {
  const before = process.env.E2E_MODE
  try {
    process.env.E2E_MODE = 'true'
    const open = rateLimit(60_000, 1)
    for (let i = 0; i < 5; i++) assert.ok(hit(open).passed)

    process.env.E2E_MODE = 'false'
    const closed = rateLimit(60_000, 1)
    assert.ok(hit(closed, '3.3.3.3').passed)
    assert.ok(!hit(closed, '3.3.3.3').passed)
  } finally {
    before === undefined ? delete process.env.E2E_MODE : (process.env.E2E_MODE = before)
  }
})

// ── Emails ───────────────────────────────────────────────────────────────────

test('escapeHtml : échappe & < > " \' (le & en premier)', () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  assert.equal(escapeHtml('&lt;'), '&amp;lt;', 'pas de double décodage')
  assert.equal(escapeHtml('texte simple é'), 'texte simple é')
})

test('replaceVariables : toutes les occurrences, valeurs échappées', () => {
  const html = '<p>Bonjour {{firstName}}, {{firstName}} ! Code {{code}}</p>'
  assert.equal(replaceVariables(html, { firstName: 'Léa', code: 42 }), '<p>Bonjour Léa, Léa ! Code 42</p>')
})

test('replaceVariables : aucune injection HTML par une valeur saisie par l\'utilisateur', () => {
  const out = replaceVariables('<p>{{firstName}}</p>', { firstName: '<script>alert(1)</script>' })
  assert.ok(!out.includes('<script>'))
  assert.equal(out, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
})

test('replaceVariables : les motifs spéciaux de remplacement ($&, $1, $$) sont insérés tels quels', () => {
  const out = replaceVariables('<p>{{v}}</p>', { v: "$& $1 $$ $` $'" })
  assert.equal(out, '<p>$&amp; $1 $$ $` $&#39;</p>')
})

test('replaceVariables : variable inconnue laissée telle quelle, variable absente du texte ignorée', () => {
  assert.equal(replaceVariables('{{a}} {{b}}', { a: '1' }), '1 {{b}}')
  assert.equal(replaceVariables('rien', { a: '1' }), 'rien')
})

test('extractLinks : liens http(s) uniquement, "&amp;" restauré', () => {
  const html = '<a href="https://x.fr/a?b=1&amp;c=2">x</a><a href="mailto:a@b.fr">m</a><a href="#top">t</a><a href="http://y.fr">y</a>'
  assert.deepEqual(extractLinks(html), ['https://x.fr/a?b=1&c=2', 'http://y.fr'])
  assert.deepEqual(extractLinks('pas de lien'), [])
})

// Les modèles locaux (dev) et ceux de Resend (production, docs/deploiement.md §3) doivent utiliser les mêmes variables
const EXPECTED_VARIABLES: Record<string, string[]> = {
  EmailValidation: ['confirmMailRoute', 'firstName'],
  Admin: ['adminURL', 'date', 'email', 'firstName', 'lastName'],
  Activate: ['firstName', 'setupLinkURL'],
  Refuse: ['firstName'],
  Recovery: ['firstName', 'recoveryURL'],
}

test('modèles d\'email : présents et avec les variables attendues', async () => {
  for (const [name, expected] of Object.entries(EXPECTED_VARIABLES)) {
    const html = await loadEmailTemplate(name)
    const found = [...new Set([...html.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort()
    assert.deepEqual(found, expected, `variables de ${name}.html`)
  }
})

test('modèle d\'email absent : erreur explicite', async () => {
  await assert.rejects(loadEmailTemplate('Inexistant'), /Template email introuvable/)
})
