import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  ArrowUpRight, ArrowDownRight, DollarSign, Sparkles,
  Clock, Loader2, Zap, Info, RotateCcw, CreditCard,
  Banknote, Layers, ChevronRight, Activity
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { useSalesStore, useProductStore, useAppStore } from '@/store'
import { useToast } from '@/components/Toast'
import { formatCurrency } from '@/lib/utils'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { generateDashboardInsights } from '@/lib/ai'
import { cn } from '@/lib/utils'

const CHART_COLORS = ['#16a34a', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-2xl px-4 py-3 min-w-[150px]">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-base font-black text-emerald-700">{formatCurrency(payload[0]?.value || 0)}</p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const KpiSkeleton = () => (
  <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="h-3 w-24 bg-gray-100 rounded-full" />
      <div className="w-10 h-10 rounded-2xl bg-gray-100" />
    </div>
    <div className="h-7 w-32 bg-gray-100 rounded-xl mb-2" />
    <div className="h-3 w-20 bg-gray-100 rounded-full" />
  </div>
)

export default function Dashboard() {
  const navigate = useNavigate()
  const { sales }    = useSalesStore()
  const { products } = useProductStore()
  const { activeModule } = useAppStore()
  const [loaded, setLoaded]               = useState(false)
  const [aiInsights, setAiInsights]       = useState([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const toast = useToast()

  useEffect(() => { const t = setTimeout(() => setLoaded(true), 250); return () => clearTimeout(t) }, [])

  const scopedProducts = useMemo(() =>
    products.filter(p => p.module === activeModule || (!p.module && activeModule === 'grocery'))
  , [products, activeModule])

  const scopedSales = useMemo(() =>
    sales.filter(s => s.source === activeModule || (!s.source && activeModule === 'grocery') || (activeModule === 'restaurant' && s.source === 'takeout'))
  , [sales, activeModule])

  const todaySales = useMemo(() => {
    const today = new Date()
    return scopedSales.filter(s => new Date(s.date).toDateString() === today.toDateString())
  }, [scopedSales])

  const yesterdaySales = useMemo(() => {
    const yesterday = subDays(new Date(), 1)
    return scopedSales.filter(s => new Date(s.date).toDateString() === yesterday.toDateString())
  }, [scopedSales])

  const monthlySales = useMemo(() => {
    const since = subDays(new Date(), 30)
    return scopedSales.filter(s => new Date(s.date) >= since)
  }, [scopedSales])

  const todayRevenue     = todaySales.reduce((sum,s) => sum + Number(s.total||0), 0)
  const yesterdayRevenue = yesterdaySales.reduce((sum,s) => sum + Number(s.total||0), 0)
  const monthlyRevenue   = monthlySales.reduce((sum,s) => sum + Number(s.total||0), 0)
  const lowStock         = scopedProducts.filter(p => p.stock <= 10 && p.active)
  const outOfStock       = scopedProducts.filter(p => p.stock === 0 && p.active)
  const avgOrder         = todaySales.length ? todayRevenue / todaySales.length : 0

  const todayRefunds  = todaySales.filter(s => s.status === 'refund' || s.status === 'refunded')

  // revenue trend — 14 days
  const chartData = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i)
    const rev  = scopedSales
      .filter(s => new Date(s.date).toDateString() === date.toDateString())
      .reduce((sum,s) => sum + Number(s.total||0), 0)
    return { name: format(date, 'MMM d'), revenue: rev, idx: i }
  }), [scopedSales])

  // hourly today bar chart
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => {
      const rev = todaySales
        .filter(s => new Date(s.date).getHours() === h)
        .reduce((sum,s) => sum + Number(s.total||0), 0)
      return { name: h % 6 === 0 ? `${h}:00` : '', revenue: rev }
    })
    return hours
  }, [todaySales])

  // category pie
  const categoryData = useMemo(() => {
    const counts = {}
    scopedProducts.forEach(p => { if (p.category) counts[p.category] = (counts[p.category]||0) + 1 })
    return Object.entries(counts).slice(0,5).map(([name,value]) => ({ name, value }))
  }, [scopedProducts])

  // payment split today
  const paymentSplit = useMemo(() => {
    const map = { cash: 0, card: 0, split: 0 }
    todaySales.forEach(s => { if (s.paymentMethod) map[s.paymentMethod] = (map[s.paymentMethod]||0) + Number(s.total||0) })
    return map
  }, [todaySales])

  // recent tx
  const recentTx = useMemo(() =>
    todaySales.slice().sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,6)
  , [todaySales])

  const handleGenerateInsights = async () => {
    setLoadingInsights(true); setAiInsights([])
    try { setAiInsights(await generateDashboardInsights(scopedSales, scopedProducts)) }
    catch (err) { toast.error(err.message || 'Failed to generate insights') }
    finally { setLoadingInsights(false) }
  }

  const moduleLabel = activeModule
    ? activeModule.charAt(0).toUpperCase() + activeModule.slice(1)
    : 'System'

  const revTrend = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7f5]">
      <div className="p-5 space-y-5 max-w-[1600px] mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}>
                <Activity size={16} color="white"/>
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{moduleLabel} Dashboard</h1>
            </div>
            <p className="text-sm text-gray-400 ml-0.5">
              {format(new Date(), 'EEEE, MMMM d yyyy')} · <span className="text-emerald-600 font-semibold">{todaySales.length} sales today</span>
            </p>
          </div>
          <button
            onClick={handleGenerateInsights}
            disabled={loadingInsights}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border shadow-sm"
            style={{ background: 'linear-gradient(135deg,#7c3aed08,#a855f710)', borderColor: '#a855f730', color: '#7c3aed' }}
          >
            {loadingInsights
              ? <Loader2 size={15} className="animate-spin"/>
              : <Sparkles size={15}/>
            }
            AI Insights
          </button>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {!loaded ? (
            <><KpiSkeleton/><KpiSkeleton/><KpiSkeleton/><KpiSkeleton/></>
          ) : (
            <>
              {/* Today Revenue */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow col-span-2 xl:col-span-1"
                style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%)' }}>
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Revenue</p>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)', boxShadow:'0 4px 12px rgba(22,163,74,0.3)' }}>
                    <DollarSign size={18} color="white"/>
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900 leading-none">{formatCurrency(todayRevenue)}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-xs text-gray-400">{todaySales.length} transactions</span>
                  {revTrend !== null && (
                    <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full', revTrend >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-500 bg-red-50')}>
                      {revTrend >= 0 ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
                      {Math.abs(revTrend).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Monthly Revenue */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Monthly Revenue</p>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#2563eb,#3b82f6)', boxShadow:'0 4px 12px rgba(37,99,235,0.25)' }}>
                    <TrendingUp size={18} color="white"/>
                  </div>
                </div>
                <p className="text-2xl font-black text-gray-900 leading-none">{formatCurrency(monthlyRevenue)}</p>
                <p className="text-xs text-gray-400 mt-2.5">{monthlySales.length} tx in 30 days</p>
              </div>

              {/* Avg Order */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg Order</p>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#d97706,#f59e0b)', boxShadow:'0 4px 12px rgba(217,119,6,0.25)' }}>
                    <ShoppingCart size={18} color="white"/>
                  </div>
                </div>
                <p className="text-2xl font-black text-gray-900 leading-none">{formatCurrency(avgOrder)}</p>
                <p className="text-xs text-gray-400 mt-2.5">per transaction today</p>
              </div>

              {/* Products */}
              <div 
                onClick={() => navigate('/products')}
                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-violet-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Products</p>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', boxShadow:'0 4px 12px rgba(124,58,237,0.25)' }}>
                    <Package size={18} color="white"/>
                  </div>
                </div>
                <p className="text-2xl font-black text-gray-900 leading-none">{scopedProducts.length}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  {lowStock.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Zap size={10}/> {lowStock.length} low
                    </span>
                  )}
                  {outOfStock.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      {outOfStock.length} out
                    </span>
                  )}
                  {lowStock.length === 0 && <span className="text-xs text-gray-400">All stocked</span>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Charts row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
          {/* 14-day Revenue Trend */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-black text-gray-900">Revenue Trend</h2>
                <p className="text-xs text-gray-400 mt-0.5">Last 14 days</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>
                Live
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top:5, right:5, left:-24, bottom:0 }}>
                <defs>
                  <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#16a34a" stopOpacity={0.18}/>
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={1}/>
                <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#dashRevGrad)" dot={false} activeDot={{ r:5, fill:'#16a34a', stroke:'white', strokeWidth:2 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Today Hourly + Payment split stacked */}
          <div className="flex flex-col gap-5">
            {/* Today Hourly */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex-1">
              <h2 className="font-black text-gray-900 mb-1">Today by Hour</h2>
              <p className="text-xs text-gray-400 mb-4">Hourly revenue breakdown</p>
              {todaySales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-200">
                  <ShoppingCart size={28}/>
                  <p className="text-xs text-gray-400 mt-2">No sales yet today</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={hourlyData} margin={{ top:0, right:0, left:-30, bottom:0 }}>
                    <XAxis dataKey="name" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
                    <Tooltip formatter={v => [formatCurrency(v), 'Revenue']} contentStyle={{ borderRadius:12, border:'1px solid #f1f5f9', fontSize:11 }}/>
                    <Bar dataKey="revenue" fill="#16a34a" radius={[4,4,0,0]} maxBarSize={20}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Payment split */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-black text-gray-900 mb-4">Today's Payments</h2>
              <div className="space-y-3">
                {[
                  { label:'Cash',  val: paymentSplit.cash,  color:'#16a34a', icon:<Banknote size={13}/> },
                  { label:'Card',  val: paymentSplit.card,  color:'#3b82f6', icon:<CreditCard size={13}/> },
                  { label:'Split', val: paymentSplit.split, color:'#a855f7', icon:<Layers size={13}/> },
                ].map(({ label, val, color, icon }) => {
                  const pct = todayRevenue > 0 ? Math.min(100, (val / todayRevenue) * 100) : 0
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5" style={{ color }}>
                          {icon}
                          <span className="text-xs font-semibold text-gray-700">{label}</span>
                        </div>
                        <span className="text-xs font-black text-gray-900">{formatCurrency(val)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:color, transition:'width .7s ease' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── AI Insights ─────────────────────────────────────────────────── */}
        {(aiInsights.length > 0 || loadingInsights) && (
          <div className="bg-gradient-to-br from-violet-50 to-white rounded-3xl border border-violet-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <Sparkles size={15} className="text-violet-600"/>
              </div>
              <h2 className="font-black text-gray-900">AI Business Insights</h2>
            </div>
            {loadingInsights ? (
              <div className="flex items-center gap-3 text-violet-600 py-4">
                <Loader2 size={18} className="animate-spin"/>
                <p className="text-sm font-medium animate-pulse">Analyzing your sales patterns...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {aiInsights.map((insight, idx) => {
                  const isPos = insight.type === 'positive'
                  const isNeg = insight.type === 'negative'
                  const isAct = insight.type === 'action'
                  const Icon  = isPos ? ArrowUpRight : isNeg ? ArrowDownRight : isAct ? Zap : Info
                  const color = isPos ? '#16a34a' : isNeg ? '#ef4444' : isAct ? '#f59e0b' : '#3b82f6'
                  return (
                    <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background:`${color}12`, color }}>
                        <Icon size={15}/>
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">{insight.title}</h4>
                      {insight.titleSi && <h4 className="font-semibold text-gray-700 text-xs mt-0.5">{insight.titleSi}</h4>}
                      <p className="text-xs text-gray-500 leading-relaxed mt-2">{insight.description}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Bottom row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Category pie */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-black text-gray-900 mb-1">Product Categories</h2>
            <p className="text-xs text-gray-400 mb-4">Distribution by count</p>
            {categoryData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-200">
                <Package size={32}/>
                <p className="text-xs text-gray-400 mt-2">No categories yet</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={4} dataKey="value">
                      {categoryData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>[v,'Products']} contentStyle={{ borderRadius:12, border:'1px solid #f1f5f9', fontSize:11 }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {categoryData.map((item,i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}/>
                        <span className="text-gray-600 truncate">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-black text-gray-900">Recent Sales</h2>
                <p className="text-xs text-gray-400 mt-0.5">Today's transactions</p>
              </div>
              <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-100">
                {todaySales.length} today
              </span>
            </div>
            {recentTx.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-200">
                <ShoppingCart size={32}/>
                <p className="text-xs text-gray-400 mt-2">No transactions today</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTx.map((s,i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0"
                      style={{ background: s.paymentMethod === 'cash' ? '#f0fdf4' : s.paymentMethod === 'card' ? '#eff6ff' : '#faf5ff' }}
                    >
                      {s.paymentMethod === 'cash' ? <Banknote size={14} color="#16a34a"/> : s.paymentMethod === 'card' ? <CreditCard size={14} color="#3b82f6"/> : <Layers size={14} color="#a855f7"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate font-mono">{String(s.receiptNo||'').trim() || 'No Invoice'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{format(new Date(s.date),'hh:mm aa')} · {s.cashier}</p>
                    </div>
                    <p className="text-sm font-black text-emerald-700 shrink-0">{formatCurrency(s.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts + quick stats */}
          <div className="flex flex-col gap-4">
            {/* Low stock */}
            {lowStock.length > 0 ? (
              <div 
                onClick={() => navigate('/products')}
                className="bg-white rounded-3xl border border-amber-100 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all" 
                style={{ borderLeft: '3px solid #f59e0b' }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                    <AlertTriangle size={15} className="text-amber-500"/>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{lowStock.length} Low Stock</p>
                    <p className="text-xs text-gray-400">Restock soon</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {lowStock.slice(0,4).map(p => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-semibold text-gray-700 truncate flex-1">{p.name}</span>
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full ml-2', p.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}>
                        {p.stock === 0 ? 'Out' : `${p.stock} left`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 rounded-3xl border border-emerald-100 p-5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Package size={15}/>
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">All stocked up!</p>
                  <p className="text-xs text-emerald-600">{scopedProducts.length} active products</p>
                </div>
              </div>
            )}

            {/* Quick stat tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label:'Refunds Today', value: todayRefunds.length, color:'#ef4444', icon:<RotateCcw size={14}/> },
                { label:'Avg Ticket',    value: formatCurrency(avgOrder), color:'#d97706', icon:<TrendingUp size={14}/> },
                { label:'Est. Profit',   value: formatCurrency(todayRevenue * 0.25), color:'#16a34a', icon:<DollarSign size={14}/> },
                { label:'Monthly Tx',    value: monthlySales.length, color:'#3b82f6', icon:<ShoppingCart size={14}/> },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background:`${color}12`, color }}>
                    {icon}
                  </div>
                  <p className="text-base font-black text-gray-900 leading-none">{value}</p>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
