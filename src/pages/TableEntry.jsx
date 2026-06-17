import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store'
import { createOrderSession, getTableQrSession, supabase, resolveStoreIdFromMapping } from '@/lib/firebase'
import { useToast } from '@/components/Toast'

/**
 * TableEntry — static QR landing page.
 *
 * The static QR code printed on each table NEVER changes. It always points to:
 *   /#/table/{tableNumber}   (or /#/table/{storeId}/{tableNumber})
 *
 * When a customer scans the QR this component:
 *   1. Looks up table_sessions to find the current activeSessionId
 *   2. Validates the session is actually active (not expired/closed) in order_sessions
 *   3. If active  → redirects to /order/{sessionId}
 *   4. If expired/none → creates a brand new session → redirects to /order/{newSessionId}
 *
 * This ensures every new customer group gets a fresh, isolated session
 * even though the physical QR code on the table never changes.
 */
export default function TableEntry() {
  const { businessInfo, licenseKey } = useAppStore()
  const [searchParams] = useSearchParams()
  const { storeId: routeStoreId, tableNumber: routeTableNumber } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const queryStoreId = String(searchParams.get('store') || '').trim()
  const guests = Number(searchParams.get('guests') || 0) || 1
  const tableNumber = String(routeTableNumber || routeStoreId || '').trim()
  const resolvedStoreId = String(routeTableNumber ? routeStoreId : queryStoreId || businessInfo?.storeId || '').trim()

  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Preparing your table session...')

  useEffect(() => {
    let cancelled = false

    const openSession = async () => {
      if (!resolvedStoreId || !tableNumber) {
        setStatus('invalid')
        setMessage('Invalid table QR. Please scan the table QR code again.')
        return
      }

      try {
        setStatus('loading')
        setMessage('Checking table availability...')

        const finalStoreId = await resolveStoreIdFromMapping(resolvedStoreId)
        if (cancelled) return

        // ── Step 1: Look up the table_sessions pointer ────────────────────────
        const tableSession = await getTableQrSession(finalStoreId, tableNumber)
        if (cancelled) return

        const candidateSessionId = String(
          tableSession?.activeSessionId || tableSession?.session || ''
        ).trim()

        // ── Step 2: Validate the candidate session is truly active ────────────
        // Even if the pointer exists, verify the order_sessions record is not
        // expired/closed. This protects against race conditions where
        // expireOrderSession marked the session expired but the table_sessions
        // pointer was not cleared (e.g. network hiccup during settlement).
        if (candidateSessionId) {
          setMessage('Verifying session status...')

          let sessionIsActive = false
          try {
            const { data: sessRows, error: sessErr } = await supabase
              .from('store_data')
              .select('data')
              .match({
                store_id: finalStoreId,
                collection_name: 'order_sessions',
                doc_id: candidateSessionId,
              })
              .limit(1)

            if (cancelled) return

            if (!sessErr && sessRows?.[0]?.data) {
              const sessStatus = String(sessRows[0].data.status || '').trim()
              // Only treat as active if status is 'active' or not yet set
              sessionIsActive = !sessStatus || sessStatus === 'active'
            }
          } catch (e) {
            // If we can't verify, fall through to create a new session (safe default)
            console.warn('[TableEntry] Could not verify session status:', e)
          }

          if (cancelled) return

          if (sessionIsActive) {
            // Session is valid and active — send the customer straight in
            navigate(`/order/${candidateSessionId}`, { replace: true })
            return
          }

          // Session is expired/closed — fall through to create a new one
          setMessage('Previous session ended. Creating a fresh session...')
        }

        // ── Step 3: No valid active session — create a brand new one ─────────
        setMessage('Creating a fresh ordering session...')
        const newSessionId = await createOrderSession(finalStoreId, tableNumber, guests)
        if (cancelled) return

        if (!newSessionId) {
          throw new Error('Unable to create a new session')
        }

        navigate(`/order/${newSessionId}`, { replace: true })
      } catch (error) {
        console.error('[TableEntry] failed to open table session:', error)
        if (cancelled) return
        setStatus('error')
        setMessage('Unable to open this table right now. Please ask staff for help.')
      }
    }

    openSession()
    return () => { cancelled = true }
  }, [resolvedStoreId, tableNumber, guests, navigate])

  if (status === 'invalid') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 animate-pulse">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-black text-gray-900">Invalid Table QR</h1>
          <p className="mt-2 text-sm text-gray-500">The table QR code is not valid. Please scan the correct table QR code.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          {status === 'error' ? (
            <span className="text-2xl">🍽️</span>
          ) : (
            <span className="text-2xl animate-bounce">🍽️</span>
          )}
        </div>
        <h1 className="text-xl font-black text-gray-900">
          {status === 'error' ? 'Could not open table' : 'Preparing your table'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        {status !== 'error' && (
          <div className="mt-4 flex justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="block h-2 w-2 rounded-full bg-emerald-400"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        )}
        {status === 'error' && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700">
            <p className="font-semibold">Unable to open session</p>
            <p>{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
