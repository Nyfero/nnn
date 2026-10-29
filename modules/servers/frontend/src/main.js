import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@myprout/ui/styles/theme.css'
import { redirectToLogin, refreshSession } from '@myprout/sdk/client'
import App from './App.vue'
import api from '@/services/api'
import coreApi from '@/services/coreApi'
import { useSession } from '@/stores/session'

async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())
  const session = useSession()

  const hooks = {
    getToken: () => session.token,
    setSession: (data) => session.setSession(data),
    onAuthFailure: () => redirectToLogin(),
  }
  api.configure(hooks)
  coreApi.configure(hooks)

  // Session : cookie de refresh du core (même origine)
  try {
    session.setSession(await refreshSession())
  } catch (error) {
    if (error.response?.status === 401) return redirectToLogin()
    document.getElementById('app').textContent = 'Service indisponible, réessayez dans un instant.'
    return
  }

  app.mount('#app')
}

bootstrap()
