<template>
  <Transition name="toast">
    <div v-if="visible" class="toast">
      <span class="material-icons">check_circle</span>
      {{ message }}
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'

const visible = ref(false)
const message = ref('')

function show(msg = 'Copié !', duration = 2000) {
  message.value = msg
  visible.value = true
  setTimeout(() => (visible.value = false), duration)
}

defineExpose({ show })
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #323232;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}
</style>
