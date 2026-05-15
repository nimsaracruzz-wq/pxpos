import React, { useState } from 'react'
import {
  Package, Search, Filter, Hash, Box,
  AlertCircle, CheckCircle2, XCircle, ShoppingBag
} from 'lucide-react'
import { useElectronicsStore } from '@/store'

export default function SerialInventory() {
  const { elProducts, serials } = useElectronicsStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredSerials = serials.filter(s => {
    const product = elProducts.find(p => p.id === s.productId)
    const searchMatch = 
      s.serial?.toLowerCase().includes(search.toLowerCase()) || 
      s.imei?.toLowerCase().includes(search.toLowerCase()) ||
      product?.name.toLowerCase().includes(search.toLowerCase())
    
    const statusMatch = statusFilter === 'all' || s.status === statusFilter
    
    return searchMatch && statusMatch
  })

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search serial, IMEI, or product..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
            <option value="rma">Sent for RMA</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Serial / IMEI</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">GRN Ref</th>
                <th className="px-4 py-3">Sale Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {filteredSerials.map(s => {
                const product = elProducts.find(p => p.id === s.productId)
                return (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                      {product?.name || 'Unknown Product'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {s.imei && <span className="font-mono text-xs flex items-center gap-1 text-gray-700 dark:text-gray-300"><Hash size={12}/> {s.imei}</span>}
                        {s.serial && <span className="font-mono text-xs flex items-center gap-1 text-gray-500 dark:text-gray-400"><Hash size={12}/> {s.serial}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'in_stock' && <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold"><CheckCircle2 size={12}/> In Stock</span>}
                      {s.status === 'sold' && <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold"><ShoppingBag size={12}/> Sold</span>}
                      {s.status === 'returned' && <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold"><AlertCircle size={12}/> Returned</span>}
                      {s.status === 'rma' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold"><AlertCircle size={12}/> RMA</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {s.grnId || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {s.saleId || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredSerials.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Package className="mx-auto mb-3 opacity-20" size={48} />
              <p>No serial records found matching your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
