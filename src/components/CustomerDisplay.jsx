import React from 'react'
import { X, QrCode, Smartphone, CircleDollarSign, Clock3 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatCurrency } from '@/lib/utils'

export default function CustomerDisplay({
  open,
  onClose,
  amount = 0,
  qrData = '',
  reference = '',
  subtitle = 'Please scan this QR with your banking app to complete payment.',
  title = 'Scan & Pay',
}) {
  if (!open) return null

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 200 }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="animate-fade-in border border-emerald-100"
        style={{
          width: 'min(960px, 95vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          borderRadius: 24,
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 55%, #eef2ff 100%)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          padding: 28,
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-emerald-700 mb-2">
              Customer Display
            </p>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">{title}</h2>
            <p className="text-sm text-slate-600 mt-2">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/80 border border-white text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-5">
          <div className="rounded-2xl bg-white/80 border border-white p-6">
            <p className="text-xs font-bold text-slate-500 tracking-[0.14em] uppercase">Amount Due</p>
            <div className="mt-2 flex items-center gap-3 text-emerald-700">
              <CircleDollarSign size={26} />
              <p className="text-5xl font-black leading-none">{formatCurrency(Number(amount || 0))}</p>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <Clock3 size={18} className="text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">Waiting for bank confirmation</p>
                <p className="text-xs text-amber-700 mt-1">
                  Payment status will update automatically once the transaction is successful.
                </p>
              </div>
            </div>

            {reference && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em]">Reference</p>
                <p className="text-sm font-mono text-slate-800 mt-1 break-all">{reference}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-white p-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">HelaQR</p>
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                <Smartphone size={12} /> Scan Now
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-100 shadow-sm bg-white">
              {qrData ? (
                <QRCodeSVG value={qrData} size={260} level="H" includeMargin />
              ) : (
                <div className="w-[260px] h-[260px] rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                  <QrCode size={40} />
                  <p className="text-xs mt-2">QR data unavailable</p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 mt-3 text-center">
              Ask the customer to open their mobile banking app and scan this code.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
