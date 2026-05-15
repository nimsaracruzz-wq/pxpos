import React from 'react'
import { X, Printer, CheckCircle2 } from 'lucide-react'
import Barcode from 'react-barcode'
import { formatCurrency } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import { BRAND } from '@/lib/brand'
import { printReceiptHTML } from '@/lib/printReceipt'
import { buildThermalProfile } from '@/lib/thermalPrinter'
import { useAppStore } from '@/store'

// ─── Thermal profile helper (mirrors main.js logic, client-side) ──────────────
// Returns barcode bar width scaled to fill the usable receipt column.
function barcodeBarWidth(paperWidth = '80mm') {
  const { hardwareSettings } = useAppStore()
  const profile = buildThermalProfile({
    paperWidth,
    printerMode: hardwareSettings?.printerType || 'Raster',
    printerProfile: hardwareSettings?.printerProfile || '',
  })
  return profile.barcodeModuleWidth || (profile.is58 ? 1.1 : 1.55)
}

// ─── Copy header block (2-copy receipts for card payments) ───────────────────
function buildCopyHeader(label) {
  return `<div style="text-align:center;font-family:'Courier New',monospace;font-size:11px;font-weight:700;border:1px solid #000;padding:3px 8px;display:inline-block;margin-bottom:6px;letter-spacing:0.08em;text-transform:uppercase">${label}</div>`
}

// ─── Receipt Content (rendered both on screen + for print) ───────────────────
export function ReceiptContent({ sale, businessInfo, receiptSettings, paperWidth = '80mm', compact = false }) {
  const {
    receiptNo, date, cartItems = [], items, subtotal,
    discount = 0, tax = 0, total, paymentMethod, change = 0,
    cashier, customerName, tableNumber, source, waiter, notes,
  } = sale

  const isTable = source === 'restaurant'
  const isTakeOut = source === 'takeout'
  const { hardwareSettings } = useAppStore()
  const profile = buildThermalProfile({ paperWidth })
  const paymentLabel = String(paymentMethod || 'cash').toLowerCase() === 'card'
    ? 'Card paid'
    : String(paymentMethod || 'cash').toLowerCase() === 'split'
      ? 'Split paid'
      : String(paymentMethod || 'cash').toLowerCase() === 'helaqr'
        ? 'HelaQR pending'
        : 'Cash paid'

  const showBarcode = receiptSettings?.showBarcode !== false
  const showCashier = receiptSettings?.showCashier !== false
  const receiptFooter = receiptSettings?.footer || `Powered by ${BRAND.fullName}`

  return (
    <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 13, fontWeight: 700, lineHeight: 1.45, color: '#000', textAlign: 'center', width: '100%' }}>
      {/* Logo area */}
      {receiptSettings?.logoUrl && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img
            src={receiptSettings.logoUrl}
            alt="Store Logo"
            className="receipt-logo"
            style={{ maxWidth: 92, maxHeight: 42, objectFit: 'contain', display: 'block', margin: '0 auto' }}
          />
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: '1px dashed #000', marginBottom: 8, paddingBottom: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.04em', marginBottom: 2, textTransform: 'uppercase' }}>
          {businessInfo.name}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#000', lineHeight: 1.5 }}>
          {businessInfo.address}
        </div>
        {receiptSettings?.header && (
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {receiptSettings.header}
          </div>
        )}
        {businessInfo.phone && <div style={{ fontSize: 11, fontWeight: 700 }}>{businessInfo.phone}{businessInfo.email ? ` | ${businessInfo.email}` : ''}</div>}
        {businessInfo.taxId && (
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>
            TAX ID: {businessInfo.taxId}
          </div>
        )}
        {isTable && (
          <div style={{ border: '2px solid #000', borderRadius: 2, fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', padding: '2px 10px', display: 'inline-block', margin: '6px 0 2px', textTransform: 'uppercase' }}>
            TABLE {tableNumber} — DINE IN
          </div>
        )}
      </div>

      {/* Meta info table */}
      <table style={{ width: '100%', fontSize: '11px', fontWeight: 700, borderCollapse: 'collapse', marginBottom: 2, textAlign: 'left' }}>
        <tbody>
          <tr><td style={{ padding: '1.5px 0' }}>Receipt #</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{receiptNo}</td></tr>
          <tr><td style={{ padding: '1.5px 0' }}>Date</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
          <tr><td style={{ padding: '1.5px 0' }}>Time</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td></tr>
          {showCashier && cashier && <tr><td style={{ padding: '1.5px 0' }}>Cashier</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{cashier}</td></tr>}
          {(waiter || customerName) && !isTakeOut && <tr><td style={{ padding: '1.5px 0' }}>Waiter</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{waiter || cashier}</td></tr>}
          {isTakeOut && customerName && customerName !== 'Walk-in' && <tr><td style={{ padding: '1.5px 0' }}>Customer</td><td style={{ padding: '1.5px 0', textAlign: 'right' }}>{customerName}</td></tr>}
        </tbody>
      </table>

      {/* Barcode — bar width scales with paper size; container forces centre-align */}
      {showBarcode && receiptNo && (
        <div style={{ textAlign: 'center', width: '100%', overflow: 'hidden', margin: '8px 0 4px', paddingLeft: `${hardwareSettings?.barcodeEdgePaddingMm ?? profile.edgePaddingMm}mm`, paddingRight: `${hardwareSettings?.barcodeEdgePaddingMm ?? profile.edgePaddingMm}mm` }}>
          <div style={{ display: 'inline-block', maxWidth: '100%', boxSizing: 'border-box' }}>
            <Barcode
              value={String(receiptNo)}
              format={(receiptSettings?.barcodeType) || (hardwareSettings?.barcodeType) || 'CODE128'}
              width={Number(hardwareSettings?.barcodeModuleWidth || profile.barcodeModuleWidth)}
              height={Number(hardwareSettings?.barcodeHeight || profile.barcodeHeight)}
              margin={Number(hardwareSettings?.barcodeQuietZone || profile.barcodeQuietZone)}
              fontSize={0}
              displayValue={false}
              background="#fff"
              lineColor="#000"
              svgProps={{ style: { shapeRendering: 'crispEdges' } }}
            />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginTop: 3 }}>{receiptNo}</div>
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '8px 0' }} />

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0', textAlign: 'left' }}>
        <tbody>
          {(cartItems || []).map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '2px 0', fontWeight: 900, fontSize: 13, verticalAlign: 'top' }}>
                <div>{item.name}</div>
                {(item.serial || item.imei || item.warrantyMonths) && (
                  <div style={{ fontSize: '10px', fontWeight: 700, marginTop: 1 }}>
                    {item.serial && `S/N: ${item.serial} `}
                    {item.imei && `IMEI: ${item.imei} `}
                    {item.warrantyMonths ? `Warranty: ${item.warrantyMonths}m` : ''}
                  </div>
                )}
                <div style={{ fontSize: '11px', fontWeight: 700 }}>{item.qty} x {formatCurrency(item.salePrice || item.price)}</div>
              </td>
              <td style={{ padding: '2px 0', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 900, fontSize: 13, verticalAlign: 'top' }}>{formatCurrency((item.salePrice || item.price) * item.qty)}</td>
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontWeight: 700, marginBottom: 0, textAlign: 'left' }}>
        <tbody>
          <tr><td style={{ padding: '2px 0' }}>Subtotal</td><td style={{ padding: '2px 0', textAlign: 'right' }}>{formatCurrency(subtotal)}</td></tr>
          {tax > 0 && <tr><td style={{ padding: '2px 0' }}>VAT</td><td style={{ padding: '2px 0', textAlign: 'right' }}>{formatCurrency(tax)}</td></tr>}
          {discount > 0 && <tr><td style={{ padding: '2px 0' }}>Discount</td><td style={{ padding: '2px 0', textAlign: 'right' }}>-{formatCurrency(discount)}</td></tr>}
          <tr><td colSpan="2" style={{ padding: 0 }}><hr style={{ border: 'none', borderTop: '2px solid #000', margin: '5px 0' }} /></td></tr>
          <tr style={{ fontSize: 16, fontWeight: 900 }}>
            <td style={{ padding: '4px 0 2px' }}>TOTAL</td>
            <td style={{ padding: '4px 0 2px', textAlign: 'right' }}>{formatCurrency(total)}</td>
          </tr>
          <tr><td style={{ padding: '2px 0' }}>{paymentLabel}</td><td style={{ padding: '2px 0', textAlign: 'right' }}>{formatCurrency(total)}</td></tr>
        </tbody>
      </table>

      {/* Change box */}
      {change > 0 && (
        <div style={{ border: '2px solid #000', borderRadius: 2, padding: '5px 8px', margin: '8px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900, fontSize: 15 }}>
          <span>CHANGE</span>
          <span>{formatCurrency(change)}</span>
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '8px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#000', marginTop: 8, lineHeight: 1.7 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 2 }}>
          {receiptFooter}
        </div>
        <div>Thank you for your business!</div>
        <div>{businessInfo.phone}</div>
        <div>Visit us again at {businessInfo.name}</div>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>
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


// ─── Shared Receipt Modal ─────────────────────────────────────────────────────
export default function ReceiptModal({ sale, businessInfo, onClose, title = 'Receipt' }) {
  const { receiptSettings, hardwareSettings } = useAppStore()

  if (!sale) return null

  // Derived from stored settings — forwarded to main.js via IPC
  const paperWidth  = String(hardwareSettings?.paperWidth  || '80mm').trim()
  const deviceName  = String(hardwareSettings?.printerPort || '').trim()
  const profile     = buildThermalProfile({
    paperWidth,
    printerMode: hardwareSettings?.printerType || 'Raster',
    printerProfile: hardwareSettings?.printerProfile || '',
  })
  const printOpts   = { deviceName, paperWidth: profile.paperWidth, printerMode: profile.printerMode, printerProfile: profile.printerProfile }

  const handlePrint = async () => {
    // Build print-safe HTML from ReceiptContent via a temp div
    const el = document.getElementById('paxxmo-receipt-inner')
    if (!el) return
    const paymentMode = String(sale?.paymentMethod || '').trim().toLowerCase()

    // Convert any inline barcode SVGs to raster PNGs before printing.
    // This produces a pixel-aligned, high-contrast image that thermal printers
    // and physical scanners can read more reliably than anti-aliased SVGs.
    const svgs = Array.from(el.querySelectorAll('svg'))
    if (svgs.length > 0) {
      await Promise.all(svgs.map((svg) => new Promise((resolve) => {
        try {
          const rect = svg.getBoundingClientRect()
          const svgData = new XMLSerializer().serializeToString(svg)
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
          const url = URL.createObjectURL(svgBlob)
          const img = new Image()

          img.onload = () => {
            try {
              const canvas = document.createElement('canvas')
              // Scale canvas to device pixels to preserve sharpness
              const scale = window.devicePixelRatio || 1
              canvas.width = Math.max(1, Math.round(rect.width * scale))
              canvas.height = Math.max(1, Math.round(rect.height * scale))
              const ctx = canvas.getContext('2d')
              // White background + crisp draw
              ctx.fillStyle = '#fff'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

              const dataUrl = canvas.toDataURL('image/png')
              const imgEl = document.createElement('img')
              imgEl.src = dataUrl
              imgEl.style.display = 'block'
              imgEl.style.width = `${Math.round(rect.width)}px`
              imgEl.style.height = `${Math.round(rect.height)}px`
              svg.parentNode.replaceChild(imgEl, svg)
            } catch (innerErr) {
              // ignore conversion failure and leave svg
            }
            URL.revokeObjectURL(url)
            resolve()
          }

          img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve()
          }

          img.src = url
        } catch (e) {
          resolve()
        }
      })))
    }

    const content = el.innerHTML

    if (paymentMode === 'card') {
      await printReceiptHTML(`${title} - Customer Copy`, `${buildCopyHeader('Customer Copy')}${content}`, printOpts)
      await printReceiptHTML(`${title} - Shop Copy`, `${buildCopyHeader('Shop Copy')}${content}`, printOpts)
      return
    }

    await printReceiptHTML(title, content, printOpts)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <ReceiptContent
                sale={sale}
                businessInfo={businessInfo}
                receiptSettings={receiptSettings}
                paperWidth={paperWidth}
              />
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
