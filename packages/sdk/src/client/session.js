import axios from 'axios'
import { clearMasterKey } from './keystore.js'

// Redirections vers le core, avec retour automatique au module après connexion
const here = () => location.pathname + location.search

export const redirectToLogin = (back = here()) =>
  location.assign(`/login?redirect=${encodeURIComponent(back)}`)

export const redirectToUnlock = (back = here()) =>
  location.assign(`/unlock?redirect=${encodeURIComponent(back)}`)

// Déconnexion globale (session du core + clé maître de ce navigateur)
export async function coreLogout() {
  try {
    await axios.post('/api/core/auth/logout', {}, { withCredentials: true })
  } catch {
    /* le cookie expirera de toute façon */
  }
  await clearMasterKey().catch(() => {})
}
