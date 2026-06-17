import React, { useState } from 'react'
import { 
  ShieldCheck, 
  Search, 
  AlertTriangle, 
  CalendarDays, 
  User, 
  Hash, 
  Smartphone, 
  Plus, 
  Wrench, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  History 
} from 'lucide-react'
import { useElectronicsStore } from '@/store'
import { format } from 'date-fns'
import { syncToCloud } from '@/lib/firebase'

export default function WarrantyCheck() {
  const { getWarrantiesBySearch, warrantyClaims, addWarrantyClaim, updateWarrantyClaim } = useElectronicsStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)

  // Expandable sections for claim history per warranty card
  const [expandedClaims, setExpandedClaims] = useState({})

  // Modal state for filing a claim
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [selectedWarranty, setSelectedWarranty] = useState(null)
  const [claimForm, setClaimForm] = useState({
    reason: 'Manufacturing Defect',
    resolutionType: 'repair',
    notes: ''
  })

  // Modal state for updating a claim status
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [statusForm, setStatusForm] = useState({
    status: 'in_progress',
    resolutionNotes: ''
  })

  const handleSearch = (e) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return
    
    const matches = getWarrantiesBySearch(searchQuery)
    setResults(matches)
    setSearched(true)
  }

  // Reload search results if state changes (e.g. to sync statuses)
  const refreshSearch = () => {
    if (searchQuery.trim()) {
      const matches = getWarrantiesBySearch(searchQuery)
      setResults(matches)
    }
  }

  const toggleClaimExpansion = (warrantyId) => {
    setExpandedClaims(prev => ({
      ...prev,
      [warrantyId]: !prev[warrantyId]
    }))
  }

  const openClaimModal = (warranty) => {
    setSelectedWarranty(warranty)
    setClaimForm({
      reason: 'Manufacturing Defect',
      resolutionType: 'repair',
      notes: ''
    })
    setIsClaimModalOpen(true)
  }

  const handleFileClaim = (e) => {
    e.preventDefault()
    if (!selectedWarranty) return

    addWarrantyClaim({
      warrantyId: selectedWarranty.id,
      productId: selectedWarranty.productId,
      productName: selectedWarranty.productName,
      serial: selectedWarranty.serial,
      imei: selectedWarranty.imei,
      saleId: selectedWarranty.saleId,
      receiptNo: selectedWarranty.receiptNo,
      customerId: selectedWarranty.customerId,
      reason: claimForm.reason,
      resolutionType: claimForm.resolutionType,
      notes: claimForm.notes,
      status: 'open'
    })

    setIsClaimModalOpen(false)
    setSelectedWarranty(null)
    syncToCloud().catch((err) => console.warn('[WarrantyClaim] Cloud sync failed (offline?):', err))
    
    // Automatically expand claims for this item to show the new claim
    setExpandedClaims(prev => ({ ...prev, [selectedWarranty.id]: true }))
    
    refreshSearch()
  }

  const openStatusModal = (claim) => {
    setSelectedClaim(claim)
    setStatusForm({
      status: claim.status || 'in_progress',
      resolutionNotes: claim.resolutionNotes || ''
    })
    setIsStatusModalOpen(true)
  }

  const handleUpdateStatus = (e) => {
    e.preventDefault()
    if (!selectedClaim) return

    updateWarrantyClaim(selectedClaim.id, {
      status: statusForm.status,
      resolutionNotes: statusForm.resolutionNotes
    })

    setIsStatusModalOpen(false)
    setSelectedClaim(null)
    syncToCloud().catch((err) => console.warn('[WarrantyClaim] Cloud sync failed (offline?):', err))
    refreshSearch()
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'PPP')
    } catch (e) {
      return dateString || 'N/A'
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock size={12} /> Open
          </span>
        )
      case 'in_progress':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <RefreshCw className="animate-spin" size={12} /> In Progress
          </span>
        )
      case 'resolved':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 size={12} /> Resolved
          </span>
        )
      case 'rejected':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
            <XCircle size={12} /> Rejected
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Warranty Claim Tracking</h2>
          <p className="text-gray-500 dark:text-zinc-400">Lookup warranties by IMEI, Serial, or Invoice and manage per-item claims</p>
        </div>

        <form onSubmit={handleSearch} className="mb-8 max-w-2xl mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Scan/Type IMEI, Serial Number, or Invoice No..."
              className="w-full pl-12 pr-32 py-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 text-lg font-medium text-gray-900 dark:text-white"
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
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl p-8 text-center max-w-2xl mx-auto">
                <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
                <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">No Records Found</h3>
                <p className="text-red-600/80 dark:text-red-500/80">
                  We couldn't find any warranty records matching "{searchQuery}". 
                  Please check the invoice number, serial, or IMEI and try again.
                </p>
              </div>
            ) : (
              results.map((result) => {
                const claims = warrantyClaims.filter(c => c.warrantyId === result.id)
                const isExpanded = !!expandedClaims[result.id]
                
                return (
                  <div key={result.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-md transition-all hover:shadow-lg">
                    {/* Header Banner */}
                    <div className={`p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 ${result.isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                      <div className="flex items-center gap-3">
                        {result.isActive ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
                        <div>
                          <h3 className="text-xl font-bold">
                            {result.isActive ? 'Warranty Active' : 'Warranty Expired'}
                          </h3>
                          <p className="text-white/80 font-medium text-sm mt-0.5">
                            {result.isActive 
                              ? `${result.daysLeft} days remaining on warranty` 
                              : `Expired ${Math.abs(result.daysLeft)} days ago`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openClaimModal(result)}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm"
                        >
                          <Plus size={16} /> File Claim
                        </button>
                      </div>
                    </div>
                    
                    {/* Details section */}
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row items-start gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                          <Smartphone className="text-gray-500" size={24} />
                        </div>
                        <div className="flex-1 w-full">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Product Details</p>
                              <h4 className="text-lg font-bold text-gray-900 dark:text-white">{result.productName}</h4>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Invoice / Receipt No</p>
                              <p className="font-mono text-sm font-bold bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg text-gray-700 dark:text-zinc-300 inline-block">
                                {result.receiptNo}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-3">
                            {result.imei && <span className="text-sm text-gray-600 dark:text-gray-400 font-mono flex items-center gap-1"><Hash size={14}/> IMEI: {result.imei}</span>}
                            {result.serial && <span className="text-sm text-gray-600 dark:text-gray-400 font-mono flex items-center gap-1"><Hash size={14}/> S/N: {result.serial}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CalendarDays size={14} /> Coverage Period
                          </p>
                          <div className="bg-gray-50 dark:bg-zinc-800/40 rounded-xl p-4">
                            <div className="mb-2 flex justify-between">
                              <span className="text-xs text-gray-500">Start Date:</span>
                              <span className="font-semibold text-sm text-gray-900 dark:text-white">{formatDate(result.startDate)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">End Date:</span>
                              <span className="font-semibold text-sm text-gray-900 dark:text-white">{formatDate(result.endDate)}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <User size={14} /> Customer Details
                          </p>
                          <div className="bg-gray-50 dark:bg-zinc-800/40 rounded-xl p-4 h-full flex flex-col justify-between">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">Customer ID:</span>
                              <span className="font-semibold text-sm text-gray-900 dark:text-white">{result.customerId}</span>
                            </div>
                            <div className="flex justify-between mt-2">
                              <span className="text-xs text-gray-500">Sale ID:</span>
                              <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate max-w-[150px]">{result.saleId}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Claims History Section */}
                      <div className="mt-6 border-t border-gray-100 dark:border-zinc-800 pt-4">
                        <button
                          onClick={() => toggleClaimExpansion(result.id)}
                          className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <History size={16} />
                            <span>Claim History</span>
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                              {claims.length}
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-4 space-y-4 animate-slide-down">
                            {claims.length === 0 ? (
                              <p className="text-center text-sm text-gray-400 dark:text-zinc-500 py-4 italic bg-gray-50/50 dark:bg-zinc-800/20 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
                                No claims recorded for this item.
                              </p>
                            ) : (
                              <div className="relative pl-6 border-l border-gray-200 dark:border-zinc-800 space-y-6">
                                {claims.map((claim) => (
                                  <div key={claim.id} className="relative bg-gray-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                                    {/* timeline marker dot */}
                                    <div className="absolute -left-[31px] top-5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-zinc-900" />
                                    
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                      <div className="flex items-center gap-2">
                                        {getStatusBadge(claim.status)}
                                        <span className="text-xs text-gray-500">{formatDate(claim.claimedAt)}</span>
                                      </div>
                                      
                                      <button
                                        onClick={() => openStatusModal(claim)}
                                        className="px-2.5 py-1 text-xs font-bold border border-gray-300 hover:bg-gray-100 dark:border-zinc-700 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-700 dark:text-zinc-300"
                                      >
                                        Update Status
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-2.5">
                                      <div>
                                        <span className="text-xs text-gray-400 block">Reason for Claim</span>
                                        <span className="font-semibold text-gray-800 dark:text-zinc-200">{claim.reason}</span>
                                      </div>
                                      <div>
                                        <span className="text-xs text-gray-400 block">Requested Resolution</span>
                                        <span className="font-semibold text-gray-800 dark:text-zinc-200 capitalize">{claim.resolutionType}</span>
                                      </div>
                                    </div>

                                    {claim.notes && (
                                      <div className="text-sm bg-white dark:bg-zinc-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800 mb-2">
                                        <span className="text-xs text-gray-400 block mb-0.5">Notes:</span>
                                        <p className="text-gray-700 dark:text-zinc-300 font-medium whitespace-pre-wrap">{claim.notes}</p>
                                      </div>
                                    )}

                                    {claim.resolutionNotes && (
                                      <div className="text-sm bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block mb-0.5">Resolution Notes:</span>
                                        <p className="text-gray-700 dark:text-zinc-300 whitespace-pre-wrap font-medium">{claim.resolutionNotes}</p>
                                        {claim.resolvedAt && (
                                          <span className="text-[10px] text-gray-400 mt-1 block">
                                            Resolved/Updated on {formatDate(claim.resolvedAt)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* MODAL: File Warranty Claim */}
      {isClaimModalOpen && selectedWarranty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-150 dark:border-zinc-800 animate-scale-up">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 bg-gray-55">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">File Warranty Claim</h3>
              <p className="text-xs text-gray-500 mt-1">
                Filing claim for <span className="font-bold text-gray-700 dark:text-zinc-300">{selectedWarranty.productName}</span>
              </p>
            </div>
            
            <form onSubmit={handleFileClaim} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Claim Reason / Problem</label>
                <select
                  value={claimForm.reason}
                  onChange={(e) => setClaimForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Manufacturing Defect">Manufacturing Defect</option>
                  <option value="Dead on Arrival (DOA)">Dead on Arrival (DOA)</option>
                  <option value="Hardware Malfunction">Hardware Malfunction</option>
                  <option value="Screen / Display Defect">Screen / Display Defect</option>
                  <option value="Power / Battery Issue">Power / Battery Issue</option>
                  <option value="Connectivity Issue">Connectivity Issue</option>
                  <option value="Physical / External Damage">Physical / External Damage</option>
                  <option value="Other / Unspecified Issue">Other / Unspecified Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Requested Resolution</label>
                <div className="grid grid-cols-3 gap-3">
                  {['repair', 'replace', 'refund'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setClaimForm(prev => ({ ...prev, resolutionType: type }))}
                      className={`py-3 px-4 text-sm font-bold border rounded-xl capitalize transition-all ${
                        claimForm.resolutionType === type
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Detailed Notes</label>
                <textarea
                  placeholder="Describe the defect, diagnostics run, and customer statements..."
                  rows={4}
                  value={claimForm.notes}
                  onChange={(e) => setClaimForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsClaimModalOpen(false)
                    setSelectedWarranty(null)
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 font-bold rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Update Claim Status */}
      {isStatusModalOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-150 dark:border-zinc-800 animate-scale-up">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 bg-gray-55">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Update Claim Status</h3>
              <p className="text-xs text-gray-500 mt-1">
                Updating claim for <span className="font-bold text-gray-700 dark:text-zinc-300">{selectedClaim.productName}</span>
              </p>
            </div>
            
            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: 'open', label: 'Open' },
                    { val: 'in_progress', label: 'In Progress' },
                    { val: 'resolved', label: 'Resolved' },
                    { val: 'rejected', label: 'Rejected' }
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setStatusForm(prev => ({ ...prev, status: s.val }))}
                      className={`py-2 px-3 text-xs font-bold border rounded-lg transition-all ${
                        statusForm.status === s.val
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Resolution Remarks / Notes</label>
                <textarea
                  placeholder="Detail the actions taken: e.g. repaired part replacement, replacement tracking number, or reason for rejection..."
                  rows={4}
                  value={statusForm.resolutionNotes}
                  onChange={(e) => setStatusForm(prev => ({ ...prev, resolutionNotes: e.target.value }))}
                  className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required={['resolved', 'rejected'].includes(statusForm.status)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsStatusModalOpen(false)
                    setSelectedClaim(null)
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 font-bold rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

