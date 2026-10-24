// La clé maître est une CryptoKey HKDF non extractable : stockable dans IndexedDB
// (clonage structuré), utilisable pour dériver des clés, jamais exportable.
// Elle est liée au user_id pour qu'un autre compte sur le même navigateur ne la réutilise pas.

const DB_NAME = 'myprout'
const STORE = 'keys'
const KEY = 'master'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req?.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export const saveMasterKey = (key, userId) =>
  run('readwrite', (s) => s.put({ key, userId }, KEY))

export async function loadMasterKey(userId) {
  const entry = await run('readonly', (s) => s.get(KEY))
  return entry && entry.userId === userId ? entry.key : null
}

export const hasMasterKey = async (userId) => !!(await loadMasterKey(userId))

export const clearMasterKey = () => run('readwrite', (s) => s.delete(KEY))

// Pour les modules : clé AES-GCM dédiée dérivée de la clé maître
import { deriveModuleKey } from './crypto.js'

export async function getModuleKey(moduleId, userId) {
  const master = await loadMasterKey(userId)
  if (!master) throw new Error('MASTER_KEY_MISSING')
  return deriveModuleKey(master, moduleId)
}
