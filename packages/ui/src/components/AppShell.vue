<template>
  <div class="app-shell">
    <DustParticles />
    <Navbar
      v-if="showNavbar"
      :items="items"
      :active="active"
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
import Navbar from './Navbar.vue'

// Coque commune au core et à tous les modules : fond + barre de navigation.
// Les liens sont de simples <a href> ; le core intercepte @navigate pour utiliser son routeur.
const props = defineProps({
  showNavbar: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  // 'home' | 'admin' | 'profile' | id du module courant
  active: { type: String, default: '' },
  // Dans un module : { id, name, icon, path }
  module: { type: Object, default: null },
})
defineEmits(['navigate'])

const items = computed(() => [
  { id: 'home', href: '/', icon: 'apps', label: 'Accueil' },
  ...(props.module
    ? [{
        id: props.module.id,
        href: `${props.module.path}/`,
        icon: props.module.icon || 'extension',
        label: props.module.name,
      }]
    : []),
  ...(props.isAdmin
    ? [{ id: 'admin', href: '/admin', icon: 'admin_panel_settings', label: 'Administration' }]
    : []),
  { id: 'profile', href: '/profile', icon: 'person', label: 'Profil' },
])
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1rem;
  box-sizing: border-box;
}
</style>
