// Les styles s'importent côté app : import '@myprout/ui/styles/theme.css'
export { default as BaseModal } from './components/BaseModal.vue'
export { default as Toast } from './components/Toast.vue'
export { default as DustParticles } from './components/DustParticles.vue'
export {
  dustDirection,
  dustBoost,
  setDustDirection,
  resetDustBoost,
} from './composables/useDustDirection.js'
