import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAccessibleModules, hasAdminRole, pickStorageQuota } from '../src/utils/accessRules'
import { getModuleSecret } from '../src/utils/moduleSecret'
import { moduleAuth } from '../src/middlewares/moduleAuth'
import { ROLE_DEFAULTS, ROLES, SERVER_MODULE_ID } from '../src/config'

const ids = (list: { module_id: string }[]) => list.map((m) => m.module_id)
const enabled = [
  { module_id: 'files', name: 'Fichiers' },
  { module_id: 'passwords', name: 'Mots de passe' },
  { module_id: 'servers', name: 'Serveurs' },
]
const role = (all_modules: boolean, listed: string[] = []) => ({
  all_modules,
  roleModules: listed.map((module_id) => ({ module_id })),
})
// Un rôle construit à partir des valeurs par défaut du core
const defaultRole = (name: string) => role(ROLE_DEFAULTS[name].all_modules, ROLE_DEFAULTS[name].modules)

// ── Modules accessibles ──────────────────────────────────────────────────────

test('accès : rôle à liste blanche (all_modules = false)', () => {
  assert.deepEqual(ids(filterAccessibleModules(enabled, [role(false, ['passwords'])], [])), ['passwords'])
  assert.deepEqual(ids(filterAccessibleModules(enabled, [role(false, [])], [])), [])
})

test('accès : rôle « tous sauf » (all_modules = true, la liste contient les exclusions)', () => {
  assert.deepEqual(ids(filterAccessibleModules(enabled, [role(true, ['servers'])], [])), ['files', 'passwords'])
  assert.deepEqual(ids(filterAccessibleModules(enabled, [role(true, [])], [])), ['files', 'passwords', 'servers'])
})

test('accès : aucun rôle ni exception -> rien', () => {
  assert.deepEqual(filterAccessibleModules(enabled, [], []), [])
})

test('accès : les exceptions individuelles s\'ajoutent aux rôles (même un module exclu par le rôle)', () => {
  assert.deepEqual(ids(filterAccessibleModules(enabled, [], ['servers'])), ['servers'])
  assert.deepEqual(ids(filterAccessibleModules(enabled, [role(true, ['servers'])], ['servers'])), ['files', 'passwords', 'servers'])
})

test('accès : les rôles se cumulent, l\'ordre suit celui des modules activés', () => {
  const result = filterAccessibleModules(enabled, [role(false, ['servers']), role(false, ['passwords'])], [])
  assert.deepEqual(ids(result), ['passwords', 'servers'])
})

test('accès : un module désactivé ou inconnu n\'est jamais accordé, même par exception', () => {
  assert.deepEqual(ids(filterAccessibleModules(enabled, [role(false, ['absent'])], ['autre-absent'])), [])
  assert.deepEqual(ids(filterAccessibleModules([], [role(true)], ['files'])), [])
})

test('accès : les champs des modules sont conservés et les entrées ne sont pas modifiées', () => {
  const snapshot = JSON.stringify(enabled)
  const result = filterAccessibleModules(enabled, [role(false, ['files'])], [])
  assert.deepEqual(result, [{ module_id: 'files', name: 'Fichiers' }])
  assert.equal(JSON.stringify(enabled), snapshot)
})

test('accès : rôles par défaut du core conformes à docs/architecture.md', () => {
  const access = (name: string, direct: string[] = []) => ids(filterAccessibleModules(enabled, [defaultRole(name)], direct))
  assert.deepEqual(access(ROLES.ADMIN), ['files', 'passwords', 'servers'])
  assert.deepEqual(access(ROLES.USER), ['passwords'])
  assert.deepEqual(access(ROLES.FAMILLE), ['files', 'passwords'])
  assert.deepEqual(access(ROLES.AMIS), ['files', 'passwords'])
  assert.deepEqual(access(ROLES.GAMER), ['servers'])
  assert.equal(SERVER_MODULE_ID, 'servers')
})

// ── Quotas ───────────────────────────────────────────────────────────────────

test('quota : sans rôle, aucun stockage (0)', () => {
  assert.equal(pickStorageQuota([]), 0)
})

test('quota : le plus élevé des rôles gagne, null = illimité l\'emporte sur tout', () => {
  assert.equal(pickStorageQuota([{ storage_quota_mb: 0 }]), 0)
  assert.equal(pickStorageQuota([{ storage_quota_mb: 1024 }, { storage_quota_mb: 2048 }]), 2048)
  assert.equal(pickStorageQuota([{ storage_quota_mb: 0 }, { storage_quota_mb: 512 }]), 512)
  assert.equal(pickStorageQuota([{ storage_quota_mb: null }]), null)
  assert.equal(pickStorageQuota([{ storage_quota_mb: 2048 }, { storage_quota_mb: null }, { storage_quota_mb: 0 }]), null)
})

test('quota : valeurs par défaut des rôles (seul ADMIN est illimité)', () => {
  assert.equal(ROLE_DEFAULTS[ROLES.ADMIN].storage_quota_mb, null)
  assert.equal(ROLE_DEFAULTS[ROLES.FAMILLE].storage_quota_mb, 2048)
  assert.equal(ROLE_DEFAULTS[ROLES.AMIS].storage_quota_mb, 1024)
  for (const name of [ROLES.USER, ROLES.GAMER]) assert.equal(ROLE_DEFAULTS[name].storage_quota_mb, 0)
})

// ── Rôle administrateur ──────────────────────────────────────────────────────

test('hasAdminRole : seulement le rôle ADMIN', () => {
  const user = (...roles: string[]) => ({ userRoles: roles.map((r) => ({ role: { role: r } })) })
  assert.ok(hasAdminRole(user(ROLES.ADMIN)))
  assert.ok(hasAdminRole(user(ROLES.USER, ROLES.ADMIN)))
  assert.ok(!hasAdminRole(user(ROLES.USER, ROLES.FAMILLE)))
  assert.ok(!hasAdminRole(user('admin')), 'sensible à la casse')
  assert.ok(!hasAdminRole(user()))
})

// ── Secrets des modules et authentification module -> core ───────────────────

const withEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v)
  try {
    fn()
  } finally {
    for (const [k, v] of Object.entries(before)) v === undefined ? delete process.env[k] : (process.env[k] = v)
  }
}

test('getModuleSecret : variable MODULE_SECRET_<ID> (majuscules, tirets en underscores)', () => {
  withEnv({ MODULE_SECRET_PASSWORDS: 'valeur-test-1', MODULE_SECRET_MY_MOD: 'valeur-test-2', MODULE_SECRET_ABSENT: undefined }, () => {
    assert.equal(getModuleSecret('passwords'), 'valeur-test-1')
    assert.equal(getModuleSecret('my-mod'), 'valeur-test-2')
    assert.equal(getModuleSecret('absent'), undefined)
  })
})

const fakeRes = () => {
  const res: any = { statusCode: 200, body: undefined }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: unknown) => ((res.body = b), res)
  return res
}
const call = (headers: Record<string, string | undefined>) => {
  const req: any = { header: (name: string) => headers[name] }
  const res = fakeRes()
  let nextCalled = false
  moduleAuth(req, res, () => { nextCalled = true })
  return { req, res, nextCalled }
}

test('moduleAuth : module avec le bon secret accepté, identifié par req.moduleId', () => {
  withEnv({ MODULE_SECRET_PASSWORDS: 'valeur-test-1' }, () => {
    const { req, nextCalled, res } = call({ 'X-Module-Id': 'passwords', 'X-Module-Secret': 'valeur-test-1' })
    assert.equal(nextCalled, true)
    assert.equal(req.moduleId, 'passwords')
    assert.equal(res.statusCode, 200)
  })
})

test('moduleAuth : refuse (401) sans en-têtes, avec un mauvais secret ou un secret de longueur différente', () => {
  withEnv({ MODULE_SECRET_PASSWORDS: 'valeur-test-1' }, () => {
    const refused = [
      {},
      { 'X-Module-Id': 'passwords' },
      { 'X-Module-Secret': 'valeur-test-1' },
      { 'X-Module-Id': 'passwords', 'X-Module-Secret': 'valeur-test-2' },
      { 'X-Module-Id': 'passwords', 'X-Module-Secret': 'valeur-test-1-et-plus' },
      { 'X-Module-Id': 'passwords', 'X-Module-Secret': 'x' },
    ]
    for (const headers of refused) {
      const { nextCalled, res, req } = call(headers)
      assert.equal(res.statusCode, 401, JSON.stringify(headers))
      assert.equal(nextCalled, false)
      assert.equal(req.moduleId, undefined)
    }
  })
})

test('moduleAuth : refuse un module inconnu ou sans secret configuré', () => {
  withEnv({ MODULE_SECRET_INCONNU: undefined }, () => {
    const { res, nextCalled } = call({ 'X-Module-Id': 'inconnu', 'X-Module-Secret': 'undefined' })
    assert.equal(res.statusCode, 401)
    assert.equal(nextCalled, false)
  })
})

test('moduleAuth : refuse un identifiant de module mal formé (pas de lecture d\'une autre variable d\'environnement)', () => {
  withEnv({ MODULE_SECRET_PASSWORDS: 'valeur-test-1', MODULE_SECRET_: 'vide', MODULE_SECRET_A_B: 'ab' }, () => {
    for (const id of ['PASSWORDS', '', 'a b', '../x', 'a.b', 'a_b', 'x'.repeat(65)]) {
      const { res, nextCalled } = call({ 'X-Module-Id': id, 'X-Module-Secret': 'valeur-test-1' })
      assert.equal(res.statusCode, 401, `id ${JSON.stringify(id)}`)
      assert.equal(nextCalled, false)
    }
  })
})
