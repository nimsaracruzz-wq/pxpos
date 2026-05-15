const PROFILE_ALIASES = {
  '80mm': '80mm-raster',
  '58mm': '58mm-raster',
  raster: '80mm-raster',
  'esc/pos': '80mm-escpos',
  escpos: '80mm-escpos',
}

function normalizePaperWidth(paperWidth = '80mm') {
  const raw = String(paperWidth).replace(/[^0-9.]/g, '')
  const paperMm = Math.max(parseFloat(raw) || 80, 40)
  return paperMm < 70 ? '58mm' : '80mm'
}

function normalizePrinterMode(printerMode = 'Raster') {
  const value = String(printerMode).trim().toLowerCase()
  if (value.includes('esc')) return 'ESC/POS'
  return 'Raster'
}

function normalizePrinterProfile(printerProfile = '') {
  const raw = String(printerProfile || '').trim().toLowerCase()
  if (!raw) return '80mm-raster'
  return PROFILE_ALIASES[raw] || raw
}

function buildThermalProfile({ paperWidth = '80mm', printerMode = 'Raster', printerProfile = '' } = {}) {
  const resolvedProfile = normalizePrinterProfile(printerProfile)
  const inferredWidth = resolvedProfile.startsWith('58mm') ? '58mm' : resolvedProfile.startsWith('80mm') ? '80mm' : normalizePaperWidth(paperWidth)
  const resolvedPaperWidth = normalizePaperWidth(inferredWidth)
  const resolvedMode = normalizePrinterMode(resolvedProfile.includes('escpos') ? 'ESC/POS' : printerMode)

  const paperMm = resolvedPaperWidth === '58mm' ? 58 : 80
  const usableMm = paperMm === 58 ? 48 : 72
  const contentMm = paperMm === 58 ? 46 : 67
  // physical pixel mapping (approx for 203 DPI / 8 px per mm)
  const pxPerMm = 8
  const windowPx = Math.round(contentMm * pxPerMm)
  const fontScale = paperMm === 58 ? 0.88 : 1
  // Barcode rendering hints tuned per paper size to improve scanner readability
  // Increase module width and quiet zone for 80mm to improve scanner reliability
  // Sensible defaults: slightly larger than SVG library defaults but not oversized
  const barcodeModuleWidth = paperMm === 58 ? 1.4 : 1.8
  const barcodeQuietZone = paperMm === 58 ? 6 : 8
  const barcodeHeight = paperMm === 58 ? 48 : 64
  const edgePaddingMm = paperMm === 58 ? 4 : 6

  return {
    paperMm,
    paperWidth: `${paperMm}mm`,
    usableMm,
    contentMm,
    contentPx: windowPx,
    windowPx,
    fontScale,
    pxPerMm,
    edgePaddingMm,
    barcodeModuleWidth,
    barcodeQuietZone,
    barcodeHeight,
    printerMode: resolvedMode,
    printerProfile: `${paperMm}mm-${resolvedMode === 'ESC/POS' ? 'escpos' : 'raster'}`,
    is58: paperMm === 58,
  }
}

function receiptProfileOptions() {
  return [
    { value: '80mm-raster', label: '80mm / Raster', paperWidth: '80mm', printerMode: 'Raster' },
    { value: '80mm-escpos', label: '80mm / ESC/POS', paperWidth: '80mm', printerMode: 'ESC/POS' },
    { value: '58mm-raster', label: '58mm / Raster', paperWidth: '58mm', printerMode: 'Raster' },
    { value: '58mm-escpos', label: '58mm / ESC/POS', paperWidth: '58mm', printerMode: 'ESC/POS' },
  ]
}

export {
  buildThermalProfile,
  normalizePaperWidth,
  normalizePrinterMode,
  normalizePrinterProfile,
  receiptProfileOptions,
}