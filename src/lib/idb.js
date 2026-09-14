// Tiny IndexedDB wrapper for storing uploaded document blobs in LOCAL MODE.
const DB = 'paradiem_planning', STORE = 'files'
function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export async function idbPut(key, blob) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error)
  })
}
export async function idbGet(key) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error)
  })
}
export async function idbDel(key) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error)
  })
}
