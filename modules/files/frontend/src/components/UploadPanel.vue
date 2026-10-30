<template>
  <aside v-if="uploads.length" class="themed-card panel">
    <div class="panel-head">
      <strong>Envois ({{ active }} en cours)</strong>
      <button class="icon-btn" title="Effacer les envois terminés" @click="$emit('clear')">
        <span class="material-icons">done_all</span>
      </button>
    </div>
    <ul>
      <li v-for="u in uploads" :key="u.id">
        <div class="line">
          <span class="name" :title="u.name">{{ u.name }}</span>
          <span class="state" :class="u.status">
            <template v-if="u.status === 'encrypting'">Chiffrement {{ Math.round(u.progress * 100) }} %</template>
            <template v-else-if="u.status === 'uploading'">{{ Math.round(u.progress * 100) }} %</template>
            <template v-else-if="u.status === 'queued'">En attente</template>
            <template v-else-if="u.status === 'done'">Terminé</template>
            <template v-else-if="u.status === 'cancelled'">Annulé</template>
            <template v-else>{{ u.error }}</template>
          </span>
          <button v-if="['queued', 'encrypting', 'uploading'].includes(u.status)" class="icon-btn" title="Annuler" @click="$emit('cancel', u)">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div v-if="u.status === 'uploading' || u.status === 'encrypting'" class="track"><div class="fill" :style="{ width: `${u.progress * 100}%` }" /></div>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ uploads: { type: Array, required: true } })
defineEmits(['cancel', 'clear'])

const active = computed(() => props.uploads.filter((u) => ['queued', 'encrypting', 'uploading'].includes(u.status)).length)
</script>

<style scoped>
.panel { position: fixed; right: 24px; bottom: 24px; width: 340px; max-width: calc(100vw - 48px); max-height: 40vh; overflow: auto; padding: 0.8rem 1rem; background: rgba(10, 10, 10, 0.92); z-index: 500; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.9rem; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.line { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.state { color: var(--mp-muted); white-space: nowrap; }
.state.done { color: var(--mp-success); }
.state.error { color: #ff5555; white-space: normal; text-align: right; }
.track { height: 4px; border-radius: 4px; background: var(--mp-input-bg); margin-top: 4px; overflow: hidden; }
.fill { height: 100%; background: var(--mp-accent); transition: width 0.2s; }
.icon-btn { background: none; border: none; color: var(--mp-muted); cursor: pointer; display: flex; padding: 2px; }
.icon-btn:hover { color: var(--mp-accent); }
.icon-btn .material-icons { font-size: 1.1rem; }
</style>
