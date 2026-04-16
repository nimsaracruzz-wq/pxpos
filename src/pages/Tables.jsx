import React, { useState } from 'react'
import { Utensils, ChefHat, X, Banknote, CreditCard, Split, Receipt as ReceiptIcon, ShoppingBag, Clock, CheckCircle2, QrCode, Settings2, Plus, Minus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useSalesStore, useAppStore, useProductStore, useTableStore, useActivityStore, useAuthStore, useRecipeStore } from '@/store'
import { Badge, SectionHeader } from '@/components/ui'
import { cn, formatCurrency, generateReceiptNumber } from '@/lib/utils'
import ReceiptModal from '@/components/Receipt'
import { v4 as uuidv4 } from 'uuid'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRightLeft } from 'lucide-react'
import { clearTableQrSession, publishPOSOrderToQRCodeHistory, publishTableQrSession, updateQRCodeOrderStatus } from '@/lib/firebase'

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

  const computedSubtotal = (order.items || []).reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0)
  const hasSubtotal = Number.isFinite(Number(order?.subtotal))
  const hasTax = Number.isFinite(Number(order?.tax))
  const hasServiceCharge = Number.isFinite(Number(order?.serviceCharge))
  const hasTotal = Number.isFinite(Number(order?.total))

  const subtotal = hasSubtotal ? Number(order.subtotal) : computedSubtotal
  const taxRate = taxSettings.enabled ? taxSettings.rate : 0
  const tax = hasTax ? Number(order.tax) : (subtotal * taxRate) / 100
  
  const scRate = serviceChargeSettings?.enabled ? serviceChargeSettings.rate : 0
  const serviceChargeAmount = hasServiceCharge ? Number(order.serviceCharge) : (subtotal * scRate) / 100

  const total = hasTotal ? Number(order.total) : (subtotal + tax + serviceChargeAmount)

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
        className="animate-fade-in bg-white dark:bg-zinc-900 border dark:border-zinc-800"
        style={{
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Settle Bill — Table {table.number}</h2>
            {order.waiter && <p className="text-sm text-gray-500">Waiter: {order.waiter}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Order summary */}
        <div
          className="rounded-2xl p-4 mb-5 bg-[#f8fffe] dark:bg-emerald-950/10 border border-[#dcfce7] dark:border-emerald-900/30"
        >
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Order Summary</p>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-700 dark:text-zinc-200">
                <span className="text-green-700 dark:text-green-500 font-bold">{item.qty}×</span> {item.name}
              </span>
              <span className="font-semibold text-gray-800 dark:text-zinc-100">{formatCurrency(item.price * item.qty)}</span>
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
          className="rounded-2xl p-5 text-center mb-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-emerald-900/20 border dark:border-green-900/30"
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
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600'
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
  const { taxSettings, serviceChargeSettings } = useAppStore()
  const itemSubtotal = table.order?.items?.reduce((s, i) => s + i.price * i.qty, 0) || 0
  const subtotal = table.order?.subtotal ?? itemSubtotal
  const tax = table.order?.tax ?? ((subtotal * (taxSettings.enabled ? taxSettings.rate : 0)) / 100)
  const serviceCharge = table.order?.serviceCharge ?? ((subtotal * (serviceChargeSettings?.enabled ? serviceChargeSettings.rate : 0)) / 100)
  const grandTotal = table.order?.total ?? (subtotal + tax + serviceCharge)
  return (
    <button
      onClick={() => onClick(table)}
      className={cn("text-left transition-all duration-200 hover:scale-105 focus:outline-none border-2",
        table.status === 'available' ? 'bg-[#f0fdf4] dark:bg-green-900/10 border-[#86efac] dark:border-green-900/30' :
        table.status === 'occupied' ? 'bg-[#fef2f2] dark:bg-red-900/10 border-[#fca5a5] dark:border-red-900/30' :
        'bg-[#fffbeb] dark:bg-yellow-900/10 border-[#fde68a] dark:border-yellow-900/30'
      )}
      style={{ borderRadius: 16, padding: 16, cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-black text-gray-900 dark:text-zinc-100">T{table.number}</p>
          <p className="text-xs text-gray-500">{table.seats} seats</p>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>
      {table.status === 'occupied' ? (
        <div>
          <p className="text-xs text-gray-500">{table.order?.items?.length || 0} items</p>
          <p className="text-xs text-gray-400 mt-0.5">Grand total</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(grandTotal)}</p>
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
      <div className="animate-fade-in card p-8 flex flex-col items-center bg-white dark:bg-zinc-900" style={{ width: 340 }}>
        <h2 className="text-xl font-black text-gray-800 dark:text-zinc-100 mb-1">
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

  const configuredBase = (import.meta.env.VITE_PUBLIC_MENU_BASE_URL || '').trim()
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const fallbackOrigin = browserOrigin && !browserOrigin.startsWith('file://') ? browserOrigin : 'http://localhost:5173'
  const baseOrigin = (configuredBase || fallbackOrigin).replace(/\/$/, '')
  const storeKey = (businessInfo.storeId || '').trim() // Use random store ID, not tax ID
  const storeId = encodeURIComponent(storeKey)
  const tableQuery = encodeURIComponent(String(table.number || ''))
  const sessionQuery = encodeURIComponent(String(table.sessionId || `table-${table.number || 'na'}`))
  const guestsQuery = encodeURIComponent(String(table.guests || ''))
  const tokenQuery = encodeURIComponent(String(table.qrToken || ''))
  const menuUrl = `${baseOrigin}/menu/${storeId}?table=${tableQuery}&session=${sessionQuery}&guests=${guestsQuery}&token=${tokenQuery}`
  const needsLanHint = /localhost|127\.0\.0\.1/i.test(baseOrigin)
  const missingStoreId = !storeKey

  const downloadQr = async () => {
    if (missingStoreId) {
      toast.error('Store ID not initialized. Please restart the app.')
      return
    }

    const qrSvg = document.querySelector('[data-table-qr="true"] svg')
    if (!qrSvg) {
      toast.error('QR image not ready yet')
      return
    }

    try {
      const serializer = new XMLSerializer()
      const svgMarkup = serializer.serializeToString(qrSvg)
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(svgUrl)
          toast.error('Failed to prepare QR download')
          return
        }

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0)

        const pngUrl = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `table-${table.number}-qr.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(svgUrl)
        toast.success(`Table ${table.number} QR downloaded`)
      }

      image.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        toast.error('Unable to generate QR download')
      }

      image.src = svgUrl
    } catch (error) {
      toast.error('Unable to download QR')
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-fade-in card p-8 flex flex-col items-center bg-white dark:bg-zinc-900" style={{ width: 340 }}>
        <h2 className="text-xl font-black text-gray-800 dark:text-zinc-100 mb-1">Table {table.number} QR</h2>
        <p className="text-sm text-gray-500 mb-5 text-center">Scan to open digital menu</p>
        {missingStoreId && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-center">
            Store ID not initialized. Please restart the app.
          </p>
        )}
        
        <div data-table-qr="true" className="p-4 bg-white rounded-3xl mb-6 shadow-[0px_8px_30px_rgba(0,0,0,0.08)] flex justify-center w-full relative">
          <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center border-4 border-white">
            <QrCode size={12} />
          </div>
          <QRCodeSVG value={missingStoreId ? 'about:blank' : menuUrl} size={200} level="H" />
        </div>

        {!missingStoreId && (
          <p className="text-[11px] text-gray-500 break-all bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3 w-full text-center">
            {menuUrl}
          </p>
        )}

        {needsLanHint && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 text-center">
            For mobile testing, set VITE_PUBLIC_MENU_BASE_URL to your PC LAN IP (example: http://192.168.1.20:5173).
          </p>
        )}

        <button
          className="btn-primary w-full justify-center mb-2"
          disabled={missingStoreId}
          onClick={downloadQr}
        >
          Download QR
        </button>
        
        <button 
          className="btn-secondary w-full justify-center mb-2" 
          disabled={missingStoreId}
          onClick={() => {
            if (missingStoreId) {
              toast.error('Store ID not initialized. Please restart the app.')
              return
            }
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
      <div className="animate-fade-in card p-6 max-w-lg w-full max-h-[80vh] flex flex-col bg-white dark:bg-zinc-900">
        <div className="flex justify-between items-center mb-5 border-b dark:border-zinc-800 pb-3">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-zinc-100">
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
                 className="p-4 border-2 border-gray-100 dark:border-zinc-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors flex flex-col items-center" 
                 onClick={() => onTransfer(t)}
               >
                 <p className="font-black text-xl text-gray-800 dark:text-zinc-100">T{t.number}</p>
                 <p className="text-xs text-gray-500 mt-1">{t.seats} seats</p>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TableManagerModal({ tables, onAdd, onEdit, onDelete, onClose }) {
  const [form, setForm] = useState({ number: '', seats: '4' })
  const [editingId, setEditingId] = useState('')
  const [editDraft, setEditDraft] = useState({ number: '', seats: '' })

  const sorted = [...tables].sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
  const availableCount = tables.filter((t) => t.status === 'available').length
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length
  const reservedCount = tables.filter((t) => t.status === 'reserved').length

  const submitAdd = () => {
    const ok = onAdd({ number: Number(form.number || 0), seats: Number(form.seats || 0) })
    if (!ok) return
    setForm({ number: '', seats: '4' })
  }

  const beginEdit = (table) => {
    setEditingId(table.id)
    setEditDraft({ number: String(table.number || ''), seats: String(table.seats || '') })
  }

  const submitEdit = () => {
    if (!editingId) return
    const ok = onEdit(editingId, { number: Number(editDraft.number || 0), seats: Number(editDraft.seats || 0) })
    if (!ok) return
    setEditingId('')
    setEditDraft({ number: '', seats: '' })
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 130 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-fade-in card p-6 max-w-2xl w-full max-h-[86vh] flex flex-col bg-white dark:bg-zinc-900">
        <div className="flex justify-between items-center mb-4 border-b dark:border-zinc-800 pb-3">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-zinc-100">
            <Settings2 size={18} className="text-green-600" />
            Manage Tables
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs text-emerald-700">Available</p>
            <p className="text-lg font-black text-emerald-700">{availableCount}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-700">Occupied</p>
            <p className="text-lg font-black text-red-700">{occupiedCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">Reserved</p>
            <p className="text-lg font-black text-amber-700">{reservedCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-zinc-700 p-3 mb-4 bg-gray-50/70 dark:bg-zinc-800/40">
          <p className="text-xs font-semibold text-gray-500 mb-2">Add New Table</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              min="1"
              className="input-base"
              placeholder="Table #"
              value={form.number}
              onChange={(e) => setForm((s) => ({ ...s, number: e.target.value }))}
            />
            <input
              type="number"
              min="1"
              className="input-base"
              placeholder="Seats"
              value={form.seats}
              onChange={(e) => setForm((s) => ({ ...s, seats: e.target.value }))}
            />
            <button onClick={submitAdd} className="btn-primary w-full justify-center" disabled={!form.number || !form.seats}>
              <Plus size={14} /> Add Table
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {sorted.map((table) => {
            const locked = table.status !== 'available'
            const isEditing = editingId === table.id
            const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available
            return (
              <div key={table.id} className="p-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-zinc-100">Table {table.number}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500">{table.seats} seats</p>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                    {locked && !isEditing && (
                      <p className="text-[11px] text-amber-600 mt-1">Unlock table (set to available) to edit or delete.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => beginEdit(table)}
                          disabled={locked}
                          className="btn-ghost px-2 py-1 text-xs"
                          title={locked ? 'Only available tables can be edited' : 'Edit table'}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => onDelete(table.id)}
                          disabled={locked}
                          className="btn-danger px-2 py-1 text-xs"
                          title={locked ? 'Only available tables can be deleted' : 'Delete table'}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={submitEdit} className="btn-primary px-2 py-1 text-xs">Save</button>
                        <button onClick={() => setEditingId('')} className="btn-ghost px-2 py-1 text-xs">Cancel</button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <input
                      type="number"
                      min="1"
                      className="input-base"
                      placeholder="Table #"
                      value={editDraft.number}
                      onChange={(e) => setEditDraft((s) => ({ ...s, number: e.target.value }))}
                    />
                    <input
                      type="number"
                      min="1"
                      className="input-base"
                      placeholder="Seats"
                      value={editDraft.seats}
                      onChange={(e) => setEditDraft((s) => ({ ...s, seats: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Order Modal ───────────────────────────────────────────────────────────────
function OrderModal({ table, onClose, onSettle }) {
  const { tables, updateTable, addKOT, transferTable, clearTable } = useTableStore()
  const { taxSettings, serviceChargeSettings, businessInfo } = useAppStore()
  const { products } = useProductStore()
  const { currentUser } = useAuthStore()
  const { addLog } = useActivityStore()
  const toast = useToast()
  
  const restaurantProducts = products.filter(p => p.active && p.module === 'restaurant')

  const [activeCategory, setActiveCategory] = useState('All')
  const [order, setOrder] = useState(table.order || { items: [] })
  const [waiter, setWaiter] = useState(table.waiter || '')
  const [notes, setNotes] = useState(table.order?.notes || '')
  const [showSettle, setShowSettle] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  const categories = ['All', ...new Set(restaurantProducts.map((k) => k.category).filter(Boolean))]
  const filtered = activeCategory === 'All' ? restaurantProducts : restaurantProducts.filter((i) => i.category === activeCategory)

  const computeTotals = (items = []) => {
    const safeItems = Array.isArray(items) ? items : []
    const subtotalValue = safeItems.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0)
    const taxValue = (subtotalValue * (taxSettings.enabled ? Number(taxSettings.rate || 0) : 0)) / 100
    const serviceChargeValue = (subtotalValue * (serviceChargeSettings?.enabled ? Number(serviceChargeSettings.rate || 0) : 0)) / 100
    return {
      subtotal: subtotalValue,
      tax: taxValue,
      serviceCharge: serviceChargeValue,
      total: subtotalValue + taxValue + serviceChargeValue,
    }
  }
  
  const availableTables = tables.filter(t => t.status === 'available')
  const effectiveItems = order.items.length ? order.items : (table.order?.items || [])
  const { subtotal: effectiveSubtotal, tax: effectiveTax, serviceCharge: effectiveServiceCharge, total: effectiveTotal } = computeTotals(effectiveItems)

  const addToOrder = (item) => {
    setOrder((o) => {
      const ex = o.items.find((i) => i.id === item.id)
      const currentQty = Number(ex?.qty || 0)
      const stock = Number(item?.stock ?? 0)
      if (stock <= currentQty) {
        toast.error(`${item.name} is out of stock`)
        return o
      }
      if (ex) return { ...o, items: o.items.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) }
      return { ...o, items: [...o.items, { ...item, qty: 1 }] }
    })
  }
  const removeFromOrder = (id) => setOrder((o) => ({ ...o, items: o.items.filter((i) => i.id !== id) }))

  const updateOrderQty = (id, newQty) => {
    if (newQty < 1) {
      removeFromOrder(id)
      return
    }
    const product = restaurantProducts.find((p) => p.id === id)
    const stock = Number(product?.stock ?? 0)
    if (newQty > stock) {
      toast.error(`${product?.name || 'Item'} has only ${stock} in stock`)
      return
    }
    setOrder((o) => ({ ...o, items: o.items.map((i) => i.id === id ? { ...i, qty: newQty } : i) }))
  }

  const { subtotal, tax, serviceCharge, total: grandTotal } = computeTotals(order.items)

  const sendKOT = async () => {
    if (!order.items.length) { toast.error('Add items first'); return }
    const normalizedNotes = (notes || '').trim()
    const latestTableState = useTableStore.getState().tables.find((t) => t.id === table.id)
    const savedItems = Array.isArray(latestTableState?.order?.items) ? latestTableState.order.items : []
    const currentItems = Array.isArray(order.items) ? order.items : []

    const mergeKey = (item) => `${String(item.id || item.name || 'x')}::${JSON.stringify(item.customization || {})}`
    const mergedMap = new Map()

    savedItems.forEach((item) => {
      const key = mergeKey(item)
      mergedMap.set(key, {
        ...item,
        qty: Number(item.qty || 0),
        price: Number(item.price || item.salePrice || 0),
        salePrice: Number(item.salePrice || item.price || 0),
      })
    })

    currentItems.forEach((item) => {
      const key = mergeKey(item)
      const normalized = {
        ...item,
        qty: Number(item.qty || 0),
        price: Number(item.price || item.salePrice || 0),
        salePrice: Number(item.salePrice || item.price || 0),
      }
      const existing = mergedMap.get(key)
      if (!existing) {
        mergedMap.set(key, normalized)
        return
      }

      // Keep the higher qty to avoid accidental total drops from stale local state.
      mergedMap.set(key, {
        ...existing,
        ...normalized,
        qty: Math.max(Number(existing.qty || 0), Number(normalized.qty || 0)),
      })
    })

    const mergedItems = Array.from(mergedMap.values()).filter((item) => Number(item.qty || 0) > 0)
    const totals = computeTotals(mergedItems)
    const existingQrIds = Array.isArray(order?.qrOrderIds)
      ? order.qrOrderIds.map((id) => String(id)).filter(Boolean)
      : (order?.qrOrderId ? [String(order.qrOrderId)] : [])

    let nextQrIds = existingQrIds
    if (businessInfo?.taxId && table?.number && table?.sessionId && table?.qrToken) {
      const publishResult = await publishPOSOrderToQRCodeHistory({
        storeId: businessInfo.taxId,
        tableNumber: table.number,
        session: table.sessionId,
        token: table.qrToken,
        guests: Number(table.guests || 0),
        customerName: waiter || 'Table Service',
        notes: normalizedNotes,
        items: mergedItems.map((i) => ({
          id: i.id,
          name: i.name,
          price: Number(i.price || i.salePrice || 0),
          salePrice: Number(i.salePrice || i.price || 0),
          qty: Number(i.qty || 0),
          category: i.category || '',
          customization: i.customization || null,
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        serviceCharge: totals.serviceCharge,
        total: totals.total,
        status: 'accepted',
        processedBy: 'desktop-pos',
      })

      if (publishResult?.success && publishResult.id) {
        nextQrIds = Array.from(new Set([...existingQrIds, String(publishResult.id)]))
      }
    }

    const orderWithWaiter = {
      ...order,
      ...totals,
      items: mergedItems,
      waiter,
      notes: normalizedNotes,
      qrOrderIds: nextQrIds,
      qrOrderId: nextQrIds.length ? nextQrIds[nextQrIds.length - 1] : order?.qrOrderId,
      storeId: order?.storeId || (businessInfo?.taxId || ''),
      source: order?.source || 'pos',
    }
    addKOT({ tableId: table.id, tableNumber: table.number, items: mergedItems, notes: normalizedNotes, waiter })
    updateTable(table.id, { status: 'occupied', order: orderWithWaiter, waiter })
    addLog(
      'Sent KOT',
      `Table ${table.number}: ${mergedItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)} items, Total ${formatCurrency(totals.total)}`,
      currentUser?.name || waiter || 'System'
    )
    toast.success(`KOT sent to kitchen for Table ${table.number}`)
    onClose()
  }

  // The current order to settle: prefer live edits, otherwise table's saved order
  const currentOrderItems = order.items.length ? order.items : (table.order?.items || [])
  const currentTotals = computeTotals(currentOrderItems)
  const currentOrder = { ...order, ...currentTotals, items: currentOrderItems, waiter, notes: (notes || '').trim() }

  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div
          className="animate-fade-in bg-white dark:bg-zinc-900"
          style={{
            borderRadius: 20, width: '90vw', maxWidth: 860,
            maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <Utensils size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-zinc-100">Table {table.number}</h2>
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
              {table.status === 'occupied' && (
                <button
                  onClick={() => {
                    if (effectiveTotal > 0) {
                      toast.error('Cannot clear table while amount is above 0. Settle payment first.')
                      return
                    }
                    clearTable(table.id)
                    toast.success(`Table ${table.number} cleared`)
                    onClose()
                  }}
                  className="btn-ghost"
                  title="Clear table when amount is 0"
                >
                  Clear Table
                </button>
              )}
              <button onClick={onClose} className="btn-ghost p-2"><X size={16} /></button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Menu panel */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100 dark:border-zinc-800">
              <div className="px-4 py-3 flex gap-2 flex-wrap border-b border-gray-100 dark:border-zinc-800">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all border dark:border-zinc-700',
                      activeCategory === c ? 'bg-green-600 border-transparent text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
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
                  const stock = Number(item.stock ?? 0)
                  const outOfStock = stock <= 0
                  return (
                    <button
                      key={item.id}
                      disabled={outOfStock}
                      onClick={() => addToOrder(item)}
                      className={cn(
                        'pos-product-btn relative',
                        inOrder && 'border-green-400 bg-green-50',
                        outOfStock && 'opacity-45 cursor-not-allowed grayscale'
                      )}
                    >
                      {inOrder && (
                        <span
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: '#16a34a' }}
                        >
                          {inOrder.qty}
                        </span>
                      )}
                      {outOfStock && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide">
                          Out
                        </span>
                      )}
                      <div className="text-2xl mb-1">
                        {item.category === 'Mains' ? '🍽️' : item.category === 'Starters' ? '🥗' : item.category === 'Drinks' ? '🥤' : item.category === 'Pizzas' ? '🍕' : item.category === 'Desserts' ? '🍰' : '🍲'}
                      </div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-100 leading-tight">{item.name}</p>
                      <p className="text-sm font-bold text-green-700 dark:text-green-400 mt-1">{formatCurrency(item.price)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Stock: {stock}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Order panel */}
            <div className="flex flex-col" style={{ width: 280 }}>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ChefHat size={14} className="text-green-600 dark:text-green-400" />
                  <p className="text-sm font-bold text-gray-700 dark:text-zinc-100">Current Order</p>
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
                      <div key={item.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <span className="font-bold text-green-700 dark:text-green-400 w-5 text-center">{item.qty}×</span>
                        <span className="flex-1 text-gray-700 dark:text-zinc-300 text-xs">{item.name}</span>
                        <span className="font-semibold text-gray-800 dark:text-zinc-100 text-xs">{formatCurrency(item.price * item.qty)}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateOrderQty(item.id, item.qty - 1)}
                            className="p-1 rounded-md text-red-400 hover:bg-red-100 transition-all active:scale-90"
                            title="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-gray-700">{item.qty}</span>
                          <button
                            onClick={() => updateOrderQty(item.id, item.qty + 1)}
                            className="p-1 rounded-md text-green-600 hover:bg-green-100 transition-all active:scale-90"
                            title="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromOrder(item.id)} 
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-100 transition-all active:scale-90"
                          title="Remove item from order"
                        >
                          <Trash2 size={14} />
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
              <div className="p-4 bg-gray-50 dark:bg-zinc-800/30 border-t border-gray-100 dark:border-zinc-800">
                <div className="space-y-1.5 mb-3 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {serviceCharge > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>{serviceChargeSettings?.name || 'Service Charge'}</span>
                      <span>{formatCurrency(serviceCharge)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>{taxSettings?.name || 'Tax'}</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-dashed border-gray-200 dark:border-zinc-700">
                    <span className="text-sm font-semibold text-gray-500">Grand Total</span>
                    <span className="text-lg font-black text-green-700">{formatCurrency(grandTotal)}</span>
                  </div>
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
             const transferringItems = order.items.length ? order.items : (table.order?.items || [])
             const totals = computeTotals(transferringItems)
             const orderWithWaiter = { ...order, ...totals, items: transferringItems, waiter, notes: (notes || '').trim() }
             updateTable(table.id, { order: orderWithWaiter, waiter })
             const movedSession = String(table.sessionId || '').trim()
             const movedToken = String(table.qrToken || '').trim()
             const movedGuests = Number(table.guests || 0)
             // Execute transfer
             transferTable(table.id, newTable.id)
             if (businessInfo?.storeId && movedSession && movedToken) {
               publishTableQrSession(businessInfo.storeId, newTable.number, movedSession, movedToken, { guests: movedGuests })
               clearTableQrSession(businessInfo.storeId, table.number, {
                 status: 'moved',
                 movedToTable: String(newTable.number),
                 session: movedSession,
                 token: movedToken,
                 guests: movedGuests,
               })
             }
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

  const advance = async (kot) => {
    const next = kot.status === 'pending' ? 'preparing' : kot.status === 'preparing' ? 'ready' : 'done'
    updateKOTStatus(kot.id, next)
    if (kot.qrOrderId && kot.storeId) {
      const mapped = next === 'done' ? 'completed' : next
      await updateQRCodeOrderStatus(kot.storeId, kot.qrOrderId, mapped)
    }
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-sm font-bold border dark:border-white/5"
            style={{ background: `${col.color}15`, color: col.color }}
          >
            {col.label}
            <span className="ml-auto bg-white dark:bg-black/20 rounded-full w-6 h-6 flex items-center justify-center text-xs">
              {col.items.length}
            </span>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto">
            {col.items.map((kot) => (
              <div key={kot.id} className="card p-3 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Table {kot.tableNumber}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(kot.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {kot.items.map((i) => (
                  <p key={i.id} className="text-xs text-gray-600">{i.qty}× {i.name}</p>
                ))}
                {!!(kot.notes && String(kot.notes).trim()) && (
                  <p className="text-xs text-amber-600 mt-1 italic whitespace-pre-wrap">"{String(kot.notes).trim()}"</p>
                )}
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
  const { tables, kots, updateTable, addKOT, updateKOTStatus, clearTable, addTable, editTable, deleteTable } = useTableStore()
  const { addSale } = useSalesStore()
  const { products, adjustStock } = useProductStore()
  const { deductIngredients } = useRecipeStore()
  const { businessInfo, taxSettings, serviceChargeSettings } = useAppStore()
  const { currentUser } = useAuthStore()
  const { addLog } = useActivityStore()
  const toast = useToast()

  const [selectedTable, setSelectedTable] = useState(null)
  const [actionTable, setActionTable] = useState(null)
  const [view, setView] = useState('tables')
  const [completedSale, setCompletedSale] = useState(null)  // for showing receipt
  const [showManageTables, setShowManageTables] = useState(false)

  const stats = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
    pendingKOTs: kots.filter((k) => k.status === 'pending').length,
  }

  // Called from OrderModal after the payment is confirmed
  const handleSettle = async (order, paymentInfo) => {
    const insufficient = (order?.items || []).find((item) => {
      const product = products.find((p) => p.id === item.id)
      return product && Number(product.stock || 0) < Number(item.qty || 0)
    })
    if (insufficient) {
      const product = products.find((p) => p.id === insufficient.id)
      toast.error(`Insufficient stock for ${product?.name || insufficient.name}`)
      return
    }

    const { method, cashGiven, change, subtotal, tax, serviceCharge, total } = paymentInfo
    const receiptNo = generateReceiptNumber()
    const receiptNotes = order?.source === 'web' || order?.source === 'qr' || order?.qrOrderId ? '' : (order.notes || '')

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
      notes: receiptNotes,
    }

    // Record in central sales store
    addSale(saleData)

    // Always deduct menu item stock for restaurant table sales.
    order.items.forEach((item) => {
      adjustStock(item.id, -Number(item.qty || 0))
    })

    // Also deduct ingredient stock when recipes are configured.
    order.items.forEach((item) => {
      const result = deductIngredients(item.id, Number(item.qty || 0))
      if (!result?.success) {
        console.warn(`Failed to deduct ingredients for ${item.name}:`, result?.message)
      }
    })

    const qrOrderIds = Array.isArray(order?.qrOrderIds)
      ? order.qrOrderIds.map((id) => String(id)).filter(Boolean)
      : (order?.qrOrderId ? [String(order.qrOrderId)] : [])

    if (order?.storeId && qrOrderIds.length) {
      await Promise.all(
        qrOrderIds.map((qrOrderId) =>
          updateQRCodeOrderStatus(order.storeId, qrOrderId, 'completed')
        )
      )
    }

    if (businessInfo?.storeId && selectedTable?.number) {
      clearTableQrSession(businessInfo.storeId, selectedTable.number)
    }

    // Clear the table
    clearTable(selectedTable.id)

    // Close the order modal
    setSelectedTable(null)

    // Show receipt
    setCompletedSale({ ...saleData, waiter: order.waiter, tableNumber: selectedTable?.number })

    addLog(
      'Settled Table Bill',
      `Table ${selectedTable?.number}: ${formatCurrency(total)} via ${method}`,
      currentUser?.name || order.waiter || 'System'
    )

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
    if (!actionTable) return
    const sessionId = uuidv4()
    const qrToken = uuidv4()
    const emptyOrder = { items: [], waiter: '', notes: '', subtotal: 0, tax: 0, serviceCharge: 0, total: 0 }
    updateTable(actionTable.id, { status: 'occupied', guests, sessionId, qrToken, order: emptyOrder })
    setSelectedTable({ ...actionTable, status: 'occupied', guests, sessionId, qrToken, order: emptyOrder })
    publishTableQrSession(businessInfo?.storeId, actionTable.number, sessionId, qrToken, { guests })
    addLog('Opened Table', `Table ${actionTable.number} opened for ${guests} guests`, currentUser?.name || 'System')
    setActionTable(null)
  }

  const handleReserveTable = () => {
    updateTable(actionTable.id, { status: 'reserved' })
    addLog('Reserved Table', `Table ${actionTable.number} reserved`, currentUser?.name || 'System')
    setActionTable(null)
    toast.success(`Table ${actionTable.number} reserved`)
  }

  const handleCancelReserve = () => {
    updateTable(actionTable.id, { status: 'available' })
    addLog('Cancelled Reservation', `Table ${actionTable.number} reservation cancelled`, currentUser?.name || 'System')
    setActionTable(null)
    toast.success(`Reservation for Table ${actionTable.number} cancelled`)
  }

  const handleAddTable = ({ number, seats }) => {
    if (!Number.isFinite(number) || number <= 0 || !Number.isFinite(seats) || seats <= 0) {
      toast.error('Enter a valid table number and seats')
      return false
    }
    const exists = tables.some((t) => Number(t.number) === Number(number))
    if (exists) {
      toast.error(`Table ${number} already exists`)
      return false
    }
    addTable({ number: Number(number), seats: Number(seats), status: 'available' })
    toast.success(`Table ${number} added`)
    return true
  }

  const handleEditTable = (id, updates) => {
    const table = tables.find((t) => t.id === id)
    if (!table) return false
    if (table.status !== 'available') {
      toast.error('Only available tables can be edited')
      return false
    }
    const nextNumber = Number(updates.number || 0)
    const nextSeats = Number(updates.seats || 0)
    if (!Number.isFinite(nextNumber) || nextNumber <= 0 || !Number.isFinite(nextSeats) || nextSeats <= 0) {
      toast.error('Enter a valid table number and seats')
      return false
    }
    const duplicate = tables.some((t) => t.id !== id && Number(t.number) === nextNumber)
    if (duplicate) {
      toast.error(`Table ${nextNumber} already exists`)
      return false
    }
    editTable(id, { number: nextNumber, seats: nextSeats })
    toast.success(`Table ${table.number} updated`)
    return true
  }

  const handleDeleteTable = (id) => {
    const table = tables.find((t) => t.id === id)
    if (!table) return
    if (table.status !== 'available') {
      toast.error('Only available tables can be deleted')
      return
    }
    if (businessInfo?.storeId && table.number) {
      clearTableQrSession(businessInfo.storeId, table.number)
    }
    deleteTable(id)
    toast.success(`Table ${table.number} deleted`)
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
                className={cn('btn-ghost dark:text-zinc-200', view === 'tables' && 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800')}
              >
                <Utensils size={14} /> Floor Plan
              </button>
              <button
                onClick={() => setView('kitchen')}
                className={cn('btn-ghost relative dark:text-zinc-200', view === 'kitchen' && 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800')}
              >
                <ChefHat size={14} /> Kitchen Board
                {stats.pendingKOTs > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                    {stats.pendingKOTs}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowManageTables(true)}
                className="btn-ghost dark:text-zinc-200"
              >
                <Settings2 size={14} /> Manage Tables
              </button>
            </div>
          }
        />
        <div className="flex gap-3 mb-4">
          {[
            { label: 'Available', value: stats.available, colorClass: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' },
            { label: 'Occupied', value: stats.occupied, colorClass: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' },
            { label: 'Reserved', value: stats.reserved, colorClass: 'text-orange-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
            { label: 'Pending KOTs', value: stats.pendingKOTs, colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' },
          ].map((s) => (
            <div
              key={s.label}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border", s.colorClass)}
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

      {showManageTables && (
        <TableManagerModal
          tables={tables}
          onAdd={handleAddTable}
          onEdit={handleEditTable}
          onDelete={handleDeleteTable}
          onClose={() => setShowManageTables(false)}
        />
      )}
    </div>
  )
}

