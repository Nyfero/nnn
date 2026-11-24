<template>
  <nav class="passwordsList-alphabet" aria-label="Index alphabétique">
    <button
      v-for="letter in alphabet"
      :key="letter"
      type="button"
      class="alphabet-letter"
      :class="{ empty: !available.includes(letter) }"
      :disabled="!available.includes(letter)"
      :aria-label="`Aller à la lettre ${letter}`"
      @click="$emit('scroll', letter)"
    >
      {{ letter }}
    </button>
  </nav>
</template>

<script setup>
defineProps({
  // Lettres qui ont au moins une entrée
  available: { type: Array, default: () => [] },
})
defineEmits(['scroll'])
const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
</script>

<style scoped>
.passwordsList-alphabet {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  max-height: 640px;
  padding: 4px 0;
  overflow: hidden;
}

.alphabet-letter {
  background: none;
  border: none;
  padding: 1px 8px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--mp-muted);
  cursor: pointer;
  transition: color 0.15s;
}
.alphabet-letter:hover:not(:disabled) {
  color: var(--mp-accent-text);
}
.alphabet-letter.empty {
  color: rgba(255, 255, 255, 0.22);
  cursor: default;
}
</style>
