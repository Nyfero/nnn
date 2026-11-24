<template>
  <Transition name="toast">
    <div v-if="visible" class="toast" :class="`toast-${type}`" role="status" aria-live="polite">
      <span class="material-icons toast-icon" aria-hidden="true">{{ icon }}</span>
      {{ message }}
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue'

const visible = ref(false)
const message = ref('')
const type = ref('success') // 'success' | 'error' | 'info'
let timer = null

const icon = computed(
  () => ({ success: 'check_circle', error: 'error', info: 'info' })[type.value] ?? 'info'
)

function show(msg = 'Copié !', duration = 2000, kind = 'success') {
  message.value = msg
  type.value = kind
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (visible.value = false), duration)
}

defineExpose({ show })
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(22, 22, 30, 0.78);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--mp-glass-border-strong);
  color: var(--mp-text);
  padding: 12px 18px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  z-index: 9999;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}
.toast-icon {
  font-size: 20px;
}
.toast-success .toast-icon {
  color: var(--mp-success);
}
.toast-error .toast-icon {
  color: var(--mp-danger);
}
.toast-info .toast-icon {
  color: var(--mp-accent-text);
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
