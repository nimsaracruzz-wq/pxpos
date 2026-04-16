import React, { useMemo, useState, useEffect } from 'react'
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  ArrowUpRight, Users, DollarSign, Activity, RefreshCw, User,
  Sparkles, Clock
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { useSalesStore, useProductStore, useAppStore } from '@/store'
import { StatCard, Badge } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { format, subDays } from 'date-fns'

const COLORS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-4 py-2.5 text-sm shadow-lg border-green-100" style={{ minWidth: 140 }}>
      <p className="font-semibold text-gray-600 text-xs mb-1">{label}</p>
      <p className="text-green-700 font-black text-base">Rs. {payload[0]?.value?.toLocaleString()}</p>
    </div>
  )
}

// ─── Loading skeleton for the stats row
const StatSkeleton = () => (
  <div className="stat-card">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="skeleton skeleton-text-sm mb-3" />
        <div className="skeleton" style={{ height: 28, width: '70%' }} />
        <div className="skeleton skeleton-text-sm mt-3" style={{ width: '55%' }} />
      </div>
      <div className="skeleton rounded-2xl" style={{ width: 44, height: 44 }} />
    </div>
  </div>
)

export default function Dashboard() {
  const { sales } = useSalesStore()
  const { products } = useProductStore()
  const { activeModule } = useAppStore()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 200)
    return () => clearTimeout(t)
  }, [])

  // STRICT SCOPING
  const scopedProducts = useMemo(() =>
    products.filter(p => p.module === activeModule || (!p.module && activeModule === 'grocery')),
  [products, activeModule])

  const scopedSales = useMemo(() =>
    sales.filter(s => s.source === activeModule || (!s.source && activeModule === 'grocery') || (activeModule === 'restaurant' && s.source === 'takeout')),
  [sales, activeModule])

  const todaySales = useMemo(() => {
    const today = new Date()
    return scopedSales.filter((s) => new Date(s.date).toDateString() === today.toDateString())
  }, [scopedSales])

  const monthlySales = useMemo(() => {
    const month = new Date()
    month.setDate(month.getDate() - 30)
    return scopedSales.filter(s => new Date(s.date) >= month)
  }, [scopedSales])

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
  const monthlyRevenue = monthlySales.reduce((sum, s) => sum + s.total, 0)
  const lowStock = scopedProducts.filter(p => p.stock <= 10 && p.active)

  // Build 14-day chart data
  const chartData = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i)
      const dayLabel = format(date, 'MMM d')
      const dayRevenue = scopedSales
        .filter((s) => new Date(s.date).toDateString() === date.toDateString())
        .reduce((sum, s) => sum + s.total, 0)
      return { name: dayLabel, revenue: dayRevenue }
    })
  }, [scopedSales])

  // Category breakdown (pie chart)
  const categoryData = useMemo(() => {
    const counts = {}
    scopedProducts.forEach((p) => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1
    })
    return Object.entries(counts).slice(0, 5).map(([name, value]) => ({ name, value }))
  }, [scopedProducts])

  // Top products
  const topProducts = scopedProducts.slice(0, 5).map((p) => ({
    name: p.name,
    sold: Math.floor(Math.random() * 80) + 10,
    revenue: p.price * (Math.floor(Math.random() * 80) + 10),
  }))

  const transactions = todaySales.slice(0, 6)

  const moduleLabel = activeModule
    ? activeModule.charAt(0).toUpperCase() + activeModule.slice(1)
    : 'System'

  return (
    <div className="h-full overflow-y-auto p-5">

      {/* ─── Header ─── */}
      <div className="mb-6 flex items-end justify-between animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
              <Sparkles size={15} color="white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {moduleLabel} Dashboard
            </h1>
          </div>
          <p className="text-sm text-gray-500 ml-10">
            Welcome back! Here's what's happening in your <span className="font-semibold text-gray-700">{activeModule}</span> operations today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-white rounded-xl px-3 py-2 border border-gray-100 shadow-sm">
          <Clock size={13} className="text-green-500" />
          <span className="font-medium">{format(new Date(), 'EEE, MMM d yyyy')}</span>
        </div>
      </div>

      {/* ─── Stats row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
        {!loaded ? (
          <>
            <StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Today's Revenue"
              value={formatCurrency(todayRevenue)}
              subtitle={`${todaySales.length} transactions`}
              trend={8.2}
              icon={<TrendingUp size={20} />}
              color="#16a34a"
            />
            <StatCard
              title="Monthly Revenue"
              value={formatCurrency(monthlyRevenue)}
              subtitle="Last 30 days"
              trend={12.5}
              icon={<DollarSign size={20} />}
              color="#2563eb"
            />
            <StatCard
              title="Total Products"
              value={scopedProducts.length}
              subtitle={`${lowStock.length} low stock alerts`}
              icon={<Package size={20} />}
              color="#d97706"
            />
            <StatCard
              title="Today's Orders"
              value={todaySales.length}
              subtitle={`Avg. ${todaySales.length ? formatCurrency(todayRevenue / todaySales.length) : 'Rs. 0'}`}
              trend={3.1}
              icon={<ShoppingCart size={20} />}
              color="#7c3aed"
            />
          </>
        )}
      </div>

      {/* ─── Charts row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Area chart */}
        <div className="card p-5 lg:col-span-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Revenue Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 14 days</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50 border border-green-100 px-2.5 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              Live
            </div>
          </div>
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#16a34a"
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#16a34a', stroke: 'white', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-5 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <h3 className="font-bold text-gray-900 text-sm mb-1">Product Categories</h3>
          <p className="text-xs text-gray-400 mb-4">Distribution by count</p>
          {categoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Package size={32} className="text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">No category data yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Products']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-2">
                {categoryData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Bottom row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="card p-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Top Products</h3>
              <p className="text-xs text-gray-400 mt-0.5">By estimated sales volume</p>
            </div>
            <Badge variant="green">This Month</Badge>
          </div>
          <div className="flex flex-col gap-4">
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No products yet</p>
            ) : (
              topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black text-white shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: COLORS[i % COLORS.length] }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(p.sold / 90) * 100}%`,
                            background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{p.sold} sold</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-green-700 shrink-0">
                    {formatCurrency(p.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          {/* Low stock alerts */}
          {lowStock.length > 0 && (
            <div
              className="card p-5 animate-fade-in"
              style={{ borderLeft: '4px solid #f59e0b', animationDelay: '0.22s' }}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{lowStock.length} Low Stock Alerts</h3>
                  <p className="text-xs text-gray-400">Restock these items soon</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {lowStock.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-700 truncate flex-1 font-medium">{p.name}</span>
                    <Badge variant={p.stock === 0 ? 'red' : 'yellow'}>
                      {p.stock === 0 ? '⛔ Out of Stock' : `⚡ ${p.stock} left`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div className="card p-5 flex-1 animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-sm">Recent Transactions</h3>
              <span className="text-xs text-gray-400 font-medium">Today</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ShoppingCart size={28} className="text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No transactions today</p>
                </div>
              ) : (
                transactions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors cursor-default">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                        style={{ background: s.paymentMethod === 'cash' ? '#f0fdf4' : s.paymentMethod === 'card' ? '#eff6ff' : '#faf5ff' }}
                      >
                        {s.paymentMethod === 'cash' ? '💵' : s.paymentMethod === 'card' ? '💳' : '🔀'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">
                          {s.items} item{s.items !== 1 ? 's' : ''} · {s.paymentMethod}
                        </p>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                          {String(s.receiptNo || '').trim() || 'No Invoice'}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <User size={9} className="inline" /> {s.cashier}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-green-700">{formatCurrency(s.total)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{format(new Date(s.date), 'hh:mm aa')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

