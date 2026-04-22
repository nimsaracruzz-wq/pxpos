import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { get, set, del } from 'idb-keyval'
import { generateReceiptNumber } from '@/lib/utils'
import { publishCustomerDisplaySettings } from '@/lib/customerDisplayChannel'
import { BRAND } from '@/lib/brand'
import { defaultFirebaseConfigJson } from '@/lib/defaultFirebaseConfig'
import { SYSTEM_PUBLIC_MENU_URL } from '@/lib/systemUrls'

const APP_STORE_VERSION = 4
const DEFAULT_PUBLIC_MENU_BASE_URL = (import.meta.env.VITE_PUBLIC_MENU_BASE_URL || SYSTEM_PUBLIC_MENU_URL).trim()
const LICENSED_MODULE_KEYS = ['grocery', 'restaurant', 'clothing', 'pharmacy', 'wholesale', 'online']

function normalizePublicMenuBaseUrl(value = '') {
  const candidate = String(value || '').trim()
  if (!candidate) return DEFAULT_PUBLIC_MENU_BASE_URL
  if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(candidate)) return DEFAULT_PUBLIC_MENU_BASE_URL
  if (/\.vercel\.app(\/|$)/i.test(candidate)) return DEFAULT_PUBLIC_MENU_BASE_URL
  return candidate
}

function createCustomerDisplayDefaults() {
  return {
    enabled: true,
    bannerTitle: `${BRAND.name} Customer Display`,
    headline: `Welcome to ${BRAND.name} POS`,
    subtitle: 'Ready to order',
    message: 'Your order will be prepared with care',
    autoplayInterval: 5000,
    slides: [
      {
        id: uuidv4(),
        type: 'text',
        title: 'Today\'s Special Offer',
        description: 'Add a custom promotion, announcement, or pricing message here.',
        tag: 'Hot Deal',
        accent: '#f97316',
      },
      {
        id: uuidv4(),
        type: 'image',
        title: 'Image Promotion',
        description: 'Upload an image from this device for offline display.',
        src: '',
        mimeType: '',
        accent: '#0ea5e9',
        gradient: 'linear-gradient(135deg, #0f172a 0%, #155e75 55%, #0ea5e9 100%)',
      },
      {
        id: uuidv4(),
        type: 'video',
        title: 'Video Promotion',
        description: 'Upload a local video file and play it on the customer display.',
        src: '',
        mimeType: '',
        accent: '#22c55e',
        gradient: 'linear-gradient(135deg, #111827 0%, #14532d 50%, #22c55e 100%)',
      },
    ],
  }
}

function normalizeCustomerDisplaySettings(settings = {}) {
  const defaults = createCustomerDisplayDefaults()
  const slides = Array.isArray(settings.slides) && settings.slides.length > 0
    ? settings.slides.map((slide) => ({
        ...slide,
        id: slide.id || uuidv4(),
        type: String(slide.type || 'text').toLowerCase(),
      }))
    : defaults.slides

  return {
    ...defaults,
    ...settings,
    slides,
  }
}

function ensureBusinessStoreId(businessInfo = {}) {
  return {
    ...businessInfo,
    storeId: businessInfo.storeId || uuidv4(),
    publicMenuBaseUrl: normalizePublicMenuBaseUrl(businessInfo.publicMenuBaseUrl),
  }
}

function normalizeLicensedModules(modules = {}, currentModules = {}) {
  const source = modules && typeof modules === 'object' ? modules : {}
  return LICENSED_MODULE_KEYS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      acc[key] = source[key] !== false
    } else {
      acc[key] = currentModules[key] ?? true
    }
    return acc
  }, {})
}

function normalizeLicensedDeploymentMode(value, fallback = 'local') {
  const candidate = String(value || fallback || '').trim().toLowerCase()
  return candidate === 'cloud' ? 'cloud' : 'local'
}

// ─── Real Database Implementation (IndexedDB) ──────────────────────────────────
export const idbStorage = {
  getItem: async (name) => {
    try {
      const value = await get(name)
      return value || null
    } catch (error) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(`paxxmo-fallback:${name}`)
        }
      } catch (_) {}
      return null
    }
  },
  setItem: async (name, value) => {
    try {
      await set(name, value)
      return
    } catch (_) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`paxxmo-fallback:${name}`, value)
        }
      } catch (_) {}
    }
  },
  removeItem: async (name) => {
    try {
      await del(name)
    } catch (_) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(`paxxmo-fallback:${name}`)
        }
      } catch (_) {}
    }
  },
}

// ─── App Store ─────────────────────────────────────────────────────────────
export const useAppStore = create(
  persist(
    (set, get) => ({
      activeModule: 'grocery',
      modules: {
        grocery: true,
        restaurant: false,
        clothing: false,
        pharmacy: false,
        wholesale: false,
        online: false,
      },
      businessInfo: {
        name: BRAND.name,
        address: '123 Main Street, Colombo',
        phone: '+94 11 234 5678',
        email: `support@${BRAND.website}`,
        taxId: 'TAX-001',
        storeId: uuidv4(), // Random ID for QR links (not Tax ID)
        publicMenuBaseUrl: DEFAULT_PUBLIC_MENU_BASE_URL,
        currency: 'LKR',
        currencySymbol: 'Rs.',
      },
      taxSettings: {
        enabled: true,
        rate: 15,
        name: 'VAT',
        inclusive: false,
      },
      serviceChargeSettings: {
        enabled: false,
        rate: 10,
        name: 'Service Charge',
      },
      receiptSettings: {
        header: 'Thank you for shopping!',
        footer: `Powered by ${BRAND.fullName}`,
        showBarcode: true,
        showTax: true,
        autoPrint: false,
        showCashier: true,
        logoUrl: null,
      },
      hardwareSettings: {
        barcodeScanner: true,
        printerType: 'Thermal (ESC/POS)',
        printerPort: '',
        paperWidth: '80mm',
        autoOpenDrawer: false,
        drawerPort: '',
      },
      theme: 'light',
      language: 'en',
      licenseKey: '',
      licenseActive: false,
      cloudSettings: {
        enabled: false,
        provider: 'firebase',
        firebaseConfig: defaultFirebaseConfigJson(),
        syncInterval: 10,
      },
      helaQRSettings: {
        enabled: false,
        testMode: true,
        baseUrl: '',
        appId: '',
        appSecret: '',
        businessId: '',
        notifyUrl: '',
      },
      cloudSubscription: {
        deploymentMode: 'local', // 'local' | 'cloud'
        status: 'inactive',       // 'inactive' | 'active' | 'past_due'
        plan: 'monthly',          // 'monthly' | 'annual'
        monthlyFee: 0,
        annualFee: 0,
        lastPaidAt: null,
        nextDueAt: null,
        customerName: '',
        billingEmail: '',
        notes: '',
        payments: [],
      },
      customerDisplaySettings: createCustomerDisplayDefaults(),
      qrSettings: {
        autoAccept: true,
        quickReplies: ['Out of stock', 'Kitchen busy (expect delay)', 'Cannot customize this', 'Extra spicy OK'],
      },

      setActiveModule: (mod) => set({ activeModule: mod }),
      toggleModule: (mod) =>
        set((s) => ({ modules: { ...s.modules, [mod]: !s.modules[mod] } })),
      updateBusinessInfo: (info) =>
        set((s) => ({ businessInfo: ensureBusinessStoreId({ ...s.businessInfo, ...info, publicMenuBaseUrl: normalizePublicMenuBaseUrl(info?.publicMenuBaseUrl ?? s.businessInfo.publicMenuBaseUrl) }) })),
      updateTaxSettings: (t) => {
        set((s) => ({ taxSettings: { ...s.taxSettings, ...t } }))
        import('@/lib/firebase').then(m => m.syncToCloud?.())
      },
      updateServiceChargeSettings: (sc) => {
        set((s) => ({ serviceChargeSettings: { ...s.serviceChargeSettings, ...sc } }))
        import('@/lib/firebase').then(m => m.syncToCloud?.())
      },
      updateReceiptSettings: (r) =>
        set((s) => ({ receiptSettings: { ...s.receiptSettings, ...r } })),
      updateHardwareSettings: (h) =>
        set((s) => ({ hardwareSettings: { ...s.hardwareSettings, ...h } })),
      updateQrSettings: (q) =>
        set((s) => ({ qrSettings: { ...s.qrSettings, ...q } })),
      activateLicense: async (key, profile = {}) => {
        const normalizedKey = String(key || '').trim().toUpperCase()
        const previousKey = String(get().licenseKey || '').trim().toUpperCase()
        const licenseChanged = normalizedKey && normalizedKey !== previousKey

        if (licenseChanged) {
          await resetBusinessDataForNewLicense()
        }

        set((state) => {
          const deploymentMode = normalizeLicensedDeploymentMode(profile?.deploymentMode, state.cloudSubscription?.deploymentMode)
          const modules = normalizeLicensedModules(profile?.modules, state.modules)
          const nextActiveModule = modules[state.activeModule]
            ? state.activeModule
            : (LICENSED_MODULE_KEYS.find((moduleName) => modules[moduleName]) || 'grocery')

          return {
            licenseKey: normalizedKey,
            licenseActive: true,
            modules,
            activeModule: nextActiveModule,
            cloudSubscription: {
              ...state.cloudSubscription,
              deploymentMode,
              status: deploymentMode === 'cloud'
                ? (state.cloudSubscription?.status === 'inactive' ? 'active' : state.cloudSubscription?.status)
                : 'inactive',
            },
            cloudSettings: {
              ...state.cloudSettings,
              enabled: deploymentMode === 'cloud',
            },
          }
        })
      },
      applyLicenseFeatures: (profile = {}) =>
        set((state) => {
          const deploymentMode = normalizeLicensedDeploymentMode(profile?.deploymentMode, state.cloudSubscription?.deploymentMode)
          const modules = normalizeLicensedModules(profile?.modules, state.modules)
          const nextActiveModule = modules[state.activeModule]
            ? state.activeModule
            : (LICENSED_MODULE_KEYS.find((moduleName) => modules[moduleName]) || 'grocery')

          return {
            modules,
            activeModule: nextActiveModule,
            cloudSubscription: {
              ...state.cloudSubscription,
              deploymentMode,
              status: deploymentMode === 'cloud'
                ? (state.cloudSubscription?.status === 'inactive' ? 'active' : state.cloudSubscription?.status)
                : 'inactive',
            },
            cloudSettings: {
              ...state.cloudSettings,
              enabled: deploymentMode === 'cloud',
            },
          }
        }),
      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => set({ theme: theme === 'dark' ? 'dark' : 'light' }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setDeploymentMode: (deploymentMode) =>
        set((s) => ({
          cloudSubscription: {
            ...s.cloudSubscription,
            deploymentMode: deploymentMode === 'cloud' ? 'cloud' : 'local',
            status: deploymentMode === 'cloud' ? (s.cloudSubscription.status === 'inactive' ? 'active' : s.cloudSubscription.status) : 'inactive',
          },
          cloudSettings: {
            ...s.cloudSettings,
            enabled: deploymentMode === 'cloud',
          },
        })),
      updateCloudSubscription: (updates) =>
        set((s) => ({
          cloudSubscription: { ...s.cloudSubscription, ...updates },
        })),
      recordCloudPayment: (payment) =>
        set((s) => ({
          cloudSubscription: {
            ...s.cloudSubscription,
            status: 'active',
            lastPaidAt: payment.paidAt || new Date().toISOString(),
            nextDueAt: payment.nextDueAt || null,
            payments: [
              { id: uuidv4(), paidAt: new Date().toISOString(), ...payment },
              ...(s.cloudSubscription.payments || []),
            ],
          },
        })),
      updateCloudSettings: (c) =>
        set((s) => ({ cloudSettings: { ...s.cloudSettings, ...c } })),
      updateHelaQRSettings: (settings) =>
        set((s) => ({ helaQRSettings: { ...s.helaQRSettings, ...settings } })),
      updateCustomerDisplaySettings: (updates) =>
        set((state) => {
          const nextSettings = normalizeCustomerDisplaySettings({
            ...state.customerDisplaySettings,
            ...updates,
          })
          publishCustomerDisplaySettings(nextSettings)
          return { customerDisplaySettings: nextSettings }
        }),
      addCustomerDisplaySlide: (slide) =>
        set((state) => {
          const nextSlide = {
            id: slide?.id || uuidv4(),
            type: String(slide?.type || 'text').toLowerCase(),
            title: slide?.title || 'New Slide',
            description: slide?.description || '',
            tag: slide?.tag || '',
            accent: slide?.accent || '#16a34a',
            src: slide?.src || '',
            mimeType: slide?.mimeType || '',
            gradient: slide?.gradient || 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)',
          }
          const nextSettings = normalizeCustomerDisplaySettings({
            ...state.customerDisplaySettings,
            slides: [...(state.customerDisplaySettings.slides || []), nextSlide],
          })
          publishCustomerDisplaySettings(nextSettings)
          return { customerDisplaySettings: nextSettings }
        }),
      updateCustomerDisplaySlide: (id, updates) =>
        set((state) => {
          const nextSettings = normalizeCustomerDisplaySettings({
            ...state.customerDisplaySettings,
            slides: (state.customerDisplaySettings.slides || []).map((slide) => (
              slide.id === id
                ? {
                    ...slide,
                    ...updates,
                    id: slide.id,
                    type: String(updates?.type || slide.type || 'text').toLowerCase(),
                  }
                : slide
            )),
          })
          publishCustomerDisplaySettings(nextSettings)
          return { customerDisplaySettings: nextSettings }
        }),
      removeCustomerDisplaySlide: (id) =>
        set((state) => {
          const nextSettings = normalizeCustomerDisplaySettings({
            ...state.customerDisplaySettings,
            slides: (state.customerDisplaySettings.slides || []).filter((slide) => slide.id !== id),
          })
          publishCustomerDisplaySettings(nextSettings)
          return { customerDisplaySettings: nextSettings }
        }),
      resetCustomerDisplaySettings: () => {
        const nextSettings = createCustomerDisplayDefaults()
        publishCustomerDisplaySettings(nextSettings)
        set({ customerDisplaySettings: nextSettings })
      },
    }),
    {
      name: 'paxxmo-app',
      version: APP_STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      migrate: (persistedState) => ({
        ...persistedState,
        businessInfo: ensureBusinessStoreId(persistedState?.businessInfo || {}),
        receiptSettings: {
          header: persistedState?.receiptSettings?.header || 'Thank you for shopping!',
          footer: persistedState?.receiptSettings?.footer === 'Powered by Paxxmo POS'
            ? `Powered by ${BRAND.fullName}`
            : (persistedState?.receiptSettings?.footer || `Powered by ${BRAND.fullName}`),
          showBarcode: persistedState?.receiptSettings?.showBarcode ?? true,
          showTax: persistedState?.receiptSettings?.showTax ?? true,
          autoPrint: persistedState?.receiptSettings?.autoPrint ?? false,
          showCashier: persistedState?.receiptSettings?.showCashier ?? true,
          logoUrl: persistedState?.receiptSettings?.logoUrl ?? null,
        },
        helaQRSettings: {
          enabled: false,
          testMode: true,
          baseUrl: '',
          appId: '',
          appSecret: '',
          businessId: '',
          notifyUrl: '',
          ...(persistedState?.helaQRSettings || {}),
        },
        customerDisplaySettings: normalizeCustomerDisplaySettings(persistedState?.customerDisplaySettings || {}),
        cloudSettings: {
          enabled: persistedState?.cloudSettings?.enabled ?? false,
          provider: persistedState?.cloudSettings?.provider || 'firebase',
          firebaseConfig: persistedState?.cloudSettings?.firebaseConfig || defaultFirebaseConfigJson(),
          syncInterval: persistedState?.cloudSettings?.syncInterval || 10,
        },
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.businessInfo) {
          state.businessInfo = ensureBusinessStoreId(state.businessInfo)
        }
        if (state?.cloudSettings) {
          state.cloudSettings = {
            enabled: state.cloudSettings.enabled ?? false,
            provider: state.cloudSettings.provider || 'firebase',
            firebaseConfig: state.cloudSettings.firebaseConfig || defaultFirebaseConfigJson(),
            syncInterval: state.cloudSettings.syncInterval || 10,
          }
        }
        if (state?.receiptSettings?.footer === 'Powered by Paxxmo POS') {
          state.receiptSettings.footer = `Powered by ${BRAND.fullName}`
        }
        if (state?.customerDisplaySettings) {
          state.customerDisplaySettings = normalizeCustomerDisplaySettings(state.customerDisplaySettings)
        }
      },
    }
  )
)

// ─── Tables & KOT Store ────────────────────────────────────────────────────
const SAMPLE_TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: `table-${i + 1}`,
  number: i + 1,
  seats: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 8, 6][i],
  status: ['available', 'available', 'occupied', 'available', 'reserved', 'occupied', 'available', 'occupied', 'available', 'available', 'reserved', 'available'][i],
  order: null,
  waiter: null,
  qrToken: null,
}))

export const useTableStore = create(
  persist(
    (set, get) => ({
      tables: SAMPLE_TABLES,
      kots: [],
      pendingQrOrders: [],
      addPendingQrOrder: (order) => set((s) => ({ 
        pendingQrOrders: [...s.pendingQrOrders.filter((o) => o.id !== order.id), order] 
      })),
      removePendingQrOrder: (id) => set((s) => ({ 
        pendingQrOrders: s.pendingQrOrders.filter((o) => o.id !== id) 
      })),
      addTable: ({ number, seats = 4, status = 'available' }) =>
        set((s) => ({
          tables: [
            ...s.tables,
            {
              id: uuidv4(),
              number: Number(number || 0),
              seats: Number(seats || 4),
              status: String(status || 'available'),
              order: null,
              waiter: null,
              qrToken: null,
              sessionId: null,
              guests: 0,
            },
          ],
        })),
      editTable: (id, updates) =>
        set((s) => {
          const current = s.tables.find((t) => t.id === id)
          if (!current) return s

          const nextNumber = updates?.number !== undefined ? Number(updates.number) : current.number
          return {
            tables: s.tables.map((t) =>
              t.id === id
                ? {
                    ...t,
                    ...updates,
                    number: nextNumber,
                    seats: updates?.seats !== undefined ? Number(updates.seats) : t.seats,
                  }
                : t
            ),
            kots: s.kots.map((k) =>
              k.tableId === id
                ? { ...k, tableNumber: nextNumber }
                : k
            ),
          }
        }),
      deleteTable: (id) =>
        set((s) => ({
          tables: s.tables.filter((t) => t.id !== id),
          kots: s.kots.filter((k) => k.tableId !== id),
        })),
      updateTable: (id, updates) =>
        set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
      addKOT: (kot) =>
        set((s) => ({ kots: [{ ...kot, id: uuidv4(), time: new Date(), status: 'pending' }, ...s.kots] })),
      updateKOTStatus: (id, status) =>
        set((s) => ({ kots: s.kots.map((k) => (k.id === id ? { ...k, status } : k)) })),
      clearTable: (id) =>
        set((s) => ({
          tables: s.tables.map((t) =>
            t.id === id ? { ...t, status: 'available', order: null, waiter: null, sessionId: null, guests: 0, qrToken: null } : t
          ),
          kots: s.kots.filter((k) => k.tableId !== id),
        })),
      transferTable: (oldId, newId) => set((s) => {
        const oldTable = s.tables.find((t) => t.id === oldId)
        const newTable = s.tables.find((t) => t.id === newId)
        if (!oldTable || !newTable) return s

        return {
          tables: s.tables.map((t) => {
            if (t.id === newId) {
              return { ...t, status: 'occupied', order: oldTable.order, waiter: oldTable.waiter, guests: oldTable.guests, sessionId: oldTable.sessionId, qrToken: oldTable.qrToken }
            }
            if (t.id === oldId) {
              return { ...t, status: 'available', order: null, waiter: null, guests: 0, sessionId: null, qrToken: null }
            }
            return t
          }),
          kots: s.kots.map((k) => k.tableId === oldId ? { ...k, tableId: newId, tableNumber: newTable.number } : k),
        }
      }),
    }),
    {
      name: 'paxxmo-tables',
      storage: createJSONStorage(() => idbStorage),
    }
  )
)

// ─── Products Store ─────────────────────────────────────────────────────────
const SAMPLE_PRODUCTS = [
  { id: '1', module: 'grocery', name: 'Basmati Rice 5kg', barcode: '4001234567890', price: 1450, cost: 1200, category: 'Grains', stock: 48, unit: 'bag', image: null, variants: [], expiry: null, active: true },
  { id: '2', module: 'grocery', name: 'Sunflower Oil 1L', barcode: '4009876543210', price: 420, cost: 340, category: 'Oils', stock: 32, unit: 'bottle', image: null, variants: [], expiry: null, active: true },
  { id: '3', module: 'grocery', name: 'White Sugar 1kg', barcode: '4005555555555', price: 195, cost: 155, category: 'Groceries', stock: 5, unit: 'pack', image: null, variants: [], expiry: null, active: true },
  { id: '4', module: 'grocery', name: 'Full Cream Milk 1L', barcode: '4003333333333', price: 280, cost: 230, category: 'Dairy', stock: 20, unit: 'carton', image: null, variants: [], expiry: '2026-05-01', active: true },
  { id: '5', module: 'grocery', name: 'Wheat Flour 1kg', barcode: '4002222222222', price: 165, cost: 130, category: 'Grains', stock: 15, unit: 'pack', image: null, variants: [], expiry: null, active: true },
  { id: '6', module: 'grocery', name: 'Coconut Oil 500ml', barcode: '4004444444444', price: 520, cost: 430, category: 'Oils', stock: 8, unit: 'bottle', image: null, variants: [], expiry: null, active: true },
  { id: '7', module: 'grocery', name: 'Salt 500g', barcode: '4006666666666', price: 75, cost: 55, category: 'Groceries', stock: 60, unit: 'pack', image: null, variants: [], expiry: null, active: true },
  { id: '8', module: 'grocery', name: 'Green Tea (25 bags)', barcode: '4007777777777', price: 340, cost: 260, category: 'Beverages', stock: 22, unit: 'box', image: null, variants: [], expiry: null, active: true },
  { id: '9', module: 'grocery', name: 'Dettol Soap 100g', barcode: '4008888888888', price: 120, cost: 85, category: 'Personal Care', stock: 45, unit: 'bar', image: null, variants: [], expiry: null, active: true },
  { id: '10', module: 'pharmacy', name: 'Paracetamol 500mg', barcode: '4000000000001', price: 35, cost: 20, category: 'Pharmacy', stock: 200, unit: 'strip', image: null, variants: [], expiry: '2027-12-31', active: true },
  { id: '11', module: 'restaurant', name: 'Chicken Fried Rice', barcode: 'REST-001', price: 850, cost: 400, category: 'Mains', stock: 999, unit: 'plate', image: null, variants: [], expiry: null, active: true },
  { id: '12', module: 'restaurant', name: 'Spicy Cheese Pizza (Large)', barcode: 'REST-002', price: 2200, cost: 1100, category: 'Pizzas', stock: 999, unit: 'box', image: null, variants: [], expiry: null, active: true },
  { id: '13', module: 'clothing', name: 'Denim Jeans Slim Fit', barcode: 'CLOT-001', price: 4500, cost: 2200, category: 'Pants', stock: 50, unit: 'piece', image: null, variants: [], expiry: null, active: true },
]

const DEFAULT_CATEGORIES_BY_MODULE = {
  grocery: ['Grains', 'Oils', 'Groceries', 'Dairy', 'Beverages', 'Personal Care', 'Condiments'],
  restaurant: ['Mains', 'Pizzas', 'Starters', 'Drinks', 'Desserts', 'Kottu'],
  pharmacy: ['Pharmacy', 'Rx', 'OTC'],
  clothing: ['Pants', 'Shirts', 'Shoes', 'Accessories'],
  wholesale: ['Bulk', 'Packed Goods'],
  online: ['Marketplace', 'Delivery'],
}

const normalizeModuleKey = (moduleName) => String(moduleName || 'grocery').trim().toLowerCase() || 'grocery'

export const useProductStore = create(
  persist(
    (set, get) => ({
      products: SAMPLE_PRODUCTS,
      categories: [...DEFAULT_CATEGORIES_BY_MODULE.grocery],
      categoriesByModule: DEFAULT_CATEGORIES_BY_MODULE,

      getCategoriesForModule: (moduleName) => {
        const key = normalizeModuleKey(moduleName)
        return get().categoriesByModule?.[key] || []
      },

      addCategory: (moduleName, categoryName) => {
        const key = normalizeModuleKey(moduleName)
        const category = String(categoryName || '').trim()
        if (!category) return

        set((state) => {
          const current = state.categoriesByModule?.[key] || []
          if (current.includes(category)) return state
          return {
            categoriesByModule: {
              ...state.categoriesByModule,
              [key]: [...current, category],
            },
          }
        })
      },

      removeCategory: (moduleName, categoryName) => {
        const key = normalizeModuleKey(moduleName)
        const category = String(categoryName || '').trim()
        if (!category) return

        set((state) => ({
          categoriesByModule: {
            ...state.categoriesByModule,
            [key]: (state.categoriesByModule?.[key] || []).filter((item) => item !== category),
          },
        }))
      },

      loadProducts: async () => {
        if (typeof window !== 'undefined' && window.require) {
          const ipcRenderer = window.require('electron').ipcRenderer;
          const dbProducts = await ipcRenderer.invoke('get-products');
          if (dbProducts && dbProducts.length > 0) {
            set({ products: dbProducts });
          } else {
            // Seed sample products on first run
            const initialProducts = get().products;
            if (initialProducts.length > 0) {
              initialProducts.forEach(p => ipcRenderer.invoke('add-product', p));
            }
          }
        }
      },

      addProduct: (product) => {
        const now = new Date().toISOString();
        const newProduct = { ...product, id: product.id || uuidv4(), createdAt: product.createdAt || now, updatedAt: now };
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('add-product', newProduct);
        }
        set((s) => ({
          products: [...s.products, newProduct],
        }));
      },
      updateProduct: (id, updates) => {
        const now = new Date().toISOString();
        const nextUpdates = { ...updates, updatedAt: now };
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('update-product', id, nextUpdates);
        }
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...nextUpdates } : p)),
        }));
      },
      deleteProduct: (id) => {
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('delete-product', id);
        }
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
      },
      adjustStock: (id, qty) => {
        const p = get().products.find(x => x.id === id);
        if(!p) return;
        const newStock = Math.max(0, p.stock + qty);
        const updatedAt = new Date().toISOString();
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('update-product', id, { stock: newStock, updatedAt });
        }
        set((s) => ({
          products: s.products.map((prd) =>
            prd.id === id ? { ...prd, stock: newStock, updatedAt } : prd
          ),
        }));
      },
      addCategory: (cat) =>
        set((s) => ({
          categories: s.categories.includes(cat) ? s.categories : [...s.categories, cat],
        })),
      getByBarcode: (barcode) =>
        get().products.find((p) => p.barcode === barcode && p.active),
      getLowStock: () => get().products.filter((p) => p.stock <= 10 && p.active),
      getOutOfStock: () => get().products.filter((p) => p.stock === 0 && p.active),
    }),
    { 
      name: 'paxxmo-products',
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        categories: state.categories,
        categoriesByModule: state.categoriesByModule,
      }),
      migrate: (persistedState) => {
        const legacyCategories = Array.isArray(persistedState?.categories) ? persistedState.categories : []
        const currentCategoriesByModule = persistedState?.categoriesByModule || {}
        return {
          ...persistedState,
          categories: legacyCategories.length > 0 ? legacyCategories : [...DEFAULT_CATEGORIES_BY_MODULE.grocery],
          categoriesByModule: {
            ...DEFAULT_CATEGORIES_BY_MODULE,
            ...currentCategoriesByModule,
            grocery: legacyCategories.length > 0 ? legacyCategories : (currentCategoriesByModule.grocery || DEFAULT_CATEGORIES_BY_MODULE.grocery),
          },
        }
      },
    }
  )
)

if (typeof window !== 'undefined' && window.require) {
  setTimeout(() => {
    useProductStore.getState().loadProducts();
  }, 100);
}

// ─── Recipes Store (Restaurant Mode) ────────────────────────────────────────
export const useRecipeStore = create(
  persist(
    (set, get) => ({
      recipes: {
        // Chicken Fried Rice: 300g rice + 100g chicken + 2 eggs (simulated as milk) + 30ml oil
        'REST-001': [
          { ingredientId: '1', name: 'Basmati Rice', qty: 300, unit: 'g' },
          { ingredientId: '4', name: 'Eggs (Milk)', qty: 2, unit: 'count' },
          { ingredientId: '6', name: 'Oil', qty: 30, unit: 'ml' },
          { ingredientId: '7', name: 'Salt', qty: 1, unit: 'pinch' },
        ],
        // Spicy Cheese Pizza: 200g flour + 100ml oil + 100g cheese (milk) + salt
        'REST-002': [
          { ingredientId: '5', name: 'Wheat Flour', qty: 200, unit: 'g' },
          { ingredientId: '6', name: 'Oil', qty: 100, unit: 'ml' },
          { ingredientId: '4', name: 'Cheese/Milk', qty: 100, unit: 'g' },
          { ingredientId: '7', name: 'Salt', qty: 2, unit: 'pinch' },
        ],
      },

      setRecipe: (dishId, ingredients) => {
        set((s) => ({
          recipes: { ...s.recipes, [dishId]: ingredients || [] },
        }))
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('set-recipe', dishId, ingredients || [])
        }
      },

      getRecipe: (dishId) => get().recipes[dishId] || [],

      deductIngredients: (dishId, qty = 1) => {
        const recipe = get().recipes[dishId]
        if (!recipe || recipe.length === 0) return { success: true, message: 'No ingredients to deduct' }

        try {
          const products = useProductStore.getState().products
          const adjustStock = useProductStore.getState().adjustStock

          recipe.forEach((ingredient) => {
            const product = products.find((p) => p.id === ingredient.ingredientId)
            if (product) {
              const totalDeduction = ingredient.qty * qty
              adjustStock(ingredient.ingredientId, -totalDeduction)
            }
          })

          return { success: true, message: `Deducted ingredients for ${qty}x dish` }
        } catch (err) {
          return { success: false, message: err.message }
        }
      },
    }),
    {
      name: 'paxxmo-recipes',
      storage: createJSONStorage(() => idbStorage),
    }
  )
)

// ─── POS (Cart) Store ───────────────────────────────────────────────────────
export const usePOSStore = create((set, get) => ({
  cart: [],
  customer: null,
  discount: 0,
  discountType: 'percent', // 'percent' | 'fixed'
  note: '',
  heldTransactions: [],

  addToCart: (product, qty = 1) => {
    const cart = get().cart
    const existing = cart.find((i) => i.id === product.id)
    if (existing) {
      set({
        cart: cart.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + qty } : i
        ),
      })
    } else {
      set({ cart: [...cart, { ...product, qty, salePrice: product.price }] })
    }
  },
  removeFromCart: (id) =>
    set((s) => ({ cart: s.cart.filter((i) => i.id !== id) })),
  updateQty: (id, qty) => {
    if (qty <= 0) {
      get().removeFromCart(id)
      return
    }
    set((s) => ({
      cart: s.cart.map((i) => (i.id === id ? { ...i, qty } : i)),
    }))
  },
  updatePrice: (id, price) =>
    set((s) => ({
      cart: s.cart.map((i) => (i.id === id ? { ...i, salePrice: price } : i)),
    })),
  clearCart: () => set({ cart: [], discount: 0, customer: null, note: '' }),
  setDiscount: (discount, type) => set({ discount, discountType: type }),
  setCustomer: (c) => set({ customer: c }),
  setNote: (n) => set({ note: n }),
  holdTransaction: () => {
    const { cart, customer, discount, discountType, note, heldTransactions } = get()
    if (cart.length === 0) return
    set({
      heldTransactions: [
        ...heldTransactions,
        { id: uuidv4(), cart, customer, discount, discountType, note, time: new Date() },
      ],
      cart: [],
      discount: 0,
      customer: null,
      note: '',
    })
  },
  resumeTransaction: (id) => {
    const held = get().heldTransactions.find((t) => t.id === id)
    if (!held) return
    set({
      cart: held.cart,
      customer: held.customer,
      discount: held.discount,
      discountType: held.discountType,
      note: held.note,
      heldTransactions: get().heldTransactions.filter((t) => t.id !== id),
    })
  },

  getSubtotal: () =>
    get().cart.reduce((sum, i) => sum + i.salePrice * i.qty, 0),
  getDiscountAmount: () => {
    const { discount, discountType, getSubtotal } = get()
    const sub = getSubtotal()
    return discountType === 'percent' ? (sub * discount) / 100 : Math.min(discount, sub)
  },
  getTax: (rate, taxIncluded) => {
    const sub = get().getSubtotal() - get().getDiscountAmount()
    return taxIncluded ? 0 : (sub * rate) / 100
  },
  getTotal: (rate = 0, taxIncluded = false) => {
    const sub = get().getSubtotal()
    const disc = get().getDiscountAmount()
    const tax = get().getTax(rate, taxIncluded)
    return sub - disc + tax
  },
}))

// ─── Sales Store ────────────────────────────────────────────────────────────
const generateSampleSales = () => {
  const sales = []
  const now = new Date()
  for (let d = 0; d < 30; d++) {
    const date = new Date(now)
    date.setDate(date.getDate() - d)
    const count = Math.floor(Math.random() * 15) + 5
    for (let i = 0; i < count; i++) {
      const items = Math.floor(Math.random() * 6) + 1
      const total = Math.floor(Math.random() * 8000) + 500
      sales.push({
        id: uuidv4(),
        receiptNo: generateReceiptNumber(),
        date: new Date(date.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60))),
        items: items,
        subtotal: total,
        discount: Math.floor(total * 0.05),
        tax: Math.floor(total * 0.15),
        total: Math.floor(total * 1.1),
        paymentMethod: ['cash', 'card', 'split'][Math.floor(Math.random() * 3)],
        status: 'completed',
        source: 'grocery', // Enforce legacy sample sales to only show inside Grocery ecosystem
        cashier: 'Admin',
      })
    }
  }
  return sales
}

export const useSalesStore = create(
  persist(
    (set, get) => ({
      sales: [],

      addSale: (sale) =>
        set((s) => ({
          sales: [{
            ...sale,
            id: uuidv4(),
            date: new Date(),
            receiptNo: String(sale.receiptNo || '').trim() || generateReceiptNumber(),
            paymentMethod: sale.paymentMethod || 'cash',
            status: sale.status || 'completed',
            source: sale.source || 'grocery',
            items_detail: sale.items_detail || sale.cartItems || [],
          }, ...s.sales],
        })),
      finalizePendingSale: ({ receiptNo, paymentRef } = {}) => {
        const normalizedReceipt = String(receiptNo || '').trim().toUpperCase()
        const normalizedRef = String(paymentRef || '').trim()
        const targetSale = get().sales.find((sale) => {
          const saleReceipt = String(sale.receiptNo || '').trim().toUpperCase()
          return sale.status === 'pending' && (
            (normalizedReceipt && saleReceipt === normalizedReceipt) ||
            (normalizedRef && String(sale.paymentRef || '') === normalizedRef)
          )
        })

        if (!targetSale) {
          return { success: false, error: 'Pending sale not found' }
        }

        const adjustStock = useProductStore.getState().adjustStock
        const cartItems = Array.isArray(targetSale.cartItems) ? targetSale.cartItems : []
        cartItems.forEach((item) => {
          adjustStock(item.id, -Number(item.qty || 0))
        })

        if (targetSale.source === 'restaurant' || targetSale.source === 'takeout') {
          const recipes = useRecipeStore.getState().recipes || {}
          cartItems.forEach((item) => {
            const recipe = recipes[item.id] || []
            recipe.forEach((ingredient) => {
              const qtyDown = Number(ingredient.qty || 0) * Number(item.qty || 0)
              adjustStock(ingredient.ingredientId, -qtyDown)
            })
          })
        }

        set((s) => ({
          sales: s.sales.map((sale) => (
            sale.id === targetSale.id
              ? { ...sale, status: 'completed', paymentStatus: 'paid', paidAt: new Date() }
              : sale
          )),
        }))

        return { success: true, sale: targetSale }
      },
      findSaleByReceiptNo: (receiptNo) => {
        if (!receiptNo) return null
        const normalized = String(receiptNo).trim().toUpperCase()
        return get().sales.find((s) => String(s.receiptNo || '').trim().toUpperCase() === normalized) || null
      },
      refundSaleByReceiptNo: ({ receiptNo, reason = 'Customer return', cashier = 'System' }) => {
        const originalSale = get().findSaleByReceiptNo(receiptNo)
        if (!originalSale) {
          return { success: false, error: 'Receipt not found' }
        }

        if (!originalSale.receiptNo) {
          return { success: false, error: 'This sale has no receipt number and cannot be refunded.' }
        }

        if (originalSale.status === 'refunded' || originalSale.isRefunded) {
          return { success: false, error: 'This receipt is already refunded.' }
        }

        const refundReceiptNo = `RF-${originalSale.receiptNo}`
        const existingRefund = get().sales.find((s) => s.receiptNo === refundReceiptNo)
        if (existingRefund) {
          return { success: false, error: 'Refund record already exists for this receipt.' }
        }

        const cartItems = originalSale.cartItems || []
        const total = Number(originalSale.total || 0)
        const subtotal = Number(originalSale.subtotal || total)
        const tax = Number(originalSale.tax || 0)
        const discount = Number(originalSale.discount || 0)
        const serviceCharge = Number(originalSale.serviceCharge || 0)

        const adjustStock = useProductStore.getState().adjustStock
        cartItems.forEach((item) => {
          adjustStock(item.id, Number(item.qty || 0))
        })

        // For restaurant/takeout, return ingredient stock as well when recipes are configured.
        if (originalSale.source === 'restaurant' || originalSale.source === 'takeout') {
          const recipes = useRecipeStore.getState().recipes || {}
          cartItems.forEach((item) => {
            const recipe = recipes[item.id] || []
            recipe.forEach((ingredient) => {
              const qtyBack = Number(ingredient.qty || 0) * Number(item.qty || 0)
              adjustStock(ingredient.ingredientId, qtyBack)
            })
          })
        }

        const refundSale = {
          receiptNo: refundReceiptNo,
          date: new Date(),
          cartItems,
          items_detail: cartItems,
          items: originalSale.items || cartItems.reduce((sum, i) => sum + Number(i.qty || 0), 0),
          subtotal: -Math.abs(subtotal),
          discount: -Math.abs(discount),
          tax: -Math.abs(tax),
          serviceCharge: -Math.abs(serviceCharge),
          total: -Math.abs(total),
          paymentMethod: originalSale.paymentMethod || 'cash',
          change: 0,
          cashier,
          source: originalSale.source || 'grocery',
          status: 'refund',
          refundOf: originalSale.id,
          refundReason: reason,
          originalReceiptNo: originalSale.receiptNo,
        }

        set((s) => ({
          sales: [
            { ...refundSale, id: uuidv4() },
            ...s.sales.map((sale) =>
              sale.id === originalSale.id ? { ...sale, status: 'refunded', isRefunded: true } : sale
            ),
          ],
        }))

        return { success: true, refundSale, originalSale }
      },
      getTodaySales: () => {
        const today = new Date()
        return get().sales.filter((s) => {
          const d = new Date(s.date)
          return d.toDateString() === today.toDateString()
        })
      },
      getWeeklySales: () => {
        const week = new Date()
        week.setDate(week.getDate() - 7)
        return get().sales.filter((s) => new Date(s.date) >= week)
      },
      getMonthlySales: () => {
        const month = new Date()
        month.setDate(month.getDate() - 30)
        return get().sales.filter((s) => new Date(s.date) >= month)
      },
      getTodayRevenue: () =>
        get()
          .getTodaySales()
          .reduce((sum, s) => sum + s.total, 0),
      getMonthlyRevenue: () =>
        get()
          .getMonthlySales()
          .reduce((sum, s) => sum + s.total, 0),
    }),
    { 
      name: 'paxxmo-sales',
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      migrate: (persisted) => ({
        // Strip out auto-generated sample data by keeping only real sales (those with a proper receiptNo)
        ...persisted,
        sales: (persisted?.sales || []).filter((s) => s?.receiptNo && String(s.receiptNo).startsWith('R')),
      }),
    }
  )
)

// ─── Customers Store ────────────────────────────────────────────────────────
const SAMPLE_CUSTOMERS = [
  { id: '1', name: 'Kasun Perera', phone: '0771234567', email: 'kasun@email.com', totalPurchases: 45000, credit: 0, type: 'retail' },
  { id: '2', name: 'Nimal Jayawardena', phone: '0712345678', email: 'nimal@email.com', totalPurchases: 120000, credit: 5000, type: 'wholesale' },
  { id: '3', name: 'Sameera Fernando', phone: '0756789012', email: '', totalPurchases: 28000, credit: 0, type: 'retail' },
]

export const useCustomerStore = create(
  persist(
    (set, get) => ({
      customers: [],
      addCustomer: (c) =>
        set((s) => ({ customers: [...s.customers, { ...c, id: uuidv4(), totalPurchases: 0, credit: 0 }] })),
      updateCustomer: (id, updates) =>
        set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),
      deleteCustomer: (id) =>
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
      searchCustomers: (q) => {
        const lower = q.toLowerCase()
        return get().customers.filter(
          (c) => c.name.toLowerCase().includes(lower) || c.phone.includes(q)
        )
      },
    }),
    { 
      name: 'paxxmo-customers',
      storage: createJSONStorage(() => idbStorage)
    }
  )
)

// ─── Auth Store ─────────────────────────────────────────────────────────────
const ipc = () => typeof window !== 'undefined' && window.require
  ? window.require('electron').ipcRenderer
  : null

// Default per-role allowed settings tabs (super_admin always sees all)
const DEFAULT_ADMIN_SETTINGS = {
  owner:   { business: false, tax: true, modules: false, receipt: true, 'customer-display': true, hardware: true, cloud: false, users: true, license: true },
  manager: { business: false, tax: false, modules: false, receipt: true, hardware: false, cloud: false, users: false, license: false },
  staff:   { business: false, tax: false, modules: false, receipt: false, hardware: false, cloud: false, users: false, license: false },
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],   // loaded from SQLite via IPC
      roles: {
        super_admin: { name: 'Super Admin',  permissions: ['all'] },
        owner:       { name: 'Owner',        permissions: ['manage_users', 'view_reports', 'manage_inventory', 'manage_settings', 'sales', 'view_logs'] },
        manager:     { name: 'Manager',      permissions: ['view_reports', 'manage_inventory', 'sales'] },
        staff:       { name: 'Staff',        permissions: ['sales'] },
      },
      // Which settings tabs each non-super_admin role can access
      adminSettingsPermissions: DEFAULT_ADMIN_SETTINGS,

      // ── Load all users from DB ──────────────────────────────────────────
      loadUsers: async () => {
        const renderer = ipc()
        if (!renderer) return
        const users = await renderer.invoke('users-get-all')
        set({ users })
      },

      // ── Username + Password login (calls DB) ────────────────────────────
      login: async (username, password) => {
        // Try superadmin portal login first
        try {
          const { verifyPortalLogin } = await import('@/lib/portalAuth')
          const portalResult = await verifyPortalLogin({ username, password })
          if (portalResult.success) {
            set({ 
              currentUser: { 
                id: 'portal-superadmin', 
                username: portalResult.user.username, 
                fullName: portalResult.user.fullName || 'Super Admin', 
                role: 'super_admin' 
              } 
            })
            return true
          }
        } catch (error) {
          // Ignore network errors or if portalAuth fails, fallback to local
        }

        const renderer = ipc()
        if (renderer) {
          const user = await renderer.invoke('auth-login', { username, password })
          if (user) { set({ currentUser: user }); return true }
          return false
        }
        // Fallback: no electron (browser dev mode)
        return false
      },

      // ── Barcode badge login ─────────────────────────────────────────────
      loginByBarcode: async (barcode) => {
        const renderer = ipc()
        if (renderer) {
          const user = await renderer.invoke('auth-barcode', { barcode })
          if (user) { set({ currentUser: user }); return true }
          return false
        }
        return false
      },

      // POS quick-switch: allow barcode switch only for cashier/staff accounts.
      switchCashierByBarcode: async (barcode) => {
        const renderer = ipc()
        if (!renderer) return { success: false, error: 'No IPC' }

        const user = await renderer.invoke('auth-barcode', { barcode })
        if (!user) return { success: false, error: 'No user found for this barcode' }

        if (user.role !== 'staff') {
          return { success: false, error: 'Only cashier accounts can be switched by barcode' }
        }

        set({ currentUser: user })
        return { success: true, user }
      },

      logout: () => set({ currentUser: null }),

      // ── User management (all IPC-backed) ───────────────────────────────
      addUser: async (userData) => {
        const renderer = ipc()
        if (!renderer) return { success: false, error: 'No IPC' }
        const id = uuidv4()
        const result = await renderer.invoke('users-add', { ...userData, id })
        if (result.success) await get().loadUsers()
        return result
      },

      updateUser: async (id, updates) => {
        const renderer = ipc()
        if (!renderer) return { success: false, error: 'No IPC' }
        const result = await renderer.invoke('users-update', { id, updates })
        if (result.success) await get().loadUsers()
        return result
      },

      deleteUser: async (id) => {
        const renderer = ipc()
        if (!renderer) return
        await renderer.invoke('users-delete', { id })
        await get().loadUsers()
      },

      updateRolePermissions: (roleId, permissions) => set(s => ({
        roles: { ...s.roles, [roleId]: { ...s.roles[roleId], permissions } }
      })),

      // Update which settings tabs a role can access
      updateAdminSettingsPermission: (role, tab, value) => set(s => ({
        adminSettingsPermissions: {
          ...s.adminSettingsPermissions,
          [role]: { ...s.adminSettingsPermissions[role], [tab]: value }
        }
      })),

      // Can the current user see a given settings tab?
      canAccessSettingsTab: (tabId) => {
        const u = get().currentUser
        if (!u) return false
        // super_admin always has full access
        if (u.role === 'super_admin') return true
        const map = get().adminSettingsPermissions
        const rolePerm = map[u.role]
        if (!rolePerm) return false
        return !!rolePerm[tabId]
      },

      hasPermission: (permission) => {
        const u = get().currentUser
        if (!u) return false
        const role = get().roles[u.role]
        if (!role) return false
        if (role.permissions.includes('all')) return true
        return role.permissions.includes(permission)
      }
    }),
    {
      name: 'paxxmo-auth',
      version: 3,
      storage: createJSONStorage(() => idbStorage),
      // Never persist permissions — always loaded fresh from code (prevents security bypass)
      partialize: (s) => ({ currentUser: s.currentUser }),
      migrate: () => ({}),
    }
  )
)

// ─── Activity Log Store ─────────────────────────────────────────────────────
export const useActivityStore = create(
  persist(
    (set, get) => ({
      logs: [],
      addLog: (action, details, user) => set(s => ({
        logs: [{ id: uuidv4(), date: new Date(), action, details, user: user || 'System' }, ...s.logs].slice(0, 500)
      })),
      clearLogs: () => set({ logs: [] })
    }),
    { name: 'paxxmo-activities', storage: createJSONStorage(() => idbStorage) }
  )
)

export async function resetBusinessDataForNewLicense() {
  // ── Step 1: Sync everything to Cloud BEFORE clearing ─────────────────────
  try {
    const { syncToCloud } = await import('@/lib/firebase')
    await syncToCloud()
  } catch (_) {}

  // ── Step 2: Save a full local JSON backup to the device ───────────────────
  try {
    const backup = {
      exportedAt: new Date().toISOString(),
      products:   useProductStore.getState().products,
      sales:      useSalesStore.getState().sales,
      customers:  useCustomerStore.getState().customers,
      logs:       useActivityStore.getState().logs,
      recipes:    useRecipeStore.getState().recipes,
      tables:     useTableStore.getState().tables,
      kots:       useTableStore.getState().kots,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paxxmo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 2000)
  } catch (_) {}

  // ── Step 3: Clear SQLite on Electron ──────────────────────────────────────
  try {
    if (typeof window !== 'undefined' && window.require) {
      window.require('electron').ipcRenderer.invoke('reset-business-data').catch(() => {})
    }
  } catch (_) {}

  // ── Step 4: Clear Zustand stores (in-memory + IndexedDB) ─────────────────
  usePOSStore.setState({ cart: [], customer: null, discount: 0, discountType: 'percent', note: '', heldTransactions: [] })
  useTableStore.setState((state) => ({
    tables: state.tables.map((table) => ({ ...table, status: 'available', order: null, waiter: null, sessionId: null, guests: 0, qrToken: null })),
    kots: [],
  }))
  useProductStore.setState({ products: [] })
  useRecipeStore.setState({ recipes: {} })
  useSalesStore.setState({ sales: [] })
  useCustomerStore.setState({ customers: [] })
  useActivityStore.setState({ logs: [] })
}

function canUseElectronIpc() {
  return typeof window !== 'undefined' && typeof window.require === 'function'
}

function getBackupPayload() {
  const appState = useAppStore.getState()
  const {
    licenseKey,
    licenseActive,
    ...safeAppState
  } = appState

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    app: safeAppState,
    tables: useTableStore.getState(),
    products: {
      categories: useProductStore.getState().categories,
      categoriesByModule: useProductStore.getState().categoriesByModule,
    },
    recipes: useRecipeStore.getState(),
    sales: useSalesStore.getState(),
    customers: useCustomerStore.getState(),
    auth: {
      currentUser: useAuthStore.getState().currentUser,
    },
    activities: useActivityStore.getState(),
  }
}

export async function restoreFromLocalBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') return false
  try {
    // Never restore license fields from local backup snapshots.
    // License persistence is handled by Zustand persist + Firebase validation flow.
    if (payload.app) {
      const {
        licenseKey: _ignoredLicenseKey,
        licenseActive: _ignoredLicenseActive,
        ...safeAppState
      } = payload.app
      useAppStore.setState((state) => ({
        ...state,
        ...safeAppState,
      }))
    }
    if (payload.tables) useTableStore.setState(payload.tables, true)
    if (payload.products) {
      const currentProducts = useProductStore.getState()
      useProductStore.setState({
        ...currentProducts,
        categories: Array.isArray(payload.products.categories) ? payload.products.categories : currentProducts.categories,
        categoriesByModule: payload.products.categoriesByModule || currentProducts.categoriesByModule,
      })
    }
    if (payload.recipes) useRecipeStore.setState(payload.recipes, true)
    if (payload.sales) useSalesStore.setState(payload.sales, true)
    if (payload.customers) useCustomerStore.setState(payload.customers, true)
    if (payload.activities) useActivityStore.setState(payload.activities, true)
    if (payload.auth?.currentUser !== undefined) {
      useAuthStore.setState({ currentUser: payload.auth.currentUser })
    }
    return true
  } catch (_) {
    return false
  }
}

export async function loadDesktopLocalBackup() {
  try {
    if (!canUseElectronIpc()) return false
    const ipcRenderer = window.require('electron').ipcRenderer
    const result = await ipcRenderer.invoke('local-backup-load')
    if (!result?.success || !result?.data) return false
    return restoreFromLocalBackupPayload(result.data)
  } catch (_) {
    return false
  }
}

let backupTimer = null
let cloudSyncTimer = null
let desktopPersistenceInitialized = false

async function flushDesktopLocalBackup() {
  try {
    if (!canUseElectronIpc()) return
    const ipcRenderer = window.require('electron').ipcRenderer
    await ipcRenderer.invoke('local-backup-save', getBackupPayload())
  } catch (_) {}
}

async function scheduleCloudSync() {
  try {
    if (cloudSyncTimer) return
    cloudSyncTimer = setTimeout(async () => {
      cloudSyncTimer = null
      const state = useAppStore.getState()
      if (!state?.cloudSettings?.enabled || !navigator.onLine) return
      const { syncToCloud } = await import('@/lib/firebase')
      await syncToCloud()
    }, 3000)
  } catch (_) {}
}

function scheduleDesktopBackup() {
  if (!canUseElectronIpc()) return
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(async () => {
    backupTimer = null
    await flushDesktopLocalBackup()
    await scheduleCloudSync()
  }, 900)
}

export function initDesktopDataPersistence() {
  if (!canUseElectronIpc() || desktopPersistenceInitialized) return () => {}
  desktopPersistenceInitialized = true

  const unsubscribers = [
    useAppStore.subscribe(scheduleDesktopBackup),
    useTableStore.subscribe(scheduleDesktopBackup),
    useProductStore.subscribe(scheduleDesktopBackup),
    useRecipeStore.subscribe(scheduleDesktopBackup),
    useSalesStore.subscribe(scheduleDesktopBackup),
    useCustomerStore.subscribe(scheduleDesktopBackup),
    useAuthStore.subscribe(scheduleDesktopBackup),
    useActivityStore.subscribe(scheduleDesktopBackup),
  ]

  const persistBeforeClose = () => {
    flushDesktopLocalBackup()
  }
  window.addEventListener('beforeunload', persistBeforeClose)

  scheduleDesktopBackup()

  return () => {
    unsubscribers.forEach((unsub) => {
      try { unsub() } catch (_) {}
    })
    window.removeEventListener('beforeunload', persistBeforeClose)
  }
}

// Boot: load users from DB into store on startup
if (typeof window !== 'undefined' && window.require) {
  setTimeout(() => useAuthStore.getState().loadUsers(), 200)
}
