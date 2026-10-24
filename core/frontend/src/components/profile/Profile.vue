<template>
  <h2 class="themed-h2">Votre profil</h2>

  <div class="info-container" v-if="authStore.user">
    <div class="profil-info">
      <label class="themed-label">Prénom</label>
      <div class="info-row"><span>{{ authStore.user.firstName }}</span></div>
    </div>
    <div class="profil-info">
      <label class="themed-label">Nom</label>
      <div class="info-row"><span>{{ authStore.user.lastName }}</span></div>
    </div>
  </div>

  <div class="themed-separator" />

  <div class="logout-container">
    <div class="flex-1"></div>
    <button class="themed-button button-primary btn-logout flex-2" @click="logout()">
      <span>Déconnexion</span>
      <span class="material-icons">exit_to_app</span>
    </button>
    <div class="flex-1"></div>
  </div>
</template>

<script setup>
import { useProfile } from './useProfile'
const { authStore, logout } = useProfile()
</script>

<style scoped>
.logout-container { display: flex; justify-content: center; }
.btn-logout { gap: 0.5rem; }
</style>
