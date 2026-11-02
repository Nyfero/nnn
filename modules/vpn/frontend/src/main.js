import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@myprout/ui/styles/theme.css'
import {
  getModuleKey,
  redirectToLogin,
  redirectToUnlock,
  refreshSession,
} from '@myprout/sdk/client'
import App from './App.vue'
import api from '@/services/api'
import { MODULE_ID, useSession } from '@/stores/session'

async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())
  const session = useSession()

  api.configure({
    getToken: () => session.token,
    setSession: (data) => session.setSession(data),
    onAuthFailure: () => redirectToLogin(),
  })

  // 1. Session : cookie de refresh du core (même origine)
  let data
  try {
    data = await refreshSession()
  } catch (error) {
    if (error.response?.status === 401) return redirectToLogin()
    document.getElementById('app').textContent = 'Service indisponible, réessayez dans un instant.'
    return
  }
  session.setSession(data)

  // 2. Clé du module : dérivée de la clé maître (IndexedDB). Absente -> déverrouillage via le core
  if (session.hasAccess) {
    try {
      session.setModuleKey(await getModuleKey(MODULE_ID, data.user.user_id))
    } catch {
      return redirectToUnlock()
    }
  }

  app.mount('#app')
}

bootstrap()
