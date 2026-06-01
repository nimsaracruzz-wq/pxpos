import { createClient } from '@supabase/supabase-js'
import { useAppStore, useSalesStore, useProductStore, useTableStore, useCustomerStore, useActivityStore, useRecipeStore, useAuthStore, useElectronicsStore } from '@/store'

// ─── Supabase Client Initialization ──────────────────────────────────────────
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-public-key').trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Resolve Tenant / Store ID ───────────────────────────────────────────────
export function resolveCloudTenantId(businessInfo = {}, licenseKey = '') {
  const normalizedLicenseKey = String(licenseKey || '').trim().toUpperCase()
  return normalizedLicenseKey || String(businessInfo?.storeId || '').trim() || ''
}

// ─── Legacy Firebase Initializer compatibility ──────────────────────────────
export async function initializeFirebase() {
  return true
}

// ─── Unified Cloud Sync Engine (POS -> Supabase) ─────────────────────────────
export async function syncToCloud() {
  try {
    const { sales }        = useSalesStore.getState()
    const { products }     = useProductStore.getState()
    const { tables, kots } = useTableStore.getState()
    const { customers }    = useCustomerStore.getState()
    const { logs }         = useActivityStore.getState()
    const { recipes }      = useRecipeStore.getState()
    const { users }        = useAuthStore.getState()
    const { elProducts, serials, elSuppliers, elGRNs, elSales, repairJobs, elCustomers, warranties } = useElectronicsStore.getState()
    const { businessInfo, licenseKey, cloudSubscription } = useAppStore.getState()

    const storeId = resolveCloudTenantId(businessInfo, licenseKey)
    if (!storeId) return false

    const now = new Date().toISOString()
    const entries = []

    // 1. Store metadata
    entries.push({
      store_id: storeId,
      collection_name: 'metadata',
      doc_id: 'store',
      data: { ...businessInfo, tenantId: storeId, licenseKey, lastSync: now },
      updated_at: now,
    })

    // 2. Store settings
    entries.push({
      store_id: storeId,
      collection_name: 'settings',
      doc_id: 'app',
      data: {
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
      updated_at: now,
    })

    // 3. POS collections
    products.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'products', doc_id: String(item.id), data: item, updated_at: now })
    })

    sales.slice(0, 1000).forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'sales', doc_id: String(item.id), data: item, updated_at: now })
    })

    tables.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'tables', doc_id: String(item.id), data: item, updated_at: now })
    })

    kots.slice(0, 1000).forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'kots', doc_id: String(item.id), data: item, updated_at: now })
    })

    customers.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'customers', doc_id: String(item.id), data: item, updated_at: now })
    })

    logs.slice(0, 1000).forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'activity_logs', doc_id: String(item.id), data: item, updated_at: now })
    })

    Object.entries(recipes || {}).forEach(([dishId, recipeItems]) => {
      if (!dishId) return
      entries.push({
        store_id: storeId,
        collection_name: 'recipes',
        doc_id: String(dishId),
        data: { dishId: String(dishId), ingredients: Array.isArray(recipeItems) ? recipeItems : [] },
        updated_at: now,
      })
    })

    users.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'users', doc_id: String(item.id), data: item, updated_at: now })
    })

    // Electronics Shop collections
    elProducts.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_products', doc_id: String(item.id), data: item, updated_at: now })
    })
    serials.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_serials', doc_id: String(item.id), data: item, updated_at: now })
    })
    elSuppliers.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_suppliers', doc_id: String(item.id), data: item, updated_at: now })
    })
    elGRNs.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_grns', doc_id: String(item.id), data: item, updated_at: now })
    })
    elSales.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_sales', doc_id: String(item.id), data: item, updated_at: now })
    })
    repairJobs.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_repair_jobs', doc_id: String(item.id), data: item, updated_at: now })
    })
    elCustomers.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_customers', doc_id: String(item.id), data: item, updated_at: now })
    })
    warranties.forEach((item) => {
      if (!item?.id) return
      entries.push({ store_id: storeId, collection_name: 'electronics_warranties', doc_id: String(item.id), data: item, updated_at: now })
    })

    // Write to Supabase in chunks of 200
    const chunkSize = 200
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('store_data')
        .upsert(chunk, { onConflict: 'store_id,collection_name,doc_id' })
      if (error) throw error
    }

    return true
  } catch (error) {
    console.error('[Supabase] syncToCloud failed:', error)
    return false
  }
}

// ─── Unified Cloud Pull Engine (Supabase -> POS) ─────────────────────────────
export async function pullFromCloud() {
  try {
    const { businessInfo, licenseKey } = useAppStore.getState()
    const storeId = resolveCloudTenantId(businessInfo, licenseKey)
    if (!storeId) return false

    const { data, error } = await supabase
      .from('store_data')
      .select('collection_name,doc_id,data')
      .eq('store_id', storeId)

    if (error) throw error

    const collections = {}
    data.forEach((row) => {
      if (!collections[row.collection_name]) {
        collections[row.collection_name] = []
      }
      collections[row.collection_name].push(row.data)
    })

    // Populate Zustand stores
    if (collections.products) {
      useProductStore.setState({ products: collections.products })
    }
    if (collections.sales) {
      useSalesStore.setState({ sales: collections.sales })
    }
    if (collections.tables) {
      useTableStore.setState({ tables: collections.tables })
    }
    if (collections.kots) {
      useTableStore.setState({ kots: collections.kots })
    }
    if (collections.customers) {
      useCustomerStore.setState({ customers: collections.customers })
    }
    if (collections.activity_logs) {
      useActivityStore.setState({ logs: collections.activity_logs })
    }
    if (collections.recipes) {
      const recipesMap = {}
      collections.recipes.forEach((r) => {
        if (r.dishId) recipesMap[r.dishId] = r.ingredients || []
      })
      useRecipeStore.setState({ recipes: recipesMap })
    }
    if (collections.users) {
      useAuthStore.setState({ users: collections.users })
    }

    // Populate Electronics Store
    useElectronicsStore.setState({
      elProducts: collections.electronics_products || [],
      serials: collections.electronics_serials || [],
      elSuppliers: collections.electronics_suppliers || [],
      elGRNs: collections.electronics_grns || [],
      elSales: collections.electronics_sales || [],
      repairJobs: collections.electronics_repair_jobs || [],
      elCustomers: collections.electronics_customers || [],
      warranties: collections.electronics_warranties || [],
    })

    return true
  } catch (error) {
    console.error('[Supabase] pullFromCloud failed:', error)
    return false
  }
}

export async function syncWithCloud() {
  const pulled = await pullFromCloud()
  const pushed = await syncToCloud()
  return pulled || pushed
}

// ─── Test Supabase Connection ────────────────────────────────────────────────
export async function testCloudConnection() {
  try {
    const { error } = await supabase.from('store_data').select('id').limit(1)
    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] testCloudConnection failed:', error)
    throw error
  }
}

// ─── Mobile Ordering API (Supabase Backend) ──────────────────────────────────
export async function publishQRCodeOrder(order) {
  try {
    const storeId = String(order?.storeId || '').trim()
    if (!storeId) return { success: false, error: 'Store ID is required' }

    const docId = `qr-order-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`
    const payload = {
      id: docId,
      ...order,
      status: 'new',
      createdAtMs: Date.now(),
    }

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: storeId,
        collection_name: 'qr_orders',
        doc_id: docId,
        data: payload,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return { success: true, id: docId }
  } catch (error) {
    console.error('[Supabase] publishQRCodeOrder failed:', error)
    return { success: false, error: error.message }
  }
}

export async function publishPOSOrderToQRCodeHistory(order) {
  try {
    const storeId = String(order?.storeId || '').trim()
    if (!storeId || !order?.id) return { success: false }

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: storeId,
        collection_name: 'qr_orders',
        doc_id: String(order.id),
        data: order,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('[Supabase] publishPOSOrderToQRCodeHistory failed:', error)
    return { success: false }
  }
}

export async function overwriteQRCodeHistoryWithPOSKOT(storeId, session, order) {
  try {
    const key = String(storeId || '').trim()
    if (!key || !order?.id) return false
    
    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: key,
        collection_name: 'qr_orders',
        doc_id: String(order.id),
        data: order,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] overwriteQRCodeHistoryWithPOSKOT failed:', error)
    return false
  }
}

export async function publishStoreProductUpsert(product) {
  try {
    const storeId = String(product?.storeId || '').trim()
    if (!storeId || !product?.id) return false

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: storeId,
        collection_name: 'products',
        doc_id: String(product.id),
        data: product,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] publishStoreProductUpsert failed:', error)
    return false
  }
}

export async function publishStoreProductDelete(productId) {
  try {
    const { businessInfo, licenseKey } = useAppStore.getState()
    const storeId = resolveCloudTenantId(businessInfo, licenseKey)
    if (!storeId || !productId) return false

    const { error } = await supabase
      .from('store_data')
      .delete()
      .match({ store_id: storeId, collection_name: 'products', doc_id: String(productId) })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] publishStoreProductDelete failed:', error)
    return false
  }
}

export async function updateQRCodeOrderStatus(storeId, orderId, status, meta = {}) {
  try {
    const key = String(storeId || '').trim()
    const id = String(orderId || '').trim()
    if (!key || !id) return false

    const { data: rows, error: getErr } = await supabase
      .from('store_data')
      .select('data')
      .match({ store_id: key, collection_name: 'qr_orders', doc_id: id })
      .limit(1)

    if (getErr) throw getErr

    const existingOrder = rows?.[0]?.data || { id }
    const updatedOrder = {
      ...existingOrder,
      status: String(status || 'new'),
      updatedAtMs: Date.now(),
      ...meta
    }

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: key,
        collection_name: 'qr_orders',
        doc_id: id,
        data: updatedOrder,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] updateQRCodeOrderStatus failed:', error)
    return false
  }
}

export async function markQRCodeOrderProcessed(storeId, orderId, meta = {}) {
  return updateQRCodeOrderStatus(storeId, orderId, 'accepted', {
    processedAt: new Date().toISOString(),
    processedAtMs: Date.now(),
    ...meta
  })
}

// ─── Table Sessions and QR Management ───────────────────────────────────────
export async function publishTableQrSession(storeId, tableNumber, session, token, meta = {}) {
  try {
    const key = String(storeId || '').trim()
    const tableKey = String(tableNumber || '').trim()
    if (!key || !tableKey || !session || !token) return false

    const payload = {
      storeId: key,
      tableNumber: tableKey,
      session,
      token,
      status: 'occupied',
      guests: Number(meta.guests || 0),
      updatedAtMs: Date.now(),
    }

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: key,
        collection_name: 'table_sessions',
        doc_id: tableKey,
        data: payload,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] publishTableQrSession failed:', error)
    return false
  }
}

export async function clearTableQrSession(storeId, tableNumber, meta = {}) {
  try {
    const key = String(storeId || '').trim()
    const tableKey = String(tableNumber || '').trim()
    if (!key || !tableKey) return false

    const payload = {
      storeId: key,
      tableNumber: tableKey,
      session: meta.session !== undefined ? meta.session : null,
      token: meta.token !== undefined ? meta.token : null,
      status: String(meta.status || 'available'),
      guests: meta.guests !== undefined ? Number(meta.guests || 0) : 0,
      movedToTable: meta.movedToTable !== undefined ? String(meta.movedToTable || '') : '',
      updatedAtMs: Date.now(),
    }

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: key,
        collection_name: 'table_sessions',
        doc_id: tableKey,
        data: payload,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] clearTableQrSession failed:', error)
    return false
  }
}

export async function getTableQrSession(storeId, tableNumber) {
  try {
    const key = String(storeId || '').trim()
    const tableKey = String(tableNumber || '').trim()
    if (!key || !tableKey) return null

    const { data: rows, error } = await supabase
      .from('store_data')
      .select('data')
      .match({ store_id: key, collection_name: 'table_sessions', doc_id: tableKey })
      .limit(1)

    if (error) throw error
    return rows?.[0]?.data || null
  } catch (error) {
    console.error('[Supabase] getTableQrSession failed:', error)
    return null
  }
}

export async function markNotificationRead(storeId, notificationId) {
  try {
    const key = String(storeId || '').trim()
    const id = String(notificationId || '').trim()
    if (!key || !id) return false

    const { data: rows, error: getErr } = await supabase
      .from('store_data')
      .select('data')
      .match({ store_id: key, collection_name: 'notifications', doc_id: id })
      .limit(1)

    if (getErr) throw getErr

    const existingNotification = rows?.[0]?.data || { id }
    const updatedNotification = {
      ...existingNotification,
      read: true,
      readAt: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: key,
        collection_name: 'notifications',
        doc_id: id,
        data: updatedNotification,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] markNotificationRead failed:', error)
    return false
  }
}

export async function sendNotificationToBusiness(storeId, message, type = 'info', title = 'Portal Alert') {
  try {
    const key = String(storeId || '').trim()
    if (!key) return false

    const docId = `notif-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`
    const payload = {
      id: docId,
      message: String(message),
      type: String(type),
      title: String(title),
      read: false,
      createdAt: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('store_data')
      .upsert({
        store_id: key,
        collection_name: 'notifications',
        doc_id: docId,
        data: payload,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('[Supabase] sendNotificationToBusiness failed:', error)
    return false
  }
}

function subscribeToCollection(storeId, collectionName, callback) {
  const key = String(storeId || '').trim()
  if (!key) return () => {}

  // 1. Initial collection fetch
  supabase
    .from('store_data')
    .select('data')
    .match({ store_id: key, collection_name: collectionName })
    .then(({ data, error }) => {
      if (!error && data) {
        callback(data.map((row) => row.data))
      }
    })

  // 2. Setup PostgreSQL Realtime Change channel (unfiltered to support UUIDs/dashes)
  const channel = supabase
    .channel(`realtime_${key}_${collectionName}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'store_data',
      },
      async (payload) => {
        const row = payload.new || payload.old
        if (row && String(row.store_id).trim() === key && row.collection_name === collectionName) {
          // Re-fetch the complete collection to deliver a fresh sorted array
          const { data, error } = await supabase
            .from('store_data')
            .select('data')
            .match({ store_id: key, collection_name: collectionName })
          if (!error && data) {
            callback(data.map((row) => row.data))
          }
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToStoreProducts(storeId, onProducts) {
  return subscribeToCollection(storeId, 'products', onProducts)
}

export function subscribeToQRCodeOrders(storeId, onOrder) {
  const ingestedIds = new Set()
  return subscribeToCollection(storeId, 'qr_orders', (orders) => {
    orders
      .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0))
      .forEach((order) => {
        const status = String(order.status || '').trim().toLowerCase()
        const alreadyProcessed = !!order.processedAt || !!order.processedAtMs
        if (status === 'completed' || status === 'expired' || alreadyProcessed) return

        if (!ingestedIds.has(order.id)) {
          ingestedIds.add(order.id)
          onOrder(order)
        }
      })
  })
}

export function subscribeToQRCodeOrderStatus(storeId, orderId, onStatus) {
  const key = String(storeId || '').trim()
  const id = String(orderId || '').trim()
  if (!key || !id) return () => {}

  // Initial fetch
  supabase
    .from('store_data')
    .select('data')
    .match({ store_id: key, collection_name: 'qr_orders', doc_id: id })
    .then(({ data, error }) => {
      if (!error && data?.[0]?.data) {
        onStatus(data[0].data)
      }
    })

  // Realtime change listener (unfiltered to support UUIDs/dashes)
  const channel = supabase
    .channel(`order_status_${id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'store_data',
      },
      async (payload) => {
        const row = payload.new || payload.old
        if (row && String(row.store_id).trim() === key && row.collection_name === 'qr_orders' && row.doc_id === id) {
          onStatus(row.data)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToQRCodeOrderHistory(storeId, { session, tableNumber }, onHistory) {
  return subscribeToCollection(storeId, 'qr_orders', (orders) => {
    let filtered = orders
    if (session) {
      filtered = orders.filter((o) => String(o.session || '') === String(session))
    } else if (tableNumber) {
      filtered = orders.filter((o) => String(o.tableNumber || '') === String(tableNumber))
    }
    onHistory(filtered.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0)))
  })
}

export function subscribeToTableQrSession(storeId, tableNumber, onSession) {
  const key = String(storeId || '').trim()
  const tableKey = String(tableNumber || '').trim()
  if (!key || !tableKey) return () => {}

  // Initial fetch
  supabase
    .from('store_data')
    .select('data')
    .match({ store_id: key, collection_name: 'table_sessions', doc_id: tableKey })
    .then(({ data, error }) => {
      if (!error && data?.[0]?.data) {
        onSession(data[0].data)
      } else {
        onSession(null)
      }
    })

  // Realtime listener (unfiltered to support UUIDs/dashes)
  const channel = supabase
    .channel(`table_session_${tableKey}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'store_data',
      },
      async (payload) => {
        const row = payload.new || payload.old
        if (row && String(row.store_id).trim() === key && row.collection_name === 'table_sessions' && row.doc_id === tableKey) {
          if (payload.eventType === 'DELETE') {
            onSession(null)
          } else {
            onSession(row.data)
          }
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToLiveTableOrder(storeId, tableNumber, onOrder) {
  const key = String(storeId || '').trim()
  const tableKey = String(tableNumber || '').trim()
  if (!key || !tableKey) return () => {}

  return subscribeToCollection(storeId, 'tables', (tables) => {
    const matching = tables.find((t) => String(t.number) === tableKey)
    onOrder(matching?.order || null)
  })
}

export function subscribeToStoreSettings(storeId, onSettings) {
  const key = String(storeId || '').trim()
  if (!key) return () => {}

  // Initial fetch
  supabase
    .from('store_data')
    .select('data')
    .match({ store_id: key, collection_name: 'settings', doc_id: 'app' })
    .then(({ data, error }) => {
      if (!error && data?.[0]?.data) {
        onSettings(data[0].data)
      }
    })

  // Realtime listener (unfiltered to support UUIDs/dashes)
  const channel = supabase
    .channel(`store_settings_${key}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'store_data',
      },
      async (payload) => {
        const row = payload.new || payload.old
        if (row && String(row.store_id).trim() === key && row.collection_name === 'settings' && row.doc_id === 'app') {
          onSettings(row.data)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToStoreNotifications(storeId, onNotification) {
  return subscribeToCollection(storeId, 'notifications', (notifs) => {
    onNotification(notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  })
}
