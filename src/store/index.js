import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { get, set, del } from 'idb-keyval'

// ─── Real Database Implementation (IndexedDB) ──────────────────────────────────
export const idbStorage = {
  getItem: async (name) => {
    const value = await get(name)
    return value || null
  },
  setItem: async (name, value) => {
    await set(name, value)
  },
  removeItem: async (name) => {
    await del(name)
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
        name: 'Paxxmo Store',
        address: '123 Main Street, Colombo',
        phone: '+94 11 234 5678',
        email: 'store@paxxmo.com',
        taxId: 'TAX-001',
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
        footer: 'Powered by Paxxmo POS',
        showBarcode: true,
        showTax: true,
        autoPrint: false,
        showCashier: true,
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
        firebaseConfig: '',
        syncInterval: 10,
      },

      setActiveModule: (mod) => set({ activeModule: mod }),
      toggleModule: (mod) =>
        set((s) => ({ modules: { ...s.modules, [mod]: !s.modules[mod] } })),
      updateBusinessInfo: (info) =>
        set((s) => ({ businessInfo: { ...s.businessInfo, ...info } })),
      updateTaxSettings: (t) =>
        set((s) => ({ taxSettings: { ...s.taxSettings, ...t } })),
      updateServiceChargeSettings: (sc) =>
        set((s) => ({ serviceChargeSettings: { ...s.serviceChargeSettings, ...sc } })),
      updateReceiptSettings: (r) =>
        set((s) => ({ receiptSettings: { ...s.receiptSettings, ...r } })),
      updateHardwareSettings: (h) =>
        set((s) => ({ hardwareSettings: { ...s.hardwareSettings, ...h } })),
      activateLicense: (key) => set({ licenseKey: key, licenseActive: true }),
      updateCloudSettings: (c) =>
        set((s) => ({ cloudSettings: { ...s.cloudSettings, ...c } })),
    }),
    { 
      name: 'paxxmo-app',
      storage: createJSONStorage(() => idbStorage) 
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

export const useProductStore = create(
  persist(
    (set, get) => ({
      products: SAMPLE_PRODUCTS,
      categories: ['Grains', 'Oils', 'Groceries', 'Dairy', 'Beverages', 'Personal Care', 'Pharmacy', 'Condiments'],

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
        const newProduct = { ...product, id: product.id || uuidv4() };
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('add-product', newProduct);
        }
        set((s) => ({
          products: [...s.products, newProduct],
        }));
      },
      updateProduct: (id, updates) => {
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('update-product', id, updates);
        }
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
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
        if (typeof window !== 'undefined' && window.require) {
          window.require('electron').ipcRenderer.invoke('update-product', id, { stock: newStock });
        }
        set((s) => ({
          products: s.products.map((prd) =>
            prd.id === id ? { ...prd, stock: newStock } : prd
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
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ categories: state.categories })
    }
  )
)

if (typeof window !== 'undefined' && window.require) {
  setTimeout(() => {
    useProductStore.getState().loadProducts();
  }, 100);
}

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
      sales: generateSampleSales(),

      addSale: (sale) =>
        set((s) => ({ sales: [{ ...sale, id: uuidv4(), date: new Date() }, ...s.sales] })),
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
      storage: createJSONStorage(() => idbStorage)
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
      customers: SAMPLE_CUSTOMERS,
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
  owner:   { business: true, tax: true, modules: true, receipt: true, hardware: true, cloud: true, users: true, license: true },
  manager: { business: true, tax: false, modules: false, receipt: true, hardware: false, cloud: false, users: false, license: false },
  staff:   { business: false, tax: false, modules: false, receipt: false, hardware: false, cloud: false, users: false, license: false },
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],   // loaded from SQLite via IPC
      roles: {
        super_admin: { name: 'Super Admin',  permissions: ['all'] },
        owner:       { name: 'Owner',        permissions: ['manage_users', 'view_reports', 'manage_inventory', 'manage_settings', 'sales'] },
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
      storage: createJSONStorage(() => idbStorage),
      // Only persist the current session — users always live in the DB
      partialize: (s) => ({ currentUser: s.currentUser, roles: s.roles, adminSettingsPermissions: s.adminSettingsPermissions })
    }
  )
)

// Boot: load users from DB into store on startup
if (typeof window !== 'undefined' && window.require) {
  setTimeout(() => useAuthStore.getState().loadUsers(), 200)
}
