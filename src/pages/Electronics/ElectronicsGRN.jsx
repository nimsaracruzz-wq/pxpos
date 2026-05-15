import React, { useState } from 'react'
import {
  FileText, Plus, Trash2, Save, ScanLine, AlertCircle, CheckCircle2, Package
} from 'lucide-react'
import { useElectronicsStore } from '@/store'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/Toast'
import { format } from 'date-fns'

export default function ElectronicsGRN() {
  const { elProducts, elSuppliers, addElGRN, serials } = useElectronicsStore()
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [items, setItems] = useState([])
  const [notes, setNotes] = useState('')
  const toast = useToast()

  const handleAddItem = (productId) => {
    if (!productId) return
    const product = elProducts.find(p => p.id === productId)
    setItems(prev => [...prev, {
      id: Math.random().toString(),
      productId: product.id,
      productName: product.name,
      cost: product.cost,
      qty: 1,
      serials: [{ id: Math.random().toString(), imei: '', serial: '' }]
    }])
  }

  const handleUpdateItemSerials = (itemId, serialsList) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, serials: serialsList, qty: serialsList.length } : i))
  }

  const handleSaveGRN = () => {
    if (!supplierId || !invoiceNo || items.length === 0) {
      toast.error('Please fill all required fields and add at least one item')
      return
    }

    // Validate serials
    const serialsToAdd = []
    let hasError = false
    
    items.forEach(item => {
      item.serials.forEach((s, idx) => {
        if (!s.imei && !s.serial) {
          toast.error(`Please provide IMEI or Serial for all ${item.productName} units`)
          hasError = true
        }
        
        // Local duplicate check
        if (!hasError && serialsToAdd.find(existing => (s.imei && existing.imei === s.imei) || (s.serial && existing.serial === s.serial))) {
          toast.error(`Duplicate Serial/IMEI found in this GRN: ${s.imei || s.serial}`)
          hasError = true
        }

        // Global duplicate check
        if (!hasError && serials.find(existing => (s.imei && existing.imei === s.imei) || (s.serial && existing.serial === s.serial))) {
          toast.error(`Serial/IMEI already exists in system inventory: ${s.imei || s.serial}`)
          hasError = true
        }

        if (!hasError) {
          serialsToAdd.push({
            productId: item.productId,
            supplierId: supplierId,
            imei: s.imei,
            serial: s.serial,
          })
        }
      })
    })

    if (hasError) return

    const grnData = {
      supplierId,
      invoiceNo,
      notes,
      items: items.map(i => ({ productId: i.productId, qty: i.qty, cost: i.cost }))
    }

    const { grnId, serialResults } = addElGRN(grnData, serialsToAdd)
    
    const fails = serialResults.filter(r => !r.success)
    if (fails.length > 0) {
      toast.warning(`GRN saved, but ${fails.length} serials failed (duplicates)`)
    } else {
      toast.success(`GRN ${grnId.substring(0,8)} received successfully!`)
    }
    
    // Reset form
    setSupplierId('')
    setInvoiceNo('')
    setItems([])
    setNotes('')
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.cost * item.qty), 0)

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <FileText /> Receive Stock (GRN)
            </h2>
            <p className="text-gray-500">Record incoming stock and scan serial numbers</p>
          </div>
          <button 
            onClick={handleSaveGRN}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <Save size={18} /> Save & Receive
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-zinc-950 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 mb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Supplier *</label>
              <select 
                className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
              >
                <option value="">Select Supplier...</option>
                {elSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Invoice / Ref No *</label>
              <input 
                type="text" 
                className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2024-001"
              />
            </div>
          </div>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Items & Serials</h3>
          <select 
            className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg p-2 text-sm max-w-xs"
            onChange={e => { handleAddItem(e.target.value); e.target.value = "" }}
            value=""
          >
            <option value="" disabled>+ Add Product to GRN...</option>
            {elProducts.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="space-y-6">
          {items.map((item, index) => (
            <div key={item.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{index + 1}</span>
                  <h4 className="font-bold text-lg text-gray-900 dark:text-zinc-100">{item.productName}</h4>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-bold">Unit Cost</p>
                    <p className="font-bold">{formatCurrency(item.cost)}</p>
                  </div>
                  <div className="text-right border-l pl-4 border-gray-200 dark:border-zinc-700">
                    <p className="text-xs text-gray-500 uppercase font-bold">Line Total</p>
                    <p className="font-bold text-blue-600">{formatCurrency(item.cost * item.qty)}</p>
                  </div>
                  <button 
                    onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                    className="ml-2 text-red-500 hover:bg-red-50 p-2 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-bold text-gray-500 flex items-center gap-2"><ScanLine size={16}/> Scan / Enter Serials ({item.qty} units)</p>
                  <button 
                    onClick={() => handleUpdateItemSerials(item.id, [...item.serials, { id: Math.random().toString(), imei: '', serial: '' }])}
                    className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> Add Unit
                  </button>
                </div>
                
                <div className="space-y-2">
                  {item.serials.map((serialObj, sIdx) => (
                    <div key={serialObj.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4">{sIdx + 1}.</span>
                      <input 
                        type="text" 
                        placeholder="IMEI (Optional if Serial provided)" 
                        className="flex-1 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-mono"
                        value={serialObj.imei}
                        onChange={e => {
                          const newSerials = [...item.serials]
                          newSerials[sIdx].imei = e.target.value
                          handleUpdateItemSerials(item.id, newSerials)
                        }}
                      />
                      <input 
                        type="text" 
                        placeholder="Serial Number" 
                        className="flex-1 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-mono"
                        value={serialObj.serial}
                        onChange={e => {
                          const newSerials = [...item.serials]
                          newSerials[sIdx].serial = e.target.value
                          handleUpdateItemSerials(item.id, newSerials)
                        }}
                      />
                      <button 
                        onClick={() => {
                          if (item.serials.length === 1) return
                          handleUpdateItemSerials(item.id, item.serials.filter(s => s.id !== serialObj.id))
                        }}
                        disabled={item.serials.length === 1}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          
          {items.length === 0 && (
            <div className="text-center p-12 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl text-gray-400">
              <Package size={48} className="mx-auto mb-4 opacity-30" />
              <p>No items added to GRN yet.<br/>Use the dropdown above to add products.</p>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex justify-between items-center">
            <div>
              <p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider text-sm mb-1">Total GRN Value</p>
              <p className="text-gray-500 text-sm">{items.reduce((s,i) => s+i.qty, 0)} units total</p>
            </div>
            <p className="text-4xl font-black text-blue-700 dark:text-blue-400">{formatCurrency(totalAmount)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
