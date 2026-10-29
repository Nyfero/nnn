<template>
  <nav class="themed-card navbar">
    <div class="navbar-items">
      <a
        v-for="item in items"
        :key="item.id"
        :href="item.href"
        class="nav-link"
        :class="{ active: item.id === active }"
        :title="item.label"
        @click="$emit('navigate', item, $event)"
      >
        <span class="icon material-icons">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </a>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true }, // [{ id, href, icon, label }]
  active: { type: String, default: '' },
})
defineEmits(['navigate'])
</script>

<style scoped>
.navbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  margin: 8px 15px;
  flex-shrink: 0;
}

.navbar-items {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  max-width: 100%;
  overflow-x: auto;
}

.nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  text-decoration: none;
  padding: 0 0.5rem;
}

.icon {
  font-size: 1.8rem;
  line-height: 1;
  transition: color 0.2s;
}

.nav-label {
  font-size: 0.8em;
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition:
    opacity 0.16s,
    max-height 0.16s;
  margin-top: 0.2em;
  color: #fff;
  white-space: nowrap;
}

.nav-link:hover .icon,
.nav-link.active .icon {
  color: var(--mp-accent, #c25fff);
}

.nav-link:hover .nav-label,
.nav-link.active .nav-label {
  opacity: 1;
  max-height: 2em;
  text-shadow: 0 0 3px var(--mp-accent, #c25fff);
}

.nav-link.active .nav-label {
  color: var(--mp-accent, #c25fff);
}
</style>
