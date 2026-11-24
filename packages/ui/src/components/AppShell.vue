<template>
  <div class="app-shell" :class="{ 'no-sidebar': !showSidebar }">
    <DustParticles />
    <Sidebar
      v-if="showSidebar"
      :items="items"
      :active="active"
      :version="version"
      @navigate="(item, e) => $emit('navigate', item, e)"
    />
    <main class="app-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DustParticles from './DustParticles.vue'
import Sidebar from './Sidebar.vue'
import { APP_VERSION } from '../version.js'

// Coque commune au core et à tous les modules : fond + barre latérale + contenu.
// Les liens sont de simples <a href> ; le core intercepte @navigate pour utiliser son routeur.
const props = defineProps({
  // Masquée sur /login (core)
  showSidebar: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  // 'home' | 'admin' | 'profile' | id du module courant
  active: { type: String, default: '' },
  // Dans un module : { id, name, icon, path }
  modules: { type: Array, default: () => [] },
  version: { type: String, default: APP_VERSION },
})
defineEmits(['navigate'])

const items = computed(() => [
  { id: 'home', href: '/', icon: 'apps', label: 'Accueil' },
  // Chaque module est une application distincte : navigation complète
  ...props.modules.map((m) => ({
    id: m.module_id,
    href: `${m.path}/`,
    icon: m.icon || 'extension',
    label: m.name,
    external: true,
  })),
  ...(props.isAdmin
    ? [
        {
          id: 'admin',
          href: '/admin',
          icon: 'admin_panel_settings',
          label: 'Administration',
          group: 'account',
        },
      ]
    : []),
  { id: 'profile', href: '/profile', icon: 'person', label: 'Profil', group: 'account' },
])
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: row;
  height: 100vh;
  height: 100dvh;
  padding: 16px;
  gap: 16px;
  box-sizing: border-box;
}

.app-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 22px 28px 32px;
  box-sizing: border-box;
}

.no-sidebar {
  padding: 0;
}
.no-sidebar .app-content {
  padding: 16px;
}

@media (max-width: 899px) {
  .app-shell {
    flex-direction: column;
    padding: 10px;
    gap: 6px;
  }
  .app-content {
    padding: 14px 6px 24px;
  }
}
</style>
