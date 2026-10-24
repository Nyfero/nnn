<template>
  <div class="passwordsList-alphabet">
    <span
      v-for="letter in alphabet"
      :key="letter"
      class="alphabet-letter"
      @click="$emit('scroll', letter)"
    >
      {{ letter }}
    </span>
  </div>
</template>

<script setup>
defineEmits(['scroll'])
const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
</script>

<style scoped>
.passwordsList-alphabet {
  flex: 3%;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 95%;
  justify-content: space-between;
  overflow: hidden;
}

.alphabet-letter {
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  transition: color 0.2s;
}

.alphabet-letter:hover {
  color: #c25fff;
}
</style>
