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
        <span class="material-icons module-icon">{{ m.icon }}</span>
        <span class="module-name">{{ m.name }}</span>
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
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
}
.lobby-info {
  color: #aaa;
  text-align: center;
  margin-top: 3rem;
  line-height: 1.6;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.module-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 180px;
  color: #fff;
  text-decoration: none;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.module-card:hover {
  border-color: var(--mp-accent);
  transform: translateY(-4px);
  box-shadow: 0 0 18px rgba(194, 95, 255, 0.35);
}
.module-icon {
  font-size: 3rem;
  color: var(--mp-accent);
}
.module-name {
  font-size: 1.2rem;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
}
</style>
