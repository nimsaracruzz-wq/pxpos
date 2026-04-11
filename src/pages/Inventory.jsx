import React, { useState, useMemo } from 'react'
import { Package, AlertTriangle, TrendingDown, RefreshCw, Download, Filter } from 'lucide-react'
import { useProductStore, useAppStore } from '@/store'
import { useToast } from '@/components/Toast'
import { StatCard, Badge, Modal, Input, SectionHeader, SearchInput } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function Inventory() {
  const { products, adjustStock } = useProductStore()
  const { activeModule } = useAppStore()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [adjustModal, setAdjustModal] = useState(null)
  const [adjQty, setAdjQty] = useState('')
  const [adjType, setAdjType] = useState('add')
  const [filterMode, setFilterMode] = useState('all')

  const scopedProducts = useMemo(() => 
    products.filter(p => p.module === activeModule || (!p.module && activeModule === 'grocery')),
  [products, activeModule])

  const lowStock = useMemo(() => scopedProducts.filter(p => p.stock <= 10 && p.active), [scopedProducts])
  const outOfStock = useMemo(() => scopedProducts.filter(p => p.stock === 0 && p.active), [scopedProducts])
  const totalValue = useMemo(
    () => scopedProducts.reduce((s, p) => s + (p.cost || 0) * p.stock, 0),
    [scopedProducts]
  )

  const filtered = useMemo(() => {
    let list = scopedProducts
    if (filterMode === 'low') list = lowStock
    if (filterMode === 'out') list = outOfStock
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [scopedProducts, search, filterMode, lowStock, outOfStock])

  const handleAdjust = () => {
    if (!adjustModal || !adjQty) { toast.error('Enter a quantity'); return }
    const qty = parseInt(adjQty)
    const prev = adjustModal.stock
    if (adjType === 'add') adjustStock(adjustModal.id, qty)
    else if (adjType === 'remove') adjustStock(adjustModal.id, -qty)
    else adjustStock(adjustModal.id, qty - adjustModal.stock)
    const newQty = adjType === 'set' ? qty : adjType === 'add' ? prev + qty : Math.max(0, prev - qty)
    toast.success(`${adjustModal.name}: stock updated to ${newQty} ${adjustModal.unit}`)
    setAdjustModal(null)
    setAdjQty('')
    setAdjType('add')
  }

  const exportInventory = () => {
    const rows = [['Name', 'Category', 'Stock', 'Unit', 'Cost', 'Value', 'Expiry']]
    scopedProducts.forEach((p) => rows.push([p.name, p.category, p.stock, p.unit, p.cost || 0, (p.cost || 0) * p.stock, p.expiry || '']))
    const csv = rows.map((r) => r.join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'inventory-report.csv',
    })
    a.click()
    toast.success('Inventory exported to CSV')
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHeader
        title={`${activeModule ? activeModule.charAt(0).toUpperCase() + activeModule.slice(1) : ''} Inventory`}
        subtitle="Track stock levels and manage adjustments"
        action={
          <button className="btn-ghost" onClick={exportInventory}>
            <Download size={14} /> Export Inventory
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Products" value={scopedProducts.length} icon={<Package size={18} />} color="#16a34a" />
        <StatCard title="Low Stock" value={lowStock.length} subtitle="10 units or fewer" icon={<AlertTriangle size={18} />} color="#f59e0b" />
        <StatCard title="Out of Stock" value={outOfStock.length} icon={<TrendingDown size={18} />} color="#ef4444" />
        <StatCard title="Inventory Value" value={formatCurrency(totalValue)} subtitle="At cost price" icon={<Package size={18} />} color="#2563eb" />
      </div>

      <div className="flex gap-3 mb-5">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="flex-1" />
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All', count: scopedProducts.length },
            { id: 'low', label: '⚡ Low Stock', count: lowStock.length },
            { id: 'out', label: '⛔ Out of Stock', count: outOfStock.length },
          ].map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setFilterMode(id)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                filterMode === id
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
              )}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Stock Level</th>
                <th>Unit</th>
                <th>Cost Price</th>
                <th>Stock Value</th>
                <th>Expiry</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stockPct = Math.min(100, (p.stock / 50) * 100)
                const stockStatus = p.stock === 0 ? 'out' : p.stock <= 5 ? 'critical' : p.stock <= 10 ? 'low' : 'ok'
                const barColors = { ok: '#22c55e', low: '#f59e0b', critical: '#f97316', out: '#ef4444' }
                const isExpired = p.expiry && new Date(p.expiry) < new Date()
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm shrink-0">📦</div>
                        <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                      </div>
                    </td>
                    <td><Badge variant="blue">{p.category || '—'}</Badge></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${stockPct}%`, background: barColors[stockStatus] }}
                          />
                        </div>
                        <span className="font-bold text-sm text-gray-800 w-8">{p.stock}</span>
                      </div>
                    </td>
                    <td className="text-gray-500 text-sm">{p.unit}</td>
                    <td className="text-sm">{p.cost ? formatCurrency(p.cost) : '—'}</td>
                    <td><span className="font-semibold text-sm">{p.cost ? formatCurrency(p.cost * p.stock) : '—'}</span></td>
                    <td>
                      {p.expiry ? (
                        <span className={cn('text-xs font-medium', isExpired ? 'text-red-600 font-bold' : 'text-gray-500')}>
                          {isExpired ? '⚠ ' : ''}{p.expiry}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td>
                      <Badge variant={stockStatus === 'ok' ? 'green' : stockStatus === 'out' ? 'red' : 'yellow'}>
                        {stockStatus === 'ok' ? 'Good' : stockStatus === 'out' ? 'Out of Stock' : stockStatus === 'critical' ? 'Critical' : 'Low Stock'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          onClick={() => { setAdjustModal(p); setAdjQty('') }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                        >
                          <RefreshCw size={12} /> Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title={`Adjust Stock — ${adjustModal?.name}`}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex items-center justify-between">
            <span className="text-sm text-green-700 font-medium">Current Stock</span>
            <span className="text-2xl font-black text-green-700">
              {adjustModal?.stock} <span className="text-sm font-normal">{adjustModal?.unit}</span>
            </span>
          </div>

          <div className="flex gap-2">
            {[
              { id: 'add', label: '+ Add' },
              { id: 'remove', label: '− Remove' },
              { id: 'set', label: '= Set Exact' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setAdjType(id)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all',
                  adjType === id
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Input
            label={adjType === 'set' ? 'New Stock Level' : 'Quantity'}
            type="number"
            min="0"
            value={adjQty}
            onChange={(e) => setAdjQty(e.target.value)}
            placeholder="Enter quantity"
          />

          {adjQty && (
            <div className="p-3 rounded-xl bg-blue-50 text-sm text-blue-700 text-center">
              New stock will be:{' '}
              <strong>
                {adjType === 'set'
                  ? parseInt(adjQty)
                  : adjType === 'add'
                  ? (adjustModal?.stock || 0) + parseInt(adjQty)
                  : Math.max(0, (adjustModal?.stock || 0) - parseInt(adjQty))}{' '}
                {adjustModal?.unit}
              </strong>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-primary flex-1 justify-center" onClick={handleAdjust}>
              Apply Adjustment
            </button>
            <button className="btn-ghost" onClick={() => setAdjustModal(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
