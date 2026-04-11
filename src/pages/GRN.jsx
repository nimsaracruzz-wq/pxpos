import React, { useState, useRef } from 'react'
import { Truck, Plus, Search, CheckCircle, ClipboardList, Package, Calendar, ChevronDown, Save, Trash2 } from 'lucide-react'
import { useProductStore } from '@/store'
import { useToast } from '@/components/Toast'
import { Button, Badge, Input, Select, SectionHeader, SearchInput, StatCard, Modal } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'

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

export default function GRN() {
  const { products, adjustStock } = useProductStore()
  const { grns, addGRN } = useGRNStore()
  const toast = useToast()

  const [supplier, setSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [items, setItems] = useState([
    { productId: '', qty: 1, costPrice: '', expiryDate: '' }
  ])
  const [showHistory, setShowHistory] = useState(false)

  const addItem = () =>
    setItems((s) => [...s, { productId: '', qty: 1, costPrice: '', expiryDate: '' }])

  const removeItem = (i) =>
    setItems((s) => s.filter((_, idx) => idx !== i))

  const updateItem = (i, key, val) =>
    setItems((s) => s.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)))

  const totalCost = items.reduce((sum, it) => {
    const cost = parseFloat(it.costPrice) || 0
    const qty = parseInt(it.qty) || 0
    return sum + cost * qty
  }, 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    const validItems = items.filter((it) => it.productId && it.qty > 0)
    if (!validItems.length) {
      toast.error('Add at least one product with quantity')
      return
    }
    validItems.forEach((it) => {
      adjustStock(it.productId, parseInt(it.qty))
    })
    const grn = {
      id: uuidv4(),
      grnNo: `GRN-${Date.now()}`,
      supplier,
      invoiceNo,
      date,
      items: validItems.map((it) => {
        const prod = products.find((p) => p.id === it.productId)
        return { ...it, productName: prod?.name, unit: prod?.unit }
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
    setItems([{ productId: '', qty: 1, costPrice: '', expiryDate: '' }])
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHeader
        title="Goods Receiving (GRN)"
        subtitle="Record incoming stock from suppliers"
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
                    <td><Badge variant="blue">{g.items.length}</Badge></td>
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
              <button type="button" onClick={addItem} className="btn-secondary">
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Product</th>
                    <th>Qty Received</th>
                    <th>Cost Price</th>
                    <th>Expiry Date</th>
                    <th>Line Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const prod = products.find((p) => p.id === item.productId)
                    const lineTotal = (parseFloat(item.costPrice) || 0) * (parseInt(item.qty) || 0)
                    return (
                      <tr key={i}>
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
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(i, 'qty', e.target.value)}
                            className="input-base w-24"
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
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => updateItem(i, 'expiryDate', e.target.value)}
                            className="input-base w-36"
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
                setItems([{ productId: '', qty: 1, costPrice: '', expiryDate: '' }])
                setSupplier('')
                setInvoiceNo('')
              }}
            >
              Reset
            </button>
            <button type="submit" className="btn-primary">
              <CheckCircle size={15} />
              Receive Goods & Update Stock
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
