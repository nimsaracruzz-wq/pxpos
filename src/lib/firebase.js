import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app'
import { getFirestore, doc, setDoc, collection, writeBatch } from 'firebase/firestore'
import { useAppStore, useSalesStore, useProductStore } from '@/store'

// ─── Paxxmo POS – Firebase Project Config ───────────────────────────────────
const HARDCODED_CONFIG = {
  apiKey:            "AIzaSyAXL7uGGsIXNbwHHnNkr0D2zfvU4E8Cmc8",
  authDomain:        "pxpos-7d777.firebaseapp.com",
  projectId:         "pxpos-7d777",
  storageBucket:     "pxpos-7d777.firebasestorage.app",
  messagingSenderId: "759604307830",
  appId:             "1:759604307830:web:09668e1b4e2ff4740cbc57",
  measurementId:     "G-N0F75CXC4W",
}

let db = null

/**
 * Initializes or re-initializes Firebase.
 *
 * Priority:
 *  1. Hardcoded project config above (always works out of the box)
 *  2. JSON pasted by user in Settings → Cloud Sync (overrides #1 if valid)
 */
export async function initializeFirebase() {
  try {
    const { cloudSettings } = useAppStore.getState()

    // Allow user to override via Settings JSON, otherwise use hardcoded config
    let config = HARDCODED_CONFIG
    if (cloudSettings?.provider === 'firebase' && cloudSettings?.firebaseConfig) {
      try {
        const parsed = JSON.parse(cloudSettings.firebaseConfig)
        if (parsed?.projectId) config = parsed
      } catch (_) {
        // Bad JSON → fall back to hardcoded
      }
    }

    // Tear down existing app before reinitialising with (possibly new) config
    if (getApps().length > 0) {
      await deleteApp(getApp())
    }

    const app = initializeApp(config)
    db = getFirestore(app)
    return true
  } catch (error) {
    console.error('[Firebase] Initialisation error:', error)
    db = null
    return false
  }
}

/**
 * Background Sync Engine
 * Mirrors local IndexedDB slices to Firestore collections under stores/{storeId}
 */
export async function syncToCloud() {
  if (!db) {
    const ok = await initializeFirebase()
    if (!ok) return false
  }

  try {
    const { sales }              = useSalesStore.getState()
    const { products }           = useProductStore.getState()
    const { businessInfo }       = useAppStore.getState()

    const storeId = businessInfo.taxId || 'default-store'
    const batch   = writeBatch(db)

    // 1. Business info
    batch.set(
      doc(db, 'stores', storeId),
      { ...businessInfo, lastSync: new Date().toISOString() },
      { merge: true }
    )

    // 2. Products
    const productsRef = collection(db, 'stores', storeId, 'products')
    products.forEach(p => batch.set(doc(productsRef, p.id), p))

    // 3. Last 100 sales (stays within Firestore's 500-write batch limit)
    const salesRef = collection(db, 'stores', storeId, 'sales')
    sales.slice(0, 100).forEach(s =>
      batch.set(doc(salesRef, s.id), { ...s, date: new Date(s.date).toISOString() })
    )

    await batch.commit()
    return true
  } catch (error) {
    console.error('[Firebase] Sync failed:', error)
    return false
  }
}

/**
 * Test Firebase connection – called by Settings → Cloud Sync "Test Connection" button.
 */
export async function testCloudConnection() {
  const ok = await initializeFirebase()
  if (!ok) throw new Error('Failed to initialise Firebase. Check your project config.')

  try {
    const { businessInfo } = useAppStore.getState()
    const storeId = businessInfo.taxId || 'default-store'
    await setDoc(
      doc(db, 'stores', storeId),
      { lastConnectionTest: new Date().toISOString() },
      { merge: true }
    )
    return true
  } catch (error) {
    console.error('[Firebase] Connection test error:', error)
    throw error
  }
}
