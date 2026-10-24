<template>
  <div class="login-container">
    <Transition :name="transitionName" mode="out-in">
      <Recovery
        v-if="showRecovery"
        key="recovery"
        :token="pendingToken"
        :password="pendingPassword"
        :mode="recoveryMode"
        @back="goPassword"
        @switch="goLogin"
        @verified="goPasswordReset"
      />
      <Password
        v-else-if="showPassword"
        key="password"
        :token="pendingToken"
        :mode="passwordMode"
        :master-key="pendingMasterKey"
        @next="goRecovery"
        @switch="goLogin"
      />
      <VerifyEmail
        v-else-if="showVerifyEmail"
        key="verifyEmail"
        :token="pendingToken"
        @switch="goLogin"
      />
      <Login v-else-if="!showRegister" key="login" @switch="goRegister" />
      <Register v-else key="register" @switch="goLogin" />
    </Transition>
    <span class="version">{{ version }}</span>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setDustDirection, resetDustBoost } from '@myprout/ui'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/components/login/Login.vue'
import Register from '@/components/login/Register.vue'
import Password from '@/components/login/Password.vue'
import Recovery from '@/components/login/Recovery.vue'
import VerifyEmail from '@/components/login/VerifyEmail.vue'

const version = __APP_VERSION__
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const showRegister = ref(false)
const showPassword = ref(false)
const showRecovery = ref(false)
const showVerifyEmail = ref(false)
const transitionName = ref('slide-left')

const recoveryMode = ref('set') // 'set' | 'verify'
const passwordMode = ref('set') // 'set' | 'reset'

// Données qui transitent entre les étapes (en mémoire uniquement)
const pendingToken = ref('')
const pendingPassword = ref('')
const pendingMasterKey = ref('')

onMounted(() => {
  const { token, mode } = route.query
  if (typeof token !== 'string') return
  pendingToken.value = token
  if (mode === 'reset') {
    recoveryMode.value = 'verify'
    showRecovery.value = true
  } else if (mode === 'set') {
    showPassword.value = true
  } else {
    showVerifyEmail.value = true
  }
})

function slide(dir) {
  setDustDirection(dir, true)
  setTimeout(resetDustBoost, 800)
  transitionName.value = dir === 'left' ? 'slide-left' : 'slide-right'
}

function goRegister() {
  slide('left')
  showRegister.value = true
}

async function goLogin() {
  const finishedTokenFlow = !!route.query.token

  slide('right')
  showRegister.value = false
  showPassword.value = false
  showRecovery.value = false
  showVerifyEmail.value = false
  passwordMode.value = 'set'
  recoveryMode.value = 'set'
  pendingToken.value = ''
  pendingPassword.value = ''
  pendingMasterKey.value = ''

  if (finishedTokenFlow) {
    // Le lien concerne un autre compte (ou a révoqué les sessions) : on repart d'une session propre
    if (auth.isAuthenticated) await auth.logout()
    router.replace({ name: 'Login', query: {} })
  }
}

function goPassword() {
  transitionName.value = 'slide-right'
  showRecovery.value = false
  showPassword.value = true
}

function goPasswordReset({ token, masterKey }) {
  pendingToken.value = token
  pendingMasterKey.value = masterKey
  passwordMode.value = 'reset'
  transitionName.value = 'slide-left'
  showRecovery.value = false
  showPassword.value = true
}

function goRecovery({ token, password }) {
  pendingToken.value = token
  pendingPassword.value = password
  recoveryMode.value = 'set'
  transitionName.value = 'slide-left'
  showPassword.value = false
  showRecovery.value = true
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  overflow-x: hidden;
  position: relative;
}

.version {
  position: fixed;
  bottom: 30px;
  right: 50px;
  z-index: 100;
  cursor: default;
  color: grey;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.6s cubic-bezier(0.6, 0.01, 0.39, 0.97);
  position: absolute;
}
.slide-left-enter-from {
  opacity: 0;
  transform: translateX(120vw);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-120vw);
}
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-120vw);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(120vw);
}
.slide-left-enter-to,
.slide-left-leave-from,
.slide-right-enter-to,
.slide-right-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
