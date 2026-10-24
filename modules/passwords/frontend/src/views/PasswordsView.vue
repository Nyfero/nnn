<template>
  <div class="themed-card passwords-page">
    <PasswordsList />
  </div>
</template>

<script setup>
import PasswordsList from '@/components/PasswordsList.vue'
</script>

<style scoped>
.passwords-page {
  height: 100%;
  overflow: hidden;
}
</style>
