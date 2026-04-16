import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAXL7uGGsIXNbwHHnNkr0D2zfvU4E8Cmc8',
  authDomain:        'pxpos-7d777.firebaseapp.com',
  projectId:         'pxpos-7d777',
  storageBucket:     'pxpos-7d777.firebasestorage.app',
  messagingSenderId: '759604307830',
  appId:             '1:759604307830:web:09668e1b4e2ff4740cbc57',
}

function getDB() {
  const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG)
  return getFirestore(app)
}

// Get this machine's unique hardware fingerprint via Electron IPC
async function getDeviceId() {
  try {
    if (typeof window !== 'undefined' && window.require) {
      return await window.require('electron').ipcRenderer.invoke('get-device-id')
    }
  } catch (_) {}
  return 'dev-browser-mode' // fallback for browser dev only
}

/**
 * Full license validation — called on activation AND on every app startup.
 *
 * Checks:
 *  1. Key exists in Firebase
 *  2. License is active (not revoked by developer)
 *  3. License has not expired
 *  4. Device fingerprint matches (one PC lock)
 */
export async function validateLicense(key) {
  try {
    const db       = getDB()
    const clean    = key.trim().toUpperCase()
    const ref      = doc(db, 'licenses', clean)
    const snap     = await getDoc(ref)
    const deviceId = await getDeviceId()

    // ── 1. Key must exist ────────────────────────────────────────────────────
    if (!snap.exists()) {
      return { valid: false, error: 'Invalid license key. Please check and try again.' }
    }

    const data = snap.data()

    // ── 2. Must be active (developer can revoke anytime) ─────────────────────
    if (!data.active) {
      return { valid: false, error: 'This license has been deactivated. Please contact support.' }
    }

    // ── 3. Must not be expired ───────────────────────────────────────────────
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return {
        valid: false,
        error: `License expired on ${data.expiresAt}. Please renew your subscription.`,
      }
    }

    // ── 4. Device lock — one license = one PC ────────────────────────────────
    if (data.deviceId && data.deviceId !== deviceId) {
      return {
        valid: false,
        error: 'This license is already activated on another computer. Contact support to transfer.',
      }
    }

    // ── First activation: record device + timestamp ──────────────────────────
    if (!data.deviceId || !data.activatedAt) {
      await setDoc(ref, {
        deviceId,
        activatedAt: new Date().toISOString(),
        lastSeen:    new Date().toISOString(),
      }, { merge: true })
    } else {
      // Update last-seen timestamp silently (for your admin visibility)
      setDoc(ref, { lastSeen: new Date().toISOString() }, { merge: true }).catch(() => {})
    }

    return {
      valid:        true,
      businessName: data.businessName || 'My Store',
      plan:         data.plan         || 'basic',
      expiresAt:    data.expiresAt    || null,
    }
  } catch (err) {
    console.error('[License]', err)
    return {
      valid: false,
      error: 'Cannot reach license server. Check your internet connection and try again.',
    }
  }
}

/**
 * Re-validates an existing stored license key on every app startup.
 * Returns same shape as validateLicense.
 */
export async function revalidateLicense(key) {
  if (!key) return { valid: false, error: 'No license key found.' }
  return validateLicense(key)
}
