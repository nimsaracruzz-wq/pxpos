import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote,
  Split, Tag, Receipt, X, Keyboard, RotateCcw, Pause,
  Play, Barcode, Percent, User, Printer, Search, CheckCircle2, Zap
} from 'lucide-react'
import { usePOSStore, useProductStore, useAppStore, useSalesStore, useAuthStore, useActivityStore, useRecipeStore } from '@/store'
import { useToast } from '@/components/Toast'
import { formatCurrency, generateReceiptNumber } from '@/lib/utils'
import { Badge, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import ReceiptModal from '@/components/Receipt'
import CustomerDisplay from '@/components/CustomerDisplay'
import { useI18n } from '@/lib/i18n'
import { v4 as uuidv4 } from 'uuid'
import { generateHelaQRPayment, getHelaQRConfigStatus } from '@/lib/helaqr'
import { clearCustomerDisplay, publishCustomerDisplay } from '@/lib/customerDisplayChannel'

const ALL_CATEGORIES = ['All', 'Grains', 'Oils', 'Groceries', 'Dairy', 'Beverages', 'Personal Care', 'Pharmacy', 'Condiments']

// ─── Category emoji map ──────────────────────────────────────────────────────
const CAT_EMOJI = {
  Grains: '🌾', Oils: '🫙', Groceries: '🧺', Dairy: '🥛',
  Beverages: '☕', 'Personal Care': '🧴', Pharmacy: '💊', Condiments: '🧂',
}

const playTone = (type = 'tick') => {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  try {
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    if (type === 'success') {
      osc.frequency.setValueAtTime(620, now)
      osc.frequency.exponentialRampToValueAtTime(940, now + 0.18)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26)
    } else {
      osc.frequency.setValueAtTime(540, now)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    }

    osc.type = 'sine'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + (type === 'success' ? 0.28 : 0.14))
    osc.onended = () => ctx.close()
  } catch {
    // best-effort feedback only
  }
}

// ─── Payment Modal ───────────────────────────────────────────────────────────
const PaymentModal = ({ open, onClose, total, onCheckout, onComplete }) => {
  const [method, setMethod] = useState('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [processing, setProcessing] = useState(false)
  const cashNum = parseFloat(cashGiven) || 0
  const change = method === 'cash' ? Math.max(0, cashNum - total) : 0
  const canPay = method !== 'cash' || cashNum >= total

  const roundedTotal = Math.ceil(total / 100) * 100
  const quickAmounts = [...new Set([roundedTotal, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])]
    .filter((v) => v >= total)
    .slice(0, 4)

  const handlePay = () => {
    if (!canPay) return
    if (typeof onCheckout === 'function') {
      onCheckout(method)
    }
    setProcessing(true)
    setTimeout(() => {
      onComplete(method, cashNum, change)
      setProcessing(false)
      setCashGiven('')
      setMethod('cash')
    }, 500)
  }

  useEffect(() => {
    if (!open) { setCashGiven(''); setMethod('cash') }
  }, [open])

  const methodButtons = [
    { id: 'cash',  label: 'Cash',  icon: Banknote,  color: { active: '#16a34a', bg: '#f0fdf4', border: '#86efac', light: '#dcfce7' } },
    { id: 'card',  label: 'Card',  icon: CreditCard, color: { active: '#2563eb', bg: '#eff6ff', border: '#93c5fd', light: '#dbeafe' } },
    { id: 'split', label: 'Split', icon: Split,       color: { active: '#7c3aed', bg: '#faf5ff', border: '#c4b5fd', light: '#ede9fe' } },
    { id: 'helaqr', label: 'HelaQR', icon: Zap,       color: { active: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', light: '#fef3c7' } },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Process Payment" maxWidth="max-w-md">
      {/* Amount Due hero */}
      <div className="mb-5 p-5 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0' }}>
        <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-1">Amount Due</p>
        <p className="text-5xl font-black text-green-700 leading-tight mt-1">{formatCurrency(total)}</p>
      </div>

      {/* Method tabs */}
      <div className="flex gap-2 mb-5">
        {methodButtons.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setMethod(id)}
            className="flex-1 flex flex-col items-center gap-2 py-3.5 rounded-2xl border-2 transition-all text-sm font-semibold"
            style={method === id
              ? { borderColor: color.active, background: color.light, color: color.active, boxShadow: `0 4px 14px ${color.active}22` }
              : { borderColor: '#e5e7eb', background: 'white', color: '#9ca3af' }
            }
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      {method === 'cash' && (
        <div className="mb-5 animate-slide-up">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cash Received</label>
          <input
            autoFocus
            type="number"
            value={cashGiven}
            onChange={(e) => setCashGiven(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canPay && handlePay()}
            placeholder={total.toFixed(2)}
            className="input-base mt-2 font-bold"
            style={{ height: 60, fontSize: 26 }}
          />
          <div className="flex gap-2 mt-3 flex-wrap">
            {quickAmounts.map((v) => (
              <button
                key={v}
                onClick={() => setCashGiven(String(v))}
                className="flex-1 text-sm px-3 py-2.5 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-bold hover:bg-green-100 hover:border-green-400 transition-all active:scale-95 min-h-[44px]"
              >
                Rs. {v.toLocaleString()}
              </button>
            ))}
          </div>
          {cashNum >= total && cashNum > 0 && (
            <div className="mt-4 p-4 rounded-2xl flex items-center justify-between animate-pop-in" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">💵</span>
                <span className="text-sm font-semibold text-blue-700">Change to Return</span>
              </div>
              <span className="text-2xl font-black text-blue-700">{formatCurrency(change)}</span>
            </div>
          )}
        </div>
      )}

      {method === 'card' && (
        <div className="mb-5 p-6 rounded-2xl bg-blue-50 text-center border border-blue-100 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <CreditCard size={28} className="text-blue-500" />
          </div>
          <p className="text-sm font-semibold text-blue-700">Tap or swipe the card to complete</p>
          <p className="text-xs text-blue-500 mt-1">Supported: Visa, Mastercard, Amex</p>
        </div>
      )}

      {method === 'split' && (
        <div className="mb-5 p-6 rounded-2xl bg-purple-50 text-center border border-purple-100 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-3">
            <Split size={28} className="text-purple-500" />
          </div>
          <p className="text-sm font-semibold text-purple-700">Split payment between cash and card</p>
          <p className="text-xs text-purple-500 mt-1">Ask customer for split amounts</p>
        </div>
      )}

      {method === 'helaqr' && (
        <div className="mb-5 p-6 rounded-2xl bg-amber-50 text-center border border-amber-100 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <Zap size={28} className="text-amber-500" />
          </div>
          <p className="text-sm font-semibold text-amber-700">HelaQR payment pending</p>
          <p className="text-xs text-amber-600 mt-1">Payment will be confirmed by server callback.</p>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!canPay || processing}
        className="btn-primary w-full justify-center text-base"
        style={{
          borderRadius: 16,
          height: 56,
          fontSize: 16,
          opacity: !canPay && method === 'cash' ? 0.45 : 1,
          background: processing ? '#9ca3af' : 'linear-gradient(135deg,#16a34a,#22c55e)',
        }}
      >
        {processing
          ? <><span className="animate-spin inline-block mr-2">⏳</span> Processing...</>
          : <><CheckCircle2 size={20} /> Confirm {method === 'cash' ? 'Cash ' : method === 'card' ? 'Card ' : method === 'helaqr' ? 'HelaQR ' : 'Split '}Payment</>
        }
      </button>
    </Modal>
  )
}


// ─── Product Card Skeleton ───────────────────────────────────────────────────
const ProductSkeleton = () => (
  <div className="rounded-2xl border border-gray-100 p-4 flex flex-col gap-3" style={{ minHeight: 130, background: 'white' }}>
    <div className="skeleton rounded-xl" style={{ height: 52 }} />
    <div className="skeleton skeleton-text" />
    <div className="skeleton" style={{ height: 12, width: '45%' }} />
  </div>
)

// ─── Main POS Component ──────────────────────────────────────────────────────
export default function POS() {
  const [search, setSearch] = useState('')
  const [cashierBarcode, setCashierBarcode] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [showPayment, setShowPayment] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [customerDisplay, setCustomerDisplay] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCartItem, setSelectedCartItem] = useState(null)
  const searchRef = useRef(null)
  const toast = useToast()

  const { products, getByBarcode, adjustStock } = useProductStore()
  const { taxSettings } = useAppStore()
  const {
    cart, addToCart, removeFromCart, updateQty,
    clearCart, setDiscount, discount, discountType,
    getSubtotal, getDiscountAmount, getTax, getTotal,
    holdTransaction, heldTransactions, resumeTransaction,
  } = usePOSStore()
  const { addSale } = useSalesStore()
  const { activeModule } = useAppStore()
  const { currentUser, switchCashierByBarcode } = useAuthStore()
  const { t } = useI18n()

  const subtotal = getSubtotal()
  const discountAmt = getDiscountAmount()
  const taxAmt = getTax(taxSettings.rate, taxSettings.inclusive)
  const total = getTotal(taxSettings.rate, taxSettings.inclusive)

  const closeCustomerScreen = useCallback(() => {
    setCustomerDisplay(null)
    clearCustomerDisplay()
  }, [])

  const openCustomerScreen = useCallback((payload) => {
    setCustomerDisplay(payload)
    publishCustomerDisplay(payload)
  }, [])

  const previewCheckoutState = useCallback((selectedMethod) => {
    const method = String(selectedMethod || 'cash').toLowerCase()
    openCustomerScreen({
      status: 'checkout',
      amount: total,
      paymentMethod: method,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: Number(item.qty || 0),
        price: Number(item.salePrice || item.price || 0),
        lineTotal: Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
      })),
      title: 'Order Summary',
      subtitle: 'Please choose payment',
    })
  }, [cart, total, openCustomerScreen])

  const getCartQty = (id) => Number(cart.find((i) => i.id === id)?.qty || 0)

  useEffect(() => {
    searchRef.current?.focus()
    // Simulate brief load for skeleton
    const t = setTimeout(() => setIsLoading(false), 350)
    return () => clearTimeout(t)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'F2') { searchRef.current?.focus(); e.preventDefault() }
      if (e.key === 'F5') { if (cart.length > 0) setShowPayment(true); e.preventDefault() }
      if (e.key === 'Escape') { setSearch(''); setShowPayment(false); setShowReceipt(false); closeCustomerScreen() }
      if (e.key === 'Delete' && e.ctrlKey) { clearCart(); toast.warning('Cart cleared'); e.preventDefault() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cart, clearCart, closeCustomerScreen])

  const filteredProducts = products.filter((p) => {
    if (!p.active) return false
    const matchM = !p.module || p.module === activeModule
    const matchS = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
    const matchC = activeCategory === 'All' || p.category === activeCategory
    return matchM && matchS && matchC
  })

  const handleSearchKey = useCallback((e) => {
    if (e.key === 'Enter' && search.trim()) {
      const found = getByBarcode(search.trim())
      if (found) {
        const currentQty = getCartQty(found.id)
        const stock = Number(found.stock || 0)
        if (stock <= currentQty) {
          toast.error(`${found.name} is out of stock`)
          return
        }
        addToCart(found)
        playTone('tick')
        toast.success(`${found.name} added`, { duration: 1500 })
        setSearch('')
      } else {
        toast.error('Product not found for this barcode', { duration: 2000 })
      }
    }
  }, [search, getByBarcode, addToCart, cart])

  const handleAddToCart = (p) => {
    const currentQty = getCartQty(p.id)
    const stock = Number(p.stock || 0)
    if (stock <= currentQty) { toast.error(`${p.name} is out of stock`); return }
    addToCart(p)
    playTone('tick')
    toast.success(`${p.name} added to cart`, { duration: 1200 })
  }

  const handleIncreaseQty = (item) => {
    const stock = Number(item.stock || 0)
    if (item.qty >= stock) {
      toast.error(`${item.name} has only ${stock} in stock`)
      return
    }
    updateQty(item.id, item.qty + 1)
  }

  const handleCashierBarcodeKey = async (e) => {
    if (e.key !== 'Enter') return

    const code = String(cashierBarcode || '').trim()
    if (!code) return

    const result = await switchCashierByBarcode(code)
    if (result?.success) {
      setCashierBarcode('')
      toast.success(`Cashier switched to ${result.user?.name || result.user?.username || 'Staff'}`)
      return
    }

    toast.error(result?.error || 'Unable to switch cashier')
  }

  const handleCompleteSale = async (method, cashGiven = 0, change = 0) => {
    previewCheckoutState(method)

    const receiptNo = generateReceiptNumber()
    const isHelaQR = String(method || '').toLowerCase() === 'helaqr'
    let paymentRef = isHelaQR ? `HQR-${uuidv4().slice(0, 8).toUpperCase()}` : ''
    let qrReference = ''
    let qrData = ''

    if (isHelaQR) {
      const cfg = getHelaQRConfigStatus()
      if (!cfg.enabled || !cfg.configured) {
        toast.error('Configure HelaQR in Settings before using this method')
        return
      }

      const qrResult = await generateHelaQRPayment({ amount: total, reference: receiptNo })
      if (!qrResult?.success) {
        toast.error(qrResult?.error || 'Failed to generate HelaQR')
        return
      }

      paymentRef = String(qrResult.reference || receiptNo)
      qrReference = String(qrResult.qrReference || '')
      qrData = String(qrResult.qrData || '')
    }

    const saleData = {
      receiptNo,
      date: new Date(),
      cartItems: cart,
      items: cart.length,
      subtotal,
      discount: discountAmt,
      tax: taxAmt,
      total,
      paymentMethod: method,
      paymentProvider: isHelaQR ? 'helaqr' : method,
      paymentRef,
      qrReference,
      qrData,
      paymentStatus: isHelaQR ? 'pending' : 'paid',
      change,
      cashier: currentUser?.name || 'Unknown',
      source: activeModule === 'restaurant' ? 'takeout' : activeModule || 'grocery',
      status: isHelaQR ? 'pending' : 'completed',
    }
    addSale({ ...saleData, items: cart.length })
    useActivityStore.getState().addLog('Completed Sale', `Sale Total: ${formatCurrency(total)} (${cart.length} items)`, currentUser?.name || 'Unknown')

    if (!isHelaQR) {
      // Reduce dish stock
      cart.forEach((item) => adjustStock(item.id, -item.qty))

      // If restaurant mode, also deduct ingredients from recipe
      if (activeModule === 'restaurant') {
        const deductIngredients = useRecipeStore.getState().deductIngredients
        cart.forEach((item) => {
          const result = deductIngredients(item.id, item.qty)
          if (!result.success) {
            console.warn(`Failed to deduct ingredients for ${item.name}:`, result.message)
          }
        })
      }
    }

    setLastSale(saleData)
    setShowPayment(false)
    clearCart()
    setSelectedCartItem(null)
    setShowReceipt(!isHelaQR)
    openCustomerScreen({
      amount: total,
      qrData,
      paymentMethod: method,
      status: isHelaQR ? 'paying' : 'paid',
      cashGiven,
      change,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: Number(item.qty || 0),
        price: Number(item.salePrice || item.price || 0),
        lineTotal: Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
      })),
      reference: paymentRef,
      title: isHelaQR ? 'HelaQR Payment' : 'Customer Payment View',
      subtitle: isHelaQR
        ? 'Please scan this code and complete payment from your banking app.'
        : `Please confirm this amount for ${String(method || '').toUpperCase()} payment.`,
    })
    if (!isHelaQR) playTone('success')
    toast.success(isHelaQR ? `HelaQR created: ${paymentRef}` : `Sale complete! Rs. ${total.toFixed(2)} — ${method}`)
  }

  useEffect(() => {
    const transactional = ['checkout', 'paying', 'paid'].includes(String(customerDisplay?.status || '').toLowerCase())
    if (transactional) return

    if (cart.length > 0) {
      publishCustomerDisplay({
        status: 'active',
        amount: total,
        paymentMethod: 'cash',
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          qty: Number(item.qty || 0),
          price: Number(item.salePrice || item.price || 0),
          lineTotal: Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
        })),
        title: 'Order in Progress',
        subtitle: 'Items are being added',
      })
      return
    }

    publishCustomerDisplay({
      status: 'idle',
      amount: 0,
      paymentMethod: 'cash',
      items: [],
      title: 'Customer Display',
      subtitle: 'Ready to order',
    })
  }, [cart, total, customerDisplay?.status])

  const moduleProducts = products.filter((p) => p.active && (!p.module || p.module === activeModule))
  const categories = ['All', ...new Set(moduleProducts.map((p) => p.category))]

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#f4f7f5' }}>
      {/* ─── Left: Products ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ background: 'white', borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        >
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-0.5">
            <Barcode size={16} className="shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder={t('pos_scan')}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-gray-700 placeholder:text-gray-400 py-2"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="shrink-0 text-gray-400 hover:text-gray-600 rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-100 transition-colors"
                type="button"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
            <Keyboard size={12} />
            F2 · F5 · Ctrl+Del
          </div>
        </div>

        {/* Category pills */}
        <div
          className="px-4 py-2.5 flex gap-2 overflow-x-auto shrink-0"
          style={{ background: 'white', borderBottom: '1px solid #f0f0f0' }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[36px] active:scale-95',
                activeCategory === cat
                  ? 'bg-green-500 text-white shadow-md shadow-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              )}
            >
              {cat !== 'All' && <span>{CAT_EMOJI[cat] || '📦'}</span>}
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div
              className="grid gap-3 stagger"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}
            >
              {Array.from({ length: 12 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
                <Search size={36} className="text-gray-300" />
              </div>
              <p className="text-gray-600 font-semibold">No products found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Try a different search term or barcode' : 'No products in this category'}
              </p>
            </div>
          ) : (
            <div
              className="grid gap-3 stagger"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}
            >
              {filteredProducts.map((p) => {
                const cartQty = cart.find((i) => i.id === p.id)?.qty || 0
                return (
                  <button
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    disabled={p.stock === 0}
                    className={cn(
                      'pos-product-btn flex flex-col gap-1.5 relative overflow-hidden text-left',
                      p.stock === 0 && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {cartQty > 0 && (
                      <div
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white font-black animate-pop-in"
                        style={{ background: '#16a34a', fontSize: 11, boxShadow: '0 2px 8px rgba(22,163,74,0.4)' }}
                      >
                        {cartQty}
                      </div>
                    )}
                    <div
                      className="w-full h-14 rounded-xl flex items-center justify-center text-2xl mb-0.5 shrink-0"
                      style={{ background: cartQty > 0 ? 'linear-gradient(135deg,#dcfce7,#f0fdf4)' : '#f8fafb', border: cartQty > 0 ? '1px solid #bbf7d0' : '1px solid transparent' }}
                    >
                      {CAT_EMOJI[p.category] || '📦'}
                    </div>
                    <p className="text-xs font-semibold text-gray-800 leading-tight truncate-2">{p.name}</p>
                    <div className="flex items-center justify-between mt-auto pt-0.5">
                      <p className="text-base font-black text-green-700">{formatCurrency(p.price)}</p>
                      <span
                        className={cn(
                          'text-[11px] font-bold',
                          p.stock === 0 ? 'text-red-500' : p.stock <= 5 ? 'text-orange-500' : 'text-gray-400'
                        )}
                      >
                        {p.stock === 0 ? '⛔ Out' : p.stock <= 5 ? `⚡${p.stock}` : `${p.stock}`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Cart ─── */}
      <div
        className="flex flex-col shrink-0"
        style={{
          width: 360,
          background: 'white',
          borderLeft: '1px solid #f0f0f0',
          boxShadow: '-6px 0 24px rgba(0,0,0,0.04)',
        }}
      >
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <ShoppingBag size={16} className="text-green-600" />
            </div>
            <span className="font-bold text-gray-900 text-sm">{t('pos_current_sale')}</span>
            {cart.length > 0 && (
              <span className="badge badge-green text-xs badge-pulse">{cart.reduce((s, i) => s + i.qty, 0)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {heldTransactions.length > 0 && (
              <button
                onClick={() => { resumeTransaction(heldTransactions[0].id); toast.info('Transaction resumed') }}
                className="btn-ghost py-1.5 px-2.5 text-xs"
                title={`Resume held transaction (${heldTransactions.length})`}
              >
                <Play size={13} />
                <span>{heldTransactions.length}</span>
              </button>
            )}
            <button
              onClick={() => { holdTransaction(); toast.info('Transaction held') }}
              disabled={cart.length === 0}
              className="btn-ghost py-1.5 px-2.5 text-xs"
              title="Hold transaction"
            >
              <Pause size={13} />
            </button>
            <button
              onClick={() => { clearCart(); setSelectedCartItem(null); toast.warning('Cart cleared') }}
              disabled={cart.length === 0}
              className="btn-danger py-1.5 px-2.5 text-xs"
              title="Clear cart (Ctrl+Delete)"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-gray-100 bg-white">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Active Cashier</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <User size={13} />
            </div>
            <p className="text-xs font-semibold text-gray-700">{currentUser?.name || currentUser?.username || 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1">
            <Barcode size={14} className="text-gray-400 shrink-0" />
            <input
              value={cashierBarcode}
              onChange={(e) => setCashierBarcode(e.target.value)}
              onKeyDown={handleCashierBarcodeKey}
              placeholder="Scan cashier badge and press Enter"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-xs text-gray-700 placeholder:text-gray-400 py-1.5"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">No password required. Cashier accounts only.</p>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mb-4">
                <ShoppingBag size={36} className="text-gray-200" />
              </div>
              <p className="text-gray-500 font-semibold text-sm">Cart is empty</p>
              <p className="text-xs text-gray-300 mt-1">Click a product or scan a barcode</p>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {cart.map((item, idx) => (
                <div key={item.id}>
                  <div
                    className={cn(
                      'cart-item-row cursor-pointer',
                      selectedCartItem === item.id && 'border-green-400 bg-green-50'
                    )}
                    onClick={() => setSelectedCartItem(selectedCartItem === item.id ? null : item.id)}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: selectedCartItem === item.id ? '#dcfce7' : '#f8fafb' }}
                    >
                      {CAT_EMOJI[item.category] || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(item.salePrice)} × {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateQty(item.id, item.qty - 1) }}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-100 text-red-400 transition-all active:scale-90 border border-red-100"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-7 text-center text-sm font-black text-gray-800">{item.qty}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleIncreaseQty(item) }}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-green-100 text-green-600 transition-all active:scale-90 border border-green-100"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <p className="text-sm font-black text-green-700 w-20 text-right shrink-0">
                      {formatCurrency(item.salePrice * item.qty)}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); if (selectedCartItem === item.id) setSelectedCartItem(null) }}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-100 transition-all active:scale-90"
                      title="Remove item from cart"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {idx < cart.length - 1 && (
                    <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#f0f0f0,transparent)', margin: '0 8px' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Payment */}
        <div className="border-t border-gray-100 p-4" style={{ background: '#fafafa' }}>
          {/* Discount row */}
          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Tag size={12} className="text-orange-500" />
            </div>
            <span className="text-xs text-gray-500 flex-1 font-medium">{t('pos_discount')}</span>
            <div className="flex items-center gap-1.5">
              <select
                value={discountType}
                onChange={(e) => setDiscount(discount, e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 outline-none bg-white font-semibold text-gray-600 focus:border-green-400 cursor-pointer"
              >
                <option value="percent">%</option>
                <option value="fixed">Rs.</option>
              </select>
              <input
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0, discountType)}
                className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-green-400 bg-white font-semibold"
                placeholder="0"
                style={{ minHeight: '32px' }}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-1.5 mb-3 text-sm px-1">
            <div className="flex justify-between text-gray-500">
              <span>{t('pos_subtotal')}</span>
              <span className="font-semibold text-gray-700">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-red-500 font-semibold">
                <span>{t('pos_discount')}</span>
                <span>− {formatCurrency(discountAmt)}</span>
              </div>
            )}
            {taxSettings.enabled && (
              <div className="flex justify-between text-gray-500">
                <span>{taxSettings.name} ({taxSettings.rate}%)</span>
                <span>{formatCurrency(taxAmt)}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f0f0f0', marginBottom: 12 }} />

          {/* Total */}
          <div
            className="flex justify-between items-center px-4 py-3.5 rounded-2xl mb-3 transition-all"
            style={{ background: cart.length ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : '#f9fafb', border: cart.length ? '1px solid #bbf7d0' : '1px solid #f0f0f0' }}
          >
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total</span>
            </div>
            <span className={cn('font-black leading-none', cart.length ? 'text-green-700' : 'text-gray-300')} style={{ fontSize: 28 }}>
              {formatCurrency(total)}
            </span>
          </div>

          {/* Quick payment buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { id: 'cash',  label: t('pos_cash'),  icon: Banknote,  style: cart.length ? { borderColor: '#4ade80', background: '#f0fdf4', color: '#16a34a' } : {} },
              { id: 'card',  label: t('pos_card'),  icon: CreditCard, style: cart.length ? { borderColor: '#60a5fa', background: '#eff6ff', color: '#2563eb' } : {} },
              { id: 'split', label: t('pos_split'), icon: Split,       style: cart.length ? { borderColor: '#c084fc', background: '#faf5ff', color: '#7c3aed' } : {} },
              { id: 'helaqr', label: 'HelaQR', icon: Zap,             style: cart.length ? { borderColor: '#f59e0b', background: '#fffbeb', color: '#b45309' } : {} },
            ].map(({ id, label, icon: Icon, style }) => (
              <button
                key={id}
                onClick={() => { if (!cart.length) return; id === 'cash' ? setShowPayment(true) : handleCompleteSale(id) }}
                disabled={!cart.length}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all active:scale-95',
                  cart.length ? 'hover:opacity-90' : 'border-gray-100 text-gray-300 cursor-not-allowed'
                )}
                style={cart.length ? style : {}}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>

          {/* Main charge button */}
          <button
            onClick={() => cart.length > 0 && setShowPayment(true)}
            disabled={!cart.length}
            className="btn-primary w-full justify-center text-base"
            style={{ borderRadius: 14, height: 52, fontSize: 15, opacity: cart.length ? 1 : 0.4 }}
          >
            <Receipt size={18} />
            {t('pos_charge')} · F5
          </button>
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        onCheckout={previewCheckoutState}
        onComplete={handleCompleteSale}
      />
      {showReceipt && lastSale && (
        <ReceiptModal
          sale={lastSale}
          businessInfo={useAppStore.getState().businessInfo}
          onClose={() => setShowReceipt(false)}
        />
      )}
      <CustomerDisplay
        open={Boolean(customerDisplay)}
        amount={customerDisplay?.amount}
        qrData={customerDisplay?.qrData}
        paymentMethod={customerDisplay?.paymentMethod}
        status={customerDisplay?.status}
        items={customerDisplay?.items}
        cashGiven={customerDisplay?.cashGiven}
        change={customerDisplay?.change}
        reference={customerDisplay?.reference}
        title={customerDisplay?.title}
        subtitle={customerDisplay?.subtitle}
        onAutoReset={closeCustomerScreen}
        onClose={closeCustomerScreen}
      />
    </div>
  )
}

