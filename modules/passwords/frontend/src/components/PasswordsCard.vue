<template>
  <div class="password-card">
    <!-- Fav button -->
    <div>
      <button
        class="btn-favorite"
        :class="{ active: password.is_stared }"
        @click.stop="$emit('toggle-favorite', password.password_id)"
      >
        <span class="material-icons">{{
          password.is_stared ? 'star' : 'star_border'
        }}</span>
      </button>
    </div>

    <!-- Password content -->
    <div class="themed-card password-content">
      <!-- (+/-) Icon | Title -->
      <div class="password-presentation">
        <div class="password-icon" v-if="icon">
          <img :src="icon" :alt="password.title" />
        </div>
        <div class="password-icon" v-else></div>
        <span class="password-title">{{ password.title }}</span>
      </div>

      <!-- (+/-) Username | Password | (+/-) Note -->
      <div class="password-info">
        <div class="password-credentials">
          <span class="password-username">{{ password.username || '—' }}</span>
          <span>{{ isVisible ? decryptedValue : '••••••••' }}</span>
        </div>
        <span class="password-note">{{ password.note }}</span>
      </div>

      <!-- Show btn | Copy btn -->
      <div class="password-actions">
        <button
          class="btn-action"
          @click.stop="$emit('toggle-show', password.password_id)"
          title="Afficher/Masquer"
        >
          <span class="material-icons">{{
            isVisible ? 'visibility_off' : 'visibility'
          }}</span>
        </button>
        <button
          class="btn-action"
          @click.stop="$emit('copy', password.password)"
          title="Copier"
        >
          <span class="material-icons">content_copy</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  password: Object,
  icon: String,
  isVisible: Boolean,
  decryptedValue: String,
})

defineEmits(['toggle-favorite', 'edit', 'toggle-show', 'copy', 'delete'])
</script>

<style scoped>
.password-card {
  display: flex;
  align-items: center;
  margin-bottom: 0.6rem;
}

/* Fav */
.btn-favorite {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.3rem;
  color: #c25fff;
  opacity: 0.3;
  transition:
    opacity 0.2s,
    color 0.2s;
}

.btn-favorite:hover {
  opacity: 0.7;
}

.btn-favorite .material-icons {
  font-size: 1.3rem;
}

.btn-favorite.active {
  opacity: 1;
  color: #f9f0a8;
}

/* Content */
.password-content {
  display: flex;
  align-items: center;
  border-radius: 10px;
  padding: 0.8rem 1.2rem;
  width: 100%;
}

.password-presentation {
  flex: 0 0 33.33%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}

.password-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.password-icon img {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: contain;
}

.password-title {
  font-weight: bold;
  font-size: 1.5rem;
  color: #fff;
  min-width: 120px;
}

.password-info {
  flex: 0 0 33.33%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  min-width: 0;
}

.password-credentials {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.password-username {
  font-size: 1rem;
  color: #fff;
}

.password-note {
  font-size: 0.85rem;
  color: #aaa;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.password-actions {
  flex: 0 0 33.33%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-action {
  background: transparent;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  padding: 0.3rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}
.btn-action:hover {
  border-color: #c25fff;
  color: #c25fff;
}
.btn-delete:hover {
  border-color: #ff5555;
  color: #ff5555;
}
</style>
