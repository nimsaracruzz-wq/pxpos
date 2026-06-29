import React, { useEffect, useRef, useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ToastContainer } from '@/components/Toast'
import AccessGuard from '@/components/AccessGuard'
import Dashboard from '@/pages/Dashboard'
import POS from '@/pages/POS'
import Products from '@/pages/Products'
import Inventory from '@/pages/Inventory'
import Customers from '@/pages/Customers'
import Reports from '@/pages/Reports'
import Logs from '@/pages/Logs'
import Settings from '@/pages/Settings'
import GRN from '@/pages/GRN'
import Tables from '@/pages/Tables'
import Ledger from '@/pages/Ledger'
import TakeOut from '@/pages/TakeOut'
import Variants from '@/pages/Variants'
import BarcodeLabels from '@/pages/BarcodeLabels'
import Batches from '@/pages/Batches'
import Prescriptions from '@/pages/Prescriptions'
import WebOrders from '@/pages/WebOrders'
import Refunds from '@/pages/Refunds'
import SaleHistory from '@/pages/SaleHistory'
import PublicMenu from '@/pages/PublicMenu'
import TableEntry from '@/pages/TableEntry'
import CustomerScreen from '@/pages/CustomerScreen'
import AdminPortal from '@/pages/AdminPortal'
import Electronics from '@/pages/Electronics'
import Login from '@/pages/Login'
import Activation from '@/pages/Activation'
import { useAuthStore, useAppStore } from '@/store'
import { checkCurrentLicenseAccess } from '@/lib/license'
import { syncWithCloud } from '@/lib/firebase'

// Demo mode: set VITE_DEMO_MODE=true in .env.production to bypass license/login for demo site
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true' || process.env.VITE_DEMO_MODE === 'true'

export default function App() {
  const { currentUser, logout }              = useAuthStore()
  const { licenseActive, licenseKey, theme, customerDisplaySettings } = useAppStore()
  const [checking, setChecking]              = useState(() => IS_DEMO ? false : !useAppStore.getState()?.licenseActive)
  const [initialCloudHydration, setInitialCloudHydration] = useState(false)
  const [storeHydrated, setStoreHydrated] = useState(() => IS_DEMO ? true : ((useAppStore.persist?.hasHydrated?.() ?? true) && (useAuthStore.persist?.hasHydrated?.() ?? true)))
  const hydratedLicenseRef = useRef('')

  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const hashPathRaw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
  const decodedHref = typeof window !== 'undefined'
    ? (() => {
        try {
          return decodeURIComponent(window.location.href || '')
        } catch (_) {
          return window.location.href || ''
        }
      })()
    : ''
  const hashPath = (() => {
    try {
      return decodeURIComponent(hashPathRaw).replace(/^!/, '')
    } catch (_) {
      return hashPathRaw.replace(/^!/, '')
    }
  })()
  const isHashPublicMenuRoute = hashPath.startsWith('/menu/') || hashPath.startsWith('/table/') || hashPath.startsWith('/order/') || hashPath.includes('/menu/') || hashPath.includes('/table/') || hashPath.includes('/order/')
  const isHashCustomerRoute = hashPath.startsWith('/customer-screen')
  const isHashAdminPortalRoute = hashPath.startsWith('/admin-portal')
  const hasQrQueryMarkers = /(?:\?|&)(table|session|token|guests)=/i.test(decodedHref)
  const hasPublicMenuMarker = /(?:\/|#|%2f)(?:menu|table|order)(?:\/|%2f)/i.test(decodedHref)
  const forcePublicMenuFromHref = hasPublicMenuMarker || (hasQrQueryMarkers && /menu/i.test(decodedHref))
  const Router = isFileProtocol || isHashPublicMenuRoute || isHashCustomerRoute || isHashAdminPortalRoute || forcePublicMenuFromHref ? HashRouter : BrowserRouter
  const currentPath = (() => {
    if (typeof window === 'undefined') return '/'
    if (isFileProtocol) {
      return hashPath || '/'
    }
    if (isHashPublicMenuRoute) {
      return hashPath || '/'
    }
    if (isHashCustomerRoute) {
      return hashPath || '/'
    }
    if (isHashAdminPortalRoute) {
      return hashPath || '/'
    }
    return window.location.pathname || '/'
  })()
  const isPublicMenuRoute =
    currentPath.startsWith('/menu/') ||
    currentPath.startsWith('/table/') ||
    currentPath.startsWith('/order/') ||
    /\/menu\/[^/?#]+/i.test(decodedHref) ||
    /\/table\/[^/?#]+/i.test(decodedHref) ||
    /\/order\/[^/?#]+/i.test(decodedHref) ||
    forcePublicMenuFromHref
  const isCustomerDisplayRoute =
    currentPath.startsWith('/customer-screen') ||
    /customer-screen/i.test(decodedHref) ||
    isHashCustomerRoute
  const isAdminPortalRoute =
    currentPath.startsWith('/admin-portal') ||
    /admin-portal/i.test(decodedHref) ||
    isHashAdminPortalRoute

  useEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [theme])

  // Manage Customer Display Window Lifecycle via IPC
  useEffect(() => {
    if (typeof window === 'undefined' || !window.require) return
    if (isCustomerDisplayRoute || isPublicMenuRoute || isAdminPortalRoute) return

    try {
      const ipcRenderer = window.require('electron').ipcRenderer
      if (customerDisplaySettings?.enabled !== false) {
        ipcRenderer.send('customer-display-open')
      } else {
        ipcRenderer.send('customer-display-close')
      }
    } catch (err) {
      console.warn('IPC not available for customer display toggling:', err)
    }
  }, [customerDisplaySettings?.enabled, isCustomerDisplayRoute, isPublicMenuRoute, isAdminPortalRoute])

  useEffect(() => {
    if (!useAppStore.persist || !useAuthStore.persist) return () => {}
    
    let appReady = useAppStore.persist.hasHydrated()
    let authReady = useAuthStore.persist.hasHydrated()

    const checkHydration = () => {
      if (appReady && authReady) setStoreHydrated(true)
    }

    const unsubApp = useAppStore.persist.onFinishHydration(() => {
      appReady = true
      checkHydration()
    })
    
    const unsubAuth = useAuthStore.persist.onFinishHydration(() => {
      authReady = true
      checkHydration()
    })

    if (appReady && authReady) {
      setStoreHydrated(true)
    }

    return () => {
      if (typeof unsubApp === 'function') unsubApp()
      if (typeof unsubAuth === 'function') unsubAuth()
    }
  }, [])

  // Demo mode: auto-activate license + auto-login as demo admin
  useEffect(() => {
    if (!IS_DEMO) return

    // Auto-activate license
    useAppStore.setState((s) => ({
      licenseActive: true,
      licenseKey: 'DEMO-MODE',
      modules: { grocery: true, restaurant: true, clothing: true, pharmacy: true, wholesale: true, online: true },
      businessInfo: {
        ...s.businessInfo,
        name: s.businessInfo?.name || 'CeyPos Demo Store',
      },
    }))

    // Auto-login as demo owner — bypass IPC entirely via setState
    if (!useAuthStore.getState().currentUser) {
      useAuthStore.setState({
        currentUser: {
          id: 'demo-owner',
          username: 'Demo Admin',
          fullName: 'Demo Owner',
          role: 'owner',
          active: true,
        },
      })
    }

    setChecking(false)
  }, [])

  // Re-validate stored license on every app startup
  useEffect(() => {
    if (!storeHydrated || IS_DEMO) return
    let cancelled = false

    async function check() {
      const state = useAppStore.getState()
      if (!state?.licenseKey) {
        setChecking(false)
        return
      }

      const result = await checkCurrentLicenseAccess()
      if (cancelled) return

      if (!result.valid) {
        // Keep local license when server is temporarily unavailable.
        if (result.transient) {
          useAppStore.setState({ licenseActive: true })
        } else {
          // License revoked / expired / wrong PC → kick out immediately.
          useAppStore.setState({ licenseActive: false, licenseKey: '' })
          logout()
        }
      } else {
        useAppStore.setState({ licenseActive: true, licenseKey: String(state.licenseKey || '').trim().toUpperCase() })
        useAppStore.getState().applyLicenseFeatures?.(result)
      }
      setChecking(false)
    }

    // Only do a quiet single check on load instead of pinging every 30 seconds
    check()

    return () => {
      cancelled = true
    }
  }, [licenseActive, licenseKey, logout, storeHydrated])

  // First-run / new-PC onboarding:
  // Once a license is active, pull from cloud immediately so this POS starts with existing data.
  useEffect(() => {
    let cancelled = false

    const runInitialHydration = async () => {
      const normalizedLicense = String(licenseKey || '').trim().toUpperCase()
      if (!licenseActive || !normalizedLicense) return
      if (hydratedLicenseRef.current === normalizedLicense) return

      setInitialCloudHydration(true)
      try {
        // 2-second timeout: if offline or quota exceeded, skip cloud sync and use local data
        await Promise.race([
          syncWithCloud(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud sync timeout')), 2000))
        ])
        if (!cancelled) hydratedLicenseRef.current = normalizedLicense
      } catch (err) {
        console.warn('[App] Cloud sync skipped (offline or quota):', err?.message)
        // Mark as hydrated anyway so we don't retry on next render
        if (!cancelled) hydratedLicenseRef.current = normalizedLicense
      } finally {
        if (!cancelled) setInitialCloudHydration(false)
      }
    }

    runInitialHydration()
    return () => { cancelled = true }
  }, [licenseActive, licenseKey])

  // Show loading while checking license
  if (!storeHydrated || checking) {
    const isDark = theme === 'dark'
    return (
      <div style={{
        minHeight: '100vh',
        background: isDark
          ? 'linear-gradient(135deg, #0b1324, #101a33, #1a2747)'
          : 'linear-gradient(135deg, #f0fdf4, #dcfce7, #bbf7d0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isDark ? 'rgba(255,255,255,0.7)' : '#475569',
        fontFamily: 'Inter, sans-serif', fontSize: '16px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔐</div>
          <p>Verifying license...</p>
        </div>
      </div>
    )
  }

  if (licenseActive && initialCloudHydration) {
    const isDark = theme === 'dark'
    return (
      <div style={{
        minHeight: '100vh',
        background: isDark
          ? 'linear-gradient(135deg, #0b1324, #101a33, #1a2747)'
          : 'linear-gradient(135deg, #f0fdf4, #dcfce7, #bbf7d0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isDark ? 'rgba(255,255,255,0.7)' : '#475569',
        fontFamily: 'Inter, sans-serif', fontSize: '16px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>☁️</div>
          <p>Syncing cloud data to this POS...</p>
        </div>
      </div>
    )
  }

  // Public mobile menu route (no activation/login gate)
  if (isPublicMenuRoute) {
    return (
      <Router>
        <Routes>
          <Route path="/table/:tableNumber" element={<TableEntry />} />
          <Route path="/table/:storeId/:tableNumber" element={<TableEntry />} />
          <Route path="/order/:sessionId" element={<PublicMenu />} />
          <Route path="/menu/:storeId" element={<PublicMenu />} />
          <Route path="*" element={<PublicMenu />} />
        </Routes>
        <ToastContainer />
      </Router>
    )
  }

  // Dedicated customer display route (separate Electron window)
  if (isCustomerDisplayRoute) {
    return (
      <Router>
        <Routes>
          <Route path="/customer-screen" element={<CustomerScreen />} />
          <Route path="*" element={<CustomerScreen />} />
        </Routes>
      </Router>
    )
  }

  // Standalone super-admin web portal (separate from POS login flow)
  if (isAdminPortalRoute) {
    return (
      <Router>
        <Routes>
          <Route path="/admin-portal" element={<AdminPortal />} />
          <Route path="*" element={<AdminPortal />} />
        </Routes>
        <ToastContainer />
      </Router>
    )
  }

  // Step 1 — License gate (must activate before anything else) — skipped in demo mode
  if (!licenseActive && !IS_DEMO) {
    return (
      <>
        <Activation />
        <ToastContainer />
      </>
    )
  }

  // Step 2 — Login gate — skipped in demo mode
  if (!currentUser && !IS_DEMO) {
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    )
  }

  // Step 3 — Main app
  return (
    <Router>
      <Layout>
        {IS_DEMO && (
          <div style={{
            background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
            color: '#fff',
            textAlign: 'center',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.02em',
            zIndex: 9999,
            position: 'sticky',
            top: 0,
          }}>
            🚀 This is a live demo of CeyPos — data resets periodically. Contact us to get your license!
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />

          {/* Sales — all logged-in users */}
          <Route path="/pos" element={<AccessGuard permission="sales"><POS /></AccessGuard>} />
          <Route path="/tables" element={<AccessGuard permission="sales"><Tables /></AccessGuard>} />
          <Route path="/takeout" element={<AccessGuard permission="sales"><TakeOut /></AccessGuard>} />
          <Route path="/prescriptions" element={<AccessGuard permission="sales"><Prescriptions /></AccessGuard>} />

          {/* Inventory management — manager and above */}
          <Route path="/products" element={<AccessGuard permission="manage_inventory"><Products /></AccessGuard>} />
          <Route path="/inventory" element={<AccessGuard permission="manage_inventory"><Inventory /></AccessGuard>} />
          <Route path="/customers" element={<AccessGuard permission="manage_inventory"><Customers /></AccessGuard>} />
          <Route path="/grn" element={<AccessGuard permission="manage_inventory"><GRN /></AccessGuard>} />
          <Route path="/ledger" element={<AccessGuard permission="manage_inventory"><Ledger /></AccessGuard>} />
          <Route path="/variants" element={<AccessGuard permission="manage_inventory"><Variants /></AccessGuard>} />
          <Route path="/barcodes" element={<AccessGuard permission="manage_inventory"><BarcodeLabels /></AccessGuard>} />
          <Route path="/batches" element={<AccessGuard permission="manage_inventory"><Batches /></AccessGuard>} />
          <Route path="/web-orders" element={<AccessGuard permission="manage_inventory"><WebOrders /></AccessGuard>} />
          <Route path="/electronics" element={<AccessGuard permission="sales"><Electronics /></AccessGuard>} />

          {/* Reports — manager and above */}
          <Route path="/reports" element={<AccessGuard permission="view_reports"><Reports /></AccessGuard>} />
          <Route path="/refunds" element={<AccessGuard permission="sales"><Refunds /></AccessGuard>} />
          <Route path="/sale-history" element={<AccessGuard permission="sales"><SaleHistory /></AccessGuard>} />
          <Route path="/logs" element={<AccessGuard permission="view_logs"><Logs /></AccessGuard>} />

          {/* Settings — owner and above */}
          <Route path="/settings" element={<AccessGuard permission="manage_settings"><Settings /></AccessGuard>} />

          {/* Super Admin Web Portal */}
          <Route path="/admin-portal" element={<AccessGuard permission="manage_license"><AdminPortal /></AccessGuard>} />
        </Routes>
      </Layout>
      <ToastContainer />
    </Router>
  )
}


