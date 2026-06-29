import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ScanLine, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useSalesStore, useAuthStore, useActivityStore } from '@/store'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SearchInput } from '@/components/ui'
import { useBarcodeScanner } from '@/lib/useBarcodeScanner'

export default function Refunds() {
  const [receiptNo, setReceiptNo] = useState('')
  const [reason, setReason] = useState('Customer return')
  const [busy, setBusy] = useState(false)
  const [refundSelection, setRefundSelection] = useState({})

  const findSaleByReceiptNo = useSalesStore((state) => state.findSaleByReceiptNo)
  const refundSaleByReceiptNo = useSalesStore((state) => state.refundSaleByReceiptNo)
  const { currentUser } = useAuthStore()
  const toast = useToast()

  // ── Barcode scanner: auto-fill receipt number when receipt barcode is scanned ──
  // Accept receipt barcodes: starts with INV- or contains dashes with 8+ total chars
  useBarcodeScanner((code) => {
    const upper = String(code || '').toUpperCase().trim()
    // Check if it looks like a receipt: INV-... format or long enough with dashes (not a short product barcode)
    const startsWithINV = upper.startsWith('INV-')
    const hasPattern = upper.includes('-') && upper.length >= 8
    const isLongBarcode = upper.length >= 10 // Receipt numbers are typically long enough
    
    if (startsWithINV || hasPattern || isLongBarcode) {
      setReceiptNo(upper)
    }
  })

  const sale = useMemo(() => findSaleByReceiptNo(receiptNo), [receiptNo, findSaleByReceiptNo])
  const cartItems = useMemo(() => (Array.isArray(sale?.cartItems) ? sale.cartItems : []), [sale])

  useEffect(() => {
    if (!sale) {
      if (Object.keys(refundSelection).length > 0) {
        setRefundSelection({})
      }
      return
    }

    const initialSelection = {}
    cartItems.forEach((item, idx) => {
      initialSelection[idx] = {
        selected: true,
        qty: Number(item.qty || item.quantity || 1),
      }
    })

    setRefundSelection((prev) => {
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(initialSelection)
      const isSame =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => {
          const prevItem = prev[key]
          const nextItem = initialSelection[key]
          return (
            prevItem &&
            prevItem.selected === nextItem.selected &&
            Number(prevItem.qty || 0) === nextItem.qty
          )
        })

      return isSame ? prev : initialSelection
    })
  }, [sale?.receiptNo, cartItems])

  const selectedItems = useMemo(() => {
    return cartItems
      .map((item, idx) => {
        const selection = refundSelection[idx] || {}
        return {
          ...item,
          selected: selection.selected !== false,
          qty: Number(selection.qty || Number(item.qty || item.quantity || 1)),
        }
      })
      .filter((item) => item.selected && Number(item.qty) > 0)
  }, [cartItems, refundSelection])

  const refundSubtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const qty = Number(item.qty || item.quantity || 0)
      const unit = Number(item.salePrice || item.price || 0)
      return sum + qty * unit
    }, 0)
  }, [selectedItems])

  const originalSubtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const qty = Number(item.qty || item.quantity || 0)
      const unit = Number(item.salePrice || item.price || 0)
      return sum + qty * unit
    }, 0)
  }, [cartItems])

  const refundRatio = useMemo(() => {
    return originalSubtotal > 0 ? refundSubtotal / originalSubtotal : 0
  }, [originalSubtotal, refundSubtotal])

  const refundTax = useMemo(() => Math.abs(Number(sale?.tax || 0)) * refundRatio, [sale, refundRatio])
  const refundDiscount = useMemo(() => Math.abs(Number(sale?.discount || 0)) * refundRatio, [sale, refundRatio])
  const refundServiceCharge = useMemo(() => Math.abs(Number(sale?.serviceCharge || 0)) * refundRatio, [sale, refundRatio])
  const refundTotal = useMemo(() => -Math.abs(refundSubtotal - refundDiscount + refundTax + refundServiceCharge), [refundSubtotal, refundDiscount, refundTax, refundServiceCharge])

  const currentUserName = currentUser?.name || currentUser?.username || 'System'
  const canRefund = Boolean(
    sale &&
    sale.total > 0 &&
    sale.status !== 'refunded' &&
    sale.status !== 'refund' &&
    selectedItems.length > 0
  )

  const allSales = useSalesStore((state) => state.sales)
  const refundHistory = useMemo(
    () =>
      (allSales || [])
        .filter((record) => record.status === 'refund' || record.status === 'refunded')
        .slice(0, 5),
    [allSales]
  )

  const handleRefund = () => {
    if (!receiptNo.trim()) {
      toast.error('Scan or enter a receipt number first')
      return
    }

    if (!canRefund) {
      toast.error('Select at least one line item to refund')
      return
    }

    setBusy(true)
    const result = refundSaleByReceiptNo({
      receiptNo,
      reason,
      cashier: currentUserName,
      items: selectedItems,
    })
    setBusy(false)

    if (!result.success) {
      toast.error(result.error || 'Refund failed')
      return
    }

    useActivityStore.getState().addLog(
      'Refund Processed',
      `Receipt ${result.originalSale.receiptNo} refunded ${formatCurrency(Math.abs(result.refundSale.total))}`,
      currentUserName
    )

    toast.success(`Refund completed for ${result.originalSale.receiptNo}`)
    setReceiptNo('')
    setReason('Customer return')
  }

  const allSelected = cartItems.length > 0 && cartItems.every((_, idx) => refundSelection[idx]?.selected !== false)
  const fullRefundSelected = cartItems.length > 0 && cartItems.every((item, idx) => {
    const selection = refundSelection[idx] || {}
    return (
      selection.selected !== false &&
      Number(selection.qty || item.qty || item.quantity || 1) === Number(item.qty || item.quantity || 1)
    )
  })

  const updateSelection = (idx, selection) => {
    setRefundSelection((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        ...selection,
      },
    }))
  }

  const toggleSelectAll = () => {
    const next = {}
    cartItems.forEach((item, idx) => {
      next[idx] = {
        selected: !allSelected,
        qty: Number(refundSelection[idx]?.qty || item.qty || item.quantity || 1),
      }
    })
    setRefundSelection(next)
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
            <RotateCcw size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Refunds</h1>
            <p className="text-sm text-gray-500">Scan receipt barcode or enter receipt number</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Barcode / Number</label>
            <div className="mt-1.5">
              <SearchInput
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value.toUpperCase())}
                placeholder="e.g. INV-260629-0001234"
                icon={<ScanLine size={15} />}
                inputProps={{ autoFocus: true }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-base mt-1.5"
              placeholder="Reason for refund"
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        {!receiptNo.trim() ? (
          <div className="text-center py-10 text-gray-400">
            <ScanLine size={24} className="mx-auto mb-2" />
            <p className="text-sm">Waiting for receipt barcode scan...</p>
          </div>
        ) : !sale ? (
          <div className="text-center py-10 text-red-500">
            <AlertTriangle size={24} className="mx-auto mb-2" />
            <p className="text-sm font-semibold">Receipt not found</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Receipt</p>
                <p className="text-lg font-black text-gray-900">{sale.receiptNo}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(sale.date).toLocaleString()} · {sale.paymentMethod}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Amount</p>
                <p className="text-2xl font-black text-green-700">{formatCurrency(sale.total || 0)}</p>
                {(sale.status === 'refunded' || sale.status === 'refund' || sale.status === 'partially refunded') && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600">
                    <CheckCircle2 size={12} /> {sale.status === 'partially refunded' ? 'Partially refunded' : 'Refunded'}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Refund items</p>
                  <p className="text-sm text-gray-600">Select the items and quantities to refund.</p>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-green-700"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              <div className="space-y-3">
                {cartItems.map((item, idx) => {
                  const selection = refundSelection[idx] || {}
                  const selected = selection.selected !== false
                  const quantity = Number(selection.qty || item.qty || item.quantity || 1)
                  const maxQty = Number(item.qty || item.quantity || 1)

                  return (
                    <div key={`${item.id || item.name || idx}-${idx}`} className="grid gap-3 sm:grid-cols-[1fr_auto] items-center rounded-2xl border border-gray-200 bg-white p-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => updateSelection(idx, { selected: !selected })}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.name || 'Item'}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {quantity} of {maxQty} selected · {formatCurrency(Number(item.salePrice || item.price || 0))} each
                          </p>
                          {(item.serial || item.imei) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {item.serial ? `S/N: ${item.serial}` : ''}{item.imei ? ` ${item.imei}` : ''}
                            </p>
                          )}
                        </div>
                      </label>

                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min="1"
                          max={maxQty}
                          disabled={!selected}
                          value={quantity}
                          onChange={(e) => updateSelection(idx, {
                            qty: Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)),
                          })}
                          className="input-base w-20"
                        />
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(quantity * Number(item.salePrice || item.price || 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] items-end">
              <div className="rounded-3xl border border-gray-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Refund summary</p>
                <div className="mt-3 grid gap-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Items</span>
                    <span>{selectedItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(refundSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax estimate</span>
                    <span>{formatCurrency(refundTax)}</span>
                  </div>
                  {refundDiscount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount estimate</span>
                      <span>-{formatCurrency(refundDiscount)}</span>
                    </div>
                  )}
                  {refundServiceCharge > 0 && (
                    <div className="flex justify-between">
                      <span>Service charge estimate</span>
                      <span>{formatCurrency(refundServiceCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900">
                    <span>Total refund</span>
                    <span>{formatCurrency(refundTotal)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRefund}
                disabled={!canRefund || busy}
                className="btn-danger w-full lg:w-auto"
              >
                {busy ? 'Processing...' : fullRefundSelected ? 'Process Full Refund' : 'Process Partial Refund'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Recent refunds</h2>
            <p className="text-xs text-gray-500">Last refunds processed in the system.</p>
          </div>
        </div>

        {refundHistory.length === 0 ? (
          <div className="text-sm text-gray-400 py-10 text-center">No refunds have been recorded yet.</div>
        ) : (
          <div className="space-y-3">
            {refundHistory.map((record) => (
              <div key={record.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{record.receiptNo}</p>
                    <p className="text-xs text-gray-500">Original: {record.originalReceiptNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-700">{formatCurrency(record.total)}</p>
                    <p className="text-xs text-gray-500">{new Date(record.date).toLocaleString()}</p>
                  </div>
                </div>
                {record.refundReason && <p className="text-xs text-gray-500 mt-2">Reason: {record.refundReason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
