import { QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatCurrency } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

export default function QRPaymentCard({
  qrData = '',
  amount = 0,
  merchantName = BRAND.fullName,
  instructions = 'Scan the QR and approve in your banking app',
  className = '',
  active = false,
}) {
  return (
    <div className={`floating-card accent-glow p-5 max-w-sm ${className}`}>
      <div className="mb-4">
        <p className="text-[11px] text-slate-400 mb-1 uppercase tracking-[0.16em]">Payment</p>
        <h3 className="text-xl font-black text-white">Scan & Pay</h3>
      </div>

      <div className={`mb-5 p-4 rounded-xl border flex items-center justify-center min-h-[220px] ${active ? 'border-emerald-300/50 bg-emerald-300/10' : 'border-slate-700/80 bg-slate-900/70'}`}>
        {qrData ? (
          <div className={active ? 'animate-fade-in' : ''}>
            <QRCodeSVG value={qrData} size={190} includeMargin level="H" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2">
            <QrCode className="w-10 h-10 text-slate-500" />
            <p className="text-xs text-slate-400 text-center">QR Code will appear here</p>
          </div>
        )}
      </div>

      <div className="mb-4 pb-4 border-b border-slate-700/60">
        <p className="text-[11px] text-slate-400 mb-1 uppercase tracking-[0.16em]">Amount</p>
        <p className="text-3xl font-black text-emerald-300">{formatCurrency(Number(amount || 0))}</p>
      </div>

      <p className="text-sm text-slate-200 leading-relaxed">{instructions}</p>
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-400 text-center">Powered by {merchantName}</p>
      </div>
    </div>
  )
}
