<template>
  <div class="themed-card server-card">
    <div class="server-main">
      <div class="server-title">
        <span class="dot" :class="view.cls" />
        <h3 class="server-name">{{ server.name }}</h3>
      </div>
      <p v-if="server.description" class="server-desc">{{ server.description }}</p>
      <p class="server-state" :class="view.cls">
        {{ view.label }}<template v-if="uptime"> — {{ uptime }}</template>
      </p>
      <p v-if="server.error" class="server-error">{{ server.error }}</p>
    </div>

    <div class="server-actions">
      <button
        class="btn-action"
        title="Redémarrer"
        :disabled="disabled || !server.running"
        @click="$emit('restart', server)"
      >
        <span class="material-icons">restart_alt</span>
      </button>

      <button
        class="switch"
        :class="{ on: isOn, pending: !!busy }"
        role="switch"
        :aria-checked="isOn"
        :aria-label="isOn ? `Éteindre ${server.name}` : `Allumer ${server.name}`"
        :disabled="disabled"
        @click="$emit('toggle', server)"
      >
        <span class="knob" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  server: { type: Object, required: true },
  busy: { type: String, default: '' }, // 'start' | 'stop' | 'restart'
  now: { type: Number, default: () => Date.now() },
})
defineEmits(['toggle', 'restart'])

const BUSY_LABELS = { start: 'Démarrage…', stop: 'Arrêt…', restart: 'Redémarrage…' }

const view = computed(() => {
  if (props.busy) return { label: BUSY_LABELS[props.busy], cls: 'pending' }
  const s = props.server
  if (s.error) return { label: 'Indisponible', cls: 'error' }
  switch (s.status) {
    case 'running':
      if (s.health === 'starting') return { label: 'Démarrage…', cls: 'pending' }
      if (s.health === 'unhealthy') return { label: 'En ligne (instable)', cls: 'warn' }
      return { label: 'En ligne', cls: 'on' }
    case 'restarting':
      return { label: 'Redémarrage…', cls: 'pending' }
    case 'paused':
      return { label: 'En pause', cls: 'warn' }
    case 'missing':
      return { label: 'Conteneur introuvable', cls: 'error' }
    case 'unknown':
      return { label: 'Indisponible', cls: 'error' }
    default:
      return { label: 'Hors ligne', cls: 'off' }
  }
})

// Position du bouton : suit l'action en cours, sinon l'état réel
const isOn = computed(() => (props.busy ? props.busy !== 'stop' : props.server.running))

const disabled = computed(
  () => !!props.busy || !!props.server.error || props.server.status === 'missing' || props.server.protected
)

const uptime = computed(() => {
  const s = props.server
  if (props.busy || !s.running || !s.startedAt) return ''
  const sec = Math.max(0, Math.floor((props.now - Date.parse(s.startedAt)) / 1000))
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `depuis ${d ? d + ' j ' : ''}${d || h ? h + ' h ' : ''}${m} min`
})
</script>

<style scoped>
.server-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.5rem;
}
.server-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.server-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.server-name {
  margin: 0;
  font-size: 1.25rem;
  font-family: 'Poppins', sans-serif;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.server-desc {
  margin: 0;
  font-size: 0.85rem;
  color: #aaa;
}
.server-state {
  margin: 0;
  font-size: 0.85rem;
  color: #aaa;
}
.server-state.on { color: var(--mp-success); }
.server-state.pending,
.server-state.warn { color: #f59e0b; }
.server-state.error { color: #ff5555; }
.server-error {
  margin: 0;
  font-size: 0.8rem;
  color: #ff5555;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
}
.dot.on { background: var(--mp-success); box-shadow: 0 0 8px var(--mp-success); }
.dot.pending { background: #f59e0b; animation: blink 1s infinite; }
.dot.warn { background: #f59e0b; }
.dot.error { background: #ff5555; }

.server-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.btn-action {
  background: transparent;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  padding: 0.3rem;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}
.btn-action:hover:not(:disabled) {
  border-color: var(--mp-accent);
  color: var(--mp-accent);
}
.btn-action:disabled { opacity: 0.3; cursor: not-allowed; }

/* Toggle */
.switch {
  position: relative;
  width: 56px;
  height: 30px;
  padding: 0;
  border-radius: 15px;
  border: 1px solid #555;
  background: var(--mp-input-bg);
  cursor: pointer;
  transition: background 0.25s, border-color 0.25s;
  flex-shrink: 0;
}
.switch .knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #bbb;
  transition: transform 0.25s, background 0.25s;
}
.switch.on {
  background: var(--mp-accent-dark);
  border-color: var(--mp-accent);
}
.switch.on .knob {
  transform: translateX(26px);
  background: #fff;
}
.switch.pending .knob { animation: blink 1s infinite; }
.switch:disabled { opacity: 0.5; cursor: not-allowed; }
.switch:focus-visible { outline: 2px solid var(--mp-accent); outline-offset: 2px; }

@keyframes blink {
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .switch .knob { transition: none; }
  .dot.pending, .switch.pending .knob { animation: none; }
}
</style>
