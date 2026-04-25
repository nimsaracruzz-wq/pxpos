/**
 * HelaQR Payment Webhook — Vercel Serverless Function
 * 
 * HelaQR POSTs here when a payment is confirmed.
 * We write the result to Firestore (using the client SDK + service account key)
 * so the desktop POS can detect it instantly without polling the HelaQR API.
 *
 * GET  /api/helaqr/webhook  → health check (always returns 200)
 * POST /api/helaqr/webhook  → receives HelaQR payment notification
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeHeaders(headers = {}) {
  const out = {}
  Object.keys(headers).forEach((k) => { out[k.toLowerCase()] = headers[k] })
  return out
}
function getHeader(h, name) { return h[name.toLowerCase()] || '' }
function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function parsePayload(body) {
  if (!body) return {}
  if (isObject(body)) return body
  if (typeof body === 'string') { try { return JSON.parse(body) } catch { return { raw: body } } }
  return { raw: String(body) }
}
function getReference(p = {}) {
  return (
    String(p.reference    || '').trim() ||
    String(p.r            || '').trim() ||
    String(p.qr_reference || '').trim() ||
    String(p.qrReference  || '').trim()
  )
}
function resolveIsPaid(p = {}) {
  const raw = p.payment_status ?? p.paymentStatus ?? p.status ?? p.state
  const num = Number(raw)
  const str = String(raw || '').toUpperCase().trim()
  return num === 2 || num === 1 ||
    str === 'PAID' || str === 'COMPLETED' || str === 'SUCCESS' || str === 'DONE'
}

// ─── Firestore write (using REST API — no firebase-admin needed) ──────────────
// Uses the Firebase REST API with a service-account access token so we don't
// need to install firebase-admin (which is a large native dependency).
async function writePaymentToFirestore(reference, payload, isPaid) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'pxpos-7d777'
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

  if (!serviceAccountJson) {
    console.warn('[webhook] FIREBASE_SERVICE_ACCOUNT_JSON not set — skipping Firestore write')
    return { skipped: true, reason: 'No service account' }
  }

  // Build a JWT to get an access token
  let serviceAccount
  try { serviceAccount = JSON.parse(serviceAccountJson) } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON')
  }

  // Encode JWT header + payload
  const now = Math.floor(Date.now() / 1000)
  const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const jwtClaims = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  })).toString('base64url')

  const signingInput = `${jwtHeader}.${jwtClaims}`

  // Sign with the private key using Node's crypto
  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(serviceAccount.private_key, 'base64url')
  const jwt = `${signingInput}.${signature}`

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`)
  }

  // Write to Firestore via REST
  const docPath = `projects/${projectId}/databases/(default)/documents/helaqr_payments/${encodeURIComponent(reference)}`
  const firestoreUrl = `https://firestore.googleapis.com/v1/${docPath}`

  const fields = {
    reference:     { stringValue: String(reference) },
    isPaid:        { booleanValue: isPaid },
    paymentStatus: { stringValue: String(payload.payment_status ?? payload.paymentStatus ?? payload.status ?? '') },
    receivedAt:    { stringValue: new Date().toISOString() },
    updatedAt:     { stringValue: new Date().toISOString() },
  }

  const patchRes = await fetch(`${firestoreUrl}?updateMask.fieldPaths=reference&updateMask.fieldPaths=isPaid&updateMask.fieldPaths=paymentStatus&updateMask.fieldPaths=receivedAt&updateMask.fieldPaths=updatedAt`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!patchRes.ok) {
    const errBody = await patchRes.text()
    throw new Error(`Firestore PATCH failed (${patchRes.status}): ${errBody}`)
  }

  return { saved: true }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase()
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')

  // Health-check — always responds 200 for GET
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

  // Optional secret validation
  const headers = normalizeHeaders(req.headers || {})
  const secret = String(process.env.HELAQR_WEBHOOK_SECRET || '').trim()
  if (secret) {
    const incoming = String(
      getHeader(headers, 'x-webhook-secret') ||
      getHeader(headers, 'x-helaqr-secret') || ''
    ).trim()
    if (!incoming || incoming !== secret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }
  }

  const payload    = parsePayload(req.body)
  const reference  = getReference(payload)
  const isPaid     = resolveIsPaid(payload)
  const receivedAt = new Date().toISOString()

  console.log('[helaqr:webhook] POST received', JSON.stringify({ reference, isPaid, receivedAt }))

  if (!reference) {
    return res.status(400).json({ ok: false, error: 'Missing reference in payload' })
  }

  // Write to Firestore so POS can detect this instantly
  let firestoreResult = {}
  try {
    firestoreResult = await writePaymentToFirestore(reference, payload, isPaid)
    console.log('[helaqr:webhook] Firestore write:', JSON.stringify(firestoreResult))
  } catch (err) {
    console.error('[helaqr:webhook] Firestore error:', err?.message)
    firestoreResult = { error: err?.message }
  }

  // Always return 200 to HelaQR so they don't retry
  return res.status(200).json({
    ok: true,
    accepted: true,
    reference,
    isPaid,
    firestore: firestoreResult,
  })
}
