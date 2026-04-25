import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ─── Firebase Admin init (Vercel env vars) ────────────────────────────────────
function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set on Vercel')
    }
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
  }
  return getFirestore()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeHeaders(headers = {}) {
  const out = {}
  Object.keys(headers).forEach((k) => { out[k.toLowerCase()] = headers[k] })
  return out
}

function getHeader(headers, name) {
  return headers[String(name).toLowerCase()] || ''
}

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }

function parsePayload(body) {
  if (!body) return {}
  if (isObject(body)) return body
  if (typeof body === 'string') { try { return JSON.parse(body) } catch { return { raw: body } } }
  return { raw: String(body) }
}

function getReference(payload = {}) {
  return (
    String(payload.reference    || '').trim() ||
    String(payload.r            || '').trim() ||
    String(payload.qr_reference || '').trim() ||
    String(payload.qrReference  || '').trim()
  )
}

/**
 * Determine if the payload indicates a successful payment.
 * HelaQR typically uses: payment_status=2 or status="PAID"/"COMPLETED"
 */
function resolveIsPaid(payload = {}) {
  const raw = payload.payment_status ?? payload.paymentStatus ?? payload.status ?? payload.state
  const num = Number(raw)
  const str = String(raw || '').toUpperCase().trim()
  return (
    num === 2 || num === 1 ||
    str === 'PAID' || str === 'COMPLETED' || str === 'SUCCESS' || str === 'DONE'
  )
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase()
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')

  // Health-check — lets the POS Settings page confirm the URL is reachable
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

  // ── Optional secret validation ────────────────────────────────────────────
  const headers = normalizeHeaders(req.headers || {})
  const webhookSecret = String(process.env.HELAQR_WEBHOOK_SECRET || '').trim()
  if (webhookSecret) {
    const incoming = String(
      getHeader(headers, 'x-webhook-secret') ||
      getHeader(headers, 'x-helaqr-secret') || ''
    ).trim()
    if (!incoming || incoming !== webhookSecret) {
      console.warn('[helaqr:webhook] Unauthorized — bad or missing secret')
      return res.status(401).json({ ok: false, error: 'Unauthorized webhook request' })
    }
  }

  const payload  = parsePayload(req.body)
  const reference = getReference(payload)
  const isPaid   = resolveIsPaid(payload)
  const receivedAt = new Date().toISOString()

  console.log('[helaqr:webhook] received', JSON.stringify({ reference, isPaid, receivedAt }))

  if (!reference) {
    return res.status(400).json({ ok: false, error: 'Missing reference in payload' })
  }

  // ── Write confirmed payment to Firestore ──────────────────────────────────
  // The POS polls this collection to detect confirmed payments instantly.
  try {
    const db = getAdminDb()
    await db.collection('helaqr_payments').doc(reference).set({
      reference,
      isPaid,
      paymentStatus: payload.payment_status ?? payload.paymentStatus ?? payload.status ?? null,
      rawPayload: payload,
      receivedAt,
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    console.log('[helaqr:webhook] saved to Firestore —', reference, 'isPaid:', isPaid)
  } catch (err) {
    console.error('[helaqr:webhook] Firestore write failed:', err?.message || err)
    // Still return 200 so HelaQR doesn't retry forever.
    // The POS will fall back to polling the HelaQR API directly.
    return res.status(200).json({
      ok: true,
      accepted: true,
      warning: 'Firestore write failed — POS will use API polling fallback',
      reference,
      isPaid,
    })
  }

  return res.status(200).json({
    ok: true,
    accepted: true,
    reference,
    isPaid,
    savedToFirestore: true,
  })
}
