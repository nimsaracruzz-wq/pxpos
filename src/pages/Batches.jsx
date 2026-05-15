import React, { useState, useMemo } from 'react'
import { Warehouse, AlertTriangle, Search, Filter, Flag } from 'lucide-react'
import { SectionHeader, SearchInput, Badge, EmptyState } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { useProductStore, useAppStore } from '@/store'

const STATUS_CONFIG = {
  expired:  { label: 'EXPIRED',    color: 'red',    border: 'border-red-500',    bg: 'bg-red-50',    text: 'text-red-700' },
  critical: { label: '< 3 Months', color: 'orange', border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  warning:  { label: '< 6 Months', color: 'yellow', border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  safe:     { label: 'Safe',        color: 'green',  border: 'border-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  unknown:  { label: 'No Date',     color: 'gray',   border: 'border-gray-300',   bg: 'bg-gray-50',   text: 'text-gray-500' },
}

function getExpiryStatus(expiryStr) {
  if (!expiryStr) return 'unknown'
  const exp = new Date(expiryStr)
  if (isNaN(exp)) return 'unknown'
  const now = new Date()
  const diffMs = exp - now
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30)
  if (diffMonths < 0) return 'expired'
  if (diffMonths <= 3) return 'critical'
  if (diffMonths <= 6) return 'warning'
  return 'safe'
}

// Check if barcode belongs to a Sri Lanka GS1 product (prefix 479)
function isSriLankaProduct(barcode) {
  if (!barcode) return false
  const b = String(barcode).replace(/\D/g, '')
  return b.startsWith('479') || b.startsWith('0479')
}

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All Items' },
  { value: 'expired',  label: 'Expired Only' },
  { value: 'critical', label: 'Expiring < 3 Months' },
  { value: 'warning',  label: 'Expiring < 6 Months' },
  { value: 'unknown',  label: 'No Expiry Date' },
]

export default function Batches() {
  const { products } = useProductStore()
  const { activeModule } = useAppStore()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [slOnly, setSlOnly] = useState(false)

  // Support both pharmacy and grocery modules
  const trackedProducts = useMemo(() => {
    const relevantModules = ['pharmacy', 'grocery']
    return products
      .filter((p) => {
        if (!p.active) return false
        if (!relevantModules.includes(p.module || activeModule)) return false
        if (slOnly && !isSriLankaProduct(p.barcode)) return false
        const q = search.toLowerCase()
        if (q && !p.name.toLowerCase().includes(q) && !p.id.includes(q) && !(p.batchNo || '').toLowerCase().includes(q)) return false
        return true
      })
      .map((p) => {
        const status = getExpiryStatus(p.expiry)
        return { ...p, status, isSL: isSriLankaProduct(p.barcode) }
      })
  }, [products, search, filter, slOnly, activeModule])

  const filtered = useMemo(() => {
    if (filter === 'all') return trackedProducts
    return trackedProducts.filter(p => p.status === filter)
  }, [trackedProducts, filter])

  const stats = {
    expired:  trackedProducts.filter(p => p.status === 'expired').length,
    critical: trackedProducts.filter(p => p.status === 'critical').length,
    warning:  trackedProducts.filter(p => p.status === 'warning').length,
    safe:     trackedProducts.filter(p => p.status === 'safe').length,
    unknown:  trackedProducts.filter(p => p.status === 'unknown').length,
  }

  const slCount = trackedProducts.filter(p => p.isSL).length

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: '#f4f7f5' }}>
      <SectionHeader
        title="Batch & Expiry Tracker"
        subtitle="Monitor stock validity — GS1 Sri Lanka (479) products highlighted"
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-3 mt-5 mb-6">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`card p-4 border-l-4 ${cfg.border} ${cfg.bg} text-left transition-all ${filter === key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
          >
            <p className={`${cfg.text} text-xs font-bold flex items-center gap-1`}>
              {key === 'expired' && <AlertTriangle size={13} />}
              {cfg.label}
            </p>
            <p className={`text-2xl font-black ${cfg.text} mt-1`}>{stats[key]}</p>
          </button>
        ))}
      </div>

      {/* SL GS1 highlight card */}
      {slCount > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800">
          <span className="text-lg">🇱🇰</span>
          <span><span className="font-bold">{slCount}</span> GS1 Sri Lanka products (barcode prefix 479) in stock</span>
          <button
            onClick={() => setSlOnly(!slOnly)}
            className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border transition-all ${slOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'}`}
          >
            {slOnly ? '🇱🇰 SL Only' : 'Show All'}
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, batch no., or ID..."
            className="max-w-xs"
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-base text-sm py-1.5"
          >
            {FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} products</span>
        </div>

        <table className="table-modern">
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch / Lot No.</th>
              <th>Barcode</th>
              <th>Stock</th>
              <th>Supplier</th>
              <th>Expiry Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-10 text-gray-400">
                  No products found with expiry tracking
                </td>
              </tr>
            )}
            {filtered.map(p => {
              const cfg = STATUS_CONFIG[p.status]
              const daysLeft = p.expiry
                ? Math.round((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24))
                : null
              return (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{p.id.substring(0, 8)}</p>
                      </div>
                      {p.isSL && (
                        <span title="GS1 Sri Lanka (479)" className="text-sm">🇱🇰</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {p.batchNo
                      ? <span className="font-mono text-xs bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-md">{p.batchNo}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="font-mono text-xs text-gray-500">{p.barcode || '—'}</td>
                  <td>{p.stock} {p.unit || 'units'}</td>
                  <td className="text-gray-500 text-sm">{p.supplier || '—'}</td>
                  <td>
                    <div>
                      <span className={`font-semibold text-sm ${p.status === 'expired' ? 'text-red-600' : p.status === 'critical' ? 'text-orange-600' : 'text-gray-700'}`}>
                        {p.expiry || '—'}
                      </span>
                      {daysLeft !== null && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge variant={cfg.color}>
                      {cfg.label}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
