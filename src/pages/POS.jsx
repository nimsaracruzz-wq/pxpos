import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote,
  Split, Tag, Receipt, X, Keyboard, RotateCcw, Pause,
  Play, Barcode, Percent, User, Printer, Search, CheckCircle2, Zap, ShieldCheck,
  Wheat, Droplets, ShoppingBasket, Milk, Coffee, Sparkles, Pill, ChefHat,
  Loader2, AlertCircle, AlertTriangle, Package
} from 'lucide-react'
import { usePOSStore, useProductStore, useAppStore, useSalesStore, useAuthStore, useActivityStore, useRecipeStore, useElectronicsStore } from '@/store'
import { useToast } from '@/components/Toast'
import { formatCurrency, generateReceiptNumber } from '@/lib/utils'
import { Badge, Modal, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import ReceiptModal, { ReceiptContent } from '@/components/Receipt'
import { printReceiptHTML } from '@/lib/printReceipt'
import { buildThermalProfile } from '@/lib/thermalPrinter'
import CustomerDisplay from '@/components/CustomerDisplay'
import { useI18n } from '@/lib/i18n'
import { v4 as uuidv4 } from 'uuid'
import { generateHelaQRPayment, checkHelaQRPaymentStatus, getHelaQRConfigStatus } from '@/lib/helaqr'
import { QRCodeSVG } from 'qrcode.react'
import { clearCustomerDisplay, publishCustomerDisplay } from '@/lib/customerDisplayChannel'
import { useBarcodeScanner } from '@/lib/useBarcodeScanner'

const ALL_CATEGORIES = ['All', 'Grains', 'Oils', 'Groceries', 'Dairy', 'Beverages', 'Personal Care', 'Pharmacy', 'Condiments']
const EMPTY_SERIALS = []

// ─── Category icon map ───────────────────────────────────────────────────────
const CAT_ICONS = {
  Grains: Wheat,
  Oils: Droplets,
  Groceries: ShoppingBasket,
  Dairy: Milk,
  Beverages: Coffee,
  'Personal Care': Sparkles,
  Pharmacy: Pill,
  Condiments: ChefHat,
}
const CatIcon = ({ cat, size = 14, className }) => {
  const Icon = CAT_ICONS[cat] || Package
  return <Icon size={size} className={className} />
}

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
      osc.frequency.setValueAtTime(620, now)
      osc.frequency.exponentialRampToValueAtTime(940, now + 0.18)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26)
    } else {
      osc.frequency.setValueAtTime(540, now)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    }

    osc.type = 'sine'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + (type === 'success' ? 0.28 : 0.14))
    osc.onended = () => ctx.close()
  } catch {
    // best-effort feedback only
  }
}

// ─── Payment Modal ───────────────────────────────────────────────────────────
const PaymentModal = ({ open, onClose, total, onCheckout, onComplete, onPublishCustomerDisplay, cartItems, initialMethod }) => {
  const [method, setMethod] = useState(initialMethod || 'cash')
  const [cashGiven, setCashGiven] = useState('')
  const [processing, setProcessing] = useState(false)

  // HelaQR flow state
  const [qrState, setQrState]   = useState('idle') // idle | generating | scanning | error
  const [qrData,  setQrData]    = useState('')
  const [qrRef,   setQrRef]     = useState('')
  const [qrPayRef, setQrPayRef] = useState('')
  const [qrReceiptNo, setQrReceiptNo] = useState('')
  const [qrError, setQrError]   = useState('')
  const [qrTimeLeft, setQrTimeLeft] = useState(0)
  const pollRef           = useRef(null)
  const countdownRef      = useRef(null)
  const firestoreUnsubRef = useRef(null)   // realtime Firestore listener
  const confirmedRef      = useRef(false)  // prevent double-confirm
  const QR_TIMEOUT = 300 // 5 minutes in seconds

  const cashNum = parseFloat(cashGiven) || 0
  const change  = method === 'cash' ? Math.max(0, cashNum - total) : 0
  const canPay  = method !== 'cash' || cashNum >= total

  const roundedTotal = Math.ceil(total / 100) * 100
  const quickAmounts = [...new Set([roundedTotal, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])]
    .filter((v) => v >= total).slice(0, 4)

  const stopQrTimers = () => {
    clearInterval(pollRef.current)
    clearInterval(countdownRef.current)
    if (typeof firestoreUnsubRef.current === 'function') {
      firestoreUnsubRef.current()
      firestoreUnsubRef.current = null
    }
  }

  // Reset everything when modal closes or method changes away from helaqr
  useEffect(() => {
    if (!open) {
      setCashGiven('')
      setMethod(initialMethod || 'cash')
      stopQrTimers()
      setQrState('idle')
      setQrData('')
    }
    return stopQrTimers
  }, [open])

  // Sync initial method when modal opens with different selection
  useEffect(() => {
    if (open && initialMethod) {
      setMethod(initialMethod)
    }
  }, [open, initialMethod])

  useEffect(() => {
    if (method !== 'helaqr') {
      stopQrTimers()
      setQrState('idle')
      setQrData('')
    }
  }, [method])

  // ── Generate QR and start polling ─────────────────────────────────────────
  const handleGenerateQR = async () => {
    const cfg = getHelaQRConfigStatus()
    if (!cfg.enabled || !cfg.configured) {
      setQrState('error')
      setQrError('Configure HelaQR in Settings before using this method')
      return
    }
    setQrState('generating')
    setQrError('')

    const receiptNo  = generateReceiptNumber()
    let result;
    try {
      result = await generateHelaQRPayment({ amount: total, reference: receiptNo })
    } catch (e) {
      setQrState('error')
      setQrError(e.message || 'Failed to generate QR code')
      return
    }

    if (!result?.success) {
      setQrState('error')
      setQrError(result?.error || 'Failed to generate QR code')
      return
    }

    setQrData(result.qrData)
    setQrRef(result.qrReference || '')
    setQrPayRef(result.reference || receiptNo)
    setQrReceiptNo(receiptNo)
    setQrState('scanning')
    setQrTimeLeft(QR_TIMEOUT)

    // Push the QR code to the Customer Display so they can scan it
    if (typeof onPublishCustomerDisplay === 'function') {
      onPublishCustomerDisplay({
        amount: total,
        qrData: result.qrData,
        paymentMethod: 'helaqr',
        status: 'paying',
        cashGiven: 0,
        change: 0,
        items: (cartItems || []).map((item) => ({
          id: item.id,
          name: item.name,
          qty: Number(item.qty || 0),
          price: Number(item.salePrice || item.price || 0),
          lineTotal: Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
        })),
        reference: result.reference || receiptNo,
        title: 'HelaQR Payment',
        subtitle: 'Please scan this code and complete payment from your banking app.',
      })
    }

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setQrTimeLeft((t) => {
        if (t <= 1) { stopQrTimers(); setQrState('idle'); return 0 }
        return t - 1
      })
    }, 1000)

    // ── Shared confirm handler (called from either Firestore OR API poll) ────
    confirmedRef.current = false
    const handleConfirmed = (source) => {
      if (confirmedRef.current) return // prevent double-fire
      confirmedRef.current = true
      console.log(`[HelaQR] Payment confirmed via ${source}`)
      stopQrTimers()
      setQrState('idle')
      onComplete('helaqr', 0, 0, {
        qrData:      result.qrData,
        qrReference: result.qrReference || '',
        paymentRef:  result.reference || receiptNo,
        receiptNo,
      })
    }

    const handleFailed = () => {
      if (confirmedRef.current) return
      stopQrTimers()
      setQrState('error')
      setQrError('Payment failed, expired, or was cancelled.')
    }

    // ── 1. Firestore realtime listener (INSTANT when webhook fires) ──────────
    try {
      const { getApps, getApp } = await import('firebase/app')
      const { getFirestore, doc, onSnapshot } = await import('firebase/firestore')
      const apps = getApps()
      if (apps.length > 0) {
        const db = getFirestore(apps[0])
        const ref = doc(db, 'helaqr_payments', receiptNo)
        firestoreUnsubRef.current = onSnapshot(ref, (snap) => {
          if (!snap.exists()) return
          const data = snap.data() || {}
          console.log('[HelaQR] Firestore snapshot —', receiptNo, 'isPaid:', data.isPaid)
          if (data.isPaid) handleConfirmed('firestore')
          else if (data.isFailed) handleFailed()
        }, (err) => {
          console.warn('[HelaQR] Firestore listener error:', err?.message)
        })
      }
    } catch (fsErr) {
      console.warn('[HelaQR] Could not start Firestore listener:', fsErr?.message)
    }

    // ── 2. API fallback poll every 3 seconds (covers no-Firestore cases) ─────
    pollRef.current = setInterval(async () => {
      try {
        const status = await checkHelaQRPaymentStatus({
          reference: receiptNo,
          qrReference: result.qrReference || '',
        })
        if (status?.isPaid) handleConfirmed('api-poll')
        else if (status?.isFailed) handleFailed()
      } catch { /* network hiccup — try again next tick */ }
    }, 3000)
  }

  const handlePay = () => {
    if (method === 'helaqr') { handleGenerateQR(); return }
    if (!canPay) return
    if (typeof onCheckout === 'function') onCheckout(method)
    setProcessing(true)
    setTimeout(() => {
      onComplete(method, cashNum, change)
      setProcessing(false)
      setCashGiven('')
      setMethod('cash')
    }, 500)
  }

  const methodButtons = [
    { id: 'cash',   label: 'Cash',   icon: Banknote,   color: { active: '#16a34a', light: '#dcfce7' } },
    { id: 'card',   label: 'Card',   icon: CreditCard,  color: { active: '#2563eb', light: '#dbeafe' } },
    { id: 'split',  label: 'Split',  icon: Split,        color: { active: '#7c3aed', light: '#ede9fe' } },
    { id: 'helaqr', label: 'HelaQR', icon: Zap,          color: { active: '#f59e0b', light: '#fef3c7' } },
  ]

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <Modal open={open} onClose={onClose} title="Process Payment" maxWidth="max-w-md">
      {/* Amount Due */}
      <div className="mb-5 p-5 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0' }}>
        <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-1">Amount Due</p>
        <p className="text-5xl font-black text-green-700 leading-tight mt-1">{formatCurrency(total)}</p>
      </div>

      {/* Method tabs */}
      <div className="flex gap-2 mb-5">
        {methodButtons.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setMethod(id)}
            disabled={qrState === 'scanning' || qrState === 'generating'}
            className="flex-1 flex flex-col items-center gap-2 py-3.5 rounded-2xl border-2 transition-all text-sm font-semibold"
            style={method === id
              ? { borderColor: color.active, background: color.light, color: color.active, boxShadow: `0 4px 14px ${color.active}22` }
              : { borderColor: '#e5e7eb', background: 'white', color: '#9ca3af' }
            }
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      {method === 'cash' && (
        <div className="mb-5 animate-slide-up">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cash Received</label>
          <input autoFocus type="number" value={cashGiven}
            onChange={(e) => setCashGiven(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canPay && handlePay()}
            placeholder={total.toFixed(2)} className="input-base mt-2 font-bold"
            style={{ height: 60, fontSize: 26 }}
          />
          <div className="flex gap-2 mt-3 flex-wrap">
            {quickAmounts.map((v) => (
              <button key={v} onClick={() => setCashGiven(String(v))}
                className="flex-1 text-sm px-3 py-2.5 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-bold hover:bg-green-100 hover:border-green-400 transition-all active:scale-95 min-h-[44px]">
                Rs. {v.toLocaleString()}
              </button>
            ))}
          </div>
          {cashNum >= total && cashNum > 0 && (
            <div className="mt-4 p-4 rounded-2xl flex items-center justify-between animate-pop-in" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="flex items-center gap-2"><Banknote size={16} className="text-blue-600" /><span className="text-sm font-semibold text-blue-700">Change to Return</span></div>
              <span className="text-2xl font-black text-blue-700">{formatCurrency(change)}</span>
            </div>
          )}
        </div>
      )}

      {method === 'card' && (
        <div className="mb-5 p-6 rounded-2xl bg-blue-50 text-center border border-blue-100 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3"><CreditCard size={28} className="text-blue-500" /></div>
          <p className="text-sm font-semibold text-blue-700">Tap or swipe the card to complete</p>
          <p className="text-xs text-blue-500 mt-1">Supported: Visa, Mastercard, Amex</p>
        </div>
      )}

      {method === 'split' && (
        <div className="mb-5 p-6 rounded-2xl bg-purple-50 text-center border border-purple-100 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-3"><Split size={28} className="text-purple-500" /></div>
          <p className="text-sm font-semibold text-purple-700">Split payment between cash and card</p>
          <p className="text-xs text-purple-500 mt-1">Ask customer for split amounts</p>
        </div>
      )}

      {/* ── HelaQR flow ─────────────────────────────────────────────────────── */}
      {method === 'helaqr' && (
        <div className="mb-5 animate-slide-up">
          {qrState === 'idle' && (
            <div className="p-6 rounded-2xl bg-amber-50 text-center border border-amber-100">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3"><Zap size={28} className="text-amber-500" /></div>
              <p className="text-sm font-semibold text-amber-700">Click below to generate QR code</p>
              <p className="text-xs text-amber-600 mt-1">Sale will only be recorded after payment is confirmed.</p>
            </div>
          )}
          {qrState === 'generating' && (
            <div className="p-6 rounded-2xl bg-amber-50 text-center border border-amber-100">
              <div className="flex justify-center mb-2"><Loader2 size={32} className="animate-spin text-amber-500" /></div>
              <p className="text-sm font-semibold text-amber-700">Generating QR Code…</p>
            </div>
          )}
          {qrState === 'scanning' && qrData && (
            <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 flex flex-col items-center">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Scan to Pay</p>
              <div className="bg-white p-3 rounded-xl shadow-md">
                <QRCodeSVG value={qrData} size={180} level="H" includeMargin />
              </div>
              <p className="text-2xl font-black text-green-700 mt-3">{formatCurrency(total)}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-xs text-amber-600 font-semibold">Waiting for payment… expires in {fmtTime(qrTimeLeft)}</p>
              </div>
              <button onClick={() => { stopQrTimers(); setQrState('idle'); setQrData('') }}
                className="mt-3 text-xs text-red-500 hover:underline">Cancel & go back</button>
            </div>
          )}
          {qrState === 'error' && (
            <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-center">
              <div className="flex items-center gap-2 justify-center text-red-700 mb-1"><AlertCircle size={15}/><p className="text-sm font-semibold">{qrError}</p></div>
              <button onClick={() => setQrState('idle')} className="text-xs text-red-500 hover:underline">Try again</button>
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      {(method !== 'helaqr' || qrState === 'idle' || qrState === 'error') && (
        <button
          onClick={handlePay}
          disabled={(!canPay && method === 'cash') || processing || qrState === 'generating'}
          className="btn-primary w-full justify-center text-base"
          style={{ borderRadius: 16, height: 56, fontSize: 16,
            opacity: (!canPay && method === 'cash') ? 0.45 : 1,
            background: processing ? '#9ca3af' : 'linear-gradient(135deg,#16a34a,#22c55e)',
          }}
        >
          {processing
            ? <><Loader2 size={18} className="animate-spin" /> Processing...</>
            : method === 'helaqr'
              ? <><Zap size={20} /> Generate QR Code</>
              : <><CheckCircle2 size={20} /> Confirm {method === 'cash' ? 'Cash' : method === 'card' ? 'Card' : 'Split'} Payment</>
          }
        </button>
      )}
    </Modal>
  )
}


// ─── Product Card Skeleton ───────────────────────────────────────────────────
const ProductSkeleton = () => (
  <div className="rounded-2xl border border-gray-100 p-4 flex flex-col gap-3" style={{ minHeight: 130, background: 'white' }}>
    <div className="skeleton rounded-xl" style={{ height: 52 }} />
    <div className="skeleton skeleton-text" />
    <div className="skeleton" style={{ height: 12, width: '45%' }} />
  </div>
)

// ─── Main POS Component ──────────────────────────────────────────────────────
export default function POS() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [showPayment, setShowPayment] = useState(false)
  const [paymentInitMethod, setPaymentInitMethod] = useState('cash')
  const [lastSale, setLastSale] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [customerDisplay, setCustomerDisplay] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCartItem, setSelectedCartItem] = useState(null)
  const [showSerialModal, setShowSerialModal] = useState(false)
  const [serialProduct, setSerialProduct] = useState(null)
  const [serialForm, setSerialForm] = useState({ serial: '', imei: '', warrantyMonths: 0 })
  const [autoPrintPending, setAutoPrintPending] = useState(false)
  const hiddenReceiptRef = useRef(null)
  const searchRef = useRef(null)
  const toast = useToast()

  // Store settings needed for auto-printing
  const businessInfo     = useAppStore(s => s.businessInfo)
  const receiptSettings  = useAppStore(s => s.receiptSettings)
  const hardwareSettings = useAppStore(s => s.hardwareSettings)

  // ── Stable field-level selectors (prevents infinite re-render loops) ──────
  const products        = useProductStore(s => s.products)
  const getByBarcode    = useProductStore(s => s.getByBarcode)
  const adjustStock     = useProductStore(s => s.adjustStock)
  const activeModule    = useAppStore(s => s.activeModule)
  const taxRate         = useAppStore(s => s.taxSettings.rate)
  const taxInclusive    = useAppStore(s => s.taxSettings.inclusive)
  const taxEnabled      = useAppStore(s => s.taxSettings.enabled)
  const taxName         = useAppStore(s => s.taxSettings.name)

  const cart              = usePOSStore(s => s.cart)
  const discount          = usePOSStore(s => s.discount)
  const discountType      = usePOSStore(s => s.discountType)
  const heldTransactions  = usePOSStore(s => s.heldTransactions)
  const addToCart         = usePOSStore(s => s.addToCart)
  const addUniqueItemToCart = usePOSStore(s => s.addUniqueItemToCart)
  const removeFromCart    = usePOSStore(s => s.removeFromCart)
  const updateQty         = usePOSStore(s => s.updateQty)
  const clearCart         = usePOSStore(s => s.clearCart)
  const setDiscount       = usePOSStore(s => s.setDiscount)
  const holdTransaction   = usePOSStore(s => s.holdTransaction)
  const resumeTransaction = usePOSStore(s => s.resumeTransaction)

  const addSale               = useSalesStore(s => s.addSale)
  const currentUser           = useAuthStore(s => s.currentUser)
  const switchCashierByBarcode = useAuthStore(s => s.switchCashierByBarcode)
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const allSerials = useElectronicsStore(s => s.serials || [])
  const availableSerials = useMemo(() => 
    serialProduct ? allSerials.filter(s => s.productId === serialProduct.id && s.status === 'in_stock') : EMPTY_SERIALS
  , [allSerials, serialProduct])

  const subtotal = usePOSStore(s => s.cart.reduce((sum, i) => sum + (i.salePrice ?? i.price) * i.qty, 0))
  const discountAmt = usePOSStore(s => {
    const sub = s.cart.reduce((sum, i) => sum + (i.salePrice ?? i.price) * i.qty, 0)
    return s.discountType === 'percent' ? (sub * s.discount) / 100 : Math.min(s.discount, sub)
  })
  const taxAmt     = (taxEnabled && !taxInclusive) ? ((subtotal - discountAmt) * taxRate) / 100 : 0
  const total      = subtotal - discountAmt + taxAmt

  const closeCustomerScreen = useCallback(() => {
    setCustomerDisplay(null)
    clearCustomerDisplay()
  }, [])

  const openCustomerScreen = useCallback((payload) => {
    // Respect the customer display settings: when `showOnPOS` is false,
    // we publish to the external customer-screen but do not show the
    // overlay on the main POS window.
    const displaySettings = useAppStore.getState().customerDisplaySettings || {}
    const showOnPOS = displaySettings.showOnPOS !== false
    if (showOnPOS) setCustomerDisplay(payload)
    publishCustomerDisplay(payload)
  }, [])

  const previewCheckoutState = useCallback((selectedMethod) => {
    const method = String(selectedMethod || 'cash').toLowerCase()
    openCustomerScreen({
      status: 'checkout',
      amount: total,
      paymentMethod: method,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: Number(item.qty || 0),
        price: Number(item.salePrice || item.price || 0),
        lineTotal: Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
      })),
      title: 'Order Summary',
      subtitle: 'Please choose payment',
    })
  }, [cart, total, openCustomerScreen])

  const getCartQty = (id) => Number(cart.find((i) => i.id === id)?.qty || 0)

  useEffect(() => {
    searchRef.current?.focus()
    // Simulate brief load for skeleton
    const t = setTimeout(() => setIsLoading(false), 350)
    return () => clearTimeout(t)
  }, [])

  // Debug: show HelaQR raw API response as toast so we can see field names
  useEffect(() => {
    const handler = (e) => {
      const raw = JSON.stringify(e.detail?.raw || {})
      toast.info(`HelaQR RAW: ${raw.slice(0, 300)}`, { duration: 15000 })
    }
    window.addEventListener('helaqr:debug', handler)
    return () => window.removeEventListener('helaqr:debug', handler)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'F2') { searchRef.current?.focus(); e.preventDefault() }
      if (e.key === 'F5') { if (cart.length > 0) setShowPayment(true); e.preventDefault() }
      if (e.key === 'Escape') { setSearch(''); setShowPayment(false); setShowReceipt(false); closeCustomerScreen() }
      if (e.key === 'Delete' && e.ctrlKey) { clearCart(); toast.warning('Cart cleared'); e.preventDefault() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cart, clearCart, closeCustomerScreen])

  const filteredProducts = products.filter((p) => {
    if (!p.active) return false
    const matchM = !p.module || p.module === activeModule
    const matchS = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
    const matchC = activeCategory === 'All' || p.category === activeCategory
    return matchM && matchS && matchC
  })

  // ── Global barcode scanner: handles BOTH product scans and cashier badge swipes ──
  useBarcodeScanner(useCallback(async (code) => {
    // 1. Cashier badge switch — try this first (badges are typically long codes)
    const cashierResult = await switchCashierByBarcode(code)
    if (cashierResult?.success) {
      toast.success(`Cashier switched to ${cashierResult.user?.name || cashierResult.user?.username || 'Staff'}`)
      return
    }

    // 2. Product barcode lookup — add to cart
    const found = getByBarcode(code)
    if (found) {
      handleAddToCart(found)
      return
    }

    // 3. Not found anywhere
    toast.error(`No product found for barcode: ${code}`, { duration: 2500 })
  }, [switchCashierByBarcode, getByBarcode]))

  // Manual search input — still supports typing a barcode and pressing Enter
  const handleSearchKey = useCallback((e) => {
    if (e.key !== 'Enter' || !search.trim()) return
    const found = getByBarcode(search.trim())
    if (found) {
      handleAddToCart(found)
      setSearch('')
    } else {
      toast.error('Product not found for this barcode', { duration: 2000 })
    }
  }, [search, getByBarcode])

  function handleAddToCart(p) {
    // ── Block expired products ───────────────────────────────────────────────
    if (p.expiry) {
      const expDate = new Date(p.expiry)
      if (!isNaN(expDate) && expDate < new Date()) {
        toast.error(
          `❌ Cannot sell — "${p.name}" expired on ${p.expiry}`,
          { duration: 4000 }
        )
        return
      }
    }

    // Check if it's an electronics item (either by activeModule, category, or by checking the electronics store)
    const isElectronicsItem = activeModule === 'electronics' || 
                              p.category === 'Smartphones' || 
                              p.category === 'Laptops' ||
                              useElectronicsStore.getState().elProducts?.some(ep => ep.id === p.id);

    if (isElectronicsItem) {
      setSerialProduct(p)
      setSerialForm({ serial: '', imei: '', warrantyMonths: p.warrantyMonths || 0 })
      setShowSerialModal(true)
      return
    }
    const currentQty = getCartQty(p.id)
    const stock = Number(p.stock || 0)
    if (stock <= currentQty) { toast.error(`${p.name} is out of stock`); return }
    addToCart(p)
    playTone('tick')
    toast.success(`${p.name} added to cart`, { duration: 1200 })
  }

  useEffect(() => {
    if (location.state?.scannedProduct) {
      handleAddToCart(location.state.scannedProduct)
      // Clear the state so it doesn't re-trigger on reload
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state?.timestamp])

  const handleSerialSubmit = (e) => {
    e.preventDefault()
    
    // If skipped (no serial/IMEI provided), add as regular item
    if (!serialForm.serial && !serialForm.imei) {
      const currentQty = getCartQty(serialProduct.id)
      const stock = Number(serialProduct.stock || 0)
      if (stock <= currentQty) { toast.error(`${serialProduct.name} is out of stock`); return }
      addToCart(serialProduct)
    } else {
      // Add as uniquely serialized item
      addUniqueItemToCart(serialProduct, {
        serial: serialForm.serial,
        imei: serialForm.imei,
        warrantyMonths: serialForm.warrantyMonths
      })
    }
    
    playTone('tick')
    toast.success(`${serialProduct.name} added to cart`)
    setShowSerialModal(false)
    setSerialProduct(null)
  }

  const handleIncreaseQty = (item) => {
    if (item.isUnique) {
      toast.error('Serialized items must be added individually')
      return
    }
    const stock = Number(item.stock || 0)
    if (item.qty >= stock) {
      toast.error(`${item.name} has only ${stock} in stock`)
      return
    }
    updateQty(item.cartItemId || item.id, item.qty + 1)
  }

  const handleCompleteSale = async (method, cashGiven = 0, change = 0, helaQRResult = null) => {
    const receiptNo = helaQRResult?.receiptNo || generateReceiptNumber()
    const isHelaQR = String(method || '').toLowerCase() === 'helaqr'
    const paymentRef   = isHelaQR ? (helaQRResult?.paymentRef  || receiptNo) : ''
    const qrReference  = isHelaQR ? (helaQRResult?.qrReference || '')        : ''
    const qrData       = isHelaQR ? (helaQRResult?.qrData      || '')        : ''

    // HelaQR: the modal already confirmed payment — no need to re-check
    // Non-HelaQR: proceed as normal
    previewCheckoutState(method)

    const saleData = {
      receiptNo,
      date: new Date(),
      cartItems: cart,
      items: cart.length,
      subtotal,
      discount: discountAmt,
      tax: taxAmt,
      total,
      paymentMethod: method,
      paymentProvider: isHelaQR ? 'helaqr' : method,
      paymentRef,
      qrReference,
      qrData,
      paymentStatus: 'paid',
      change,
      cashier: currentUser?.name || 'Unknown',
      source: activeModule === 'restaurant' ? 'takeout' : activeModule || 'grocery',
      status: 'completed',
    }
    addSale({ ...saleData, items: cart.length })
    useActivityStore.getState().addLog('Completed Sale', `Sale Total: ${formatCurrency(total)} (${cart.length} items)`, currentUser?.name || 'Unknown')

    // Reduce dish stock
    cart.forEach((item) => adjustStock(item.id, -item.qty))

    // If restaurant mode, also deduct ingredients from recipe
    if (activeModule === 'restaurant') {
      const deductIngredients = useRecipeStore.getState().deductIngredients
      cart.forEach((item) => {
        const result = deductIngredients(item.id, item.qty)
        if (!result.success) {
          console.warn(`Failed to deduct ingredients for ${item.name}:`, result.message)
        }
      })
    }

    setLastSale(saleData)
    setShowPayment(false)
    clearCart()
    setSelectedCartItem(null)

    // ── Fire silent auto-print immediately (no modal, no button click) ────────
    setAutoPrintPending(true)

    // ── Customer display: show on customer screen, auto-clear POS side in 3s ─
    const customerPayload = {
      amount: total,
      qrData,
      paymentMethod: method,
      status: 'paid',
      cashGiven,
      change,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: Number(item.qty || 0),
        price: Number(item.salePrice || item.price || 0),
        lineTotal: Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
      })),
      reference: paymentRef,
      title: isHelaQR ? 'HelaQR Payment Successful' : 'Payment Complete',
      subtitle: isHelaQR
        ? 'Payment has been successfully completed.'
        : `Thank you! ${String(method || '').toUpperCase()} payment confirmed.`,
    }
    // Only publish to customer-facing screen — don't block POS owner view
    // Publish to the external customer screen and respect POS visibility
    // settings by routing through `openCustomerScreen` which will only set
    // the POS overlay when `showOnPOS` is enabled.
    openCustomerScreen(customerPayload)
    setTimeout(() => {
      // Always clear the external display; POS overlay cleared inside openCustomerScreen
      clearCustomerDisplay()
      const displaySettings = useAppStore.getState().customerDisplaySettings || {}
      const showOnPOS = displaySettings.showOnPOS !== false
      if (showOnPOS) setCustomerDisplay(null)
    }, 3000)

    playTone('success')
    toast.success(isHelaQR ? `HelaQR Paid: Rs. ${total.toFixed(2)}` : `Sale complete! Rs. ${total.toFixed(2)} — Printing...`, { duration: 3000 })
  }

  // ── Auto-print useEffect: fires whenever autoPrintPending is set true ──────────
  useEffect(() => {
    if (!autoPrintPending || !lastSale) return
    setAutoPrintPending(false)

    // Wait one animation frame so the hidden receipt div has rendered,
    // then perform printing. For card payments we print Customer + Shop
    // copies sequentially with a small delay to avoid driver race/load errors.
    requestAnimationFrame(() => {
      ;(async () => {
        const el = hiddenReceiptRef.current
        if (!el) return
        const content = el.innerHTML
        const method = String(lastSale.paymentMethod || '').toLowerCase()
        const deviceName  = String(hardwareSettings?.printerPort || '').trim()
        const paperWidth  = String(hardwareSettings?.paperWidth  || '80mm').trim()
        const profile     = buildThermalProfile({
          paperWidth,
          printerMode: hardwareSettings?.printerType || 'Raster',
          printerProfile: hardwareSettings?.printerProfile || '',
        })
        const printOpts   = { deviceName, paperWidth: profile.paperWidth, printerMode: profile.printerMode, printerProfile: profile.printerProfile }
        const copyHeader = (label) =>
          `<div style="text-align:center;border:1px dashed #000;padding:4px 6px;margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${label}</div>`

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

        if (method === 'card') {
          try {
            await printReceiptHTML('Receipt - Customer Copy', `${copyHeader('Customer Copy')}${content}`, printOpts)
            await sleep(250)
            await printReceiptHTML('Receipt - Shop Copy', `${copyHeader('Shop Copy')}${content}`, printOpts)
          } catch (e) {
            console.error('[POS] Failed to print copies for card payment', e)
          }
        } else {
          try {
            await printReceiptHTML('Sale Receipt', content, printOpts)
          } catch (e) {
            console.error('[POS] Failed to print receipt', e)
          }
        }
      })()
    })
  }, [autoPrintPending, lastSale])

  useEffect(() => {
    const transactional = ['checkout', 'paying', 'paid'].includes(String(customerDisplay?.status || '').toLowerCase())
    if (transactional) return

    if (cart.length > 0) {
      publishCustomerDisplay({
        status: 'active',
        amount: total,
        paymentMethod: 'cash',
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          qty: Number(item.qty || 0),
          price: Number(item.salePrice || item.price || 0),
          lineTotal: Number(item.salePrice || item.price || 0) * Number(item.qty || 0),
        })),
        title: 'Order in Progress',
        subtitle: 'Items are being added',
      })
      return
    }

    publishCustomerDisplay({
      status: 'idle',
      amount: 0,
      paymentMethod: 'cash',
      items: [],
      title: 'Customer Display',
      subtitle: 'Ready to order',
    })
  }, [cart, total, customerDisplay?.status])

  const moduleProducts = products.filter((p) => p.active && (!p.module || p.module === activeModule))
  const categories = ['All', ...new Set(moduleProducts.map((p) => p.category))]

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#f4f7f5' }}>
      {/* ─── Left: Products ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ background: 'white', borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        >
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-0.5">
            <Barcode size={16} className="shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder={t('pos_scan')}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-gray-700 placeholder:text-gray-400 py-2"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="shrink-0 text-gray-400 hover:text-gray-600 rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-100 transition-colors"
                type="button"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
            <Keyboard size={12} />
            F2 · F5 · Ctrl+Del
          </div>
        </div>

        {/* Category pills */}
        <div
          className="px-4 py-2.5 flex gap-2 overflow-x-auto shrink-0"
          style={{ background: 'white', borderBottom: '1px solid #f0f0f0' }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[36px] active:scale-95',
                activeCategory === cat
                  ? 'bg-green-500 text-white shadow-md shadow-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              )}
            >
              {cat !== 'All' && <CatIcon cat={cat} size={12} />}
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div
              className="grid gap-3 stagger"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}
            >
              {Array.from({ length: 12 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
                <Search size={36} className="text-gray-300" />
              </div>
              <p className="text-gray-600 font-semibold">No products found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search ? 'Try a different search term or barcode' : 'No products in this category'}
              </p>
            </div>
          ) : (
            <div
              className="grid gap-3 stagger"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}
            >
              {filteredProducts.map((p) => {
                const cartQty = cart.find((i) => i.id === p.id)?.qty || 0
                const isExpired = p.expiry && new Date(p.expiry) < new Date()
                return (
                  <button
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    disabled={p.stock === 0 || isExpired}
                    title={isExpired ? `EXPIRED — ${p.expiry}` : undefined}
                    className={cn(
                      'pos-product-btn flex flex-col gap-1.5 relative overflow-hidden text-left',
                      (p.stock === 0 || isExpired) && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {/* Expired overlay */}
                    {isExpired && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl"
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1.5px solid #fca5a5' }}>
                        <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full tracking-wide">
                          ⛔ EXPIRED
                        </span>
                        <span className="text-[9px] text-red-400 mt-0.5">{p.expiry}</span>
                      </div>
                    )}
                    {cartQty > 0 && !isExpired && (
                      <div
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white font-black animate-pop-in"
                        style={{ background: '#16a34a', fontSize: 11, boxShadow: '0 2px 8px rgba(22,163,74,0.4)' }}
                      >
                        {cartQty}
                      </div>
                    )}
                    <div
                      className="w-full h-14 rounded-xl flex items-center justify-center mb-0.5 shrink-0"
                      style={{ background: isExpired ? '#fff1f2' : cartQty > 0 ? 'linear-gradient(135deg,#dcfce7,#f0fdf4)' : '#f8fafb', border: isExpired ? '1px solid #fecaca' : cartQty > 0 ? '1px solid #bbf7d0' : '1px solid transparent' }}
                    >
                      <CatIcon cat={p.category} size={24} className={cn(isExpired ? 'text-red-500' : cartQty > 0 ? 'text-green-600' : 'text-gray-400')} />
                    </div>
                    <p className="text-xs font-semibold text-gray-800 leading-tight truncate-2">{p.name}</p>
                    <div className="flex items-center justify-between mt-auto pt-0.5">
                      <p className="text-base font-black text-green-700">{formatCurrency(p.price)}</p>
                      <span
                        className={cn(
                          'text-[11px] font-bold',
                          isExpired ? 'text-red-500' : p.stock === 0 ? 'text-red-500' : p.stock <= 5 ? 'text-orange-500' : 'text-gray-400'
                        )}
                      >
                        {isExpired ? 'Exp' : p.stock === 0 ? 'Out' : p.stock <= 5 ? `Low:${p.stock}` : `${p.stock}`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Cart ─── */}
      <div
        className="flex flex-col shrink-0"
        style={{
          width: 360,
          background: 'white',
          borderLeft: '1px solid #f0f0f0',
          boxShadow: '-6px 0 24px rgba(0,0,0,0.04)',
        }}
      >
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <ShoppingBag size={16} className="text-green-600" />
            </div>
            <span className="font-bold text-gray-900 text-sm">{t('pos_current_sale')}</span>
            {cart.length > 0 && (
              <span className="badge badge-green text-xs badge-pulse">{cart.reduce((s, i) => s + i.qty, 0)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {heldTransactions.length > 0 && (
              <button
                onClick={() => { resumeTransaction(heldTransactions[0].id); toast.info('Transaction resumed') }}
                className="btn-ghost py-1.5 px-2.5 text-xs"
                title={`Resume held transaction (${heldTransactions.length})`}
              >
                <Play size={13} />
                <span>{heldTransactions.length}</span>
              </button>
            )}
            <button
              onClick={() => { holdTransaction(); toast.info('Transaction held') }}
              disabled={cart.length === 0}
              className="btn-ghost py-1.5 px-2.5 text-xs"
              title="Hold transaction"
            >
              <Pause size={13} />
            </button>
            <button
              onClick={() => { clearCart(); setSelectedCartItem(null); toast.warning('Cart cleared') }}
              disabled={cart.length === 0}
              className="btn-danger py-1.5 px-2.5 text-xs"
              title="Clear cart (Ctrl+Delete)"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-gray-100 bg-white">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Active Cashier</p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <User size={13} />
            </div>
            <p className="text-xs font-semibold text-gray-700">{currentUser?.name || currentUser?.username || 'Unknown'}</p>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
            <Barcode size={10} /> Scan cashier badge anytime — no need to click anything.
          </p>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mb-4">
                <ShoppingBag size={36} className="text-gray-200" />
              </div>
              <p className="text-gray-500 font-semibold text-sm">Cart is empty</p>
              <p className="text-xs text-gray-300 mt-1">Click a product or scan a barcode</p>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {cart.map((item, idx) => (
                <div key={item.id}>
                  <div
                    className={cn(
                      'cart-item-row cursor-pointer',
                      selectedCartItem === (item.cartItemId || item.id) && 'border-green-400 bg-green-50'
                    )}
                    onClick={() => setSelectedCartItem(selectedCartItem === (item.cartItemId || item.id) ? null : (item.cartItemId || item.id))}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: selectedCartItem === (item.cartItemId || item.id) ? '#dcfce7' : '#f8fafb' }}
                    >
                      <CatIcon cat={item.category} size={18} className={selectedCartItem === (item.cartItemId || item.id) ? 'text-green-600' : 'text-gray-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                      {item.isUnique && (
                        <p className="text-[10px] text-gray-500 mt-0.5 flex gap-2">
                          {item.serial && <span>S/N: <span className="font-mono text-gray-700">{item.serial}</span></span>}
                          {item.imei && <span>IMEI: <span className="font-mono text-gray-700">{item.imei}</span></span>}
                          {item.warrantyMonths > 0 && <span className="text-blue-600 flex items-center gap-0.5"><ShieldCheck size={10} />{item.warrantyMonths}m Warranty</span>}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(item.salePrice)} × {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateQty(item.cartItemId || item.id, item.qty - 1) }}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-100 text-red-400 transition-all active:scale-90 border border-red-100"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-7 text-center text-sm font-black text-gray-800">{item.qty}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleIncreaseQty(item) }}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-green-100 text-green-600 transition-all active:scale-90 border border-green-100"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <p className="text-sm font-black text-green-700 w-20 text-right shrink-0">
                      {formatCurrency(item.salePrice * item.qty)}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartItemId || item.id); if (selectedCartItem === (item.cartItemId || item.id)) setSelectedCartItem(null) }}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-100 transition-all active:scale-90"
                      title="Remove item from cart"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {idx < cart.length - 1 && (
                    <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#f0f0f0,transparent)', margin: '0 8px' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Payment */}
        <div className="border-t border-gray-100 p-4" style={{ background: '#fafafa' }}>
          {/* Discount row */}
          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Tag size={12} className="text-orange-500" />
            </div>
            <span className="text-xs text-gray-500 flex-1 font-medium">{t('pos_discount')}</span>
            <div className="flex items-center gap-1.5">
              <select
                value={discountType}
                onChange={(e) => setDiscount(discount, e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 outline-none bg-white font-semibold text-gray-600 focus:border-green-400 cursor-pointer"
              >
                <option value="percent">%</option>
                <option value="fixed">Rs.</option>
              </select>
              <input
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0, discountType)}
                className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-green-400 bg-white font-semibold"
                placeholder="0"
                style={{ minHeight: '32px' }}
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-1.5 mb-3 text-sm px-1">
            <div className="flex justify-between text-gray-500">
              <span>{t('pos_subtotal')}</span>
              <span className="font-semibold text-gray-700">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-red-500 font-semibold">
                <span>{t('pos_discount')}</span>
                <span>− {formatCurrency(discountAmt)}</span>
              </div>
            )}
            {taxEnabled && (
              <div className="flex justify-between text-gray-500">
                <span>{taxName} ({taxRate}%)</span>
                <span>{formatCurrency(taxAmt)}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f0f0f0', marginBottom: 12 }} />

          {/* Total */}
          <div
            className="flex justify-between items-center px-4 py-3.5 rounded-2xl mb-3 transition-all"
            style={{ background: cart.length ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : '#f9fafb', border: cart.length ? '1px solid #bbf7d0' : '1px solid #f0f0f0' }}
          >
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total</span>
            </div>
            <span className={cn('font-black leading-none', cart.length ? 'text-green-700' : 'text-gray-300')} style={{ fontSize: 28 }}>
              {formatCurrency(total)}
            </span>
          </div>

          {/* Quick payment buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { id: 'cash',  label: t('pos_cash'),  icon: Banknote,  style: cart.length ? { borderColor: '#4ade80', background: '#f0fdf4', color: '#16a34a' } : {} },
              { id: 'card',  label: t('pos_card'),  icon: CreditCard, style: cart.length ? { borderColor: '#60a5fa', background: '#eff6ff', color: '#2563eb' } : {} },
              { id: 'split', label: t('pos_split'), icon: Split,       style: cart.length ? { borderColor: '#c084fc', background: '#faf5ff', color: '#7c3aed' } : {} },
              { id: 'helaqr', label: 'HelaQR', icon: Zap,             style: cart.length ? { borderColor: '#f59e0b', background: '#fffbeb', color: '#b45309' } : {} },
            ].map(({ id, label, icon: Icon, style }) => (
              <button
                key={id}
                onClick={() => { if (!cart.length) return; setPaymentInitMethod(id); setShowPayment(true) }}
                disabled={!cart.length}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all active:scale-95',
                  cart.length ? 'hover:opacity-90' : 'border-gray-100 text-gray-300 cursor-not-allowed'
                )}
                style={cart.length ? style : {}}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>

          {/* Main charge button */}
          <button
            onClick={() => { if (cart.length > 0) { setPaymentInitMethod('cash'); setShowPayment(true) } }}
            disabled={!cart.length}
            className="btn-primary w-full justify-center text-base"
            style={{ borderRadius: 14, height: 52, fontSize: 15, opacity: cart.length ? 1 : 0.4 }}
          >
            <Receipt size={18} />
            {t('pos_charge')} · F5
          </button>
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        initialMethod={paymentInitMethod}
        onCheckout={previewCheckoutState}
        onComplete={handleCompleteSale}
        onPublishCustomerDisplay={openCustomerScreen}
        cartItems={cart}
      />
      <Modal open={showSerialModal} onClose={() => setShowSerialModal(false)} title={`Provide Details: ${serialProduct?.name}`}>
        <form onSubmit={handleSerialSubmit} className="flex flex-col gap-4 pt-2">
          <datalist id={`serials-${serialProduct?.id}`}>
            {availableSerials.filter(s => s.serial).map(s => <option key={`sn-${s.id}`} value={s.serial} />)}
          </datalist>
          <datalist id={`imeis-${serialProduct?.id}`}>
            {availableSerials.filter(s => s.imei).map(s => <option key={`im-${s.id}`} value={s.imei} />)}
          </datalist>
          <Input 
            label="Serial Number" 
            value={serialForm.serial} 
            onChange={(e) => setSerialForm(s => ({ ...s, serial: e.target.value }))}
            placeholder="Scan or enter S/N"
            list={`serials-${serialProduct?.id}`}
            autoFocus
          />
          <Input 
            label="IMEI (Mobile Devices)" 
            value={serialForm.imei} 
            onChange={(e) => setSerialForm(s => ({ ...s, imei: e.target.value }))}
            placeholder="Scan or enter IMEI"
            list={`imeis-${serialProduct?.id}`}
          />
          <Input 
            label="Warranty Period (Months)" 
            type="number"
            value={serialForm.warrantyMonths} 
            onChange={(e) => setSerialForm(s => ({ ...s, warrantyMonths: parseInt(e.target.value) || 0 }))}
          />
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1 justify-center">
              {serialForm.serial || serialForm.imei ? 'Add with Serial' : 'Skip & Add Normally'}
            </button>
            <button type="button" className="btn-ghost flex-1 justify-center" onClick={() => setShowSerialModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
      {/* Hidden offscreen receipt div for auto-printing (never shown on screen) */}
      <div style={{ position: 'fixed', left: -9999, top: -9999, width: 280, pointerEvents: 'none', opacity: 0, overflow: 'hidden', zIndex: -1 }}>
        <div ref={hiddenReceiptRef}>
          {lastSale && (
            <ReceiptContent
              sale={lastSale}
              businessInfo={businessInfo}
              receiptSettings={receiptSettings}
            />
          )}
        </div>
      </div>
      {/* Receipt modal — only shown when user manually clicks reprint */}
      {showReceipt && lastSale && (
        <ReceiptModal
          sale={lastSale}
          businessInfo={businessInfo}
          onClose={() => setShowReceipt(false)}
        />
      )}
      <CustomerDisplay
        open={Boolean(customerDisplay)}
        amount={customerDisplay?.amount}
        qrData={customerDisplay?.qrData}
        paymentMethod={customerDisplay?.paymentMethod}
        status={customerDisplay?.status}
        items={customerDisplay?.items}
        cashGiven={customerDisplay?.cashGiven}
        change={customerDisplay?.change}
        reference={customerDisplay?.reference}
        title={customerDisplay?.title}
        subtitle={customerDisplay?.subtitle}
        onAutoReset={closeCustomerScreen}
        onClose={closeCustomerScreen}
      />
    </div>
  )
}

