import React, { useState, useMemo, useCallback } from 'react'
import {
  Receipt, Search, X, Download, ChevronDown, ChevronUp,
  Calendar, Filter, RefreshCw, ArrowUpDown, Eye,
  CreditCard, Banknote, Layers, ArrowLeft, CheckCircle2, AlertTriangle, Clock
} from 'lucide-react'
import { useSalesStore, useAppStore } from '@/store'
import { formatCurrency, cn } from '@/lib/utils'
import { format, startOfDay, endOfDay, subDays, subWeeks, subMonths, isWithinInterval } from 'date-fns'

// ─── Helper ──────────────────────────────────────────────────────────────────
function getSaleItems(sale) {
  return sale.items_detail || sale.cartItems || []
}

function statusMeta(sale) {
  const s = sale.status || 'completed'
  if (s === 'refund' || s === 'refunded') return { label: 'Refunded', color: 'text-red-600 bg-red-50', dot: 'bg-red-500' }
  if (s === 'partially refunded') return { label: 'Partial Refund', color: 'text-orange-600 bg-orange-50', dot: 'bg-orange-400' }
  if (s === 'pending') return { label: 'Pending', color: 'text-amber-600 bg-amber-50', dot: 'bg-amber-400' }
  return { label: 'Completed', color: 'text-green-700 bg-green-50', dot: 'bg-green-500' }
}

function paymentIcon(method) {
  const m = String(method || '').toLowerCase()
  if (m === 'card') return <CreditCard size={13} />
  if (m === 'split') return <Layers size={13} />
  return <Banknote size={13} />
}

const DATE_PRESETS = [
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'Last 7 days' },
  { id: 'month',   label: 'Last 30 days' },
  { id: 'custom',  label: 'Custom range' },
  { id: 'all',     label: 'All time' },
]

function getPresetRange(preset) {
  const now = new Date()
  switch (preset) {
    case 'today':  return { start: startOfDay(now), end: endOfDay(now) }
    case 'week':   return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) }
    case 'month':  return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) }
    default:       return null // all / custom = no range filter
  }
}

const PAGE_SIZE = 25

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function SaleDetailModal({ sale, onClose }) {
  if (!sale) return null
  const items = getSaleItems(sale)
  const { label, color } = statusMeta(sale)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in" style={{ animationDuration: '150ms' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Invoice</p>
            <h2 className="text-lg font-black text-gray-900 font-mono">{sale.receiptNo || 'N/A'}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn('text-xs font-bold px-3 py-1 rounded-full', color)}>{label}</span>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Date & Time', value: format(new Date(sale.date), 'dd MMM yyyy, hh:mm a') },
              { label: 'Cashier', value: sale.cashier || 'System' },
              { label: 'Payment', value: String(sale.paymentMethod || '—').toUpperCase() },
              { label: 'Source', value: String(sale.source || 'POS').toUpperCase() },
              sale.customerName && { label: 'Customer', value: sale.customerName },
              sale.tableNumber && { label: 'Table', value: `#${sale.tableNumber}` },
              sale.refundReason && { label: 'Refund reason', value: sale.refundReason },
              sale.originalReceiptNo && { label: 'Original Invoice', value: sale.originalReceiptNo },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 break-all">{value}</p>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-3">Line Items ({items.length})</p>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No item details stored</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.name || 'Item'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Qty: {item.qty || item.quantity || 1}
                        {item.barcode ? ` · ${item.barcode}` : ''}
                        {item.serial ? ` · S/N: ${item.serial}` : ''}
                        {item.imei ? ` · IMEI: ${item.imei}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency((item.salePrice || item.price || 0) * (item.qty || item.quantity || 1))}
                      </p>
                      <p className="text-xs text-gray-400">{formatCurrency(item.salePrice || item.price || 0)} ea.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="rounded-2xl border border-gray-200 p-4 space-y-2 text-sm">
            {[
              { label: 'Subtotal', value: sale.subtotal ?? sale.total },
              sale.discount && { label: 'Discount', value: -Math.abs(sale.discount) },
              sale.tax && { label: 'Tax', value: sale.tax },
              sale.serviceCharge && { label: 'Service charge', value: sale.serviceCharge },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} className="flex justify-between text-gray-600">
                <span>{label}</span>
                <span>{formatCurrency(value || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between font-black text-gray-900 pt-2 border-t border-gray-100 text-base">
              <span>Total</span>
              <span className={Number(sale.total || 0) < 0 ? 'text-red-600' : 'text-green-700'}>
                {formatCurrency(sale.total || 0)}
              </span>
            </div>
            {sale.change != null && Number(sale.change) > 0 && (
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Change given</span>
                <span>{formatCurrency(sale.change)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SaleHistory() {
  const sales = useSalesStore((s) => s.sales)
  const { activeModule } = useAppStore()

  // Filters
  const [query, setQuery] = useState('')
  const [preset, setPreset] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | completed | refunded | pending
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [selectedSale, setSelectedSale] = useState(null)

  // Reset page when filters change
  const resetPage = useCallback(() => setPage(1), [])

  const handlePreset = (p) => { setPreset(p); resetPage() }
  const handleQuery = (v) => { setQuery(v); resetPage() }
  const handleStatusFilter = (v) => { setStatusFilter(v); resetPage() }
  const handlePaymentFilter = (v) => { setPaymentFilter(v); resetPage() }

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    resetPage()
  }

  // Date range
  const dateRange = useMemo(() => {
    if (preset === 'custom') {
      const start = fromDate ? startOfDay(new Date(fromDate)) : null
      const end = toDate ? endOfDay(new Date(toDate)) : null
      return { start, end }
    }
    if (preset === 'all') return null
    return getPresetRange(preset)
  }, [preset, fromDate, toDate])

  // Filtered & sorted sales
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return sales
      .filter(sale => {
        // Date range
        if (dateRange) {
          const d = new Date(sale.date)
          if (dateRange.start && d < dateRange.start) return false
          if (dateRange.end && d > dateRange.end) return false
        }

        // Status
        if (statusFilter !== 'all') {
          const s = sale.status || 'completed'
          if (statusFilter === 'completed' && s !== 'completed') return false
          if (statusFilter === 'refunded' && s !== 'refund' && s !== 'refunded' && s !== 'partially refunded') return false
          if (statusFilter === 'pending' && s !== 'pending') return false
        }

        // Payment
        if (paymentFilter !== 'all' && sale.paymentMethod !== paymentFilter) return false

        // Text search
        if (q) {
          const items = getSaleItems(sale)
          const searchable = [
            sale.receiptNo,
            sale.originalReceiptNo,
            sale.cashier,
            sale.paymentMethod,
            sale.source,
            sale.status,
            sale.customerName,
            sale.tableNumber && `table ${sale.tableNumber}`,
            sale.refundReason,
            sale.date && format(new Date(sale.date), 'yyyy-MM-dd'),
            sale.date && format(new Date(sale.date), 'dd/MM/yyyy'),
            sale.date && format(new Date(sale.date), 'MMM d yyyy'),
            ...items.flatMap(i => [i.name, i.barcode, i.sku, i.serial, i.imei]),
          ].filter(Boolean).join(' ').toLowerCase()
          if (!searchable.includes(q)) return false
        }

        return true
      })
      .sort((a, b) => {
        let av, bv
        switch (sortField) {
          case 'date':    av = new Date(a.date); bv = new Date(b.date); break
          case 'total':   av = Number(a.total || 0); bv = Number(b.total || 0); break
          case 'receipt': av = String(a.receiptNo || ''); bv = String(b.receiptNo || ''); break
          case 'cashier': av = String(a.cashier || ''); bv = String(b.cashier || ''); break
          default:        av = new Date(a.date); bv = new Date(b.date)
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
  }, [sales, query, dateRange, statusFilter, paymentFilter, sortField, sortDir])

  // KPIs from filtered
  const kpis = useMemo(() => {
    const completed = filtered.filter(s => Number(s.total || 0) > 0 && s.status !== 'refund' && s.status !== 'refunded')
    const revenue = completed.reduce((sum, s) => sum + Number(s.total || 0), 0)
    const refunds = filtered.filter(s => s.status === 'refund' || s.status === 'refunded')
    const refundTotal = refunds.reduce((sum, s) => sum + Math.abs(Number(s.total || 0)), 0)
    return { total: filtered.length, revenue, refunds: refunds.length, refundTotal, avg: completed.length ? revenue / completed.length : 0 }
  }, [filtered])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  // Export CSV
  const handleExport = () => {
    const rows = [
      ['Invoice', 'Date', 'Cashier', 'Customer', 'Payment', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status', 'Source'],
      ...filtered.map(s => [
        s.receiptNo || '',
        format(new Date(s.date), 'yyyy-MM-dd HH:mm'),
        s.cashier || '',
        s.customerName || '',
        s.paymentMethod || '',
        getSaleItems(s).length,
        s.subtotal ?? s.total,
        s.discount || 0,
        s.tax || 0,
        s.total || 0,
        s.status || 'completed',
        s.source || 'grocery',
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetAll = () => {
    setQuery(''); setPreset('month'); setFromDate(''); setToDate('')
    setStatusFilter('all'); setPaymentFilter('all'); setPage(1)
  }

  const SortIcon = ({ field }) => (
    sortField === field
      ? sortDir === 'asc' ? <ChevronUp size={12} className="text-green-600" /> : <ChevronDown size={12} className="text-green-600" />
      : <ArrowUpDown size={12} className="text-gray-300" />
  )

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Sale History</h1>
            <p className="text-xs text-gray-400 mt-0.5">{filtered.length} records found</p>
          </div>
        </div>
        <button onClick={handleExport} className="btn-secondary text-xs self-start sm:self-auto">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales', value: kpis.total, unit: 'txns', color: '#6366f1' },
          { label: 'Revenue', value: formatCurrency(kpis.revenue), unit: null, color: '#16a34a' },
          { label: 'Avg Order', value: formatCurrency(kpis.avg), unit: null, color: '#d97706' },
          { label: 'Refunds', value: kpis.refunds, unit: `(${formatCurrency(kpis.refundTotal)})`, color: '#ef4444' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="stat-card">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
            {unit && <p className="text-xs text-gray-400 mt-0.5">{unit}</p>}
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card p-4 space-y-4">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-0.5">
          <Search size={15} className="shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={e => handleQuery(e.target.value)}
            placeholder="Search by invoice no., cashier, item name, payment, customer, date..."
            className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-700 placeholder:text-gray-400 py-2"
            autoFocus
          />
          {query && (
            <button onClick={() => handleQuery('')} className="shrink-0 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date preset */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date range</label>
            <select
              value={preset}
              onChange={e => handlePreset(e.target.value)}
              className="input-base mt-1.5 w-full"
            >
              {DATE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {/* Custom from/to */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); handlePreset('custom'); resetPage() }}
              className="input-base mt-1.5 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); handlePreset('custom'); resetPage() }}
              className="input-base mt-1.5 w-full"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={e => handleStatusFilter(e.target.value)}
              className="input-base mt-1.5 w-full"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Payment filter + reset */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment:</span>
          {[
            { id: 'all', label: 'All' },
            { id: 'cash', label: 'Cash' },
            { id: 'card', label: 'Card' },
            { id: 'split', label: 'Split' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handlePaymentFilter(p.id)}
              className={cn(
                'text-xs font-semibold px-3 py-1 rounded-full border transition-all',
                paymentFilter === p.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              )}
            >
              {p.label}
            </button>
          ))}
          <button onClick={resetAll} className="ml-auto btn-ghost text-xs">
            <RefreshCw size={12} /> Reset filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
            <Receipt size={40} className="text-gray-200 mb-3" />
            <p className="font-semibold text-sm">No sales found</p>
            <p className="text-xs mt-1">Try adjusting your filters or date range</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>
                      <button onClick={() => toggleSort('receipt')} className="flex items-center gap-1 hover:text-gray-800">
                        Invoice <SortIcon field="receipt" />
                      </button>
                    </th>
                    <th>
                      <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-gray-800">
                        Date & Time <SortIcon field="date" />
                      </button>
                    </th>
                    <th>
                      <button onClick={() => toggleSort('cashier')} className="flex items-center gap-1 hover:text-gray-800">
                        Cashier <SortIcon field="cashier" />
                      </button>
                    </th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>
                      <button onClick={() => toggleSort('total')} className="flex items-center gap-1 hover:text-gray-800">
                        Total <SortIcon field="total" />
                      </button>
                    </th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paged.map(sale => {
                    const { label, color, dot } = statusMeta(sale)
                    const items = getSaleItems(sale)
                    return (
                      <tr
                        key={sale.id || sale.receiptNo}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <td>
                          <span className="font-mono text-xs font-bold text-indigo-700">
                            {sale.receiptNo || '—'}
                          </span>
                          {sale.originalReceiptNo && (
                            <p className="text-[10px] text-gray-400">Ref: {sale.originalReceiptNo}</p>
                          )}
                        </td>
                        <td>
                          <p className="text-xs font-semibold text-gray-800">{format(new Date(sale.date), 'dd MMM yyyy')}</p>
                          <p className="text-[10px] text-gray-400">{format(new Date(sale.date), 'hh:mm a')}</p>
                        </td>
                        <td className="text-xs font-semibold text-gray-700">{sale.cashier || 'System'}</td>
                        <td className="text-xs text-gray-600">
                          {items.length > 0 ? (
                            <span title={items.map(i => i.name).join(', ')}>
                              {items.length} item{items.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                            {paymentIcon(sale.paymentMethod)}
                            {String(sale.paymentMethod || 'cash').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className={cn('font-black text-sm', Number(sale.total || 0) < 0 ? 'text-red-600' : 'text-green-700')}>
                            {formatCurrency(sale.total || 0)}
                          </span>
                        </td>
                        <td>
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full', color)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
                            {label}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedSale(sale) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50">
                <p className="text-xs text-gray-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                    const p = start + i
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'w-8 h-8 rounded-lg text-xs font-bold transition-all',
                          p === page ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSale && <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
    </div>
  )
}
