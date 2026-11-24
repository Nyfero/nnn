<template>
  <div class="lobby">
    <h1 class="themed-h1">Bonjour {{ auth.user?.firstName }}</h1>

    <p v-if="loading" class="lobby-info">Chargement...</p>

    <p v-else-if="modules.length === 0" class="lobby-info">
      Aucun module n'est disponible pour le moment.
      <template v-if="!auth.isAdmin"><br />Contactez un administrateur pour obtenir un accès.</template>
    </p>

    <div v-else class="module-grid">
      <!-- Chaque module est une application distincte : navigation complète (pas de router-link) -->
      <a
        v-for="m in modules"
        :key="m.module_id"
        :href="`${m.path}/`"
        class="themed-card module-card"
      >
        <span class="module-badge" aria-hidden="true">
          <span class="material-icons module-icon">{{ m.icon }}</span>
        </span>
        <span class="module-name">{{ m.name }}</span>
        <span class="material-icons module-arrow" aria-hidden="true">arrow_forward</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'

const auth = useAuthStore()
const modules = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const { data } = await api.get('/modules')
    modules.value = data
  } catch {
    modules.value = auth.user?.modules ?? []
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.lobby {
  max-width: 1100px;
}
.lobby-info {
  color: var(--mp-muted);
  margin-top: 2rem;
  line-height: 1.6;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
  margin-top: 8px;
}
.module-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
  color: var(--mp-text);
  text-decoration: none;
  transition:
    border-color 0.2s,
    transform 0.2s,
    box-shadow 0.2s;
}
.module-card:hover {
  border-color: var(--mp-glass-border-strong);
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}
.module-badge {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--mp-glass-border);
}
.module-icon {
  font-size: 28px;
  color: var(--mp-accent-text);
}
.module-name {
  flex: 1;
  min-width: 0;
  font-family: var(--mp-font-head);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.module-arrow {
  font-size: 20px;
  color: var(--mp-faint);
  transition:
    transform 0.2s,
    color 0.2s;
}
.module-card:hover .module-arrow {
  color: var(--mp-text);
  transform: translateX(3px);
}
</style>
