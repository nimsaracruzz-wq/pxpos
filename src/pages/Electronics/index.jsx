import React, { useState, useMemo } from 'react'
import {
  Smartphone, ShieldCheck, Wrench, Search, Package,
  User, CheckCircle2, XCircle, FileText, AlertCircle, ShoppingCart, Plus, Minus, CreditCard, Banknote
} from 'lucide-react'
import { useElectronicsStore, useAppStore } from '@/store'
import { Modal } from '@/components/ui'
import { formatCurrency, generateReceiptNumber } from '@/lib/utils'
import { useToast } from '@/components/Toast'

// --- Sub-components will go here ---
import WarrantyCheck from './WarrantyCheck'
import RepairJobs from './RepairJobs'
import SerialInventory from './SerialInventory'
import ElectronicsGRN from './ElectronicsGRN'

export default function Electronics() {
  const [activeTab, setActiveTab] = useState('warranty')
  const { businessInfo } = useAppStore()

  const tabs = [
    { id: 'warranty', label: 'Warranty Check', icon: ShieldCheck },
    { id: 'repairs', label: 'Repair Jobs', icon: Wrench },
    { id: 'inventory', label: 'Inventory (Serials)', icon: Package },
    { id: 'grn', label: 'Receive Stock (GRN)', icon: FileText },
  ]

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 p-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Smartphone className="text-blue-600 dark:text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">Computer & Mobile Shop</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Electronics retail management with serial tracking</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'warranty' && <WarrantyCheck />}
        {activeTab === 'repairs' && <RepairJobs />}
        {activeTab === 'inventory' && <SerialInventory />}
        {activeTab === 'grn' && <ElectronicsGRN />}
      </div>
    </div>
  )
}
