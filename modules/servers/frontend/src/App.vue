<template>
  <AppShell
    :is-admin="session.isAdmin"
    :active="MODULE_ID"
    :modules="session.user?.modules ?? []"
  >
    <ServersView v-if="session.hasAccess" />
    <div v-else class="themed-card no-access">
      <h2 class="themed-h2">Accès non autorisé</h2>
      <p>Vous n'avez pas accès à ce module. Contactez un administrateur.</p>
      <a href="/" class="themed-button button-primary">Retour à l'accueil</a>
    </div>
  </AppShell>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { AppShell } from '@myprout/ui'
import {
  coreLogout,
  createInactivityGuard,
  redirectToLogin,
} from '@myprout/sdk/client'
import ServersView from '@/views/ServersView.vue'
import { MODULE_ID, useSession } from '@/stores/session'

const session = useSession()

// Même règle que le core : 20 min d'inactivité -> déconnexion globale (efface la clé maître)
const inactivity = createInactivityGuard({
  onTimeout: async () => {
    await coreLogout()
    redirectToLogin()
  },
})
onMounted(() => inactivity.start())
onUnmounted(() => inactivity.stop())
</script>

<style scoped>
.no-access {
  max-width: 420px;
  margin: 4rem auto;
  padding: 2rem;
  text-align: center;
}
.no-access a {
  text-decoration: none;
  margin-top: 1.5rem;
  box-sizing: border-box;
}
</style>
