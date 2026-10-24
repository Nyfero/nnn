import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { safeRedirect } from '@/utils/redirect'

const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/LoginView.vue') },
  {
    path: '/',
    name: 'Lobby',
    component: () => import('@/views/LobbyView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/unlock',
    name: 'Unlock',
    component: () => import('@/views/UnlockView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/AdminView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

// "/passwords/" n'est pas une route du core : navigation complète vers le module
export const isCoreRoute = (path) => !!router.resolve(path).name

export function navigateAfterAuth(redirect) {
  const target = safeRedirect(redirect)
  if (!target) return router.push({ name: 'Lobby' })
  if (isCoreRoute(target)) return router.push(target)
  window.location.assign(target)
}

let initialized = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!initialized) {
    await auth.initAuth()
    initialized = true
  }

  const target = safeRedirect(to.query.redirect)

  if (to.name === 'Login') {
    // Les liens des emails (?token=) doivent rester accessibles même connecté
    if (auth.isAuthenticated && !to.query.token) {
      if (target && !isCoreRoute(target)) {
        window.location.assign(target)
        return false
      }
      return target ?? { name: 'Lobby' }
    }
    return true
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'Login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : {},
    }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'Lobby' }

  // Page de déverrouillage inutile si la clé est déjà là
  if (to.name === 'Unlock' && !auth.isLocked) {
    if (target && !isCoreRoute(target)) {
      window.location.assign(target)
      return false
    }
    return target ?? { name: 'Lobby' }
  }

  return true
})

export default router
