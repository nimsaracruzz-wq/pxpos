import React, { useState, useEffect } from 'react'
import {
  Wrench, Plus, Search, Calendar, User, Smartphone,
  CheckCircle2, Clock, AlertCircle, FileText, Shield, PenTool, Hash,
  ChevronRight, ArrowRight
} from 'lucide-react'
import { useElectronicsStore } from '@/store'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Modal } from '@/components/ui'
import { useToast } from '@/components/Toast'

function NewJobModal({ onClose }) {
  const { elCustomers, addRepairJob, addElCustomer, getWarrantyStatus } = useElectronicsStore()
  const toast = useToast()
  
  const [tab, setTab] = useState('custom') // 'custom' | 'warranty'
  
  const [serialSearch, setSerialSearch] = useState('')
  const [warrantyInfo, setWarrantyInfo] = useState(null)
  
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [imei, setImei] = useState('')
  const [issue, setIssue] = useState('')
  const [technician, setTechnician] = useState('')
  const [cost, setCost] = useState('')

  const handleCheckWarranty = () => {
    if (!serialSearch) return
    const w = getWarrantyStatus(serialSearch)
    if (w) {
      setWarrantyInfo(w)
      setDeviceName(w.productName)
      setImei(w.serial || w.imei || serialSearch)
      setCustomerId(w.customerId)
      setCost(w.isActive ? '0' : '')
    } else {
      setWarrantyInfo({ notFound: true })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    let cid = customerId
    if (cid === 'new' || !cid) {
      if (!newCustomerName) {
        toast.error('Customer name is required')
        return
      }
      cid = addElCustomer({ name: newCustomerName, phone: newCustomerPhone })
    }
    
    if (!deviceName || !issue) {
      toast.error('Device name and issue are required')
      return
    }

    addRepairJob({
      customerId: cid,
      deviceName,
      imei,
      issue,
      technicianName: technician,
      estimatedCost: Number(cost) || 0,
      jobType: tab,
      warrantyRecordId: warrantyInfo?.id || null
    })
    
    toast.success('Repair job created successfully')
    onClose()
  }

  return (
    <Modal title="Create Service Job" open={true} onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex bg-gray-100/80 dark:bg-zinc-800/80 p-1.5 rounded-2xl mb-6 shadow-inner">
        <button
          onClick={() => { setTab('custom'); setWarrantyInfo(null) }}
          className={cn(
            'flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-300',
            tab === 'custom' ? 'bg-white dark:bg-zinc-900 shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Wrench size={18} /> Custom Repair
        </button>
        <button
          onClick={() => setTab('warranty')}
          className={cn(
            'flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-300',
            tab === 'warranty' ? 'bg-white dark:bg-zinc-900 shadow-md text-emerald-600' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Shield size={18} /> Warranty Claim
        </button>
      </div>

      <div className="space-y-6">
        {tab === 'warranty' && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-sm">
            <label className="block text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-3">
              Warranty Verification
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                <input
                  type="text"
                  className="w-full bg-white dark:bg-zinc-900 border-0 shadow-sm rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Scan or enter Serial / IMEI..."
                  value={serialSearch}
                  onChange={(e) => setSerialSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckWarranty()}
                  autoFocus
                />
              </div>
              <button 
                onClick={handleCheckWarranty}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md shadow-emerald-200 dark:shadow-none transition-transform active:scale-95 flex items-center gap-2"
              >
                Verify <ArrowRight size={16}/>
              </button>
            </div>
            
            {warrantyInfo?.notFound && (
              <div className="mt-4 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30 animate-shake">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm font-bold">No valid warranty record found for "{serialSearch}".</p>
              </div>
            )}

            {warrantyInfo && !warrantyInfo.notFound && (
              <div className={cn(
                "mt-4 p-4 rounded-xl border flex items-start gap-4 animate-scale-in shadow-sm",
                warrantyInfo.isActive 
                  ? 'bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-800/50' 
                  : 'bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-800/50'
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                  warrantyInfo.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                )}>
                  {warrantyInfo.isActive ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 dark:text-zinc-100 text-lg truncate">{warrantyInfo.productName}</p>
                  <p className={cn("text-sm font-semibold mt-0.5", warrantyInfo.isActive ? "text-emerald-600" : "text-amber-600")}>
                    {warrantyInfo.isActive 
                      ? `Active • ${warrantyInfo.daysLeft} days remaining` 
                      : `Expired on ${format(new Date(warrantyInfo.endDate), 'MMM d, yyyy')}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <form id="repair-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-5">
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Customer</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select 
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select or Create...</option>
                {elCustomers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                <option value="new" className="font-bold text-blue-600">+ Create New Customer</option>
              </select>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Device Name / Model</label>
            <div className="relative">
              <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input required type="text" className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={deviceName} onChange={e=>setDeviceName(e.target.value)} placeholder="e.g. iPhone 15 Pro Max" />
            </div>
          </div>

          {customerId === 'new' && (
            <div className="col-span-2 grid grid-cols-2 gap-4 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest ml-1">Full Name</label>
                <input required type="text" className="w-full bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" value={newCustomerName} onChange={e=>setNewCustomerName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest ml-1">Phone Number</label>
                <input required type="text" className="w-full bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" value={newCustomerPhone} onChange={e=>setNewCustomerPhone(e.target.value)} placeholder="07X XXX XXXX" />
              </div>
            </div>
          )}

          <div className="col-span-2 space-y-1">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Reported Issue</label>
            <textarea required rows={3} className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" value={issue} onChange={e=>setIssue(e.target.value)} placeholder="Describe the physical damage or software problem in detail..." />
          </div>

          <div className="col-span-2 sm:col-span-1 space-y-1">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">IMEI / Serial No (Optional)</label>
            <div className="relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={imei} onChange={e=>setImei(e.target.value)} placeholder="Device identifier" />
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 space-y-1 grid grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1 truncate">Technician</label>
               <input type="text" className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={technician} onChange={e=>setTechnician(e.target.value)} placeholder="Name" />
             </div>
             <div className="space-y-1">
               <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1 truncate">Est. Cost</label>
               <input type="number" className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={cost} onChange={e=>setCost(e.target.value)} placeholder={tab === 'warranty' && warrantyInfo?.isActive ? '0' : 'Rs. 0'} />
             </div>
          </div>
        </form>
      </div>

      <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-gray-100 dark:border-zinc-800">
        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
          Cancel
        </button>
        <button type="submit" form="repair-form" className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-transform active:scale-95 flex items-center gap-2">
          <PenTool size={16}/> Create Job
        </button>
      </div>
    </Modal>
  )
}

export default function RepairJobs() {
  const { repairJobs, elCustomers, updateRepairJob, deleteRepairJob } = useElectronicsStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewJob, setShowNewJob] = useState(false)

  // Auto-clear demo jobs from IndexedDB on mount
  useEffect(() => {
    repairJobs.forEach(job => {
      if (job.id === 'rep1' || job.id === 'rep2') {
        deleteRepairJob(job.id)
      }
    })
  }, [repairJobs, deleteRepairJob])

  const filteredJobs = repairJobs.filter(job => {
    const matchesSearch = job.jobNo.toLowerCase().includes(search.toLowerCase()) || 
                          job.deviceName.toLowerCase().includes(search.toLowerCase()) ||
                          job.imei?.includes(search)
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status) => {
    switch (status) {
      case 'received': return <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><FileText size={12}/> Received</span>
      case 'in_progress': return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Clock size={12}/> In Progress</span>
      case 'ready': return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={12}/> Ready</span>
      case 'delivered': return <span className="bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><User size={12}/> Delivered</span>
      default: return null
    }
  }

  const handleStatusChange = (jobId, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'ready') updates.completedDate = new Date().toISOString()
    updateRepairJob(jobId, updates)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-zinc-950">
      {/* Top Action Bar */}
      <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-zinc-900 shadow-sm z-10">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by Job #, Device or IMEI..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-medium px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="received">Received</option>
            <option value="in_progress">In Progress</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        <button 
          onClick={() => setShowNewJob(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-transform active:scale-95 w-full sm:w-auto justify-center"
        >
          <Plus size={18} /> New Job
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto animate-fade-in">
            <div className="w-24 h-24 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <Wrench size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-zinc-100 mb-2">No repair jobs found</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Create your first repair job to start tracking device repairs, servicing, and warranty claims.
            </p>
            <button 
              onClick={() => setShowNewJob(true)}
              className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1"
            >
              <Plus size={16}/> Create a New Job
            </button>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredJobs.map(job => {
              const customer = elCustomers.find(c => c.id === job.customerId)
              return (
                <div key={job.id} className="group relative border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col">
                  {/* Decorative Header Gradient */}
                  <div className={cn(
                    "h-2 w-full absolute top-0 left-0",
                    job.jobType === 'warranty' ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-blue-400 to-indigo-500"
                  )} />
                  
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                          job.jobType === 'warranty' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                        )}>
                          {job.jobType === 'warranty' ? <Shield size={26} /> : <Wrench size={26} />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-black text-gray-900 dark:text-zinc-100 text-lg">{job.deviceName}</h3>
                            {getStatusBadge(job.status)}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">#{job.jobNo}</span>
                            {job.jobType === 'warranty' && (
                              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                                Warranty
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className={cn("text-xl font-black", job.jobType === 'warranty' && job.estimatedCost === 0 ? "text-emerald-600" : "text-gray-900 dark:text-white")}>
                          {job.estimatedCost === 0 ? 'Covered' : formatCurrency(job.estimatedCost)}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Est. Cost</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-gray-50/80 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 sm:col-span-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><AlertCircle size={12}/> Reported Issue</p>
                        <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 line-clamp-2" title={job.issue}>{job.issue}</p>
                      </div>
                      <div className="bg-gray-50/80 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><User size={12}/> Customer</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-zinc-200 truncate">{customer?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{customer?.phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-zinc-800/30 px-5 py-4 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4 items-center">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                        <Calendar size={14}/> {format(new Date(job.receivedDate), 'MMM d, yyyy')}
                      </div>
                      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                        <User size={14}/> {job.technicianName || 'Unassigned'}
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      {job.status === 'received' && (
                        <button onClick={() => handleStatusChange(job.id, 'in_progress')} className="flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors">
                          Start Repair
                        </button>
                      )}
                      {job.status === 'in_progress' && (
                        <button onClick={() => handleStatusChange(job.id, 'ready')} className="flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors">
                          Mark Ready
                        </button>
                      )}
                      {job.status === 'ready' && (
                        <button onClick={() => handleStatusChange(job.id, 'delivered')} className="flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                          Deliver <ChevronRight size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      {showNewJob && <NewJobModal onClose={() => setShowNewJob(false)} />}
    </div>
  )
}
