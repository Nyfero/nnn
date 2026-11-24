import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  accentText,
  accentVars,
  applyAccent,
  contrastRatio,
  isValidAccent,
  loadStoredAccent,
  onAccent,
} from '../src/composables/useAccent.js'
import { accentBootScript } from '../src/vite.js'

const EXTREMES = ['#ffffff', '#000000', '#808080', '#777777', '#ff0000', '#00ff00', '#0000ff']

test('isValidAccent : uniquement #rrggbb', () => {
  for (const ok of ['#5a43c9', '#FFFFFF', '#000000']) assert.ok(isValidAccent(ok), ok)
  for (const bad of ['5a43c9', '#fff', '#5a43c9ff', '#gggggg', 'red', '', null, undefined, 42, '#5a43c9\n']) {
    assert.ok(!isValidAccent(bad), `devrait refuser ${JSON.stringify(bad)}`)
  }
})

test('onAccent : texte lisible (>= 4.5:1) sur les presets et les couleurs extrêmes', () => {
  for (const hex of [...ACCENT_PRESETS.map((p) => p.value), ...EXTREMES]) {
    const c = contrastRatio(hex, onAccent(hex))
    assert.ok(c >= 4.5, `${hex} -> ${onAccent(hex)} : ${c.toFixed(2)}`)
  }
  assert.equal(onAccent('#ffffff'), '#04110f')
  assert.equal(onAccent('#000000'), '#ffffff')
  assert.equal(onAccent(DEFAULT_ACCENT), '#ffffff')
})

test('onAccent : >= 4.5:1 pour toute teinte de gris (cas le plus défavorable)', () => {
  for (let v = 0; v <= 255; v++) {
    const h = v.toString(16).padStart(2, '0')
    const hex = `#${h}${h}${h}`
    assert.ok(contrastRatio(hex, onAccent(hex)) >= 4.5, hex)
  }
})

test('accentText : >= 4.5:1 sur fond noir, inchangé si déjà lisible', () => {
  for (const hex of [...ACCENT_PRESETS.map((p) => p.value), ...EXTREMES]) {
    assert.ok(contrastRatio(accentText(hex), '#000000') >= 4.5, hex)
  }
  assert.equal(accentText('#5eead4'), '#5eead4')
  assert.notEqual(accentText(DEFAULT_ACCENT), DEFAULT_ACCENT)
  assert.equal(accentText('#000000') !== '#000000', true)
})

test('accentVars : un accent invalide retombe sur le violet par défaut', () => {
  assert.equal(accentVars(null)['--mp-accent'], DEFAULT_ACCENT)
  assert.equal(accentVars('javascript:alert(1)')['--mp-accent'], DEFAULT_ACCENT)
  assert.equal(accentVars('#ABCDEF')['--mp-accent'], '#abcdef')
})

test('applyAccent / loadStoredAccent : mémorise un accent valide, efface sinon', () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  try {
    assert.equal(applyAccent('#7DD3FC'), '#7dd3fc')
    assert.equal(loadStoredAccent(), '#7dd3fc')
    assert.equal(applyAccent(null), DEFAULT_ACCENT)
    assert.equal(loadStoredAccent(), null)
    store.set('mp-accent', 'url(evil)')
    assert.equal(loadStoredAccent(), null)
  } finally {
    delete globalThis.localStorage
  }
})

test('script anti-flash : applique la valeur stockée, ignore une valeur invalide', () => {
  const run = (stored) => {
    const props = {}
    vm.runInNewContext(accentBootScript(), {
      localStorage: { getItem: () => stored },
      document: { documentElement: { style: { setProperty: (k, v) => (props[k] = v) } } },
    })
    return props
  }
  assert.deepEqual(run('#fcd34d'), accentVars('#fcd34d'))
  assert.deepEqual(run('red;background:url(x)'), {})
  assert.deepEqual(run(null), {})
})
