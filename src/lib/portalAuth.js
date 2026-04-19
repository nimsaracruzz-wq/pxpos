import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore'

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAXL7uGGsIXNbwHHnNkr0D2zfvU4E8Cmc8',
  authDomain:        'pxpos-7d777.firebaseapp.com',
  projectId:         'pxpos-7d777',
  storageBucket:     'pxpos-7d777.firebasestorage.app',
  messagingSenderId: '759604307830',
  appId:             '1:759604307830:web:09668e1b4e2ff4740cbc57',
}

const PORTAL_SESSION_KEY = 'ceypos.portal.session'

function getDB() {
  const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG)
  return getFirestore(app)
}

async function sha256(input = '') {
  const value = String(input || '')
  const source = typeof globalThis !== 'undefined' ? globalThis.crypto : null

  if (source?.subtle) {
    const bytes = new TextEncoder().encode(value)
    const digest = await source.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  // Fallback for very old environments.
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return `fallback-${Math.abs(hash)}`
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase()
}

function toSession(user) {
  if (!user) return null
  return {
    username: normalizeUsername(user.username),
    fullName: String(user.fullName || user.username || '').trim(),
    role: String(user.role || 'admin').trim().toLowerCase(),
    loggedInAt: new Date().toISOString(),
  }
}

export function getPortalSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PORTAL_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setPortalSession(session) {
  if (typeof window === 'undefined') return
  if (!session) {
    window.localStorage.removeItem(PORTAL_SESSION_KEY)
    return
  }
  window.localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session))
}

export function clearPortalSession() {
  setPortalSession(null)
}

export async function listPortalAdmins() {
  const db = getDB()
  const snap = await getDocs(collection(db, 'portal_admins'))
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function createPortalAdmin({ username, password, fullName = '', role = 'super_admin' }) {
  const cleanUsername = normalizeUsername(username)
  if (!cleanUsername) throw new Error('Username is required')
  if (!String(password || '').trim()) throw new Error('Password is required')

  const db = getDB()
  const passwordHash = await sha256(password)
  const payload = {
    username: cleanUsername,
    fullName: String(fullName || cleanUsername).trim(),
    role: String(role || 'super_admin').trim().toLowerCase(),
    passwordHash,
    active: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  }

  await setDoc(doc(db, 'portal_admins', cleanUsername), payload, { merge: true })
  return payload
}

export async function verifyPortalLogin({ username, password }) {
  const cleanUsername = normalizeUsername(username)
  if (!cleanUsername || !String(password || '').trim()) {
    return { success: false, error: 'Username and password are required' }
  }

  const db = getDB()
  const snap = await getDocs(collection(db, 'portal_admins'))
  const admins = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
  const user = admins.find((item) => normalizeUsername(item.username) === cleanUsername)

  if (!user) {
    return { success: false, error: 'Invalid portal credentials' }
  }

  if (user.active === false) {
    return { success: false, error: 'This portal account is disabled' }
  }

  const passwordHash = await sha256(password)
  if (String(user.passwordHash || '') !== passwordHash) {
    return { success: false, error: 'Invalid portal credentials' }
  }

  await setDoc(doc(db, 'portal_admins', normalizeUsername(user.username)), {
    lastLoginAt: new Date().toISOString(),
  }, { merge: true })

  const session = toSession(user)
  setPortalSession(session)
  return { success: true, user: session }
}
