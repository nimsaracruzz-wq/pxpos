import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore'
import { useAppStore } from '@/store'

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

function nowIso() {
  return new Date().toISOString()
}

function normalizeLicenseKey(key) {
  return String(key || '').trim().toUpperCase()
}

function randomGroup(length = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const source = typeof globalThis !== 'undefined' ? globalThis.crypto : null
  const bytes = new Uint8Array(length)

  if (source?.getRandomValues) {
    source.getRandomValues(bytes)
    return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
  }

  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

export function generateLicenseKey(prefix = 'CEY') {
  return [String(prefix || 'CEY').trim().toUpperCase(), randomGroup(), randomGroup(), randomGroup(), randomGroup()].join('-')
}

export async function checkCurrentLicenseAccess() {
  const { licenseActive, licenseKey } = useAppStore.getState()
  if (!licenseActive || !licenseKey) {
    return { valid: false, error: 'No active license found.' }
  }

  return revalidateLicense(licenseKey)
}

function serializeLicenseDoc(data = {}, key = '') {
  const normalizedKey = normalizeLicenseKey(key || data.key)
  return {
    key: normalizedKey,
    businessName: String(data.businessName || '').trim(),
    businessEmail: String(data.businessEmail || '').trim(),
    ownerName: String(data.ownerName || '').trim(),
    plan: String(data.plan || 'basic').trim().toLowerCase(),
    active: Boolean(data.active),
    expiresAt: data.expiresAt || null,
    deviceId: String(data.deviceId || '').trim(),
    activatedAt: data.activatedAt || null,
    lastSeen: data.lastSeen || null,
    notes: String(data.notes || '').trim(),
    createdAt: data.createdAt || nowIso(),
    updatedAt: nowIso(),
  }
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
    const clean    = String(key || '').trim().toUpperCase()
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

export async function listLicenses() {
  const db = getDB()
  const snap = await getDocs(collection(db, 'licenses'))
  return snap.docs
    .map((item) => ({ key: item.id, ...item.data() }))
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

export async function upsertLicense(license) {
  const db = getDB()
  const key = normalizeLicenseKey(license?.key)
  if (!key) throw new Error('License key is required')

  const ref = doc(db, 'licenses', key)
  const existing = await getDoc(ref)
  const payload = serializeLicenseDoc({
    ...(existing.exists() ? existing.data() : {}),
    ...license,
    key,
    createdAt: existing.exists() ? (existing.data()?.createdAt || nowIso()) : nowIso(),
  }, key)

  await setDoc(ref, payload, { merge: true })
  return payload
}

export async function setLicenseStatus(key, active) {
  const db = getDB()
  const normalizedKey = normalizeLicenseKey(key)
  if (!normalizedKey) throw new Error('License key is required')

  const ref = doc(db, 'licenses', normalizedKey)
  await setDoc(ref, { active: Boolean(active), updatedAt: nowIso() }, { merge: true })
  return { key: normalizedKey, active: Boolean(active) }
}

export async function resetLicenseDevice(key) {
  const db = getDB()
  const normalizedKey = normalizeLicenseKey(key)
  if (!normalizedKey) throw new Error('License key is required')

  const ref = doc(db, 'licenses', normalizedKey)
  await setDoc(ref, { deviceId: '', activatedAt: null, lastSeen: null, updatedAt: nowIso() }, { merge: true })
  return { key: normalizedKey }
}

export async function deleteLicense(key) {
  const db = getDB()
  const normalizedKey = normalizeLicenseKey(key)
  if (!normalizedKey) throw new Error('License key is required')

  await deleteDoc(doc(db, 'licenses', normalizedKey))
  return { key: normalizedKey }
}

/**
 * Re-validates an existing stored license key on every app startup.
 * Returns same shape as validateLicense.
 */
export async function revalidateLicense(key) {
  if (!key) return { valid: false, error: 'No license key found.' }
  return validateLicense(key)
}
