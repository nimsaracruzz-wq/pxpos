import React, { useState } from 'react'
import { ShieldCheck, Search, AlertTriangle, CalendarDays, User, Hash, Smartphone } from 'lucide-react'
import { useElectronicsStore } from '@/store'
import { format } from 'date-fns'

export default function WarrantyCheck() {
  const { getWarrantiesBySearch } = useElectronicsStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  const handleSearch = (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    
    const matches = getWarrantiesBySearch(searchQuery)
    setResults(matches)
    setSearched(true)
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Warranty Lookup</h2>
          <p className="text-gray-500">Check warranty status using IMEI or Serial Number</p>
        </div>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Scan or type IMEI / Serial Number..."
              className="w-full pl-12 pr-32 py-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 text-lg font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="absolute right-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors"
            >
              Check
            </button>
          </div>
        </form>

        {searched && (
          <div className="animate-fade-in space-y-6">
            {results.length === 0 ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl p-8 text-center">
                <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
                <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">No Records Found</h3>
                <p className="text-red-600/80 dark:text-red-500/80">We couldn't find any warranty records for "{searchQuery}". Please verify the IMEI, Serial, or Invoice number and try again.</p>
              </div>
            ) : (
              results.map((result) => (
                <div key={result.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className={`p-6 text-white ${result.isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      {result.isActive ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
                      <h3 className="text-2xl font-bold">
                        {result.isActive ? 'Warranty Active' : 'Warranty Expired'}
                      </h3>
                    </div>
                    <p className="text-white/80 font-medium text-lg">
                      {result.isActive 
                        ? `${result.daysLeft} days remaining on warranty` 
                        : `Expired ${Math.abs(result.daysLeft)} days ago`}
                    </p>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <Smartphone className="text-gray-500" size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Product Details</p>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white">{result.productName}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Invoice No</p>
                            <p className="font-mono text-sm font-bold bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg text-gray-700 dark:text-zinc-300">
                              {result.receiptNo}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2">
                          {result.imei && <span className="text-sm text-gray-600 dark:text-gray-400 font-mono flex items-center gap-1"><Hash size={14}/> IMEI: {result.imei}</span>}
                          {result.serial && <span className="text-sm text-gray-600 dark:text-gray-400 font-mono flex items-center gap-1"><Hash size={14}/> S/N: {result.serial}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <CalendarDays size={16} /> Coverage Period
                        </p>
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4">
                          <div className="mb-2">
                            <span className="text-xs text-gray-500">Start Date</span>
                            <p className="font-semibold text-gray-900 dark:text-white">{format(new Date(result.startDate), 'PPP')}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">End Date</span>
                            <p className="font-semibold text-gray-900 dark:text-white">{format(new Date(result.endDate), 'PPP')}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <User size={16} /> Customer Details
                        </p>
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 h-full">
                          <p className="font-semibold text-gray-900 dark:text-white mb-1">Customer ID: {result.customerId}</p>
                          <p className="text-sm text-gray-500">Original Sale ID: <span className="font-mono text-xs truncate block mt-1">{result.saleId}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
