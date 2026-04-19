import { Zap } from 'lucide-react'

export default function PromotionBadge({
  title,
  description,
  discount,
  className = '',
  animated = true,
}) {
  return (
    <div
      className={`floating-card accent-glow p-5 max-w-sm overflow-hidden ${className} ${animated ? 'animate-pulse' : ''}`}
      style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(14, 116, 144, 0.14) 100%)' }}
    >
      {animated && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />}
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-300" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Hot Deal</span>
        </div>
        <h3 className="text-2xl font-black text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-300 mb-3">{description}</p>
        {discount && (
          <div className="inline-block bg-cyan-300/20 border border-cyan-300/40 rounded-lg px-3 py-1.5">
            <p className="text-sm font-black text-cyan-200">{discount}</p>
          </div>
        )}
      </div>
    </div>
  )
}
