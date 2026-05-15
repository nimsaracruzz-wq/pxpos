/**
 * printReceipt.js — standalone print utility (no React components)
 * Extracted here to satisfy Vite Fast Refresh rules:
 * non-component exports cannot live alongside React component exports.
 *
 * Receipts are rendered as true thermal pages in physical units so Chromium
 * does not shrink a 576px layout into a 58mm-looking printout.
 */

import { buildThermalProfile } from '@/lib/thermalPrinter'

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
