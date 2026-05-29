import React, { useState, useEffect, useMemo, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Settings,
  ChevronLeft, ChevronRight, Users, Warehouse, Zap,
  Truck, Utensils, BookOpen, Bell, X, ShoppingBag, Globe,
  Cloud, RefreshCw, Activity, Sun, Moon, RotateCcw, Wrench, ClipboardList
} from 'lucide-react'
import { useAppStore, useProductStore, useAuthStore, useSalesStore, useTableStore, usePOSStore, useElectronicsStore } from '@/store'
import { cn, generateReceiptNumber } from '@/lib/utils'
import { format } from 'date-fns'
import { markQRCodeOrderProcessed, resolveCloudTenantId, subscribeToQRCodeOrders, syncWithCloud, updateQRCodeOrderStatus, subscribeToStoreNotifications, markNotificationRead } from '@/lib/firebase'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/lib/i18n'
import { checkHelaQRPaymentStatus, getHelaQRConfigStatus } from '@/lib/helaqr'
import { BRAND } from '@/lib/brand'

const CORE_NAV = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav_dashboard', permission: null },
  { to: '/refunds', icon: RotateCcw, labelKey: 'Refunds', permission: 'sales' },
  { to: '/sale-history', icon: ClipboardList, labelKey: 'Sale History', permission: 'sales' },
  { to: '/products', icon: Package, labelKey: 'nav_products', permission: 'manage_inventory' },
  { to: '/inventory', icon: Warehouse, labelKey: 'nav_inventory', permission: 'manage_inventory' },
  { to: '/customers', icon: Users, labelKey: 'nav_customers', permission: 'manage_inventory' },
  { to: '/reports', icon: BarChart3, labelKey: 'nav_reports', permission: 'view_reports' },
  { to: '/logs', icon: Activity, labelKey: 'nav_logs', permission: 'view_logs' },
]

const MODULE_NAV = {
  grocery: [
    { to: '/pos', icon: ShoppingCart, labelKey: 'nav_pos', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/grn', icon: Truck, labelKey: 'nav_grn', section: 'Retail POS', permission: 'manage_inventory' },
    { to: '/batches', icon: Warehouse, labelKey: 'nav_batches', section: 'Retail POS', permission: 'manage_inventory' },
  ],
  clothing: [
    { to: '/pos', icon: ShoppingCart, labelKey: 'nav_pos', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/variants', icon: Package, labelKey: 'nav_variants', section: 'Apparel', permission: 'manage_inventory' },
    { to: '/barcodes', icon: Zap, labelKey: 'nav_labels', section: 'Apparel', permission: 'manage_inventory' },
  ],
  pharmacy: [
    { to: '/pos', icon: ShoppingCart, labelKey: 'nav_pos', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/prescriptions', icon: BookOpen, labelKey: 'nav_rx', section: 'Pharmacy Operations', permission: 'sales' },
    { to: '/batches', icon: Warehouse, labelKey: 'nav_batches', section: 'Pharmacy Operations', permission: 'manage_inventory' },
  ],
  restaurant: [
    { to: '/tables', icon: Utensils, labelKey: 'nav_tables', section: 'Restaurant', permission: 'sales' },
    { to: '/takeout', icon: ShoppingBag, labelKey: 'nav_takeout', section: 'Restaurant', permission: 'sales' },
  ],
  wholesale: [
    { to: '/pos', icon: ShoppingCart, labelKey: 'nav_pos', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/ledger', icon: BookOpen, labelKey: 'nav_ledger', section: 'Wholesale', permission: 'manage_inventory' },
  ],
  online: [
    { to: '/web-orders', icon: Globe, labelKey: 'nav_weborders', section: 'Web Integration', permission: 'manage_inventory' },
  ],
  electronics: [
    { to: '/pos', icon: ShoppingCart, labelKey: 'nav_pos', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/electronics', icon: Wrench, labelKey: 'Service & Warranty', section: 'Service Center', permission: 'sales' },
  ]
}

export function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [time, setTime] = useState(new Date())
  const [showNotif, setShowNotif] = useState(false)
  const [adminNotifications, setAdminNotifications] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(new Date())
  const ingestedQrOrderIdsRef = useRef(new Set())

  const { businessInfo, licenseKey, modules, activeModule, setActiveModule, theme, toggleTheme, cloudSubscription } = useAppStore()
  const isDark = theme === 'dark'
  const { products, getLowStock, getOutOfStock } = useProductStore()
  const { currentUser, logout, hasPermission } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()

  // ── Global barcode scanner: works from any tab ──────────────────────────────
  // Barcode scanners send chars very fast (< 50ms apart) ending with Enter.
  // If the product is found and we're NOT already on /pos, navigate there & add to cart.
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = 0
    const BARCODE_SPEED_MS = 60 // chars faster than this = scanner input
    const MIN_BARCODE_LEN  = 3

    const handleKey = (e) => {
      const now = Date.now()
      
      // If Enter is pressed, check if we have a valid barcode in the buffer
      if (e.key === 'Enter') {
        const code = buffer.trim()
        buffer = ''
        
        if (code.length < MIN_BARCODE_LEN) return

        let product = useProductStore.getState().products.find(
          p => p.active && p.barcode === code
        )
        
        // Fallback for electronics module products
        if (!product) {
          const elStore = useElectronicsStore.getState()
          if (elStore && elStore.elProducts) {
            product = elStore.elProducts.find(p => p.active && p.barcode === code)
          }
        }

        if (product) {
          e.preventDefault() // Prevent Enter from submitting forms if we caught a barcode
          
          if (product.stock <= 0) {
            toast.error(`${product.name} is out of stock`, { duration: 2500 })
            return
          }

          // If the user was focused on an input, the scanner typed the barcode into it.
          // We clear it out so it doesn't leave garbage text.
          const active = document.activeElement
          if (active && (active.tagName.toLowerCase() === 'input' || active.tagName.toLowerCase() === 'textarea')) {
            // Best effort to clear the injected barcode text
            active.value = ''
            active.blur()
          }

          // Navigate to POS and pass the scanned product
          navigate('/pos', { state: { scannedProduct: product, timestamp: Date.now() } })
          return
        }
      }

      // Track keystrokes for barcode buffer
      if (e.key.length === 1) {
        if (now - lastKeyTime > BARCODE_SPEED_MS * 3) buffer = '' // too slow — reset
        buffer += e.key
        lastKeyTime = now
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [location.pathname, navigate, toast])

  const handleManualSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    const success = await syncWithCloud()
    setIsSyncing(false)
    if (success) {
      setLastSyncTime(new Date())
      toast.success('All devices synced with cloud successfully!')
    } else {
      toast.error('Sync failed. Check your internet connection.')
    }
  }

  const notificationTtlMs = {
    low: 12 * 60 * 60 * 1000,
    out: 24 * 60 * 60 * 1000,
    expiring: 7 * 24 * 60 * 60 * 1000,
    expired: 30 * 24 * 60 * 60 * 1000,
  }

  const toTime = (value) => {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
  }

  useEffect(() => {
    const storeId = resolveCloudTenantId(businessInfo, licenseKey)
    if (!storeId) return () => {}

    const unsubNotifications = subscribeToStoreNotifications(storeId, (docs) => {
      setAdminNotifications(docs)
    })

    const unsubscribe = subscribeToQRCodeOrders(storeId, async (incoming) => {
      if (!incoming?.id || ingestedQrOrderIdsRef.current.has(incoming.id)) return

      const items = (Array.isArray(incoming.items) ? incoming.items : [])
        .map((item) => ({
          ...item,
          qty: Number(item.qty || 0),
          price: Number(item.price || item.salePrice || 0),
          salePrice: Number(item.salePrice || item.price || 0),
        }))
        .filter((item) => item.qty > 0)

      ingestedQrOrderIdsRef.current.add(incoming.id)

      if (!items.length) {
        await markQRCodeOrderProcessed(storeId, incoming.id)
        return
      }

      const tableNo = String(incoming.tableNumber || '').trim()
      const sessionId = String(incoming.session || `qr-${incoming.id}`)
      const qrToken = String(incoming.token || '').trim()
      const customerName = incoming.customerName || 'Web Customer'
      const notes = incoming.notes || ''
      const receiptNo = generateReceiptNumber()

      const tableStore = useTableStore.getState()
      const matchingTable = tableStore.tables.find((t) => String(t.number) === tableNo)

      // Security/validity gate: only accept orders for the currently active table session.
      // After settlement, session is cleared/rotated so old QR links are automatically invalid.
      if (!matchingTable || matchingTable.status !== 'occupied' || String(matchingTable.sessionId || '') !== sessionId || String(matchingTable.qrToken || '') !== qrToken) {
        await updateQRCodeOrderStatus(storeId, incoming.id, 'expired', {
          rejectReason: 'session_mismatch_or_table_not_active',
        })
        return
      }

      const localProducts = useProductStore.getState().products || []
      const existingOrderItems = Array.isArray(matchingTable.order?.items) ? matchingTable.order.items : []
      const isInsufficient = items.find((item) => {
        const product = localProducts.find((p) => String(p.id) === String(item.id))
        if (!product || !product.active) return true

        const existingQty = existingOrderItems
          .filter((oi) => String(oi.id) === String(item.id))
          .reduce((sum, oi) => sum + Number(oi.qty || 0), 0)

        return Number(product.stock || 0) < Number(existingQty || 0) + Number(item.qty || 0)
      })

      if (isInsufficient) {
        await updateQRCodeOrderStatus(storeId, incoming.id, 'expired', {
          rejectReason: 'out_of_stock',
          rejectItemId: String(isInsufficient.id || ''),
          rejectItemName: String(isInsufficient.name || ''),
        })
        return
      }

      const appState = useAppStore.getState()
      const autoAccept = appState.qrSettings?.autoAccept !== false

      if (!autoAccept) {
        tableStore.addPendingQrOrder(incoming)
        // Toast is imported near the top, we just need to use `toast` if it's available or window.dispatchEvent
        // Use useAppStore's state or simply rely on the UI in Tables.jsx to show it
        return
      }

      tableStore.addKOT({
        tableId: matchingTable?.id || `web-${tableNo || 'na'}-${sessionId}`,
        tableNumber: matchingTable?.number || tableNo || 'WEB',
        items,
        notes,
        waiter: customerName,
        source: 'web',
        receiptNo,
        session: sessionId,
        token: qrToken,
        storeId,
        qrOrderId: incoming.id,
      })

      if (matchingTable) {
        const existingOrder = matchingTable.order || {}
        const existingItems = Array.isArray(existingOrder.items) ? existingOrder.items : []
        const appState = useAppStore.getState()
        const taxCfg = appState.taxSettings || {}
        const serviceCfg = appState.serviceChargeSettings || {}
        const taxRate = taxCfg.enabled ? Number(taxCfg.rate || 0) : 0
        const serviceRate = serviceCfg.enabled ? Number(serviceCfg.rate || 0) : 0
        const mergeKey = (item) => `${String(item.id || item.name || 'x')}::${JSON.stringify(item.customization || {})}`
        const mergedMap = new Map()

        existingItems.forEach((item) => {
          const key = mergeKey(item)
          const normalized = {
            ...item,
            qty: Number(item.qty || 0),
            price: Number(item.price || item.salePrice || 0),
            salePrice: Number(item.salePrice || item.price || 0),
          }
          mergedMap.set(key, normalized)
        })

        // Filter incoming items to avoid mixing modules (e.g., grocery items into restaurant tables)
        const productStoreState = useProductStore.getState()
        const filteredIncomingItems = (items || []).filter((it) => {
          const prod = productStoreState.products.find((p) => String(p.id) === String(it.id))
          if (!prod) return false
          // When POS is in restaurant mode, only accept restaurant-module products
          if (activeModule === 'restaurant') return String(prod.module || 'grocery') === 'restaurant'
          // Otherwise accept products that match the current active module
          return String(prod.module || 'grocery') === String(activeModule || 'grocery')
        })

        filteredIncomingItems.forEach((item) => {
          const key = mergeKey(item)
          const current = mergedMap.get(key)
          if (current) {
            mergedMap.set(key, { ...current, qty: Number(current.qty || 0) + Number(item.qty || 0) })
          } else {
            mergedMap.set(key, {
              ...item,
              qty: Number(item.qty || 0),
              price: Number(item.price || item.salePrice || 0),
              salePrice: Number(item.salePrice || item.price || 0),
            })
          }
        })

        const mergedItems = Array.from(mergedMap.values()).filter((item) => Number(item.qty || 0) > 0)
        const mergedSubtotal = mergedItems.reduce(
          (sum, item) => sum + Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
          0
        )
        const mergedTax = (mergedSubtotal * taxRate) / 100
        const mergedServiceCharge = (mergedSubtotal * serviceRate) / 100
        const mergedTotal = mergedSubtotal + mergedTax + mergedServiceCharge
        const existingQrIds = Array.isArray(existingOrder.qrOrderIds)
          ? existingOrder.qrOrderIds.map((id) => String(id)).filter(Boolean)
          : (existingOrder.qrOrderId ? [String(existingOrder.qrOrderId)] : [])
        const mergedQrOrderIds = Array.from(new Set([...existingQrIds, String(incoming.id)]))

        tableStore.updateTable(matchingTable.id, {
          status: 'occupied',
          sessionId,
          qrToken,
          waiter: customerName,
          order: {
            items: mergedItems,
            waiter: customerName,
            notes: '',
            kitchenNotes: notes,
            source: 'web',
            qrOrderId: incoming.id,
            qrOrderIds: mergedQrOrderIds,
            storeId,
            token: qrToken,
            subtotal: mergedSubtotal,
            tax: mergedTax,
            serviceCharge: mergedServiceCharge,
            total: mergedTotal,
          },
        })
      }

      useSalesStore.getState().addSale({
        receiptNo,
        date: new Date(),
        cartItems: items,
        items: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
        subtotal: Number(incoming.subtotal || incoming.total || 0),
        discount: 0,
        tax: Number(incoming.tax || 0),
        serviceCharge: Number(incoming.serviceCharge || 0),
        total: Number(incoming.total || 0),
        paymentMethod: 'pending',
        change: 0,
        cashier: 'Web QR',
        source: 'qr',
        status: 'pending',
        customerName: incoming.customerName || 'Guest',
        tableNumber: tableNo,
        notes: '',
        kitchenNotes: notes,
        qrOrderId: incoming.id,
        storeId,
        token: qrToken,
      })

      await markQRCodeOrderProcessed(storeId, incoming.id)
    })

    return () => {
      unsubscribe()
      unsubNotifications()
    }
  }, [businessInfo?.storeId, businessInfo?.taxId, licenseKey])

  // ─── HelaQR Payment Status Poller ─────────────────────────────────────────
  // Polls at most once per 30 seconds per sale and stops when paid/failed.
  // Uses a shared token so we only call requestToken once per session.
  useEffect(() => {
    const POLL_INTERVAL_MS   = 30_000   // 30 s between full cycles
    const PER_SALE_COOLDOWN  = 60_000   // don't re-check same sale within 60 s
    const lastChecked = {}              // receiptNo → timestamp

    const checker = async () => {
      const cfg = getHelaQRConfigStatus()
      if (!cfg.enabled || !cfg.configured) return

      const salesStore = useSalesStore.getState()
      const now = Date.now()

      const pendingSales = (salesStore.sales || [])
        .filter(
          (s) =>
            String(s.paymentMethod || '').toLowerCase() === 'helaqr' &&
            String(s.status || '').toLowerCase() === 'pending' &&
            (s.paymentRef || s.receiptNo) &&
            (now - (lastChecked[s.receiptNo] || 0)) >= PER_SALE_COOLDOWN
        )
        .slice(0, 3)   // max 3 at a time

      for (const sale of pendingSales) {
        lastChecked[sale.receiptNo] = now
        try {
          const status = await checkHelaQRPaymentStatus({
            reference: sale.paymentRef || sale.receiptNo,
            qrReference: sale.qrReference || '',
          })

          if (!status?.success) {
            // Back off this sale extra if rate-limited
            if (String(status?.error || '').toLowerCase().includes('rate')) {
              lastChecked[sale.receiptNo] = now + 5 * 60_000  // skip for 5 more min
            }
            continue
          }

          if (status.isPaid) {
            salesStore.finalizePendingSale?.({
              receiptNo: sale.receiptNo,
              paymentRef: sale.paymentRef,
            })
          }
        } catch {
          // network error — just wait for next cycle
        }
      }
    }

    const timer = setInterval(checker, POLL_INTERVAL_MS)
    // Delay first check by 10 s to let the app fully settle
    const startup = setTimeout(checker, 10_000)
    return () => { clearInterval(timer); clearTimeout(startup) }
  }, [])


  // Role badge colours
  const ROLE_COLORS = {
    super_admin: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
    owner:       { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
    manager:     { bg: '#fefce8', text: '#ca8a04', border: '#fde68a' },
    staff:       { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff' },
  }

  const enabledModules = Object.entries(modules).filter(([k,v]) => v).map(([k]) => k)

  // Ensure an active module is always set if unsupplied or if current is disabled
  const enabledModulesStr = enabledModules.join(',')
  useEffect(() => {
    if (enabledModules.length > 0) {
      if (!activeModule || !enabledModules.includes(activeModule)) {
        setActiveModule(enabledModules[0])
      }
    }
  }, [activeModule, enabledModulesStr, setActiveModule])

  // Track system time
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Track network status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Background Cloud Sync Engine — always syncs when online, no deployment-mode gate
  useEffect(() => {
    const intervalMinutes = useAppStore.getState().cloudSettings?.syncInterval || 5

    const runSync = async () => {
      if (!navigator.onLine) return
      setIsSyncing(true)
      const success = await syncWithCloud()
      setIsSyncing(false)
      if (success) {
        setLastSyncTime(new Date())
        console.log('[Sync Engine] Two-way cloud sync successful.')
      }
    }

    // Sync immediately on startup (after 3s to let the app settle)
    const startupTimer = setTimeout(runSync, 3000)

    // Then sync on a recurring interval
    const syncInterval = setInterval(runSync, intervalMinutes * 60 * 1000)

    return () => {
      clearTimeout(startupTimer)
      clearInterval(syncInterval)
    }
  }, [])

  const notifications = useMemo(() => {
    const now = Date.now()
    const alerts = []
    const seen = new Set()

    const pushAlert = (alert) => {
      if (!alert || seen.has(alert.id) || alert.expiresAt <= now) return
      seen.add(alert.id)
      alerts.push(alert)
    }

    getOutOfStock().forEach((product) => {
      const baseTime = toTime(product.updatedAt) || toTime(product.createdAt) || now
      pushAlert({
        id: `out:${product.id}`,
        type: 'error',
        msg: `${product.name} is OUT OF STOCK`,
        details: 'Auto-clears after the next inventory update.',
        expiresAt: baseTime + notificationTtlMs.out,
        priority: 4,
      })
    })

    getLowStock().filter((product) => product.stock > 0).forEach((product) => {
      const baseTime = toTime(product.updatedAt) || toTime(product.createdAt) || now
      pushAlert({
        id: `low:${product.id}`,
        type: 'warning',
        msg: `${product.name} — only ${product.stock} left`,
        details: 'Auto-clears after the next inventory update.',
        expiresAt: baseTime + notificationTtlMs.low,
        priority: 3,
      })
    })

    products.forEach((product) => {
      if (!product.active || !product.expiry) return
      const expiryAt = toTime(product.expiry)
      if (!expiryAt) return

      const daysRemaining = (expiryAt - now) / (1000 * 60 * 60 * 24)
      if (daysRemaining > 30) return

      if (daysRemaining < 0) {
        pushAlert({
          id: `exp:${product.id}`,
          type: 'error',
          msg: `${product.name} EXPIRED`,
          details: 'Please remove from shelves.',
          expiresAt: expiryAt + notificationTtlMs.exp,
          priority: 5,
        })
      } else {
        pushAlert({
          id: `exp:${product.id}`,
          type: 'warning',
          msg: `${product.name} expires in ${Math.ceil(daysRemaining)} days`,
          details: 'Discount or return to supplier.',
          expiresAt: expiryAt + notificationTtlMs.exp,
          priority: 2,
        })
      }
    })

    adminNotifications.forEach((notif) => {
      pushAlert({
        id: `admin:${notif.id}`,
        type: notif.type || 'info',
        msg: notif.title || 'System Alert',
        details: notif.message,
        expiresAt: (notif.createdAtMs || now) + (3 * 24 * 60 * 60 * 1000),
        priority: notif.type === 'error' ? 6 : notif.type === 'warning' ? 5 : 4,
      })
    })

    return alerts.sort((a, b) => b.priority - a.priority)
  }, [products, adminNotifications])

  // Build nav: base + ONLY the currently ACTIVE module — filtered by permission
  const rawModuleNavs = []
  const seenPaths = new Set()

  if (activeModule && MODULE_NAV[activeModule]) {
    MODULE_NAV[activeModule].forEach((item) => {
      if (!seenPaths.has(item.to) && (!item.permission || hasPermission(item.permission))) {
        rawModuleNavs.push(item)
        seenPaths.add(item.to)
      }
    })
  }

  // Also include globally shared Web Orders if enabled, even if not active retail context
  if (modules.online && activeModule !== 'online') {
    MODULE_NAV['online'].forEach((item) => {
      if (!seenPaths.has(item.to) && (!item.permission || hasPermission(item.permission))) {
        rawModuleNavs.push(item)
        seenPaths.add(item.to)
      }
    })
  }

  // Filter core nav by active mode AND permission
  const currentCoreNav = CORE_NAV.filter(nav => {
    if (activeModule === 'restaurant' && nav.to === '/inventory') return false
    if (activeModule === 'online') return false
    if (nav.permission && !hasPermission(nav.permission)) return false
    return true
  })

  // Group module navs by section
  const sections = {}
  rawModuleNavs.forEach((item) => {
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push(item)
  })

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f4f7f5] dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
        className="flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-zinc-800 shadow-[3px_0_16px_rgba(0,0,0,0.05)] dark:shadow-none"
        style={{
          width: collapsed ? 68 : 224,
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 border-b border-gray-100 dark:border-zinc-800"
          style={{ height: 64 }}
        >
          <div className="flex items-center justify-center shrink-0 transition-transform hover:scale-105 h-8">
            <img src="/ceypos_logo_png.png" alt="CeyPos" className="h-full w-auto object-contain" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-black text-gray-900 text-base leading-tight tracking-tight">{BRAND.name}</p>
              <p className="text-[11px] text-green-600 font-bold uppercase tracking-widest">POS System</p>
            </div>
          )}
        </div>

        {/* Optional Global Context Switcher */}
        {enabledModules.length > 1 && !collapsed && (
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Working Mode</p>
            <select
              value={activeModule || ''}
              onChange={e => setActiveModule(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:border-green-400 transition-all cursor-pointer text-gray-700 dark:text-zinc-200"
            >
              {enabledModules.map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)} Mode</option>
              ))}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2.5 flex flex-col gap-0.5 overflow-y-auto">
          {currentCoreNav.map(({ to, icon: Icon, labelKey, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
              title={collapsed ? t(labelKey) : undefined}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span className="flex-1 text-sm font-medium">{t(labelKey)}</span>}
              {!collapsed && badge && (
                <span
                  className="text-xs font-black px-1.5 py-0.5 rounded-lg"
                  style={{ background: '#fef9c3', color: '#b45309', fontSize: 9, letterSpacing: '0.05em' }}
                >
                  {badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* Module nav sections */}
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              {!collapsed && (
                <p
                  className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mt-4 mb-1.5"
                  style={{ letterSpacing: '0.08em' }}
                >
                  {section}
                </p>
              )}
              {collapsed && <div className="border-t border-gray-100 my-2 mx-2" />}
              {items.map(({ to, icon: Icon, labelKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
                  title={collapsed ? t(labelKey) : undefined}
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && <span className="flex-1 text-sm font-medium">{t(labelKey)}</span>}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Settings at end — only for users with manage_settings */}
          {hasPermission('manage_settings') && (
            <>
              {!collapsed && <div className="mt-2" />}
              <NavLink
                to="/settings"
                className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
                title={collapsed ? t('nav_settings') : undefined}
              >
                <Settings size={18} className="shrink-0" />
                {!collapsed && <span className="flex-1 text-sm">{t('nav_settings')}</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2.5 border-t border-gray-100 dark:border-zinc-800">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-item w-full justify-center text-gray-400 hover:text-gray-600"
          >
            {collapsed
              ? <ChevronRight size={16} />
              : <><ChevronLeft size={16} /><span className="text-sm">{t('nav_collapse')}</span></>
            }
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-5 shrink-0 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none"
          style={{ height: 64 }}
        >
        <p className="font-bold text-gray-800 dark:text-zinc-100 text-sm">{businessInfo.name}</p>
          {currentUser && (() => {
            const rc = ROLE_COLORS[currentUser.role] || ROLE_COLORS.staff
            return (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ml-2 border"
                style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}
              >
                {currentUser.role.replace('_',' ')}
              </span>
            )
          })()}

          <div className="flex items-center gap-4">
            {/* Date/Time */}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">{format(time, 'hh:mm:ss aa')}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">{format(time, 'EEE, MMM d yyyy')}</p>
            </div>

            {/* Network / Sync Status + Manual Sync Now Button */}
            <div className="flex flex-col items-end mr-2 hidden sm:flex">
              <div className="flex items-center gap-1.5">
                <span className={cn("status-dot", isOnline ? "online" : "bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]")} />
                <span className="text-xs text-gray-700 font-bold">
                  {isOnline ? 'Cloud Online' : 'Offline Mode'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isSyncing ? (
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                ) : (
                  <Cloud size={10} className="text-gray-400" />
                )}
                <span className={cn("text-[10px] uppercase font-bold tracking-wider", isSyncing ? "text-blue-500" : "text-gray-400")}>
                  {isSyncing ? 'Syncing...' : `Synced • ${format(lastSyncTime, 'HH:mm')}`}
                </span>
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing || !isOnline}
                  title="Sync all data to cloud now"
                  className={cn(
                    'ml-1 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all',
                    isSyncing || !isOnline
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer active:scale-95'
                  )}
                >
                  <RefreshCw size={9} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing' : 'Sync Now'}
                </button>
              </div>
            </div>


            {/* Notifications Bell & Theme Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-90"
              >
                {isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-500" />}
              </button>

              <div className="relative">
              <button
                onClick={() => setShowNotif(!showNotif)}
                className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all active:scale-90"
              >
                <Bell size={18} className="text-gray-500" />
                {notifications.length > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white font-black"
                    style={{ background: '#ef4444', fontSize: 9, boxShadow: '0 0 0 2px white' }}
                  >
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {showNotif && (
                <div
                  className="absolute right-0 top-full mt-2 animate-scale-in bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800"
                  style={{
                    borderRadius: 18,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
                    width: 328,
                    zIndex: 50,
                    maxHeight: 420,
                    overflow: 'hidden',
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Alerts</p>
                      {notifications.length > 0 && (
                        <span className="badge badge-red text-xs">{notifications.length}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowNotif(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <span className="text-3xl mb-2">✅</span>
                        <p className="text-sm font-medium text-gray-400">All clear! No alerts.</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-zinc-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <span className="text-base mt-0.5">{n.type === 'error' ? '🔴' : n.type === 'success' ? '🟢' : n.type === 'info' ? '🔵' : '🟡'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-700 font-medium leading-relaxed">{n.msg}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {n.details} Auto-clears by {format(new Date(n.expiresAt), 'dd MMM, hh:mm aa')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Avatar & Quick Logout */}
            <div className="flex items-center gap-2.5 group relative">
              <div className="flex flex-col items-end">
                <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 leading-tight">{currentUser?.username}</p>
                <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">{currentUser?.role.replace('_', ' ')}</p>
              </div>
              <div
                className="flex items-center justify-center rounded-xl text-white text-sm font-black cursor-pointer transition-all group-hover:scale-105 group-hover:shadow-lg"
                style={{
                  width: 38,
                  height: 38,
                  background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                  boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                }}
              >
                {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
              </div>

              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.14)] dark:shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-800/50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">ID Badge</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-zinc-100">{currentUser?.username}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-1 tracking-wider">{currentUser?.barcode}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <span>🚪</span> {t('nav_logout')}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
