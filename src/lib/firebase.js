import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app'
import { getFirestore, doc, setDoc, deleteDoc, collection, writeBatch, addDoc, onSnapshot, query, where, updateDoc, serverTimestamp, limit } from 'firebase/firestore'
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

function getEffectiveFirebaseConfig() {
  const { cloudSettings } = useAppStore.getState()
  if (cloudSettings?.provider === 'firebase' && cloudSettings?.firebaseConfig) {
    try {
      const parsed = JSON.parse(cloudSettings.firebaseConfig)
      if (parsed?.projectId) return parsed
    } catch (_) {
      // Ignore invalid JSON and fall back to bundled project.
    }
  }
  return HARDCODED_CONFIG
}

function ensureRealtimeDb() {
  if (db) return db
  try {
    const config = getEffectiveFirebaseConfig()
    const app = getApps().length > 0 ? getApp() : initializeApp(config)
    db = getFirestore(app)
    return db
  } catch (error) {
    console.error('[Firebase] Realtime DB init failed:', error)
    return null
  }
}

/**
 * Initializes or re-initializes Firebase.
 *
 * Priority:
 *  1. Hardcoded project config above (always works out of the box)
 *  2. JSON pasted by user in Settings → Cloud Sync (overrides #1 if valid)
 */
export async function initializeFirebase() {
  try {
    const { cloudSettings, cloudSubscription } = useAppStore.getState()

    if (cloudSubscription?.deploymentMode !== 'cloud' || cloudSubscription?.status === 'inactive') {
      db = null
      return false
    }

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
    const { sales }        = useSalesStore.getState()
    const { products }     = useProductStore.getState()
    const { businessInfo, licenseKey, cloudSubscription } = useAppStore.getState()

    if (cloudSubscription?.deploymentMode !== 'cloud' || cloudSubscription?.status === 'inactive') {
      return false
    }

    // Each business is isolated by their storeId (random UUID)
    // storeId is used for QR links and menu subscriptions
    // Keep licenseKey as a fallback for older setups.
    const storeId = businessInfo.storeId || businessInfo.taxId || licenseKey || 'default-store'
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
    const storeId = businessInfo.storeId || businessInfo.taxId || 'default-store'
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

// ─── Realtime QR Ordering Channel ───────────────────────────────────────────
export async function publishQRCodeOrder(order) {
  try {
    const rdb = ensureRealtimeDb()
    if (!rdb) return { success: false, error: 'Realtime database unavailable' }

    const storeId = String(order?.storeId || '').trim()
    if (!storeId) return { success: false, error: 'Store ID is required' }

    const payload = {
      storeId,
      tableNumber: String(order.tableNumber || ''),
      session: String(order.session || ''),
      token: String(order.token || ''),
      guests: Number(order.guests || 0),
      customerName: order.customerName || 'Guest',
      notes: order.notes || '',
      items: Array.isArray(order.items) ? order.items : [],
      total: Number(order.total || 0),
      subtotal: Number(order.subtotal || order.total || 0),
      tax: Number(order.tax || 0),
      serviceCharge: Number(order.serviceCharge || 0),
      source: 'qr',
      status: 'new',
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    }

    const ref = await addDoc(collection(rdb, 'stores', storeId, 'qr_orders'), payload)
    return { success: true, id: ref.id }
  } catch (error) {
    console.error('[Firebase] publishQRCodeOrder failed:', error)
    return { success: false, error: error?.message || 'Failed to publish QR order' }
  }
}

export async function publishPOSOrderToQRCodeHistory(order) {
  try {
    const rdb = ensureRealtimeDb()
    if (!rdb) return { success: false, error: 'Realtime database unavailable' }

    const storeId = String(order?.storeId || '').trim()
    if (!storeId) return { success: false, error: 'Store ID is required' }

    const payload = {
      storeId,
      tableNumber: String(order.tableNumber || ''),
      session: String(order.session || ''),
      token: String(order.token || ''),
      guests: Number(order.guests || 0),
      customerName: order.customerName || 'Table Service',
      notes: order.notes || '',
      items: Array.isArray(order.items) ? order.items : [],
      subtotal: Number(order.subtotal || 0),
      tax: Number(order.tax || 0),
      serviceCharge: Number(order.serviceCharge || 0),
      total: Number(order.total || 0),
      source: 'pos',
      status: String(order.status || 'accepted'),
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      processedAt: serverTimestamp(),
      processedAtMs: Date.now(),
      processedBy: String(order.processedBy || 'desktop-pos'),
    }

    const ref = await addDoc(collection(rdb, 'stores', storeId, 'qr_orders'), payload)
    return { success: true, id: ref.id }
  } catch (error) {
    console.error('[Firebase] publishPOSOrderToQRCodeHistory failed:', error)
    return { success: false, error: error?.message || 'Failed to publish POS order history' }
  }
}

export function subscribeToStoreProducts(storeId, onProducts) {
  try {
    const key = String(storeId || '').trim()
    if (!key) return () => {}

    const rdb = ensureRealtimeDb()
    if (!rdb) return () => {}

    const q = query(collection(rdb, 'stores', key, 'products'), limit(1000))
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      onProducts(items)
    })
  } catch (error) {
    console.error('[Firebase] subscribeToStoreProducts failed:', error)
    return () => {}
  }
}

export async function publishStoreProductUpsert(product) {
  try {
    const rdb = ensureRealtimeDb()
    if (!rdb) return { success: false, error: 'Realtime database unavailable' }

    const { businessInfo, licenseKey } = useAppStore.getState()
    const storeId = String(businessInfo?.taxId || licenseKey || '').trim()
    if (!storeId) return { success: false, error: 'Store ID is required' }

    const productId = String(product?.id || '').trim()
    if (!productId) return { success: false, error: 'Product ID is required' }

    await setDoc(doc(rdb, 'stores', storeId, 'products', productId), {
      ...product,
      id: productId,
      module: String(product?.module || '').trim(),
      name: String(product?.name || '').trim(),
      category: String(product?.category || '').trim(),
      barcode: String(product?.barcode || '').trim(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true })

    return { success: true, id: productId }
  } catch (error) {
    console.error('[Firebase] publishStoreProductUpsert failed:', error)
    return { success: false, error: error?.message || 'Failed to publish product' }
  }
}

export async function publishStoreProductDelete(productId) {
  try {
    const rdb = ensureRealtimeDb()
    if (!rdb) return { success: false, error: 'Realtime database unavailable' }

    const { businessInfo, licenseKey } = useAppStore.getState()
    const storeId = String(businessInfo?.taxId || licenseKey || '').trim()
    if (!storeId || !productId) return { success: false, error: 'Store ID and product ID are required' }

    await deleteDoc(doc(rdb, 'stores', storeId, 'products', String(productId)))
    return { success: true }
  } catch (error) {
    console.error('[Firebase] publishStoreProductDelete failed:', error)
    return { success: false, error: error?.message || 'Failed to delete product' }
  }
}

export function subscribeToQRCodeOrders(storeId, onOrder) {
  try {
    const key = String(storeId || '').trim()
    if (!key) return () => {}

    const rdb = ensureRealtimeDb()
    if (!rdb) return () => {}

    const q = query(
      collection(rdb, 'stores', key, 'qr_orders'),
      limit(100)
    )

    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0))

      docs.forEach((order) => {
        const status = String(order.status || '').trim().toLowerCase()
        const alreadyProcessed = !!order.processedAt || !!order.processedAtMs
        if (status === 'completed' || status === 'expired' || alreadyProcessed) return
        onOrder(order)
      })
    })
  } catch (error) {
    console.error('[Firebase] subscribeToQRCodeOrders failed:', error)
    return () => {}
  }
}

export async function markQRCodeOrderProcessed(storeId, orderId, meta = {}) {
  try {
    const key = String(storeId || '').trim()
    if (!key || !orderId) return

    const rdb = ensureRealtimeDb()
    if (!rdb) return

    await updateDoc(doc(rdb, 'stores', key, 'qr_orders', orderId), {
      status: 'accepted',
      processedAt: serverTimestamp(),
      processedBy: meta.processedBy || 'desktop-pos',
      processedAtMs: Date.now(),
    })
  } catch (error) {
    console.error('[Firebase] markQRCodeOrderProcessed failed:', error)
  }
}

export async function updateQRCodeOrderStatus(storeId, orderId, status, meta = {}) {
  try {
    const key = String(storeId || '').trim()
    if (!key || !orderId || !status) return

    const rdb = ensureRealtimeDb()
    if (!rdb) return

    await updateDoc(doc(rdb, 'stores', key, 'qr_orders', orderId), {
      status,
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedAtMs: Date.now(),
      ...meta,
    })
  } catch (error) {
    console.error('[Firebase] updateQRCodeOrderStatus failed:', error)
  }
}

export function subscribeToQRCodeOrderStatus(storeId, orderId, onStatus) {
  try {
    const key = String(storeId || '').trim()
    const id = String(orderId || '').trim()
    if (!key || !id) return () => {}

    const rdb = ensureRealtimeDb()
    if (!rdb) return () => {}

    return onSnapshot(doc(rdb, 'stores', key, 'qr_orders', id), (snap) => {
      if (!snap.exists()) return
      onStatus({ id: snap.id, ...snap.data() })
    })
  } catch (error) {
    console.error('[Firebase] subscribeToQRCodeOrderStatus failed:', error)
    return () => {}
  }
}

export function subscribeToQRCodeOrderHistory(storeId, { session, tableNumber }, onHistory) {
  try {
    const key = String(storeId || '').trim()
    if (!key) return () => {}

    const rdb = ensureRealtimeDb()
    if (!rdb) return () => {}

    let q = query(collection(rdb, 'stores', key, 'qr_orders'), limit(100))
    if (session) {
      q = query(collection(rdb, 'stores', key, 'qr_orders'), where('session', '==', String(session)), limit(100))
    } else if (tableNumber) {
      q = query(collection(rdb, 'stores', key, 'qr_orders'), where('tableNumber', '==', String(tableNumber)), limit(100))
    }

    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
      onHistory(history)
    })
  } catch (error) {
    console.error('[Firebase] subscribeToQRCodeOrderHistory failed:', error)
    return () => {}
  }
}

export async function publishTableQrSession(storeId, tableNumber, session, token, meta = {}) {
  try {
    const key = String(storeId || '').trim()
    const tableKey = String(tableNumber || '').trim()
    const sessionKey = String(session || '').trim()
    const tokenKey = String(token || '').trim()
    if (!key || !tableKey || !sessionKey || !tokenKey) return false

    const rdb = ensureRealtimeDb()
    if (!rdb) return false

    await setDoc(doc(rdb, 'stores', key, 'table_sessions', tableKey), {
      storeId: key,
      tableNumber: tableKey,
      session: sessionKey,
      token: tokenKey,
      status: 'occupied',
      guests: Number(meta.guests || 0),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true })
    return true
  } catch (error) {
    console.error('[Firebase] publishTableQrSession failed:', error)
    return false
  }
}

export async function clearTableQrSession(storeId, tableNumber, meta = {}) {
  try {
    const key = String(storeId || '').trim()
    const tableKey = String(tableNumber || '').trim()
    if (!key || !tableKey) return false

    const rdb = ensureRealtimeDb()
    if (!rdb) return false

    const nextStatus = String(meta.status || 'available')
    const nextSession = meta.session !== undefined ? meta.session : null
    const nextToken = meta.token !== undefined ? meta.token : null
    const nextGuests = meta.guests !== undefined ? Number(meta.guests || 0) : 0
    const movedToTable = meta.movedToTable !== undefined ? String(meta.movedToTable || '') : ''

    await setDoc(doc(rdb, 'stores', key, 'table_sessions', tableKey), {
      storeId: key,
      tableNumber: tableKey,
      session: nextSession,
      token: nextToken,
      status: nextStatus,
      guests: nextGuests,
      movedToTable,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true })
    return true
  } catch (error) {
    console.error('[Firebase] clearTableQrSession failed:', error)
    return false
  }
}

export function subscribeToTableQrSession(storeId, tableNumber, onSession) {
  try {
    const key = String(storeId || '').trim()
    const tableKey = String(tableNumber || '').trim()
    if (!key || !tableKey) return () => {}

    const rdb = ensureRealtimeDb()
    if (!rdb) return () => {}

    return onSnapshot(doc(rdb, 'stores', key, 'table_sessions', tableKey), (snap) => {
      if (!snap.exists()) {
        onSession(null)
        return
      }
      onSession({ id: snap.id, ...snap.data() })
    })
  } catch (error) {
    console.error('[Firebase] subscribeToTableQrSession failed:', error)
    return () => {}
  }
}
