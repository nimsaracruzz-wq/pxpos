import React, { useState, useRef } from 'react'
import { Truck, Plus, Search, CheckCircle, ClipboardList, Package, Calendar, ChevronDown, Save, Trash2, Barcode, Info, Flag } from 'lucide-react'
import { useProductStore } from '@/store'
import { useToast } from '@/components/Toast'
import { Button, Badge, Input, Select, SectionHeader, SearchInput, StatCard, Modal } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'
import { parseBarcode, describeParsedBarcode } from '@/lib/gs1'

// ─── GRN Store ─────────────────────────────────────────────────────────────
const useGRNStore = create(
  persist(
    (set) => ({
      grns: [],
      addGRN: (grn) => set((s) => ({ grns: [grn, ...s.grns] })),
    }),
    { name: 'paxxmo-grns' }
  )
)

// ─── GS1 Scan Result Badge ─────────────────────────────────────────────────
function Gs1ScanBadge({ parsed }) {
  if (!parsed || parsed.type === 'EAN13' || parsed.type === 'EAN8') return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {parsed.isSriLanka && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
          🇱🇰 GS1 Sri Lanka
        </span>
      )}
      {parsed.batch && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
          Batch: {parsed.batch}
        </span>
      )}
      {parsed.expiryDate && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
          Exp: {parsed.expiryDate}
        </span>
      )}
      {parsed.bestBefore && !parsed.expiryDate && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">
          BB: {parsed.bestBefore}
        </span>
      )}
    </div>
  )
}

export default function GRN() {
  const { products, adjustStock, getByBarcode } = useProductStore()
  const { grns, addGRN } = useGRNStore()
  const toast = useToast()

  const [barcodeInput, setBarcodeInput] = useState('')
  const [lastParsed, setLastParsed] = useState(null)

  const [supplier, setSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [items, setItems] = useState([
    { productId: '', qty: 1, costPrice: '', expiryDate: '', batchNo: '', gs1Parsed: null }
  ])
  const [showHistory, setShowHistory] = useState(false)

  const addItem = () =>
    setItems((s) => [...s, { productId: '', qty: 1, costPrice: '', expiryDate: '', batchNo: '', gs1Parsed: null }])

  const removeItem = (i) =>
    setItems((s) => s.filter((_, idx) => idx !== i))

  const updateItem = (i, key, val) =>
    setItems((s) => s.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)))

  const totalCost = items.reduce((sum, it) => {
    const cost = parseFloat(it.costPrice) || 0
    const qty = parseInt(it.qty) || 0
    return sum + cost * qty
  }, 0)

  const handleBarcodeSubmit = (e) => {
    e.preventDefault()
    const raw = barcodeInput.trim()
    if (!raw) return

    // Parse with GS1 engine
    const parsed = parseBarcode(raw)
    setLastParsed(parsed)

    // Determine product lookup code
    const lookupCode = parsed?.productCode || raw

    // Try to find product by barcode
    const prod = getByBarcode(lookupCode) || getByBarcode(raw)

    // Auto-fill expiry and batch from GS1 AIs
    const autoExpiry = parsed?.expiryDate || parsed?.bestBefore || ''
    const autoBatch = parsed?.batch || ''

    if (prod) {
      const existingIdx = items.findIndex(it => it.productId === prod.id)
      if (existingIdx !== -1) {
        // Increment qty on existing line; update expiry/batch if now available
        updateItem(existingIdx, 'qty', parseInt(items[existingIdx].qty || 0) + 1)
        if (autoExpiry && !items[existingIdx].expiryDate) updateItem(existingIdx, 'expiryDate', autoExpiry)
        if (autoBatch && !items[existingIdx].batchNo) updateItem(existingIdx, 'batchNo', autoBatch)
      } else {
        const lastItem = items[items.length - 1]
        if (lastItem && !lastItem.productId) {
          // Fill empty last row
          setItems(s => s.map((it, idx) => idx === s.length - 1 ? {
            ...it,
            productId: prod.id,
            costPrice: prod.cost || 0,
            expiryDate: autoExpiry,
            batchNo: autoBatch,
            gs1Parsed: parsed,
          } : it))
        } else {
          setItems(s => [...s, {
            productId: prod.id,
            qty: 1,
            costPrice: prod.cost || 0,
            expiryDate: autoExpiry,
            batchNo: autoBatch,
            gs1Parsed: parsed,
          }])
        }
      }

      const desc = parsed?.type === 'GS1-128'
        ? `${prod.name} · ${describeParsedBarcode(parsed)}`
        : prod.name

      toast.success(`📦 ${desc}`, { duration: 3000 })
    } else if (parsed?.type === 'GS1-128') {
      // GS1 barcode scanned but product not in DB — still fill what we know
      toast.warning(
        `GS1 barcode decoded (${parsed.isSriLanka ? '🇱🇰 SL product' : 'foreign'}). ` +
        `GTIN ${parsed.productCode} not in product list. Please select manually.`,
        { duration: 5000 }
      )
      // Add a blank row with the parsed data pre-filled
      setItems(s => [...s, {
        productId: '',
        qty: 1,
        costPrice: '',
        expiryDate: autoExpiry,
        batchNo: autoBatch,
        gs1Parsed: parsed,
      }])
    } else {
      toast.error(`Barcode "${raw}" not recognized`)
    }

    setBarcodeInput('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const validItems = items.filter((it) => it.productId && it.qty > 0)
    if (!validItems.length) {
      toast.error('Add at least one product with quantity')
      return
    }
    validItems.forEach((it) => {
      adjustStock(it.productId, parseInt(it.qty))
      // Persist expiry / batch back to the product record if provided
      if (it.expiryDate || it.batchNo) {
        const prod = products.find(p => p.id === it.productId)
        if (prod) {
          const { updateProduct } = useProductStore.getState()
          if (updateProduct) {
            const updates = {}
            if (it.expiryDate) updates.expiry = it.expiryDate
            if (it.batchNo) updates.batchNo = it.batchNo
            updateProduct(it.productId, updates)
          }
        }
      }
    })
    const grn = {
      id: uuidv4(),
      grnNo: `GRN-${Date.now()}`,
      supplier,
      invoiceNo,
      date,
      items: validItems.map((it) => {
        const prod = products.find((p) => p.id === it.productId)
        return {
          ...it,
          productName: prod?.name,
          unit: prod?.unit,
          gs1Parsed: undefined, // don't persist the full parsed object
        }
      }),
      totalCost,
      status: 'received',
      createdAt: new Date(),
    }
    addGRN(grn)
    toast.success(`GRN ${grn.grnNo} recorded. Stock updated for ${validItems.length} product(s).`)
    setSupplier('')
    setInvoiceNo('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setItems([{ productId: '', qty: 1, costPrice: '', expiryDate: '', batchNo: '', gs1Parsed: null }])
    setLastParsed(null)
  }

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: `#f4f7f5` }}>
      <SectionHeader
        title="Goods Receiving (GRN)"
        subtitle="Record incoming stock — GS1-128 barcodes auto-fill batch & expiry (GS1 Sri Lanka 479)"
        action={
          <button
            className={cn('btn-ghost', showHistory && 'bg-gray-100')}
            onClick={() => setShowHistory(!showHistory)}
          >
            <ClipboardList size={15} />
            {showHistory ? 'New GRN' : `History (${grns.length})`}
          </button>
        }
      />

      {/* GS1 Info Banner */}
      {!showHistory && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 text-sm text-blue-800">
          <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
          <div>
            <span className="font-bold">GS1-128 Scanner Ready</span> — Scan any GS1-128 barcode to auto-fill
            <span className="font-semibold"> batch number</span> (AI 10) and
            <span className="font-semibold"> expiry date</span> (AI 17/15).
            Sri Lanka products use country prefix <span className="font-mono font-bold">479</span>.
            EAN-13 barcodes are also supported for basic product lookup.
          </div>
        </div>
      )}

      {showHistory ? (
        /* GRN History */
        <div className="card overflow-hidden">
          {grns.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
              <p>No GRNs recorded yet</p>
            </div>
          ) : (
            <table className="table-modern">
              <thead>
                <tr>
                  <th>GRN No.</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Invoice</th>
                  <th>Items</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {grns.map((g) => (
                  <tr key={g.id}>
                    <td><span className="font-mono text-xs font-bold text-green-700">{g.grnNo}</span></td>
                    <td className="text-sm">{g.date}</td>
                    <td className="font-medium">{g.supplier || '—'}</td>
                    <td className="text-sm text-gray-500">{g.invoiceNo || '—'}</td>
                    <td>
                      <Badge variant="blue">{g.items.length}</Badge>
                    </td>
                    <td><span className="font-bold text-green-700">{formatCurrency(g.totalCost)}</span></td>
                    <td><Badge variant="green">Received</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* New GRN Form */
        <form onSubmit={handleSubmit}>
          {/* Header info */}
          <div className="card p-5 mb-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">GRN Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Supplier Name"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Dilmah Distributors"
              />
              <Input
                label="Supplier Invoice No."
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026-001"
              />
              <Input
                label="Received Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Items */}
          <div className="card p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Products Received</h3>
              <div className="flex gap-3 items-center">
                {/* Barcode scanner input */}
                <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Barcode size={14} className="text-green-500" />
                    </div>
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Scan GS1 / EAN barcode..."
                      className="pl-8 pr-4 py-1.5 w-72 bg-white border border-green-200 rounded-lg text-sm focus:ring-2 focus:ring-green-100 focus:border-green-400 font-mono"
                      autoFocus
                    />
                  </div>
                </form>
                <button type="button" onClick={addItem} className="btn-secondary">
                  <Plus size={14} /> Add Manual Line
                </button>
              </div>
            </div>

            {/* Last scan info */}
            {lastParsed && lastParsed.type === 'GS1-128' && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-800 font-mono flex flex-wrap gap-2 items-center">
                <span className="font-bold text-purple-600">Last GS1 Scan:</span>
                {lastParsed.gtin && <span>GTIN: {lastParsed.gtin}</span>}
                {lastParsed.batch && <span>· Batch: <strong>{lastParsed.batch}</strong></span>}
                {lastParsed.expiryDate && <span>· Expiry: <strong>{lastParsed.expiryDate}</strong></span>}
                {lastParsed.bestBefore && <span>· Best Before: <strong>{lastParsed.bestBefore}</strong></span>}
                {lastParsed.productionDate && <span>· Produced: {lastParsed.productionDate}</span>}
                {lastParsed.isSriLanka && <span className="ml-1">🇱🇰 SL Product</span>}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Product</th>
                    <th>Qty</th>
                    <th>Cost Price</th>
                    <th>Batch / Lot No.</th>
                    <th>Expiry Date</th>
                    <th>Line Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const prod = products.find((p) => p.id === item.productId)
                    const lineTotal = (parseFloat(item.costPrice) || 0) * (parseInt(item.qty) || 0)
                    const isGS1 = item.gs1Parsed?.type === 'GS1-128'
                    return (
                      <tr key={i} className={isGS1 ? 'bg-blue-50/30' : ''}>
                        <td>
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const p = products.find((px) => px.id === e.target.value)
                              updateItem(i, 'productId', e.target.value)
                              if (p?.cost) updateItem(i, 'costPrice', p.cost)
                            }}
                            className="input-base"
                            required
                          >
                            <option value="">Select product...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          {isGS1 && (
                            <Gs1ScanBadge parsed={item.gs1Parsed} />
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(i, 'qty', e.target.value)}
                            className="input-base w-20"
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={item.costPrice}
                            onChange={(e) => updateItem(i, 'costPrice', e.target.value)}
                            className="input-base w-28"
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.batchNo || ''}
                            onChange={(e) => updateItem(i, 'batchNo', e.target.value)}
                            className={cn(
                              'input-base w-32 font-mono text-xs',
                              item.batchNo ? 'border-purple-200 bg-purple-50' : ''
                            )}
                            placeholder="e.g. B2024-01"
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => updateItem(i, 'expiryDate', e.target.value)}
                            className={cn(
                              'input-base w-36',
                              item.expiryDate ? 'border-amber-200 bg-amber-50' : ''
                            )}
                          />
                        </td>
                        <td>
                          <span className="font-bold text-green-700">
                            {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                          </span>
                        </td>
                        <td>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(i)}
                              className="text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">Total Cost:</span>
                <span className="text-2xl font-black text-green-700">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setItems([{ productId: '', qty: 1, costPrice: '', expiryDate: '', batchNo: '', gs1Parsed: null }])
                setSupplier('')
                setInvoiceNo('')
                setLastParsed(null)
              }}
            >
              Reset
            </button>
            <button type="submit" className="btn-primary">
              <CheckCircle size={15} />
              Receive Goods &amp; Update Stock
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
