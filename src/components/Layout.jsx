import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Settings,
  ChevronLeft, ChevronRight, Users, Warehouse, Zap,
  Truck, Utensils, BookOpen, Bell, X, ShoppingBag, Globe,
  Cloud, RefreshCw
} from 'lucide-react'
import { useAppStore, useProductStore, useAuthStore } from '@/store'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { syncToCloud } from '@/lib/firebase'

const CORE_NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', permission: null }, // everyone
  { to: '/products', icon: Package, label: 'Products', permission: 'manage_inventory' },
  { to: '/inventory', icon: Warehouse, label: 'Inventory', permission: 'manage_inventory' },
  { to: '/customers', icon: Users, label: 'Customers', permission: 'manage_inventory' },
  { to: '/reports', icon: BarChart3, label: 'Reports', permission: 'view_reports' },
]

const MODULE_NAV = {
  grocery: [
    { to: '/pos', icon: ShoppingCart, label: 'POS Terminal', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/grn', icon: Truck, label: 'Goods Receiving', section: 'Retail POS', permission: 'manage_inventory' },
  ],
  clothing: [
    { to: '/pos', icon: ShoppingCart, label: 'POS Terminal', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/variants', icon: Package, label: 'Style & Variants', section: 'Apparel', permission: 'manage_inventory' },
    { to: '/barcodes', icon: Zap, label: 'Print Labels', section: 'Apparel', permission: 'manage_inventory' },
  ],
  pharmacy: [
    { to: '/pos', icon: ShoppingCart, label: 'POS Terminal', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/prescriptions', icon: BookOpen, label: 'Rx Prescriptions', section: 'Pharmacy Operations', permission: 'sales' },
    { to: '/batches', icon: Warehouse, label: 'Batch & Expiry', section: 'Pharmacy Operations', permission: 'manage_inventory' },
  ],
  restaurant: [
    { to: '/tables', icon: Utensils, label: 'Tables & KOT', section: 'Restaurant', permission: 'sales' },
    { to: '/takeout', icon: ShoppingBag, label: 'Take Out', section: 'Restaurant', permission: 'sales' },
  ],
  wholesale: [
    { to: '/pos', icon: ShoppingCart, label: 'POS Terminal', badge: 'HOT', section: 'Retail POS', permission: 'sales' },
    { to: '/ledger', icon: BookOpen, label: 'Customer Ledger', section: 'Wholesale', permission: 'manage_inventory' },
  ],
  online: [
    { to: '/web-orders', icon: Globe, label: 'Web Orders', section: 'Web Integration', permission: 'manage_inventory' },
  ]
}

export function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [time, setTime] = useState(new Date())
  const [showNotif, setShowNotif] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(new Date())
  
  const { businessInfo, modules, activeModule, setActiveModule } = useAppStore()
  const { products, getLowStock, getOutOfStock } = useProductStore()
  const { currentUser, logout, hasPermission } = useAuthStore()

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

  // Background Cloud Sync Engine
  useEffect(() => {
    // Determine interval time from settings (default to 10 min if absent)
    const intervalMinutes = useAppStore.getState().cloudSettings?.syncInterval || 10
    
    const syncInterval = setInterval(async () => {
      // Only execute sync if online and cloud sync is explicitly enabled
      const settings = useAppStore.getState().cloudSettings
      if (navigator.onLine && settings && settings.enabled) {
        setIsSyncing(true)
        console.log('[Sync Engine] Initializing automated background cloud sync to', settings.provider)
        
        const success = await syncToCloud()
        
        setIsSyncing(false)
        if (success) {
          setLastSyncTime(new Date())
          console.log('[Sync Engine] Push successful. Local state is synchronized with the Firestore cloud.')
        } else {
          console.error('[Sync Engine] Push failed. Will retry next cycle.')
        }
      }
    }, intervalMinutes * 60 * 1000)

    return () => clearInterval(syncInterval)
  }, [])

  // Build notifications from low stock
  const lowStock = getLowStock()
  const outOfStock = getOutOfStock()
  const notifications = [
    ...outOfStock.map((p) => ({ id: p.id, type: 'error', msg: `${p.name} is OUT OF STOCK` })),
    ...lowStock.filter((p) => p.stock > 0).map((p) => ({ id: `l${p.id}`, type: 'warning', msg: `${p.name} — only ${p.stock} left` })),
  ]

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
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#f4f7f5' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out"
        style={{
          width: collapsed ? 68 : 220,
          background: 'white',
          borderRight: '1px solid #f0f0f0',
          boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid #f5f5f5' }}>
          <div
            className="flex items-center justify-center shrink-0 rounded-xl"
            style={{
              width: 38,
              height: 38,
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
            }}
          >
            <Zap size={18} color="white" fill="white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-gray-900 text-sm leading-tight">Paxxmo</p>
              <p className="text-xs text-green-600 font-semibold">POS System</p>
            </div>
          )}
        </div>

        {/* Optional Global Context Switcher */}
        {enabledModules.length > 1 && !collapsed && (
          <div className="px-3 pb-2 pt-2 border-b border-gray-100 bg-gray-50/50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Working Mode</p>
            <select 
              value={activeModule || ''} 
              onChange={e => setActiveModule(e.target.value)}
              className="w-full bg-white border border-gray-200 text-sm font-semibold rounded-lg px-2 py-1.5 outline-none focus:border-green-500 transition-colors"
            >
              {enabledModules.map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)} Mode</option>
              ))}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {currentCoreNav.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="flex-1 text-sm">{label}</span>}
              {!collapsed && badge && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: '#fef9c3', color: '#ca8a04', fontSize: 9 }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* Module nav sections */}
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              {!collapsed && (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mt-4 mb-1">
                  {section}
                </p>
              )}
              {collapsed && <div className="border-t border-gray-100 my-2" />}
              {items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="flex-1 text-sm">{label}</span>}
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
                title={collapsed ? 'Settings' : undefined}
              >
                <Settings size={18} className="shrink-0" />
                {!collapsed && <span className="flex-1 text-sm">Settings</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3" style={{ borderTop: '1px solid #f5f5f5' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-item w-full justify-center"
          >
            {collapsed ? <ChevronRight size={18} /> : (
              <><ChevronLeft size={18} /><span className="text-sm">Collapse</span></>
            )}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-5 shrink-0"
          style={{ height: 60, background: 'white', borderBottom: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
        <p className="font-semibold text-gray-800 text-sm">{businessInfo.name}</p>
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
              <p className="text-xs font-semibold text-gray-800">{format(time, 'hh:mm:ss aa')}</p>
              <p className="text-xs text-gray-400">{format(time, 'EEE, MMM d yyyy')}</p>
            </div>

            {/* Network Sync Engine Status */}
            <div className="flex flex-col items-end mr-4 hidden sm:flex">
              <div className="flex items-center gap-1.5 cursor-pointer">
                <span className={cn("status-dot", isOnline ? "online" : "bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]")} />
                <span className="text-xs text-gray-700 font-bold">
                  {isOnline ? 'Online Mode' : 'Offline Mode'}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {isSyncing ? (
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                ) : (
                  <Cloud size={10} className="text-gray-400" />
                )}
                <span className={cn("text-[10px] uppercase font-bold tracking-wider", isSyncing ? "text-blue-500" : "text-gray-400")}>
                  {isSyncing ? 'Syncing...' : `Saved • ${format(lastSyncTime, 'HH:mm')}`}
                </span>
              </div>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotif(!showNotif)}
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <Bell size={18} className="text-gray-500" />
                {notifications.length > 0 && (
                  <span
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: '#ef4444', fontSize: 9 }}
                  >
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {showNotif && (
                <div
                  className="absolute right-0 top-full mt-2 animate-fade-in"
                  style={{
                    background: 'white',
                    border: '1px solid #f0f0f0',
                    borderRadius: 16,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    width: 320,
                    zIndex: 50,
                    maxHeight: 400,
                    overflow: 'hidden',
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <p className="font-bold text-gray-900 text-sm">Alerts</p>
                    <button onClick={() => setShowNotif(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">All clear! No alerts.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
                        >
                          <span>{n.type === 'error' ? '🔴' : '🟡'}</span>
                          <p className="text-xs text-gray-700">{n.msg}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar & Quick Logout */}
            <div className="flex items-center gap-2 group relative">
              <div className="flex flex-col items-end mr-1">
                 <p className="text-xs font-bold text-gray-800 leading-tight">{currentUser?.username}</p>
                 <p className="text-[10px] text-green-600 font-semibold uppercase">{currentUser?.role.replace('_', ' ')}</p>
              </div>
              <div
                className="flex items-center justify-center rounded-full text-white text-xs font-bold cursor-pointer transition-transform group-hover:scale-105"
                style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#16a34a,#22c55e)', boxShadow: '0 4px 10px rgba(22,163,74,0.3)' }}
              >
                {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                  <p className="text-xs font-bold text-gray-600">ID Badge / Token</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5 tracking-wider">{currentUser?.barcode}</p>
                </div>
                <button onClick={logout} className="w-full text-left px-4 py-3 text-sm text-red-600 font-bold hover:bg-red-50 transition-colors">
                  Secure Logout
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
