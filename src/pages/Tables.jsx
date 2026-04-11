import React, { useState } from 'react'
import { Utensils, ChefHat, X, Banknote, CreditCard, Split, Receipt as ReceiptIcon, ShoppingBag, Clock, CheckCircle2, QrCode } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useSalesStore, useAppStore, idbStorage, useProductStore } from '@/store'
import { Badge, SectionHeader } from '@/components/ui'
import { cn, formatCurrency, generateReceiptNumber } from '@/lib/utils'
import ReceiptModal from '@/components/Receipt'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRightLeft } from 'lucide-react'

// ─── Tables store ─────────────────────────────────────────────────────────────
const SAMPLE_TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: `table-${i + 1}`,
  number: i + 1,
  seats: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 8, 6][i],
  status: ['available', 'available', 'occupied', 'available', 'reserved', 'occupied', 'available', 'occupied', 'available', 'available', 'reserved', 'available'][i],
  order: null,
  waiter: null,
}))

// Removed hardcoded KOT_ITEMS - Now pulling dynamically from useProductStore

const useTableStore = create(
  persist(
    (set, get) => ({
      tables: SAMPLE_TABLES,
      kots: [],
      updateTable: (id, updates) =>
        set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
      addKOT: (kot) =>
        set((s) => ({ kots: [{ ...kot, id: uuidv4(), time: new Date(), status: 'pending' }, ...s.kots] })),
      updateKOTStatus: (id, status) =>
        set((s) => ({ kots: s.kots.map((k) => (k.id === id ? { ...k, status } : k)) })),
      clearTable: (id) =>
        set((s) => ({
          tables: s.tables.map((t) =>
            t.id === id ? { ...t, status: 'available', order: null, waiter: null, sessionId: null, guests: 0 } : t
          ),
          // also clear KOTs for this table
          kots: s.kots.filter((k) => k.tableId !== id),
        })),
      transferTable: (oldId, newId) => set((s) => {
        const oldTable = s.tables.find((t) => t.id === oldId)
        const newTable = s.tables.find((t) => t.id === newId)
        if (!oldTable || !newTable) return s

        return {
          tables: s.tables.map((t) => {
            if (t.id === newId) {
              return { ...t, status: 'occupied', order: oldTable.order, waiter: oldTable.waiter, guests: oldTable.guests, sessionId: oldTable.sessionId }
            }
            if (t.id === oldId) {
              return { ...t, status: 'available', order: null, waiter: null, guests: 0, sessionId: null }
            }
            return t
          }),
          kots: s.kots.map((k) => k.tableId === oldId ? { ...k, tableId: newId, tableNumber: newTable.number } : k)
        }
      }),
    }),
    { 
      name: 'paxxmo-tables',
      storage: createJSONStorage(() => idbStorage)
    }
  )
)

const STATUS_CONFIG = {
  available: { label: 'Available', variant: 'green', bg: '#f0fdf4', border: '#86efac' },
  occupied:  { label: 'Occupied',  variant: 'red',   bg: '#fef2f2', border: '#fca5a5' },
  reserved:  { label: 'Reserved',  variant: 'yellow', bg: '#fffbeb', border: '#fde68a' },
}



// ─── Settle Payment Modal ──────────────────────────────────────────────────────
function SettleModal({ table, order, onPaid, onClose }) {
  const { taxSettings, serviceChargeSettings } = useAppStore()
  const [method, setMethod] = useState('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [processing, setProcessing] = useState(false)

  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0)
  const taxRate = taxSettings.enabled ? taxSettings.rate : 0
  const tax = (subtotal * taxRate) / 100
  
  const scRate = serviceChargeSettings?.enabled ? serviceChargeSettings.rate : 0
  const serviceChargeAmount = (subtotal * scRate) / 100

  const total = subtotal + tax + serviceChargeAmount

  const cashNum = parseFloat(cashGiven) || 0
  const change = method === 'cash' ? Math.max(0, cashNum - total) : 0
  const canPay = method !== 'cash' || cashNum >= total

  const quickAmounts = [...new Set([
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
    Math.ceil(total / 1000) * 1000,
  ])].filter((v) => v >= total).slice(0, 3)

  const handlePay = () => {
    if (!canPay) return
    setProcessing(true)
    setTimeout(() => {
      onPaid({ method, cashGiven: cashNum, change, subtotal, tax, serviceCharge: serviceChargeAmount, total })
      setProcessing(false)
    }, 600)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="animate-fade-in"
        style={{
          background: 'white',
          borderRadius: 20,
          width: 460,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          padding: 28,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Settle Bill — Table {table.number}</h2>
            {order.waiter && <p className="text-sm text-gray-500">Waiter: {order.waiter}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Order summary */}
        <div
          className="rounded-2xl p-4 mb-5"
          style={{ background: '#f8fffe', border: '1px solid #dcfce7' }}
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Order Summary</p>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-700">
                <span className="text-green-700 font-bold">{item.qty}×</span> {item.name}
              </span>
              <span className="font-semibold text-gray-800">{formatCurrency(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-gray-200 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {serviceChargeAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Service Charge ({scRate}%)</span><span>{formatCurrency(serviceChargeAmount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>VAT ({taxRate}%)</span><span>{formatCurrency(tax)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Total */}
        <div
          className="rounded-2xl p-5 text-center mb-5"
          style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}
        >
          <p className="text-sm text-green-700 font-semibold">Amount Due</p>
          <p className="text-5xl font-black text-green-700 mt-1">{formatCurrency(total)}</p>
        </div>

        {/* Payment method */}
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
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cash Received</label>
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
            <p className="text-sm font-medium text-blue-700">Tap or swipe card to complete payment</p>
          </div>
        )}

        {method === 'split' && (
          <div className="mb-4 p-5 rounded-xl bg-purple-50 text-center border border-purple-100">
            <Split size={36} className="mx-auto text-purple-400 mb-2" />
            <p className="text-sm font-medium text-purple-700">Split payment between cash and card</p>
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={!canPay || processing}
          className="btn-primary w-full justify-center py-4 text-base"
          style={{ borderRadius: 14, opacity: (!canPay && method === 'cash') ? 0.5 : 1 }}
        >
          {processing
            ? '⏳ Processing…'
            : `✓ Confirm & Settle — ${formatCurrency(total)}`}
        </button>
      </div>
    </div>
  )
}

// ─── Table Card ────────────────────────────────────────────────────────────────
function TableCard({ table, onClick }) {
  const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available
  const orderTotal = table.order?.items?.reduce((s, i) => s + i.price * i.qty, 0) || 0
  return (
    <button
      onClick={() => onClick(table)}
      className="text-left transition-all duration-200 hover:scale-105 focus:outline-none"
      style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: 16, padding: 16, cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-black text-gray-900">T{table.number}</p>
          <p className="text-xs text-gray-500">{table.seats} seats</p>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>
      {table.status === 'occupied' && table.order ? (
        <div>
          <p className="text-xs text-gray-500">{table.order.items?.length || 0} items</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(orderTotal)}</p>
          {table.waiter && <p className="text-xs text-gray-400 mt-1">👤 {table.waiter}</p>}
        </div>
      ) : table.status === 'reserved' ? (
        <p className="text-xs text-gray-500">Tap to manage</p>
      ) : (
        <p className="text-xs text-gray-400">Tap to open</p>
      )}
    </button>
  )
}

// ─── Table Action Modal ────────────────────────────────────────────────────────
function TableActionModal({ table, onOpen, onReserve, onCancelReserve, onClose }) {
  const [guests, setGuests] = useState('')
  const isReserved = table.status === 'reserved'

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-fade-in card p-8 flex flex-col items-center" style={{ width: 340 }}>
        <h2 className="text-xl font-black text-gray-800 mb-1">
          {isReserved ? `Table ${table.number} (Reserved)` : `Table ${table.number}`}
        </h2>
        <p className="text-sm text-gray-500 mb-5 text-center">
          {isReserved ? 'Seat guests or cancel reservation?' : 'How many guests are sitting?'}
        </p>
        
        <input 
          type="number" 
          autoFocus 
          value={guests} 
          onChange={e => setGuests(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && parseInt(guests) > 0 && onOpen(parseInt(guests))}
          className="input-base text-center text-3xl font-bold mb-4" 
          placeholder="Guests"
        />
        
        <div className="w-full flex flex-col gap-2 mb-2">
          <button 
            className="btn-primary w-full justify-center" 
            disabled={!guests || parseInt(guests) <= 0} 
            onClick={() => onOpen(parseInt(guests))}
          >
            {isReserved ? 'Guests Arrived (Seat)' : 'Open Table'}
          </button>
          
          {isReserved ? (
            <button className="btn-danger w-full justify-center" onClick={onCancelReserve}>
              Cancel Reservation
            </button>
          ) : (
            <button 
              className="btn-secondary w-full justify-center" 
              style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#d97706' }} 
              onClick={onReserve}
            >
              Mark as Reserved
            </button>
          )}
        </div>
        
        <button className="btn-ghost w-full justify-center" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ─── QR Code Modal ─────────────────────────────────────────────────────────────
function QRModal({ table, onClose }) {
  const { businessInfo } = useAppStore()
  const toast = useToast()
  
  // Predictable generic table-ordering URL utilizing the Cloud Sync structure.
  // We append a random session token so previous guests' URLs become invalid
  // once the table is settled!
  const menuUrl = `https://paxxmo.com/menu/${businessInfo.taxId || 'demo'}?table=${table.number}&session=${table.sessionId || 'static'}`

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-fade-in card p-8 flex flex-col items-center" style={{ width: 340 }}>
        <h2 className="text-xl font-black text-gray-800 mb-1">Table {table.number} QR</h2>
        <p className="text-sm text-gray-500 mb-5 text-center">Scan to open digital menu</p>
        
        <div className="p-4 bg-white rounded-3xl mb-6 shadow-[0px_8px_30px_rgba(0,0,0,0.08)] flex justify-center w-full relative">
          <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center border-4 border-white">
            <QrCode size={12} />
          </div>
          <QRCodeSVG value={menuUrl} size={200} level="H" />
        </div>
        
        <button 
          className="btn-primary w-full justify-center mb-2" 
          onClick={() => {
            navigator.clipboard.writeText(menuUrl)
            toast.success('Menu URL copied to clipboard')
          }}
        >
          Copy Link
        </button>
        <button className="btn-ghost w-full justify-center" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Transfer / Move Table Modal ───────────────────────────────────────────────
function TransferModal({ currentTable, availableTables, onTransfer, onClose }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 120 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-fade-in card p-6 max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-5 border-b pb-3">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <ArrowRightLeft size={20} className="text-blue-500" />
            Move Table {currentTable.number}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        
        {availableTables.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No empty tables available.</p>
        ) : (
          <div className="flex-1 overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
             {availableTables.map(t => (
               <button 
                 key={t.id} 
                 className="p-4 border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors flex flex-col items-center" 
                 onClick={() => onTransfer(t)}
               >
                 <p className="font-black text-xl text-gray-800">T{t.number}</p>
                 <p className="text-xs text-gray-500 mt-1">{t.seats} seats</p>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Order Modal ───────────────────────────────────────────────────────────────
function OrderModal({ table, onClose, onSettle }) {
  const { tables, updateTable, addKOT, transferTable } = useTableStore()
  const { products } = useProductStore()
  const toast = useToast()
  
  const restaurantProducts = products.filter(p => p.active && p.module === 'restaurant')

  const [activeCategory, setActiveCategory] = useState('All')
  const [order, setOrder] = useState(table.order || { items: [] })
  const [waiter, setWaiter] = useState(table.waiter || '')
  const [notes, setNotes] = useState('')
  const [showSettle, setShowSettle] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  const categories = ['All', ...new Set(restaurantProducts.map((k) => k.category).filter(Boolean))]
  const filtered = activeCategory === 'All' ? restaurantProducts : restaurantProducts.filter((i) => i.category === activeCategory)
  
  const availableTables = tables.filter(t => t.status === 'available')

  const addToOrder = (item) => {
    setOrder((o) => {
      const ex = o.items.find((i) => i.id === item.id)
      if (ex) return { ...o, items: o.items.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) }
      return { ...o, items: [...o.items, { ...item, qty: 1 }] }
    })
  }
  const removeFromOrder = (id) => setOrder((o) => ({ ...o, items: o.items.filter((i) => i.id !== id) }))

  const total = order.items.reduce((s, i) => s + i.price * i.qty, 0)

  const sendKOT = () => {
    if (!order.items.length) { toast.error('Add items first'); return }
    const orderWithWaiter = { ...order, waiter }
    addKOT({ tableId: table.id, tableNumber: table.number, items: order.items, notes, waiter })
    updateTable(table.id, { status: 'occupied', order: orderWithWaiter, waiter })
    toast.success(`KOT sent to kitchen for Table ${table.number}`)
    onClose()
  }

  // The current order to settle: prefer live edits, otherwise table's saved order
  const currentOrder = { ...order, waiter }

  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div
          className="animate-fade-in"
          style={{
            background: 'white', borderRadius: 20, width: '90vw', maxWidth: 860,
            maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <Utensils size={18} className="text-green-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Table {table.number}</h2>
                <p className="text-xs text-gray-500">
                  {table.seats} seats · {table.guests ? `${table.guests} guests · ` : ''}{STATUS_CONFIG[table.status]?.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTransfer(true)}
                className="btn-ghost p-2"
                title="Move Table"
              >
                <ArrowRightLeft size={16} />
              </button>
              <button
                onClick={() => setShowQR(true)}
                className="btn-secondary"
              >
                <QrCode size={14} />
                QR Menu
              </button>
              {(table.status === 'occupied' || order.items.length > 0) && (
                <button
                  onClick={() => {
                    if (!order.items.length && !table.order?.items?.length) {
                      toast.error('No order to settle'); return
                    }
                    setShowSettle(true)
                  }}
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
                >
                  <ReceiptIcon size={14} />
                  Settle &amp; Pay
                </button>
              )}
              <button onClick={onClose} className="btn-ghost p-2"><X size={16} /></button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Menu panel */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: '1px solid #f0f0f0' }}>
              <div className="px-4 py-3 flex gap-2 flex-wrap" style={{ borderBottom: '1px solid #f0f0f0' }}>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                      activeCategory === c ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div
                className="flex-1 overflow-y-auto p-3"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 8, alignContent: 'start' }}
              >
                {filtered.map((item) => {
                  const inOrder = order.items.find((i) => i.id === item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToOrder(item)}
                      className={cn('pos-product-btn relative', inOrder && 'border-green-400 bg-green-50')}
                    >
                      {inOrder && (
                        <span
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: '#16a34a' }}
                        >
                          {inOrder.qty}
                        </span>
                      )}
                      <div className="text-2xl mb-1">
                        {item.category === 'Mains' ? '🍽️' : item.category === 'Starters' ? '🥗' : item.category === 'Drinks' ? '🥤' : item.category === 'Pizzas' ? '🍕' : item.category === 'Desserts' ? '🍰' : '🍲'}
                      </div>
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{item.name}</p>
                      <p className="text-sm font-bold text-green-700 mt-1">{formatCurrency(item.price)}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Order panel */}
            <div className="flex flex-col" style={{ width: 280 }}>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ChefHat size={14} className="text-green-600" />
                  <p className="text-sm font-bold text-gray-700">Current Order</p>
                </div>
                <input
                  value={waiter}
                  onChange={(e) => setWaiter(e.target.value)}
                  placeholder="Waiter name..."
                  className="input-base mb-3 text-sm"
                />
                {order.items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No items added</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-green-700 w-5 text-center">{item.qty}×</span>
                        <span className="flex-1 text-gray-700 text-xs">{item.name}</span>
                        <span className="font-semibold text-gray-800 text-xs">{formatCurrency(item.price * item.qty)}</span>
                        <button onClick={() => removeFromOrder(item.id)} className="text-gray-300 hover:text-red-400">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions..."
                  className="input-base mt-3 text-xs"
                  rows={2}
                />
              </div>
              <div className="p-4" style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div className="flex justify-between mb-3">
                  <span className="text-sm text-gray-500">Order Total</span>
                  <span className="text-lg font-black text-green-700">{formatCurrency(total)}</span>
                </div>
                <button onClick={sendKOT} className="btn-primary w-full justify-center py-3">
                  <ChefHat size={16} />
                  Send to Kitchen (KOT)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code generator stacked on top */}
      {showQR && (
        <QRModal table={table} onClose={() => setShowQR(false)} />
      )}

      {/* Transfer modal stacked on top */}
      {showTransfer && (
        <TransferModal 
          currentTable={table} 
          availableTables={availableTables} 
          onClose={() => setShowTransfer(false)}
          onTransfer={(newTable) => {
             // Save any edits before transferring
             const orderWithWaiter = { ...order, waiter }
             updateTable(table.id, { order: orderWithWaiter, waiter })
             // Execute transfer
             transferTable(table.id, newTable.id)
             setShowTransfer(false)
             onClose() // Close modal so user can reopen new table
             toast.success(`Guests moved from Table ${table.number} to Table ${newTable.number}`)
          }}
        />
      )}

      {/* Settle / Payment modal stacked on top */}
      {showSettle && (
        <SettleModal
          table={table}
          order={currentOrder.items.length ? currentOrder : (table.order || { items: [], waiter: '' })}
          onClose={() => setShowSettle(false)}
          onPaid={(paymentInfo) => {
            setShowSettle(false)
            onSettle(currentOrder.items.length ? currentOrder : (table.order || { items: [], waiter: '' }), paymentInfo)
          }}
        />
      )}
    </>
  )
}

// ─── Kitchen Board ─────────────────────────────────────────────────────────────
function KOTBoard({ kots, updateKOTStatus }) {
  const toast = useToast()
  const pending = kots.filter((k) => k.status === 'pending')
  const preparing = kots.filter((k) => k.status === 'preparing')
  const ready = kots.filter((k) => k.status === 'ready')

  const advance = (kot) => {
    const next = kot.status === 'pending' ? 'preparing' : kot.status === 'preparing' ? 'ready' : 'done'
    updateKOTStatus(kot.id, next)
    if (next === 'ready') toast.success(`Table ${kot.tableNumber} order is ready!`)
  }

  const cols = [
    { label: '⏳ Pending', items: pending, color: '#f59e0b', next: 'Start Cooking' },
    { label: '🍳 Preparing', items: preparing, color: '#3b82f6', next: 'Mark Ready' },
    { label: '✅ Ready', items: ready, color: '#16a34a', next: 'Delivered' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {cols.map((col) => (
        <div key={col.label} className="flex flex-col">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-sm font-bold"
            style={{ background: `${col.color}18`, color: col.color }}
          >
            {col.label}
            <span className="ml-auto bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
              {col.items.length}
            </span>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto">
            {col.items.map((kot) => (
              <div key={kot.id} className="card p-3 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-900 text-sm">Table {kot.tableNumber}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(kot.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {kot.items.map((i) => (
                  <p key={i.id} className="text-xs text-gray-600">{i.qty}× {i.name}</p>
                ))}
                {kot.notes && <p className="text-xs text-amber-600 mt-1 italic">"{kot.notes}"</p>}
                {kot.waiter && <p className="text-xs text-gray-400 mt-1">👤 {kot.waiter}</p>}
                <button
                  onClick={() => advance(kot)}
                  className="btn-primary w-full justify-center mt-3 py-1.5 text-xs"
                >
                  {col.next}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Tables Page ─────────────────────────────────────────────────────────
export default function Tables() {
  const { tables, kots, updateTable, addKOT, updateKOTStatus, clearTable } = useTableStore()
  const { addSale } = useSalesStore()
  const { businessInfo, taxSettings } = useAppStore()
  const toast = useToast()

  const [selectedTable, setSelectedTable] = useState(null)
  const [actionTable, setActionTable] = useState(null)
  const [view, setView] = useState('tables')
  const [completedSale, setCompletedSale] = useState(null)  // for showing receipt

  const stats = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
    pendingKOTs: kots.filter((k) => k.status === 'pending').length,
  }

  // Called from OrderModal after the payment is confirmed
  const handleSettle = (order, paymentInfo) => {
    const { method, cashGiven, change, subtotal, tax, serviceCharge, total } = paymentInfo
    const receiptNo = generateReceiptNumber()

    const saleData = {
      receiptNo,
      date: new Date(),
      cartItems: order.items.map((i) => ({ ...i, salePrice: i.price })),
      items: order.items.reduce((s, i) => s + i.qty, 0),
      subtotal,
      discount: 0,
      tax,
      serviceCharge: serviceCharge || 0,
      total,
      paymentMethod: method,
      change,
      cashier: order.waiter || 'Waiter',
      tableNumber: selectedTable?.number,
      source: 'restaurant',
      status: 'completed',
    }

    // Record in central sales store
    addSale(saleData)

    // Clear the table
    clearTable(selectedTable.id)

    // Close the order modal
    setSelectedTable(null)

    // Show receipt
    setCompletedSale({ ...saleData, waiter: order.waiter, tableNumber: selectedTable?.number })

    toast.success(
      `Table ${selectedTable?.number} settled! ${formatCurrency(total)} via ${method}`,
      { duration: 4000, title: '🎉 Sale Recorded' }
    )
  }

  const handleTableClick = (table) => {
    if (table.status === 'available' || table.status === 'reserved') {
      setActionTable(table)
    } else {
      setSelectedTable(table)
    }
  }

  const handleOpenTable = (guests) => {
    const sessionId = uuidv4()
    updateTable(actionTable.id, { status: 'occupied', guests, sessionId })
    setSelectedTable({ ...actionTable, status: 'occupied', guests, sessionId })
    setActionTable(null)
  }

  const handleReserveTable = () => {
    updateTable(actionTable.id, { status: 'reserved' })
    setActionTable(null)
    toast.success(`Table ${actionTable.number} reserved`)
  }

  const handleCancelReserve = () => {
    updateTable(actionTable.id, { status: 'available' })
    setActionTable(null)
    toast.success(`Reservation for Table ${actionTable.number} cancelled`)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <SectionHeader
          title="Table Management"
          subtitle="Restaurant floor plan & kitchen orders"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => setView('tables')}
                className={cn('btn-ghost', view === 'tables' && 'bg-green-50 text-green-700 border-green-200')}
              >
                <Utensils size={14} /> Floor Plan
              </button>
              <button
                onClick={() => setView('kitchen')}
                className={cn('btn-ghost relative', view === 'kitchen' && 'bg-green-50 text-green-700 border-green-200')}
              >
                <ChefHat size={14} /> Kitchen Board
                {stats.pendingKOTs > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                    {stats.pendingKOTs}
                  </span>
                )}
              </button>
            </div>
          }
        />
        <div className="flex gap-3 mb-4">
          {[
            { label: 'Available', value: stats.available, color: '#16a34a' },
            { label: 'Occupied', value: stats.occupied, color: '#dc2626' },
            { label: 'Reserved', value: stats.reserved, color: '#d97706' },
            { label: 'Pending KOTs', value: stats.pendingKOTs, color: '#7c3aed' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: `${s.color}12`, color: s.color, border: `1px solid ${s.color}30` }}
            >
              <span className="text-xl font-black">{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {view === 'tables' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {tables.map((t) => (
              <TableCard key={t.id} table={t} onClick={handleTableClick} />
            ))}
          </div>
        ) : (
          <KOTBoard kots={kots} updateKOTStatus={updateKOTStatus} />
        )}
      </div>

      {/* Action prompt before opening/reserving table */}
      {actionTable && (
        <TableActionModal 
          table={actionTable} 
          onOpen={handleOpenTable} 
          onReserve={handleReserveTable}
          onCancelReserve={handleCancelReserve}
          onClose={() => setActionTable(null)} 
        />
      )}

      {/* Order modal */}
      {selectedTable && (
        <OrderModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onSettle={handleSettle}
        />
      )}

      {/* Receipt modal after payment */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          businessInfo={businessInfo}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  )
}
