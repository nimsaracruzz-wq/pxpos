import React, { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { BRAND } from '@/lib/brand'
import { useAppStore } from '@/store'
import MediaCarousel from '@/components/display/MediaCarousel'
import OrderStatusCard from '@/components/display/OrderStatusCard'
import PromotionBadge from '@/components/display/PromotionBadge'
import QRPaymentCard from '@/components/display/QRPaymentCard'
import WelcomeCard from '@/components/display/WelcomeCard'

export default function CustomerDisplay({
  open,
  onClose,
  onAutoReset,
  showCloseButton = true,
  amount = 0,
  qrData = '',
  paymentMethod = 'helaqr',
  status = 'idle',
  items = [],
  cashGiven = 0,
  change = 0,
  reference = '',
  subtitle = 'Ready to order',
  title = 'Customer Display',
  displaySettings = null,
}) {
  const method = String(paymentMethod || 'helaqr').toLowerCase()
  const safeItems = Array.isArray(items) ? items : []
  const cashReceived = Number(cashGiven || 0)
  const cashBalance = Number(change || 0)
  const appDisplaySettings = useAppStore((state) => state.customerDisplaySettings)
  const resolvedDisplaySettings = displaySettings || appDisplaySettings || {}
  const useCustomDisplay = resolvedDisplaySettings.enabled !== false
  const configuredSlides = Array.isArray(resolvedDisplaySettings.slides) ? resolvedDisplaySettings.slides : []

  const defaultSlides = useMemo(() => ([
    {
      id: 'default-slide-1',
      type: 'text',
      title: '20% OFF Today',
      description: 'Selected menu items only',
      tag: 'Hot Deal',
      accent: '#f97316',
      gradient: 'linear-gradient(130deg, #3f1d0d 0%, #9a3412 45%, #ea580c 100%)',
    },
    {
      id: 'default-slide-2',
      type: 'text',
      title: 'Buy 1 Get 1 Free',
      description: 'On selected beverages',
      tag: 'BOGO',
      accent: '#16a34a',
      gradient: 'linear-gradient(130deg, #052e2b 0%, #064e3b 45%, #0c4a6e 100%)',
    },
    {
      id: 'default-slide-3',
      type: 'text',
      title: 'New Menu Items',
      description: 'Try our chef specials',
      tag: 'New',
      accent: '#2563eb',
      gradient: 'linear-gradient(130deg, #172554 0%, #1d4ed8 55%, #0ea5e9 100%)',
    },
  ]), [])

  const [promoIndex, setPromoIndex] = useState(0)
  const [displayStatus, setDisplayStatus] = useState(status)

  const mediaItems = useMemo(() => {
    const slides = useCustomDisplay && configuredSlides.length > 0 ? configuredSlides : defaultSlides
    return slides.map((slide, index) => ({
      id: slide.id || `slide-${index}`,
      type: String(slide.type || 'text').toLowerCase(),
      title: slide.title || slide.headline || 'Promotion',
      description: slide.description || slide.message || '',
      tag: slide.tag || '',
      accent: slide.accent || '#16a34a',
      src: slide.src || '',
      mimeType: slide.mimeType || '',
      gradient: slide.gradient || `linear-gradient(135deg, ${slide.accent || '#0f172a'} 0%, #1e293b 45%, #0f766e 100%)`,
    }))
  }, [configuredSlides, defaultSlides, useCustomDisplay])

  const promoSlides = useMemo(() => {
    if (!useCustomDisplay) return defaultSlides
    return mediaItems.filter((slide) => slide.type === 'text')
  }, [mediaItems, defaultSlides, useCustomDisplay])

  useEffect(() => {
    setDisplayStatus(status)
  }, [status])

  const playTone = (type = 'tick') => {
    if (typeof window === 'undefined') return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    try {
      const ctx = new AudioCtx()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      if (type === 'success') {
        osc.frequency.setValueAtTime(660, now)
        osc.frequency.exponentialRampToValueAtTime(990, now + 0.18)
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.085, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
      } else {
        osc.frequency.setValueAtTime(520, now)
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
      }

      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + (type === 'success' ? 0.26 : 0.12))
      osc.onended = () => ctx.close()
    } catch {
      // best-effort only
    }
  }

  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      const slidesLength = promoSlides.length > 0 ? promoSlides.length : defaultSlides.length
      setPromoIndex((prev) => (prev + 1) % slidesLength)
    }, 3500)
    return () => clearInterval(timer)
  }, [open, promoSlides.length, defaultSlides.length])

  useEffect(() => {
    if (!open || displayStatus !== 'paid') return
    playTone('success')
    const timer = setTimeout(() => setDisplayStatus('idle'), 5000)
    return () => clearTimeout(timer)
  }, [open, displayStatus])

  useEffect(() => {
    if (!open) return
    if (!['active', 'checkout', 'paying'].includes(displayStatus)) return
    playTone('tick')
  }, [amount, displayStatus, open])

  useEffect(() => {
    if (!open || displayStatus !== 'idle' || status !== 'paid') return
    const timer = setTimeout(() => {
      if (typeof onAutoReset === 'function') onAutoReset()
    }, 3000)
    return () => clearTimeout(timer)
  }, [open, displayStatus, status, onAutoReset])

  const activePromo = promoSlides.length > 0
    ? promoSlides[promoIndex % promoSlides.length]
    : defaultSlides[promoIndex % defaultSlides.length]
  const orderStatus = displayStatus === 'paid'
    ? 'completed'
    : displayStatus === 'active'
      ? 'preparing'
      : displayStatus === 'checkout' || displayStatus === 'paying'
        ? 'pending'
        : 'pending'

  const welcomeTitle = useCustomDisplay && resolvedDisplaySettings.headline ? resolvedDisplaySettings.headline : `Welcome to ${BRAND.name} POS`
  const welcomeSubtitle = useCustomDisplay && resolvedDisplaySettings.subtitle ? resolvedDisplaySettings.subtitle : 'Ready to order'
  const welcomeMessage = useCustomDisplay && resolvedDisplaySettings.message ? resolvedDisplaySettings.message : 'Your order will be prepared with care'
  const displayTitle = useCustomDisplay && resolvedDisplaySettings.bannerTitle ? resolvedDisplaySettings.bannerTitle : title || BRAND.displayTitle
  const carouselInterval = Number(useCustomDisplay ? (resolvedDisplaySettings.autoplayInterval || 5000) : 5000)

  const qrInstructions = method === 'helaqr'
    ? 'Scan the QR and approve in your banking app'
    : `Payment method: ${String(method || 'cash').toUpperCase()}`

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden" style={{ background: '#070c17' }}>
      <div className="w-full h-full flex gap-4 p-4 relative">
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 z-30 w-10 h-10 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white border border-slate-600 flex items-center justify-center"
            title="Close"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <MediaCarousel items={mediaItems} autoPlay interval={carouselInterval} className="flex-1" />

          <div className="bg-slate-900/85 backdrop-blur-md rounded-xl p-4 border border-slate-700/70 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.18em] mb-1">Customer Display</p>
                <p className="text-lg font-semibold text-white">{displayTitle}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400 uppercase tracking-[0.16em] mb-1">Status</p>
                <p className="text-sm font-mono text-emerald-300">{displayStatus === 'idle' ? 'Ready to Order' : subtitle}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[40%] min-w-[340px] max-w-[480px] flex flex-col gap-4 overflow-y-auto pr-1">
          {displayStatus === 'idle' && (
            <WelcomeCard
              title={welcomeTitle}
              subtitle={welcomeSubtitle}
              message={welcomeMessage}
              className="animate-in fade-in slide-in-from-top-4 duration-500"
            />
          )}

          {displayStatus === 'idle' && (
            <PromotionBadge
              title={activePromo.title}
              description={activePromo.subtitle}
              discount={activePromo.tag}
              className="animate-in fade-in slide-in-from-top-4 duration-500 delay-100"
            />
          )}

          {(displayStatus === 'active' || displayStatus === 'checkout' || displayStatus === 'paying' || displayStatus === 'paid') && (
            <OrderStatusCard
              orderNumber={reference || 'LIVE'}
              status={orderStatus}
              items={safeItems}
              totalAmount={amount}
              className="animate-in fade-in slide-in-from-top-4 duration-500 delay-100"
            />
          )}

          {displayStatus === 'paid' && (
            <div className="floating-card accent-glow p-5 max-w-sm border border-emerald-300/40 bg-emerald-300/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">Payment Successful</p>
              <h3 className="mt-2 text-3xl font-black text-white leading-tight">Thank you for your purchase!</h3>
              <p className="mt-2 text-sm text-slate-200">
                Your payment has been received successfully. Please come again.
              </p>
            </div>
          )}

          {displayStatus === 'checkout' && (
            <div className="floating-card p-5 max-w-sm border border-emerald-500/40 bg-emerald-500/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">TOTAL</p>
              <p className="text-6xl font-black text-emerald-200 mt-2 leading-none">{formatCurrency(Number(amount || 0))}</p>
              <p className="text-sm text-slate-200 mt-3">Please choose payment</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['cash', 'card', 'helaqr'].map((id) => (
                  <div
                    key={id}
                    className={`rounded-lg border px-2 py-2 text-center text-xs font-black uppercase tracking-[0.1em] ${method === id ? 'bg-emerald-300/30 border-emerald-300 text-emerald-100' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                  >
                    {id === 'helaqr' ? 'QR' : id}
                  </div>
                ))}
              </div>
            </div>
          )}

          {displayStatus === 'paid' && method === 'cash' && (
            <div className="floating-card p-5 max-w-sm border border-blue-400/40 bg-blue-500/10">
              <p className="text-[11px] uppercase tracking-[0.16em] text-blue-200">Cash Settlement</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-blue-100 font-semibold">Cash Given</span>
                <span className="text-blue-50 font-black">{formatCurrency(cashReceived)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm border-t border-blue-300/30 pt-2">
                <span className="text-blue-100 font-semibold">Balance / Change</span>
                <span className="text-blue-50 font-black">{formatCurrency(cashBalance)}</span>
              </div>
            </div>
          )}

          <QRPaymentCard
            qrData={(displayStatus === 'checkout' || displayStatus === 'paying') && method === 'helaqr' ? qrData : ''}
            amount={amount}
            merchantName={BRAND.fullName}
            instructions={qrInstructions}
            active={(displayStatus === 'checkout' || displayStatus === 'paying') && method === 'helaqr'}
            className="animate-in fade-in slide-in-from-top-4 duration-500 delay-150 mt-auto"
          />
        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl animate-pulse" />
      </div>
    </div>
  )
}
