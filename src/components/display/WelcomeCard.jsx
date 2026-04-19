import { BRAND } from '@/lib/brand'

export default function WelcomeCard({
  title = `Welcome to ${BRAND.name} POS`,
  subtitle = 'Ready to order',
  message = 'Your order will be prepared with care',
  className = '',
}) {
  return (
    <div className={`floating-card accent-glow p-5 max-w-sm ${className}`}>
      <p className="text-[11px] text-slate-400 mb-3 uppercase tracking-[0.18em]">Welcome</p>
      <h2 className="text-3xl font-black text-white mb-1">{title}</h2>
      <p className="text-sm text-emerald-300 font-semibold mb-3">{subtitle}</p>
      <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
      <div className="mt-5 h-1.5 w-16 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" />
    </div>
  )
}
