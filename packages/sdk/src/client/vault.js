import {
  decryptKey,
  deriveKek,
  encryptKey,
  generateMasterKeyHex,
  generateSalt,
  importMasterKey,
  recoveryPassphrase,
} from './crypto.js'
import { saveMasterKey } from './keystore.js'

export class VaultError extends Error {
  constructor(message = 'Déchiffrement impossible') {
    super(message)
    this.name = 'VaultError'
  }
}

// Activation du compte : génère la clé maître et ses deux versions chiffrées.
// Le serveur ne reçoit que ces blobs, jamais la clé.
export async function createVault(password, answers) {
  const masterKey = generateMasterKeyHex()
  const kek_salt = generateSalt()
  const recovery_kek_salt = generateSalt()
  const kek = await deriveKek(password, kek_salt)
  const recoveryKek = await deriveKek(
    recoveryPassphrase(answers),
    recovery_kek_salt
  )
  return {
    encrypted_master_key: await encryptKey(masterKey, kek),
    kek_salt,
    recovery_encrypted_master_key: await encryptKey(masterKey, recoveryKek),
    recovery_kek_salt,
  }
}

// Déchiffre la clé maître avec le mot de passe (échoue si le mot de passe est faux)
export async function decryptMasterKeyHex(
  password,
  { kek_salt, encrypted_master_key }
) {
  try {
    const kek = await deriveKek(password, kek_salt)
    return await decryptKey(encrypted_master_key, kek)
  } catch {
    throw new VaultError()
  }
}

// Login / déverrouillage : déchiffre puis place la clé dans IndexedDB (non extractable)
export async function unlockMasterKey(password, user) {
  const hex = await decryptMasterKeyHex(password, user)
  await saveMasterKey(await importMasterKey(hex), user.user_id)
}

// Reset : retrouve la clé maître avec les réponses aux questions de sécurité
export async function recoverMasterKeyHex(
  answers,
  { recovery_encrypted_master_key, recovery_kek_salt }
) {
  try {
    const kek = await deriveKek(recoveryPassphrase(answers), recovery_kek_salt)
    return await decryptKey(recovery_encrypted_master_key, kek)
  } catch {
    throw new VaultError('Réponses incorrectes')
  }
}

// Rechiffre la clé maître pour un nouveau mot de passe (nouveau sel)
export async function wrapMasterKey(masterKeyHex, newPassword) {
  const kek_salt = generateSalt()
  const kek = await deriveKek(newPassword, kek_salt)
  return { encrypted_master_key: await encryptKey(masterKeyHex, kek), kek_salt }
}

// Changement de mot de passe : ancien mot de passe -> clé maître -> nouveau blob
export async function rewrapForNewPassword(oldPassword, newPassword, user) {
  const hex = await decryptMasterKeyHex(oldPassword, user)
  return wrapMasterKey(hex, newPassword)
}
