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
import PublicMenu from '@/pages/PublicMenu'
import CustomerScreen from '@/pages/CustomerScreen'
import LicensePortal from '@/pages/LicensePortal'
import Login from '@/pages/Login'
import Activation from '@/pages/Activation'
import { useAuthStore, useAppStore } from '@/store'
import { checkCurrentLicenseAccess } from '@/lib/license'
import { syncWithCloud } from '@/lib/firebase'

export default function App() {
  const { currentUser, logout }              = useAuthStore()
  const { licenseActive, licenseKey, theme } = useAppStore()
  const [checking, setChecking]              = useState(true)
  const [initialCloudHydration, setInitialCloudHydration] = useState(false)
  const [storeHydrated, setStoreHydrated] = useState(() => useAppStore.persist?.hasHydrated?.() ?? true)
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
  const isHashPublicMenuRoute = hashPath.startsWith('/menu/') || hashPath.includes('/menu/')
  const isHashCustomerRoute = hashPath.startsWith('/customer-screen')
  const isHashLicensePortalRoute = hashPath.startsWith('/license-portal')
  const hasQrQueryMarkers = /(?:\?|&)(table|session|token|guests)=/i.test(decodedHref)
  const hasMenuMarker = /(?:\/|#|%2f)menu(?:\/|%2f)/i.test(decodedHref)
  const forcePublicMenuFromHref = hasMenuMarker || (hasQrQueryMarkers && /menu/i.test(decodedHref))
  const Router = isFileProtocol || isHashPublicMenuRoute || isHashCustomerRoute || isHashLicensePortalRoute || forcePublicMenuFromHref ? HashRouter : BrowserRouter
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
    if (isHashLicensePortalRoute) {
      return hashPath || '/'
    }
    return window.location.pathname || '/'
  })()
  const isPublicMenuRoute =
    currentPath.startsWith('/menu/') ||
    /\/menu\/[^/?#]+/i.test(decodedHref) ||
    forcePublicMenuFromHref
  const isCustomerDisplayRoute =
    currentPath.startsWith('/customer-screen') ||
    /customer-screen/i.test(decodedHref) ||
    isHashCustomerRoute
  const isLicensePortalRoute =
    currentPath.startsWith('/license-portal') ||
    /license-portal/i.test(decodedHref) ||
    isHashLicensePortalRoute

  useEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [theme])

  useEffect(() => {
    if (!useAppStore.persist) return () => {}
    const maybeUnsub = useAppStore.persist.onFinishHydration(() => {
      setStoreHydrated(true)
    })
    if (useAppStore.persist.hasHydrated()) {
      setStoreHydrated(true)
    }
    return () => {
      if (typeof maybeUnsub === 'function') maybeUnsub()
    }
  }, [])

  // Re-validate stored license on every app startup
  useEffect(() => {
    if (!storeHydrated) return
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

    check()
    const intervalId = window.setInterval(check, 30000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        check()
      }
    }

    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', handleVisibility)
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
        await syncWithCloud()
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

  // Standalone super-admin license portal (separate from POS login flow)
  if (isLicensePortalRoute) {
    return (
      <Router>
        <Routes>
          <Route path="/license-portal" element={<LicensePortal />} />
          <Route path="*" element={<LicensePortal />} />
        </Routes>
        <ToastContainer />
      </Router>
    )
  }

  // Step 1 — License gate (must activate before anything else)
  if (!licenseActive) {
    return (
      <>
        <Activation />
        <ToastContainer />
      </>
    )
  }

  // Step 2 — Login gate
  if (!currentUser) {
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

          {/* Reports — manager and above */}
          <Route path="/reports" element={<AccessGuard permission="view_reports"><Reports /></AccessGuard>} />
          <Route path="/refunds" element={<AccessGuard permission="sales"><Refunds /></AccessGuard>} />
          <Route path="/logs" element={<AccessGuard permission="view_logs"><Logs /></AccessGuard>} />

          {/* Settings — owner and above */}
          <Route path="/settings" element={<AccessGuard permission="manage_settings"><Settings /></AccessGuard>} />

          {/* Super Admin License Portal */}
          <Route path="/license-portal" element={<AccessGuard permission="manage_license"><LicensePortal /></AccessGuard>} />
        </Routes>
      </Layout>
      <ToastContainer />
    </Router>
  )
}


