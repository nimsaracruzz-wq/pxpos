import React, { useState, useMemo } from 'react'
import {
  TrendingUp, Download, DollarSign,
  ShoppingCart, Receipt, ArrowUpRight, ArrowDownRight,
  Calendar, Sun, CalendarDays, CalendarRange,
  Search, Filter, X
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useSalesStore, useAppStore } from '@/store'
import { useProductStore } from '@/store'
import { StatCard, Badge, SectionHeader } from '@/components/ui'
import { formatCurrency, cn } from '@/lib/utils'
import {
  format, subDays, subWeeks, subMonths, subYears,
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  eachHourOfInterval, addHours, isSameHour, isSameDay,
  isSameWeek, isSameMonth
} from 'date-fns'

function getSaleItems(sale) {
  return sale.items_detail || sale.cartItems || []
}

// ─── Period Config ──────────────────────────────────────────────────────────
const PERIODS = [
  { id: 'day',   label: 'Day',   icon: Sun },
  { id: 'week',  label: 'Week',  icon: CalendarDays },
  { id: 'month', label: 'Month', icon: Calendar },
  { id: 'year',  label: 'Year',  icon: CalendarRange },
]

function getPeriodRange(period) {
  const now = new Date()
  switch (period) {
    case 'day':
      return { start: startOfDay(now), end: endOfDay(now), prevStart: startOfDay(subDays(now, 1)), prevEnd: endOfDay(subDays(now, 1)) }
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), prevStart: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), prevEnd: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) }
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now), prevStart: startOfMonth(subMonths(now, 1)), prevEnd: endOfMonth(subMonths(now, 1)) }
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now), prevStart: startOfYear(subYears(now, 1)), prevEnd: endOfYear(subYears(now, 1)) }
    default:
      return { start: startOfDay(now), end: endOfDay(now) }
  }
}

function buildChartData(period, sales) {
  const now = new Date()
  switch (period) {
    case 'day': {
      // Hourly — 0h to current hour
      const hours = eachHourOfInterval({ start: startOfDay(now), end: now })
      return hours.map(h => {
        const rev = sales
          .filter(s => isSameHour(new Date(s.date), h))
          .reduce((sum, s) => sum + s.total, 0)
        return { name: format(h, 'ha'), Revenue: rev, Profit: Math.round(rev * 0.25) }
      })
    }
    case 'week': {
      // Daily — Mon to Sun
      const days = eachDayOfInterval({ start: startOfWeek(now, { weekStartsOn: 1 }), end: now })
      return days.map(d => {
        const rev = sales
          .filter(s => isSameDay(new Date(s.date), d))
          .reduce((sum, s) => sum + s.total, 0)
        return { name: format(d, 'EEE'), Revenue: rev, Profit: Math.round(rev * 0.25) }
      })
    }
    case 'month': {
      // Daily — 1st to today
      const days = eachDayOfInterval({ start: startOfMonth(now), end: now })
      return days.map(d => {
        const rev = sales
          .filter(s => isSameDay(new Date(s.date), d))
          .reduce((sum, s) => sum + s.total, 0)
        return { name: format(d, 'd'), Revenue: rev, Profit: Math.round(rev * 0.25) }
      })
    }
    case 'year': {
      // Monthly — Jan to current month
      const months = eachMonthOfInterval({ start: startOfYear(now), end: now })
      return months.map(m => {
        const rev = sales
          .filter(s => isSameMonth(new Date(s.date), m))
          .reduce((sum, s) => sum + s.total, 0)
        return { name: format(m, 'MMM'), Revenue: rev, Profit: Math.round(rev * 0.25) }
      })
    }
    default: return []
  }
}

function buildDetailedRows(period, sales) {
  const now = new Date()
  const range = []

  switch (period) {
    case 'day':
      range.push(...eachHourOfInterval({ start: startOfDay(now), end: now }))
      return range.map((bucket) => {
        const bucketSales = sales.filter((s) => isSameHour(new Date(s.date), bucket))
        const revenue = bucketSales.reduce((sum, s) => sum + Number(s.total || 0), 0)
        const items = bucketSales.reduce((sum, s) => sum + getSaleItems(s).reduce((iSum, i) => iSum + Number(i.qty || 0), 0), 0)
        return {
          label: format(bucket, 'ha'),
          revenue,
          txCount: bucketSales.length,
          items,
          avgTicket: bucketSales.length ? revenue / bucketSales.length : 0,
        }
      })
    case 'week':
      range.push(...eachDayOfInterval({ start: startOfWeek(now, { weekStartsOn: 1 }), end: now }))
      return range.map((bucket) => {
        const bucketSales = sales.filter((s) => isSameDay(new Date(s.date), bucket))
        const revenue = bucketSales.reduce((sum, s) => sum + Number(s.total || 0), 0)
        const items = bucketSales.reduce((sum, s) => sum + getSaleItems(s).reduce((iSum, i) => iSum + Number(i.qty || 0), 0), 0)
        return {
          label: format(bucket, 'EEE'),
          revenue,
          txCount: bucketSales.length,
          items,
          avgTicket: bucketSales.length ? revenue / bucketSales.length : 0,
        }
      })
    case 'month':
      range.push(...eachDayOfInterval({ start: startOfMonth(now), end: now }))
      return range.map((bucket) => {
        const bucketSales = sales.filter((s) => isSameDay(new Date(s.date), bucket))
        const revenue = bucketSales.reduce((sum, s) => sum + Number(s.total || 0), 0)
        const items = bucketSales.reduce((sum, s) => sum + getSaleItems(s).reduce((iSum, i) => iSum + Number(i.qty || 0), 0), 0)
        return {
          label: format(bucket, 'd MMM'),
          revenue,
          txCount: bucketSales.length,
          items,
          avgTicket: bucketSales.length ? revenue / bucketSales.length : 0,
        }
      })
    case 'year':
      range.push(...eachMonthOfInterval({ start: startOfYear(now), end: now }))
      return range.map((bucket) => {
        const bucketSales = sales.filter((s) => isSameMonth(new Date(s.date), bucket))
        const revenue = bucketSales.reduce((sum, s) => sum + Number(s.total || 0), 0)
        const items = bucketSales.reduce((sum, s) => sum + getSaleItems(s).reduce((iSum, i) => iSum + Number(i.qty || 0), 0), 0)
        return {
          label: format(bucket, 'MMM'),
          revenue,
          txCount: bucketSales.length,
          items,
          avgTicket: bucketSales.length ? revenue / bucketSales.length : 0,
        }
      })
    default:
      return []
  }
}

// ─── Tooltip ────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-sm min-w-[150px] shadow-lg">
      <p className="font-semibold text-gray-600 mb-1.5 text-xs">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold text-xs" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Trend Badge ─────────────────────────────────────────────────────────────
function TrendBadge({ current, previous }) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const up = pct >= 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full',
      up ? 'text-green-700 bg-green-50' : 'text-red-500 bg-red-50'
    )}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── Period Label ────────────────────────────────────────────────────────────
function periodLabel(period) {
  const now = new Date()
  switch (period) {
    case 'day':   return format(now, 'EEEE, MMM d yyyy')
    case 'week':  return `Week of ${format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')}`
    case 'month': return format(now, 'MMMM yyyy')
    case 'year':  return format(now, 'yyyy')
  }
}

export default function Reports() {
  const [period, setPeriod] = useState('month')
  const [searchText, setSearchText] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [datePreset, setDatePreset] = useState('period') // period | last12 | custom
  const { sales } = useSalesStore()
  const { activeModule } = useAppStore()
  const { getLowStock } = useProductStore()

  const periodRange = getPeriodRange(period)
  const now = new Date()
  const presetRange = useMemo(() => {
    if (datePreset === 'last12') {
      return { start: startOfDay(subYears(now, 1)), end: endOfDay(now) }
    }
    if (datePreset === 'custom') {
      const start = fromDate ? startOfDay(new Date(fromDate)) : startOfDay(subYears(now, 1))
      const end = toDate ? endOfDay(new Date(toDate)) : endOfDay(now)
      return { start, end }
    }
    return { start: periodRange.start, end: periodRange.end }
  }, [datePreset, fromDate, toDate, periodRange.start, periodRange.end])

  const { start, end, prevStart, prevEnd } = datePreset === 'period'
    ? periodRange
    : {
        start: presetRange.start,
        end: presetRange.end,
        prevStart: startOfDay(subYears(presetRange.start, 1)),
        prevEnd: endOfDay(subYears(presetRange.end, 1)),
      }

  const moduleSales = useMemo(() => sales.filter(s =>
    !s.source || s.source === activeModule || (activeModule === 'restaurant' && s.source === 'takeout')
  ), [sales, activeModule])

  const searchedSales = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return moduleSales.filter((sale) => {
      const saleDate = new Date(sale.date)
      const inRange = saleDate >= start && saleDate <= end
      if (!inRange) return false

      if (!q) return true

      const searchable = [
        sale.receiptNo,
        sale.cashier,
        sale.paymentMethod,
        sale.source,
        sale.status,
        format(saleDate, 'yyyy-MM-dd'),
        format(saleDate, 'dd/MM/yyyy'),
        format(saleDate, 'MMM d, yyyy'),
        ...(getSaleItems(sale).map((item) => item.name)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(q)
    })
  }, [moduleSales, searchText, start, end])

  const filtered = useMemo(() =>
    searchedSales
  , [searchedSales])

  const prevFiltered = useMemo(() =>
    moduleSales.filter(s => { const d = new Date(s.date); return d >= prevStart && d <= prevEnd })
  , [moduleSales, prevStart, prevEnd])

  const visibleStart = datePreset === 'period' ? start : presetRange.start
  const visibleEnd = datePreset === 'period' ? end : presetRange.end

  // KPIs
  const totalRevenue     = filtered.reduce((s, x) => s + x.total, 0)
  const prevRevenue      = prevFiltered.reduce((s, x) => s + x.total, 0)
  const totalProfit      = totalRevenue * 0.25
  const prevProfit       = prevRevenue * 0.25
  const totalTransactions = filtered.length
  const prevTransactions  = prevFiltered.length
  const avgOrder         = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
  const prevAvgOrder     = prevTransactions > 0 ? prevRevenue / prevTransactions : 0
  const grossRevenue     = filtered.filter((s) => Number(s.total || 0) > 0).reduce((s, x) => s + Number(x.total || 0), 0)
  const refundTotal      = Math.abs(filtered.filter((s) => Number(s.total || 0) < 0).reduce((s, x) => s + Number(x.total || 0), 0))
  const refundCount      = filtered.filter((s) => Number(s.total || 0) < 0 || s.status === 'refund' || s.status === 'refunded').length
  const completedSales   = filtered.filter((s) => Number(s.total || 0) >= 0)

  // Chart
  const chartData = useMemo(() => buildChartData(period, filtered), [period, filtered])
  const detailedRows = useMemo(() => buildDetailedRows(period, filtered), [period, filtered])

  const intelligence = useMemo(() => {
    const bestBucket = detailedRows.reduce((best, row) => (row.revenue > (best?.revenue || 0) ? row : best), detailedRows[0] || null)
    const worstBucket = detailedRows.reduce((worst, row) => (worst == null || row.revenue < worst.revenue ? row : worst), detailedRows[0] || null)
    const paymentTotals = filtered.reduce((acc, sale) => {
      const key = sale.paymentMethod || 'cash'
      acc[key] = (acc[key] || 0) + Number(sale.total || 0)
      return acc
    }, {})
    const paymentLeader = Object.entries(paymentTotals).sort((a, b) => b[1] - a[1])[0]
    const sourceTotals = filtered.reduce((acc, sale) => {
      const key = sale.source || 'grocery'
      acc[key] = (acc[key] || 0) + Number(sale.total || 0)
      return acc
    }, {})
    const sourceLeader = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1])[0]
    const topItemsMap = {}
    filtered.forEach((sale) => {
      getSaleItems(sale).forEach((item) => {
        if (!topItemsMap[item.name]) topItemsMap[item.name] = { name: item.name, qty: 0, revenue: 0 }
        topItemsMap[item.name].qty += Number(item.qty || 0)
        topItemsMap[item.name].revenue += Number(item.salePrice || item.price || 0) * Number(item.qty || 0)
      })
    })
    const topItemsList = Object.values(topItemsMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    const lowStockCount = getLowStock().length
    return { bestBucket, worstBucket, paymentLeader, sourceLeader, topItemsList, lowStockCount }
  }, [filtered, detailedRows, getLowStock])

  // Payment breakdown
  const paymentBreakdown = useMemo(() => {
    const map = { cash: 0, card: 0, split: 0 }
    completedSales.forEach(s => { map[s.paymentMethod] = (map[s.paymentMethod] || 0) + s.total })
    return [
      { name: 'Cash',  value: map.cash,  color: '#22c55e' },
      { name: 'Card',  value: map.card,  color: '#3b82f6' },
      { name: 'Split', value: map.split, color: '#a855f7' },
    ]
  }, [completedSales])

  // Top items sold
  const topItems = intelligence.topItemsList

  const handleExport = () => {
    const rows = [
      ['Date', 'Cashier', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment', 'Source', 'Status', 'Receipt'],
      ...filtered.map(s => [
        format(new Date(s.date), 'yyyy-MM-dd HH:mm'),
        s.cashier || 'System',
        s.items,
        s.subtotal ?? s.total,
        s.discount || 0,
        s.tax || 0,
        s.total,
        s.paymentMethod,
        s.source || 'grocery',
        s.status || 'completed',
        s.receiptNo || '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paxxmo-report-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const chartLabel = { day: 'Hourly', week: 'Daily', month: 'Daily', year: 'Monthly' }[period]
  const salesRangeLabel = datePreset === 'period'
    ? periodLabel(period)
    : `${format(visibleStart, 'dd MMM yyyy')} - ${format(visibleEnd, 'dd MMM yyyy')}`

  return (
    <div className="h-full overflow-y-auto p-5">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">{salesRangeLabel}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period tabs */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-0.5 shadow-sm">
            {PERIODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  period === id
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          <button onClick={handleExport} className="btn-secondary text-xs">
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ─── KPI Stats ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="stat-card">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Revenue</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#16a34a18', color: '#16a34a' }}>
              <DollarSign size={17} />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight">{formatCurrency(totalRevenue)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-xs text-gray-400">vs prev {period}</p>
            <TrendBadge current={totalRevenue} previous={prevRevenue} />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Est. Profit</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#2563eb18', color: '#2563eb' }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight">{formatCurrency(totalProfit)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-xs text-gray-400">~25% margin</p>
            <TrendBadge current={totalProfit} previous={prevProfit} />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Transactions</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7c3aed18', color: '#7c3aed' }}>
              <Receipt size={17} />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight">{totalTransactions}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-xs text-gray-400">vs prev {period}</p>
            <TrendBadge current={totalTransactions} previous={prevTransactions} />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg Order</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#d9770618', color: '#d97706' }}>
              <ShoppingCart size={17} />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight">{formatCurrency(avgOrder)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-xs text-gray-400">per transaction</p>
            <TrendBadge current={avgOrder} previous={prevAvgOrder} />
          </div>
        </div>
      </div>

      {/* ─── Search & Date Filter ─── */}
      <div className="card p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Search sales</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-0.5">
              <Search size={15} className="shrink-0 text-gray-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Receipt no, cashier, item name, payment, source, or date..."
                className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-700 placeholder:text-gray-400 py-2"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText('')}
                  className="shrink-0 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="w-full lg:w-56">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date preset</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="input-base mt-1.5"
            >
              <option value="period">Selected period</option>
              <option value="last12">Last 12 months</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          <div className="w-full lg:w-48">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={datePreset !== 'custom'}
              className="input-base mt-1.5"
            />
          </div>

          <div className="w-full lg:w-48">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={datePreset !== 'custom'}
              className="input-base mt-1.5"
            />
          </div>

          <button
            onClick={() => {
              setSearchText('')
              setFromDate('')
              setToDate('')
              setDatePreset('period')
            }}
            className="btn-ghost w-full lg:w-auto"
          >
            <Filter size={14} />
            Reset Filters
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className={cn('px-3 py-1.5 rounded-full text-xs font-bold border', datePreset === 'period' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500')} onClick={() => setDatePreset('period')}>Use Period</button>
          <button className={cn('px-3 py-1.5 rounded-full text-xs font-bold border', datePreset === 'last12' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500')} onClick={() => setDatePreset('last12')}>Last 12 Months</button>
          <button className={cn('px-3 py-1.5 rounded-full text-xs font-bold border', datePreset === 'custom' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500')} onClick={() => setDatePreset('custom')}>Custom Date Search</button>
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-500 flex items-center justify-between flex-wrap gap-2">
        <span>
          Showing <span className="font-bold text-gray-900">{filtered.length}</span> sales from <span className="font-bold text-gray-900">{format(visibleStart, 'dd MMM yyyy')}</span> to <span className="font-bold text-gray-900">{format(visibleEnd, 'dd MMM yyyy')}</span>
        </span>
        <span className="font-medium">Search matches receipt number, item names, cashier, payment method, source, and date</span>
      </div>

      {/* ─── Intelligence KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="stat-card">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Gross Revenue</p>
          <p className="text-2xl font-black text-gray-900 leading-tight">{formatCurrency(grossRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Before refunds</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Refunds</p>
          <p className="text-2xl font-black text-gray-900 leading-tight">{formatCurrency(refundTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{refundCount} refunds this period</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Low Stock Alerts</p>
          <p className="text-2xl font-black text-gray-900 leading-tight">{intelligence.lowStockCount}</p>
          <p className="text-xs text-gray-400 mt-1">Items at or below threshold</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Net Sales</p>
          <p className="text-2xl font-black text-gray-900 leading-tight">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">After refunds</p>
        </div>
      </div>

      {/* ─── Chart ─── */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Revenue vs Profit</h3>
            <p className="text-xs text-gray-400 mt-0.5">{chartLabel} breakdown</p>
          </div>
          <Badge variant="green">{periodLabel(period)}</Badge>
        </div>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Profit"  fill="#86efac" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Bottom Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Payment breakdown */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Payment Methods</h3>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No transactions</p>
          ) : (
            <div className="flex flex-col gap-4">
              {paymentBreakdown.map(p => {
                const pct = totalRevenue > 0 ? (p.value / totalRevenue) * 100 : 0
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{pct.toFixed(1)}%</span>
                        <span className="font-bold text-gray-800 text-xs">{formatCurrency(p.value)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: p.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Summary */}
          {filtered.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Total Revenue</span>
                <span className="font-bold text-gray-800">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Est. Profit (25%)</span>
                <span className="font-bold text-green-700">{formatCurrency(totalProfit)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Transaction history */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">Transaction History</h3>
            <span className="text-xs text-gray-400">{filtered.length} total</span>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Receipt size={32} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No transactions for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date & Time</th>
                    <th>Source</th>
                    <th>Cashier</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice().reverse().slice(0, 12).map((s) => (
                    <tr key={s.id || s.receiptNo || String(s.date)}>
                      <td className="text-xs font-mono font-semibold text-gray-700">
                        {String(s.receiptNo || '').trim() || 'N/A'}
                      </td>
                      <td className="text-xs">{format(new Date(s.date), 'MMM d, hh:mm aa')}</td>
                      <td>
                        <Badge variant="gray">{String(s.source || 'grocery')}</Badge>
                      </td>
                      <td className="text-xs font-semibold">{s.cashier || 'System'}</td>
                      <td className="text-sm">{s.items}</td>
                      <td>
                        <Badge variant={s.paymentMethod === 'cash' ? 'green' : s.paymentMethod === 'card' ? 'blue' : 'gray'}>
                          {s.paymentMethod}
                        </Badge>
                      </td>
                      <td>
                        <span className={cn('font-bold', Number(s.total || 0) < 0 ? 'text-red-600' : 'text-green-700')}>
                          {formatCurrency(s.total)}
                        </span>
                      </td>
                      <td>
                        <Badge variant={s.status === 'refund' || s.status === 'refunded' ? 'red' : 'green'}>
                          {s.status === 'refund' || s.status === 'refunded' ? 'Refunded' : 'Completed'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Intelligence Summary ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Intelligence Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Peak Performance</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                {intelligence.bestBucket ? `${intelligence.bestBucket.label} · ${formatCurrency(intelligence.bestBucket.revenue)}` : 'No data'}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Slowest Bucket</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                {intelligence.worstBucket ? `${intelligence.worstBucket.label} · ${formatCurrency(intelligence.worstBucket.revenue)}` : 'No data'}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Top Payment</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                {intelligence.paymentLeader ? `${intelligence.paymentLeader[0]} · ${formatCurrency(intelligence.paymentLeader[1])}` : 'No data'}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Top Source</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                {intelligence.sourceLeader ? `${intelligence.sourceLeader[0]} · ${formatCurrency(intelligence.sourceLeader[1])}` : 'No data'}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Data-wise Breakdown</h3>
          {detailedRows.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No data for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th>Sales</th>
                    <th>Tx</th>
                    <th>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedRows.map((row) => (
                    <tr key={row.label}>
                      <td className="text-xs font-semibold">{row.label}</td>
                      <td className="text-xs font-semibold text-green-700">{formatCurrency(row.revenue)}</td>
                      <td className="text-xs">{row.txCount}</td>
                      <td className="text-xs">{formatCurrency(row.avgTicket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Top Items (if available) ─── */}
      {topItems.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Top Selling Items</h3>
          <div className="flex flex-col gap-3">
            {topItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ background: ['#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0'][i] }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                    <span className="text-xs font-black text-green-700 ml-2 shrink-0">{formatCurrency(item.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(item.revenue / topItems[0].revenue) * 100}%`,
                          background: `linear-gradient(90deg, #16a34a, #22c55e)`
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{item.qty} sold</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
