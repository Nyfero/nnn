import { defineStore } from 'pinia'
import { markRaw } from 'vue'

export const MODULE_ID = 'passwords'

// Session venant du core (token + profil) et clé AES propre à ce module
export const useSession = defineStore('session', {
  state: () => ({ user: null, token: null, moduleKey: null }),
  getters: {
    isAdmin: (s) => !!s.user?.isAdmin,
    // Le core ne liste que les modules auxquels l'utilisateur a accès (tous pour un admin)
    moduleInfo: (s) => s.user?.modules?.find((m) => m.module_id === MODULE_ID) ?? null,
    hasAccess() {
      return !!this.moduleInfo
    },
  },
  actions: {
    setSession({ token, user }) {
      this.token = token
      this.user = user
    },
    setModuleKey(key) {
      this.moduleKey = markRaw(key)
    },
  },
})
