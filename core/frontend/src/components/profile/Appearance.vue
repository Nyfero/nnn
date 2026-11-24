<template>
  <div class="appearance-head">
    <h2 class="themed-h2">Apparence</h2>
    <p class="appearance-help">
      Couleur d'accentuation de l'interface. Le fond noir et les particules ne changent pas.
    </p>
  </div>

  <div class="appearance-body">
    <div class="swatches" role="group" aria-label="Couleurs prédéfinies">
      <button
        v-for="preset in ACCENT_PRESETS"
        :key="preset.value"
        type="button"
        class="swatch"
        :class="{ selected: current === preset.value }"
        :style="{ background: preset.value }"
        :aria-label="preset.name"
        :aria-pressed="current === preset.value"
        :title="preset.name"
        :disabled="saving"
        @click="choose(preset.value)"
      ></button>

      <span class="swatch-divider" aria-hidden="true"></span>

      <label class="custom" :class="{ selected: isCustom }">
        <input
          type="color"
          class="swatch swatch-input"
          :class="{ selected: isCustom }"
          :value="current"
          :disabled="saving"
          aria-label="Couleur personnalisée"
          @change="choose($event.target.value)"
        />
        <span class="custom-label">Personnalisée</span>
      </label>
    </div>

    <div class="preview" aria-label="Aperçu">
      <span class="preview-title">Aperçu</span>
      <div class="preview-row">
        <span class="themed-button button-primary preview-button">Bouton principal</span>
        <span class="preview-nav"><span class="material-icons" aria-hidden="true">apps</span>Entrée active</span>
        <span class="preview-text">Texte accentué</span>
      </div>
    </div>
  </div>

  <p v-if="error" class="form-error appearance-error" role="alert">{{ error }}</p>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ACCENT_PRESETS, DEFAULT_ACCENT, isValidAccent } from '@myprout/ui'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const saving = ref(false)
const error = ref('')

const current = computed(() => {
  const value = auth.user?.theme_accent
  return isValidAccent(value) ? value.toLowerCase() : DEFAULT_ACCENT
})
const isCustom = computed(() => !ACCENT_PRESETS.some((p) => p.value === current.value))

// Appliqué au clic : mise à jour optimiste, retour arrière si l'API refuse
async function choose(hex) {
  if (!isValidAccent(hex) || hex.toLowerCase() === current.value) return
  saving.value = true
  error.value = ''
  try {
    // Le violet par défaut est enregistré comme « pas de préférence »
    await auth.saveAccent(hex.toLowerCase() === DEFAULT_ACCENT ? null : hex.toLowerCase())
  } catch {
    error.value = "Impossible d'enregistrer la couleur. Réessayez."
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.appearance-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.appearance-help {
  margin: 0;
  font-size: 14px;
  color: var(--mp-muted);
}
.appearance-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.swatch {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: transform 0.15s;
}
.swatch:hover:not(:disabled) {
  transform: scale(1.06);
}
.swatch:disabled {
  cursor: wait;
}
.swatch.selected {
  box-shadow:
    0 0 0 3px #000,
    0 0 0 5px #fff;
}
.swatch-divider {
  width: 1px;
  height: 32px;
  background: var(--mp-divider);
  margin: 0 4px;
}

.custom {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.custom-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--mp-muted);
}
.custom.selected .custom-label {
  color: var(--mp-text);
}
.swatch-input {
  appearance: none;
  -webkit-appearance: none;
  background: conic-gradient(#f87171, #fcd34d, #bef264, #5eead4, #7dd3fc, #a78bfa, #f9a8d4, #f87171);
  overflow: hidden;
}
.swatch-input.selected {
  background: var(--mp-accent);
}
.swatch-input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.swatch-input::-webkit-color-swatch {
  border: none;
  opacity: 0;
}
.swatch-input::-moz-color-swatch {
  border: none;
  opacity: 0;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  border-radius: var(--mp-radius-row);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--mp-divider);
}
.preview-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--mp-faint);
}
.preview-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}
.preview-button {
  width: auto;
  cursor: default;
}
.preview-nav {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 14px;
  border-radius: var(--mp-radius-control);
  background: var(--mp-accent);
  color: var(--mp-on-accent);
  font-size: 15px;
  font-weight: 500;
}
.preview-nav .material-icons {
  font-size: 19px;
}
.preview-text {
  font-weight: 600;
  color: var(--mp-accent-text);
}
.appearance-error {
  text-align: left;
  margin: 0;
}
</style>
