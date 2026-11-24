// Couleur d'accent choisie par l'utilisateur : seule couleur modifiable de la charte.
// Toutes les fonctions ci-dessous sont autonomes (aucun import, aucune variable externe)
// car le plugin Vite (src/vite.js) les recopie dans un script inline exécuté avant le bundle.

export const DEFAULT_ACCENT = '#5a43c9'
export const ACCENT_STORAGE_KEY = 'mp-accent'

export const ACCENT_PRESETS = [
  { name: 'Violet', value: '#5a43c9' },
  { name: 'Turquoise', value: '#5eead4' },
  { name: 'Bleu ciel', value: '#7dd3fc' },
  { name: 'Citron vert', value: '#bef264' },
  { name: 'Ambre', value: '#fcd34d' },
  { name: 'Corail', value: '#fb923c' },
  { name: 'Rose', value: '#f9a8d4' },
  { name: 'Rouge', value: '#dc2626' },
]

export function isValidAccent(hex) {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Luminance relative WCAG 2.x
export function relativeLuminance(hex) {
  const c = hexToRgb(hex).map(function (v) {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Mélange vers le blanc : t = 0 -> couleur d'origine, t = 1 -> blanc
export function mixWithWhite(hex, t) {
  return (
    '#' +
    hexToRgb(hex)
      .map(function (v) {
        return Math.round(v + (255 - v) * t)
          .toString(16)
          .padStart(2, '0')
      })
      .join('')
  )
}

// Texte posé sur un fond accent : sombre si l'accent est clair, blanc sinon.
// On garde le plus contrasté des deux ; si aucun n'atteint 4.5:1 (teintes moyennes),
// on passe au noir pur, qui l'atteint toujours face au blanc.
export function onAccent(hex) {
  const dark = '#04110f'
  const light = '#ffffff'
  const cDark = contrastRatio(hex, dark)
  const cLight = contrastRatio(hex, light)
  if (Math.max(cDark, cLight) >= 4.5) return cDark > cLight ? dark : light
  return contrastRatio(hex, '#000000') > cLight ? '#000000' : light
}

// Accent utilisé comme couleur de texte sur fond noir : éclairci jusqu'à 4.5:1
export function accentText(hex) {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mixWithWhite(hex, Math.min(t, 1))
    if (contrastRatio(c, '#000000') >= 4.5) return c
  }
  return '#ffffff'
}

// Les trois variables CSS dérivées d'un accent (défaut si invalide)
export function accentVars(hex) {
  const accent = isValidAccent(hex) ? hex.toLowerCase() : '#5a43c9'
  return {
    '--mp-accent': accent,
    '--mp-on-accent': onAccent(accent),
    '--mp-accent-text': accentText(accent),
  }
}

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// Pose l'accent sur <html> et le mémorise (partagé entre core et modules : même origine).
// null / invalide -> retour au violet par défaut.
export function applyAccent(hex) {
  const valid = isValidAccent(hex)
  const vars = accentVars(hex)
  if (typeof document !== 'undefined') {
    for (const [name, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(name, value)
    }
  }
  const store = storage()
  try {
    if (valid) store?.setItem(ACCENT_STORAGE_KEY, vars['--mp-accent'])
    else store?.removeItem(ACCENT_STORAGE_KEY)
  } catch {
    /* stockage indisponible (navigation privée) : l'accent reste appliqué pour la page */
  }
  return vars['--mp-accent']
}

export function loadStoredAccent() {
  try {
    const value = storage()?.getItem(ACCENT_STORAGE_KEY)
    return isValidAccent(value) ? value : null
  } catch {
    return null
  }
}
