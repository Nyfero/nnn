// `key` est la CryptoKey AES-GCM du module (HKDF(master_key, "module:passwords"))

export const encryptPassword = async (text, key) => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  )

  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.byteLength)

  return btoa(String.fromCharCode(...combined))
}

export const decryptPassword = async (encryptedBase64, key) => {
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12) },
    key,
    combined.slice(12)
  )
  return new TextDecoder().decode(decrypted)
}
