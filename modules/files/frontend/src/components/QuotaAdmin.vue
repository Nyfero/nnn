<template>
  <div class="admin">
    <h2 class="themed-h2">Espace et quotas</h2>

    <p v-if="loading" class="empty">Chargement...</p>
    <p v-if="error" class="form-error">{{ error }}</p>

    <template v-if="overview">
      <!-- Stockage -->
      <section class="block">
        <h3 class="sub">Stockage</h3>
        <div class="backends">
          <div v-for="b in overview.backends" :key="b.name" class="backend">
            <div class="b-top">
              <strong>{{ b.name }}</strong>
              <span v-if="b.is_default" class="badge">réception des nouveaux fichiers</span>
            </div>
            <div class="b-path">{{ b.path }}</div>
            <template v-if="b.total_bytes">
              <div class="track"><div class="fill" :style="{ width: `${diskUsed(b) * 100}%` }" :class="{ full: diskUsed(b) > 0.9 }" /></div>
              <div class="b-cap">{{ formatBytes(b.total_bytes - b.free_bytes) }} occupés sur {{ formatBytes(b.total_bytes) }} · {{ formatBytes(b.free_bytes) }} libres</div>
            </template>
            <div v-else class="b-cap">Capacité inconnue</div>
          </div>
        </div>
        <p class="note">
          Réserve de sécurité : les envois sont refusés si moins de {{ formatBytes(overview.min_free_bytes) }} resteraient libres sur le disque.
        </p>
        <p v-if="overcommit" class="warning">
          <span class="material-icons">warning</span>
          Les quotas alloués ({{ formatBytes(allocated) }}) dépassent la capacité du disque de réception ({{ formatBytes(defaultBackend.total_bytes) }}).
          Tant que tous les utilisateurs ne remplissent pas leur quota, cela fonctionne, mais le disque peut se remplir avant.
        </p>
        <p v-if="hasUnlimited" class="note">Au moins un utilisateur est en espace illimité : l'allocation totale ne peut pas être calculée.</p>
      </section>

      <!-- Quota par défaut -->
      <section class="block">
        <h3 class="sub">Quota par défaut</h3>
        <p class="note">S'applique aux utilisateurs sans quota personnalisé, y compris les futurs comptes.</p>
        <div class="editor">
          <select class="themed-select" v-model="def.mode"><option value="custom">Limité à</option><option value="unlimited">Illimité</option></select>
          <template v-if="def.mode === 'custom'">
            <input class="themed-input num" type="number" min="0" step="any" v-model.number="def.value" />
            <select class="themed-select unit" v-model="def.unit"><option v-for="u in unitNames" :key="u" :value="u">{{ unitLabel[u] }}</option></select>
          </template>
          <button class="themed-button button-primary save" :disabled="savingDefault" @click="saveDefault">Enregistrer</button>
        </div>
      </section>

      <!-- Utilisateurs -->
      <section class="block">
        <h3 class="sub">Utilisateurs</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Utilisateur</th><th>Utilisé</th><th>Quota</th><th /></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.user.user_id">
                <td>
                  <div class="u-name">{{ r.user.firstName }} {{ r.user.lastName }}<span v-if="r.user.isAdmin" class="badge">admin</span></div>
                  <div class="u-email">{{ r.user.email }}</div>
                </td>
                <td class="used">
                  {{ formatBytes(r.used) }}
                  <div v-if="effective(r) !== null" class="mini-track"><div class="fill" :class="{ full: r.used > effective(r) * 0.95 }" :style="{ width: `${Math.min(100, (r.used / (effective(r) || 1)) * 100)}%` }" /></div>
                </td>
                <td>
                  <div class="editor">
                    <select class="themed-select" v-model="r.mode" @change="r.dirty = true">
                      <option value="default">Par défaut ({{ formatQuota(overview.default_quota_bytes) }})</option>
                      <option value="custom">Personnalisé</option>
                      <option value="unlimited">Illimité</option>
                    </select>
                    <template v-if="r.mode === 'custom'">
                      <input class="themed-input num" type="number" min="0" step="any" v-model.number="r.value" @input="r.dirty = true" />
                      <select class="themed-select unit" v-model="r.unit" @change="r.dirty = true"><option v-for="u in unitNames" :key="u" :value="u">{{ unitLabel[u] }}</option></select>
                    </template>
                  </div>
                </td>
                <td><button class="themed-button button-primary save" :disabled="!r.dirty || r.saving" @click="saveRow(r)">Enregistrer</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">Réduire un quota en dessous de l'espace déjà utilisé ne supprime rien : l'utilisateur ne pourra simplement plus envoyer de fichiers tant qu'il n'a pas libéré de la place.</p>
      </section>
    </template>
    <Toast ref="toast" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Toast } from '@myprout/ui'
import api from '@/services/api'
import coreApi from '@/services/coreApi'
import { errorMessage } from '@/composables/useFiles'
import { formatBytes, formatQuota, splitBytes, UNITS } from '@/utils/format'

const unitNames = Object.keys(UNITS)
const unitLabel = { MB: 'Mo', GB: 'Go', TB: 'To' }

const toast = ref(null)
const loading = ref(true)
const error = ref('')
const overview = ref(null)
const rows = ref([])
const def = reactive({ mode: 'custom', value: 5, unit: 'GB' })
const savingDefault = ref(false)

async function load() {
  try {
    const [users, ov] = await Promise.all([coreApi.get('/admin/users'), api.get('/admin/overview')])
    overview.value = ov.data
    const q = ov.data.default_quota_bytes
    Object.assign(def, q === null ? { mode: 'unlimited' } : { mode: 'custom', ...splitBytes(q) })

    const byId = new Map(ov.data.accounts.map((a) => [a.user_id, a]))
    rows.value = users.data.map((user) => {
      const a = byId.get(user.user_id)
      return reactive({
        user, used: a?.used_bytes ?? 0, mode: a?.mode ?? 'default',
        ...splitBytes(a?.quota_bytes ?? q ?? undefined), dirty: false, saving: false,
      })
    })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const toBytes = (v, unit) => Math.round(Number(v) * UNITS[unit])
const effective = (r) => (r.mode === 'unlimited' ? null : r.mode === 'custom' ? toBytes(r.value, r.unit) : overview.value.default_quota_bytes)

const hasUnlimited = computed(() => rows.value.some((r) => effective(r) === null))
const allocated = computed(() => rows.value.reduce((s, r) => s + (effective(r) ?? 0), 0))
const defaultBackend = computed(() => overview.value?.backends.find((b) => b.is_default))
const overcommit = computed(() => !!defaultBackend.value?.total_bytes && allocated.value > defaultBackend.value.total_bytes)
const diskUsed = (b) => (b.total_bytes ? (b.total_bytes - b.free_bytes) / b.total_bytes : 0)

function validBytes(v, unit) {
  const n = toBytes(v, unit)
  if (!Number.isFinite(n) || n < 0) throw new Error('Quota invalide')
  return n
}

async function saveRow(r) {
  r.saving = true
  try {
    const quota_bytes = r.mode === 'custom' ? validBytes(r.value, r.unit) : r.mode
    await api.put(`/admin/accounts/${r.user.user_id}`, { quota_bytes })
    r.dirty = false
    toast.value?.show('Quota enregistré')
  } catch (e) {
    toast.value?.show(errorMessage(e))
  } finally {
    r.saving = false
  }
}

async function saveDefault() {
  savingDefault.value = true
  try {
    const v = def.mode === 'custom' ? validBytes(def.value, def.unit) : 'unlimited'
    await api.put('/admin/settings', { default_quota_bytes: v })
    overview.value.default_quota_bytes = v === 'unlimited' ? null : v
    toast.value?.show('Quota par défaut enregistré')
  } catch (e) {
    toast.value?.show(errorMessage(e))
  } finally {
    savingDefault.value = false
  }
}
</script>

<style scoped>
.admin { max-width: 960px; margin: 0 auto; padding: 1rem; }
.empty { color: var(--mp-muted); text-align: center; }
.block { margin-bottom: 2rem; }
.sub { font-size: 1.05rem; font-weight: 600; margin: 0 0 0.6rem; }
.note { color: var(--mp-muted); font-size: 0.82rem; margin: 0.5rem 0; }
.warning { display: flex; gap: 0.6rem; align-items: flex-start; font-size: 0.85rem; color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 10px; padding: 0.7rem 0.9rem; }
.backends { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.backend { background: #1e1e2e; border: 1px solid #2e2e3e; border-radius: 12px; padding: 1rem; }
.b-top { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
.b-path { font-family: monospace; font-size: 0.8rem; color: var(--mp-muted); margin: 4px 0 10px; word-break: break-all; }
.b-cap { font-size: 0.8rem; color: var(--mp-muted); margin-top: 6px; }
.track { height: 8px; border-radius: 8px; background: var(--mp-input-bg); overflow: hidden; }
.mini-track { height: 4px; border-radius: 4px; background: var(--mp-input-bg); overflow: hidden; margin-top: 4px; width: 110px; }
.fill { height: 100%; background: var(--mp-accent); }
.fill.full { background: var(--mp-danger); }
.badge { background: var(--mp-accent-dark); font-size: 0.7rem; padding: 2px 6px; border-radius: 6px; margin-left: 6px; }
.editor { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.themed-select { width: auto; padding: 0.5em 2em 0.5em 0.8em; }
.num { width: 90px; margin: 0; }
.unit { min-width: 70px; }
.save { width: auto; padding: 8px 14px; font-size: 0.9rem; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.7rem 0.8rem; text-align: left; border-bottom: 1px solid #2e2e3e; vertical-align: middle; }
th { font-weight: 600; color: #ddd; white-space: nowrap; }
.u-name { font-weight: 600; }
.u-email { color: var(--mp-muted); font-size: 0.82rem; }
.used { white-space: nowrap; font-size: 0.9rem; }
</style>
