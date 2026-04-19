function normalizeHeaders(headers = {}) {
  const normalized = {}
  Object.keys(headers).forEach((key) => {
    normalized[String(key || '').toLowerCase()] = headers[key]
  })
  return normalized
}

function getHeader(headers, name) {
  return headers[String(name || '').toLowerCase()] || ''
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parsePayload(body) {
  if (!body) return {}
  if (isObject(body)) return body
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return { raw: body }
    }
  }
  return { raw: String(body) }
}

function getReference(payload = {}) {
  return (
    String(payload.reference || '').trim() ||
    String(payload.r || '').trim() ||
    String(payload.qr_reference || '').trim() ||
    String(payload.qrReference || '').trim()
  )
}

export default async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase()

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')

  if (method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: 'helaqr-webhook',
      message: 'Webhook endpoint is live',
      at: new Date().toISOString(),
    })
  }

  if (method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const headers = normalizeHeaders(req.headers || {})
  const webhookSecret = String(process.env.HELAQR_WEBHOOK_SECRET || '').trim()

  if (webhookSecret) {
    const incomingSecret = String(
      getHeader(headers, 'x-webhook-secret') || getHeader(headers, 'x-helaqr-secret') || ''
    ).trim()

    if (!incomingSecret || incomingSecret !== webhookSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized webhook request' })
    }
  }

  const payload = parsePayload(req.body)
  const reference = getReference(payload)
  const paymentStatus = Number(payload.payment_status ?? payload.status ?? payload.paymentStatus)

  // TODO: Persist to DB / queue and reconcile with pending POS sale by receipt or qr reference.
  console.log(
    '[helaqr:webhook]',
    JSON.stringify({
      reference,
      paymentStatus,
      receivedAt: new Date().toISOString(),
      hasPayload: Boolean(payload && Object.keys(payload).length > 0),
    })
  )

  return res.status(200).json({
    ok: true,
    accepted: true,
    reference,
    paymentStatus: Number.isNaN(paymentStatus) ? null : paymentStatus,
  })
}
