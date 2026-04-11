import React from 'react'
import { X, Printer, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'IBM Plex Mono', 'Courier New', monospace; background: white; color: #111; }
  .receipt { width: 300px; margin: 0 auto; padding: 20px 16px; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .row { display: flex; justify-content: space-between; align-items: baseline; }
  .sep { border: none; border-top: 1px dashed #bbb; margin: 10px 0; }
  .sep-solid { border: none; border-top: 2px solid #111; margin: 10px 0; }
  .logo { font-size: 22px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
  .tag { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #777; }
  .total-row { font-size: 18px; font-weight: 900; }
  .total-val { color: #16a34a; }
  .item-name { font-size: 11px; }
  .item-sub { font-size: 10px; color: #555; }
  .meta { font-size: 10px; color: #666; }
  .badge { display: inline-block; padding: 2px 8px; border: 1px solid #bbb; border-radius: 4px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
  .footer-msg { font-size: 11px; color: #555; }
  .pwrd { font-size: 9px; color: #aaa; letter-spacing: 2px; text-transform: uppercase; }
  .change-box { border: 2px solid #3b82f6; border-radius: 6px; padding: 6px 10px; }
  .change-val { font-size: 16px; font-weight: 900; color: #2563eb; }
  @media print {
    body { width: 80mm; }
    .no-print { display: none; }
  }
`

// ─── Print Helper ─────────────────────────────────────────────────────────────
export function printReceiptHTML(title, bodyHtml) {
  const w = window.open('', '_blank', 'width=400,height=720')
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>${title}</title>
    <style>${PRINT_STYLES}</style>
  </head><body><div class="receipt">${bodyHtml}</div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}

// ─── Receipt Content (rendered both on screen + for print) ───────────────────
export function ReceiptContent({ sale, businessInfo, compact = false }) {
  const {
    receiptNo, date, cartItems = [], items, subtotal,
    discount = 0, tax = 0, total, paymentMethod, change = 0,
    cashier, customerName, tableNumber, source, waiter, notes,
  } = sale

  const isTable   = source === 'restaurant'
  const isTakeOut = source === 'takeout'
  const accentColor = isTable ? '#7c3aed' : isTakeOut ? '#ea580c' : '#16a34a'

  const label =
    isTable   ? `TABLE ${tableNumber} — DINE IN` :
    isTakeOut ? '🛍️ TAKE OUT' :
    '🏪 RETAIL SALE'

  const fs = compact ? 11 : 12

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace", fontSize: fs, lineHeight: 1.6 }}>
      {/* Store header */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1, color: '#111' }}>
          {businessInfo.name}
        </div>
        <div style={{ fontSize: 10, color: '#888', letterSpacing: 1 }}>
          {businessInfo.address}
        </div>
        <div style={{ fontSize: 10, color: '#888' }}>
          {businessInfo.phone}
          {businessInfo.email && ` · ${businessInfo.email}`}
        </div>
        {businessInfo.taxId && (
          <div style={{ fontSize: 9, color: '#aaa', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>
            Tax ID: {businessInfo.taxId}
          </div>
        )}
      </div>

      {/* Order type badge */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 12px',
          border: `1.5px solid ${accentColor}`,
          borderRadius: 4,
          fontSize: 9,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: accentColor,
          fontWeight: 700,
        }}>
          {label}
        </span>
      </div>

      <Dashes />

      {/* Meta row */}
      <Row label="Receipt #" value={receiptNo} />
      <Row label="Date" value={new Date(date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} />
      <Row label="Time" value={new Date(date).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })} />
      {cashier && <Row label="Cashier" value={cashier} />}
      {(waiter || customerName) && !isTakeOut && <Row label="Waiter" value={waiter || cashier} />}
      {isTakeOut && customerName && customerName !== 'Walk-in' && (
        <Row label="Customer" value={customerName} />
      )}

      <Dashes />

      {/* Items */}
      <div style={{ marginBottom: 4 }}>
        {(cartItems || []).map((item, i) => (
          <div key={i} style={{ marginBottom: 5 }}>
            <div style={{ fontWeight: 600, fontSize: fs }}>{item.name}</div>
            <RowSmall
              label={`  ${item.qty} × ${formatCurrency(item.salePrice || item.price)}`}
              value={formatCurrency((item.salePrice || item.price) * item.qty)}
            />
          </div>
        ))}
      </div>

      {notes && (
        <div style={{ fontSize: 10, color: '#b45309', fontStyle: 'italic', padding: '4px 0', borderLeft: '2px solid #fcd34d', paddingLeft: 6, marginBottom: 6 }}>
          📝 {notes}
        </div>
      )}

      <Dashes />

      {/* Totals */}
      <Row label="Subtotal" value={formatCurrency(subtotal)} />
      {discount > 0 && <Row label="Discount" value={`-${formatCurrency(discount)}`} color="#dc2626" />}
      {tax > 0 && <Row label="VAT" value={formatCurrency(tax)} />}

      <DashSolid />

      {/* Grand total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 17, fontWeight: 900, marginBottom: 6 }}>
        <span>TOTAL</span>
        <span style={{ color: '#16a34a' }}>{formatCurrency(total)}</span>
      </div>

      <Row label="Payment" value={paymentMethod?.charAt(0).toUpperCase() + paymentMethod?.slice(1) || '-'} />
      {change > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', margin: '6px 0', border: '2px solid #93c5fd', borderRadius: 6, background: '#eff6ff' }}>
          <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 11 }}>💵 Change</span>
          <span style={{ color: '#1d4ed8', fontWeight: 900, fontSize: 15 }}>{formatCurrency(change)}</span>
        </div>
      )}

      <Dashes />

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
          {isTakeOut ? 'Thank you! Come again 🙏' : 'Thank you for your business! 🙏'}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {businessInfo.phone}
        </div>
        <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: '#ccc', marginTop: 6 }}>
          Powered by Paxxmo POS
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || '#111' }}>{value}</span>
    </div>
  )
}
function RowSmall({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}
function Dashes() {
  return <div style={{ borderTop: '1px dashed #d1d5db', margin: '8px 0' }} />
}
function DashSolid() {
  return <div style={{ borderTop: '2px solid #111', margin: '8px 0' }} />
}

import { useAppStore } from '@/store'

// ─── Shared Receipt Modal ─────────────────────────────────────────────────────
export default function ReceiptModal({ sale, businessInfo, onClose, title = 'Receipt' }) {
  const { receiptSettings } = useAppStore()

  if (!sale) return null

  const handlePrint = () => {
    // Build print-safe HTML from ReceiptContent via a temp div
    const el = document.getElementById('paxxmo-receipt-inner')
    if (!el) return
    printReceiptHTML(title, el.innerHTML)
  }

  // Auto-print effect
  React.useEffect(() => {
    if (receiptSettings?.autoPrint) {
      const timer = setTimeout(() => {
        handlePrint()
      }, 600) // Small delay to guarantee DOM formatting
      return () => clearTimeout(timer)
    }
  }, [receiptSettings?.autoPrint])

  const source = sale.source
  const accentColor = source === 'restaurant' ? '#7c3aed' : source === 'takeout' ? '#ea580c' : '#16a34a'
  const accentLight = source === 'restaurant' ? '#f3f0ff' : source === 'takeout' ? '#fff7ed' : '#f0fdf4'
  const typeLabel   = source === 'restaurant' ? 'Dine-In Receipt' : source === 'takeout' ? 'Take Out Receipt' : 'Sale Receipt'

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="animate-fade-in"
        style={{
          background: 'white',
          borderRadius: 24,
          width: 420,
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: accentLight, borderBottom: `2px solid ${accentColor}20` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: accentColor, color: 'white', fontSize: 18 }}
            >
              🧾
            </div>
            <div>
              <h2 className="font-bold text-gray-900" style={{ fontSize: 15 }}>{typeLabel}</h2>
              <p className="text-xs text-gray-500">{sale.receiptNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <CheckCircle2 size={12} /> Paid
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Receipt body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Paper receipt card */}
          <div
            style={{
              background: '#fffef9',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: '24px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Torn edge effect top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 8,
              background: `repeating-linear-gradient(90deg, white 0px, white 8px, ${accentColor}30 8px, ${accentColor}30 10px)`,
            }} />
            {/* Torn edge effect bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 8,
              background: `repeating-linear-gradient(90deg, white 0px, white 8px, ${accentColor}30 8px, ${accentColor}30 10px)`,
            }} />

            <div id="paxxmo-receipt-inner" style={{ padding: '8px 0' }}>
              <ReceiptContent sale={sale} businessInfo={businessInfo} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 p-4 shrink-0"
          style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}
        >
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
          >
            <Printer size={16} /> Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
