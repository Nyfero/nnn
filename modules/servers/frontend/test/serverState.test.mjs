import test from 'node:test'
import assert from 'node:assert/strict'
import { isDisabled, isSwitchOn, stateView, uptimeLabel } from '../src/utils/serverState.js'

const NOW = Date.parse('2026-01-10T12:00:00Z')
const server = (over = {}) => ({ status: 'exited', running: false, health: null, ...over })

test('stateView : action en cours prioritaire sur tout le reste', () => {
  assert.deepEqual(stateView(server({ status: 'running', running: true }), 'start'), { label: 'Démarrage…', cls: 'pending' })
  assert.deepEqual(stateView(server(), 'stop'), { label: 'Arrêt…', cls: 'pending' })
  assert.deepEqual(stateView(server({ error: 'x' }), 'restart'), { label: 'Redémarrage…', cls: 'pending' })
})

test('stateView : une erreur Docker rend le serveur indisponible', () => {
  assert.deepEqual(stateView(server({ status: 'running', error: 'Docker est injoignable' })), { label: 'Indisponible', cls: 'error' })
})

test('stateView : états d\'un conteneur', () => {
  assert.deepEqual(stateView(server({ status: 'running' })), { label: 'En ligne', cls: 'on' })
  assert.deepEqual(stateView(server({ status: 'running', health: 'healthy' })), { label: 'En ligne', cls: 'on' })
  assert.deepEqual(stateView(server({ status: 'running', health: 'starting' })), { label: 'Démarrage…', cls: 'pending' })
  assert.deepEqual(stateView(server({ status: 'running', health: 'unhealthy' })), { label: 'En ligne (instable)', cls: 'warn' })
  assert.deepEqual(stateView(server({ status: 'restarting' })), { label: 'Redémarrage…', cls: 'pending' })
  assert.deepEqual(stateView(server({ status: 'paused' })), { label: 'En pause', cls: 'warn' })
  assert.deepEqual(stateView(server({ status: 'missing' })), { label: 'Conteneur introuvable', cls: 'error' })
  assert.deepEqual(stateView(server({ status: 'unknown' })), { label: 'Indisponible', cls: 'error' })
})

test('stateView : exited, created, dead et inconnus -> hors ligne', () => {
  for (const status of ['exited', 'created', 'dead', 'autre']) {
    assert.deepEqual(stateView(server({ status })), { label: 'Hors ligne', cls: 'off' }, status)
  }
})

test('isSwitchOn : suit l\'action en cours, sinon l\'état réel', () => {
  assert.equal(isSwitchOn(server({ running: true })), true)
  assert.equal(isSwitchOn(server({ running: false })), false)
  assert.equal(isSwitchOn(server({ running: true }), 'stop'), false, 'arrêt en cours : bouton sur éteint')
  assert.equal(isSwitchOn(server({ running: false }), 'start'), true)
  assert.equal(isSwitchOn(server({ running: true }), 'restart'), true)
})

test('isDisabled : aucune action pendant une action, en erreur, manquant ou protégé', () => {
  assert.ok(!isDisabled(server()))
  assert.ok(isDisabled(server(), 'start'))
  assert.ok(isDisabled(server({ error: 'x' })))
  assert.ok(isDisabled(server({ status: 'missing' })))
  assert.ok(isDisabled(server({ protected: true })))
})

test('uptimeLabel : vide si arrêté, en action ou sans date de démarrage', () => {
  assert.equal(uptimeLabel(server({ running: false }), '', NOW), '')
  assert.equal(uptimeLabel(server({ running: true }), '', NOW), '')
  assert.equal(uptimeLabel(server({ running: true, startedAt: '2026-01-10T11:00:00Z' }), 'restart', NOW), '')
})

test('uptimeLabel : minutes, heures, jours', () => {
  const up = (startedAt) => uptimeLabel(server({ running: true, startedAt }), '', NOW)
  assert.equal(up('2026-01-10T11:59:30Z'), 'depuis 0 min')
  assert.equal(up('2026-01-10T11:55:00Z'), 'depuis 5 min')
  assert.equal(up('2026-01-10T09:30:00Z'), 'depuis 2 h 30 min')
  assert.equal(up('2026-01-10T11:00:00Z'), 'depuis 1 h 0 min')
  assert.equal(up('2026-01-07T09:05:00Z'), 'depuis 3 j 2 h 55 min')
  assert.equal(up('2026-01-09T12:00:00Z'), 'depuis 1 j 0 h 0 min')
})

test('uptimeLabel : une date de démarrage dans le futur (horloges décalées) ne donne pas de durée négative', () => {
  assert.equal(uptimeLabel(server({ running: true, startedAt: '2026-01-10T12:05:00Z' }), '', NOW), 'depuis 0 min')
})
