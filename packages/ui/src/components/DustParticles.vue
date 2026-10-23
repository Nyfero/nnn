<template>
  <canvas ref="canvas" class="dust-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { dustDirection, dustBoost } from '../composables/useDustDirection'

const canvas = ref()
let context = null
let animationId
let particles = []
// Taille logique (px CSS) : indépendante du devicePixelRatio
let width = 0
let height = 0
const maxParticles = 150
const minParticles = 30

function randomBetween(a, b) {
  return Math.random() * (b - a) + a
}

function createParticle(w, h) {
  const angle = randomBetween(0, 2 * Math.PI)
  return {
    x: randomBetween(0, w),
    y: randomBetween(0, h),
    radius: randomBetween(0.3, 2),
    alpha: randomBetween(0.2, 0.9),
    dx: Math.cos(angle) * randomBetween(0.05, 0.2),
    dy: Math.sin(angle) * randomBetween(0.05, 0.15),
  }
}

function updateParticles(w, h, targetCount) {
  if (particles.length < targetCount) {
    particles.push(createParticle(w, h))
  } else if (particles.length > targetCount) {
    particles.splice(0, particles.length - targetCount)
  }
}

// -- WIND ANIMATION --
const wind = ref({ x: 0.05, y: 0 })
let windTarget = { x: 0.05, y: 0 }

function animateWind() {
  wind.value.x += (windTarget.x - wind.value.x) * 0.1
}

watch(
  [dustDirection, dustBoost],
  ([dir, isBoost]) => {
    const force = isBoost ? 100 : 0
    if (dir === 'left') windTarget.x = force
    else if (dir === 'right') windTarget.x = -force
  },
  { immediate: true }
)

// --- CANVAS ANIMATE ---
function animate() {
  animateWind()

  context.clearRect(0, 0, width, height)
  const now = Date.now() / 1000
  const variation = (Math.sin(now * 0.15) + 1) / 2
  const targetCount = Math.floor(
    minParticles + (maxParticles - minParticles) * variation
  )
  updateParticles(width, height, targetCount)
  for (const p of particles) {
    p.x += wind.value.x + p.dx
    p.y += wind.value.y + p.dy
    if (p.x < 0) p.x = width
    if (p.x > width) p.x = 0
    if (p.y < 0) p.y = height
    if (p.y > height) p.y = 0

    context.save()
    context.globalAlpha = p.alpha
    context.beginPath()
    context.arc(p.x, p.y, p.radius, 0, 2 * Math.PI)
    context.fillStyle = '#fff'
    context.shadowColor = '#fff'
    context.shadowBlur = 10
    context.fill()
    context.restore()
  }
  animationId = requestAnimationFrame(animate)
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1
  width = window.innerWidth
  height = window.innerHeight
  canvas.value.width = width * dpr
  canvas.value.height = height * dpr
  canvas.value.style.width = width + 'px'
  canvas.value.style.height = height + 'px'
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
}

onMounted(() => {
  context = canvas.value.getContext('2d')
  resizeCanvas()
  for (let i = 0; i < minParticles; i++) {
    particles.push(createParticle(width, height))
  }
  window.addEventListener('resize', resizeCanvas)
  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<style scoped>
.dust-canvas {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  background: #000;
  width: 100vw;
  height: 100vh;
  display: block;
  pointer-events: none;
}
</style>
