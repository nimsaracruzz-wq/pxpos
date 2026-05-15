/**
 * GS1 Barcode Parser – Sri Lanka Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * Sri Lanka is assigned GS1 country prefix 479 (GS1 Sri Lanka).
 * Products from Sri Lanka carry EAN-13 barcodes starting with 479.
 *
 * For batch / expiry tracking, suppliers use GS1-128 (Code 128) barcodes
 * encoded with Application Identifiers (AIs):
 *
 *   AI (00) → SSCC (Serial Shipping Container Code, 18 digits)
 *   AI (01) → GTIN (14-digit Global Trade Item Number)
 *   AI (02) → GTIN of items inside a container
 *   AI (10) → Batch / Lot Number        (variable length, up to 20 chars)
 *   AI (11) → Production Date           (YYMMDD)
 *   AI (13) → Packaging Date            (YYMMDD)
 *   AI (15) → Best Before / Use-By Date (YYMMDD)
 *   AI (17) → Expiration Date           (YYMMDD)  ← most common
 *   AI (21) → Serial Number             (variable length)
 *   AI (30) → Variable count of items
 *   AI (310n)→ Net weight kg  (n decimal places)
 *   AI (37) → Count of trade items contained in a logistic unit
 *
 * GS1-128 format can be:
 *   ]C1(01)04791234567890(17)260531(10)BATCH001
 *   or without parentheses (raw string with FNC1 separator \x1d):
 *   0104791234567890172605311\x1d10BATCH001
 *
 * This parser handles both formats and also detects raw EAN-13 SL barcodes.
 */

// FNC1 character used as separator in raw GS1-128 strings
const FNC1 = '\x1d'

// ─── AI definitions (length: fixed number or null for variable) ───────────────
const AI_TABLE = [
  // Fixed-length AIs
  { ai: '00', length: 18, name: 'sscc',           label: 'SSCC' },
  { ai: '01', length: 14, name: 'gtin',            label: 'GTIN' },
  { ai: '02', length: 14, name: 'gtinContent',     label: 'Content GTIN' },
  { ai: '11', length: 6,  name: 'productionDate',  label: 'Production Date' },
  { ai: '12', length: 6,  name: 'dueDate',         label: 'Due Date' },
  { ai: '13', length: 6,  name: 'packagingDate',   label: 'Packaging Date' },
  { ai: '15', length: 6,  name: 'bestBefore',      label: 'Best Before Date' },
  { ai: '16', length: 6,  name: 'sellBy',          label: 'Sell By Date' },
  { ai: '17', length: 6,  name: 'expiryRaw',       label: 'Expiry Date' },
  { ai: '20', length: 2,  name: 'variant',         label: 'Variant' },
  { ai: '31', length: 6,  name: 'netWeightKg',     label: 'Net Weight (kg)' },
  { ai: '32', length: 6,  name: 'netWeightLb',     label: 'Net Weight (lb)' },
  { ai: '37', length: 8,  name: 'count',           label: 'Count' },
  // Variable-length AIs (terminated by FNC1 or end of string)
  { ai: '10', length: null, maxLen: 20, name: 'batch',  label: 'Batch/Lot' },
  { ai: '21', length: null, maxLen: 20, name: 'serial', label: 'Serial Number' },
  { ai: '30', length: null, maxLen: 8,  name: 'qty',    label: 'Variable Qty' },
  { ai: '240',length: null, maxLen: 30, name: 'additionalProductId', label: 'Additional Product ID' },
  { ai: '241',length: null, maxLen: 30, name: 'customerPartNo',      label: 'Customer Part No.' },
  { ai: '91', length: null, maxLen: 90, name: 'companyInternal1',    label: 'Company Internal 1' },
  { ai: '92', length: null, maxLen: 90, name: 'companyInternal2',    label: 'Company Internal 2' },
]

// Sort so longer AIs are matched first (avoid '1' matching before '10')
const SORTED_AIS = [...AI_TABLE].sort((a, b) => b.ai.length - a.ai.length)

/**
 * Parse a YYMMDD GS1 date string into an ISO date string (YYYY-MM-DD).
 * Per GS1 spec: YY 00-49 → 2000-2049, YY 50-99 → 1950-1999.
 * Day = 00 means last day of the month.
 */
function parseGs1Date(yymmdd) {
  if (!yymmdd || yymmdd.length !== 6) return null
  const yy = parseInt(yymmdd.slice(0, 2), 10)
  const mm = parseInt(yymmdd.slice(2, 4), 10)
  let dd = parseInt(yymmdd.slice(4, 6), 10)
  const year = yy <= 49 ? 2000 + yy : 1900 + yy

  if (mm < 1 || mm > 12) return null

  if (dd === 0) {
    // Last day of month
    dd = new Date(year, mm, 0).getDate()
  }

  const iso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  return iso
}

/**
 * Strip GS1 symbology identifier prefix (e.g. ]C1, ]e0, ]d2).
 */
function stripSymbologyId(raw) {
  return raw.replace(/^\][A-Za-z]\d/, '')
}

/**
 * Normalize parenthesized AI format:
 *   "(01)04791234567890(17)260531(10)BATCH"
 * → raw string without parens, variable-length AIs terminated by FNC1.
 */
function normalizeParenthesized(str) {
  // Already normalized if no parens
  if (!str.includes('(')) return str

  // Split on AI groups: (nn) value
  const regex = /\((\d{2,4})\)([^(]*)/g
  let match
  let result = ''
  while ((match = regex.exec(str)) !== null) {
    const ai = match[1]
    const value = match[2].replace(FNC1, '') // clean any existing FNC1
    const aiDef = SORTED_AIS.find((a) => a.ai === ai)
    // If variable-length, append FNC1 after value so parser can split correctly
    if (aiDef && aiDef.length === null) {
      result += ai + value + FNC1
    } else {
      result += ai + value
    }
  }
  return result
}

/**
 * Core parser. Returns an object with all decoded AI fields.
 */
function parseGs1String(raw) {
  if (!raw || typeof raw !== 'string') return {}

  let str = raw.trim()
  str = stripSymbologyId(str)
  str = normalizeParenthesized(str)

  const result = {}
  let i = 0

  while (i < str.length) {
    // Skip any FNC1 separator characters
    if (str[i] === FNC1) { i++; continue }

    // Try to match an AI starting at position i
    let matched = false
    for (const aiDef of SORTED_AIS) {
      if (str.startsWith(aiDef.ai, i)) {
        const valueStart = i + aiDef.ai.length

        let value
        if (aiDef.length !== null) {
          // Fixed length
          value = str.slice(valueStart, valueStart + aiDef.length)
          i = valueStart + aiDef.length
        } else {
          // Variable length: read until FNC1 or end of string
          const fnc1Pos = str.indexOf(FNC1, valueStart)
          if (fnc1Pos === -1) {
            value = str.slice(valueStart, valueStart + (aiDef.maxLen || 90))
            i = str.length
          } else {
            value = str.slice(valueStart, fnc1Pos)
            i = fnc1Pos + 1
          }
        }

        result[aiDef.name] = value
        matched = true
        break
      }
    }

    if (!matched) {
      // Unknown AI — skip one character to avoid infinite loop
      i++
    }
  }

  return result
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main function: parse any barcode string and return structured data.
 *
 * Returns:
 * {
 *   type: 'EAN13' | 'EAN8' | 'GS1-128' | 'UNKNOWN',
 *   isSriLanka: boolean,       // true if GTIN starts with 479
 *   gtin: string,              // full GTIN if present
 *   productCode: string,       // best product-lookup code (barcode field)
 *   batch: string | null,      // batch/lot number
 *   expiryDate: string | null, // ISO date YYYY-MM-DD
 *   bestBefore: string | null, // ISO date YYYY-MM-DD
 *   productionDate: string | null,
 *   serial: string | null,
 *   raw: object,               // all parsed AI fields
 * }
 */
export function parseBarcode(input) {
  if (!input || typeof input !== 'string') return null
  const str = input.trim()

  const result = {
    type: 'UNKNOWN',
    isSriLanka: false,
    gtin: null,
    productCode: str,
    batch: null,
    expiryDate: null,
    bestBefore: null,
    productionDate: null,
    serial: null,
    raw: {},
  }

  // ── EAN-13 / EAN-8 detection (pure numeric, no AIs) ──────────────────────
  const isNumericOnly = /^\d+$/.test(str)
  if (isNumericOnly && (str.length === 13 || str.length === 12)) {
    result.type = 'EAN13'
    result.gtin = str.length === 12 ? '0' + str : str
    result.productCode = str
    result.isSriLanka = result.gtin.startsWith('479')
    return result
  }
  if (isNumericOnly && str.length === 8) {
    result.type = 'EAN8'
    result.productCode = str
    return result
  }

  // ── GS1-128 / GS1 DataMatrix detection ───────────────────────────────────
  const parsed = parseGs1String(str)
  if (Object.keys(parsed).length === 0) return result

  result.type = 'GS1-128'
  result.raw = parsed

  // GTIN
  const rawGtin = parsed.gtin || parsed.gtinContent || null
  if (rawGtin) {
    result.gtin = rawGtin
    // For product lookup, strip leading zeros to get EAN-13
    result.productCode = rawGtin.replace(/^0+/, '') || rawGtin
    result.isSriLanka = rawGtin.startsWith('479') || rawGtin.startsWith('0479')
  }

  // Batch / Lot
  result.batch = parsed.batch || null

  // Serial
  result.serial = parsed.serial || null

  // Expiry (AI 17 takes priority, then AI 15 best-before)
  if (parsed.expiryRaw) result.expiryDate = parseGs1Date(parsed.expiryRaw)
  if (parsed.bestBefore) result.bestBefore = parseGs1Date(parsed.bestBefore)
  if (parsed.productionDate) result.productionDate = parseGs1Date(parsed.productionDate)

  return result
}

/**
 * Human-readable summary of a parsed barcode for display in toasts / UI.
 */
export function describeParsedBarcode(parsed) {
  if (!parsed) return 'Unknown barcode'
  const parts = []
  if (parsed.gtin) parts.push(`GTIN: ${parsed.gtin}`)
  if (parsed.batch) parts.push(`Batch: ${parsed.batch}`)
  if (parsed.expiryDate) parts.push(`Expiry: ${parsed.expiryDate}`)
  if (parsed.bestBefore) parts.push(`Best Before: ${parsed.bestBefore}`)
  if (parsed.serial) parts.push(`Serial: ${parsed.serial}`)
  if (parsed.isSriLanka) parts.push('🇱🇰 SL Product')
  return parts.join(' · ') || parsed.productCode
}
