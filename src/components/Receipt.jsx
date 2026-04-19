import React from 'react'
import { X, Printer, CheckCircle2 } from 'lucide-react'
import Barcode from 'react-barcode'
import { formatCurrency } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import { BRAND } from '@/lib/brand'

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; background: white; color: #111; }
  .receipt { font-size: 12px; width: 280px; background: #fff; color: #111; padding: 18px 16px 24px; margin: 0 auto; }
  .sep { border: none; border-top: 1px dashed #aaa; margin: 8px 0; }
  .sep-solid { border: none; border-top: 1.5px solid #111; margin: 6px 0; }
  .receipt-top { border-bottom: 1px dashed #aaa; margin-bottom: 10px; padding-bottom: 10px; text-align: center; }
  .store { font-size: 17px; font-weight: 700; letter-spacing: 0.03em; margin-bottom: 2px; }
  .addr { font-size: 10px; color: #555; line-height: 1.5; }
  .taxid { font-size: 10px; color: #555; margin-top: 2px; }
  .table-badge { border: 1px solid #444; border-radius: 3px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 10px; display: inline-block; margin: 8px 0 2px; }
  .meta { width: 100%; font-size: 10.5px; border-collapse: collapse; margin-bottom: 2px; }
  .meta td { padding: 1px 0; }
  .meta td:last-child { text-align: right; }
  .barcode-area { text-align: center; margin: 8px 0 4px; }
  .barcode-num { font-size: 9px; color: #555; letter-spacing: 0.05em; margin-top: 2px; }
  .items { width: 100%; border-collapse: collapse; margin: 4px 0; }
  .item-name { font-size: 12px; font-weight: 700; }
  .item-qty { font-size: 10.5px; color: #444; }
  .items td:last-child { text-align: right; white-space: nowrap; }
  .totals { width: 100%; border-collapse: collapse; font-size: 11px; }
  .totals td { padding: 1.5px 0; }
  .totals td:last-child { text-align: right; }
  .total-row td { font-size: 14px; font-weight: 700; padding: 4px 0 2px; }
  .change-box { border: 1.5px solid #111; border-radius: 3px; padding: 5px 8px; margin: 8px 0 4px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 13px; }
  .footer { text-align: center; font-size: 10px; color: #555; margin-top: 10px; line-height: 1.6; }
  .footer .thank { font-size: 12px; font-weight: 700; color: #111; }
  .powered { font-size: 8.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #aaa; margin-top: 6px; }
  @media print {
    body { width: 80mm; }
    .no-print { display: none; }
  }
`

// ─── Print Helper ─────────────────────────────────────────────────────────────
export async function printReceiptHTML(title, bodyHtml, options = {}) {
  const htmlDoc = `<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>${title}</title>
    <style>${PRINT_STYLES}</style>
  </head><body><div class="receipt">${bodyHtml}</div></body></html>`

  const isElectron =
    typeof window !== 'undefined' &&
    typeof window.require === 'function' &&
    typeof window.process !== 'undefined' &&
    !!window.process?.versions?.electron

  try {
    if (isElectron) {
      const ipcRenderer = window.require('electron').ipcRenderer
      const result = await ipcRenderer.invoke('print-html', {
        title,
        html: htmlDoc,
        silent: true,
        deviceName: options?.deviceName || '',
      })
      if (result?.success) return true
      throw new Error(result?.error || 'Silent print failed')
    }
  } catch (err) {
    console.error('[Receipt] Silent print failed:', err)
    if (isElectron) return false
  }

  const w = window.open('', '_blank', 'width=400,height=720')
  if (!w) return false
  w.document.write(htmlDoc)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
  return true
}

function buildCopyHeader(label) {
  return `<div style="text-align:center;border:1px dashed #666;padding:4px 6px;margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${label}</div>`
}

// ─── Receipt Content (rendered both on screen + for print) ───────────────────
export function ReceiptContent({ sale, businessInfo, receiptSettings, compact = false }) {
  const {
    receiptNo, date, cartItems = [], items, subtotal,
    discount = 0, tax = 0, total, paymentMethod, change = 0,
    cashier, customerName, tableNumber, source, waiter, notes,
  } = sale

  const isTable = source === 'restaurant'
  const isTakeOut = source === 'takeout'
  const paymentLabel = String(paymentMethod || 'cash').toLowerCase() === 'card'
    ? 'Card paid'
    : String(paymentMethod || 'cash').toLowerCase() === 'split'
      ? 'Split paid'
      : String(paymentMethod || 'cash').toLowerCase() === 'helaqr'
        ? 'HelaQR pending'
        : 'Cash paid'

  return (
    <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 12, lineHeight: 1.5 }}>
      {/* Logo area */}
      {receiptSettings?.logoUrl && (
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img src={receiptSettings.logoUrl} alt="Store Logo" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain' }} />
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: '1px dashed #aaa', marginBottom: 10, paddingBottom: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.03em', marginBottom: 2 }}>
          {businessInfo.name}
        </div>
        <div style={{ fontSize: 10, color: '#555', lineHeight: 1.5 }}>
          {businessInfo.address}
        </div>
        {businessInfo.phone && <div style={{ fontSize: 10, color: '#555' }}>{businessInfo.phone}{businessInfo.email ? ` | ${businessInfo.email}` : ''}</div>}
        {businessInfo.taxId && (
          <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
            TAX ID: {businessInfo.taxId}
          </div>
        )}
        {isTable && (
          <div style={{ border: '1px solid #444', borderRadius: 3, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 10px', display: 'inline-block', margin: '8px 0 2px', textTransform: 'uppercase' }}>
            TABLE {tableNumber} — DINE IN
          </div>
        )}
      </div>

      {/* Meta info table */}
      <table style={{ width: '100%', fontSize: '10.5px', borderCollapse: 'collapse', marginBottom: 2 }}>
        <tbody>
          <tr><td style={{ padding: '1px 0' }}>Receipt #</td><td style={{ padding: '1px 0', textAlign: 'right' }}>{receiptNo}</td></tr>
          <tr><td style={{ padding: '1px 0' }}>Date</td><td style={{ padding: '1px 0', textAlign: 'right' }}>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
          <tr><td style={{ padding: '1px 0' }}>Time</td><td style={{ padding: '1px 0', textAlign: 'right' }}>{new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td></tr>
          {cashier && <tr><td style={{ padding: '1px 0' }}>Cashier</td><td style={{ padding: '1px 0', textAlign: 'right' }}>{cashier}</td></tr>}
          {(waiter || customerName) && !isTakeOut && <tr><td style={{ padding: '1px 0' }}>Waiter</td><td style={{ padding: '1px 0', textAlign: 'right' }}>{waiter || cashier}</td></tr>}
          {isTakeOut && customerName && customerName !== 'Walk-in' && <tr><td style={{ padding: '1px 0' }}>Customer</td><td style={{ padding: '1px 0', textAlign: 'right' }}>{customerName}</td></tr>}
        </tbody>
      </table>

      {/* Barcode */}
      {receiptNo && (
        <div style={{ textAlign: 'center', margin: '8px 0 4px' }}>
          <Barcode
            value={String(receiptNo)}
            format="CODE128"
            width={1.2}
            height={36}
            margin={0}
            fontSize={10}
            textMargin={2}
            background="transparent"
          />
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.05em', marginTop: 2 }}>{receiptNo}</div>
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '8px 0' }} />

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0' }}>
        <tbody>
          {(cartItems || []).map((item, i) => (
            <tr key={i}>
              <td style={{ padding: 0, fontWeight: 700, fontSize: 12 }}>
                <div>{item.name}</div>
                <div style={{ fontSize: '10.5px', color: '#444' }}>{item.qty} x {formatCurrency(item.salePrice || item.price)}</div>
              </td>
              <td style={{ padding: 0, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{formatCurrency((item.salePrice || item.price) * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {notes && (
        <div style={{ fontSize: 10, color: '#555', padding: '4px 0', margin: '6px 0', fontStyle: 'italic' }}>
          📝 {notes}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '8px 0' }} />

      {/* Totals table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 0 }}>
        <tbody>
          <tr><td style={{ padding: '1.5px 0' }}>Subtotal</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{formatCurrency(subtotal)}</td></tr>
          {tax > 0 && <tr><td style={{ padding: '1.5px 0' }}>VAT (15%)</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{formatCurrency(tax)}</td></tr>}
          {discount > 0 && <tr><td style={{ padding: '1.5px 0' }}>Discount</td><td style={{ padding: '1.5px 0', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(discount)}</td></tr>}
          <tr><td colSpan="2" style={{ padding: 0 }}><hr style={{ border: 'none', borderTop: '1.5px solid #111', margin: '6px 0' }} /></td></tr>
          <tr style={{ fontSize: 14, fontWeight: 700 }}>
            <td style={{ padding: '4px 0 2px' }}>TOTAL</td>
            <td style={{ padding: '4px 0 2px', textAlign: 'right' }}>{formatCurrency(total)}</td>
          </tr>
          <tr><td style={{ padding: '1.5px 0' }}>{paymentLabel}</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{formatCurrency(total)}</td></tr>
        </tbody>
      </table>

      {/* Change box */}
      {change > 0 && (
        <div style={{ border: '1.5px solid #111', borderRadius: 3, padding: '5px 8px', margin: '8px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 13 }}>
          <span>CHANGE</span>
          <span>{formatCurrency(change)}</span>
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '8px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginTop: 10, lineHeight: 1.6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 2 }}>
          Thank you for your business!
        </div>
        <div>{businessInfo.phone}</div>
        <div>Visit us again at {businessInfo.name}</div>
        <div style={{ fontSize: '8.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginTop: 6 }}>
          Powered by {BRAND.fullName}
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

import { useAppStore } from '@/store'

// ─── Shared Receipt Modal ─────────────────────────────────────────────────────
export default function ReceiptModal({ sale, businessInfo, onClose, title = 'Receipt' }) {
  const { receiptSettings, hardwareSettings } = useAppStore()

  if (!sale) return null

  const handlePrint = async () => {
    // Build print-safe HTML from ReceiptContent via a temp div
    const el = document.getElementById('paxxmo-receipt-inner')
    if (!el) return

    const paymentMode = String(sale?.paymentMethod || '').trim().toLowerCase()
    const content = el.innerHTML
    const deviceName = String(hardwareSettings?.printerPort || '').trim()

    if (paymentMode === 'card') {
      await printReceiptHTML(`${title} - Customer Copy`, `${buildCopyHeader('Customer Copy')}${content}`, { deviceName })
      await printReceiptHTML(`${title} - Shop Copy`, `${buildCopyHeader('Shop Copy')}${content}`, { deviceName })
      return
    }

    await printReceiptHTML(title, content, { deviceName })
  }

  // Auto-print effect
  React.useEffect(() => {
    if (receiptSettings?.autoPrint) {
      const timer = setTimeout(() => {
        handlePrint().catch((err) => {
          console.error('[Receipt] Auto-print failed:', err)
        })
      }, 600) // Small delay to guarantee DOM formatting
      return () => clearTimeout(timer)
    }
  }, [receiptSettings?.autoPrint])

  const source = sale.source
  const accentColor = source === 'restaurant' ? '#7c3aed' : source === 'takeout' ? '#ea580c' : '#16a34a'
  const accentLight = source === 'restaurant' ? '#f3f0ff' : source === 'takeout' ? '#fff7ed' : '#f0fdf4'
  const typeLabel   = source === 'restaurant' ? tr('rect_label_dinein') : source === 'takeout' ? tr('rect_label_takeout') : tr('rect_label_sale')

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
              <CheckCircle2 size={12} /> {tr('rect_paid')}
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
              <ReceiptContent sale={sale} businessInfo={businessInfo} receiptSettings={receiptSettings} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 p-4 shrink-0"
          style={{ borderTop: '1px solid #f0f0f0', background: '#fafafa' }}
        >
          <button
            onClick={() => { handlePrint() }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
          >
            <Printer size={16} /> {String(sale?.paymentMethod || '').toLowerCase() === 'card' ? 'Print 2 Copies' : tr('rect_print')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {tr('rect_close')}
          </button>
        </div>
      </div>
    </div>
  )
}
