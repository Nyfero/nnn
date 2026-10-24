import { defineStore } from 'pinia'
import api from '@/services/api'
import {
  clearMasterKey,
  hasMasterKey,
  refreshSession,
  unlockMasterKey,
} from '@myprout/sdk/client'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null,
    token: null,
    hasKey: false, // la clé maître est présente dans IndexedDB
  }),
  getters: {
    isAdmin: (state) => !!state.user?.isAdmin,
    isLocked: (state) => state.isAuthenticated && !state.hasKey,
  },
  actions: {
    setSession({ token, user }) {
      this.token = token
      this.user = user
      this.isAuthenticated = true
    },

    // Au chargement : session via le cookie de refresh + présence de la clé maître
    async initAuth() {
      try {
        const data = await refreshSession()
        this.setSession(data)
        this.hasKey = await hasMasterKey(data.user.user_id)
      } catch {
        await this.clearLocal()
      }
    },

    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password })
      try {
        await unlockMasterKey(password, data.user)
      } catch (e) {
        await api.post('/auth/logout').catch(() => {})
        throw e
      }
      this.setSession(data)
      this.hasKey = true
    },

    // Clé maître absente (IndexedDB vidée) : redemande le mot de passe
    async unlockKey(password) {
      await unlockMasterKey(password, this.user)
      this.hasKey = true
    },

    updateCryptoBlob({ encrypted_master_key, kek_salt }) {
      Object.assign(this.user, { encrypted_master_key, kek_salt })
    },

    async logout() {
      try {
        await api.post('/auth/logout')
      } catch {
        /* le cookie sera ignoré / expirera */
      }
      await this.clearLocal()
    },

    async clearLocal() {
      await clearMasterKey().catch(() => {})
      this.isAuthenticated = false
      this.user = null
      this.token = null
      this.hasKey = false
    },
  },
})
