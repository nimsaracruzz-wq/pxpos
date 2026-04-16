import React, { useState, useMemo } from 'react'
import { Users, Plus, Phone, Edit2, Trash2, ShoppingBag, Download, BookOpen } from 'lucide-react'
import { useCustomerStore } from '@/store'
import { useToast } from '@/components/Toast'
import { useNavigate } from 'react-router-dom'
import { Badge, Modal, Input, Select, SectionHeader, SearchInput, EmptyState, StatCard } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'

const CUSTOMER_DEFAULTS = { name: '', phone: '', email: '', type: 'retail' }

function CustomerForm({ initial = CUSTOMER_DEFAULTS, onSave, onCancel }) {
  const [form, setForm] = useState({ ...CUSTOMER_DEFAULTS, ...initial })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="flex flex-col gap-4">
      <Input label="Full Name *" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Kasun Perera" />
      <Input label="Phone *" value={form.phone} onChange={(e) => set('phone', e.target.value)} required placeholder="07X XXX XXXX" />
      <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="optional" />
      <Select label="Customer Type" value={form.type} onChange={(e) => set('type', e.target.value)}>
        <option value="retail">Retail</option>
        <option value="wholesale">Wholesale</option>
        <option value="vip">VIP</option>
      </Select>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">
          {initial.id ? 'Save Changes' : 'Add Customer'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomerStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const totalRevenue = useMemo(() => customers.reduce((s, c) => s + c.totalPurchases, 0), [customers])
  const totalCredit = useMemo(() => customers.reduce((s, c) => s + c.credit, 0), [customers])
  const wholesaleCount = useMemo(() => customers.filter((c) => c.type === 'wholesale').length, [customers])

  const filtered = useMemo(() =>
    customers.filter((c) => {
      const matchS = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
      const matchT = typeFilter === 'all' || c.type === typeFilter
      return matchS && matchT
    }),
    [customers, search, typeFilter]
  )

  const handleSave = (form) => {
    if (editCustomer) {
      updateCustomer(editCustomer.id, form)
      toast.success(`${form.name} updated`)
    } else {
      addCustomer(form)
      toast.success(`${form.name} added as a customer`)
    }
    setShowModal(false)
    setEditCustomer(null)
  }

  const exportCSV = () => {
    const rows = [['Name', 'Phone', 'Email', 'Type', 'Total Purchases', 'Credit']]
    customers.forEach((c) => rows.push([c.name, c.phone, c.email, c.type, c.totalPurchases, c.credit]))
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })),
      download: 'customers.csv',
    })
    a.click()
    toast.success('Customers exported to CSV')
  }

  const typeVariant = { retail: 'blue', wholesale: 'yellow', vip: 'green' }
  const typeEmoji = { retail: '🛒', wholesale: '🏭', vip: '⭐' }

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: `#f4f7f5` }}>
      <SectionHeader
        title="Customers"
        subtitle={`${customers.length} customers registered`}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={exportCSV}><Download size={14} /> Export</button>
            <button className="btn-primary" onClick={() => { setEditCustomer(null); setShowModal(true) }}>
              <Plus size={15} /> Add Customer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Customers" value={customers.length} icon={<Users size={18} />} color="#16a34a" />
        <StatCard title="Wholesale Accounts" value={wholesaleCount} icon={<ShoppingBag size={18} />} color="#7c3aed" />
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={<ShoppingBag size={18} />} color="#2563eb" />
        <StatCard
          title="Outstanding Credit"
          value={formatCurrency(totalCredit)}
          subtitle={totalCredit > 0 ? 'Click Ledger to manage' : 'All clear'}
          icon={<BookOpen size={18} />}
          color={totalCredit > 0 ? '#dc2626' : '#16a34a'}
        />
      </div>

      <div className="flex gap-3 mb-5">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, or email..." className="flex-1" />
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'retail', label: '🛒 Retail' },
            { id: 'wholesale', label: '🏭 Wholesale' },
            { id: 'vip', label: '⭐ VIP' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTypeFilter(id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${typeFilter === id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title="No customers found"
            description="Add your first customer to get started"
            action={<button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Customer</button>}
          />
        ) : (
          <table className="table-modern">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Total Purchases</th>
                <th>Credit Balance</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}
                      >
                        {c.name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                        {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Phone size={12} className="text-gray-400" />
                      {c.phone}
                    </div>
                  </td>
                  <td>
                    <Badge variant={typeVariant[c.type] || 'gray'}>
                      {typeEmoji[c.type]} {c.type}
                    </Badge>
                  </td>
                  <td><span className="font-bold text-green-700">{formatCurrency(c.totalPurchases)}</span></td>
                  <td>
                    {c.credit > 0 ? (
                      <button
                        onClick={() => navigate('/ledger')}
                        className="inline-flex items-center gap-1"
                      >
                        <Badge variant="red">{formatCurrency(c.credit)}</Badge>
                        <span className="text-xs text-gray-400 hover:text-green-600">View →</span>
                      </button>
                    ) : (
                      <Badge variant="green">Clear</Badge>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {c.type === 'wholesale' && (
                        <button
                          onClick={() => navigate('/ledger')}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                          title="View Ledger"
                        >
                          <BookOpen size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => { setEditCustomer(c); setShowModal(true) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditCustomer(null) }} title={editCustomer ? 'Edit Customer' : 'Add New Customer'} maxWidth="max-w-md">
        <CustomerForm initial={editCustomer || CUSTOMER_DEFAULTS} onSave={handleSave} onCancel={() => { setShowModal(false); setEditCustomer(null) }} />
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Customer" maxWidth="max-w-sm">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <p className="text-gray-700 font-semibold mb-1">Delete "{confirmDelete?.name}"?</p>
          <p className="text-sm text-gray-500 mb-6">All purchase history will be removed.</p>
          <div className="flex gap-3">
            <button
              className="btn-danger flex-1 justify-center"
              onClick={() => {
                deleteCustomer(confirmDelete.id)
                toast.success(`"${confirmDelete.name}" removed`)
                setConfirmDelete(null)
              }}
            >
              Delete
            </button>
            <button className="btn-ghost flex-1 justify-center" onClick={() => setConfirmDelete(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

