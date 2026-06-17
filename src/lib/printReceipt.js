/**
 * printReceipt.js — standalone print utility (no React components)
 * Extracted here to satisfy Vite Fast Refresh rules:
 * non-component exports cannot live alongside React component exports.
 *
 * Receipts are rendered as true thermal pages in physical units so Chromium
 * does not shrink a 576px layout into a 58mm-looking printout.
 */

import { buildThermalProfile } from '@/lib/thermalPrinter'
import JsBarcode from 'jsbarcode'

// ─── CSS builder ──────────────────────────────────────────────────────────────
function buildPrintStyles(paperWidth = '80mm') {
  const { paperMm, usableMm, contentMm, contentPx, fontScale } = buildThermalProfile({ paperWidth })

  // Base font sizes — scaled for 58mm if needed
  const fs = (px) => `${Math.round(px * fontScale)}px`

  return `
  /* ── Reset ── */
  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Page setup ──
     size: full paper width × auto height so the Raster driver cuts at the
     natural receipt length, not at A4 (297mm).
     margin: 0mm removes any driver-injected white frame.                    */
  @page {
    size: ${paperMm}mm auto;
    margin: 0;
  }

  html {
    width: 100%;
    margin: 0;
    padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    width: ${paperMm}mm;
    min-width: ${paperMm}mm;
    max-width: ${paperMm}mm;
    margin: 0 auto;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${fs(13)};
    font-weight: 700;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Outermost receipt wrapper ──
     The physical width keeps Chromium from shrinking the page to an A4-like
     printable area.  The worker window still uses the thermal dot grid.    */
  .receipt {
    width: ${contentMm}mm;
    max-width: ${contentMm}mm;
    padding: 1.5mm 2mm 2mm 2.5mm;
    margin: 0;
    text-align: center;
    color: #000;
    overflow: visible;
  }

  /* ── Dividers ── */
  .sep       { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .sep-solid { border: none; border-top: 2px solid #000;  margin: 6px 0; }
  hr         { border: none; border-top: 1px dashed #aaa; margin: 8px 0; }

  /* ── Header ── */
  .receipt-top { border-bottom: 1px dashed #000; margin-bottom: 8px; padding-bottom: 8px; }
  .store   { font-size: ${fs(16)}; font-weight: 900; letter-spacing: 0.04em; margin-bottom: 2px; text-transform: uppercase; }
  .addr    { font-size: ${fs(11)}; font-weight: 700; line-height: 1.5; }
  .taxid   { font-size: ${fs(10)}; font-weight: 700; margin-top: 2px; }

  .table-badge {
    border: 2px solid #000; border-radius: 2px;
    font-size: ${fs(12)}; font-weight: 900; letter-spacing: 0.08em;
    padding: 2px 10px; display: inline-block; margin: 6px 0 2px;
    text-transform: uppercase;
  }

  /* ── Meta table (Receipt #, Date, Cashier…) ── */
  .meta { width: 100%; font-size: ${fs(11)}; font-weight: 700; border-collapse: collapse; margin-bottom: 2px; table-layout: fixed; }
  .meta td { padding: 1.5px 0; text-align: left; word-break: keep-all; }
  .meta td:first-child { width: 44%; padding-left: 0.75mm; }
  .meta td:last-child { text-align: right; padding-right: 1.1mm; }

  /* ── Barcode area ──
     Centering is critical on FP-1100 (Raster driver).  We give the
     container 100% width and use auto horizontal margins on the SVG/canvas
     so Chromium centers it before rasterisation.                            */
  .barcode-area {
    width: 100%;
    max-width: ${contentPx}px;
    display: flex;
    justify-content: center;
    margin: 8px 0 4px;
    overflow: hidden;
  }
  .barcode-area svg,
  .barcode-area canvas {
    display: block;
    margin: 0 auto;
    max-width: 100%;
    width: auto !important;
    height: auto !important;
  }
  .barcode-num { font-size: ${fs(10)}; font-weight: 700; letter-spacing: 0.08em; margin-top: 2px; }

  /* ── Items table ── */
  .items { width: 100%; border-collapse: collapse; margin: 4px 0; text-align: left; table-layout: fixed; }
  .item-name { font-size: ${fs(13)}; font-weight: 900; line-height: 1.3; }
  .item-sub  { font-size: ${fs(11)}; font-weight: 700; }
  .items td { vertical-align: top; }
  .items td:first-child { width: 72%; word-break: break-word; overflow-wrap: anywhere; }
  .items td:last-child { width: 28%; text-align: right; white-space: nowrap; vertical-align: top; padding-right: 1.1mm; }

  /* ── Totals table ── */
  .totals { width: 100%; border-collapse: collapse; font-size: ${fs(12)}; font-weight: 700; text-align: left; table-layout: fixed; }
  .totals td { padding: 2px 0; }
  .totals td:last-child { text-align: right; padding-right: 1.1mm; }
  .total-row td { font-size: ${fs(16)}; font-weight: 900; padding: 5px 0 3px; }

  /* ── Change box ── */
  .change-box {
    border: 2px solid #000; border-radius: 2px;
    padding: 5px 8px; margin: 8px 0 4px;
    display: flex; justify-content: space-between; align-items: center;
    font-weight: 900; font-size: ${fs(15)};
  }

  /* ── Footer ── */
  .footer { text-align: center; font-size: ${fs(11)}; font-weight: 700; margin-top: 8px; line-height: 1.7; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; padding-right: 1mm; }
  .footer .thank { font-size: ${fs(13)}; font-weight: 900; margin-bottom: 2px; }
  .powered { font-size: ${fs(9)}; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 6px; }

  .receipt-logo {
    display: block;
    margin: 0 auto 2mm;
    max-width: ${paperMm === 58 ? '26mm' : '31mm'};
    max-height: ${paperMm === 58 ? '12mm' : '14mm'};
    width: auto;
    height: auto;
    object-fit: contain;
    image-rendering: auto;
    -webkit-image-rendering: -webkit-optimize-contrast;
  }

  /* ── Inline-style overrides for Receipt.jsx content ──
     Receipt.jsx renders via innerHTML, so table/font styles may be inline.
     These rules ensure width constraints are respected even in inline-styled
     elements.                                                               */
  table { max-width: 100%; border-collapse: collapse; table-layout: fixed; }
  td, th { word-break: break-word; overflow-wrap: anywhere; }
  img   { max-width: 100%; height: auto; image-rendering: auto; }

  /* ── Print media ── */
  @media print {
    @page { size: ${paperMm}mm auto; margin: 0mm; }
    html, body { width: ${paperMm}mm; }
    body { padding-left: 1mm; padding-right: 1mm; }
    .no-print { display: none !important; }
  }
`
}

// Keep PRINT_STYLES export for any legacy imports (uses 80mm default)
export const PRINT_STYLES = buildPrintStyles('80mm')

// ─── HTML document builder ────────────────────────────────────────────────────
function buildHtmlDoc(title, bodyHtml, paperWidth = '80mm') {
  const styles = buildPrintStyles(paperWidth)
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>${styles}</style>
  </head><body><div class="receipt">${bodyHtml}</div></body></html>`
}

// ─── Main print function ──────────────────────────────────────────────────────
export async function printReceiptHTML(title, bodyHtml, options = {}) {
  // paperWidth: e.g. "80mm" or "58mm" — must match physical paper in the printer
  const paperWidth = String(options?.paperWidth || '80mm').trim()
  const printerMode = String(options?.printerMode || options?.printerType || 'Raster').trim()
  const printerProfile = String(options?.printerProfile || '').trim()

  const htmlDoc = buildHtmlDoc(title, bodyHtml, paperWidth)

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
        paperWidth,   // ← main.js uses this to resize the worker window
        printerMode,
        printerProfile,
      })
      if (result?.success) return true
      throw new Error(result?.error || 'Silent print failed')
    }
  } catch (err) {
    console.error('[Receipt] Silent print failed:', err)
    if (isElectron) return false
  }

  // Browser fallback (non-Electron)
  const w = window.open('', '_blank', 'width=620,height=900')
  if (!w) return false
  w.document.write(htmlDoc)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
  return true
}

// ─── A4 Invoice Styles (Electronics Module) ───────────────────────────────────
function buildA4InvoiceStyles() {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4;
    margin: 12mm 15mm;
  }

  html, body {
    width: 210mm;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .invoice {
    width: 100%;
    max-width: 180mm;
    margin: 0 auto;
    padding: 0;
  }

  /* ── Header ── */
  .inv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 3px solid #1a1a2e;
    margin-bottom: 16px;
  }
  .inv-brand {
    flex: 1;
  }
  .inv-brand .store-name {
    font-size: 22px;
    font-weight: 900;
    color: #1a1a2e;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .inv-brand .store-addr {
    font-size: 10px;
    color: #555;
    margin-top: 4px;
    line-height: 1.5;
  }
  .inv-brand .store-contact {
    font-size: 10px;
    color: #555;
    margin-top: 2px;
  }
  .inv-brand .tax-id {
    font-size: 9px;
    color: #777;
    margin-top: 4px;
    font-weight: 600;
  }

  .inv-title-block {
    text-align: right;
  }
  .inv-title-block .inv-label {
    font-size: 28px;
    font-weight: 900;
    color: #1a1a2e;
    letter-spacing: -0.03em;
    text-transform: uppercase;
  }
  .inv-title-block .inv-number {
    font-size: 13px;
    font-weight: 700;
    color: #e63946;
    margin-top: 2px;
  }
  .inv-title-block .inv-date {
    font-size: 10px;
    color: #666;
    margin-top: 6px;
    line-height: 1.6;
  }

  /* ── Logo ── */
  .inv-logo {
    max-width: 60px;
    max-height: 60px;
    object-fit: contain;
    margin-bottom: 6px;
    display: block;
  }

  /* ── Meta row ── */
  .inv-meta-row {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
  }
  .inv-meta-box {
    flex: 1;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 10px 14px;
  }
  .inv-meta-box .label {
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #999;
    margin-bottom: 4px;
  }
  .inv-meta-box .value {
    font-size: 11px;
    font-weight: 700;
    color: #1a1a2e;
  }

  /* ── Items Table ── */
  .inv-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
  }
  .inv-table thead th {
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #fff;
    background: #1a1a2e;
    padding: 8px 10px;
    text-align: left;
  }
  .inv-table thead th:first-child {
    border-radius: 5px 0 0 0;
  }
  .inv-table thead th:last-child {
    border-radius: 0 5px 0 0;
    text-align: right;
  }
  .inv-table thead th.right {
    text-align: right;
  }
  .inv-table thead th.center {
    text-align: center;
  }
  .inv-table tbody td {
    padding: 9px 10px;
    font-size: 10.5px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  .inv-table tbody tr:nth-child(even) {
    background: #fafbfc;
  }
  .inv-table tbody td:last-child {
    text-align: right;
    font-weight: 700;
  }
  .inv-table tbody td.center {
    text-align: center;
  }
  .inv-table tbody td.right {
    text-align: right;
  }
  .item-name { font-weight: 700; color: #1a1a2e; }
  .item-serial { font-size: 9px; color: #666; margin-top: 2px; font-family: 'Courier New', monospace; }
  .item-warranty { font-size: 9px; color: #2563eb; margin-top: 1px; font-weight: 600; }

  /* ── Totals ── */
  .inv-totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }
  .inv-totals {
    width: 220px;
  }
  .inv-totals .row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 11px;
    color: #555;
  }
  .inv-totals .row .lbl { font-weight: 500; }
  .inv-totals .row .val { font-weight: 700; color: #1a1a2e; }
  .inv-totals .row.grand {
    border-top: 2px solid #1a1a2e;
    margin-top: 6px;
    padding-top: 8px;
    font-size: 15px;
  }
  .inv-totals .row.grand .lbl { font-weight: 800; color: #1a1a2e; }
  .inv-totals .row.grand .val { font-weight: 900; color: #e63946; }

  /* ── Payment info ── */
  .inv-payment {
    background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }
  .inv-payment .pay-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #16a34a;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 900;
    flex-shrink: 0;
  }
  .inv-payment .pay-info {
    flex: 1;
  }
  .inv-payment .pay-status {
    font-size: 12px;
    font-weight: 800;
    color: #16a34a;
  }
  .inv-payment .pay-method {
    font-size: 10px;
    color: #555;
    margin-top: 1px;
  }
  .inv-payment .pay-change {
    text-align: right;
  }
  .inv-payment .pay-change .change-label {
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
  }
  .inv-payment .pay-change .change-val {
    font-size: 14px;
    font-weight: 900;
    color: #1a1a2e;
  }

  /* ── Warranty notice ── */
  .inv-warranty-notice {
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 16px;
  }
  .inv-warranty-notice .notice-title {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #92400e;
    margin-bottom: 4px;
  }
  .inv-warranty-notice .notice-text {
    font-size: 9.5px;
    color: #78350f;
    line-height: 1.5;
  }

  /* ── Footer ── */
  .inv-footer {
    border-top: 1px solid #ddd;
    padding-top: 12px;
    margin-top: 8px;
    text-align: center;
  }
  .inv-footer .thanks {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 2px;
  }
  .inv-footer .footer-text {
    font-size: 9px;
    color: #888;
    line-height: 1.7;
  }
  .inv-footer .powered {
    font-size: 8px;
    color: #bbb;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 8px;
  }

  /* ── Barcode area ── */
  .inv-barcode {
    text-align: center;
    margin: 10px 0;
  }
  .inv-barcode svg, .inv-barcode canvas, .inv-barcode img {
    display: inline-block;
    max-width: 200px;
    height: auto;
  }
  .inv-barcode-num {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #555;
    margin-top: 3px;
  }

  /* ── Notes ── */
  .inv-notes {
    background: #f8f9fa;
    border-left: 3px solid #1a1a2e;
    padding: 8px 12px;
    margin-bottom: 16px;
    font-size: 10px;
    color: #444;
    font-style: italic;
  }

  @media print {
    @page { size: A4; margin: 12mm 15mm; }
    html, body { width: 210mm; }
    .no-print { display: none !important; }
  }
`
}

// ─── A4 Invoice HTML builder ──────────────────────────────────────────────────
function buildA4InvoiceDoc(title, bodyHtml) {
  const styles = buildA4InvoiceStyles()
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>${styles}</style>
  </head><body><div class="invoice">${bodyHtml}</div></body></html>`
}

// ─── A4 Invoice print entry point ────────────────────────────────────────────
export async function printA4InvoiceHTML(title, bodyHtml, options = {}) {
  const htmlDoc = buildA4InvoiceDoc(title, bodyHtml)

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
        paperWidth: 'A4',
      })
      if (result?.success) return true
      throw new Error(result?.error || 'A4 print failed')
    }
  } catch (err) {
    console.error('[A4 Invoice] Silent print failed:', err)
    if (isElectron) return false
  }

  // Browser fallback
  const w = window.open('', '_blank', 'width=800,height=1100')
  if (!w) return false
  w.document.write(htmlDoc)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
  return true
}

// ─── Build A4 invoice body content from sale data ─────────────────────────────
export function buildA4InvoiceBody(sale, businessInfo, receiptSettings) {
  const {
    receiptNo, date, cartItems = [], subtotal,
    discount = 0, tax = 0, total, paymentMethod, change = 0,
    cashier, customerName, notes,
  } = sale

  const fmt = (amt) => `Rs. ${Number(amt).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  const dateObj = new Date(date)
  const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  const paymentLabel = String(paymentMethod || 'cash').toLowerCase() === 'card'
    ? 'Card Payment'
    : String(paymentMethod || 'cash').toLowerCase() === 'split'
      ? 'Split Payment'
      : String(paymentMethod || 'cash').toLowerCase() === 'helaqr'
        ? 'HelaQR Payment'
        : 'Cash Payment'

  const hasSerials = cartItems.some(i => i.serial || i.imei || i.warrantyMonths)

  let html = ''

  // ── Header
  html += `<div class="inv-header">`
  html += `<div class="inv-brand">`
  if (receiptSettings?.logoUrl) {
    html += `<img src="${receiptSettings.logoUrl}" alt="Logo" class="inv-logo">`
  }
  html += `<div class="store-name">${businessInfo.name || ''}</div>`
  if (businessInfo.address) html += `<div class="store-addr">${businessInfo.address}</div>`
  if (businessInfo.phone || businessInfo.email) {
    html += `<div class="store-contact">${[businessInfo.phone, businessInfo.email].filter(Boolean).join(' | ')}</div>`
  }
  if (businessInfo.taxId) html += `<div class="tax-id">TAX ID: ${businessInfo.taxId}</div>`
  html += `</div>`

  let barcodeHtml = ''
  try {
    // Generate barcode as a PNG data URL using a temporary canvas.
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, String(receiptNo || '000000'), {
      width: 1.2,
      height: 35,
      fontSize: 11,
      margin: 0,
      displayValue: true,
      background: '#ffffff',
      lineColor: '#1a1a2e',
    })
    barcodeHtml = `<img src="${canvas.toDataURL('image/png')}" style="image-rendering: pixelated; max-width: 100%;" />`
  } catch (err) {
    console.warn('Failed to generate A4 barcode', err)
  }

  html += `<div class="inv-title-block">`
  html += `<div class="inv-label">Invoice</div>`
  if (barcodeHtml) {
    html += `<div style="margin-top: 8px; margin-bottom: 6px;">${barcodeHtml}</div>`
  } else {
    html += `<div class="inv-number">${receiptNo || ''}</div>`
  }
  html += `<div class="inv-date">${dateStr} &bull; ${timeStr}</div>`
  html += `</div>`
  html += `</div>`

  // ── Meta row
  html += `<div class="inv-meta-row">`
  html += `<div class="inv-meta-box"><div class="label">Invoice Number</div><div class="value">${receiptNo || '—'}</div></div>`
  html += `<div class="inv-meta-box"><div class="label">Date &amp; Time</div><div class="value">${dateStr} &bull; ${timeStr}</div></div>`
  if (cashier) html += `<div class="inv-meta-box"><div class="label">Sales Rep</div><div class="value">${cashier}</div></div>`
  const nameStr = (customerName && customerName !== 'Walk-in') ? customerName : ''
  const phoneStr = sale.customerPhone || ''
  
  if (nameStr || phoneStr) {
    const displayPhone = phoneStr ? ` <span style="font-size:0.85em;color:#666">(${phoneStr})</span>` : ''
    const displayName = (nameStr || 'Walk-in')
    html += `<div class="inv-meta-box"><div class="label">Customer</div><div class="value">${displayName}${displayPhone}</div></div>`
  }
  html += `</div>`

  // ── Items table
  html += `<table class="inv-table"><thead><tr>`
  html += `<th style="width:5%">#</th>`
  html += `<th style="width:${hasSerials ? '35%' : '50%'}">Item Description</th>`
  if (hasSerials) html += `<th style="width:20%">Serial / IMEI</th>`
  html += `<th class="center" style="width:8%">Qty</th>`
  html += `<th class="right" style="width:16%">Unit Price</th>`
  html += `<th class="right" style="width:16%">Amount</th>`
  html += `</tr></thead><tbody>`

  cartItems.forEach((item, i) => {
    const unitPrice = item.salePrice || item.price || 0
    const lineTotal = unitPrice * (item.qty || 1)
    const unit = item.unit ? ` ${item.unit}` : ''

    html += `<tr>`
    html += `<td class="center" style="font-weight:600;color:#999">${i + 1}</td>`
    html += `<td>`
    html += `<div class="item-name">${item.name}</div>`
    if (item.warrantyMonths) html += `<div class="item-warranty">🛡 ${item.warrantyMonths} Month Warranty</div>`
    if (item.expiry) html += `<div class="item-serial">Exp: ${item.expiry}</div>`
    html += `</td>`
    if (hasSerials) {
      html += `<td>`
      if (item.serial) html += `<div class="item-serial">S/N: ${item.serial}</div>`
      if (item.imei) html += `<div class="item-serial">IMEI: ${item.imei}</div>`
      if (!item.serial && !item.imei) html += `<span style="color:#ccc">—</span>`
      html += `</td>`
    }
    html += `<td class="center">${item.qty || 1}${unit}</td>`
    html += `<td class="right">${fmt(unitPrice)}</td>`
    html += `<td>${fmt(lineTotal)}</td>`
    html += `</tr>`
  })

  html += `</tbody></table>`

  // ── Notes
  if (notes) {
    html += `<div class="inv-notes">📝 ${notes}</div>`
  }

  // ── Totals
  html += `<div class="inv-totals-wrap"><div class="inv-totals">`
  html += `<div class="row"><span class="lbl">Subtotal</span><span class="val">${fmt(subtotal)}</span></div>`
  if (tax > 0) html += `<div class="row"><span class="lbl">VAT / Tax</span><span class="val">${fmt(tax)}</span></div>`
  if (discount > 0) html += `<div class="row"><span class="lbl">Discount</span><span class="val">-${fmt(discount)}</span></div>`
  html += `<div class="row grand"><span class="lbl">TOTAL</span><span class="val">${fmt(total)}</span></div>`
  html += `</div></div>`

  // ── Payment box
  html += `<div class="inv-payment">`
  html += `<div class="pay-icon">✓</div>`
  html += `<div class="pay-info">`
  html += `<div class="pay-status">Payment Received</div>`
  html += `<div class="pay-method">${paymentLabel} • ${fmt(total)}</div>`
  html += `</div>`
  if (change > 0) {
    html += `<div class="pay-change">`
    html += `<div class="change-label">Change</div>`
    html += `<div class="change-val">${fmt(change)}</div>`
    html += `</div>`
  }
  html += `</div>`

  // ── Warranty notice (if any items have warranty)
  if (hasSerials) {
    html += `<div class="inv-warranty-notice">`
    html += `<div class="notice-title">⚠ Warranty Terms &amp; Conditions</div>`
    html += `<div class="notice-text">`
    html += `This invoice serves as proof of purchase for warranty claims. `
    html += `Please retain this document carefully. Warranty covers manufacturing defects only `
    html += `and does not extend to physical damage, water damage, or unauthorized modifications. `
    html += `For warranty service, present this invoice along with the product at the point of purchase.`
    html += `</div></div>`
  }

  // ── Footer
  html += `<div class="inv-footer">`
  if (receiptSettings?.footer) {
    html += `<div class="thanks">${receiptSettings.footer}</div>`
  }
  html += `<div class="footer-text">Thank you for your purchase! &bull; ${businessInfo.phone || ''}<br>Visit us again at ${businessInfo.name || ''}</div>`
  html += `<div class="powered">Powered by CeyPos by Paxxmo</div>`
  html += `</div>`

  return html
}
