<template>
  <ul class="strength-criteria">
    <li v-for="item in items" :key="item.key" :class="criteria[item.key] ? 'met' : 'unmet'">
      <span class="criteria-icon">{{ criteria[item.key] ? '✓' : '✗' }}</span>
      {{ item.label }}
    </li>
  </ul>
</template>

<script setup>
import { computed } from 'vue'
import { passwordCriteria } from '@/utils/passwordCriteria'

const props = defineProps({ password: { type: String, default: '' } })
const criteria = computed(() => passwordCriteria(props.password))

const items = [
  { key: 'length', label: '8 caractères minimum' },
  { key: 'upper', label: 'Une lettre majuscule' },
  { key: 'number', label: 'Un chiffre' },
  { key: 'special', label: 'Un caractère spécial (!@#$%...)' },
]
</script>

<style scoped>
.strength-criteria {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}
.strength-criteria li {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-size: 0.8em;
  transition: color 0.3s ease;
}
.met { color: #4bb543; }
.unmet { color: #aaa; }
.criteria-icon {
  font-size: 0.9em;
  font-weight: 700;
  width: 14px;
  text-align: center;
}
</style>
