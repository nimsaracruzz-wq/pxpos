import React, { useState, useMemo, useRef } from 'react'
import { Plus, Edit2, Trash2, Package, Upload, Download, Barcode, ToggleLeft, ToggleRight } from 'lucide-react'
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
  supplier: '', brand: '', sizes: '', colors: ''
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
        {value.split('').flatMap((c, i) => {
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

function ProductForm({ initial = PRODUCT_FORM_DEFAULT, onSave, onCancel, categories, activeModule }) {
  const [form, setForm] = useState({ ...PRODUCT_FORM_DEFAULT, ...initial })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const margin = form.price && form.cost
    ? ((parseFloat(form.price) - parseFloat(form.cost)) / parseFloat(form.cost) * 100).toFixed(1)
    : null

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Product Name *"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
          placeholder="e.g. Basmati Rice 5kg"
          className="col-span-2"
        />
        <div>
          <Input
            label="Barcode"
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            placeholder="Scan or enter manually"
          />
          <BarcodeDisplay value={form.barcode} />
        </div>
        <Select label="Category" value={form.category} onChange={(e) => set('category', e.target.value)}>
          <option value="">Select category</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input
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
        {margin !== null && (
          <div className="col-span-2 p-2 rounded-xl bg-green-50 text-sm text-green-700 font-semibold text-center">
            💹 Profit Margin: {margin}%
            {' '}(Rs. {(parseFloat(form.price) - parseFloat(form.cost)).toFixed(2)} per unit)
          </div>
        )}
        <Input
          label="Opening Stock"
          type="number"
          value={form.stock}
          onChange={(e) => set('stock', e.target.value)}
          placeholder="0"
        />
        <Select label="Unit" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
          {['pcs', 'kg', 'g', 'L', 'mL', 'bag', 'box', 'bottle', 'pack', 'bar', 'strip', 'carton', 'jar'].map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </Select>
        <Input
          label="Expiry Date"
          type="date"
          value={form.expiry}
          onChange={(e) => set('expiry', e.target.value)}
        />
        {activeModule === 'pharmacy' && (
          <Input
            label="Supplier"
            value={form.supplier}
            onChange={(e) => set('supplier', e.target.value)}
            placeholder="e.g. PharmaCorp"
            className="col-span-2"
          />
        )}
        {activeModule === 'clothing' && (
          <>
            <Input
              label="Brand"
              value={form.brand}
              onChange={(e) => set('brand', e.target.value)}
              placeholder="e.g. DenimCo"
              className="col-span-2"
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
            />
          </>
        )}
        <div className="flex items-center gap-3 pt-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Active</label>
          <button
            type="button"
            onClick={() => set('active', !form.active)}
            className={cn('transition-colors', form.active ? 'text-green-600' : 'text-gray-400')}
          >
            {form.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
          <span className="text-sm text-gray-500">{form.active ? 'Visible in POS' : 'Hidden from POS'}</span>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1 justify-center">
          {initial.id ? '💾 Save Changes' : '✓ Add Product'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
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
          <p className="font-semibold mb-1">📋 CSV Format Required:</p>
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
                ✓ Import {preview.length} Products
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
  const { getCategoriesForModule, addCategory, removeCategory } = useProductStore()
  const { addLog } = useActivityStore()
  const { currentUser } = useAuthStore()
  const toast = useToast()
  const [categoryName, setCategoryName] = useState('')

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
    removeCategory(moduleName, value)
    addLog('Removed Category', `${moduleName}: ${value}`, currentUser?.name)
    toast.success(`Category "${value}" removed`)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Manage ${String(moduleName || '').toUpperCase()} Categories`} maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex gap-2">
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="New category name"
            />
            <button type="button" className="btn-primary" onClick={handleAdd} disabled={!String(categoryName || '').trim()}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 sm:col-span-2">
              No categories defined for this module yet.
            </div>
          ) : (
            categories.map((category) => (
              <div key={category} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
                <span className="text-sm font-semibold text-gray-800">{category}</span>
                <button type="button" className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => handleRemove(category)}>
                  Remove
                </button>
              </div>
            ))
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
      const matchM = !p.module || p.module === activeModule
      const matchS = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
      const matchC = catFilter === 'All' || p.category === catFilter
      return matchS && matchC && matchM
    })
  }, [products, search, catFilter, activeModule])

  const handleSave = async (form) => {
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
    setShowModal(false)
    setEditProduct(null)
  }

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: `#f4f7f5` }} style={{ background: '#f4f7f5' }}>
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
                  <th>Expiry</th>
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
                          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm shrink-0">📦</div>
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
                          {p.stock === 0 ? '⛔ Out' : p.stock <= 5 ? `⚡ ${p.stock}` : p.stock}
                        </Badge>
                      </td>
                      <td>
                        {p.expiry ? (
                          <span className={cn('text-xs', isExpired ? 'text-red-500 font-bold' : 'text-gray-500')}>
                            {isExpired ? '⚠ ' : ''}{p.expiry}
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
        maxWidth="max-w-xl"
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

