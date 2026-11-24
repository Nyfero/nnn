// Les styles s'importent côté app : import '@myprout/ui/styles/theme.css'
// Le plugin Vite anti-flash de l'accent s'importe depuis '@myprout/ui/vite' (vite.config.js).
export { default as AppShell } from './components/AppShell.vue'
export { default as Sidebar } from './components/Sidebar.vue'
export { default as BaseModal } from './components/BaseModal.vue'
export { default as Toast } from './components/Toast.vue'
export { default as DustParticles } from './components/DustParticles.vue'
export {
  dustDirection,
  dustBoost,
  setDustDirection,
  resetDustBoost,
} from './composables/useDustDirection'
export {
  ACCENT_PRESETS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  isValidAccent,
  onAccent,
  accentText,
  accentVars,
  contrastRatio,
  applyAccent,
  loadStoredAccent,
} from './composables/useAccent'
export { APP_VERSION } from './version'
