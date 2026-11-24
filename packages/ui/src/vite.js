// Plugin Vite commun au core et aux modules : injecte dans <head>, AVANT le bundle, un script
// qui lit localStorage['mp-accent'] et pose les variables d'accent tout de suite (pas de flash
// de la couleur par défaut au chargement). Le script est construit à partir des fonctions de
// useAccent.js : une seule source de vérité pour les calculs de contraste.
import {
  ACCENT_STORAGE_KEY,
  isValidAccent,
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  mixWithWhite,
  onAccent,
  accentText,
  accentVars,
} from './composables/useAccent.js'

export function accentBootScript() {
  const fns = [
    isValidAccent,
    hexToRgb,
    relativeLuminance,
    contrastRatio,
    mixWithWhite,
    onAccent,
    accentText,
    accentVars,
  ]
  return `(function () {
${fns.map(String).join('\n')}
try {
  var stored = localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});
  if (!isValidAccent(stored)) return;
  var vars = accentVars(stored);
  for (var name in vars) document.documentElement.style.setProperty(name, vars[name]);
} catch (e) {}
})();`
}

export function accentBootPlugin() {
  return {
    name: 'myprout-accent-boot',
    transformIndexHtml() {
      return [
        { tag: 'script', children: accentBootScript(), injectTo: 'head-prepend' },
      ]
    },
  }
}
