import { CheckCircle, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', color: 'text-yellow-300', bgColor: 'bg-yellow-400/10' },
  preparing: { icon: Clock, label: 'Preparing', color: 'text-blue-300', bgColor: 'bg-blue-400/10' },
  ready: { icon: CheckCircle, label: 'Ready', color: 'text-emerald-300', bgColor: 'bg-emerald-400/10' },
  completed: { icon: CheckCircle, label: 'Completed', color: 'text-emerald-300', bgColor: 'bg-emerald-500/10' },
}

export default function OrderStatusCard({
  orderNumber = 'LIVE',
  status = 'pending',
  items = [],
  totalAmount = 0,
  className = '',
}) {
  const config = statusConfig[status] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className={`floating-card accent-glow p-5 max-w-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em]">Order</p>
          <p className="text-2xl font-black font-mono text-white">#{orderNumber}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
          <StatusIcon className={`${config.color} w-5 h-5`} />
        </div>
      </div>

      <div className="mb-3">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${config.color} ${config.bgColor}`}>
          {config.label}
        </span>
      </div>

      {items.length > 0 && (
        <div className="mb-4 pb-4 border-b border-slate-700/60">
          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-[0.18em]">Items</p>
          <ul className="space-y-1.5 max-h-28 overflow-auto pr-1">
            {items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="text-sm text-slate-100 flex items-start justify-between gap-2">
                <span className="truncate">{item.name} x{item.qty}</span>
                <span className="font-semibold text-emerald-300">{formatCurrency(Number(item.lineTotal || 0))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 uppercase tracking-[0.16em]">Total</p>
        <p className="text-2xl font-black text-emerald-300">{formatCurrency(Number(totalAmount || 0))}</p>
      </div>
    </div>
  )
}
