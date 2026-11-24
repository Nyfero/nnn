<template>
  <div class="profile-container">
    <div class="themed-card profile-col"><Profile /></div>
    <div class="themed-card profile-col"><ManagedAccount /></div>
    <div class="themed-card profile-col"><Security /></div>
    <div class="themed-card profile-col profile-wide"><Appearance /></div>
  </div>
</template>

<script setup>
import Profile from '@/components/profile/Profile.vue'
import ManagedAccount from '@/components/profile/ManagedAccount.vue'
import Security from '@/components/profile/Security.vue'
import Appearance from '@/components/profile/Appearance.vue'
</script>

<style scoped>
.profile-container {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  max-width: 1200px;
  color: var(--mp-text);
  align-items: stretch;
}
.profile-col {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 26px;
  min-width: 0;
}
.profile-wide {
  grid-column: 1 / -1;
}
:deep(.themed-h2) {
  margin-bottom: 0.2rem;
}
:deep(.info-container) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
:deep(.profil-info) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
:deep(.info-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 15px;
}
@media (max-width: 1100px) {
  .profile-container {
    grid-template-columns: 1fr;
  }
}
</style>
