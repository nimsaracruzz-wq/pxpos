import { useEffect, useRef } from 'react'

/**
 * Global barcode scanner utility.
 *
 * USB/Bluetooth barcode scanners send characters very fast (< 50 ms between
 * each key) followed by an Enter keypress. This is the standard "keyboard
 * wedge" mode used by virtually every scanner on the market.
 *
 * Strategy
 * ─────────
 * • One global `keydown` listener is registered on `window`.
 * • Characters arriving faster than THRESHOLD_MS are buffered.
 * • When Enter arrives AND the buffer has at least MIN_LENGTH chars AND all
 *   chars arrived within the threshold window, we treat it as a scan.
 * • A custom DOM event `barcode:scanned` is dispatched on `window` so any
 *   component in the tree can subscribe without prop-drilling.
 *
 * Usage (listen in any component / page):
 *   useBarcodeScanner((code) => { ... })
 *
 * Or listen manually to the DOM event:
 *   window.addEventListener('barcode:scanned', e => console.log(e.detail.code))
 */

const THRESHOLD_MS = 80   // max ms between scanner keystrokes
const MIN_LENGTH   = 3    // minimum chars to count as a barcode scan

// ─── Module-level singleton so we only register ONE listener ─────────────────
let _globalInitialised = false

function initGlobalListener() {
  if (_globalInitialised || typeof window === 'undefined') return
  _globalInitialised = true

  let buffer   = ''
  let lastTime = 0

  window.addEventListener('keydown', (e) => {
    // Ignore modifier-only keys and function keys
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const now  = Date.now()
    const gap  = now - lastTime
    lastTime   = now

    // Reset buffer if the gap is too large (manual typing)
    if (gap > THRESHOLD_MS && buffer.length > 0) {
      buffer = ''
    }

    if (e.key === 'Enter') {
      const code = buffer.trim()
      buffer = ''

      if (code.length >= MIN_LENGTH) {
        // Dispatch to all subscribers via a custom event
        window.dispatchEvent(new CustomEvent('barcode:scanned', {
          detail: { code },
          bubbles: true,
        }))
      }
      return
    }

    // Only accumulate printable single characters
    if (e.key.length === 1) {
      buffer += e.key
    }
  }, { capture: true }) // capture phase so we intercept before inputs
}

// Initialise once at module load time (safe in SSR — guarded by typeof window)
if (typeof window !== 'undefined') {
  initGlobalListener()
}

/**
 * React hook — subscribe to barcode scans on the current page.
 *
 * @param {(code: string) => void} onScan  Called whenever a barcode is scanned.
 * @param {boolean} [enabled=true]         Set false to temporarily pause handling.
 */
export function useBarcodeScanner(onScan, enabled = true) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    if (!enabled) return

    const handler = (e) => {
      if (typeof onScanRef.current === 'function') {
        onScanRef.current(e.detail.code)
      }
    }

    window.addEventListener('barcode:scanned', handler)
    return () => window.removeEventListener('barcode:scanned', handler)
  }, [enabled])
}

export default useBarcodeScanner
