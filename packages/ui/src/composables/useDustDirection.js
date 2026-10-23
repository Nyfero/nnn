import { ref } from 'vue'

export const dustDirection = ref('left')
export const dustBoost = ref(false)

export function setDustDirection(dir, boost = false) {
  dustDirection.value = dir
  dustBoost.value = boost
}

export function resetDustBoost() {
  dustBoost.value = false
}
