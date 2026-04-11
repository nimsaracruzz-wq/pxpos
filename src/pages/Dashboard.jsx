import React, { useMemo } from 'react'
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  ArrowUpRight, Users, DollarSign, Activity, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { useSalesStore, useProductStore, useAppStore } from '@/store'
import { StatCard, Badge } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { format, subDays, startOfDay } from 'date-fns'

const COLORS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-green-600 font-bold">Rs. {payload[0]?.value?.toLocaleString()}</p>
    </div>
  )
}

export default function Dashboard() {
  const { sales } = useSalesStore()
  const { products } = useProductStore()
  const { activeModule } = useAppStore()

  // STRICT SCOPING: Filter global data context strictly to active module
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

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeModule ? (activeModule.charAt(0).toUpperCase() + activeModule.slice(1)) : 'System'} Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back! Here's what's happening in your {activeModule} operations today.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Area chart - 14 day revenue */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Revenue Trend</h3>
              <p className="text-xs text-gray-500">Last 14 days</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-green-600 font-semibold">
              <Activity size={14} />
              Live
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#16a34a"
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - categories */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Product Categories</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1 mt-2">
            {categoryData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">Top Products</h3>
            <Badge variant="green">This Month</Badge>
          </div>
          <div className="flex flex-col gap-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-white shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.sold / 90) * 100}%`,
                          background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{p.sold} sold</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-green-700 shrink-0">
                  {formatCurrency(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock + recent transactions */}
        <div className="flex flex-col gap-4">
          {/* Low stock alerts */}
          {lowStock.length > 0 && (
            <div className="card p-5" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-500" />
                <h3 className="font-bold text-gray-900 text-sm">{lowStock.length} Low Stock Alerts</h3>
              </div>
              <div className="flex flex-col gap-2">
                {lowStock.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate flex-1">{p.name}</span>
                    <Badge variant={p.stock === 0 ? 'red' : 'yellow'}>
                      {p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div className="card p-5 flex-1">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Recent Transactions</h3>
            <div className="flex flex-col gap-2">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No transactions today</p>
              ) : (
                transactions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        {s.items} item{s.items !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.paymentMethod === 'cash' ? '💵' : s.paymentMethod === 'card' ? '💳' : '🔀'} {s.paymentMethod}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">{formatCurrency(s.total)}</p>
                      <p className="text-xs text-gray-400">{format(new Date(s.date), 'hh:mm aa')}</p>
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
