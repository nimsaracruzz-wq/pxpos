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

async function requestToken() {
  const settings = getSettings()
  const baseUrl = trimSlash(settings.baseUrl)

  if (!isConfigured(settings)) {
    throw new Error('HelaQR settings are incomplete')
  }

  const res = await fetch(`${baseUrl}/merchant/api/v1/getToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${buildBasicAuth(settings.appId, settings.appSecret)}`,
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || Number(data?.code || 0) !== 200 || !data?.accessToken) {
    throw new Error(data?.message || 'Failed to get HelaQR access token')
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

  const res = await fetch(`${baseUrl}/merchant/api/v1/merchant/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken: cachedRefreshToken }),
  })

  const data = await res.json().catch(() => ({}))
  const row = Array.isArray(data?.data) ? data.data[0] : null
  const nextToken = String(row?.accessToken || '').trim()

  if (!res.ok || Number(data?.code || 0) !== 200 || !nextToken) {
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

  const doRequest = async (token) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  const token = cachedAccessToken || (await requestToken())
  let { res, data } = await doRequest(token)

  if (res.status === 401) {
    const next = await refreshToken()
    const retry = await doRequest(next)
    res = retry.res
    data = retry.data
  }

  return { ok: res.ok, status: res.status, data }
}

export function getHelaQRConfigStatus() {
  const settings = getSettings()
  return {
    configured: isConfigured(settings),
    enabled: Boolean(settings?.enabled),
    settings,
  }
}

export async function generateHelaQRPayment({ amount, reference }) {
  const settings = getSettings()
  const payload = {
    b: String(settings.businessId || '').trim(),
    r: String(reference || '').trim(),
    am: Number(amount || 0),
  }

  const { ok, data } = await withBearer('/merchant/api/helapos/qr/generate', payload)
  const success = ok && String(data?.statusCode || '') === '200'

  if (!success) {
    return {
      success: false,
      error: data?.statusMessage || data?.message || 'Failed to generate HelaQR',
      raw: data,
    }
  }

  return {
    success: true,
    qrData: String(data?.qr_data || ''),
    qrReference: String(data?.qr_reference || ''),
    reference: String(data?.reference || payload.r),
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

  const { ok, data } = await withBearer('/merchant/api/helapos/sales/getSaleStatus', payload)
  const success = ok && String(data?.statusCode || '') === '200'

  if (!success) {
    return {
      success: false,
      error: data?.statusMessage || data?.message || 'Failed to fetch HelaQR status',
      raw: data,
    }
  }

  const paymentStatus = Number(data?.sale?.payment_status)
  return {
    success: true,
    paymentStatus,
    isPaid: paymentStatus === 2,
    isFailed: paymentStatus === -1,
    isPending: paymentStatus === 0,
    sale: data?.sale || null,
    raw: data,
  }
}
