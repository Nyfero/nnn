<template>
  <div class="quota" v-if="usage">
    <div class="quota-text">
      <span>{{ formatBytes(usage.used_bytes) }} utilisés</span>
      <span class="quota-total">
        {{ usage.quota_bytes === null ? 'Espace illimité' : `sur ${formatBytes(usage.quota_bytes)}` }}
      </span>
    </div>
    <div v-if="usage.trash_bytes" class="quota-trash">dont {{ formatBytes(usage.trash_bytes) }} dans la corbeille</div>
    <div v-if="usage.quota_bytes !== null" class="quota-track" role="progressbar" :aria-valuenow="Math.round(ratio * 100)" aria-valuemin="0" aria-valuemax="100">
      <div class="quota-fill" :class="{ warn: ratio >= 0.8, full: ratio >= 0.95 }" :style="{ width: `${Math.min(100, ratio * 100)}%` }" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatBytes } from '@/utils/format'

const props = defineProps({ usage: Object })
const ratio = computed(() =>
  props.usage?.quota_bytes ? props.usage.used_bytes / props.usage.quota_bytes : 0
)
</script>

<style scoped>
.quota { min-width: 220px; flex: 1; max-width: 420px; }
.quota-text { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.85rem; margin-bottom: 6px; }
.quota-trash { font-size: 0.78rem; color: var(--mp-muted); margin: -2px 0 6px; }
.quota-total { color: var(--mp-muted); }
.quota-track { height: 8px; border-radius: 8px; background: var(--mp-input-bg); overflow: hidden; }
.quota-fill { height: 100%; border-radius: 8px; background: linear-gradient(90deg, var(--mp-accent), var(--mp-accent-dark)); transition: width 0.4s; }
.quota-fill.warn { background: #f59e0b; }
.quota-fill.full { background: var(--mp-danger); }
</style>
