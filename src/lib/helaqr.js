import { useAppStore } from '@/store'

let cachedAccessToken = ''
let cachedRefreshToken = ''

function trimSlash(url) {
  return String(url || '').trim().replace(/\/$/, '')
}

function getSettings() {
  const { helaQRSettings } = useAppStore.getState()
  return helaQRSettings || {}
}

function isConfigured(settings) {
  return Boolean(
    String(settings?.baseUrl || '').trim() &&
    String(settings?.appId || '').trim() &&
    String(settings?.appSecret || '').trim() &&
    String(settings?.businessId || '').trim()
  )
}

function buildBasicAuth(appId, appSecret) {
  const raw = `${String(appId || '').trim()}:${String(appSecret || '').trim()}`
  if (typeof btoa === 'function') return btoa(raw)
  return Buffer.from(raw).toString('base64')
}

// ─── Transport layer: uses Electron IPC (no CORS) when available ─────────────
async function ipcFetch(url, { method = 'POST', headers = {}, body } = {}) {
  if (typeof window !== 'undefined' && window.require) {
    // Electron renderer → proxy through main process (Node.js, no CORS)
    const ipcRenderer = window.require('electron').ipcRenderer
    return ipcRenderer.invoke('helaqr-fetch', { url, method, headers, body })
  }
  // Plain browser fallback (works only if server has CORS enabled)
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function requestToken() {
  const settings = getSettings()
  const baseUrl = trimSlash(settings.baseUrl)

  if (!isConfigured(settings)) {
    throw new Error('HelaQR settings are incomplete')
  }

  const url = `${baseUrl}/merchant/api/v1/getToken`
  console.log('[HelaQR] requestToken →', url)
  const result = await ipcFetch(url, {
    body: { grant_type: 'client_credentials' },
    headers: { Authorization: `Basic ${buildBasicAuth(settings.appId, settings.appSecret)}` },
  })

  const data = result.data
  console.log('[HelaQR] requestToken response', result.status, JSON.stringify(data))

  if (!result.ok || Number(data?.code || 0) !== 200 || !data?.accessToken) {
    throw new Error(data?.message || result.error || 'Failed to get HelaQR access token')
  }

  cachedAccessToken = String(data.accessToken || '')
  cachedRefreshToken = String(data.refreshToken || '')
  return cachedAccessToken
}

async function refreshToken() {
  const settings = getSettings()
  const baseUrl = trimSlash(settings.baseUrl)

  if (!cachedRefreshToken) {
    return requestToken()
  }

  const url = `${baseUrl}/merchant/api/v1/merchant/auth/refresh`
  const result = await ipcFetch(url, { body: { refreshToken: cachedRefreshToken } })
  const data = result.data
  const row = Array.isArray(data?.data) ? data.data[0] : null
  const nextToken = String(row?.accessToken || '').trim()

  if (!result.ok || Number(data?.code || 0) !== 200 || !nextToken) {
    return requestToken()
  }

  cachedAccessToken = nextToken
  cachedRefreshToken = String(row?.refreshToken || cachedRefreshToken || '').trim()
  return cachedAccessToken
}

async function withBearer(path, payload = {}) {
  const settings = getSettings()
  const baseUrl = trimSlash(settings.baseUrl)

  if (!isConfigured(settings)) {
    throw new Error('HelaQR settings are incomplete')
  }

  const url = `${baseUrl}${path}`

  const doRequest = async (token) => {
    console.log('[HelaQR] withBearer →', url, JSON.stringify(payload))
    const result = await ipcFetch(url, {
      body: payload,
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log('[HelaQR] withBearer response', result.status, JSON.stringify(result.data))
    return result
  }

  const token = cachedAccessToken || (await requestToken())
  let result = await doRequest(token)

  const isUnauthorized =
    result.status === 401 ||
    String(result.data?.statusCode || '') === '401' ||
    String(result.data?.code || '') === '401'

  if (isUnauthorized) {
    const next = await refreshToken()
    result = await doRequest(next)
  }

  return { ok: result.ok, status: result.status, data: result.data }
}

export function getHelaQRConfigStatus() {
  const settings = getSettings()
  return {
    configured: isConfigured(settings),
    enabled: Boolean(settings?.enabled),
    settings,
  }
}

// Deep-scan an object for any string value that looks like QR payload data
// (long alphanumeric/URL string — typical for QR codes)
function deepFindQrString(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return ''
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string' && val.length > 10) {
      const lk = key.toLowerCase()
      // Prefer keys with "qr" in the name
      if (lk.includes('qr') || lk.includes('data') || lk.includes('code') || lk.includes('payload')) {
        return val
      }
    }
    if (val && typeof val === 'object') {
      const found = deepFindQrString(val, depth + 1)
      if (found) return found
    }
  }
  // Second pass: any long string
  for (const val of Object.values(obj)) {
    if (typeof val === 'string' && val.length > 20) return val
    if (val && typeof val === 'object') {
      const found = deepFindQrString(val, depth + 1)
      if (found) return found
    }
  }
  return ''
}

export async function generateHelaQRPayment({ amount, reference }) {
  const settings = getSettings()
  const payload = {
    b: String(settings.businessId || '').trim(),
    r: String(reference || '').trim(),
    am: Number(Number(amount || 0).toFixed(2)),
  }

  const { ok, data } = await withBearer('/merchant/api/helapos/qr/generate', payload)

  // ── Emit debug event so the UI can show the raw response ──────────────────
  const rawJson = JSON.stringify(data)
  console.log('[HelaQR] generateHelaQRPayment RAW:', rawJson)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('helaqr:debug', { detail: { ok, raw: data } }))
  }

  // ── Flexible field extraction ─────────────────────────────────────────────
  const nestedData = Array.isArray(data?.data) ? data?.data[0] : (data?.data || {})

  // Try every known field name first, then deep-scan as last resort
  const qrDataStr = String(
    data?.qr_data        || nestedData?.qr_data        ||
    data?.qrData         || nestedData?.qrData         ||
    data?.qr_string      || nestedData?.qr_string      ||
    data?.qrString       || nestedData?.qrString       ||
    data?.qr_code        || nestedData?.qr_code        ||
    data?.qrCode         || nestedData?.qrCode         ||
    data?.qr             || nestedData?.qr             ||
    data?.qr_payload     || nestedData?.qr_payload     ||
    data?.payload        || nestedData?.payload        ||
    deepFindQrString(data) ||
    ''
  )

  const qrRefStr = String(
    data?.qr_reference   || nestedData?.qr_reference   ||
    data?.qrReference    || nestedData?.qrReference    ||
    data?.reference_id   || nestedData?.reference_id   ||
    ''
  )

  // Success: HTTP ok + statusCode 200 OR HTTP ok + we got qr data
  const statusOk = ok && (String(data?.statusCode || '') === '200' || Number(data?.statusCode) === 200 || String(data?.code || '') === '200' || Number(data?.code) === 200)
  const success = statusOk || (ok && !!qrDataStr)

  console.log('[HelaQR] success:', success, '| qrData length:', qrDataStr.length, '| qrRef:', qrRefStr)

  if (!success) {
    return {
      success: false,
      error: data?.statusMessage || data?.message || data?.error || `HelaQR API error (HTTP ${ok ? 'ok' : 'fail'}) — check console`,
      raw: data,
    }
  }

  return {
    success: true,
    qrData: qrDataStr,
    qrReference: qrRefStr,
    reference: String(data?.reference || nestedData?.reference || payload.r),
    raw: data,
  }
}

export async function checkHelaQRPaymentStatus({ reference, qrReference }) {
  const payload = {}
  if (reference) payload.reference = String(reference)
  if (qrReference) payload.qr_reference = String(qrReference)

  if (!payload.reference && !payload.qr_reference) {
    return { success: false, error: 'reference or qr_reference is required' }
  }

  // ── Step 1: Check Firestore for webhook-confirmed payment (instant) ────────
  // The Vercel webhook writes to helaqr_payments/{reference} when HelaQR POSTs
  // a payment notification. Checking here avoids waiting for the poll interval.
  if (reference) {
    try {
      const { getApps, getApp, initializeApp } = await import('firebase/app')
      const { getFirestore, doc, getDoc } = await import('firebase/firestore')
      const apps = getApps()
      const app = apps.length > 0 ? apps[0] : null
      if (app) {
        const db = getFirestore(app)
        const snap = await getDoc(doc(db, 'helaqr_payments', String(reference)))
        if (snap.exists()) {
          const data = snap.data() || {}
          console.log('[HelaQR] Webhook Firestore hit —', reference, 'isPaid:', data.isPaid)
          return {
            success: true,
            paymentStatus: data.paymentStatus ?? null,
            isPaid: Boolean(data.isPaid),
            isPending: !data.isPaid,
            isFailed: false,
            sale: data,
            raw: data,
            source: 'webhook',
          }
        }
      }
    } catch (fsErr) {
      // Firestore unavailable — fall through to API polling
      console.warn('[HelaQR] Firestore webhook check failed, using API poll:', fsErr?.message)
    }
  }

  // ── Step 2: Fallback — poll the HelaQR API directly ───────────────────────
  const { ok, data } = await withBearer('/merchant/api/helapos/sales/getSaleStatus', payload)
  const success = ok && String(data?.statusCode || '') === '200'

  if (!success) {
    return {
      success: false,
      error: data?.statusMessage || data?.message || 'Failed to fetch HelaQR status',
      raw: data,
    }
  }

  const nestedData = Array.isArray(data?.data) ? data?.data[0] : (data?.data || {})
  const saleObj = data?.sale || nestedData?.sale || data || nestedData

  // Look for different common field names for payment status
  const rawStatus = saleObj?.payment_status ?? saleObj?.paymentStatus ?? saleObj?.status ?? saleObj?.state

  // Determine if paid based on common API patterns
  const strStatus = String(rawStatus || '').toUpperCase().trim()
  const numStatus = Number(rawStatus)

  const isPaid = 
    numStatus === 2 || 
    numStatus === 1 || 
    strStatus === 'PAID' || 
    strStatus === 'COMPLETED' || 
    strStatus === 'SUCCESS' || 
    strStatus === 'DONE'

  const isFailed = 
    numStatus === -1 || 
    numStatus === 3 || 
    numStatus === 4 || 
    strStatus === 'FAILED' || 
    strStatus === 'EXPIRED' || 
    strStatus === 'CANCELLED' || 
    strStatus === 'REJECTED'

  return {
    success: true,
    paymentStatus: rawStatus,
    isPaid,
    isPending: numStatus === 0 || strStatus === 'PENDING',
    isFailed,
    sale: saleObj,
    raw: data,
    source: 'api',
  }
}
