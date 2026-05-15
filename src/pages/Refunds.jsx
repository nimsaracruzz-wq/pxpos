import React, { useMemo, useState } from 'react'
import { ScanLine, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useSalesStore, useAuthStore, useActivityStore } from '@/store'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { SearchInput } from '@/components/ui'

export default function Refunds() {
  const [receiptNo, setReceiptNo] = useState('')
  const [reason, setReason] = useState('Customer return')
  const [busy, setBusy] = useState(false)

  const { findSaleByReceiptNo, refundSaleByReceiptNo } = useSalesStore()
  const { currentUser } = useAuthStore()
  const toast = useToast()

  const sale = useMemo(() => findSaleByReceiptNo(receiptNo), [receiptNo, findSaleByReceiptNo])
  const canRefund = sale && sale.total > 0 && sale.status !== 'refunded' && sale.status !== 'refund'

  const handleRefund = () => {
    if (!receiptNo.trim()) {
      toast.error('Scan or enter a receipt number first')
      return
    }

    setBusy(true)
    const result = refundSaleByReceiptNo({
      receiptNo,
      reason,
      cashier: currentUser?.name || currentUser?.username || 'System',
    })
    setBusy(false)

    if (!result.success) {
      toast.error(result.error || 'Refund failed')
      return
    }

    useActivityStore.getState().addLog(
      'Refund Processed',
      `Receipt ${result.originalSale.receiptNo} refunded. Amount: ${formatCurrency(result.originalSale.total)}`,
      currentUser?.name || currentUser?.username || 'System'
    )

    toast.success(`Refund completed for ${result.originalSale.receiptNo}`)
    setReceiptNo('')
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
                placeholder="e.g. RCPT-20260414-0001"
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
            <div className="flex items-start justify-between gap-4">
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
                {(sale.status === 'refunded' || sale.status === 'refund') && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600">
                    <CheckCircle2 size={12} /> Refunded
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items</p>
              <div className="flex flex-col gap-2">
                {(sale.cartItems || []).map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-700">{item.qty} x {item.name}</span>
                      {(item.serial || item.imei) && (
                        <span className="text-xs text-gray-500 flex gap-2">
                          {item.serial && <span>S/N: {item.serial}</span>}
                          {item.imei && <span>IMEI: {item.imei}</span>}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-gray-900">{formatCurrency((item.salePrice || item.price || 0) * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={handleRefund}
                disabled={!canRefund || busy}
                className="btn-danger"
              >
                {busy ? 'Processing...' : 'Process Full Refund'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
