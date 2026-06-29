import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Edit2, Trash2, Package, Upload, Download, Barcode, ToggleLeft, ToggleRight, AlertTriangle, Search, Loader2, CheckCircle2, Globe } from 'lucide-react'
import { useProductStore, useAppStore, useActivityStore, useAuthStore } from '@/store'
import { useToast } from '@/components/Toast'
import { Button, Badge, Modal, Input, Select, SectionHeader, SearchInput, EmptyState } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { publishStoreProductDelete, publishStoreProductUpsert, resolveCloudTenantId, syncToCloud } from '@/lib/firebase'
import Papa from 'papaparse'

const PRODUCT_FORM_DEFAULT = {
  name: '', barcode: '', price: '', cost: '', category: '',
  stock: '', unit: 'pcs', expiry: '', active: true,
  supplier: '', brand: '', sizes: '', colors: '',
  warrantyMonths: 0, requiresSerial: true
}

const RESTAURANT_KEYWORDS = [
  'kottu', 'rice', 'pizza', 'burger', 'roti', 'naan', 'curry', 'dosa', 'noodle',
  'pasta', 'sandwich', 'salad', 'mains', 'starters', 'drinks', 'desserts', 'soup', 'shawarma',
]

const inferProductModule = (activeModule, form) => {
  const active = String(activeModule || '').trim().toLowerCase()
  const name = String(form?.name || '').trim().toLowerCase()
  const category = String(form?.category || '').trim().toLowerCase()

  if (active === 'restaurant') return 'restaurant'

  const matchesRestaurant = RESTAURANT_KEYWORDS.some((keyword) => name.includes(keyword) || category.includes(keyword))
  if (matchesRestaurant) return 'restaurant'

  return activeModule || 'grocery'
}

// ─── Barcode display (visual) ──────────────────────────────────────────────────
function BarcodeDisplay({ value }) {
  if (!value) return null
  return (
    <div className="text-center p-3 bg-gray-50 rounded-xl">
      <div className="flex justify-center gap-0.5 mb-2">
        {String(value).split('').flatMap((c, i) => {
          const num = c.charCodeAt(0) % 7
          return [
            <div key={`${i}a`} style={{ width: num % 2 === 0 ? 2 : 3, height: 50, background: '#111', marginRight: 1 }} />,
          ]
        })}
      </div>
      <span className="font-mono text-xs tracking-widest text-gray-700">{value}</span>
    </div>
  )
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

function ProductForm({ initial = PRODUCT_FORM_DEFAULT, onSave, onCancel, categories = [], activeModule }) {
  // Defensive fallbacks in case initial is null/undefined
  const safeInitial = initial || PRODUCT_FORM_DEFAULT
  const [form, setForm] = useState({ ...PRODUCT_FORM_DEFAULT, ...safeInitial })
  const [batchMode, setBatchMode] = useState(false)
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const initialUnit = safeInitial.unit || 'pcs'
  const isCustomUnit = !['pcs', 'kg', 'g', 'L', 'bottle', 'pack', 'box'].includes(initialUnit) && initialUnit !== 'pcs'
  const [otherUnitOpen, setOtherUnitOpen] = useState(isCustomUnit)
  const [otherUnitVal, setOtherUnitVal] = useState(isCustomUnit ? initialUnit : '')

  const barcodeInputRef = useRef(null)
  const nameInputRef = useRef(null)
  const priceInputRef = useRef(null)
  const { addCategory } = useProductStore()
  const toast = useToast()

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const priceVal = parseFloat(form.price) || 0
  const costVal = parseFloat(form.cost) || 0
  const profit = priceVal - costVal
  const margin = costVal > 0
    ? ((priceVal - costVal) / costVal * 100).toFixed(1)
    : null

  // ── Global Barcode Lookup ─────────────────────────────────────────────────
  const [lookupState, setLookupState] = useState('idle') // idle | loading | found | not_found
  const [lookupSource, setLookupSource] = useState('')

  const lookupBarcode = async (barcode) => {
    const code = String(barcode || '').trim()
    if (code.length < 6) return
    setLookupState('loading')
    setLookupSource('')
    try {
      let result = null

      // ── Electron: route through main process (no CORS) ──────────────────
      if (typeof window !== 'undefined' && window.require) {
        const { ipcRenderer } = window.require('electron')
        result = await ipcRenderer.invoke('barcode-lookup', { barcode: code })
      } else {
        // ── Browser fallback: Open Food Facts + UPCitemdb ─────────────────
        const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))

        // Source 1: Open Food Facts (food/grocery)
        try {
          const offRes = await Promise.race([
            fetch(
              `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,brands,categories_tags,quantity`,
              { headers: { 'User-Agent': 'PaxxmoPOS/1.0 - pos@paxxmo.app' } }
            ),
            timeout(5000),
          ])
          if (offRes.ok) {
            const offData = await offRes.json()
            if (offData.status === 1 && offData.product?.product_name) {
              const p = offData.product
              const name = [p.brands, p.product_name, p.quantity].filter(Boolean).join(' ').trim()
              const rawCat = (p.categories_tags || []).find(c => !c.includes(':')) ||
                (p.categories_tags || [])[0]?.replace(/^[a-z]{2}:/, '') || ''
              const cat = rawCat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
              result = { found: true, name, category: cat, source: 'Open Food Facts' }
            }
          }
        } catch (_) {}

        // Source 2: UPC Item DB (retail, non-food products)
        if (!result) {
          try {
            const upcRes = await Promise.race([
              fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`),
              timeout(4000),
            ])
            if (upcRes.ok) {
              const upcData = await upcRes.json()
              const item = (upcData.items || [])[0]
              if (item && item.title) {
                const name = [item.brand, item.title].filter(Boolean).join(' ').trim()
                result = { found: true, name, category: item.category || '', source: 'UPC Item DB' }
              }
            }
          } catch (_) {}
        }

        if (!result) result = { found: false }
      }

      if (result?.found && result.name) {
        setForm(f => ({ ...f, name: result.name || f.name, category: result.category || f.category }))
        setLookupState('found')
        setLookupSource(result.source || 'Global DB')
        toast.success(`✅ Found: ${result.name}`, { duration: 2000 })
      } else {
        setLookupState('not_found')
        toast.info('Barcode not found in global database — enter details manually', { duration: 3000 })
      }
    } catch (err) {
      setLookupState('not_found')
      console.warn('[BarcodeDB]', err)
    }
  }

  // Auto-trigger lookup when barcode looks complete (8+ digits, real EAN/UPC)
  const lookupTimerRef = useRef(null)
  useEffect(() => {
    const code = String(form.barcode || '').trim()
    const looksReal = /^[0-9]{8,14}$/.test(code)
    if (looksReal && lookupState === 'idle') {
      clearTimeout(lookupTimerRef.current)
      lookupTimerRef.current = setTimeout(() => lookupBarcode(code), 600)
    }
    if (!looksReal) {
      setLookupState('idle')
      setLookupSource('')
    }
    return () => clearTimeout(lookupTimerRef.current)
  }, [form.barcode])

  useEffect(() => {
    // Auto-focus barcode field first for fast scan-to-add workflow
    setTimeout(() => {
      barcodeInputRef.current?.focus()
    }, 100)
  }, [])

  const generateRandomBarcode = () => {
    const randomCode = '99' + Math.floor(1000000000 + Math.random() * 9000000000)
    set('barcode', randomCode)
    playTone('success')
    toast.success(`Generated Barcode: ${randomCode}`, { duration: 1500 })
  }

  const handleInlineAddCategory = () => {
    const val = String(newCatName || '').trim()
    if (!val) return
    addCategory(activeModule, val)
    set('category', val)
    setNewCatName('')
    setNewCatOpen(false)
    toast.success(`Category "${val}" created inline!`, { duration: 1500 })
  }

  const handleSubmitForm = (e, forceKeepOpen = false) => {
    if (e) e.preventDefault()
    if (!form.name.trim()) return

    const keepOpen = batchMode || forceKeepOpen
    onSave(form, keepOpen)

    if (keepOpen) {
      playTone('success')
      setLookupState('idle')
      setLookupSource('')
      setForm((f) => ({
        ...PRODUCT_FORM_DEFAULT,
        category: f.category,
        brand: f.brand,
        supplier: f.supplier,
        unit: f.unit,
        active: true,
      }))
      setOtherUnitVal('')
      setOtherUnitOpen(false)

      // Return focus to barcode field for ultra-fast scan-and-add workflow
      setTimeout(() => {
        barcodeInputRef.current?.focus()
      }, 50)
    }
  }

  const commonUnits = ['pcs', 'kg', 'g', 'L', 'bottle', 'pack', 'box']

  return (
    <form onSubmit={(e) => handleSubmitForm(e)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Left Side: Product Fields Form */}
        <div className="md:col-span-3 space-y-4 max-h-[66vh] overflow-y-auto pr-1">
          {/* Card: Basic Details */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Package size={14} className="text-green-500" /> Basic Details
              <span className="ml-auto text-[10px] font-normal text-gray-300 normal-case tracking-normal">Scan barcode first → name auto-fills</span>
            </h3>

            {/* ── BARCODE FIRST — primary entry point for fast scan workflow ─── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Barcode size={12} className="text-blue-500" /> Barcode
                  <span className="text-[9px] font-semibold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">SCAN FIRST</span>
                </label>
                {lookupState === 'found' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> {lookupSource}
                  </span>
                )}
                {lookupState === 'loading' && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500">
                    <Loader2 size={10} className="animate-spin" /> Searching global DB...
                  </span>
                )}
                {lookupState === 'not_found' && (
                  <span className="text-[10px] font-bold text-amber-500">Not in global DB — enter manually</span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={form.barcode}
                    onChange={(e) => { set('barcode', e.target.value); setLookupState('idle') }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        // After scanning barcode, move to name field
                        nameInputRef.current?.focus()
                      }
                    }}
                    placeholder="Scan barcode or type — name auto-fills!"
                    className={`input-base w-full text-sm font-mono font-semibold pr-8 transition-all ${
                      lookupState === 'found' ? 'border-green-400 bg-green-50' :
                      lookupState === 'loading' ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                    autoComplete="off"
                  />
                  {lookupState === 'loading' && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Loader2 size={14} className="text-blue-500 animate-spin" />
                    </div>
                  )}
                  {lookupState === 'found' && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <CheckCircle2 size={14} className="text-green-500" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => lookupBarcode(form.barcode)}
                  disabled={!form.barcode || lookupState === 'loading'}
                  title="Look up product name from global barcode database"
                  className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center transition-all hover:bg-blue-100 hover:border-blue-300 active:scale-95 shrink-0 disabled:opacity-40"
                >
                  {lookupState === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Globe size={18} />}
                </button>
                <button
                  type="button"
                  onClick={generateRandomBarcode}
                  title="Auto-generate Random Barcode"
                  className="w-11 h-11 rounded-xl bg-green-50 text-green-600 border border-green-200 flex items-center justify-center transition-all hover:bg-green-100 hover:border-green-300 active:scale-95 shrink-0"
                >
                  <Barcode size={18} />
                </button>
              </div>
              {lookupState === 'found' && (
                <p className="text-[10px] text-green-600 font-semibold mt-1 flex items-center gap-1">
                  <Globe size={9} /> Auto-filled from {lookupSource} — verify price &amp; stock below
                </p>
              )}
            </div>

            {/* ── PRODUCT NAME — second field, auto-filled by barcode lookup ─── */}
            <Input
              ref={nameInputRef}
              label="Product Name *"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  priceInputRef.current?.focus()
                }
              }}
              required
              placeholder="e.g. Basmati Rice 5kg"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</label>
                <button
                  type="button"
                  onClick={() => setNewCatOpen(!newCatOpen)}
                  className="text-xs font-bold text-green-600 hover:underline hover:text-green-700 flex items-center gap-0.5"
                >
                  {newCatOpen ? 'Cancel' : '+ Create New'}
                </button>
              </div>

              {newCatOpen ? (
                <div className="flex gap-2 animate-slide-up">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Grains"
                    className="input-base flex-1 min-w-0 text-sm font-semibold"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInlineAddCategory())}
                  />
                  <button
                    type="button"
                    onClick={handleInlineAddCategory}
                    className="btn-primary py-1 px-3 text-xs shrink-0"
                    disabled={!newCatName.trim()}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <Select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              )}
            </div>
          </div>

          {/* Card: Pricing & Stock */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="text-green-500 font-bold">Rs.</span> Pricing & Stock
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                ref={priceInputRef}
                label="Selling Price (Rs.) *"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                required
                placeholder="0.00"
              />
              <Input
                label="Cost Price (Rs.)"
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Opening Stock"
                type="number"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
                placeholder="0"
              />
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Unit</label>
                {otherUnitOpen ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otherUnitVal}
                      onChange={(e) => {
                        setOtherUnitVal(e.target.value)
                        set('unit', e.target.value)
                      }}
                      placeholder="e.g. meter"
                      className="input-base flex-1 min-w-0 text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOtherUnitOpen(false)
                        set('unit', 'pcs')
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 hover:underline shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5 flex-wrap">
                    {commonUnits.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => set('unit', u)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 min-h-[34px]',
                          form.unit === u
                            ? 'bg-green-500 border-green-500 text-white shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        )}
                      >
                        {u}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOtherUnitOpen(true)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-xl text-xs font-bold border border-dashed transition-all active:scale-95 min-h-[34px]',
                        !commonUnits.includes(form.unit) && form.unit
                          ? 'bg-green-500 border-green-500 text-white shadow-sm'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      {!commonUnits.includes(form.unit) && form.unit ? form.unit : 'Other...'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1">
              <Input
                label="Supplier (Source of Stock)"
                value={form.supplier}
                onChange={(e) => set('supplier', e.target.value)}
                placeholder="e.g. Acme Corp, Local Distributor..."
              />
            </div>
          </div>

          {/* Card: Tracking & Details */}
          {(form.expiry || activeModule === 'pharmacy' || activeModule === 'clothing' || activeModule === 'electronics') && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                ⚙️ Advanced Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Expiry Date"
                  type="date"
                  value={form.expiry}
                  onChange={(e) => set('expiry', e.target.value)}
                />



                {activeModule === 'clothing' && (
                  <>
                    <Input
                      label="Brand"
                      value={form.brand}
                      onChange={(e) => set('brand', e.target.value)}
                      placeholder="e.g. DenimCo"
                    />
                    <Input
                      label="Sizes (comma separated)"
                      value={form.sizes}
                      onChange={(e) => set('sizes', e.target.value)}
                      placeholder="e.g. S, M, L, XL"
                    />
                    <Input
                      label="Colors (comma separated)"
                      value={form.colors}
                      onChange={(e) => set('colors', e.target.value)}
                      placeholder="e.g. Black, White"
                      className="col-span-2"
                    />
                  </>
                )}

                {activeModule === 'electronics' && (
                  <>
                    <Input
                      label="Brand"
                      value={form.brand}
                      onChange={(e) => set('brand', e.target.value)}
                      placeholder="e.g. Samsung, Apple"
                    />
                    <Input
                      label="Warranty Period (Months)"
                      type="number"
                      value={form.warrantyMonths || ''}
                      onChange={(e) => set('warrantyMonths', parseInt(e.target.value) || 0)}
                      placeholder="e.g. 12"
                    />
                    <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-900">
                        <input
                          type="checkbox"
                          checked={!!form.requiresSerial}
                          onChange={(e) => set('requiresSerial', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        This product requires Serial / IMEI tracking
                      </label>
                      <p className="text-xs text-blue-600 mt-1 pl-6">
                        Required during stock checkouts and GRN receiving.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Active status & switch */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-150">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Status</label>
              <button
                type="button"
                onClick={() => set('active', !form.active)}
                className={cn('transition-colors', form.active ? 'text-green-600' : 'text-gray-400')}
              >
                {form.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
              <span className="text-sm font-bold text-gray-600">{form.active ? 'Visible in POS' : 'Hidden from POS'}</span>
            </div>

            {/* Batch Mode toggle inside form */}
            {!safeInitial?.id && (
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-3.5 py-2 rounded-xl hover:bg-green-100 transition-all select-none">
                <input
                  type="checkbox"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                  className="w-4 h-4 text-green-600 rounded cursor-pointer"
                />
                ⚡ Batch Quick-Add Mode
              </label>
            )}
          </div>
        </div>

        {/* Right Side: Live preview & profit analyzer */}
        <div className="md:col-span-2 flex flex-col gap-4 justify-between h-full">
          {/* Dynamic Profit Margin Widget */}
          <div className="rounded-2xl border border-gray-150 p-4 bg-white shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gross Profit Analyzer</h4>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-500">Margin Breakdown:</span>
              {margin !== null ? (
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  parseFloat(margin) >= 30 ? 'bg-green-50 text-green-700 border border-green-200' :
                  parseFloat(margin) > 0 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                )}>
                  {parseFloat(margin) >= 30 ? '🔥 High Margin' :
                   parseFloat(margin) > 0 ? '👍 Safe Margin' : '⚠️ No Profit'}
                </span>
              ) : <span className="text-xs text-gray-300">Enter cost & price</span>}
            </div>

            <div className="p-3.5 rounded-xl border border-dashed" style={{
              background: margin !== null && parseFloat(margin) < 0 ? '#fef2f2' :
                          margin !== null && parseFloat(margin) >= 30 ? '#f0fdf4' : '#fafafa',
              borderColor: margin !== null && parseFloat(margin) < 0 ? '#fecaca' :
                           margin !== null && parseFloat(margin) >= 30 ? '#bbf7d0' : '#e5e7eb'
            }}>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Gross Profit</p>
                  <p className={cn('text-lg font-black', profit < 0 ? 'text-red-600' : 'text-green-700')}>
                    Rs. {profit.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Margin %</p>
                  <p className={cn('text-lg font-black', profit < 0 ? 'text-red-600' : 'text-green-700')}>
                    {margin !== null ? `${margin}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Realistic Barcode Label Thermal Preview */}
          <div className="rounded-2xl border border-gray-150 p-4 bg-white shadow-sm flex flex-col justify-between flex-1 min-h-[220px]">
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Barcode Label Preview</h4>
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-sm hover:scale-[1.02] transition-all" style={{ minHeight: 160 }}>
                {/* Dotted cut marker */}
                <div className="absolute top-0 bottom-0 left-0 right-0 border border-dotted border-gray-200 rounded-[14px] pointer-events-none" />
                
                <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">
                  PAXXMO STORE LABEL
                </span>
                
                <p className="text-sm font-extrabold text-gray-800 text-center max-w-[200px] truncate mb-0.5">
                  {form.name || 'Unnamed Product'}
                </p>
                <p className="text-xs text-gray-500 font-bold mb-3">
                  Unit: {form.unit || 'pcs'}
                </p>

                {/* Simulated Barcode */}
                <div className="w-full max-w-[170px] mb-2 flex flex-col items-center">
                  <div className="flex justify-center w-full gap-0.5 h-10 overflow-hidden">
                    {String(form.barcode || 'SCANNER').split('').flatMap((c, i) => {
                      const num = c.charCodeAt(0) % 7
                      return [
                        <div key={`${i}p`} className="bg-gray-800" style={{ width: num % 2 === 0 ? 1 : 2, height: '100%', marginRight: 0.5, backgroundColor: '#1f2937' }} />,
                      ]
                    })}
                  </div>
                  <span className="font-mono text-[9px] tracking-[0.2em] font-semibold text-gray-500 mt-1">
                    {String(form.barcode || 'NO-BARCODE')}
                  </span>
                </div>

                <div className="text-lg font-black text-gray-800 tracking-tight mt-1">
                  Rs. {priceVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              Standard 50mm x 30mm thermal label size.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100 mt-2">
        <button type="submit" className="btn-primary flex-1 justify-center py-3 text-sm font-bold rounded-xl min-h-[46px]">
          {safeInitial?.id ? 'Save Changes' : 'Add Product'}
        </button>
        {!safeInitial?.id && (
          <button
            type="button"
            className="btn-secondary py-3 text-sm font-bold rounded-xl min-h-[46px]"
            onClick={() => handleSubmitForm(null, true)}
            disabled={!form.name.trim()}
          >
            ⚡ Save & Add Another
          </button>
        )}
        <button type="button" className="btn-ghost py-3 text-sm font-bold rounded-xl min-h-[46px]" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// ─── CSV Import Modal ──────────────────────────────────────────────────────────
function ImportModal({ open, onClose, categories, activeModule }) {
  const { addProduct, addCategory } = useProductStore()
  const toast = useToast()
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => setPreview(data.slice(0, 10)),
    })
  }

  const handleImport = async () => {
    if (!preview.length) { toast.error('No valid data to import'); return }
    setImporting(true)
    let count = 0
    for (const row of preview) {
      if (!row.name) continue
      if (row.category && !categories.includes(row.category)) addCategory(activeModule, row.category)
      const resolvedModule = inferProductModule(activeModule, row)
      const now = new Date().toISOString()
      const product = {
        module: resolvedModule,
        name: row.name || '',
        barcode: row.barcode || '',
        price: parseFloat(row.price) || 0,
        cost: parseFloat(row.cost) || 0,
        category: row.category || '',
        stock: parseInt(row.stock) || 0,
        unit: row.unit || 'pcs',
        expiry: row.expiry || null,
        active: row.active !== 'false',
        variants: [],
        image: null,
        createdAt: now,
        updatedAt: now,
      }
      addProduct(product)
      await publishStoreProductUpsert(product)
      count++
    }
    await syncToCloud()
    toast.success(`Imported ${count} products successfully!`)
    setImporting(false)
    setPreview([])
    onClose()
  }

  const downloadTemplate = () => {
    const csv = 'name,barcode,price,cost,category,stock,unit,expiry\nEgg 1 Dozen,1234567890,350,280,Groceries,50,pack,\nMilk 1L,9876543210,280,230,Dairy,20,bottle,2026-12-31\n'
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'paxxmo-import-template.csv',
    })
    a.click()
    toast.success('Template downloaded!')
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Products from CSV" maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
          <p className="font-semibold mb-1">CSV Format Required:</p>
          <p className="font-mono text-xs">name, barcode, price, cost, category, stock, unit, expiry</p>
        </div>
        <div className="flex gap-3">
          <button onClick={downloadTemplate} className="btn-secondary">
            <Download size={14} /> Download Template
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-primary">
            <Upload size={14} /> Choose CSV File
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        {preview.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Preview ({preview.length} rows):</p>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Name</th><th>Barcode</th><th>Price</th><th>Category</th><th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td>{row.name}</td>
                      <td className="font-mono text-xs">{row.barcode}</td>
                      <td>Rs. {row.price}</td>
                      <td>{row.category}</td>
                      <td>{row.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleImport} disabled={importing} className="btn-primary flex-1 justify-center">
                Import {preview.length} Products
              </button>
              <button onClick={() => setPreview([])} className="btn-ghost">Reset</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function CategoryManagerModal({ open, onClose, moduleName }) {
  const { getCategoriesForModule, addCategory, removeCategory, products } = useProductStore()
  const { addLog } = useActivityStore()
  const { currentUser } = useAuthStore()
  const toast = useToast()
  const [categoryName, setCategoryName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = getCategoriesForModule(moduleName)

  const handleAdd = () => {
    const value = String(categoryName || '').trim()
    if (!value) return
    addCategory(moduleName, value)
    addLog('Added Category', `${moduleName}: ${value}`, currentUser?.name)
    toast.success(`Category "${value}" added`)
    setCategoryName('')
  }

  const handleRemove = (value) => {
    const count = products.filter(p => p.category === value && p.module === moduleName).length
    if (count > 0) {
      toast.error(`Cannot remove: "${value}" has ${count} products assigned. Reassign them first.`, { duration: 4000 })
      return
    }
    removeCategory(moduleName, value)
    addLog('Removed Category', `${moduleName}: ${value}`, currentUser?.name)
    toast.success(`Category "${value}" removed`)
  }

  const filteredCategories = categories.filter(c =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const moduleProducts = products.filter(p => p.module === moduleName)

  return (
    <Modal open={open} onClose={onClose} title={`Manage ${String(moduleName || '').toUpperCase()} Categories`} maxWidth="max-w-2xl">
      <div className="space-y-4 animate-scale-in">
        {/* Quick Add Row */}
        <div className="rounded-2xl border border-gray-150 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Create New Category</p>
          <div className="flex gap-2">
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Organic Grains"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" className="btn-primary shrink-0" onClick={handleAdd} disabled={!String(categoryName || '').trim()}>
              <Plus size={14} /> Add Category
            </button>
          </div>
        </div>

        {/* Stats & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500">
            Total Categories: <span className="font-bold text-gray-700">{categories.length}</span> · Assigned Products: <span className="font-bold text-gray-700">{moduleProducts.length}</span>
          </div>
          <div className="w-full sm:w-60">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
            />
          </div>
        </div>

        {/* Category List Grid */}
        <div className="grid gap-2 sm:grid-cols-2 max-h-[300px] overflow-y-auto pr-1">
          {filteredCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 sm:col-span-2">
              {searchQuery ? 'No categories match your search.' : 'No categories defined yet.'}
            </div>
          ) : (
            filteredCategories.map((category) => {
              const productCount = products.filter(p => p.category === category && p.module === moduleName).length
              return (
                <div key={category} className="flex items-center justify-between rounded-2xl border border-gray-150 bg-white p-3 hover:border-green-300 transition-all group">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{category}</p>
                    <p className="text-xs text-gray-400 font-semibold">{productCount} {productCount === 1 ? 'product' : 'products'}</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all px-2.5 py-1.5 rounded-lg hover:bg-red-50"
                    onClick={() => handleRemove(category)}
                  >
                    Remove
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Export to CSV ─────────────────────────────────────────────────────────────
const exportCSV = (products) => {
  const rows = [
    ['name', 'barcode', 'price', 'cost', 'category', 'stock', 'unit', 'expiry'],
    ...products.map((p) => [p.name, p.barcode || '', p.price, p.cost || '', p.category || '', p.stock, p.unit, p.expiry || '']),
  ]
  const csv = rows.map((r) => r.join(',')).join('\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: 'products-export.csv',
  })
  a.click()
}

export default function Products() {
  const { products, categories, getCategoriesForModule, addProduct, updateProduct, deleteProduct } = useProductStore()
  const { activeModule, businessInfo, licenseKey } = useAppStore()
  const { addLog } = useActivityStore()
  const { currentUser } = useAuthStore()
  const toast = useToast()
  const currentStoreId = resolveCloudTenantId(businessInfo, licenseKey)
  
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const moduleCategories = useMemo(() => getCategoriesForModule(activeModule), [getCategoriesForModule, activeModule])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      // Strict module isolation: must match the exact module natively via global state
      const matchM = p.module === activeModule || (!p.module && activeModule === 'grocery')
      const matchS = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
      const matchC = catFilter === 'All' || p.category === catFilter
      return matchS && matchC && matchM
    })
  }, [products, search, catFilter, activeModule])

  const handleSave = async (form, keepOpen) => {
    if (editProduct) {
      const resolvedModule = inferProductModule(activeModule, form)
      const now = new Date().toISOString()
      const updatedProduct = {
        ...editProduct,
        ...form,
        storeId: editProduct.storeId || currentStoreId,
        module: resolvedModule,
        price: parseFloat(form.price) || 0,
        cost: parseFloat(form.cost) || 0,
        stock: parseInt(form.stock) || 0,
        updatedAt: now,
      }
      updateProduct(editProduct.id, updatedProduct)
      await publishStoreProductUpsert(updatedProduct)
      addLog('Edited Product', form.name, currentUser?.name)
      toast.success('Product updated successfully')
    } else {
      const resolvedModule = inferProductModule(activeModule, form)
      const now = new Date().toISOString()
      const product = {
        ...form,
        storeId: currentStoreId,
        module: resolvedModule,
        price: parseFloat(form.price) || 0,
        cost: parseFloat(form.cost) || 0,
        stock: parseInt(form.stock) || 0,
        image: null,
        variants: [],
        createdAt: now,
        updatedAt: now,
      }
      addProduct(product)
      await publishStoreProductUpsert(product)
      addLog('Added Product', form.name, currentUser?.name)
      toast.success(`"${form.name}" added to ${String(resolvedModule || '').toUpperCase()} products`)
    }
    await syncToCloud()
    if (!keepOpen) {
      setShowModal(false)
      setEditProduct(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: '#f4f7f5' }}>
      <SectionHeader
        title="Products"
        subtitle={`${products.length} products · ${moduleCategories.length} ${activeModule || ''} categories`}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setShowCategories(true)}>
              <Package size={15} /> Manage Categories
            </button>
            <button className="btn-ghost" onClick={() => setShowImport(true)}>
              <Upload size={15} /> Import CSV
            </button>
            <button className="btn-ghost" onClick={() => { exportCSV(filtered); toast.success(`Exported ${filtered.length} products`) }}>
              <Download size={15} /> Export
            </button>
            <button className="btn-primary" onClick={() => { setEditProduct(null); setShowModal(true) }}>
              <Plus size={15} /> Add Product
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${activeModule || ''} inventory by name or barcode...`}
        />
        <div className="flex gap-2 flex-wrap">
          {['All', ...moduleCategories].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 min-h-[36px]',
                catFilter === c
                  ? 'bg-green-500 text-white shadow-md shadow-green-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300 hover:text-green-700'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Package size={48} />}
            title="No products found"
            description="Add your first product or import from CSV"
            action={
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Product</button>
                <button className="btn-ghost" onClick={() => setShowImport(true)}><Upload size={14} /> Import CSV</button>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Category</th>
                  <th>Sell Price</th>
                  <th>Cost</th>
                  <th>Margin</th>
                  <th>Stock</th>
                  <th>Supplier</th>
                  <th>{activeModule === 'electronics' ? 'Warranty' : 'Expiry'}</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const margin = p.cost > 0 ? ((p.price - p.cost) / p.cost * 100).toFixed(1) : null
                  const stockVariant = p.stock === 0 ? 'red' : p.stock <= 10 ? 'yellow' : 'green'
                  const isExpired = p.expiry && new Date(p.expiry) < new Date()
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm shrink-0">
                            <Package size={16} className="text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {p.barcode ? (
                          <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                            {p.barcode}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td><Badge variant="blue">{p.category || '—'}</Badge></td>
                      <td><span className="font-bold text-green-700">{formatCurrency(p.price)}</span></td>
                      <td><span className="text-gray-500 text-sm">{p.cost ? formatCurrency(p.cost) : '—'}</span></td>
                      <td>
                        {margin !== null ? (
                          <span className={cn('text-xs font-bold px-2 py-1 rounded-lg', parseFloat(margin) >= 20 ? 'bg-green-50 text-green-700' : parseFloat(margin) > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600')}>
                            {margin}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td>
                        <Badge variant={stockVariant}>
                          {p.stock === 0 ? 'Out of Stock' : p.stock <= 5 ? `Low Stock (${p.stock})` : p.stock}
                        </Badge>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded">
                          {p.supplier || '—'}
                        </span>
                      </td>
                      <td>
                        {activeModule === 'electronics' ? (
                          <span className="text-xs font-semibold text-gray-600">
                            {p.warrantyMonths ? `${p.warrantyMonths} months` : 'No Warranty'}
                          </span>
                        ) : p.expiry ? (
                          <span className={cn('text-xs flex items-center gap-1', isExpired ? 'text-red-500 font-bold' : 'text-gray-500')}>
                            {isExpired && <AlertTriangle size={12} className="shrink-0 text-red-500" />}{p.expiry}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td>
                        <Badge variant={p.active ? 'green' : 'gray'}>
                          {p.active ? 'Active' : 'Hidden'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setEditProduct(p); setShowModal(true) }}
                            className="w-8 h-8 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-all flex items-center justify-center active:scale-90"
                            title="Edit product"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(p)}
                            className="w-8 h-8 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all flex items-center justify-center active:scale-90"
                            title="Delete product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditProduct(null) }}
        title={editProduct ? 'Edit Product' : 'Add New Product'}
        maxWidth="max-w-4xl"
      >
        <ProductForm
          initial={editProduct || PRODUCT_FORM_DEFAULT}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditProduct(null) }}
          categories={moduleCategories}
          activeModule={activeModule}
        />
      </Modal>

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        categories={moduleCategories}
        activeModule={activeModule}
      />

      <CategoryManagerModal
        open={showCategories}
        onClose={() => setShowCategories(false)}
        moduleName={activeModule}
      />

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Product" maxWidth="max-w-sm">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <p className="text-gray-700 font-semibold mb-1">Delete "{confirmDelete?.name}"?</p>
          <p className="text-sm text-gray-500 mb-6">This cannot be undone.</p>
          <div className="flex gap-3">
            <button
              className="btn-danger flex-1 justify-center"
              onClick={async () => {
                deleteProduct(confirmDelete.id)
                await publishStoreProductDelete(confirmDelete.id)
                addLog('Deleted Product', confirmDelete.name, currentUser?.name)
                await syncToCloud()
                toast.success(`"${confirmDelete.name}" deleted`)
                setConfirmDelete(null)
              }}
            >
              Delete
            </button>
            <button className="btn-ghost flex-1 justify-center" onClick={() => setConfirmDelete(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

