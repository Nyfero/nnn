import { useRouter } from 'vue-router'
import { rewrapForNewPassword, VaultError } from '@myprout/sdk/client'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'

export function useProfile() {
  const authStore = useAuthStore()
  const router = useRouter()

  async function logout() {
    await authStore.logout()
    router.push({ name: 'Login' })
  }

  // La clé maître est déchiffrée avec l'ancien mot de passe puis rechiffrée avec le nouveau,
  // dans le navigateur. Les modules n'ont rien à migrer.
  async function updatePassword(oldPassword, newPassword) {
    let blob
    try {
      blob = await rewrapForNewPassword(oldPassword, newPassword, authStore.user)
    } catch (e) {
      if (e instanceof VaultError) throw new Error('Ancien mot de passe incorrect')
      throw e
    }
    const { data } = await api.put('/auth/password', { oldPassword, newPassword, ...blob })
    authStore.updateCryptoBlob(data)
  }

  async function deleteAccount(password) {
    await api.delete('/auth/account', { data: { password } })
  }

  return { authStore, logout, updatePassword, deleteAccount }
}
