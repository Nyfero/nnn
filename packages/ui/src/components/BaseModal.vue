<template>
  <div class="modal-overlay">
    <div class="modal themed-card">
      <div class="modal-header" v-if="$slots.header">
        <slot name="header" />
      </div>

      <div class="modal-body">
        <slot />
      </div>

      <div class="modal-footer" v-if="$slots.footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import '../styles/modal.css'

const emit = defineEmits(['close'])

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

function handleKeydown(e) {
  if (e.key === 'Escape') emit('close')
}
</script>
