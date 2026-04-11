import React, { useState, useMemo } from 'react'
import { Warehouse, AlertTriangle, Search, Filter } from 'lucide-react'
import { SectionHeader, SearchInput, Badge, EmptyState } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { useProductStore } from '@/store'

export default function Batches() {
  const { products } = useProductStore()
  
  const [search, setSearch] = useState('')

  const pharmacyProducts = useMemo(() => {
    return products
      .filter((p) => p.module === 'pharmacy' && p.active && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)))
      .map(p => {
        let status = 'safe'
        if (!p.expiry) return { ...p, status: 'unknown' }
        const exp = new Date(p.expiry)
        const now = new Date()
        const diffMonths = (exp - now) / (1000 * 60 * 60 * 24 * 30)
        
        if (diffMonths < 0) status = 'expired'
        else if (diffMonths <= 3) status = 'critical'
        else if (diffMonths <= 6) status = 'warning'
        
        return { ...p, status }
      })
  }, [products, search])

  const stats = {
    expired: pharmacyProducts.filter(p => p.status === 'expired').length,
    critical: pharmacyProducts.filter(p => p.status === 'critical').length,
    warning: pharmacyProducts.filter(p => p.status === 'warning').length,
    safe: pharmacyProducts.filter(p => p.status === 'safe' || p.status === 'unknown').length,
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHeader 
        title="Batch & Expiry Tracker" 
        subtitle="Monitor pharmaceutical stock validity and critical expirations"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary text-sm">
              <Filter size={15} /> Filter Expiring Soon
            </button>
            <button className="btn-primary text-sm">
              Log New Batch
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mt-5 mb-6">
        <div className="card p-4 border-l-4 border-red-500 bg-red-50">
          <p className="text-red-700 text-sm font-bold flex items-center gap-2"><AlertTriangle size={16}/> Expired</p>
          <p className="text-2xl font-black text-red-700 mt-1">{stats.expired}</p>
        </div>
        <div className="card p-4 border-l-4 border-orange-500 bg-orange-50">
          <p className="text-orange-700 text-sm font-bold">Expires &lt; 3 Months</p>
          <p className="text-2xl font-black text-orange-700 mt-1">{stats.critical}</p>
        </div>
        <div className="card p-4 border-l-4 border-yellow-500 bg-yellow-50">
          <p className="text-yellow-700 text-sm font-bold">Expires &lt; 6 Months</p>
          <p className="text-2xl font-black text-yellow-700 mt-1">{stats.warning}</p>
        </div>
        <div className="card p-4 border-l-4 border-green-500 bg-green-50">
          <p className="text-green-700 text-sm font-bold">Safe Stock</p>
          <p className="text-2xl font-black text-green-700 mt-1">{stats.safe}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
           <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch by ID or drug name..." className="max-w-md" />
        </div>
        <table className="table-modern">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Drug Name</th>
              <th>Current Stock</th>
              <th>Supplier</th>
              <th>Expiry Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pharmacyProducts.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-10 text-gray-400">No batches recorded in Pharmacy module</td>
              </tr>
            )}
            {pharmacyProducts.map(b => (
              <tr key={b.id}>
                <td className="font-mono text-xs text-gray-500">{b.id.substring(0,8)}</td>
                <td className="font-bold text-gray-800">{b.name}</td>
                <td>{b.stock} {b.unit || 'units'}</td>
                <td className="text-gray-500 text-sm">{b.supplier || '—'}</td>
                <td>
                  <span className={`font-semibold ${b.status === 'expired' ? 'text-red-600' : b.status === 'critical' ? 'text-orange-600' : 'text-gray-700'}`}>
                    {b.expiry || 'No Date'}
                  </span>
                </td>
                <td>
                  <Badge variant={b.status === 'expired' ? 'red' : b.status === 'critical' ? 'orange' : b.status === 'warning' ? 'yellow' : b.status === 'unknown' ? 'gray' : 'green'}>
                    {b.status.toUpperCase()}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
