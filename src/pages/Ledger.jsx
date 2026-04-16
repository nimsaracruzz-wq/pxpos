import React, { useState, useMemo } from 'react'
import { BookOpen, Plus, ArrowUpRight, ArrowDownLeft, TrendingDown, Search, Download, DollarSign } from 'lucide-react'
import { useCustomerStore } from '@/store'
import { useToast } from '@/components/Toast'
import { Badge, Modal, Input, Select, SectionHeader, SearchInput, StatCard } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { format } from 'date-fns'

// ─── Ledger store ─────────────────────────────────────────────────────────────
const useLedgerStore = create(
  persist(
    (set, get) => ({
      entries: [
        { id: '1', customerId: '2', type: 'purchase', amount: 25000, balance: 25000, description: 'Invoice INV-2026-001', date: new Date(Date.now() - 86400000 * 5), ref: 'INV-001' },
        { id: '2', customerId: '2', type: 'payment', amount: 20000, balance: 5000, description: 'Cash payment received', date: new Date(Date.now() - 86400000 * 2), ref: 'PMT-001' },
      ],
      addEntry: (entry) =>
        set((s) => ({ entries: [{ ...entry, id: uuidv4(), date: new Date() }, ...s.entries] })),
      getBalance: (customerId) => {
        const entries = get().entries.filter((e) => e.customerId === customerId)
        if (!entries.length) return 0
        return entries[0].balance
      },
      getHistory: (customerId) =>
        get().entries.filter((e) => e.customerId === customerId).sort((a, b) => new Date(b.date) - new Date(a.date)),
    }),
    { name: 'paxxmo-ledger' }
  )
)

function EntryModal({ customer, onClose }) {
  const { addEntry, getBalance } = useLedgerStore()
  const { updateCustomer } = useCustomerStore()
  const toast = useToast()
  const [type, setType] = useState('payment')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [ref, setRef] = useState('')

  const currentBalance = getBalance(customer.id)

  const handleSubmit = (e) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    const newBalance = type === 'purchase'
      ? currentBalance + amt
      : Math.max(0, currentBalance - amt)
    addEntry({
      customerId: customer.id,
      type,
      amount: amt,
      balance: newBalance,
      description: description || (type === 'payment' ? 'Payment received' : 'Credit purchase'),
      ref,
    })
    updateCustomer(customer.id, { credit: newBalance })
    toast.success(type === 'payment' ? `Payment of ${formatCurrency(amt)} recorded` : `Credit of ${formatCurrency(amt)} added`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Add Entry — ${customer.name}`} maxWidth="max-w-md">
      <div className="p-3 rounded-xl mb-4 flex items-center justify-between" style={{ background: currentBalance > 0 ? '#fef2f2' : '#f0fdf4' }}>
        <span className="text-sm font-medium text-gray-700">Current Balance</span>
        <span className={cn('text-xl font-black', currentBalance > 0 ? 'text-red-600' : 'text-green-600')}>
          {formatCurrency(currentBalance)}
        </span>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('purchase')}
            className={cn('flex-1 py-3 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-2 transition-all',
              type === 'purchase' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500')}
          >
            <ArrowUpRight size={16} /> Credit (Sell)
          </button>
          <button
            type="button"
            onClick={() => setType('payment')}
            className={cn('flex-1 py-3 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-2 transition-all',
              type === 'payment' ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500')}
          >
            <ArrowDownLeft size={16} /> Payment (Receive)
          </button>
        </div>
        <Input label="Amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Invoice #INV-001" />
        <Input label="Reference No." value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional reference" />
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1 justify-center">Save Entry</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Ledger() {
  const { customers } = useCustomerStore()
  const { entries, getBalance, getHistory } = useLedgerStore()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showEntryModal, setShowEntryModal] = useState(false)

  // only wholesale customers
  const ledgerCustomers = customers.filter((c) => c.type === 'wholesale' || c.credit > 0)
  const filtered = ledgerCustomers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  const totalOutstanding = useMemo(
    () => ledgerCustomers.reduce((s, c) => s + getBalance(c.id), 0),
    [customers, entries]
  )
  const history = selected ? getHistory(selected.id) : []

  const handleExport = () => {
    const rows = [['Customer', 'Date', 'Type', 'Amount', 'Balance', 'Description', 'Ref']]
    entries.forEach((e) => {
      const c = customers.find((cx) => cx.id === e.customerId)
      rows.push([c?.name || '-', format(new Date(e.date), 'yyyy-MM-dd'), e.type, e.amount, e.balance, e.description, e.ref || ''])
    })
    const csv = rows.map((r) => r.join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'ledger-export.csv',
    })
    a.click()
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: customer list */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{ width: 320, borderRight: '1px solid #f0f0f0', background: 'white' }}
      >
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">Customer Ledger</h2>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
          />
        </div>

        <div className="px-3 py-2 border-b border-gray-100 bg-red-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600">Total Outstanding</span>
            <span className="font-black text-red-700">{formatCurrency(totalOutstanding)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              No wholesale customers. Change customer type to "Wholesale" in Customers page.
            </div>
          ) : (
            filtered.map((c) => {
              const bal = getBalance(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-50 transition-colors',
                    selected?.id === c.id ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}
                    >
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </div>
                    <div className="text-right">
                      {bal > 0 ? (
                        <p className="text-sm font-bold text-red-600">{formatCurrency(bal)}</p>
                      ) : (
                        <Badge variant="green" className="text-xs">Clear</Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto p-5">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <BookOpen size={48} className="mb-3 opacity-30" />
            <p className="font-medium">Select a customer to view their ledger</p>
            <p className="text-sm mt-1 opacity-70">Track credit and payment history</p>
          </div>
        ) : (
          <>
            {/* Customer header */}
            <div className="card p-5 mb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}
                  >
                    {selected.name[0]}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                    <p className="text-sm text-gray-500">{selected.phone}</p>
                    <Badge variant="yellow" className="mt-1">Wholesale</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleExport} className="btn-ghost">
                    <Download size={14} /> Export
                  </button>
                  <button onClick={() => setShowEntryModal(true)} className="btn-primary">
                    <Plus size={14} /> Add Entry
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Outstanding Balance</p>
                  <p className={cn('text-2xl font-black mt-0.5', getBalance(selected.id) > 0 ? 'text-red-600' : 'text-green-600')}>
                    {formatCurrency(getBalance(selected.id))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Total Purchases</p>
                  <p className="text-2xl font-black text-gray-800 mt-0.5">{formatCurrency(selected.totalPurchases)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Transactions</p>
                  <p className="text-2xl font-black text-gray-800 mt-0.5">{history.length}</p>
                </div>
              </div>
            </div>

            {/* Transaction history */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Transaction History</h3>
              </div>
              {history.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
                  <p>No transactions yet. Add an entry to get started.</p>
                </div>
              ) : (
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Ref</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((e) => (
                      <tr key={e.id}>
                        <td className="text-xs">{format(new Date(e.date), 'MMM d, yyyy hh:mm aa')}</td>
                        <td>
                          <Badge variant={e.type === 'payment' ? 'green' : 'red'}>
                            {e.type === 'payment' ? '↓ Payment' : '↑ Credit'}
                          </Badge>
                        </td>
                        <td className="text-sm">{e.description}</td>
                        <td><span className="font-mono text-xs text-gray-500">{e.ref || '—'}</span></td>
                        <td className="text-right">
                          <span className={cn('font-bold', e.type === 'payment' ? 'text-green-600' : 'text-red-600')}>
                            {e.type === 'payment' ? '−' : '+'}{formatCurrency(e.amount)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={cn('font-bold text-sm', e.balance > 0 ? 'text-red-600' : 'text-green-600')}>
                            {formatCurrency(e.balance)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {showEntryModal && selected && (
        <EntryModal customer={selected} onClose={() => setShowEntryModal(false)} />
      )}
    </div>
  )
}

