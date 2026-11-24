<template>
  <nav class="sidebar" aria-label="Navigation principale">
    <div class="sidebar-brand">
      <span class="brand-dot" aria-hidden="true"></span>
      <span class="brand-name">Myprout</span>
    </div>

    <div v-for="group in groups" :key="group.id" class="sidebar-group" :class="`group-${group.id}`">
      <p class="group-title">{{ group.title }}</p>
      <a
        v-for="item in group.items"
        :key="item.id"
        :href="item.href"
        class="nav-link"
        :class="{ active: item.id === active }"
        :aria-current="item.id === active ? 'page' : undefined"
        :title="item.label"
        @click="$emit('navigate', item, $event)"
      >
        <span class="icon material-icons" aria-hidden="true">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </a>
    </div>

    <span v-if="version" class="sidebar-version">{{ version }}</span>
  </nav>
</template>

<script setup>
import { computed } from 'vue'

// Remplace l'ancienne Navbar, même API : items, active, @navigate(item, event).
// Une entrée avec group: 'account' va dans le groupe « Compte » (en bas).
const props = defineProps({
  items: { type: Array, required: true }, // [{ id, href, icon, label, group? }]
  active: { type: String, default: '' },
  version: { type: String, default: '' },
})
defineEmits(['navigate'])

const groups = computed(() =>
  [
    { id: 'modules', title: 'Modules', items: props.items.filter((i) => i.group !== 'account') },
    { id: 'account', title: 'Compte', items: props.items.filter((i) => i.group === 'account') },
  ].filter((g) => g.items.length)
)
</script>

<style scoped>
.sidebar {
  width: 252px;
  flex-shrink: 0;
  align-self: stretch;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 14px 18px;
  background: var(--mp-glass-bg);
  border: 1px solid var(--mp-glass-border);
  border-radius: var(--mp-radius-panel);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  overflow-y: auto;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
}
.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--mp-accent);
  flex-shrink: 0;
}
.brand-name {
  font-family: var(--mp-font-head);
  font-weight: 600;
  font-size: 21px;
  letter-spacing: -0.02em;
  color: var(--mp-text);
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.group-account {
  margin-top: auto;
}
.group-title {
  margin: 0 0 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--mp-faint);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 0 14px;
  border-radius: var(--mp-radius-control);
  color: #a1a1aa;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}
.nav-link.active {
  background: var(--mp-accent);
  color: var(--mp-on-accent);
}
.icon {
  font-size: 19px;
  line-height: 1;
}
.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-version {
  padding: 0 12px;
  font-size: 13px;
  color: var(--mp-faint);
}

/* Mobile / tablette : barre horizontale en haut, icônes seules + libellé de l'entrée active */
@media (max-width: 899px) {
  .sidebar {
    width: auto;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 22px;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .sidebar-brand,
  .group-title,
  .sidebar-version {
    display: none;
  }
  .sidebar-group {
    flex-direction: row;
    flex-shrink: 0;
    gap: 2px;
  }
  .group-account {
    margin-top: 0;
    margin-left: auto;
  }
  .nav-link {
    height: 44px;
    min-width: 44px;
    padding: 0 12px;
    box-sizing: border-box;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .nav-link:not(.active) {
    padding: 0;
  }
  .nav-link:not(.active) .nav-label {
    display: none;
  }
}
</style>
