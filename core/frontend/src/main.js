import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@myprout/ui/styles/theme.css'
import './assets/auth.css'
import App from './App.vue'
import router from './router'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Branche le client API sur le store (refresh automatique, déconnexion forcée)
const auth = useAuthStore()
api.configure({
  getToken: () => auth.token,
  setSession: (data) => auth.setSession(data),
  onAuthFailure: async () => {
    await auth.clearLocal()
    router.push({ name: 'Login' })
  },
})

app.use(router)
app.mount('#app')
