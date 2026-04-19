import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app'
import { getFirestore, doc, setDoc, deleteDoc, collection, writeBatch, addDoc, onSnapshot, query, where, updateDoc, serverTimestamp, limit } from 'firebase/firestore'
import { useAppStore, useSalesStore, useProductStore, useTableStore, useCustomerStore, useActivityStore, useRecipeStore, useAuthStore } from '@/store'
import { DEFAULT_FIREBASE_CONFIG } from '@/lib/defaultFirebaseConfig'

// ─── Paxxmo POS – Firebase Project Config ───────────────────────────────────
const HARDCODED_CONFIG = DEFAULT_FIREBASE_CONFIG

let db = null

export function resolveCloudTenantId(businessInfo = {}, licenseKey = '') {
  return String(licenseKey || businessInfo?.storeId || businessInfo?.taxId || '').trim()
}

function getCloudStoreIds(businessInfo = {}, licenseKey = '') {
  const tenantId = resolveCloudTenantId(businessInfo, licenseKey)
  return tenantId ? [tenantId] : []
}

async function commitSetEntriesInChunks(entries = [], chunkSize = 400) {
  if (!db || !Array.isArray(entries) || entries.length === 0) return

  for (let index = 0; index < entries.length; index += chunkSize) {
    const chunk = entries.slice(index, index + chunkSize)
    const batch = writeBatch(db)
    chunk.forEach((entry) => {
      if (!entry?.ref) return
      batch.set(entry.ref, entry.data || {}, entry.options || undefined)
    })
    await batch.commit()
  }
}

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
    const { tables, kots } = useTableStore.getState()
    const { customers }    = useCustomerStore.getState()
    const { logs }         = useActivityStore.getState()
    const { recipes }      = useRecipeStore.getState()
    const { users }        = useAuthStore.getState()
    const { businessInfo, licenseKey, cloudSubscription } = useAppStore.getState()

    if (cloudSubscription?.deploymentMode !== 'cloud' || cloudSubscription?.status === 'inactive') {
      return false
    }

    // Each business/client is isolated by a single tenant key (license key preferred).
    const storeIds = getCloudStoreIds(businessInfo, licenseKey)
    const storeId = storeIds[0] || 'default-store'
    const now = new Date().toISOString()

    // 1. Store-level metadata and settings.
    await setDoc(
      doc(db, 'stores', storeId),
      {
        ...businessInfo,
        tenantId: storeId,
        licenseKey: String(licenseKey || '').trim().toUpperCase(),
        lastSync: now,
      },
      { merge: true }
    )

    await setDoc(
      doc(db, 'stores', storeId, 'settings', 'app'),
      {
        businessInfo,
        taxSettings: useAppStore.getState().taxSettings,
        serviceChargeSettings: useAppStore.getState().serviceChargeSettings,
        receiptSettings: useAppStore.getState().receiptSettings,
        hardwareSettings: useAppStore.getState().hardwareSettings,
        modules: useAppStore.getState().modules,
        activeModule: useAppStore.getState().activeModule,
        cloudSubscription,
        updatedAt: now,
      },
      { merge: true }
    )

    // 2. Build all collection writes and commit in chunks.
    const entries = []

    const productsRef = collection(db, 'stores', storeId, 'products')
    products.forEach((item) => {
      if (!item?.id) return
      entries.push({ ref: doc(productsRef, String(item.id)), data: { ...item, storeId } })
    })

    const salesRef = collection(db, 'stores', storeId, 'sales')
    sales.slice(0, 1000).forEach((item) => {
      if (!item?.id) return
      const saleDate = item.date ? new Date(item.date).toISOString() : now
      entries.push({ ref: doc(salesRef, String(item.id)), data: { ...item, date: saleDate } })
    })

    const tablesRef = collection(db, 'stores', storeId, 'tables')
    tables.forEach((item) => {
      if (!item?.id) return
      entries.push({ ref: doc(tablesRef, String(item.id)), data: item })
    })

    const kotsRef = collection(db, 'stores', storeId, 'kots')
    kots.slice(0, 1000).forEach((item) => {
      if (!item?.id) return
      entries.push({ ref: doc(kotsRef, String(item.id)), data: item })
    })

    const customersRef = collection(db, 'stores', storeId, 'customers')
    customers.forEach((item) => {
      if (!item?.id) return
      entries.push({ ref: doc(customersRef, String(item.id)), data: item })
    })

    const logsRef = collection(db, 'stores', storeId, 'activity_logs')
    logs.slice(0, 1000).forEach((item) => {
      if (!item?.id) return
      entries.push({ ref: doc(logsRef, String(item.id)), data: item })
    })

    const recipesRef = collection(db, 'stores', storeId, 'recipes')
    Object.entries(recipes || {}).forEach(([dishId, recipeItems]) => {
      if (!dishId) return
      entries.push({ ref: doc(recipesRef, String(dishId)), data: { dishId: String(dishId), ingredients: Array.isArray(recipeItems) ? recipeItems : [] } })
    })

    const usersRef = collection(db, 'stores', storeId, 'users')
    users.forEach((item) => {
      if (!item?.id) return
      entries.push({ ref: doc(usersRef, String(item.id)), data: item })
    })

    await commitSetEntriesInChunks(entries, 350)
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
    const { businessInfo, licenseKey } = useAppStore.getState()
    const storeId = resolveCloudTenantId(businessInfo, licenseKey) || 'default-store'
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
    const storeIds = getCloudStoreIds(businessInfo, licenseKey)
    if (!storeIds.length) return { success: false, error: 'Store ID is required' }

    const productId = String(product?.id || '').trim()
    if (!productId) return { success: false, error: 'Product ID is required' }

    await Promise.all(storeIds.map((storeId) => setDoc(doc(rdb, 'stores', storeId, 'products', productId), {
      ...product,
      id: productId,
      storeId,
      module: String(product?.module || '').trim(),
      name: String(product?.name || '').trim(),
      category: String(product?.category || '').trim(),
      barcode: String(product?.barcode || '').trim(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true })))

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
    const storeIds = getCloudStoreIds(businessInfo, licenseKey)
    if (!storeIds.length || !productId) return { success: false, error: 'Store ID and product ID are required' }

    await Promise.all(storeIds.map((storeId) => deleteDoc(doc(rdb, 'stores', storeId, 'products', String(productId)))))
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
