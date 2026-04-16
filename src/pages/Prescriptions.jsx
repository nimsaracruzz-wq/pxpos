import React, { useState } from 'react'
import { FileText, Plus, Search, CheckCircle, Clock } from 'lucide-react'
import { SectionHeader, SearchInput, Badge } from '@/components/ui'

export default function Prescriptions() {
  const [rxList] = useState([])

  return (
    <div className="h-full flex flex-col p-5 overflow-hidden">
      <SectionHeader 
        title="Rx Prescriptions" 
        subtitle="Log and dispense medical prescriptions"
        action={
          <button className="btn-primary">
            <Plus size={15} /> New Prescription Dispense
          </button>
        }
      />

      <div className="flex gap-6 mt-5 h-full overflow-hidden">
        {/* Left List */}
        <div className="w-1/3 flex flex-col gap-4 border-r border-gray-100 pr-6 h-full overflow-y-auto">
          <SearchInput placeholder="Search Rx ID or Patient name..." />
          <div className="flex flex-col gap-3 mt-2">
            {rxList.map(rx => (
              <div key={rx.id} className={`card p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${rx.status === 'dispensed' ? 'border-green-500' : 'border-amber-500'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs font-bold text-gray-500">{rx.id}</span>
                  <Badge variant={rx.status === 'dispensed' ? 'green' : 'yellow'}>{rx.status.toUpperCase()}</Badge>
                </div>
                <p className="font-bold text-lg text-gray-800">{rx.patient}</p>
                <p className="text-sm text-gray-500">{rx.doctor}</p>
                <p className="text-xs text-gray-400 mt-2">{rx.items.length} items prescribed</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 bg-white border border-gray-100 shadow-sm rounded-2xl p-6 h-full flex flex-col">
          <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
            <div>
              <h2 className="text-2xl font-black text-gray-800">RX-7782</h2>
              <p className="text-gray-500 font-medium">Patient: <span className="text-gray-800">Jane Roe</span></p>
              <p className="text-sm text-gray-400 mt-1">Prescribed by Dr. Alan Wake on 2026-04-08</p>
            </div>
            <Badge variant="yellow" className="text-sm py-1 px-3">PENDING DISPENSAL</Badge>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-gray-700 mb-3">Prescribed Medications</h3>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Medication Name</th>
                    <th>Dosage</th>
                    <th>Quantity</th>
                    <th>Available Stock</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold text-gray-800">Lisinopril 10mg</td>
                    <td className="text-gray-500">1 tab daily</td>
                    <td>30 tabs</td>
                    <td className="text-green-600 font-bold">150 tabs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-3 justify-end">
            <button className="btn-secondary">Hold</button>
            <button className="btn-primary" style={{ background: '#7c3aed' }}>
              <CheckCircle size={16} /> Dispense & Send to POS
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

