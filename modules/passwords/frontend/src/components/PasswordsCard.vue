<template>
  <div
    class="password-row"
    role="button"
    tabindex="0"
    :aria-label="`Ouvrir ${password.title}`"
    @click="$emit('click')"
    @keydown.enter.self="$emit('click')"
    @keydown.space.self.prevent="$emit('click')"
  >
    <!-- Logo ou initiale -->
    <div class="password-avatar" aria-hidden="true">
      <img v-if="icon" :src="icon" alt="" />
      <span v-else>{{ initial }}</span>
    </div>

    <!-- Titre | identifiant + mot de passe | note -->
    <div class="password-main">
      <span class="password-title">{{ password.title }}</span>
      <span class="password-credentials">
        <span class="password-username">{{ password.username || '—' }}</span>
        <span class="password-secret">{{ isVisible ? decryptedValue : '••••••••' }}</span>
      </span>
    </div>
    <span class="password-note">{{ password.note }}</span>

    <!-- Favori | afficher | copier -->
    <div class="password-actions">
      <button
        type="button"
        class="icon-button btn-favorite"
        :class="{ active: password.is_stared }"
        :aria-label="password.is_stared ? 'Retirer des favoris' : 'Ajouter aux favoris'"
        :aria-pressed="!!password.is_stared"
        @click.stop="$emit('toggle-favorite', password.password_id)"
      >
        <span class="material-icons" aria-hidden="true">{{
          password.is_stared ? 'star' : 'star_border'
        }}</span>
      </button>
      <button
        type="button"
        class="icon-button"
        :aria-label="isVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        @click.stop="$emit('toggle-show', password.password_id)"
      >
        <span class="material-icons" aria-hidden="true">{{
          isVisible ? 'visibility_off' : 'visibility'
        }}</span>
      </button>
      <button
        type="button"
        class="icon-button"
        aria-label="Copier le mot de passe"
        @click.stop="$emit('copy', password.password)"
      >
        <span class="material-icons" aria-hidden="true">content_copy</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  password: Object,
  icon: String,
  isVisible: Boolean,
  decryptedValue: String,
})

defineEmits(['click', 'toggle-favorite', 'toggle-show', 'copy'])

const initial = computed(() => (props.password.title?.[0] ?? '?').toUpperCase())
</script>

<style scoped>
.password-row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 68px;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: var(--mp-radius-row);
  background: var(--mp-glass-bg);
  border: 1px solid var(--mp-glass-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  cursor: pointer;
  transition: border-color 0.15s;
}
.password-row:hover {
  border-color: var(--mp-glass-border-strong);
}

.password-avatar {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--mp-glass-border);
  font-family: var(--mp-font-head);
  font-weight: 600;
  font-size: 17px;
  color: var(--mp-text);
  overflow: hidden;
}
.password-avatar img {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  object-fit: contain;
}

.password-main {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.password-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--mp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.password-credentials {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--mp-muted);
  min-width: 0;
}
.password-username {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.password-secret {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.password-note {
  flex: 1 1 0;
  min-width: 0;
  font-size: 13px;
  font-style: italic;
  color: var(--mp-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.password-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-favorite.active {
  color: var(--mp-accent-text);
}

@media (max-width: 899px) {
  .password-note {
    display: none;
  }
  .password-actions {
    gap: 4px;
  }
}
</style>
