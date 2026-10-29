<template>
  <BaseModal @close="$emit('close')">
    <template #header>
      <div class="modal-header-empty" />
      <div class="modal-header-title">
        <h2 class="themed-h2">{{ server ? 'Modifier le serveur' : 'Nouveau serveur' }}</h2>
      </div>
      <div class="modal-header-actions">
        <button class="modal-close" @click="$emit('close')" tabindex="-1">
          <span class="material-icons">close</span>
        </button>
      </div>
    </template>

    <form class="modal-form" @submit.prevent="submit">
      <div class="form-group">
        <label class="themed-label">Nom</label>
        <input class="themed-input" v-model="form.name" type="text" maxlength="100" placeholder="Minecraft, Valheim..." required />
      </div>

      <div class="form-group">
        <label class="themed-label">Nom du conteneur Docker</label>
        <input class="themed-input mono" v-model="form.container" type="text" maxlength="128" placeholder="minecraft-server" required />
      </div>

      <div class="form-group">
        <label class="themed-label">Description</label>
        <input class="themed-input" v-model="form.description" type="text" maxlength="255" placeholder="Optionnel (version, port...)" />
      </div>

      <div class="form-group">
        <label class="themed-label">Utilisateurs autorisés</label>
        <p v-if="users.length === 0" class="hint">
          Aucun utilisateur n'a accès à ce module. Donnez-leur l'accès dans Administration &gt; Utilisateurs.
        </p>
        <div v-else class="users">
          <label v-for="u in users" :key="u.user_id" class="user-row">
            <input type="checkbox" :value="u.user_id" v-model="form.user_ids" />
            <span>{{ u.firstName }} {{ u.lastName }}</span>
            <span class="email">{{ u.email }}</span>
          </label>
        </div>
        <p class="hint">Les administrateurs ont toujours accès à tous les serveurs.</p>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" hidden />
    </form>

    <template #footer>
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="themed-button button-secondary" @click="$emit('close')">Annuler</button>
        <button class="themed-button button-primary" :disabled="!isValid || loading" @click="submit">
          {{ loading ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { BaseModal } from '@myprout/ui'

const props = defineProps({
  server: { type: Object, default: null }, // null = création
  users: { type: Array, default: () => [] }, // utilisateurs non-admin ayant accès au module
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const form = ref({
  name: props.server?.name ?? '',
  container: props.server?.container ?? '',
  description: props.server?.description ?? '',
  user_ids: [...(props.server?.user_ids ?? [])],
})

const isValid = computed(() => form.value.name.trim() && form.value.container.trim())

function submit() {
  if (!isValid.value) return
  emit('submit', {
    name: form.value.name.trim(),
    container: form.value.container.trim(),
    description: form.value.description.trim(),
    user_ids: form.value.user_ids,
  })
}
</script>

<style scoped>
.mono { font-family: monospace; }
.hint { font-size: 0.78rem; color: #888; margin: 0.2rem 0 0; }
.users {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
}
.user-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0;
  cursor: pointer;
  font-size: 0.9rem;
}
.user-row input { accent-color: #c25fff; width: 16px; height: 16px; }
.email { color: #888; font-size: 0.8rem; margin-left: auto; }
</style>
