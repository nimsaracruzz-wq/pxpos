import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, CheckCircle2, ChefHat, UtensilsCrossed, Search, Clock3, ListOrdered, Languages, SlidersHorizontal } from 'lucide-react'
import { useAppStore, useProductStore } from '@/store'
import { generateReceiptNumber, formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { publishQRCodeOrder, subscribeToQRCodeOrderHistory, subscribeToQRCodeOrderStatus, subscribeToStoreProducts, subscribeToTableQrSession } from '@/lib/firebase'

const I18N = {
  en: {
    table: 'Table',
    order: 'Order',
    store: 'Store',
    session: 'Session',
    guests: 'Guests',
    items: 'Items',
    menuTab: 'Menu',
    myOrdersTab: 'My Orders',
    historyTab: 'History',
    customerName: 'Your name (optional)',
    notes: 'Special notes',
    latestStatus: 'Latest order status',
    orderId: 'Order ID',
    searchLabel: 'Search dishes',
    searchPlaceholder: 'Type dish name...',
    noItems: 'No menu items available in this category.',
    yourOrder: 'Your Order',
    dueToPay: 'Due to Pay',
    grandTotal: 'Grand Total',
    paidBefore: 'Paid Before',
    totalSoFar: 'Total So Far',
    estimate: 'Estimated prep time (smart)',
    noSelected: 'No items selected yet.',
    send: 'Send Order to Kitchen',
    sending: 'Sending...',
    add: 'Add',
    customize: 'Customize',
    spice: 'Spice level',
    addons: 'Add-ons',
    itemNote: 'Item note',
    historyEmpty: 'No orders yet for this table/session.',
    addedByStaff: 'Added by Staff',
    orderPlaced: 'Order sent to kitchen in real time!',
    needsItem: 'Please add at least one item',
    missingStore: 'Missing store identifier in menu link',
    failed: 'Failed to send order. Please try again.',
    outOfStock: 'This item is out of stock',
    limitedStock: 'Only {count} left in stock',
    invalidQr: 'This QR has expired or is invalid. Ask staff for a fresh table QR.',
    lessSpicy: 'Less spicy',
    noOnions: 'No onions',
    extraSauce: 'Extra sauce',
    noSugar: 'No sugar',
    spiceMild: 'Mild',
    spiceNormal: 'Normal',
    spiceHot: 'Hot',
    spiceExtraHot: 'Extra hot',
    addOnCheese: 'Extra cheese',
    addOnSauce: 'Extra sauce',
    addOnNoOnion: 'No onion',
    addOnNoSugar: 'No sugar',
    status: {
      new: 'Placed',
      accepted: 'Accepted by kitchen',
      preparing: 'Preparing',
      ready: 'Ready for serving',
      completed: 'Completed',
      expired: 'Expired (ask staff for fresh QR)',
    },
  },
  si: {
    table: 'මේසය',
    order: 'ඇණවුම',
    store: 'අලෙවිසැල',
    session: 'සැසිය',
    guests: 'අමුත්තන්',
    items: 'අයිතම',
    menuTab: 'මෙනු',
    myOrdersTab: 'මගේ ඇණවුම්',
    historyTab: 'ඉතිහාසය',
    customerName: 'ඔබගේ නම (විකල්ප)',
    notes: 'විශේෂ සටහන්',
    latestStatus: 'අවසාන ඇණවුම් තත්ත්වය',
    orderId: 'ඇණවුම් අංකය',
    searchLabel: 'ආහාර සොයන්න',
    searchPlaceholder: 'ආහාර නම ටයිප් කරන්න...',
    noItems: 'මෙම කාණ්ඩයට අයිතම නොමැත.',
    yourOrder: 'ඔබගේ ඇණවුම',
    dueToPay: 'ගෙවීමට ඇති මුදල',
    grandTotal: 'මුළු එකතුව',
    paidBefore: 'පෙර ගෙවූ මුදල',
    totalSoFar: 'මෙතෙක් මුළු එකතුව',
    estimate: 'අනුමාන සකස් කිරීමේ කාලය (ස්මාර්ට්)',
    noSelected: 'තෝරාගත් අයිතම නොමැත.',
    send: 'කුස්සියට යවන්න',
    sending: 'යවමින්...',
    add: 'එකතු කරන්න',
    customize: 'අභිරුචි',
    spice: 'තියුණු මට්ටම',
    addons: 'අමතර',
    itemNote: 'අයිතම සටහන',
    historyEmpty: 'මෙම මේසය/සැසිය සඳහා ඇණවුම් නොමැත.',
    addedByStaff: 'සේවකයා එක් කළේ',
    orderPlaced: 'ඇණවුම realtime ලෙස කුස්සියට යවන ලදි!',
    needsItem: 'අයිතමයක් හෝ ඊට වැඩි එකතු කරන්න',
    missingStore: 'QR ලින්ක් එකේ අලෙවිසැල් ID අස්ථානගතයි',
    failed: 'යැවීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.',
    outOfStock: 'මෙම අයිතමය stock නැත',
    limitedStock: 'stock එකේ {count} පමණයි',
    invalidQr: 'මෙම QR එක කල් ඉකුත් වී ඇත හෝ වලංගු නොවේ. කරුණාකර නව table QR එකක් ලබා ගන්න.',
    lessSpicy: 'තියුණු අඩු',
    noOnions: 'ලූනු නැතිව',
    extraSauce: 'සෝස් වැඩිපුර',
    noSugar: 'සීනි නැතිව',
    spiceMild: 'හුරුබුහුටි',
    spiceNormal: 'සාමාන්ය',
    spiceHot: 'තියුණු',
    spiceExtraHot: 'ඉතා තියුණු',
    addOnCheese: 'චීස් වැඩිපුර',
    addOnSauce: 'සෝස් වැඩිපුර',
    addOnNoOnion: 'ලූනු නැතිව',
    addOnNoSugar: 'සීනි නැතිව',
    status: {
      new: 'දමන ලදි',
      accepted: 'කුස්සියෙන් පිළිගත්තා',
      preparing: 'සකස් වෙමින්',
      ready: 'පිළිගැනීමට සූදානම්',
      completed: 'සම්පූර්ණයි',
      expired: 'කල් ඉකුත් විය (නව QR එකක් ලබා ගන්න)',
    },
  },
}

function defaultCustomization() {
  return { spice: 'normal', addons: [], note: '' }
}

export default function PublicMenu() {
  const { storeId } = useParams()
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const fallbackStoreId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    try {
      const decodedHref = decodeURIComponent(window.location.href || '')
      const match = decodedHref.match(/\/menu\/([^/?#&]+)/i)
      return String(match?.[1] || '').trim()
    } catch (_) {
      return ''
    }
  }, [])
  const resolvedStoreId = String(storeId || fallbackStoreId || '').trim()
  const decodedStoreId = useMemo(() => decodeURIComponent(resolvedStoreId).trim(), [resolvedStoreId])
  const tableNo = String(searchParams.get('table') || '').trim()
  const guests = Number(searchParams.get('guests') || 0) || 0
  const rawSession = String(searchParams.get('session') || '').trim()
  const qrToken = String(searchParams.get('token') || '').trim()
  const effectiveSession = rawSession && rawSession !== 'static' ? rawSession : `table-${tableNo || 'na'}`

  const { products } = useProductStore()
  const { taxSettings, serviceChargeSettings, businessInfo, receiptSettings } = useAppStore()
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [lastOrder, setLastOrder] = useState(null)
  const [orderHistory, setOrderHistory] = useState([])
  const [activeTab, setActiveTab] = useState('menu')
  const [lang, setLang] = useState(searchParams.get('lang') === 'si' ? 'si' : 'en')
  const [expandedItemId, setExpandedItemId] = useState('')
  const [customizations, setCustomizations] = useState({})
  const [sessionState, setSessionState] = useState('loading')
  const [cloudProducts, setCloudProducts] = useState([])
  const [cloudProductsLoaded, setCloudProductsLoaded] = useState(false)

  const t = I18N[lang]
  const quickNotes = [t.lessSpicy, t.noOnions, t.extraSauce, t.noSugar]
  const invalidQr = !decodedStoreId || !tableNo || !qrToken || sessionState === 'invalid'

  const spiceOptions = useMemo(
    () => [
      { id: 'mild', label: t.spiceMild },
      { id: 'normal', label: t.spiceNormal },
      { id: 'hot', label: t.spiceHot },
      { id: 'extra_hot', label: t.spiceExtraHot },
    ],
    [t]
  )

  const addonOptions = useMemo(
    () => [t.addOnCheese, t.addOnSauce, t.addOnNoOnion, t.addOnNoSugar],
    [t]
  )

  useEffect(() => {
    if (!decodedStoreId) {
      setCloudProducts([])
      setCloudProductsLoaded(false)
      return () => {}
    }

    const mergeAndSet = (items = []) => {
      const merged = new Map()
      ;(Array.isArray(items) ? items : []).forEach((item) => {
        if (!item?.id) return
        merged.set(String(item.id), item)
      })

      setCloudProducts(Array.from(merged.values()))
      setCloudProductsLoaded(true)
    }

    const unsubscribe = subscribeToStoreProducts(decodedStoreId, (items) => {
      mergeAndSet(items)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [decodedStoreId])

  // Use local products if available (means we are previewing on the POS itself). 
  // If empty (means we are on a customer's phone), fallback to cloud-synced items.
  const productSource = products.length > 0 ? products : cloudProducts
  const menuItems = useMemo(() => {
    const restaurantCategories = new Set(['mains', 'pizzas', 'starters', 'drinks', 'desserts', 'kottu'])

    // Step 1: Only active products. If it's a cloud product, filter by storeId too.
    const scopedActiveProducts = productSource.filter((p) => {
      if (!p?.active) return false
      // Only apply storeId restriction to cloud products, local ones belong here natively.
      if (productSource === cloudProducts && decodedStoreId) {
        return String(p.storeId || '').trim() === decodedStoreId
      }
      return true
    })

    // Step 2: Prefer restaurant-module items. Fall back to ALL scoped active items
    // only if no restaurant items exist (i.e. store hasn't set module yet).
    const restaurantProducts = scopedActiveProducts.filter((p) => {
      const moduleValue = String(p.module || '').trim().toLowerCase()
      if (moduleValue === 'restaurant' || moduleValue === 'resturant') return true
      // Backward compat: dishes imported before module field existed.
      if (!moduleValue) {
        const categoryValue = String(p.category || '').trim().toLowerCase()
        return restaurantCategories.has(categoryValue)
      }
      return false
    })

    return restaurantProducts.length > 0 ? restaurantProducts : scopedActiveProducts
  }, [decodedStoreId, productSource, cloudProductsLoaded, cloudProducts])
  const categories = useMemo(() => ['All', ...new Set(menuItems.map((item) => item.category).filter(Boolean))], [menuItems])

  const filteredItems = useMemo(() => {
    const byCategory = activeCategory === 'All' ? menuItems : menuItems.filter((item) => item.category === activeCategory)
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return byCategory
    return byCategory.filter((item) => String(item.name || '').toLowerCase().includes(keyword))
  }, [activeCategory, menuItems, searchTerm])

  useEffect(() => {
    if (!lastOrder?.id || !decodedStoreId) return
    const unsubscribe = subscribeToQRCodeOrderStatus(decodedStoreId, lastOrder.id, (data) => {
      setLastOrder((prev) => ({ ...(prev || {}), ...data }))
    })
    return () => unsubscribe()
  }, [lastOrder?.id, decodedStoreId])

  useEffect(() => {
    if (!decodedStoreId) return () => {}
    const unsubscribe = subscribeToQRCodeOrderHistory(
      decodedStoreId,
      { session: effectiveSession, tableNumber: tableNo },
      (history) => setOrderHistory(history)
    )
    return () => unsubscribe()
  }, [decodedStoreId, effectiveSession, tableNo])

  useEffect(() => {
    if (!decodedStoreId || !tableNo || !qrToken) {
      setSessionState('invalid')
      return () => {}
    }

    setSessionState('loading')
    const unsubscribe = subscribeToTableQrSession(decodedStoreId, tableNo, (session) => {
      if (!session) {
        setSessionState('invalid')
        return
      }

      const isMoved = String(session.status || '') === 'moved'
      const movedToTable = String(session.movedToTable || '').trim()
      if (
        isMoved &&
        movedToTable &&
        movedToTable !== tableNo &&
        String(session.session || '') === effectiveSession &&
        String(session.token || '') === qrToken
      ) {
        setSessionState('loading')
        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.set('table', movedToTable)
        window.location.replace(nextUrl.toString())
        return
      }

      // Allow continuous orders: only validate token, not table status
      const matches =
        String(session.token || '') === qrToken

      setSessionState(matches ? 'valid' : 'invalid')
    })

    return () => unsubscribe()
  }, [decodedStoreId, tableNo, effectiveSession, qrToken])

  const getCustomization = (itemId) => customizations[itemId] || defaultCustomization()

  const setCustomization = (itemId, patch) => {
    setCustomizations((prev) => ({
      ...prev,
      [itemId]: { ...getCustomization(itemId), ...patch },
    }))
  }

  const toggleAddon = (itemId, addon) => {
    const current = getCustomization(itemId)
    const exists = current.addons.includes(addon)
    setCustomization(itemId, {
      addons: exists ? current.addons.filter((a) => a !== addon) : [...current.addons, addon],
    })
  }

  const addItem = (item) => {
    const config = getCustomization(item.id)
    setCart((prev) => {
      const ex = prev.find((i) => i.id === item.id)
      const availableStock = Number(item?.stock || 0)
      const currentQty = Number(ex?.qty || 0)

      if (availableStock <= currentQty) {
        toast.error(
          availableStock <= 0
            ? t.outOfStock
            : t.limitedStock.replace('{count}', String(availableStock))
        )
        return prev
      }

      if (ex) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, qty: i.qty + 1, customization: config }
            : i
        )
      }
      return [...prev, { ...item, qty: 1, customization: config }]
    })
  }

  const getItemQty = (id) => cart.find((item) => item.id === id)?.qty || 0

  const changeQty = (id, delta) => {
    if (delta > 0) {
      const item = menuItems.find((p) => p.id === id)
      const availableStock = Number(item?.stock || 0)
      const currentQty = Number(cart.find((i) => i.id === id)?.qty || 0)
      if (availableStock <= currentQty) {
        toast.error(
          availableStock <= 0
            ? t.outOfStock
            : t.limitedStock.replace('{count}', String(availableStock))
        )
        return
      }
    }

    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    )
  }

  const intelligentEta = useMemo(() => {
    const baseByCategory = {
      Mains: 12,
      Pizzas: 18,
      Starters: 8,
      Drinks: 4,
      Desserts: 6,
    }
    const cartBase = cart.reduce((sum, item) => {
      const base = baseByCategory[item.category] || 10
      return sum + base + Math.max(0, item.qty - 1) * Math.round(base * 0.55)
    }, 0)

    const queueLoad = orderHistory.filter((o) => ['new', 'accepted', 'preparing'].includes(o.status)).length
    const nowHour = new Date().getHours()
    const peakFactor = (nowHour >= 11 && nowHour <= 14) || (nowHour >= 18 && nowHour <= 21) ? 1.2 : 1
    const queueFactor = 1 + Math.min(queueLoad * 0.08, 0.45)
    const customFactor = 1 + Math.min(cart.filter((i) => i.customization?.addons?.length || i.customization?.note).length * 0.04, 0.2)

    const finalEta = Math.round(Math.max(8, (cartBase || 8) * peakFactor * queueFactor * customFactor))
    return finalEta
  }, [cart, orderHistory])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const taxRate = taxSettings.enabled ? taxSettings.rate : 0
  const tax = (subtotal * taxRate) / 100
  const serviceRate = serviceChargeSettings?.enabled ? serviceChargeSettings.rate : 0
  const serviceCharge = (subtotal * serviceRate) / 100
  const grandTotal = subtotal + tax + serviceCharge
  const outstandingHistoryTotal = useMemo(
    () =>
      orderHistory
        .filter((order) => !['completed', 'expired'].includes(String(order.status || '')))
        .reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orderHistory]
  )
  const paidBeforeTotal = useMemo(
    () =>
      orderHistory
        .filter((order) => String(order.status || '') === 'completed')
        .reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orderHistory]
  )
  const dueToPayTotal = outstandingHistoryTotal + grandTotal
  const totalSoFar = paidBeforeTotal + dueToPayTotal

  const submitOrder = async () => {
    if (!cart.length) {
      toast.error(t.needsItem)
      return
    }
    if (!decodedStoreId) {
      toast.error(t.missingStore)
      return
    }
    if (!qrToken) {
      toast.error(t.invalidQr)
      return
    }

    const invalidStockItem = cart.find((cartItem) => {
      const product = menuItems.find((m) => m.id === cartItem.id)
      return !product || Number(cartItem.qty || 0) > Number(product.stock || 0)
    })
    if (invalidStockItem) {
      const product = menuItems.find((m) => m.id === invalidStockItem.id)
      const stock = Number(product?.stock || 0)
      toast.error(
        stock <= 0
          ? `${invalidStockItem.name}: ${t.outOfStock}`
          : `${invalidStockItem.name}: ${t.limitedStock.replace('{count}', String(stock))}`
      )
      return
    }

    setSubmitting(true)

    const normalizedNotes = (notes || '').trim()
    const publishResult = await publishQRCodeOrder({
      storeId: decodedStoreId,
      tableNumber: tableNo,
      session: effectiveSession,
      token: qrToken,
      guests,
      customerName: customerName || 'Guest',
      notes: normalizedNotes,
      etaMinutes: intelligentEta,
      items: cart.map((i) => ({
        id: i.id,
        name: i.name,
        price: Number(i.price || 0),
        salePrice: Number(i.price || 0),
        qty: Number(i.qty || 0),
        category: i.category || '',
        customization: i.customization || defaultCustomization(),
      })),
      subtotal,
      tax,
      serviceCharge,
      total: grandTotal,
      tempRef: generateReceiptNumber(),
    })

    if (!publishResult.success) {
      setSubmitting(false)
      toast.error(publishResult.error || t.failed)
      return
    }

    setCart([])
    setCustomerName('')
    setNotes('')
    setSubmitting(false)
    setLastOrder({ id: publishResult.id, status: 'new', createdAtMs: Date.now(), total: grandTotal })
    setActiveTab('history')
    toast.success(t.orderPlaced)
  }

  const quickNote = (text) => {
    setNotes((prev) => {
      const current = String(prev || '').trim()
      if (!current) return text
      if (current.includes(text)) return current
      return `${current}, ${text}`
    })
  }

  const toggleQuickNote = (text) => {
    const current = String(notes || '').trim()
    if (!current) {
      setNotes(text)
      return
    }

    const parts = current
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    if (parts.includes(text)) {
      const next = parts.filter((p) => p !== text).join(', ')
      setNotes(next)
      return
    }

    quickNote(text)
  }

  const isQuickNoteActive = (text) => String(notes || '').split(',').map((p) => p.trim()).includes(text)
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const activeOrders = orderHistory.filter((order) => !['completed', 'expired'].includes(String(order.status || '')))

  const statusLabel = t.status[lastOrder?.status] || t.status.new
  const statusBadgeClass = (status) => {
    if (status === 'ready') return 'bg-green-100 text-green-700'
    if (status === 'preparing') return 'bg-amber-100 text-amber-700'
    if (status === 'completed') return 'bg-blue-100 text-blue-700'
    if (status === 'accepted') return 'bg-teal-100 text-teal-700'
    if (status === 'expired') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-700'
  }

  if (invalidQr) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40 px-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <UtensilsCrossed size={24} />
          </div>
          <h1 className="text-xl font-black text-gray-900">{t.invalidQr}</h1>
          <p className="mt-2 text-sm text-gray-500">
            No ordering is available from this link. Please scan the new QR code from the table.
          </p>
        </div>
      </div>
    )
  }

  if (sessionState === 'loading') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40 px-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Clock3 size={24} />
          </div>
          <h1 className="text-xl font-black text-gray-900">Checking QR session...</h1>
          <p className="mt-2 text-sm text-gray-500">
            Verifying that this table link is still active.
          </p>
        </div>
      </div>
    )
  }

  // Loading POS menu from the cloud (only show if local products are also empty)
  if (!cloudProductsLoaded && products.length === 0) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40 px-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-pulse">
            <ChefHat size={24} />
          </div>
          <h1 className="text-xl font-black text-gray-900">Loading menu...</h1>
          <p className="mt-2 text-sm text-gray-500">
            Fetching the latest menu from the kitchen.
          </p>
        </div>
      </div>
    )
  }

  // Cloud loaded but this store has no active POS-registered items
  // Cloud/Local loaded but this store has no active POS-registered items
  if (menuItems.length === 0 && (cloudProductsLoaded || products.length > 0)) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40 px-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <UtensilsCrossed size={24} />
          </div>
          <h1 className="text-xl font-black text-gray-900">Menu not available</h1>
          <p className="mt-2 text-sm text-gray-500">
            No items have been added to the menu yet. Please ask your server for assistance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#f7f8f6]" style={{ WebkitOverflowScrolling: 'touch', fontFamily: 'DM Sans, Inter, system-ui, sans-serif' }}>
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f7f8f6]">
        <div className="relative overflow-hidden bg-[#1a7a4a] px-5 pt-5 pb-7">
          <div className="pointer-events-none absolute -bottom-7 -left-5 -right-5 h-14 rounded-[50%] bg-[#f7f8f6]" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/15 text-lg text-white overflow-hidden">
                {receiptSettings?.logoUrl ? (
                  <img
                    src={receiptSettings.logoUrl}
                    alt={businessInfo?.name || 'Business logo'}
                    className="h-full w-full object-contain bg-white/10 p-1"
                  />
                ) : (
                  <UtensilsCrossed size={18} />
                )}
              </div>
              <div>
                <h1 className="text-[22px] font-bold tracking-[-0.2px] text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  {businessInfo?.name || t.store}
                </h1>
                <p className="text-[11px] uppercase tracking-[0.5px] text-white/70">
                  {t.table} {tableNo || t.order} · {t.guests}: {guests || '-'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'en' ? 'si' : 'en'))}
              className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-medium text-white"
            >
              <Languages size={12} /> {lang === 'en' ? 'සිංහල' : 'English'}
            </button>
          </div>
          <div className="relative z-10 mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${activeTab === 'menu' ? 'bg-white text-[#1a7a4a]' : 'bg-white/15 text-white'}`}
            >
              {t.menuTab}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${activeTab === 'current' ? 'bg-white text-[#1a7a4a]' : 'bg-white/15 text-white'}`}
            >
              {t.myOrdersTab}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${activeTab === 'history' ? 'bg-white text-[#1a7a4a]' : 'bg-white/15 text-white'}`}
            >
              {t.historyTab}
            </button>
          </div>
        </div>

        {activeTab === 'menu' && (
          <div className="px-4 pb-6 pt-5">
            <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.7px] text-gray-500">Your Details</label>
              <input
                className="mb-2 w-full rounded-xl border border-gray-200 bg-[#f7f8f6] px-3.5 py-2.5 text-sm outline-none focus:border-[#2d9c63]"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t.customerName}
              />
              <input
                className="mb-3 w-full rounded-xl border border-gray-200 bg-[#f7f8f6] px-3.5 py-2.5 text-sm outline-none focus:border-[#2d9c63]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notes}
              />
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.7px] text-gray-500">Quick preferences</p>
              <div className="flex flex-wrap gap-2">
                {quickNotes.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleQuickNote(chip)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${isQuickNoteActive(chip) ? 'border-[#1a7a4a] bg-[#e8f5ee] text-[#1a7a4a]' : 'border-gray-200 bg-white text-gray-500'}`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {lastOrder?.id && (
              <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-gray-500">{t.latestStatus}</p>
                    <p className="text-sm font-bold text-emerald-700">{statusLabel}</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-700">#{lastOrder.id.slice(0, 8)}</p>
                </div>
              </div>
            )}

            <div className="relative mb-3">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none shadow-sm focus:border-[#2d9c63]"
              />
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium ${activeCategory === category ? 'border-[#1a7a4a] bg-[#1a7a4a] text-white' : 'border-gray-200 bg-white text-gray-500'}`}
                >
                  {category}
                </button>
              ))}
            </div>

            <p className="mb-3 px-0.5 text-[11px] font-bold uppercase tracking-[0.9px] text-gray-500">
              {activeCategory === 'All' ? 'All Items' : activeCategory} · {filteredItems.length}
            </p>

            <div className="space-y-3">
              {filteredItems.map((item) => {
                const qty = getItemQty(item.id)
                const stock = Number(item.stock || 0)
                const outOfStock = stock <= 0
                const config = getCustomization(item.id)
                const expanded = expandedItemId === item.id
                const emoji = String(item.emoji || '🍽')
                const desc = String(item.description || item.desc || item.category || 'Chef special item')

                return (
                  <div key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="flex items-stretch">
                      <div className="relative flex w-24 shrink-0 items-center justify-center bg-[#e8f0eb] text-3xl">
                        {emoji}
                        {Boolean(item.popular) && (
                          <span className="absolute left-[-22px] top-2 rotate-[-45deg] bg-amber-500 px-5 py-0.5 text-[9px] font-bold uppercase tracking-[0.4px] text-white">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <span className="mb-2 inline-block w-fit rounded-full bg-[#f7f8f6] px-2 py-0.5 text-[10px] text-gray-500">{item.category || 'General'}</span>
                        <p className="text-[15px] font-semibold text-gray-900">{item.name}</p>
                        <p className="mb-2 text-[11.5px] leading-[1.45] text-gray-500">{desc}</p>
                        <p className={`mb-2 text-[11px] font-semibold ${outOfStock ? 'text-red-600' : 'text-gray-500'}`}>
                          {outOfStock ? t.outOfStock : `Stock: ${stock}`}
                        </p>

                        <button
                          type="button"
                          onClick={() => setExpandedItemId(expanded ? '' : item.id)}
                          className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"
                        >
                          <SlidersHorizontal size={12} /> {t.customize}
                        </button>

                        {expanded && (
                          <div className="mb-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-2">
                            <p className="mb-1 text-[11px] font-semibold text-gray-600">{t.spice}</p>
                            <div className="mb-2 flex flex-wrap gap-1">
                              {spiceOptions.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setCustomization(item.id, { spice: option.id })}
                                  className={`rounded-full border px-2 py-1 text-[10px] ${config.spice === option.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                            <p className="mb-1 text-[11px] font-semibold text-gray-600">{t.addons}</p>
                            <div className="mb-2 flex flex-wrap gap-1">
                              {addonOptions.map((addon) => (
                                <button
                                  key={addon}
                                  type="button"
                                  onClick={() => toggleAddon(item.id, addon)}
                                  className={`rounded-full border px-2 py-1 text-[10px] ${config.addons.includes(addon) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                                >
                                  {addon}
                                </button>
                              ))}
                            </div>
                            <input
                              value={config.note}
                              onChange={(e) => setCustomization(item.id, { note: e.target.value })}
                              placeholder={t.itemNote}
                              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-[#2d9c63]"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-[18px] font-bold text-[#1a7a4a]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                            {formatCurrency(item.price)}
                          </p>
                          {qty === 0 ? (
                            <button
                              onClick={() => addItem(item)}
                              disabled={outOfStock}
                              className="rounded-full bg-[#1a7a4a] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              + {t.add}
                            </button>
                          ) : (
                            <div className="flex items-center overflow-hidden rounded-full bg-[#e8f5ee]">
                              <button type="button" onClick={() => changeQty(item.id, -1)} className="flex h-8 w-8 items-center justify-center text-[#1a7a4a]">
                                <Minus size={14} />
                              </button>
                              <span className="min-w-6 text-center text-sm font-bold text-[#1a7a4a]">{qty}</span>
                              <button
                                type="button"
                                onClick={() => addItem(item)}
                                disabled={qty >= stock}
                                className="flex h-8 w-8 items-center justify-center text-[#1a7a4a] disabled:cursor-not-allowed disabled:text-gray-300"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredItems.length === 0 && (
              <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-6 text-center">
                <ChefHat size={20} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">{t.noItems}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'current' && (
          <div className="space-y-3 px-4 py-4">
            {activeOrders.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">{t.noSelected}</div>
            )}
            {activeOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-800">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500">{new Date(Number(order.createdAtMs || Date.now())).toLocaleString()}</p>
                    {String(order.source || '') === 'pos' && (
                      <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {t.addedByStaff}
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusBadgeClass(order.status)}`}>
                    {t.status[order.status] || t.status.new}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{(order.items || []).map((item) => `${item.qty}x ${item.name}`).join(' • ')}</p>
                <p className="mt-2 text-sm font-black text-emerald-700">{formatCurrency(Number(order.total || 0))}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3 px-4 py-4">
            {orderHistory.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">{t.historyEmpty}</div>
            )}
            {orderHistory.map((order) => (
              <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-800">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500">{new Date(Number(order.createdAtMs || Date.now())).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{t.guests}: {order.guests || guests || '-'}</p>
                    {String(order.source || '') === 'pos' && (
                      <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {t.addedByStaff}
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusBadgeClass(order.status)}`}>
                    {t.status[order.status] || t.status.new}
                  </span>
                </div>
                <div className="mb-2 text-xs text-gray-600">
                  {(order.items || []).map((item) => `${item.qty}x ${item.name}`).join(' • ')}
                </div>
                {!!String(order.notes || '').trim() && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">{order.notes}</p>
                )}
                <p className="mt-2 text-sm font-black text-emerald-700">{formatCurrency(Number(order.total || 0))}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="sticky bottom-0 z-30 w-full border-t border-gray-200 bg-white px-4 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.1)]" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f5ee] text-[#1a7a4a]">
                  <ShoppingCart size={16} />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {cartCount}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.yourOrder}</p>
                  <p className="text-[11px] text-gray-500">{cartCount === 0 ? t.noSelected : `${cartCount} ${t.items}`}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-500">{t.dueToPay}</p>
                <p className="text-xl font-bold text-[#1a7a4a]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                  {formatCurrency(dueToPayTotal)}
                </p>
              </div>
            </div>

            {cartCount > 0 && (
              <div className="mb-2 flex gap-1.5 overflow-x-auto">
                {cart.map((item) => (
                  <div key={item.id} className="shrink-0 rounded-lg bg-[#e8f5ee] px-2.5 py-1 text-[11px] font-medium text-[#1a7a4a]">
                    {String(item.emoji || '🍽')} {String(item.name || '').split(' ').slice(0, 2).join(' ')} <span className="rounded bg-[#1a7a4a] px-1.5 py-0.5 text-[10px] text-white">x{item.qty}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-2 text-[11px] text-gray-600">
              <div className="flex items-center justify-between"><span>{t.grandTotal}</span><span className="font-semibold text-gray-800">{formatCurrency(grandTotal)}</span></div>
              {paidBeforeTotal > 0 && (
                <div className="mt-1 flex items-center justify-between"><span>{t.paidBefore}</span><span className="font-semibold text-emerald-700">{formatCurrency(paidBeforeTotal)}</span></div>
              )}
              <div className="mt-1 flex items-center justify-between border-t border-emerald-200 pt-1"><span>{t.totalSoFar}</span><span className="font-bold text-gray-800">{formatCurrency(totalSoFar)}</span></div>
            </div>

            <button
              onClick={submitOrder}
              disabled={submitting || !cart.length || invalidQr}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1a7a4a] px-4 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c5d9cf]"
            >
              <CheckCircle2 size={15} /> {submitting ? t.sending : t.send}
            </button>
            <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Clock3 size={12} /> {t.estimate}: ~{intelligentEta} min
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
