import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote,
  Split, Tag, Receipt, X, Keyboard, RotateCcw, Pause,
  Play, Barcode, Percent, User, Printer, Search
} from 'lucide-react'
import { usePOSStore, useProductStore, useAppStore, useSalesStore } from '@/store'
import { useToast } from '@/components/Toast'
import { formatCurrency, generateReceiptNumber } from '@/lib/utils'
import { Badge, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import ReceiptModal from '@/components/Receipt'

const ALL_CATEGORIES = ['All', 'Grains', 'Oils', 'Groceries', 'Dairy', 'Beverages', 'Personal Care', 'Pharmacy', 'Condiments']

// ─── Category emoji map ────────────────────────────────────────────────────────
const CAT_EMOJI = {
  Grains: '🌾', Oils: '🫙', Groceries: '🧺', Dairy: '🥛',
  Beverages: '☕', 'Personal Care': '🧴', Pharmacy: '💊', Condiments: '🧂',
}

// ─── Payment Modal ──────────────────────────────────────────────────────────
const PaymentModal = ({ open, onClose, total, onComplete }) => {
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

  return (
    <Modal open={open} onClose={onClose} title="Process Payment" maxWidth="max-w-md">
      <div className="mb-4 p-5 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' }}>
        <p className="text-sm text-green-700 font-medium">Amount Due</p>
        <p className="text-5xl font-black text-green-700 mt-1">{formatCurrency(total)}</p>
      </div>

      {/* Method tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'cash', label: 'Cash', icon: Banknote },
          { id: 'card', label: 'Card', icon: CreditCard },
          { id: 'split', label: 'Split', icon: Split },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMethod(id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-sm font-semibold',
              method === id
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      {method === 'cash' && (
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cash Received</label>
          <input
            autoFocus
            type="number"
            value={cashGiven}
            onChange={(e) => setCashGiven(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canPay && handlePay()}
            placeholder={total.toFixed(2)}
            className="input-base mt-1 text-2xl font-bold"
            style={{ height: 56 }}
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            {quickAmounts.map((v) => (
              <button
                key={v}
                onClick={() => setCashGiven(String(v))}
                className="text-xs px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 font-semibold hover:bg-green-100 transition-colors"
              >
                Rs. {v.toLocaleString()}
              </button>
            ))}
          </div>
          {cashNum >= total && cashNum > 0 && (
            <div className="mt-3 p-4 rounded-xl flex items-center justify-between" style={{ background: '#eff6ff' }}>
              <span className="text-sm font-semibold text-blue-700">💵 Change to Return</span>
              <span className="text-2xl font-black text-blue-700">{formatCurrency(change)}</span>
            </div>
          )}
        </div>
      )}

      {method === 'card' && (
        <div className="mb-4 p-5 rounded-xl bg-blue-50 text-center border border-blue-100">
          <CreditCard size={36} className="mx-auto text-blue-400 mb-2" />
          <p className="text-sm font-medium text-blue-700">Tap or swipe the card to complete</p>
          <p className="text-xs text-blue-500 mt-1">Supported: Visa, Mastercard, Amex</p>
        </div>
      )}

      {method === 'split' && (
        <div className="mb-4 p-5 rounded-xl bg-purple-50 text-center border border-purple-100">
          <Split size={36} className="mx-auto text-purple-400 mb-2" />
          <p className="text-sm font-medium text-purple-700">Split payment between cash and card</p>
          <p className="text-xs text-purple-500 mt-1">Ask customer for split amounts</p>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!canPay || processing}
        className="btn-primary w-full justify-center py-4 text-base"
        style={{ borderRadius: 14, opacity: !canPay && method === 'cash' ? 0.5 : 1 }}
      >
        {processing
          ? '⏳ Processing...'
          : `✓ Confirm ${method === 'cash' ? 'Cash ' : method === 'card' ? 'Card ' : ''}Payment`}
      </button>
    </Modal>
  )
}



// ─── Main POS Component ──────────────────────────────────────────────────────
export default function POS() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [showPayment, setShowPayment] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)
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

  useEffect(() => { searchRef.current?.focus() }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'F2') { searchRef.current?.focus(); e.preventDefault() }
      if (e.key === 'F5') { if (cart.length > 0) setShowPayment(true); e.preventDefault() }
      if (e.key === 'Escape') { setSearch(''); setShowPayment(false); setShowReceipt(false) }
      if (e.key === 'Delete' && e.ctrlKey) { clearCart(); toast.warning('Cart cleared'); e.preventDefault() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cart, clearCart])

  const filteredProducts = products.filter((p) => {
    if (!p.active) return false
    
    // Strict isolation: only show products belonging to the active module
    const matchM = !p.module || p.module === activeModule
    
    const matchS = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
    const matchC = activeCategory === 'All' || p.category === activeCategory
    return matchM && matchS && matchC
  })

  const handleSearchKey = useCallback((e) => {
    if (e.key === 'Enter' && search.trim()) {
      const found = getByBarcode(search.trim())
      if (found) {
        addToCart(found)
        toast.success(`${found.name} added`, { duration: 1500 })
        setSearch('')
      } else {
        toast.error('Product not found for this barcode', { duration: 2000 })
      }
    }
  }, [search, getByBarcode, addToCart])

  const handleAddToCart = (p) => {
    if (p.stock === 0) { toast.error(`${p.name} is out of stock`); return }
    addToCart(p)
    toast.success(`${p.name} added to cart`, { duration: 1200 })
  }

  const subtotal = getSubtotal()
  const discountAmt = getDiscountAmount()
  const taxAmt = getTax(taxSettings.rate, taxSettings.inclusive)
  const total = getTotal(taxSettings.rate, taxSettings.inclusive)

  const handleCompleteSale = (method, cashGiven = 0, change = 0) => {
    const receiptNo = generateReceiptNumber()
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
      change,
      cashier: 'Admin',
      source: activeModule === 'restaurant' ? 'takeout' : activeModule || 'grocery', // tag it correctly
      status: 'completed',
    }
    addSale({ ...saleData, items: cart.length })
    cart.forEach((item) => adjustStock(item.id, -item.qty))
    setLastSale(saleData)
    setShowPayment(false)
    clearCart()
    setShowReceipt(true)
    toast.success(`Sale complete! Rs. ${total.toFixed(2)} — ${method}`)
  }

  const moduleProducts = products.filter((p) => p.active && (!p.module || p.module === activeModule))
  const categories = ['All', ...new Set(moduleProducts.map((p) => p.category))]

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#f4f7f5' }}>
      {/* ─── Left: Products ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ background: 'white', borderBottom: '1px solid #f0f0f0' }}
        >
          <div className="relative flex-1">
            <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Scan barcode or search products... (F2 to focus)"
              className="input-base pl-9 text-sm"
              style={{ height: 40 }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
            <Keyboard size={12} />
            F2: Focus · F5: Pay · Ctrl+Del: Clear
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
                'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1',
                activeCategory === cat
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {cat !== 'All' && <span>{CAT_EMOJI[cat] || '📦'}</span>}
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Search size={44} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No products found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Try a different search term or barcode' : 'No products in this category'}
              </p>
            </div>
          ) : (
            <div
              className="grid gap-3"
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
                      'pos-product-btn flex flex-col gap-1 animate-fade-in relative overflow-hidden text-left',
                      p.stock === 0 && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {cartQty > 0 && (
                      <div
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ background: '#16a34a', fontSize: 10 }}
                      >
                        {cartQty}
                      </div>
                    )}
                    <div
                      className="w-full h-12 rounded-xl flex items-center justify-center text-xl mb-1"
                      style={{ background: '#f0fdf4' }}
                    >
                      {CAT_EMOJI[p.category] || '📦'}
                    </div>
                    <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{p.name}</p>
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <p className="text-sm font-black text-green-700">{formatCurrency(p.price)}</p>
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          p.stock === 0 ? 'text-red-500' : p.stock <= 5 ? 'text-orange-500' : 'text-gray-400'
                        )}
                      >
                        {p.stock === 0 ? '⛔ Out' : p.stock <= 5 ? `⚡${p.stock}` : p.stock}
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
          width: 350,
          background: 'white',
          borderLeft: '1px solid #f0f0f0',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.04)',
        }}
      >
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-green-600" />
            <span className="font-bold text-gray-900 text-sm">Current Sale</span>
            {cart.length > 0 && (
              <span className="badge badge-green text-xs">{cart.reduce((s, i) => s + i.qty, 0)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {heldTransactions.length > 0 && (
              <button
                onClick={() => { resumeTransaction(heldTransactions[0].id); toast.info('Transaction resumed') }}
                className="btn-ghost py-1 px-2 text-xs"
                title={`Resume held transaction (${heldTransactions.length})`}
              >
                <Play size={13} />
                <span>{heldTransactions.length}</span>
              </button>
            )}
            <button
              onClick={() => { holdTransaction(); toast.info('Transaction held') }}
              disabled={cart.length === 0}
              className="btn-ghost py-1 px-2 text-xs"
              title="Hold transaction"
            >
              <Pause size={13} />
            </button>
            <button
              onClick={() => { clearCart(); toast.warning('Cart cleared') }}
              disabled={cart.length === 0}
              className="btn-danger py-1 px-2 text-xs"
              title="Clear cart (Ctrl+Delete)"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <ShoppingBag size={44} className="text-gray-100 mb-3" />
              <p className="text-gray-400 font-semibold text-sm">Cart is empty</p>
              <p className="text-xs text-gray-300 mt-1">Click a product or scan a barcode</p>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:border-green-200 transition-colors group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: '#f0fdf4' }}
                  >
                    {CAT_EMOJI[item.category] || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(item.salePrice)} ea</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-red-400 transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-gray-800">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-green-50 text-green-600 transition-colors"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-green-700 w-20 text-right shrink-0">
                    {formatCurrency(item.salePrice * item.qty)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Payment */}
        <div className="border-t border-gray-100 p-4" style={{ background: '#fafafa' }}>
          {/* Discount */}
          <div className="flex items-center gap-2 mb-3 p-2 rounded-xl bg-gray-50 border border-gray-100">
            <Tag size={12} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 flex-1">Discount</span>
            <div className="flex items-center gap-1">
              <select
                value={discountType}
                onChange={(e) => setDiscount(discount, e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 outline-none bg-white"
              >
                <option value="percent">%</option>
                <option value="fixed">Rs.</option>
              </select>
              <input
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0, discountType)}
                className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1 text-center outline-none focus:border-green-400 bg-white"
                placeholder="0"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-1 mb-3 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-red-500 font-medium">
                <span>Discount</span>
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

          {/* Total */}
          <div
            className="flex justify-between items-center px-4 py-3 rounded-2xl mb-3"
            style={{ background: cart.length ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : '#f9fafb' }}
          >
            <span className="font-bold text-gray-700">TOTAL</span>
            <span className={cn('text-3xl font-black', cart.length ? 'text-green-700' : 'text-gray-300')}>
              {formatCurrency(total)}
            </span>
          </div>

          {/* Quick payment buttons */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[
              { id: 'cash', label: 'Cash', icon: Banknote, color: 'green' },
              { id: 'card', label: 'Card', icon: CreditCard, color: 'blue' },
              { id: 'split', label: 'Split', icon: Split, color: 'purple' },
            ].map(({ id, label, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => { if (!cart.length) return; id === 'cash' ? setShowPayment(true) : handleCompleteSale(id) }}
                disabled={!cart.length}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
                  cart.length
                    ? `border-${color}-400 bg-${color}-50 text-${color}-700 hover:bg-${color}-100`
                    : 'border-gray-100 text-gray-300 cursor-not-allowed'
                )}
                style={cart.length ? {
                  borderColor: color === 'green' ? '#4ade80' : color === 'blue' ? '#60a5fa' : '#c084fc',
                  background: color === 'green' ? '#f0fdf4' : color === 'blue' ? '#eff6ff' : '#faf5ff',
                  color: color === 'green' ? '#16a34a' : color === 'blue' ? '#2563eb' : '#7c3aed',
                } : {}}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Main charge button */}
          <button
            onClick={() => cart.length > 0 && setShowPayment(true)}
            disabled={!cart.length}
            className="btn-primary w-full justify-center py-3.5 text-base"
            style={{ borderRadius: 14, opacity: cart.length ? 1 : 0.4 }}
          >
            <Receipt size={18} />
            Charge · F5
          </button>
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        onComplete={handleCompleteSale}
      />
      {showReceipt && lastSale && (
        <ReceiptModal
          sale={lastSale}
          businessInfo={useAppStore.getState().businessInfo}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )
}
