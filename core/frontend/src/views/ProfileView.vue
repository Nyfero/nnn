<template>
  <div class="profile-container">
    <div class="themed-card profile-col"><Profile /></div>
    <div class="themed-card profile-col"><ManagedAccount /></div>
    <div class="themed-card profile-col"><Security /></div>
  </div>
</template>

<script setup>
import Profile from '@/components/profile/Profile.vue'
import ManagedAccount from '@/components/profile/ManagedAccount.vue'
import Security from '@/components/profile/Security.vue'
</script>

<style scoped>
.profile-container {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 1.5rem;
  color: #fff;
  align-items: stretch;
}
.profile-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 0 1.5rem;
  min-width: 0;
}
:deep(.themed-h2) {
  text-align: center;
  margin-bottom: 1.5rem;
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
  font-size: 1rem;
}
@media (max-width: 900px) {
  .profile-container { flex-direction: column; height: auto; }
}
</style>
