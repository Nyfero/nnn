<template>
  <DustParticles />
  <AppShell
    :show-navbar="auth.isAuthenticated && route.name !== 'Login'"
    :is-admin="auth.isAdmin"
    :modules="auth.user?.modules ?? []"
    :active="active"
    @navigate="onNavigate"
  >
    <router-view />
  </AppShell>
</template>

<script setup>
import { computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppShell } from '@myprout/ui'
import { createInactivityGuard } from '@myprout/sdk/client'
import { useAuthStore } from '@/stores/authStore'
import DustParticles from '../../../packages/ui/src/components/DustParticles.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const active = computed(
  () =>
    ({ Lobby: 'home', Admin: 'admin', Profile: 'profile' })[route.name] ?? ''
)

// Les liens du core passent par le routeur (pas de rechargement) ; ceux des modules, non
function onNavigate(item, event) {
  if (item.external) return
  event.preventDefault()
  router.push(item.href)
}

// Déconnexion après 20 min d'inactivité (efface aussi la clé maître)
const inactivity = createInactivityGuard({
  onTimeout: async () => {
    await auth.logout()
    router.push({ name: 'Login' })
  },
})
watch(
  () => auth.isAuthenticated,
  (isAuth) => (isAuth ? inactivity.start() : inactivity.stop()),
  { immediate: true }
)
onUnmounted(() => inactivity.stop())
</script>
