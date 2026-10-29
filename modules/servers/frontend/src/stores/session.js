import { defineStore } from 'pinia'

export const MODULE_ID = 'servers'

// Session venant du core (token + profil). Ce module ne chiffre rien : pas de clé maître.
export const useSession = defineStore('session', {
  state: () => ({ user: null, token: null }),
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
  },
})
