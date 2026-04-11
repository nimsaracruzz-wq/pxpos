import React, { useState, useMemo } from 'react'
import {
  BarChart2, TrendingUp, Download, Calendar,
  ShoppingCart, DollarSign, Receipt
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useSalesStore, useAppStore } from '@/store'
import { StatCard, Badge, SectionHeader } from '@/components/ui'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { format, subDays, startOfDay } from 'date-fns'

const RANGES = [
  { id: '7', label: '7 Days' },
  { id: '30', label: '30 Days' },
  { id: '90', label: '90 Days' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-sm min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Reports() {
  const [range, setRange] = useState('30')
  const { sales } = useSalesStore()
  const { activeModule } = useAppStore()

  const days = parseInt(range)
  const cutoff = subDays(new Date(), days)

  // Filter chronologically AND by active business module
  const filtered = useMemo(() => sales.filter((s) => {
    const withinDate = new Date(s.date) >= cutoff
    const matchModule = !s.source 
      || s.source === activeModule 
      || (activeModule === 'restaurant' && s.source === 'takeout')

    return withinDate && matchModule
  }), [sales, range, activeModule])

  const totalRevenue = filtered.reduce((s, x) => s + x.total, 0)
  const totalProfit = filtered.reduce((s, x) => s + (x.total - (x.tax || 0) - (x.discount || 0)) * 0.25, 0)
  const totalTransactions = filtered.length
  const avgOrder = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  // Daily aggregation for chart
  const chartData = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - 1 - i)
      const daySales = filtered.filter((s) => new Date(s.date).toDateString() === date.toDateString())
      const revenue = daySales.reduce((s, x) => s + x.total, 0)
      const profit = revenue * 0.25
      return {
        name: format(date, days <= 7 ? 'EEE' : 'MMM d'),
        Revenue: revenue,
        Profit: Math.round(profit),
      }
    })
  }, [filtered, days])

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const map = { cash: 0, card: 0, split: 0 }
    filtered.forEach((s) => { map[s.paymentMethod] = (map[s.paymentMethod] || 0) + s.total })
    return [
      { name: 'Cash', value: map.cash, color: '#22c55e' },
      { name: 'Card', value: map.card, color: '#3b82f6' },
      { name: 'Split', value: map.split, color: '#a855f7' },
    ]
  }, [filtered])

  const handleExport = () => {
    const rows = [
      ['Date', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment'],
      ...filtered.map((s) => [
        format(new Date(s.date), 'yyyy-MM-dd HH:mm'),
        s.items,
        s.subtotal,
        s.discount || 0,
        s.tax || 0,
        s.total,
        s.paymentMethod,
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paxxmo-report-${range}days.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHeader
        title="Reports"
        subtitle="Sales analytics and financial overview"
        action={
          <div className="flex gap-2 items-center">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  range === r.id
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
            <button onClick={handleExport} className="btn-secondary">
              <Download size={14} />
              Export CSV
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title={`${activeModule?.toUpperCase() || ''} Revenue`} value={formatCurrency(totalRevenue)} icon={<DollarSign size={18} />} color="#16a34a" />
        <StatCard title="Est. Profit" value={formatCurrency(totalProfit)} subtitle="~25% margin" icon={<TrendingUp size={18} />} color="#2563eb" />
        <StatCard title="Transactions" value={totalTransactions} icon={<Receipt size={18} />} color="#7c3aed" />
        <StatCard title="Avg. Order" value={formatCurrency(avgOrder)} icon={<ShoppingCart size={18} />} color="#d97706" />
      </div>

      {/* Revenue + Profit chart */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-sm">Revenue vs Profit</h3>
          <Badge variant="green">Last {range} Days</Badge>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Profit" fill="#86efac" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Payment breakdown */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Payment Methods</h3>
          <div className="flex flex-col gap-3">
            {paymentBreakdown.map((p) => {
              const pct = totalRevenue > 0 ? (p.value / totalRevenue) * 100 : 0
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{p.name}</span>
                    <span className="font-bold text-gray-800">{formatCurrency(p.value)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: p.color }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}%</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent transactions table */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Transaction History</h3>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 10).map((s, i) => (
                  <tr key={i}>
                    <td className="text-xs">{format(new Date(s.date), 'MMM d, hh:mm aa')}</td>
                    <td className="text-sm">{s.items}</td>
                    <td>
                      <Badge variant={s.paymentMethod === 'cash' ? 'green' : s.paymentMethod === 'card' ? 'blue' : 'gray'}>
                        {s.paymentMethod}
                      </Badge>
                    </td>
                    <td><span className="font-bold text-green-700">{formatCurrency(s.total)}</span></td>
                    <td><Badge variant="green">Completed</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
