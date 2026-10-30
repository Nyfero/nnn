<template>
  <BaseModal class="preview" @close="$emit('close')">
    <template #header>
      <div class="modal-header-empty" />
      <div class="modal-header-title"><h2 class="themed-h2 preview-title">{{ node.label }}</h2></div>
      <div class="modal-header-actions">
        <button class="modal-close" @click="$emit('close')">
          <span class="material-icons">close</span>
        </button>
      </div>
    </template>

    <div class="stage">
      <img v-if="kind === 'image'" :src="url" :alt="node.label" />
      <video v-else-if="kind === 'video'" :src="url" controls autoplay />
      <audio v-else :src="url" controls autoplay />
    </div>
  </BaseModal>
</template>

<script setup>
import { computed } from 'vue'
import { BaseModal } from '@myprout/ui'

const props = defineProps({ node: Object, url: String })
defineEmits(['close'])

const kind = computed(() => props.node.display_mime.split('/')[0])
</script>

<style scoped>
.preview :deep(.modal) { max-width: min(92vw, 1100px); }
.preview-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 0; }
.stage { display: flex; justify-content: center; align-items: center; }
.stage img, .stage video { max-width: 100%; max-height: 72vh; border-radius: 8px; }
.stage audio { width: 100%; }
</style>
