import { useEffect, useRef } from 'react'

/**
 * Global barcode scanner utility — single listener for the whole app.
 *
 * HOW IT WORKS
 * ─────────────
 * USB/Bluetooth scanners (keyboard-wedge mode) type characters extremely fast
 * (usually < 30ms between keys). Humans type much slower (> 100ms between keys).
 *
 * Instead of suppressing characters while typing (which can cut characters or
 * leave partial text in inputs), this utility allows characters to flow naturally.
 * When 'Enter' is pressed, it analyzes the gaps between all characters in the
 * current sequence. If they all arrived with very small gaps, we know it's a scanner.
 *
 * In that case, we:
 * 1. Suppress the 'Enter' key so it doesn't trigger searches or form submissions.
 * 2. Clear any text typed into the focused input (using React-compatible resetting).
 * 3. Dispatch the barcode event.
 */

const MAX_KEY_GAP_MS = 100  // maximum gap between characters for scanner speed (increased for slower scanners)
const MIN_LENGTH     = 3    // minimum barcode length
const COOLDOWN_MS    = 800  // ignore same barcode re-fire within this period (reduced for faster re-scan)

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

      if (log.length < MIN_LENGTH) return // too short

      // Check: did all consecutive characters arrive within the scanner gap?
      let isScanner = true
      for (let i = 1; i < log.length; i++) {
        const gap = log[i].time - log[i - 1].time
        if (gap > MAX_KEY_GAP_MS) {
          isScanner = false
          break
        }
      }

      if (!isScanner) return // manual typing — let Enter pass through normally

      const code = log.map(e => e.char).join('').trim()
      if (code.length < MIN_LENGTH) return

      // Per-barcode cooldown — prevent double-fire
      const prevFired = lastFired.get(code) || 0
      if (now - prevFired < COOLDOWN_MS) {
        // Suppress Enter to avoid double-submit
        e.preventDefault()
        e.stopPropagation()
        return
      }
      lastFired.set(code, now)

      // Consume Enter so focused components don't see it
      e.preventDefault()
      e.stopPropagation()

      // Best effort to clear any React-controlled input that the scanner typed into
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        try {
          const prototype = Object.getPrototypeOf(active)
          const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') || 
                             Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          
          if (descriptor && descriptor.set) {
            descriptor.set.call(active, '')
            active.dispatchEvent(new Event('input', { bubbles: true }))
          } else {
            active.value = ''
          }
        } catch (err) {
          console.warn('[BarcodeScanner] Failed to clear React input:', err)
          active.value = ''
        }
      }

      window.dispatchEvent(new CustomEvent('barcode:scanned', {
        detail: { code },
        bubbles: true,
      }))
      return
    }

    // ── Regular character ─────────────────────────────────────────────────────
    if (e.key.length !== 1) return // skip Shift, Tab, Escape, etc.

    // If the gap since the last character is too large, reset the buffer
    const lastEntry = charLog[charLog.length - 1]
    if (lastEntry && (now - lastEntry.time > MAX_KEY_GAP_MS)) {
      charLog = []
    }

    charLog.push({ char: e.key, time: now })
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
    window.dispatchEvent(new CustomEvent('helaqr:debug', { detail: { raw: { msg: 'scanner listener active' } } }))
    window.addEventListener('barcode:scanned', handler)
    return () => window.removeEventListener('barcode:scanned', handler)
  }, [enabled])
}

export default useBarcodeScanner
