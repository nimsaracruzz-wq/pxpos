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

const MODULE_KEYS = ['grocery', 'restaurant', 'clothing', 'pharmacy', 'wholesale', 'online']

function normalizeDeploymentMode(value) {
  return String(value || '').trim().toLowerCase() === 'cloud' ? 'cloud' : 'local'
}

function normalizeLicenseModules(modules = {}) {
  const source = modules && typeof modules === 'object' ? modules : {}
  return MODULE_KEYS.reduce((acc, key) => {
    acc[key] = source[key] !== false
    return acc
  }, {})
}

function clampMaxDevices(value) {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(parsed, 50)
}

function normalizeIpAddresses(items) {
  if (!Array.isArray(items)) return []
  return Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)))
}

function normalizeMacAddresses(items) {
  if (!Array.isArray(items)) return []
  return Array.from(new Set(
    items
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
  ))
}

function normalizeActivatedDevices(items = [], legacy = {}) {
  const devices = Array.isArray(items)
    ? items
      .map((item) => ({
        deviceId: String(item?.deviceId || '').trim(),
        hostname: String(item?.hostname || '').trim(),
        ipAddresses: normalizeIpAddresses(item?.ipAddresses),
        lastIp: String(item?.lastIp || '').trim(),
        macAddresses: normalizeMacAddresses(item?.macAddresses),
        lastMac: String(item?.lastMac || '').trim().toLowerCase(),
        activatedAt: item?.activatedAt || null,
        lastSeen: item?.lastSeen || null,
      }))
      .filter((item) => item.deviceId)
    : []

  if (devices.length === 0 && legacy?.deviceId) {
    const legacyIps = normalizeIpAddresses(legacy?.ipAddresses)
    devices.push({
      deviceId: String(legacy.deviceId || '').trim(),
      hostname: String(legacy.hostname || '').trim(),
      ipAddresses: legacyIps,
      lastIp: String(legacy.lastIp || legacyIps[0] || '').trim(),
      macAddresses: normalizeMacAddresses(legacy?.macAddresses),
      lastMac: String(legacy?.lastMac || '').trim().toLowerCase(),
      activatedAt: legacy.activatedAt || null,
      lastSeen: legacy.lastSeen || null,
    })
  }

  return devices
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
  const activatedDevices = normalizeActivatedDevices(data.activatedDevices, data)
  const deploymentMode = normalizeDeploymentMode(data.deploymentMode)
  const modules = normalizeLicenseModules(data.modules)
  return {
    key: normalizedKey,
    businessName: String(data.businessName || '').trim(),
    businessEmail: String(data.businessEmail || '').trim(),
    ownerName: String(data.ownerName || '').trim(),
    plan: String(data.plan || 'basic').trim().toLowerCase(),
    active: Boolean(data.active),
    deploymentMode,
    modules,
    expiresAt: data.expiresAt || null,
    maxDevices: clampMaxDevices(data.maxDevices),
    activatedDevices,
    deviceId: String(data.deviceId || activatedDevices[0]?.deviceId || '').trim(),
    activatedAt: data.activatedAt || activatedDevices[0]?.activatedAt || null,
    lastSeen: data.lastSeen || null,
    notes: String(data.notes || '').trim(),
    createdAt: data.createdAt || nowIso(),
    updatedAt: nowIso(),
  }
}

async function getDeviceContext() {
  let metadata = null
  try {
    if (typeof window !== 'undefined' && window.require) {
      metadata = await window.require('electron').ipcRenderer.invoke('get-device-metadata')
    }
  } catch (_) {}

  const fallbackDeviceId = (() => {
    if (typeof window === 'undefined') return 'dev-browser-mode'
    return String(window.location?.host || 'dev-browser-mode').trim() || 'dev-browser-mode'
  })()

  return {
    deviceId: String(metadata?.deviceId || fallbackDeviceId).trim() || 'dev-browser-mode',
    hostname: String(metadata?.hostname || '').trim(),
    ipAddresses: normalizeIpAddresses(metadata?.ipAddresses),
    lastIp: String(metadata?.lastIp || '').trim(),
    macAddresses: normalizeMacAddresses(metadata?.macAddresses),
    lastMac: String(metadata?.lastMac || '').trim().toLowerCase(),
  }
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
    
    // Add a 5-second timeout. If offline, getDoc will hang forever.
    // If it times out, we throw an error to trigger the transient fallback.
    const snap = await Promise.race([
      getDoc(ref),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 2000))
    ])
    
    const device = await getDeviceContext()
    const deviceId = device.deviceId
    const timestamp = nowIso()

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

    // ── 4. Device lock — one license can allow multiple managed devices ─────
    const maxDevices = clampMaxDevices(data.maxDevices)
    const activatedDevices = normalizeActivatedDevices(data.activatedDevices, data)
    const existingIndex = activatedDevices.findIndex((item) => item.deviceId === deviceId)

    if (existingIndex === -1 && activatedDevices.length >= maxDevices) {
      return {
        valid: false,
        error: `This license already has ${maxDevices} activated device(s). Increase allowed devices or reset one from the portal.`,
      }
    }

    let requiresDbWrite = false
    
    if (existingIndex >= 0) {
      const current = activatedDevices[existingIndex]
      
      const newIps = normalizeIpAddresses([
        ...(current.ipAddresses || []),
        ...(device.ipAddresses || []),
        device.lastIp,
      ])
      const newMacs = normalizeMacAddresses([
        ...(current.macAddresses || []),
        ...(device.macAddresses || []),
        device.lastMac,
      ])
      
      // Only write to DB if we haven't seen this device in 12 hours, or if network info changed
      const hoursSinceLastSeen = current.lastSeen ? (new Date().getTime() - new Date(current.lastSeen).getTime()) / (1000 * 60 * 60) : 999
      
      if (hoursSinceLastSeen > 12 || newIps.length !== (current.ipAddresses?.length || 0) || newMacs.length !== (current.macAddresses?.length || 0)) {
        requiresDbWrite = true
      }

      activatedDevices[existingIndex] = {
        ...current,
        hostname: device.hostname || current.hostname || '',
        ipAddresses: newIps,
        lastIp: device.lastIp || current.lastIp || '',
        macAddresses: newMacs,
        lastMac: device.lastMac || current.lastMac || '',
        lastSeen: timestamp,
      }
    } else {
      requiresDbWrite = true
      activatedDevices.push({
        deviceId,
        hostname: device.hostname,
        ipAddresses: normalizeIpAddresses([...(device.ipAddresses || []), device.lastIp]),
        lastIp: device.lastIp,
        macAddresses: normalizeMacAddresses([...(device.macAddresses || []), device.lastMac]),
        lastMac: device.lastMac,
        activatedAt: timestamp,
        lastSeen: timestamp,
      })
    }

    if (requiresDbWrite) {
      await setDoc(ref, {
        maxDevices,
        activatedDevices,
        deviceId: activatedDevices[0]?.deviceId || deviceId,
        activatedAt: activatedDevices[0]?.activatedAt || timestamp,
        lastSeen: timestamp,
        updatedAt: timestamp,
      }, { merge: true })
    }

    return {
      valid:        true,
      businessName: data.businessName || 'My Store',
      plan:         data.plan         || 'basic',
      expiresAt:    data.expiresAt    || null,
      deploymentMode: normalizeDeploymentMode(data.deploymentMode),
      modules: normalizeLicenseModules(data.modules),
      maxDevices,
      activeDeviceCount: activatedDevices.length,
    }
  } catch (err) {
    console.error('[License]', err)
    return {
      valid: false,
      error: 'Cannot reach license server. Check your internet connection and try again.',
      transient: true,
    }
  }
}

export async function listLicenses() {
  const db = getDB()
  const snap = await getDocs(collection(db, 'licenses'))
  return snap.docs
    .map((item) => {
      const data = item.data() || {}
      const activatedDevices = normalizeActivatedDevices(data.activatedDevices, data)
      return {
        key: item.id,
        ...data,
        deploymentMode: normalizeDeploymentMode(data.deploymentMode),
        modules: normalizeLicenseModules(data.modules),
        maxDevices: clampMaxDevices(data.maxDevices),
        activatedDevices,
      }
    })
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
  await setDoc(ref, { deviceId: '', activatedAt: null, lastSeen: null, activatedDevices: [], updatedAt: nowIso() }, { merge: true })
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
