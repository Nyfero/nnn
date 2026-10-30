import { defineStore } from 'pinia'
import { markRaw } from 'vue'

export const MODULE_ID = 'files'

// Session venant du core (token + profil) et clé AES propre à ce module,
// utilisée uniquement pour protéger les clés des coffres.
export const useSession = defineStore('session', {
  state: () => ({ user: null, token: null, moduleKey: null }),
  getters: {
    isAdmin: (s) => !!s.user?.isAdmin,
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
