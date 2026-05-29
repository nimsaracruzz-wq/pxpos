import { useEffect, useRef } from 'react'

/**
 * Global barcode scanner utility — single listener for the whole app.
 *
 * HOW IT WORKS
 * ─────────────
 * USB/Bluetooth scanners (keyboard-wedge mode) type every character in the
 * barcode in < 50 ms, ending with Enter.  Normal human typing has gaps of
 * 100–400 ms between keys.
 *
 * We accumulate characters with their timestamps.  When Enter arrives we
 * check whether ALL characters arrived within SCAN_WINDOW_MS of each other.
 * If yes → valid scan; if no → manual input, ignore it.
 *
 * A per-barcode COOLDOWN_MS prevents the same code from firing twice within
 * a short window (scanner bounce / accidental double-scan).
 *
 * Characters that are part of a detected scan are consumed via
 * e.preventDefault() so they never reach a focused <input>.
 *
 * Usage:
 *   useBarcodeScanner((code) => { ... })
 *
 * Raw DOM event (no React):
 *   window.addEventListener('barcode:scanned', e => console.log(e.detail.code))
 */

const SCAN_WINDOW_MS = 100   // all chars must arrive within this window
const MIN_LENGTH     = 3     // minimum barcode length
const COOLDOWN_MS    = 1500  // ignore same barcode re-fire within this period

// ─── Module-level singleton ──────────────────────────────────────────────────
let _globalInitialised = false

function initGlobalListener() {
  if (_globalInitialised || typeof window === 'undefined') return
  _globalInitialised = true

  // Each entry: { char, time }
  let charLog = []

  // Cooldown map: barcode → timestamp of last dispatch
  const lastFired = new Map()

  window.addEventListener('keydown', (e) => {
    // Ignore shortcuts
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const now = Date.now()

    // ── Enter: evaluate what we have ──────────────────────────────────────────
    if (e.key === 'Enter') {
      const log = charLog
      charLog = []

      if (log.length < MIN_LENGTH) return // too short — ignore

      // Check: did all characters arrive within the scan window?
      const first = log[0].time
      const last  = log[log.length - 1].time
      const isScanner = (last - first) <= SCAN_WINDOW_MS

      if (!isScanner) return // manual typing — don't treat as barcode

      const code = log.map(e => e.char).join('').trim()
      if (code.length < MIN_LENGTH) return

      // Per-barcode cooldown — prevent double-fire
      const prevFired = lastFired.get(code) || 0
      if (now - prevFired < COOLDOWN_MS) {
        // Already fired this barcode recently — swallow the Enter silently
        e.preventDefault()
        e.stopPropagation()
        return
      }
      lastFired.set(code, now)

      // Consume Enter so the focused input never sees it
      e.preventDefault()
      e.stopPropagation()

      window.dispatchEvent(new CustomEvent('barcode:scanned', {
        detail: { code },
        bubbles: true,
      }))
      return
    }

    // ── Regular character ─────────────────────────────────────────────────────
    if (e.key.length !== 1) return // skip Shift, Tab, etc.

    // If the previous char was too long ago, clear the log (stale data)
    if (charLog.length > 0 && now - charLog[charLog.length - 1].time > SCAN_WINDOW_MS * 3) {
      charLog = []
    }

    charLog.push({ char: e.key, time: now })

    // Speculatively suppress the keystroke if it looks like scanner input.
    // We check: are ALL chars so far arriving fast (within SCAN_WINDOW_MS)?
    if (charLog.length >= 2) {
      const spanSoFar = now - charLog[0].time
      if (spanSoFar <= SCAN_WINDOW_MS) {
        // Looks like a scanner — eat the character
        e.preventDefault()
        e.stopPropagation()
      }
    }
    // Note: the very first char is never suppressed (we can't know yet).
    // But a single stray char won't match MIN_LENGTH anyway.
  }, { capture: true })
}

// Initialise once at module load time
if (typeof window !== 'undefined') {
  initGlobalListener()
}

/**
 * React hook — subscribe to barcode scans.
 *
 * @param {(code: string) => void} onScan   Callback when a valid scan arrives.
 * @param {boolean} [enabled=true]          Set false to pause.
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
