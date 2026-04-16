import React, { useState } from 'react'
import { ShoppingBag, Banknote, CreditCard, Split, X, Clock, CheckCircle2 } from 'lucide-react'
import { useSalesStore, useAppStore, useProductStore, useTableStore } from '@/store'
import { useToast } from '@/components/Toast'
import { cn, formatCurrency, generateReceiptNumber } from '@/lib/utils'
import ReceiptModal from '@/components/Receipt'

// Removed hardcoded MENU_ITEMS - Now pulling dynamically from useProductStore


// ─── Payment Modal ─────────────────────────────────────────────────────────────
function PayModal({ items, notes, customerName, customerPhone, taxSettings, onClose, onPaid }) {
  const [method, setMethod] = useState('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [processing, setProcessing] = useState(false)

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const taxRate = taxSettings.enabled ? taxSettings.rate : 0
  const tax = (subtotal * taxRate) / 100
  const total = subtotal + tax
  const cashNum = parseFloat(cashGiven) || 0
  const change = method === 'cash' ? Math.max(0, cashNum - total) : 0
  const canPay = method !== 'cash' || cashNum >= total

  const quickAmts = [...new Set([1, 2, 3].map((m) => Math.ceil(total / (m * 500)) * m * 500))].filter((v) => v >= total).slice(0, 3)

  const confirm = () => {
    if (!canPay) return
    setProcessing(true)
    setTimeout(() => onPaid({ method, cashNum, change, subtotal, tax, total }), 500)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-fade-in" style={{ background: 'white', borderRadius: 20, width: 460, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 28 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payment — Take Out</h2>
            {customerName && <p className="text-sm text-gray-500">👤 {customerName}{customerPhone ? ` · ${customerPhone}` : ''}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Order summary */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          {items.map((i) => (
            <div key={i.id} className="flex justify-between text-sm py-0.5">
              <span className="text-gray-700"><span style={{ color: '#ea580c', fontWeight: 700 }}>{i.qty}×</span> {i.name}</span>
              <span className="font-semibold">{formatCurrency(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-orange-200 mt-2 pt-2 space-y-1">
            <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {tax > 0 && <div className="flex justify-between text-sm text-gray-500"><span>VAT ({taxRate}%)</span><span>{formatCurrency(tax)}</span></div>}
          </div>
        </div>

        {/* Total */}
        <div className="rounded-2xl p-5 text-center mb-5" style={{ background: 'linear-gradient(135deg,#fff7ed,#ffedd5)' }}>
          <p className="text-sm font-semibold" style={{ color: '#ea580c' }}>Amount Due</p>
          <p className="text-5xl font-black mt-1" style={{ color: '#ea580c' }}>{formatCurrency(total)}</p>
        </div>

        {/* Method */}
        <div className="flex gap-2 mb-4">
          {[{ id: 'cash', label: 'Cash', icon: Banknote }, { id: 'card', label: 'Card', icon: CreditCard }, { id: 'split', label: 'Split', icon: Split }].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setMethod(id)}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-sm font-semibold"
              style={method === id ? { borderColor: '#ea580c', background: '#fff7ed', color: '#ea580c' } : { borderColor: '#e5e7eb', color: '#9ca3af' }}
            >
              <Icon size={20} />{label}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cash Received</label>
            <input autoFocus type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canPay && confirm()}
              placeholder={total.toFixed(2)} className="input-base mt-1 text-2xl font-bold" style={{ height: 56 }} />
            <div className="flex gap-2 mt-2">
              {quickAmts.map((v) => (
                <button key={v} onClick={() => setCashGiven(String(v))}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c' }}>
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
            <p className="text-sm font-medium text-blue-700">Tap or swipe card to pay</p>
          </div>
        )}
        {method === 'split' && (
          <div className="mb-4 p-5 rounded-xl bg-purple-50 text-center border border-purple-100">
            <Split size={36} className="mx-auto text-purple-400 mb-2" />
            <p className="text-sm font-medium text-purple-700">Split between cash and card</p>
          </div>
        )}

        <button onClick={confirm} disabled={!canPay || processing}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white text-base"
          style={{ background: canPay ? 'linear-gradient(135deg,#ea580c,#f97316)' : '#e5e7eb', color: canPay ? 'white' : '#9ca3af', borderRadius: 14 }}>
          {processing ? '⏳ Processing…' : `✓ Confirm — ${formatCurrency(total)}`}
        </button>
      </div>
    </div>
  )
}

// ─── Main TakeOut Page ─────────────────────────────────────────────────────────
export default function TakeOut() {
  const { addSale, sales } = useSalesStore()
  const { addKOT } = useTableStore()
  const { businessInfo, taxSettings } = useAppStore()
  const { products } = useProductStore()
  const toast = useToast()

  const restaurantProducts = products.filter(p => p.active && p.module === 'restaurant')
  const categoriesList = ['All', ...new Set(restaurantProducts.map((p) => p.category).filter(Boolean))]

  const [activeCategory, setActiveCategory] = useState('All')
  const [items, setItems] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const filtered = activeCategory === 'All' ? restaurantProducts : restaurantProducts.filter((i) => i.category === activeCategory)

  const addItem = (item) =>
    setItems((prev) => {
      const ex = prev.find((i) => i.id === item.id)
      return ex ? prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...item, qty: 1 }]
    })

  const changeQty = (id, d) =>
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, qty: i.qty + d } : i).filter((i) => i.qty > 0))

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const taxRate = taxSettings.enabled ? taxSettings.rate : 0
  const total = subtotal + (subtotal * taxRate) / 100

  const handlePaid = ({ method, cashNum, change, subtotal, tax, total }) => {
    const receiptNo = generateReceiptNumber()
    const normalizedNotes = (notes || '').trim()
    const saleData = {
      receiptNo, date: new Date(),
      cartItems: items.map((i) => ({ ...i, salePrice: i.price })),
      items: items.reduce((s, i) => s + i.qty, 0),
      subtotal, discount: 0, tax, total,
      paymentMethod: method, change,
      customerName: customerName || 'Walk-in', customerPhone,
      cashier: 'Counter', source: 'takeout', status: 'completed', notes: normalizedNotes,
    }

    addKOT({
      tableId: `takeout-${Date.now()}`,
      tableNumber: 'TO',
      items: items.map((i) => ({ ...i })),
      notes: normalizedNotes,
      waiter: customerName || 'Take Out',
      source: 'takeout',
      receiptNo,
    })

    addSale(saleData)
    setReceipt(saleData)
    setItems([]); setCustomerName(''); setCustomerPhone(''); setNotes('')
    setShowPay(false)
    toast.success(`Take Out paid! ${formatCurrency(total)} via ${method}`)
  }

  // Today's orders
  const today = new Date().toDateString()
  const todayOrders = sales.filter((s) => s.source === 'takeout' && new Date(s.date).toDateString() === today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: POS */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Category tabs */}
        <div className="px-4 py-3 flex gap-2 shrink-0" style={{ background: 'white', borderBottom: '1px solid #f0f0f0' }}>
          <ShoppingBag size={16} style={{ color: '#ea580c', marginTop: 4 }} />
          {categoriesList.map((c) => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={activeCategory === c ? { background: '#ea580c', color: 'white' } : { background: '#f3f4f6', color: '#4b5563' }}>
              {c}
            </button>
          ))}
        </div>

        {/* Menu grid */}
        <div className="flex-1 overflow-y-auto p-4"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, alignContent: 'start' }}>
          {filtered.map((item) => {
            const inOrder = items.find((i) => i.id === item.id)
            return (
              <button key={item.id} onClick={() => addItem(item)}
                className={cn('pos-product-btn relative', inOrder && 'bg-orange-50')}
                style={inOrder ? { borderColor: '#f97316' } : {}}>
                {inOrder && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                    style={{ background: '#ea580c' }}>{inOrder.qty}</span>
                )}
                <div className="text-2xl mb-1">
                  {item.category === 'Mains' ? '🍽️' : item.category === 'Starters' ? '🥗' : item.category === 'Drinks' ? '🥤' : item.category === 'Pizzas' ? '🍕' : item.category === 'Desserts' ? '🍰' : '🍲'}
                </div>
                <p className="text-xs font-semibold text-gray-800 leading-tight">{item.name}</p>
                <p className="text-sm font-bold mt-1" style={{ color: '#ea580c' }}>{formatCurrency(item.price)}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="flex flex-col shrink-0" style={{ width: 320, background: 'white', borderLeft: '1px solid #f0f0f0' }}>
        {/* Customer info */}
        <div className="p-4 shrink-0" style={{ borderBottom: '1px solid #f0f0f0', background: '#fff7ed' }}>
          <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">🛍️ Take Out Customer</p>
          <div className="flex flex-col gap-2">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Name (optional)" className="input-base text-sm" />
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone (optional)" className="input-base text-sm" type="tel" />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingBag size={40} className="mb-2" />
              <p className="text-sm">Select items from the menu</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:border-orange-200 transition-colors group">
                  <span className="text-lg">
                    {item.category === 'Mains' ? '🍽️' : item.category === 'Starters' ? '🥗' : item.category === 'Drinks' ? '🥤' : item.category === 'Pizzas' ? '🍕' : item.category === 'Desserts' ? '🍰' : '🍲'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-red-400 font-bold text-sm">−</button>
                    <span className="w-5 text-center text-sm font-bold text-gray-800">{item.qty}</span>
                    <button onClick={() => changeQty(item.id, +1)} className="w-6 h-6 flex items-center justify-center rounded-full font-bold text-sm" style={{ color: '#ea580c' }}>+</button>
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-16 text-right">{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
          )}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Special instructions..." className="input-base mt-3 text-xs" rows={2} />
        </div>

        {/* Total + Pay */}
        <div className="p-4 shrink-0" style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div
            className="flex justify-between items-center py-3 px-4 rounded-2xl mb-3"
            style={{ background: items.length ? 'linear-gradient(135deg,#fff7ed,#ffedd5)' : '#f9fafb' }}>
            <span className="font-bold text-gray-700">TOTAL</span>
            <span className="text-3xl font-black" style={{ color: items.length ? '#ea580c' : '#d1d5db' }}>{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2">
            <button disabled={!items.length} onClick={() => setShowPay(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white"
              style={{ background: items.length ? 'linear-gradient(135deg,#ea580c,#f97316)' : '#e5e7eb', color: items.length ? 'white' : '#9ca3af' }}>
              <Banknote size={16} /> Pay Now
            </button>
            <button disabled={!items.length} onClick={() => { setItems([]); toast.warning('Order cleared') }}
              className="px-3 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-sm font-semibold disabled:opacity-30">
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* History panel (bottom sheet style — shown as toggleable right column on wide screens) */}
      {todayOrders.length > 0 && (
        <div className="flex-col hidden xl:flex shrink-0 overflow-hidden" style={{ width: 280, borderLeft: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Today's Take Out</p>
            <p className="text-lg font-black" style={{ color: '#ea580c' }}>{todayOrders.length} orders</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {todayOrders.map((o) => (
              <div key={o.id} className="card p-3">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold text-gray-800">{o.customerName || 'Walk-in'}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} />{new Date(o.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{o.items} items</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-black text-green-700">{formatCurrency(o.total)}</span>
                  <span className="flex items-center gap-1 text-green-600 text-xs">
                    <CheckCircle2 size={12} />Paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showPay && (
        <PayModal items={items} notes={notes} customerName={customerName} customerPhone={customerPhone}
          taxSettings={taxSettings} onClose={() => setShowPay(false)} onPaid={handlePaid} />
      )}
      {receipt && (
        <ReceiptModal sale={receipt} businessInfo={businessInfo} onClose={() => setReceipt(null)} />
      )}
    </div>
  )
}

