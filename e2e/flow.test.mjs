// Parcours complet sur la vraie stack (Caddy + core + module + bases) :
// inscription -> validation admin -> activation -> connexion -> accès module -> données chiffrées
// -> sessions -> changement de mot de passe -> reset par questions de sécurité -> suppression de compte.
//
// Prérequis : voir docs/tests.md  (stack lancée avec docker-compose.e2e.yml, `npm run test:e2e`).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  createVault,
  decryptMasterKeyHex,
  deriveModuleKey,
  importMasterKey,
  recoverMasterKeyHex,
  rewrapForNewPassword,
  VaultError,
  wrapMasterKey,
} from '@myprout/sdk/client'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE,
  Client,
  decryptEntry,
  encryptEntry,
  expectNoMail,
  parseLink,
  sleep,
  waitForMail,
} from './helpers.mjs'

const MODULE = 'passwords'
const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const USER = {
  firstName: 'E2E',
  lastName: 'Testeur',
  email: `e2e+${stamp}@example.test`,
  password: 'E2e-Mot2passe!',
  newPassword: 'E2e-Nouveau!Mdp9',
  resetPassword: 'E2e-Reset!Final7',
  qa: [
    { question: 'Quel est le nom de votre premier animal de compagnie ?', answer: 'Rex' },
    { question: 'Quelle est la ville où vous êtes né(e) ?', answer: 'Lyon' },
    { question: 'Quel est le nom de votre école primaire ?', answer: 'Jules Ferry' },
  ],
}
const answers = USER.qa.map((q) => q.answer)

// État partagé entre les étapes (les tests s'exécutent dans l'ordre)
const s = {
  admin: new Client('admin'),
  user: new Client('user'),
  userId: null,
  masterHex: null,
  entryId: null,
  autoGrantBefore: null,
  currentPassword: USER.password,
}

const moduleKey = async () => deriveModuleKey(await importMasterKey(s.masterHex), MODULE)
const expect = (r, status, msg = '') => {
  const got = typeof r === 'number' ? r : r.status
  const detail = typeof r === 'number' ? '' : ` ${JSON.stringify(r.data)}`
  assert.equal(got, status, `${msg} -> attendu ${status}, reçu ${got}${detail}`)
}

before(() => {
  assert.ok(ADMIN_EMAIL && ADMIN_PASSWORD, 'ADMIN_EMAIL / ADMIN_PASSWORD manquants (lancez via `npm run test:e2e`)')
  assert.ok(process.env.E2E_TOKEN, 'E2E_TOKEN manquant dans .env')
})

after(async () => {
  // Remet « accès auto » du module dans son état initial et supprime le compte de test s'il existe encore
  try {
    if (s.autoGrantBefore !== null) {
      await s.admin.patch(`/api/core/admin/modules/${MODULE}`, { auto_grant: s.autoGrantBefore })
    }
    const c = new Client('cleanup')
    for (const pw of [s.currentPassword, USER.password, USER.newPassword, USER.resetPassword]) {
      if ((await c.login(USER.email, pw)).status === 200) {
        await c.del('/api/core/auth/account', { password: pw })
        break
      }
    }
  } catch {
    /* nettoyage au mieux */
  }
})

// ═════════════════════════ 0. Pile démarrée ═════════════════════════
test('1. la pile répond (proxy, core, module) et le mode E2E est actif', async () => {
  const c = new Client()
  expect(await c.get('/api/core/health', { auth: false }), 200, 'core')
  expect(await c.get('/api/passwords/health', { auth: false }), 200, 'module')
  const page = await fetch(`${BASE}/`)
  assert.equal(page.status, 200, 'le frontend du core doit répondre sur /')
  const mod = await fetch(`${BASE}/passwords/`)
  assert.equal(mod.status, 200, 'le frontend du module doit répondre sur /passwords/')
  // sans jeton, la boîte mail de test n'existe pas
  assert.equal((await fetch(`${BASE}/api/core/_e2e/mailbox`)).status, 404, 'la boîte mail de test exige le jeton')
})

// ═════════════════════════ 1. Inscription ═════════════════════════
test('2. inscription : validation des champs', async () => {
  const c = new Client()
  expect(await c.post('/api/core/auth/register', { email: 'a@b.fr' }, { auth: false }), 400, 'champs manquants')
  expect(
    await c.post('/api/core/auth/register', { firstName: '<b>x</b>', lastName: 'Y', email: 'x@y.fr' }, { auth: false }),
    400,
    'HTML refusé dans le nom'
  )
})

test('3. inscription -> email de vérification', async () => {
  const since = Date.now()
  const c = new Client()
  expect(
    await c.post('/api/core/auth/register', {
      firstName: USER.firstName, lastName: USER.lastName, email: USER.email,
    }, { auth: false }),
    201
  )
  const mail = await waitForMail(USER.email, 'Confirmer votre adresse email', since)
  const { token, mode } = parseLink(mail.links.find((l) => l.includes('mode=email')))
  assert.ok(token && mode === 'email')
  s.verifyToken = token
})

test('4. connexion impossible avant la vérification de l\'email', async () => {
  const r = await new Client().login(USER.email, USER.password)
  expect(r, 403)
  assert.match(r.data.error, /vérifi/i)
})

test('5. vérification de l\'email (un seul usage) -> demande envoyée à l\'admin', async () => {
  const since = Date.now()
  const c = new Client()
  expect(await c.post('/api/core/auth/verify-email', { token: s.verifyToken }, { auth: false }), 200)
  expect(await c.post('/api/core/auth/verify-email', { token: s.verifyToken }, { auth: false }), 400, 'rejeu')
  await waitForMail(ADMIN_EMAIL, `Demande d'inscription de ${USER.firstName}`, since)
})

test('6. connexion impossible avant la validation par l\'admin', async () => {
  const r = await new Client().login(USER.email, USER.password)
  expect(r, 403)
  assert.match(r.data.error, /attente de validation/i)
})

// ═════════════════════════ 2. Administration ═════════════════════════
test('7. connexion admin : la clé maître du seed est lisible par le client', async () => {
  const r = await s.admin.login(ADMIN_EMAIL, ADMIN_PASSWORD)
  expect(r, 200, 'login admin')
  assert.equal(r.data.user.isAdmin, true)
  // Le blob a été produit côté serveur (seed) : le code client doit pouvoir le déchiffrer
  const hex = await decryptMasterKeyHex(ADMIN_PASSWORD, r.data.user)
  assert.match(hex, /^[0-9a-f]{64}$/)
})

test('8. routes admin : protégées, et le module s\'est enregistré', async () => {
  const anon = new Client()
  const noAuth = await anon.get('/api/core/admin/pending-users')
  expect(noAuth, 401)
  assert.equal(noAuth.data.code, 'TOKEN_INVALID')

  // module enregistré (il peut démarrer après le core)
  let mod
  for (let i = 0; i < 30 && !mod; i++) {
    mod = (await s.admin.get('/api/core/admin/modules')).data.find((m) => m.module_id === MODULE)
    if (!mod) await sleep(1000)
  }
  assert.ok(mod, 'le module passwords doit s\'être enregistré auprès du core (voir docker compose logs passwords-backend)')
  assert.equal(mod.path, '/passwords')

  // Pour tester l'attribution d'accès : on coupe « accès auto » le temps du test
  s.autoGrantBefore = mod.auto_grant
  if (mod.auto_grant) expect(await s.admin.patch(`/api/core/admin/modules/${MODULE}`, { auto_grant: false }), 200)

  const pending = await s.admin.get('/api/core/admin/pending-users')
  expect(pending, 200)
  const u = pending.data.find((p) => p.email === USER.email)
  assert.ok(u, 'le compte de test doit figurer dans les inscriptions en attente')
  s.userId = u.user_id
})

test('9. validation du compte -> email d\'activation', async () => {
  const since = Date.now()
  expect(await s.admin.post(`/api/core/admin/approve/${s.userId}`), 200)
  const mail = await waitForMail(USER.email, 'Définissez votre mot de passe', since)
  const { token, mode } = parseLink(mail.links.find((l) => l.includes('mode=set')))
  assert.ok(token && mode === 'set')
  s.activateToken = token
  expect(await s.admin.post(`/api/core/admin/approve/${s.userId}`), 400, 'double validation')
})

// ═════════════════════════ 3. Activation (clé maître créée côté client) ═════════════════════════
test('10. activation : jetons et formats invalides refusés', async () => {
  const c = new Client()
  const vault = await createVault(USER.password, answers)
  const body = { password: USER.password, security_questions: USER.qa, ...vault }

  expect(await c.post('/api/core/auth/activate', { ...body, token: 'inconnu' }, { auth: false }), 400, 'token inconnu')
  expect(
    await c.post('/api/core/auth/activate', { ...body, token: s.activateToken, encrypted_master_key: 'xyz' }, { auth: false }),
    400,
    'blob invalide'
  )
  expect(
    await c.post('/api/core/auth/activate', { ...body, token: s.activateToken, security_questions: USER.qa.slice(0, 2) }, { auth: false }),
    400,
    '2 questions seulement'
  )
})

test('11. activation : le serveur ne reçoit que des blobs chiffrés', async () => {
  const vault = await createVault(USER.password, answers)
  const r = await new Client().post(
    '/api/core/auth/activate',
    { token: s.activateToken, password: USER.password, security_questions: USER.qa, ...vault },
    { auth: false }
  )
  expect(r, 200)
  expect(
    await new Client().post('/api/core/auth/activate', { token: s.activateToken, password: USER.password, security_questions: USER.qa, ...vault }, { auth: false }),
    400,
    'rejeu du lien'
  )
})

// ═════════════════════════ 4. Connexion ═════════════════════════
test('12. connexion : mauvais mot de passe refusé, bon mot de passe -> clé maître récupérable', async () => {
  expect(await new Client().login(USER.email, 'mauvais-mot-de-passe'), 401)

  const r = await s.user.login(USER.email, USER.password)
  expect(r, 200)
  assert.equal(r.data.user.isAdmin, false)
  assert.ok(s.user.cookie('refreshToken'), 'cookie de refresh posé')
  assert.ok(r.setCookies.some((c) => /httponly/i.test(c) && /samesite=strict/i.test(c)), 'cookie HttpOnly + SameSite=Strict')

  s.masterHex = await decryptMasterKeyHex(USER.password, r.data.user)
  assert.match(s.masterHex, /^[0-9a-f]{64}$/)
  await assert.rejects(decryptMasterKeyHex('autre', r.data.user), VaultError)

  // Un utilisateur simple n'accède pas à l'administration
  expect(await s.user.get('/api/core/admin/pending-users'), 403)
})

// ═════════════════════════ 5. Accès aux modules ═════════════════════════
test('13. sans accès : lobby vide et module fermé', async () => {
  const lobby = await s.user.get('/api/core/modules')
  expect(lobby, 200)
  assert.deepEqual(lobby.data, [])
  const r = await s.user.get('/api/passwords/')
  expect(r, 403, 'module refusé sans autorisation')
})

test('14. l\'admin accorde l\'accès -> le module apparaît dans le lobby', async () => {
  expect(await s.admin.put(`/api/core/admin/users/${s.userId}/modules`, { modules: [MODULE] }), 200)
  const lobby = await s.user.get('/api/core/modules')
  assert.deepEqual(lobby.data.map((m) => m.module_id), [MODULE])
  expect(await s.user.get('/api/passwords/'), 200)
})

// ═════════════════════════ 6. Module passwords ═════════════════════════
test('15. données chiffrées côté client : création, lecture, modification, favori', async () => {
  const key = await moduleKey()
  const secret = 'Sup3r-Secret!é€'

  // validation
  expect(await s.user.post('/api/passwords/', { password: 'x' }), 400, 'titre manquant')
  expect(await s.user.post('/api/passwords/', { title: 'x' }), 400, 'mot de passe manquant')

  const created = await s.user.post('/api/passwords/', {
    title: 'example.com', username: 'moi@example.com', note: 'note e2e',
    password: await encryptEntry(secret, key),
  })
  expect(created, 201)
  assert.ok(!JSON.stringify(created.data).includes(secret), 'le serveur ne doit jamais voir le secret en clair')
  s.entryId = created.data.password_id

  const list = await s.user.get('/api/passwords/')
  const entry = list.data.find((p) => p.password_id === s.entryId)
  assert.ok(entry)
  assert.equal(await decryptEntry(entry.password, key), secret)

  const updated = await s.user.put(`/api/passwords/${s.entryId}`, {
    title: 'example.com', username: 'autre@example.com', note: '', password: await encryptEntry('N0uveau!', key),
  })
  expect(updated, 200)
  assert.equal(updated.data.username, 'autre@example.com')
  assert.equal(await decryptEntry(updated.data.password, key), 'N0uveau!')

  const star = await s.user.patch(`/api/passwords/${s.entryId}/is_stared`, { is_stared: true })
  expect(star, 200)
  assert.equal(star.data.is_stared, true)
  expect(await s.user.patch(`/api/passwords/${s.entryId}/is_stared`, { is_stared: 'oui' }), 400)
})

test('16. isolation : un autre compte (même admin) ne voit ni ne modifie ces données', async () => {
  const list = await s.admin.get('/api/passwords/')
  expect(list, 200)
  assert.ok(!list.data.some((p) => p.password_id === s.entryId))
  expect(await s.admin.patch(`/api/passwords/${s.entryId}/is_stared`, { is_stared: false }), 404)
  expect(await s.admin.put(`/api/passwords/${s.entryId}`, { title: 't', password: 'p' }), 404)
  expect(await s.admin.del(`/api/passwords/${s.entryId}`), 404)

  const still = await s.user.get('/api/passwords/')
  assert.ok(still.data.some((p) => p.password_id === s.entryId), 'les données de l\'utilisateur sont intactes')
})

test('17. logo : authentification requise, domaine validé', async () => {
  expect(await new Client().get('/api/passwords/logo?domain=example.com', { auth: false }), 401)
  expect(await s.user.get('/api/passwords/logo?domain=../../etc/passwd'), 404)
  expect(await s.user.get('/api/passwords/logo?domain=localhost'), 404)
})

test('18. routes internes du module : inaccessibles depuis l\'extérieur', async () => {
  const c = new Client()
  for (const [method, path] of [
    ['DELETE', `/api/passwords/internal/users/${s.userId}`],
    ['GET', `/api/passwords/internal/users/${s.userId}/count`],
  ]) {
    const r = await c.req(method, path, undefined, { auth: false, headers: { 'X-Module-Secret': 'x' } })
    expect(r, 404, `${method} ${path} doit être bloquée par le proxy`)
  }
})

// ═════════════════════════ 7. Sessions ═════════════════════════
test('19. refresh : rotation du cookie, tolérance aux requêtes concurrentes, déconnexion', async () => {
  const c = new Client('refresh')
  expect((await c.login(USER.email, USER.password)).status, 200)
  const first = c.cookie('refreshToken')

  const r1 = await c.post('/api/core/auth/refresh', {}, { auth: false })
  expect(r1, 200)
  assert.notEqual(c.cookie('refreshToken'), first, 'le refresh token doit changer')
  assert.ok(r1.data.token && r1.data.user.modules.length === 1)

  // Ancien cookie rejoué dans la fenêtre de 30 s (second onglet) : accepté, sans nouvelle rotation
  const replay = new Client('replay')
  replay.cookies.set('refreshToken', { value: first, path: '/api/core/auth' })
  const r2 = await replay.post('/api/core/auth/refresh', {}, { auth: false })
  expect(r2, 200, 'grâce de 30 s')
  assert.equal(r2.setCookies.length, 0)

  // Cookie inconnu : refusé
  const bad = new Client('bad')
  bad.cookies.set('refreshToken', { value: 'f'.repeat(64), path: '/api/core/auth' })
  expect(await bad.post('/api/core/auth/refresh', {}, { auth: false }), 401)
  expect(await new Client().post('/api/core/auth/refresh', {}, { auth: false }), 401, 'sans cookie')

  // Logout : le refresh ne fonctionne plus
  expect(await c.post('/api/core/auth/logout', {}, { auth: false }), 200)
  assert.equal(c.cookie('refreshToken'), undefined)
  const gone = new Client('gone')
  gone.cookies.set('refreshToken', { value: first, path: '/api/core/auth' })
  expect(await gone.post('/api/core/auth/refresh', {}, { auth: false }), 401, 'refresh après déconnexion')
})

test('20. révocation : le core refuse tout de suite, le module après le cache de 5 s', async () => {
  const c = new Client('revoke')
  expect((await c.login(USER.email, USER.password)).status, 200)
  expect((await c.get('/api/passwords/')).status, 200) // met l'autorisation en cache côté module

  expect((await c.post('/api/core/auth/logout', {}, { auth: false })).status, 200)
  const core = await c.get('/api/core/modules')
  expect(core, 401, 'le core refuse immédiatement')
  assert.equal(core.data.code, 'TOKEN_INVALID')

  await sleep(5500)
  const mod = await c.get('/api/passwords/')
  expect(mod, 401, 'le module refuse une fois le cache expiré')
  assert.equal(mod.data.code, 'TOKEN_INVALID')
})

// ═════════════════════════ 8. Changement de mot de passe ═════════════════════════
test('21. changement de mot de passe : même clé maître, autres sessions révoquées, données intactes', async () => {
  const other = new Client('autre-appareil')
  expect((await other.login(USER.email, USER.password)).status, 200)

  const me = (await s.user.post('/api/core/auth/refresh', {}, { auth: false })).data
  s.user.token = me.token

  // ancien mot de passe erroné : rejeté par le client avant tout appel serveur
  await assert.rejects(rewrapForNewPassword('faux', USER.newPassword, me.user), VaultError)

  // mot de passe erroné côté serveur (blob valide)
  const blob = await rewrapForNewPassword(USER.password, USER.newPassword, me.user)
  expect(
    await s.user.put('/api/core/auth/password', { oldPassword: 'faux', newPassword: USER.newPassword, ...blob }),
    401
  )

  const ok = await s.user.put('/api/core/auth/password', { oldPassword: USER.password, newPassword: USER.newPassword, ...blob })
  expect(ok, 200)
  s.currentPassword = USER.newPassword

  // l'autre appareil est déconnecté, la session courante reste valide
  expect((await other.get('/api/core/modules')).status, 401)
  expect((await s.user.get('/api/core/modules')).status, 200)

  // ancien mot de passe refusé, nouveau accepté, MÊME clé maître
  expect((await new Client().login(USER.email, USER.password)).status, 401)
  const again = await s.user.login(USER.email, USER.newPassword)
  expect(again, 200)
  assert.equal(await decryptMasterKeyHex(USER.newPassword, again.data.user), s.masterHex)

  // les données chiffrées restent lisibles
  const list = await s.user.get('/api/passwords/')
  const entry = list.data.find((p) => p.password_id === s.entryId)
  assert.equal(await decryptEntry(entry.password, await moduleKey()), 'N0uveau!')
})

// ═════════════════════════ 9. Mot de passe oublié ═════════════════════════
test('22. mot de passe oublié : pas d\'énumération de comptes', async () => {
  const since = Date.now()
  const ghost = `fantome+${stamp}@example.test`
  expect(await new Client().post('/api/core/auth/password/forgot', { email: ghost }, { auth: false }), 200)
  await expectNoMail(ghost, since)
})

test('23. reset : questions de sécurité obligatoires, clé maître retrouvée côté client', async () => {
  const since = Date.now()
  const c = new Client('reset')
  expect(await c.post('/api/core/auth/password/forgot', { email: USER.email }, { auth: false }), 200)
  const mail = await waitForMail(USER.email, 'Réinitialisez votre mot de passe', since)
  const { token, mode } = parseLink(mail.links.find((l) => l.includes('mode=reset')))
  assert.equal(mode, 'reset')

  // les questions sont proposées, pas les réponses
  const q = await c.get(`/api/core/auth/recovery?token=${token}`, { auth: false })
  expect(q, 200)
  assert.deepEqual(q.data.questions, USER.qa.map((x) => x.question))

  const fresh = await wrapMasterKey(s.masterHex, USER.resetPassword)

  // sans avoir répondu aux questions, le reset est refusé
  expect(
    await c.put('/api/core/auth/password/reset', { token, password: USER.resetPassword, ...fresh }, { auth: false }),
    400,
    'reset sans vérification'
  )

  // mauvaises réponses / réponses partielles
  const wrong = USER.qa.map((x, i) => ({ question: x.question, answer: i === 0 ? 'Médor' : x.answer }))
  expect(await c.post('/api/core/auth/recovery/verify', { token, security_questions: wrong }, { auth: false }), 401)
  expect(
    await c.post('/api/core/auth/recovery/verify', { token, security_questions: USER.qa.slice(0, 1) }, { auth: false }),
    400,
    'toutes les questions sont exigées'
  )

  // bonnes réponses (casse et espaces ignorés)
  const sloppy = USER.qa.map((x) => ({ question: x.question, answer: ` ${x.answer.toUpperCase()} ` }))
  const verified = await c.post('/api/core/auth/recovery/verify', { token, security_questions: sloppy }, { auth: false })
  expect(verified, 200)
  const recovered = await recoverMasterKeyHex(sloppy.map((x) => x.answer), verified.data)
  assert.equal(recovered, s.masterHex, 'les réponses redonnent exactement la même clé maître')

  // blob invalide refusé, puis reset réussi
  expect(
    await c.put('/api/core/auth/password/reset', { token, password: USER.resetPassword, encrypted_master_key: 'zz', kek_salt: 'zz' }, { auth: false }),
    400
  )
  expect(await c.put('/api/core/auth/password/reset', { token, password: USER.resetPassword, ...fresh }, { auth: false }), 200)
  s.currentPassword = USER.resetPassword

  // le lien ne sert qu'une fois ; toutes les sessions précédentes sont révoquées
  expect(await c.put('/api/core/auth/password/reset', { token, password: 'x', ...fresh }, { auth: false }), 400, 'rejeu')
  expect((await s.user.get('/api/core/modules')).status, 401, 'anciennes sessions révoquées')
})

test('24. après le reset : nouveau mot de passe, même clé maître, données lisibles', async () => {
  expect((await new Client().login(USER.email, USER.newPassword)).status, 401)
  const c = new Client('apres-reset')
  const r = await c.login(USER.email, USER.resetPassword)
  expect(r, 200)
  assert.equal(await decryptMasterKeyHex(USER.resetPassword, r.data.user), s.masterHex)

  const list = await c.get('/api/passwords/')
  const entry = list.data.find((p) => p.password_id === s.entryId)
  assert.equal(await decryptEntry(entry.password, await moduleKey()), 'N0uveau!')
  s.user = c
})

// ═════════════════════════ 10. Suppression de compte ═════════════════════════
test('25. un compte administrateur ne peut pas être supprimé', async () => {
  expect(await s.admin.del('/api/core/auth/account', { password: ADMIN_PASSWORD }), 403)
})

test('26. suppression du compte : mot de passe exigé, données du module purgées', async () => {
  const internal = process.env.PASSWORDS_INTERNAL_URL ?? 'http://127.0.0.1:3001'
  const secret = process.env.MODULE_SECRET_PASSWORDS
  const count = async () => {
    try {
      const res = await fetch(`${internal}/api/${MODULE}/internal/users/${s.userId}/count`, {
        headers: { 'X-Module-Secret': secret ?? '' },
        signal: AbortSignal.timeout(2000),
      })
      return res.ok ? (await res.json()).count : null
    } catch {
      return null // port de dev du module non exposé : vérification de purge ignorée
    }
  }
  const before = await count()

  expect(await s.user.del('/api/core/auth/account', { password: 'faux' }), 401)
  expect(await s.user.del('/api/core/auth/account', {}), 400)
  expect(await s.user.del('/api/core/auth/account', { password: USER.resetPassword }), 200)
  s.currentPassword = null

  expect((await new Client().login(USER.email, USER.resetPassword)).status, 401)
  expect((await s.user.get('/api/core/modules')).status, 401, 'sessions supprimées avec le compte')

  const users = await s.admin.get('/api/core/admin/users')
  assert.ok(!users.data.some((u) => u.email === USER.email), 'le compte n\'est plus listé')

  if (before === null) {
    console.warn('  (purge non vérifiée : lancez avec docker-compose.dev.yml pour exposer le module sur :3001)')
  } else {
    assert.ok(before >= 1, 'le module contenait des données avant la suppression')
    assert.equal(await count(), 0, 'le module a purgé les données de l\'utilisateur')
  }
})
