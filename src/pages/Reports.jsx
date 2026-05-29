import React, { useState, useMemo } from 'react'
import {
  TrendingUp, Download, DollarSign, ShoppingCart, Receipt,
  ArrowUpRight, ArrowDownRight, Calendar, Sun, CalendarDays,
  CalendarRange, Search, X, Filter, Package, Zap, CreditCard,
  Banknote, Layers, RotateCcw, Users
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useSalesStore, useAppStore, useProductStore } from '@/store'
import { Badge } from '@/components/ui'
import { formatCurrency, cn } from '@/lib/utils'
import {
  format, subDays, subWeeks, subMonths, subYears,
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  eachHourOfInterval, isSameHour, isSameDay, isSameWeek, isSameMonth
} from 'date-fns'

function getSaleItems(sale) {
  return sale.items_detail || sale.cartItems || []
}

const PERIODS = [
  { id: 'day',   label: 'Today',   icon: Sun },
  { id: 'week',  label: 'Week',    icon: CalendarDays },
  { id: 'month', label: 'Month',   icon: Calendar },
  { id: 'year',  label: 'Year',    icon: CalendarRange },
]

function getPeriodRange(period) {
  const now = new Date()
  switch (period) {
    case 'day':   return { start: startOfDay(now), end: endOfDay(now), prevStart: startOfDay(subDays(now,1)), prevEnd: endOfDay(subDays(now,1)) }
    case 'week':  return { start: startOfWeek(now,{weekStartsOn:1}), end: endOfWeek(now,{weekStartsOn:1}), prevStart: startOfWeek(subWeeks(now,1),{weekStartsOn:1}), prevEnd: endOfWeek(subWeeks(now,1),{weekStartsOn:1}) }
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now), prevStart: startOfMonth(subMonths(now,1)), prevEnd: endOfMonth(subMonths(now,1)) }
    case 'year':  return { start: startOfYear(now), end: endOfYear(now), prevStart: startOfYear(subYears(now,1)), prevEnd: endOfYear(subYears(now,1)) }
    default:      return { start: startOfDay(now), end: endOfDay(now) }
  }
}

function buildChartData(period, sales) {
  const now = new Date()
  switch (period) {
    case 'day': {
      const hours = eachHourOfInterval({ start: startOfDay(now), end: now })
      return hours.map(h => {
        const rev = sales.filter(s => isSameHour(new Date(s.date), h)).reduce((sum,s) => sum + s.total, 0)
        return { name: format(h,'ha'), Revenue: rev, Profit: Math.round(rev*0.25) }
      })
    }
    case 'week': {
      const days = eachDayOfInterval({ start: startOfWeek(now,{weekStartsOn:1}), end: now })
      return days.map(d => {
        const rev = sales.filter(s => isSameDay(new Date(s.date), d)).reduce((sum,s) => sum + s.total, 0)
        return { name: format(d,'EEE'), Revenue: rev, Profit: Math.round(rev*0.25) }
      })
    }
    case 'month': {
      const days = eachDayOfInterval({ start: startOfMonth(now), end: now })
      return days.map(d => {
        const rev = sales.filter(s => isSameDay(new Date(s.date), d)).reduce((sum,s) => sum + s.total, 0)
        return { name: format(d,'d'), Revenue: rev, Profit: Math.round(rev*0.25) }
      })
    }
    case 'year': {
      const months = eachMonthOfInterval({ start: startOfYear(now), end: now })
      return months.map(m => {
        const rev = sales.filter(s => isSameMonth(new Date(s.date), m)).reduce((sum,s) => sum + s.total, 0)
        return { name: format(m,'MMM'), Revenue: rev, Profit: Math.round(rev*0.25) }
      })
    }
    default: return []
  }
}

function periodLabel(period) {
  const now = new Date()
  switch (period) {
    case 'day':   return format(now,'EEEE, MMM d yyyy')
    case 'week':  return `Week of ${format(startOfWeek(now,{weekStartsOn:1}),'MMM d')}`
    case 'month': return format(now,'MMMM yyyy')
    case 'year':  return format(now,'yyyy')
  }
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-2xl px-4 py-3 text-sm min-w-[160px]">
      <p className="font-bold text-gray-500 text-xs mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p,i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-black text-xs text-gray-900">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function TrendBadge({ current, previous }) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const up = pct >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full', up ? 'text-emerald-700 bg-emerald-50' : 'text-red-500 bg-red-50')}>
      {up ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export default function Reports() {
  const [period, setPeriod]           = useState('month')
  const [searchText, setSearchText]   = useState('')
  const [fromDate, setFromDate]       = useState('')
  const [toDate, setToDate]           = useState('')
  const [datePreset, setDatePreset]   = useState('period')
  const [showTxAll, setShowTxAll]     = useState(false)

  const { sales }        = useSalesStore()
  const { activeModule } = useAppStore()
  const { getLowStock }  = useProductStore()

  const periodRange = getPeriodRange(period)
  const now = new Date()

  const presetRange = useMemo(() => {
    if (datePreset === 'last12') return { start: startOfDay(subYears(now,1)), end: endOfDay(now) }
    if (datePreset === 'custom') {
      return {
        start: fromDate ? startOfDay(new Date(fromDate)) : startOfDay(subYears(now,1)),
        end:   toDate   ? endOfDay(new Date(toDate))     : endOfDay(now),
      }
    }
    return { start: periodRange.start, end: periodRange.end }
  }, [datePreset, fromDate, toDate, periodRange.start, periodRange.end])

  const { start, end, prevStart, prevEnd } = datePreset === 'period'
    ? periodRange
    : { start: presetRange.start, end: presetRange.end, prevStart: startOfDay(subYears(presetRange.start,1)), prevEnd: endOfDay(subYears(presetRange.end,1)) }

  const moduleSales = useMemo(() =>
    sales.filter(s => !s.source || s.source === activeModule || (activeModule === 'restaurant' && s.source === 'takeout'))
  , [sales, activeModule])

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return moduleSales.filter(sale => {
      const d = new Date(sale.date)
      if (d < start || d > end) return false
      if (!q) return true
      const searchable = [
        sale.receiptNo, sale.cashier, sale.paymentMethod, sale.source, sale.status,
        format(d,'yyyy-MM-dd'), format(d,'dd/MM/yyyy'), format(d,'MMM d, yyyy'),
        ...(getSaleItems(sale).flatMap(i => [i.name, i.barcode, i.sku])),
      ].filter(Boolean).join(' ').toLowerCase()
      return searchable.includes(q)
    })
  }, [moduleSales, searchText, start, end])

  const prevFiltered = useMemo(() =>
    moduleSales.filter(s => { const d = new Date(s.date); return d >= prevStart && d <= prevEnd })
  , [moduleSales, prevStart, prevEnd])

  // KPIs
  const totalRevenue      = filtered.reduce((s,x) => s + Number(x.total||0), 0)
  const prevRevenue       = prevFiltered.reduce((s,x) => s + Number(x.total||0), 0)
  const grossRevenue      = filtered.filter(s => Number(s.total||0) > 0).reduce((s,x) => s + Number(x.total||0), 0)
  const refundTotal       = Math.abs(filtered.filter(s => Number(s.total||0) < 0).reduce((s,x) => s + Number(x.total||0), 0))
  const refundCount       = filtered.filter(s => Number(s.total||0) < 0 || s.status === 'refund' || s.status === 'refunded').length
  const totalTransactions = filtered.length
  const prevTransactions  = prevFiltered.length
  const avgOrder          = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
  const prevAvgOrder      = prevFiltered.length > 0 ? prevRevenue / prevFiltered.length : 0
  const totalProfit       = totalRevenue * 0.25
  const prevProfit        = prevRevenue  * 0.25

  const chartData = useMemo(() => buildChartData(period, filtered), [period, filtered])

  // Payment breakdown
  const paymentMap = useMemo(() => {
    const map = { cash: 0, card: 0, split: 0 }
    filtered.filter(s => Number(s.total||0) > 0).forEach(s => { map[s.paymentMethod] = (map[s.paymentMethod]||0) + s.total })
    return map
  }, [filtered])

  // Top items
  const topItems = useMemo(() => {
    const map = {}
    filtered.forEach(sale => {
      getSaleItems(sale).forEach(item => {
        if (!map[item.name]) map[item.name] = { name: item.name, qty: 0, revenue: 0 }
        map[item.name].qty     += Number(item.qty||0)
        map[item.name].revenue += Number(item.salePrice||item.price||0) * Number(item.qty||0)
      })
    })
    return Object.values(map).sort((a,b) => b.revenue - a.revenue).slice(0, 5)
  }, [filtered])

  // Recent tx
  const recentTx = useMemo(() => {
    const sorted = filtered.slice().sort((a,b) => new Date(b.date) - new Date(a.date))
    return showTxAll ? sorted : sorted.slice(0, 8)
  }, [filtered, showTxAll])

  const handleExport = () => {
    const rows = [
      ['Invoice','Date','Cashier','Items','Subtotal','Discount','Tax','Total','Payment','Source','Status'],
      ...filtered.map(s => [
        s.receiptNo||'', format(new Date(s.date),'yyyy-MM-dd HH:mm'), s.cashier||'System',
        s.items, s.subtotal??s.total, s.discount||0, s.tax||0, s.total,
        s.paymentMethod, s.source||'grocery', s.status||'completed',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `report-${period}-${format(new Date(),'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const salesRangeLabel = datePreset === 'period'
    ? periodLabel(period)
    : `${format(start,'dd MMM yyyy')} – ${format(end,'dd MMM yyyy')}`

  const paymentItems = [
    { label: 'Cash',  value: paymentMap.cash,  color: '#16a34a', icon: <Banknote size={14}/> },
    { label: 'Card',  value: paymentMap.card,  color: '#3b82f6', icon: <CreditCard size={14}/> },
    { label: 'Split', value: paymentMap.split, color: '#a855f7', icon: <Layers size={14}/> },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7f5]">
      <div className="p-5 space-y-5 max-w-[1600px] mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Analytics</h1>
            <p className="text-sm text-gray-400 mt-0.5">{salesRangeLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period switcher */}
            <div className="flex items-center bg-white border border-gray-200 rounded-2xl p-1 gap-0.5 shadow-sm">
              {PERIODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setPeriod(id); setDatePreset('period') }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200',
                    period === id && datePreset === 'period'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  )}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
            <button onClick={handleExport} className="btn-secondary text-xs">
              <Download size={13}/> Export CSV
            </button>
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Revenue', value: formatCurrency(totalRevenue),
              sub: `vs prev ${period}`, trend: { cur: totalRevenue, prev: prevRevenue },
              icon: <DollarSign size={18}/>, grad: 'from-emerald-400 to-green-600', bg: '#dcfce7', fg: '#16a34a',
            },
            {
              label: 'Est. Profit', value: formatCurrency(totalProfit),
              sub: '~25% margin', trend: { cur: totalProfit, prev: prevProfit },
              icon: <TrendingUp size={18}/>, grad: 'from-blue-400 to-indigo-600', bg: '#dbeafe', fg: '#2563eb',
            },
            {
              label: 'Transactions', value: totalTransactions,
              sub: `vs prev ${period}`, trend: { cur: totalTransactions, prev: prevTransactions },
              icon: <Receipt size={18}/>, grad: 'from-violet-400 to-purple-600', bg: '#ede9fe', fg: '#7c3aed',
            },
            {
              label: 'Avg Order Value', value: formatCurrency(avgOrder),
              sub: 'per transaction', trend: { cur: avgOrder, prev: prevAvgOrder },
              icon: <ShoppingCart size={18}/>, grad: 'from-amber-400 to-orange-500', bg: '#fef3c7', fg: '#d97706',
            },
          ].map(({ label, value, sub, trend, icon, grad, bg, fg }) => (
            <div key={label} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white shadow-sm`}>
                  {icon}
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">{sub}</span>
                <TrendBadge current={trend.cur} previous={trend.prev}/>
              </div>
            </div>
          ))}
        </div>

        {/* ── Quick stats row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><DollarSign size={16}/></div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Gross Sales</p>
              <p className="text-sm font-black text-gray-900">{formatCurrency(grossRevenue)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-500"><RotateCcw size={16}/></div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Refunds ({refundCount})</p>
              <p className="text-sm font-black text-red-600">−{formatCurrency(refundTotal)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Package size={16}/></div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Low Stock Items</p>
              <p className="text-sm font-black text-gray-900">{getLowStock().length}</p>
            </div>
          </div>
        </div>

        {/* ── Chart + Payment ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
          {/* Chart */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-black text-gray-900">Revenue & Profit</h2>
                <p className="text-xs text-gray-400 mt-0.5">{filtered.length} transactions in period</p>
              </div>
              <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                {{ day:'Hourly', week:'Daily', month:'Daily', year:'Monthly' }[period]}
              </span>
            </div>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-gray-300 text-sm flex-col gap-2">
                <TrendingUp size={32} className="text-gray-200"/>
                No data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.15}/>
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{ fontSize:11, paddingTop:12 }}/>
                  <Area type="monotone" dataKey="Revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r:5, fill:'#16a34a' }}/>
                  <Area type="monotone" dataKey="Profit"  stroke="#3b82f6" strokeWidth={2}   fill="url(#profGrad)" dot={false} activeDot={{ r:4, fill:'#3b82f6' }}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment breakdown */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-gray-900 mb-5">Payment Methods</h2>
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-10">No data</p>
            ) : (
              <div className="space-y-5">
                {paymentItems.map(p => {
                  const pct = grossRevenue > 0 ? Math.min(100, (p.value / grossRevenue) * 100) : 0
                  return (
                    <div key={p.label}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${p.color}18`, color: p.color }}>
                            {p.icon}
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{p.label}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-gray-900">{formatCurrency(p.value)}</p>
                          <p className="text-xs text-gray-400">{pct.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}cc, ${p.color})` }}
                        />
                      </div>
                    </div>
                  )
                })}

                {/* Total net */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Net Revenue</span>
                    <span className="text-lg font-black text-gray-900">{formatCurrency(grossRevenue - refundTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Filter + Search ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={14} className="text-gray-400"/>
            <h2 className="font-black text-gray-900 text-sm">Search & Filter Transactions</h2>
            <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg font-semibold border border-gray-100">{filtered.length} results</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-0.5">
              <Search size={14} className="shrink-0 text-gray-400"/>
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Receipt no., cashier, item, payment, date..."
                className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-700 placeholder:text-gray-400 py-2"
              />
              {searchText && (
                <button onClick={() => setSearchText('')} className="text-gray-400 hover:text-gray-600">
                  <X size={13}/>
                </button>
              )}
            </div>

            {/* Date preset */}
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value)}
              className="input-base"
            >
              <option value="period">Selected period</option>
              <option value="last12">Last 12 months</option>
              <option value="custom">Custom range</option>
            </select>

            {/* From */}
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setDatePreset('custom') }}
              disabled={datePreset !== 'custom'}
              className="input-base"
              placeholder="From"
            />

            {/* To */}
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setDatePreset('custom') }}
              disabled={datePreset !== 'custom'}
              className="input-base"
              placeholder="To"
            />
          </div>

          {(searchText || datePreset !== 'period') && (
            <button
              onClick={() => { setSearchText(''); setFromDate(''); setToDate(''); setDatePreset('period') }}
              className="mt-3 text-xs font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              <X size={12}/> Clear all filters
            </button>
          )}
        </div>

        {/* ── Transaction Table ────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-black text-gray-900">Transactions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Most recent sales in the filtered range</p>
            </div>
            <button onClick={handleExport} className="btn-secondary text-xs">
              <Download size={12}/> CSV
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Receipt size={40} className="mb-3"/>
              <p className="text-sm font-semibold text-gray-400">No transactions found</p>
              <p className="text-xs text-gray-300 mt-1">Try a different period or clear your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Invoice', 'Date', 'Cashier', 'Items', 'Payment', 'Total', 'Status'].map(h => (
                        <th key={h} className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentTx.map(s => {
                      const isRefund = s.status === 'refund' || s.status === 'refunded'
                      const isPending = s.status === 'pending'
                      return (
                        <tr key={s.id || s.receiptNo} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="font-mono text-xs font-bold text-gray-700">{String(s.receiptNo||'').trim() || '—'}</span>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-500">
                            <p className="font-semibold text-gray-800">{format(new Date(s.date),'dd MMM yyyy')}</p>
                            <p className="text-gray-400">{format(new Date(s.date),'hh:mm aa')}</p>
                          </td>
                          <td className="px-5 py-3 text-xs font-semibold text-gray-700">{s.cashier || 'System'}</td>
                          <td className="px-5 py-3 text-xs text-gray-500">{s.items || getSaleItems(s).length}</td>
                          <td className="px-5 py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full',
                              s.paymentMethod === 'cash'  ? 'bg-emerald-50 text-emerald-700' :
                              s.paymentMethod === 'card'  ? 'bg-blue-50 text-blue-700' :
                              'bg-purple-50 text-purple-700'
                            )}>
                              {s.paymentMethod === 'cash' ? <Banknote size={11}/> : s.paymentMethod === 'card' ? <CreditCard size={11}/> : <Layers size={11}/>}
                              {String(s.paymentMethod||'cash').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={cn('font-black text-sm', Number(s.total||0) < 0 ? 'text-red-500' : 'text-emerald-700')}>
                              {formatCurrency(s.total||0)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full',
                              isRefund  ? 'bg-red-50 text-red-600'    :
                              isPending ? 'bg-amber-50 text-amber-600' :
                              'bg-emerald-50 text-emerald-700'
                            )}>
                              <span className={cn('w-1.5 h-1.5 rounded-full', isRefund ? 'bg-red-500' : isPending ? 'bg-amber-400' : 'bg-emerald-500')}/>
                              {isRefund ? 'Refunded' : isPending ? 'Pending' : 'Completed'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filtered.length > 8 && (
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Showing {showTxAll ? filtered.length : Math.min(8, filtered.length)} of {filtered.length} transactions
                  </p>
                  <button
                    onClick={() => setShowTxAll(v => !v)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    {showTxAll ? 'Show less ↑' : `Show all ${filtered.length} ↓`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Bottom Row: Top Items + Insights ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top selling items */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-gray-900">Top Selling Items</h2>
              <span className="text-xs text-gray-400">by revenue</span>
            </div>
            {topItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-gray-300">
                <Package size={32} className="mb-2"/>
                <p className="text-sm text-gray-400">No item data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topItems.map((item, i) => {
                  const colors = ['#16a34a','#3b82f6','#a855f7','#f59e0b','#ef4444']
                  const pct = topItems[0].revenue > 0 ? (item.revenue / topItems[0].revenue) * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-black text-white"
                        style={{ background: colors[i] }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                          <span className="text-xs font-black text-gray-900 shrink-0">{formatCurrency(item.revenue)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: colors[i] }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{item.qty} sold</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Insights grid */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-gray-900 mb-5">Quick Insights</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Avg per Transaction',
                  value: formatCurrency(avgOrder),
                  icon: <ShoppingCart size={16}/>, color: '#f59e0b',
                },
                {
                  label: 'Refund Rate',
                  value: totalTransactions > 0 ? `${((refundCount / totalTransactions) * 100).toFixed(1)}%` : '0%',
                  icon: <RotateCcw size={16}/>, color: '#ef4444',
                },
                {
                  label: 'Top Payment',
                  value: (() => {
                    const entries = Object.entries(paymentMap).sort((a,b) => b[1]-a[1])
                    return entries[0] ? entries[0][0].toUpperCase() : '—'
                  })(),
                  icon: <CreditCard size={16}/>, color: '#3b82f6',
                },
                {
                  label: 'Items Sold',
                  value: filtered.reduce((sum,s) => sum + getSaleItems(s).reduce((a,i) => a + Number(i.qty||0), 0), 0),
                  icon: <Package size={16}/>, color: '#a855f7',
                },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18`, color }}>
                    {icon}
                  </div>
                  <p className="text-xl font-black text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Low stock alert */}
            {getLowStock().length > 0 && (
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Zap size={15}/>
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800">{getLowStock().length} items running low</p>
                  <p className="text-xs text-amber-600">Check inventory before next sale cycle</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
