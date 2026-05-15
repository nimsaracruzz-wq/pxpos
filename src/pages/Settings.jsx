import React, { useState, useEffect } from 'react'
import {
  Store, Receipt, Percent, Globe, Key, Shield,
  Printer, Barcode, Save, CheckCircle, ChevronRight,
  ShoppingBag, Utensils, Shirt, Pill, Truck, Cloud, Database, Users, Upload, Sun, Moon,
  Banknote, History, CalendarDays, BadgeDollarSign, CircleDollarSign,
  Monitor, Type, Image, Video, Plus, Trash2, RefreshCw, Copy, Download
} from 'lucide-react'
import { useAppStore, useAuthStore } from '@/store'
import { Toggle, Input, Select, SectionHeader, StatCard } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { testCloudConnection } from '@/lib/firebase'
import { validateLicense } from '@/lib/license'
import { defaultFirebaseConfigJson } from '@/lib/defaultFirebaseConfig'
import { BRAND } from '@/lib/brand'
import { SYSTEM_PUBLIC_MENU_URL } from '@/lib/systemUrls'
import { cn } from '@/lib/utils'
import { printReceiptHTML } from '@/lib/printReceipt'
import { buildThermalProfile, receiptProfileOptions } from '@/lib/thermalPrinter'
import UserBarcodeGenerator, { generateUserBarcode } from '@/components/UserBarcodeGenerator'
import MediaCarousel from '@/components/display/MediaCarousel'
import { v4 as uuidv4 } from 'uuid'

const TABS = [
  { id: 'business', label: 'Business Info', icon: Store },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'tax', label: 'Tax & Charges', icon: Percent },
  { id: 'modules', label: 'Modules', icon: ShoppingBag },
  { id: 'receipt', label: 'Receipt', icon: Receipt },
  { id: 'qr-ordering', label: 'QR Ordering', icon: Utensils },
  { id: 'customer-display', label: 'Customer Display', icon: Monitor },
  { id: 'hardware', label: 'Hardware', icon: Printer },
  { id: 'cloud', label: 'Cloud & Billing', icon: Cloud },
  { id: 'users', label: 'Staff & Roles', icon: Users },
  { id: 'license', label: 'License', icon: Key },
  { id: 'data', label: 'Data Management', icon: Database },
]

const MODULE_LIST = [
  {
    id: 'grocery',
    icon: ShoppingBag,
    label: 'Grocery Mode',
    description: 'Barcode scanning, expiry tracking, GRN (goods receiving)',
    color: '#16a34a',
  },
  {
    id: 'restaurant',
    icon: Utensils,
    label: 'Restaurant Mode',
    description: 'Table management, kitchen order tickets, menu items',
    color: '#f59e0b',
  },
  {
    id: 'clothing',
    icon: Shirt,
    label: 'Clothing Mode',
    description: 'Product variants (size, color), style management',
    color: '#3b82f6',
  },
  {
    id: 'pharmacy',
    icon: Pill,
    label: 'Pharmacy Mode',
    description: 'Batch tracking, expiry alerts, drug scheduling',
    color: '#ef4444',
  },
  {
    id: 'wholesale',
    icon: Truck,
    label: 'Wholesale Mode',
    description: 'Credit system, customer ledger, bulk pricing',
    color: '#7c3aed',
  },
  {
    id: 'online',
    icon: Globe,
    label: 'Online Store Mode',
    description: 'E-commerce integration, sync web orders and inventory',
    color: '#0ea5e9',
  },
  {
    id: 'electronics',
    icon: Monitor,
    label: 'Computer & Mobile Mode',
    description: 'Serial & IMEI tracking, repair jobs, warranty management',
    color: '#0ea5e9',
  },
]

function SettingsSection({ title, children }) {
  return (
    <div className="card p-6 mb-4 animate-fade-in">
      <h3 className="font-bold text-gray-900 mb-5 text-sm uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </div>
  )
}

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'owner',       label: 'Owner' },
  { value: 'manager',     label: 'Manager' },
  { value: 'staff',       label: 'Staff / Cashier' },
]

function UserForm({ initial, onSave, onCancel, saving, currentUser }) {
  const [form, setForm] = useState(initial || { name:'', username:'', password:'', barcode:'', role:'staff' })
  const isEdit = !!initial?.id
  
  // Auto-generate barcode for new users when role changes
  const handleRoleChange = (newRole) => {
    setForm(f => {
      const updated = { ...f, role: newRole }
      if (!isEdit && !initial?.id) {
        // For new users, auto-generate barcode
        updated.barcode = generateUserBarcode(uuidv4(), newRole)
      }
      return updated
    })
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4 animate-fade-in">
      <p className="font-bold text-green-800 mb-4 text-sm">{isEdit ? '✏️ Edit Staff Member' : '➕ Add New Staff Member'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</label>
          <input className="input-base mt-1 text-sm" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. John Doe" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Username</label>
          <input className="input-base mt-1 text-sm" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="e.g. john" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{isEdit ? 'New Password (leave blank to keep)' : 'Password'}</label>
          <input type="password" className="input-base mt-1 text-sm" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Min 6 characters" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            ID Badge / Barcode {!isEdit && <span className="text-blue-600 font-normal">(auto-generated)</span>}
          </label>
          <input 
            className="input-base mt-1 text-sm font-mono" 
            value={form.barcode} 
            onChange={e => !isEdit ? null : setForm(f=>({...f,barcode:e.target.value}))} 
            placeholder="e.g. STF-0042"
            readOnly={!isEdit}
            style={{ cursor: isEdit ? 'text' : 'not-allowed', opacity: isEdit ? 1 : 0.7 }}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</label>
          <select 
            className="input-base mt-1 text-sm w-full" 
            value={form.role} 
            onChange={e => isEdit ? setForm(f=>({...f,role:e.target.value})) : handleRoleChange(e.target.value)}
          >
            {ROLE_OPTIONS.filter(r => currentUser?.role === 'super_admin' ? true : r.value !== 'super_admin').map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn-primary" onClick={()=>onSave(form)} disabled={saving}>
          {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create User')}
        </button>
        <button className="btn-ghost border border-gray-200" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function StaffTab() {
  const { users, roles, addUser, updateUser, deleteUser, currentUser } = useAuthStore()
  const toast = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null) // user object being edited
  const [saving, setSaving] = useState(false)
  const [barcodeUser, setBarcodeUser] = useState(null) // user for barcode generation

  const handleAdd = async (form) => {
    if (!form.name || !form.username || !form.password) { toast.error('Name, username and password are required'); return }
    setSaving(true)
    
    // Auto-generate barcode if not already set (ensure every new user has a barcode)
    const userForm = { ...form }
    if (!userForm.barcode) {
      userForm.barcode = generateUserBarcode(uuidv4(), form.role)
    }
    
    const res = await addUser(userForm)
    setSaving(false)
    if (res?.success) { setShowAdd(false); toast.success('User created with auto-generated badge!') }
    else toast.error(res?.error || 'Failed to create user')
  }

  const handleEdit = async (form) => {
    setSaving(true)
    const updates = { name: form.name, username: form.username, barcode: form.barcode, role: form.role }
    if (form.password) updates.password = form.password
    const res = await updateUser(editing.id, updates)
    setSaving(false)
    if (res?.success) { setEditing(null); toast.success('User updated!') }
    else toast.error(res?.error || 'Failed to update user')
  }

  const handleDelete = async (u) => {
    if (u.id === currentUser?.id) { toast.error("You can't delete your own account!"); return }
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    await deleteUser(u.id)
    toast.success('User deleted')
  }

  const ROLE_COLORS = {
    super_admin: 'bg-blue-50 text-blue-700 border-blue-200',
    owner:       'bg-green-50 text-green-700 border-green-200',
    manager:     'bg-yellow-50 text-yellow-700 border-yellow-200',
    staff:       'bg-purple-50 text-purple-700 border-purple-200',
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-500 text-sm uppercase tracking-wider">Staff Accounts</h3>
          {!showAdd && !editing && (
            <button onClick={()=>setShowAdd(true)} className="btn-primary text-sm py-2">
              + Add Staff Member
            </button>
          )}
        </div>

        {showAdd && <UserForm onSave={handleAdd} onCancel={()=>setShowAdd(false)} saving={saving} currentUser={currentUser} />}

        <div className="flex flex-col gap-2">
          {users.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No users loaded yet...</p>}
          {users.map(u => (
            <div key={u.id}>
              {editing?.id === u.id ? (
                <UserForm initial={editing} onSave={handleEdit} onCancel={()=>setEditing(null)} saving={saving} currentUser={currentUser} />
              ) : (
                <div className="p-4 border border-gray-100 rounded-xl flex items-center justify-between bg-white hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center uppercase">
                      {u.username?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {u.name}
                        {u.id === currentUser?.id && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md uppercase">You</span>}
                        <span className={`text-[10px] border px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${ROLE_COLORS[u.role] || ''}`}>
                          {roles[u.role]?.name || u.role}
                        </span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                        @{u.username} {u.barcode && <>· Badge: {u.barcode}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {u.role === 'super_admin' && currentUser?.role !== 'super_admin' ? (
                      <span className="text-xs text-gray-400 italic py-1.5 px-3 border border-transparent">Protected</span>
                    ) : (
                      <>
                        <button onClick={()=>setBarcodeUser(u)} className="btn-ghost text-xs py-1.5 px-3 border border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-300 flex items-center gap-1">
                          <Barcode size={14} /> Badge
                        </button>
                        <button onClick={()=>setEditing({...u,password:''})} className="btn-ghost text-xs py-1.5 px-3 border border-gray-200 hover:border-green-300 hover:text-green-600">Edit</button>
                        <button onClick={()=>handleDelete(u)} className="btn-ghost text-xs py-1.5 px-3 border border-red-100 text-red-400 hover:bg-red-50 hover:border-red-300">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-gray-500 text-sm uppercase tracking-wider mb-4">System Roles & Permissions</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(roles).map(([rid, r]) => (
            <div key={rid} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="font-bold text-gray-900 mb-2 text-sm">{r.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {r.permissions.map(p => (
                  <span key={p} className="px-2 py-0.5 bg-white border border-gray-200 rounded-md text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                    {p.replace(/_/g,' ')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {barcodeUser && <UserBarcodeGenerator user={barcodeUser} onClose={() => setBarcodeUser(null)} />}
    </div>
  )
}

function QrOrderingTab() {
  const { qrSettings, updateQrSettings } = useAppStore()
  const { autoAccept, quickReplies } = qrSettings || { autoAccept: true, quickReplies: [] }
  const [newReply, setNewReply] = React.useState('')

  const handleAddReply = () => {
    if (newReply.trim()) {
      updateQrSettings({ quickReplies: [...quickReplies, newReply.trim()] })
      setNewReply('')
    }
  }

  const handleRemoveReply = (index) => {
    updateQrSettings({ quickReplies: quickReplies.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <SettingsSection title="QR Order Acceptance">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">Auto-Accept Web/QR Orders</p>
            <p className="text-xs text-gray-500 mt-1">If enabled, incoming QR orders instantly print to Kitchen.</p>
            <p className="text-xs text-amber-600 font-semibold mt-1">If disabled, orders queue up for manual staff approval and customization.</p>
          </div>
          <Toggle checked={!(!autoAccept)} onChange={(v) => updateQrSettings({ autoAccept: v })} />
        </div>
      </SettingsSection>
      <SettingsSection title="Pre-added Quick Replies / Customizations">
        <p className="text-xs text-gray-500 mb-4">Add standard notes or rejection reasons that staff can select with one tap when reviewing QR orders.</p>
        <div className="flex flex-col gap-2 mb-4">
          {quickReplies.map((reply, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-100 bg-white rounded-xl">
              <span className="text-sm font-medium text-gray-700">{reply}</span>
              <button type="button" className="text-red-400 hover:text-red-600" onClick={() => handleRemoveReply(i)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {quickReplies.length === 0 && <p className="text-xs text-gray-400">No quick replies configured.</p>}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="New Reply / Note" placeholder="e.g. Make it mild" value={newReply} onChange={e => setNewReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddReply()} />
          </div>
          <button type="button" className="btn-primary whitespace-nowrap mb-1" onClick={handleAddReply}>
            + Add Note
          </button>
        </div>
      </SettingsSection>
    </div>
  )
}

function CustomerDisplayTab() {
  const toast = useToast()
  const {
    customerDisplaySettings,
    updateCustomerDisplaySettings,
    addCustomerDisplaySlide,
    updateCustomerDisplaySlide,
    removeCustomerDisplaySlide,
    resetCustomerDisplaySettings,
  } = useAppStore()

  const slides = Array.isArray(customerDisplaySettings?.slides) ? customerDisplaySettings.slides : []
  const previewSlides = customerDisplaySettings?.enabled === false ? [] : slides

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(String(event.target?.result || ''))
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })

  const addSlide = (type = 'text') => {
    addCustomerDisplaySlide({
      type,
      title: type === 'video' ? 'Video Promo' : type === 'image' ? 'Image Promo' : 'New Offer',
      description: type === 'text' ? 'Add your message here.' : '',
      tag: type === 'text' ? 'Offer' : '',
      accent: type === 'video' ? '#22c55e' : type === 'image' ? '#0ea5e9' : '#f97316',
      src: '',
      mimeType: '',
    })
  }

  const handleUpload = async (slideId, file) => {
    if (!file) return
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please upload an image or video file')
      return
    }

    try {
      const src = await readFileAsDataUrl(file)
      updateCustomerDisplaySlide(slideId, {
        src,
        mimeType: file.type,
        type: file.type.startsWith('video/') ? 'video' : 'image',
      })
      toast.success('Media uploaded to this device')
    } catch (error) {
      toast.error(error.message || 'Failed to upload media')
    }
  }

  const resolveMediaLabel = (slide) => {
    if (slide.type === 'video') return 'Video'
    if (slide.type === 'image') return 'Image'
    return 'Text offer'
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="card p-4 border border-cyan-100 bg-gradient-to-r from-cyan-50 to-emerald-50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-cyan-800 flex items-center gap-2">
              <Monitor size={16} />
              Offline customer display editor
            </p>
            <p className="text-xs text-cyan-700 mt-1 max-w-2xl">
              Owners can customize the on-screen offers, text, images, and videos. Media is stored on this device, not online.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-secondary text-sm" onClick={() => addSlide('text')}>
              <Plus size={14} /> Add Text Offer
            </button>
            <button className="btn-secondary text-sm" onClick={() => addSlide('image')}>
              <Image size={14} /> Add Image
            </button>
            <button className="btn-secondary text-sm" onClick={() => addSlide('video')}>
              <Video size={14} /> Add Video
            </button>
            <button className="btn-ghost border border-red-100 text-red-500 hover:bg-red-50 text-sm" onClick={resetCustomerDisplaySettings}>
              <RefreshCw size={14} /> Reset Defaults
            </button>
          </div>
        </div>
      </div>

      <SettingsSection title="Display Branding">
        <div className="flex flex-col gap-4">
          <Toggle
            checked={customerDisplaySettings?.enabled !== false}
            onChange={(v) => updateCustomerDisplaySettings({ enabled: v })}
            label="Use custom customer display content"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Header Label"
              value={customerDisplaySettings?.bannerTitle || ''}
              onChange={(e) => updateCustomerDisplaySettings({ bannerTitle: e.target.value })}
              placeholder="Customer Display"
            />
            <Input
              label="Welcome Title"
              value={customerDisplaySettings?.headline || ''}
              onChange={(e) => updateCustomerDisplaySettings({ headline: e.target.value })}
              placeholder="Welcome to CeyPos POS"
            />
            <Input
              label="Welcome Subtitle"
              value={customerDisplaySettings?.subtitle || ''}
              onChange={(e) => updateCustomerDisplaySettings({ subtitle: e.target.value })}
              placeholder="Ready to order"
            />
            <Input
              label="Autoplay Interval (ms)"
              type="number"
              value={customerDisplaySettings?.autoplayInterval || 5000}
              onChange={(e) => updateCustomerDisplaySettings({ autoplayInterval: Math.max(2000, parseInt(e.target.value, 10) || 5000) })}
              placeholder="5000"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Welcome Message</label>
            <textarea
              value={customerDisplaySettings?.message || ''}
              onChange={(e) => updateCustomerDisplaySettings({ message: e.target.value })}
              placeholder="Your order will be prepared with care"
              className="input-base w-full min-h-[110px] p-3 resize-y"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Text Offers, Images & Videos">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Upload images or videos from this device, then edit the title and message shown on the customer screen.
          </p>

          <div className="flex flex-col gap-3">
            {slides.map((slide, index) => (
              <div key={slide.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {resolveMediaLabel(slide)} {index + 1}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{slide.src ? 'Media stored locally on this device' : 'No media uploaded yet'}</p>
                  </div>
                  <button
                    className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                    onClick={() => removeCustomerDisplaySlide(slide.id)}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Content Type"
                    value={slide.type || 'text'}
                    onChange={(e) => updateCustomerDisplaySlide(slide.id, { type: e.target.value })}
                  >
                    <option value="text">Text Offer</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </Select>
                  <Input
                    label="Title"
                    value={slide.title || ''}
                    onChange={(e) => updateCustomerDisplaySlide(slide.id, { title: e.target.value })}
                    placeholder="Main title"
                  />
                  <Input
                    label="Description"
                    value={slide.description || ''}
                    onChange={(e) => updateCustomerDisplaySlide(slide.id, { description: e.target.value })}
                    placeholder="Supporting message"
                  />
                  <Input
                    label="Accent Color"
                    value={slide.accent || '#16a34a'}
                    onChange={(e) => updateCustomerDisplaySlide(slide.id, { accent: e.target.value })}
                    placeholder="#16a34a"
                  />
                </div>

                {slide.type === 'text' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <Input
                      label="Offer Tag"
                      value={slide.tag || ''}
                      onChange={(e) => updateCustomerDisplaySlide(slide.id, { tag: e.target.value })}
                      placeholder="Hot Deal"
                    />
                    <div className="flex items-end">
                      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-full">
                        This slide will appear as a rotating promotion card on the customer display.
                      </p>
                    </div>
                  </div>
                )}

                {slide.type !== 'text' && (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="btn-secondary cursor-pointer">
                        <Upload size={14} /> {slide.type === 'video' ? 'Upload Video' : 'Upload Image'}
                        <input
                          type="file"
                          accept={slide.type === 'video' ? 'video/*' : 'image/*,video/*'}
                          className="hidden"
                          onChange={(e) => handleUpload(slide.id, e.target.files?.[0])}
                        />
                      </label>
                      {slide.src && (
                        <button
                          className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                          onClick={() => updateCustomerDisplaySlide(slide.id, { src: '', mimeType: '' })}
                        >
                          Clear Media
                        </button>
                      )}
                    </div>

                    {slide.src ? (
                      slide.type === 'video' ? (
                        <video
                          src={slide.src}
                          className="w-full max-h-64 rounded-2xl object-cover bg-black"
                          muted
                          loop
                          playsInline
                          controls
                        />
                      ) : (
                        <img
                          src={slide.src}
                          alt={slide.title || 'Uploaded preview'}
                          className="w-full max-h-64 rounded-2xl object-cover bg-gray-100"
                        />
                      )
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-400 text-center">
                        {slide.type === 'video' ? 'Upload a local video file to preview it here.' : 'Upload a local image file to preview it here.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Live Preview">
        <div className="space-y-4">
          <div className="rounded-3xl overflow-hidden border border-gray-200 bg-slate-950 p-3 shadow-lg">
            <MediaCarousel items={previewSlides.length > 0 ? previewSlides : slides} autoPlay interval={customerDisplaySettings?.autoplayInterval || 5000} className="h-[320px]" />
          </div>
          <p className="text-xs text-gray-500">
            The customer screen uses the same offline media stored in the app, so the second display stays local to this device.
          </p>
        </div>
      </SettingsSection>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('business')
  const [saved, setSaved] = useState(false)
  const [licenseInput, setLicenseInput] = useState('')
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const toast = useToast()
  const {
    businessInfo, updateBusinessInfo,
    taxSettings, updateTaxSettings,
    serviceChargeSettings, updateServiceChargeSettings,
    receiptSettings, updateReceiptSettings,
    hardwareSettings, updateHardwareSettings,
    modules, toggleModule,
    licenseActive, licenseKey, activateLicense,
    cloudSettings, updateCloudSettings,
    helaQRSettings, updateHelaQRSettings,
    cloudSubscription, setDeploymentMode, updateCloudSubscription, recordCloudPayment,
    language, setLanguage,
    theme, setTheme,
  } = useAppStore()
  const { hasPermission, canAccessSettingsTab, users, roles, currentUser } = useAuthStore()

  // super_admin sees everything; all other roles are filtered by canAccessSettingsTab
  const allowedTabs = TABS.filter(t => {
    if (currentUser?.role === 'super_admin') return true
    return canAccessSettingsTab(t.id)
  })

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCopyLicenseKey = async () => {
    if (!licenseKey) {
      toast.error('No activated license key found')
      return
    }

    try {
      await navigator.clipboard.writeText(licenseKey)
      toast.success('Activated license key copied')
    } catch {
      toast.error('Unable to copy license key')
    }
  }

  const getNextDueAt = (plan) => {
    const next = new Date()
    if (plan === 'annual') next.setFullYear(next.getFullYear() + 1)
    else next.setMonth(next.getMonth() + 1)
    return next.toISOString()
  }

  const handleRecordCloudPayment = () => {
    if (cloudSubscription.deploymentMode !== 'cloud') {
      toast.error('Enable cloud mode first')
      return
    }

    const amount = Number(cloudSubscription.plan === 'annual'
      ? cloudSubscription.annualFee
      : cloudSubscription.monthlyFee) || 0

    if (amount <= 0) {
      toast.error('Set a monthly or annual fee first')
      return
    }

    recordCloudPayment({
      plan: cloudSubscription.plan,
      amount,
      period: cloudSubscription.plan,
      paidBy: currentUser?.name || currentUser?.username || 'System',
      note: cloudSubscription.notes || '',
      nextDueAt: getNextDueAt(cloudSubscription.plan),
      status: 'paid',
    })
    toast.success(`Cloud subscription payment recorded (${cloudSubscription.plan})`)
    showSaved()
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'business':
        return (
          <div className="flex flex-col gap-4">
            <SettingsSection title="Business Information">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Business Name" value={businessInfo.name} onChange={(e) => updateBusinessInfo({ name: e.target.value })} />
                <Input label="Phone" value={businessInfo.phone} onChange={(e) => updateBusinessInfo({ phone: e.target.value })} />
                <Input label="Email" value={businessInfo.email} onChange={(e) => updateBusinessInfo({ email: e.target.value })} />
                <Input label="Tax ID / Business Reg." value={businessInfo.taxId} onChange={(e) => updateBusinessInfo({ taxId: e.target.value })} />
                <Input
                  label="Public Menu URL"
                  value={businessInfo.publicMenuBaseUrl || SYSTEM_PUBLIC_MENU_URL}
                  onChange={(e) => updateBusinessInfo({ publicMenuBaseUrl: e.target.value.trim() })}
                  hint={`Default: ${SYSTEM_PUBLIC_MENU_URL}`}
                />
                <Input label="Address" value={businessInfo.address} onChange={(e) => updateBusinessInfo({ address: e.target.value })} className="col-span-2" />
              </div>
            </SettingsSection>
            <SettingsSection title="Currency">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Currency" value={businessInfo.currency} onChange={(e) => updateBusinessInfo({ currency: e.target.value })}>
                  <option value="LKR">LKR - Sri Lankan Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="INR">INR - Indian Rupee</option>
                </Select>
                <Input label="Currency Symbol" value={businessInfo.currencySymbol} onChange={(e) => updateBusinessInfo({ currencySymbol: e.target.value })} />
              </div>
            </SettingsSection>
            <SettingsSection title="System Language">
              <div className="flex gap-4">
                <button
                  onClick={() => setLanguage('en')}
                  className={cn('flex-1 py-3 rounded-xl border-2 font-bold transition-all', language === 'en' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}
                >
                  English
                </button>
                <button
                  onClick={() => setLanguage('si')}
                  className={cn('flex-1 py-3 rounded-xl border-2 font-bold transition-all text-lg', language === 'si' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}
                >
                  සිංහල
                </button>
              </div>
            </SettingsSection>

            <SettingsSection title="HelaQR Payments">
              <div className="flex flex-col gap-5">
                <Toggle
                  checked={Boolean(helaQRSettings?.enabled)}
                  onChange={(v) => updateHelaQRSettings({ enabled: v })}
                  label="Enable HelaQR"
                />

                {Boolean(helaQRSettings?.enabled) && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Base URL"
                      value={helaQRSettings?.baseUrl || ''}
                      onChange={(e) => updateHelaQRSettings({ baseUrl: e.target.value.trim() })}
                      placeholder="https://api.example.com"
                    />
                    <Input
                      label="Business ID (b)"
                      value={helaQRSettings?.businessId || ''}
                      onChange={(e) => updateHelaQRSettings({ businessId: e.target.value.trim() })}
                      placeholder="223"
                    />
                    <Input
                      label="App ID"
                      value={helaQRSettings?.appId || ''}
                      onChange={(e) => updateHelaQRSettings({ appId: e.target.value.trim() })}
                    />
                    <Input
                      label="App Secret"
                      value={helaQRSettings?.appSecret || ''}
                      onChange={(e) => updateHelaQRSettings({ appSecret: e.target.value.trim() })}
                    />
                    <Input
                      label="Notify URL (optional)"
                      value={helaQRSettings?.notifyUrl || ''}
                      onChange={(e) => updateHelaQRSettings({ notifyUrl: e.target.value.trim() })}
                      className="col-span-2"
                      placeholder="https://your-server.com/helaqr/callback"
                    />
                    <div className="col-span-2">
                      <Toggle
                        checked={Boolean(helaQRSettings?.testMode)}
                        onChange={(v) => updateHelaQRSettings({ testMode: v })}
                        label="Test Mode"
                      />
                    </div>
                  </div>
                )}
              </div>
            </SettingsSection>
          </div>
        )

      case 'appearance':
        return (
          <div className="flex flex-col gap-4">
            <SettingsSection title="Theme">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-left transition-all',
                    theme === 'light'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sun size={16} className={theme === 'light' ? 'text-green-600' : 'text-gray-500'} />
                    <p className="font-bold text-sm text-gray-900">Light</p>
                  </div>
                  <p className="text-xs text-gray-500">Clean bright interface for daylight use.</p>
                </button>

                <button
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-left transition-all',
                    theme === 'dark'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Moon size={16} className={theme === 'dark' ? 'text-green-600' : 'text-gray-500'} />
                    <p className="font-bold text-sm text-gray-900">Dark</p>
                  </div>
                  <p className="text-xs text-gray-500">Reduced eye strain for low-light counters.</p>
                </button>
              </div>
            </SettingsSection>
          </div>
        )

      case 'tax':
        return (
          <div className="flex flex-col gap-4">
            <SettingsSection title="Tax Configuration">
              <div className="flex flex-col gap-5">
                <Toggle
                  checked={taxSettings.enabled}
                  onChange={(v) => updateTaxSettings({ enabled: v })}
                  label="Enable Tax Calculation"
                />
                {taxSettings.enabled && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Input label="Tax Name" value={taxSettings.name} onChange={(e) => updateTaxSettings({ name: e.target.value })} placeholder="e.g. VAT, GST" />
                    <Input label="Tax Rate (%)" type="number" value={taxSettings.rate} onChange={(e) => updateTaxSettings({ rate: parseFloat(e.target.value) || 0 })} />
                    <div className="col-span-2">
                      <Toggle
                        checked={taxSettings.inclusive}
                        onChange={(v) => updateTaxSettings({ inclusive: v })}
                        label="Tax included in price (tax-inclusive pricing)"
                      />
                    </div>
                  </div>
                )}
              </div>
            </SettingsSection>
            
            <SettingsSection title="Service Charge Configuration">
              <div className="flex flex-col gap-5">
                <Toggle
                  checked={serviceChargeSettings?.enabled || false}
                  onChange={(v) => updateServiceChargeSettings({ enabled: v })}
                  label="Enable Service Charge"
                />
                {serviceChargeSettings?.enabled && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Input label="Charge Name" value={serviceChargeSettings.name || 'Service Charge'} onChange={(e) => updateServiceChargeSettings({ name: e.target.value })} placeholder="e.g. Service Charge" />
                    <Input label="Charge Rate (%)" type="number" value={serviceChargeSettings.rate || 0} onChange={(e) => updateServiceChargeSettings({ rate: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
            </SettingsSection>
          </div>
        )

      case 'modules':
        return (
          <div className="flex flex-col gap-4">
            <div className="card p-4 mb-2" style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0' }}>
              <p className="text-sm text-green-700 font-medium">
                🧩 Enable or disable business modules to customize CeyPos POS for your specific needs.
              </p>
            </div>
            {MODULE_LIST.map(({ id, icon: Icon, label, description, color }) => (
              <div
                key={id}
                className={cn(
                  'card p-4 flex items-center gap-4 transition-all',
                  modules[id] && 'border-2'
                )}
                style={{ borderColor: modules[id] ? color : undefined }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}18`, color }}
                >
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <Toggle checked={modules[id]} onChange={() => toggleModule(id)} />
              </div>
            ))}
          </div>
        )

      case 'receipt':
        return (
          <SettingsSection title="Receipt Customization">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Receipt Logo</label>
                <div className="flex items-center gap-4">
                  {receiptSettings.logoUrl ? (
                    <img src={receiptSettings.logoUrl} alt="Logo" className="h-16 max-w-[120px] object-contain bg-white rounded-lg p-1 border shadow-sm" />
                  ) : (
                    <div className="h-16 w-24 bg-gray-50 rounded-lg flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200">No Logo</div>
                  )}
                  <label className="btn-secondary cursor-pointer">
                    <Upload size={14} /> Upload Logo
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/gif" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => updateReceiptSettings({ logoUrl: ev.target.result });
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                  {receiptSettings.logoUrl && (
                    <button className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors" onClick={() => updateReceiptSettings({ logoUrl: null })}>Remove</button>
                  )}
                </div>
              </div>
              <Input label="Receipt Header Text" value={receiptSettings.header} onChange={(e) => updateReceiptSettings({ header: e.target.value })} placeholder="Custom header" />
              <Input label="Receipt Footer Text" value={receiptSettings.footer} onChange={(e) => updateReceiptSettings({ footer: e.target.value })} placeholder="Custom footer" />
              <Toggle checked={receiptSettings.showBarcode} onChange={(v) => updateReceiptSettings({ showBarcode: v })} label="Show barcode on receipt" />
              <Toggle checked={receiptSettings.showTax} onChange={(v) => updateReceiptSettings({ showTax: v })} label="Show tax breakdown" />
              <Toggle checked={receiptSettings.autoPrint} onChange={(v) => updateReceiptSettings({ autoPrint: v })} label="Auto-print on sale complete" />
              <Toggle checked={receiptSettings.showCashier} onChange={(v) => updateReceiptSettings({ showCashier: v })} label="Show cashier name" />
            </div>
          </SettingsSection>
        )

      case 'customer-display':
        return <CustomerDisplayTab />

      case 'hardware':
        return (
          <div className="flex flex-col gap-4">
            <SettingsSection title="Barcode Scanner">
              <div className="flex flex-col gap-3">
                <Toggle checked={hardwareSettings.barcodeScanner} onChange={(v) => updateHardwareSettings({ barcodeScanner: v })} label="Enable barcode scanner (keyboard input)" />
                <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl">
                  🔌 Connect a USB barcode scanner. It works as keyboard input — no driver needed. 
                  Scan a barcode in the POS screen to test.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Receipt Barcode Type</label>
                    <select className="input-base mt-1" value={hardwareSettings.barcodeType || 'CODE128'} onChange={(e) => updateHardwareSettings({ barcodeType: e.target.value })}>
                      <option value="CODE128">CODE128 (recommended)</option>
                      <option value="CODE39">CODE39</option>
                      <option value="EAN13">EAN13</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Edge Padding (mm)</label>
                    <input className="input-base mt-1" type="number" min="0" step="1" value={hardwareSettings.barcodeEdgePaddingMm || ''} onChange={(e) => updateHardwareSettings({ barcodeEdgePaddingMm: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
              </div>
            </SettingsSection>
            <SettingsSection title="Receipt Printer">
              <div className="flex flex-col gap-3">
                <Select
                  label="Receipt Profile"
                  value={buildThermalProfile({
                    paperWidth: hardwareSettings.paperWidth || '80mm',
                    printerMode: hardwareSettings.printerType || 'Raster',
                    printerProfile: hardwareSettings.printerProfile || '',
                  }).printerProfile}
                  onChange={(e) => {
                    const selected = receiptProfileOptions().find((option) => option.value === e.target.value)
                    const resolved = buildThermalProfile({
                      paperWidth: selected?.paperWidth || hardwareSettings.paperWidth || '80mm',
                      printerMode: selected?.printerMode || hardwareSettings.printerType || 'Raster',
                      printerProfile: selected?.value || e.target.value,
                    })
                    updateHardwareSettings({
                      paperWidth: resolved.paperWidth,
                      printerType: resolved.printerMode,
                      printerProfile: resolved.printerProfile,
                    })
                  }}
                >
                  {receiptProfileOptions().map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>

                {/* Printer Name input + Detect button */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label="Printer Name / Port"
                      value={hardwareSettings.printerPort}
                      onChange={(e) => updateHardwareSettings({ printerPort: e.target.value })}
                      placeholder="e.g. FP-1100, POS-58, COM3"
                    />
                  </div>
                  <button
                    className="btn-secondary shrink-0"
                    onClick={async () => {
                      if (!window.require) {
                        toast.error('Desktop app required to detect printers')
                        return
                      }
                      try {
                        const ipc = window.require('electron').ipcRenderer
                        const res = await ipc.invoke('get-printers')
                        if (!res.success || !res.printers?.length) {
                          toast.error('No printers found on this computer')
                          return
                        }
                        const names = res.printers.map(p => `${p.name}${p.isDefault ? ' (Default)' : ''}`).join('\n')
                        const chosen = window.prompt(
                          `Available printers on this PC:\n\n${names}\n\nCopy the exact name and paste it into Printer Name above.`
                        )
                        if (chosen?.trim()) updateHardwareSettings({ printerPort: chosen.trim() })
                      } catch (e) {
                        toast.error('Could not list printers: ' + e.message)
                      }
                    }}
                  >
                    <Printer size={14} />
                    Detect
                  </button>
                </div>

                {/* Paper Width — quick-select + manual override */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Paper Width</label>
                  <div className="flex gap-2">
                    {['58mm', '80mm'].map((w) => (
                      <button
                        key={w}
                        onClick={() => {
                          const resolved = buildThermalProfile({
                            paperWidth: w,
                            printerMode: hardwareSettings.printerType || 'Raster',
                            printerProfile: hardwareSettings.printerProfile || '',
                          })
                          updateHardwareSettings({
                            paperWidth: resolved.paperWidth,
                            printerType: resolved.printerMode,
                            printerProfile: resolved.printerProfile,
                          })
                        }}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all',
                          (hardwareSettings.paperWidth || '80mm') === w
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        )}
                      >
                        {w}
                        <span className="block text-[10px] font-normal opacity-60 mt-0.5">
                          {w === '80mm' ? '72mm usable · 576px' : '48mm usable · 384px'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <input
                    className="input-base text-sm"
                    value={hardwareSettings.paperWidth || '80mm'}
                    onChange={(e) => {
                      const resolved = buildThermalProfile({
                        paperWidth: e.target.value,
                        printerMode: hardwareSettings.printerType || 'Raster',
                        printerProfile: hardwareSettings.printerProfile || '',
                      })
                      updateHardwareSettings({
                        paperWidth: resolved.paperWidth,
                        printerType: resolved.printerMode,
                        printerProfile: resolved.printerProfile,
                      })
                    }}
                    placeholder="e.g. 80mm or 58mm"
                  />
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-2.5">
                    💡 <strong>80mm</strong> = FIT FP-1100, EPSON TM-T82, most modern thermal printers.<br/>
                    <strong>58mm</strong> = compact POS-58 style printers.<br/>
                    <strong>Raster</strong> is best for Windows thermal drivers; <strong>ESC/POS</strong> is kept for direct thermal mode compatibility.
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Barcode Module Width (px)</label>
                    <input className="input-base mt-1" type="number" min="0.5" step="0.1" value={hardwareSettings.barcodeModuleWidth || ''} onChange={(e) => updateHardwareSettings({ barcodeModuleWidth: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Barcode Height (px)</label>
                    <input className="input-base mt-1" type="number" min="20" step="1" value={hardwareSettings.barcodeHeight || ''} onChange={(e) => updateHardwareSettings({ barcodeHeight: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quiet Zone (px)</label>
                    <input className="input-base mt-1" type="number" min="0" step="1" value={hardwareSettings.barcodeQuietZone || ''} onChange={(e) => updateHardwareSettings({ barcodeQuietZone: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <div className="mt-3">
                  <button className="btn-secondary" onClick={async () => {
                    const deviceName  = String(hardwareSettings.printerPort || '').trim()
                    const resolvedProfile = buildThermalProfile({ paperWidth: hardwareSettings.paperWidth || '80mm', printerMode: hardwareSettings.printerType || 'Raster', printerProfile: hardwareSettings.printerProfile || '' })
                    const barcodeSample = String('TEST-123456')
                    const barcodeHtml = `<div style="text-align:center;padding:${(hardwareSettings.barcodeEdgePaddingMm || resolvedProfile.edgePaddingMm)}mm 0;font-family:'Courier New',monospace;font-weight:900">` +
                      `<div style="margin-bottom:6px;font-size:12px;">BARCODE TEST</div>` +
                      `<div>${`<svg xmlns=\"http://www.w3.org/2000/svg\">`}</div>` +
                      `</div>`
                    try {
                      const ok = await printReceiptHTML('Barcode Test', `<div style="text-align:center;font-family:'Courier New',monospace;font-weight:900;padding:${(hardwareSettings.barcodeEdgePaddingMm || resolvedProfile.edgePaddingMm)}mm 0">` +
                        `<div style="font-size:14px;font-weight:900;margin-bottom:6px">BARCODE TEST</div>` +
                        `<div style=\"display:inline-block;\">` +
                        // Use react-barcode equivalent by generating an img tag via server-side conversion is complex — we'll render a large human-readable code
                        `<div style=\"font-size:40px;font-weight:900;letter-spacing:2px;\">${barcodeSample}</div>` +
                        `</div></div>`, { deviceName, paperWidth: resolvedProfile.paperWidth, printerMode: resolvedProfile.printerMode, printerProfile: resolvedProfile.printerProfile })
                      if (ok) toast.success('Barcode test printed (visual code - use scanner to test)')
                      else toast.error('Barcode test failed to print')
                    } catch (e) { toast.error('Print failed: ' + e.message) }
                  }}>Test Barcode Print</button>
                </div>
                <button
                  className="btn-secondary w-fit"
                  onClick={async () => {
                    const deviceName  = String(hardwareSettings.printerPort || '').trim()
                    const resolvedProfile = buildThermalProfile({
                      paperWidth: hardwareSettings.paperWidth || '80mm',
                      printerMode: hardwareSettings.printerType || 'Raster',
                      printerProfile: hardwareSettings.printerProfile || '',
                    })
                    const ok = await printReceiptHTML(
                      'Printer Test',
                      `<div style="text-align:center;font-family:'Courier New',monospace;font-size:13px;font-weight:700;margin:8px 0">
                        <div style="font-size:16px;font-weight:900;letter-spacing:0.04em;margin-bottom:4px">PRINTER TEST</div>
                        <div style="font-size:11px;margin-bottom:8px">CeyPos POS System</div>
                        <hr style="border:none;border-top:1px dashed #000;margin:8px 0"/>
                        <table style="width:100%;border-collapse:collapse;font-size:11px;font-weight:700;text-align:left">
                          <tr><td>Paper Width</td><td style="text-align:right">${resolvedProfile.paperWidth}</td></tr>
                          <tr><td>Profile</td><td style="text-align:right">${resolvedProfile.printerProfile}</td></tr>
                          <tr><td>Printer</td><td style="text-align:right">${deviceName || 'System Default'}</td></tr>
                          <tr><td>Mode</td><td style="text-align:right">${resolvedProfile.printerMode}</td></tr>
                          <tr><td>Time</td><td style="text-align:right">${new Date().toLocaleTimeString()}</td></tr>
                        </table>
                        <hr style="border:none;border-top:2px solid #000;margin:8px 0"/>
                        <div style="font-size:14px;font-weight:900;margin:6px 0">✓ STATUS: SUCCESS</div>
                        <div style="font-size:10px;margin-top:6px;letter-spacing:0.1em">CeyPos Thermal Receipt Engine v2</div>
                      </div>`,
                      { deviceName, paperWidth: resolvedProfile.paperWidth, printerMode: resolvedProfile.printerMode, printerProfile: resolvedProfile.printerProfile }
                    )
                    if (ok) toast.success('Test page sent to printer!')
                    else toast.error(`Print failed — check printer name is exactly correct (currently: "${deviceName || 'none'}")`)
                  }}
                >
                  <Printer size={14} />
                  Test Print
                </button>
              </div>
            </SettingsSection>
            <SettingsSection title="Cash Drawer">
              <div className="flex flex-col gap-3">
                <Toggle checked={hardwareSettings.autoOpenDrawer} onChange={(v) => updateHardwareSettings({ autoOpenDrawer: v })} label="Open cash drawer on sale complete" />
                <Input label="Drawer Port" value={hardwareSettings.drawerPort} onChange={(e) => updateHardwareSettings({ drawerPort: e.target.value })} placeholder="e.g. COM1" />
              </div>
            </SettingsSection>
          </div>
        )

      case 'data':
        return (
          <div className="flex flex-col gap-4">
            <SettingsSection title="Local Database Backup & Restore" description="Export your POS database to a file, or restore a previous backup. Restoring will restart the application.">
              <div className="flex flex-col gap-4 mt-2">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900 flex items-center gap-2"><Download size={18} /> Backup Database</h3>
                    <p className="text-sm text-blue-700 mt-1">Download the entire local SQLite database (.db file) to your computer.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.require) return toast.error('Desktop app required');
                      const toastId = toast.loading('Saving backup...');
                      try {
                        const ipc = window.require('electron').ipcRenderer;
                        const res = await ipc.invoke('download-sqlite-backup');
                        if (res.success) toast.success('Database backup saved successfully', { id: toastId });
                        else if (res.error === 'Cancelled') toast.dismiss(toastId);
                        else toast.error(res.error || 'Failed to save', { id: toastId });
                      } catch (e) {
                        toast.error(e.message, { id: toastId });
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Download size={16} /> Save Backup
                  </button>
                </div>

                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-indigo-900 flex items-center gap-2"><Download size={18} /> Export SQL File</h3>
                    <p className="text-sm text-indigo-700 mt-1">Export a full SQL dump (.sql) for migration, inspection, or manual recovery.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.require) return toast.error('Desktop app required');
                      const toastId = toast.loading('Exporting SQL file...');
                      try {
                        const ipc = window.require('electron').ipcRenderer;
                        const res = await ipc.invoke('download-sql-dump');
                        if (res.success) toast.success('SQL dump exported successfully', { id: toastId });
                        else if (res.error === 'Cancelled') toast.dismiss(toastId);
                        else toast.error(res.error || 'Failed to export SQL dump', { id: toastId });
                      } catch (e) {
                        toast.error(e.message, { id: toastId });
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Download size={16} /> Export .sql
                  </button>
                </div>

                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-orange-900 flex items-center gap-2"><Upload size={18} /> Restore Database</h3>
                    <p className="text-sm text-orange-700 mt-1">Upload a previously saved .db file. WARNING: This will overwrite current data!</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.require) return toast.error('Desktop app required');
                      if (!confirm('Are you sure you want to restore from a backup? ALL current local data will be permanently overwritten, and the app will restart.')) return;
                      
                      const toastId = toast.loading('Restoring database...');
                      try {
                        const ipc = window.require('electron').ipcRenderer;
                        const res = await ipc.invoke('restore-sqlite-backup');
                        if (res?.success) {
                          toast.success('Database restored successfully', { id: toastId });
                          setTimeout(() => window.location.reload(), 1500);
                        } else if (res?.error === 'Cancelled') {
                          toast.dismiss(toastId);
                        } else {
                          toast.error(res?.error || 'Failed to restore', { id: toastId });
                        }
                      } catch (e) {
                        toast.error(e.message, { id: toastId });
                      }
                    }}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Upload size={16} /> Restore Backup
                  </button>
                </div>

                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-rose-900 flex items-center gap-2"><Upload size={18} /> Restore SQL File</h3>
                    <p className="text-sm text-rose-700 mt-1">Import from a .sql dump file. WARNING: This will overwrite current local data!</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.require) return toast.error('Desktop app required');
                      if (!confirm('Are you sure you want to restore from an SQL file? ALL current local data will be permanently overwritten.')) return;

                      const toastId = toast.loading('Restoring SQL dump...');
                      try {
                        const ipc = window.require('electron').ipcRenderer;
                        const res = await ipc.invoke('restore-sql-dump');
                        if (res?.success) {
                          toast.success('SQL dump restored successfully', { id: toastId });
                          setTimeout(() => window.location.reload(), 1500);
                        } else if (res?.error === 'Cancelled') {
                          toast.dismiss(toastId);
                        } else {
                          toast.error(res?.error || 'Failed to restore SQL dump', { id: toastId });
                        }
                      } catch (e) {
                        toast.error(e.message, { id: toastId });
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Upload size={16} /> Restore .sql
                  </button>
                </div>
              </div>
            </SettingsSection>
          </div>
        )

      case 'cloud':
        return (
          <div className="flex flex-col gap-4">
            <div className="card p-4 mb-2" style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1px solid #bfdbfe' }}>
              <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                <Cloud size={18} />
                Local-only or Cloud-connected deployment
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Some customers stay fully local. Others subscribe to cloud sync and pay monthly or yearly for remote backup and multi-device access.
              </p>
            </div>

            <SettingsSection title="Deployment Mode">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => setDeploymentMode('local')}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-left transition-all',
                    cloudSubscription.deploymentMode === 'local'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <BadgeDollarSign size={16} className={cloudSubscription.deploymentMode === 'local' ? 'text-green-600' : 'text-gray-500'} />
                    <p className="font-bold text-sm text-gray-900">Local Only</p>
                  </div>
                  <p className="text-xs text-gray-500">No cloud save. Data stays on this device only.</p>
                </button>

                <button
                  onClick={() => setDeploymentMode('cloud')}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-left transition-all',
                    cloudSubscription.deploymentMode === 'cloud'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Cloud size={16} className={cloudSubscription.deploymentMode === 'cloud' ? 'text-blue-600' : 'text-gray-500'} />
                    <p className="font-bold text-sm text-gray-900">Cloud Sync</p>
                  </div>
                  <p className="text-xs text-gray-500">Remote sync + backup for subscribed customers.</p>
                </button>
              </div>
            </SettingsSection>

            {cloudSubscription.deploymentMode === 'cloud' ? (
              <>
                <SettingsSection title="Cloud Sync Configuration">
                  <div className="flex flex-col gap-5">
                    <Toggle
                      checked={cloudSettings.enabled}
                      onChange={(v) => updateCloudSettings({ enabled: v })}
                      label="Enable Automatic Cloud Sync"
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Customer / Company Name"
                        value={cloudSubscription.customerName || ''}
                        onChange={(e) => updateCloudSubscription({ customerName: e.target.value })}
                        placeholder="e.g. ABC Hotels"
                      />
                      <Input
                        label="Billing Email"
                        value={cloudSubscription.billingEmail || ''}
                        onChange={(e) => updateCloudSubscription({ billingEmail: e.target.value })}
                        placeholder="billing@company.com"
                      />
                    </div>

                    <Select label="Cloud Provider" value={cloudSettings.provider} onChange={(e) => updateCloudSettings({ provider: e.target.value })}>
                      <option value="firebase">Firebase Database</option>
                      <option value="supabase">Supabase</option>
                      <option value="aws">AWS RDS</option>
                      <option value="custom">Custom API Endpoint</option>
                    </Select>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Firebase Config (JSON format)
                      </label>
                      <textarea
                        value={cloudSettings.firebaseConfig || defaultFirebaseConfigJson()}
                        onChange={(e) => updateCloudSettings({ firebaseConfig: e.target.value })}
                        placeholder={'{\n  "apiKey": "AIzaSy...",\n  "authDomain": "...",\n  "projectId": "..."\n}'}
                        className="input-base text-xs font-mono w-full h-32 p-3 resize-y"
                      />
                    </div>

                    <Select label="Sync Interval" value={cloudSettings.syncInterval} onChange={(e) => updateCloudSettings({ syncInterval: parseInt(e.target.value) })}>
                      <option value="5">Every 5 minutes</option>
                      <option value="10">Every 10 minutes</option>
                      <option value="30">Every 30 minutes</option>
                      <option value="60">Hourly</option>
                    </Select>
                  </div>
                </SettingsSection>

                <SettingsSection title="Subscription Billing">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Billing Plan" value={cloudSubscription.plan} onChange={(e) => updateCloudSubscription({ plan: e.target.value })}>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </Select>
                    <Input
                      label="Status"
                      value={cloudSubscription.status}
                      onChange={(e) => updateCloudSubscription({ status: e.target.value })}
                      placeholder="active / inactive / past_due"
                    />
                    <Input
                      label="Monthly Fee"
                      type="number"
                      value={cloudSubscription.monthlyFee}
                      onChange={(e) => updateCloudSubscription({ monthlyFee: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                    <Input
                      label="Annual Fee"
                      type="number"
                      value={cloudSubscription.annualFee}
                      onChange={(e) => updateCloudSubscription({ annualFee: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Last Paid</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {cloudSubscription.lastPaidAt ? new Date(cloudSubscription.lastPaidAt).toLocaleString() : 'No payment yet'}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Next Due</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {cloudSubscription.nextDueAt ? new Date(cloudSubscription.nextDueAt).toLocaleDateString() : 'Not scheduled'}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Plan Amount</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {cloudSubscription.plan === 'annual'
                          ? `Rs. ${(cloudSubscription.annualFee || 0).toLocaleString()}`
                          : `Rs. ${(cloudSubscription.monthlyFee || 0).toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-4">
                    <Input
                      label="Notes"
                      value={cloudSubscription.notes || ''}
                      onChange={(e) => updateCloudSubscription({ notes: e.target.value })}
                      placeholder="Optional billing notes"
                    />

                    <div className="flex gap-2 flex-wrap">
                      <button className="btn-secondary" onClick={handleRecordCloudPayment}>
                        <Banknote size={14} />
                        Record Payment
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <History size={14} /> Payment History
                    </p>
                    {cloudSubscription.payments?.length ? (
                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                        {cloudSubscription.payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{payment.plan} payment</p>
                              <p className="text-xs text-gray-500">
                                {new Date(payment.paidAt).toLocaleString()} {payment.paidBy ? `· ${payment.paidBy}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-700">Rs. {(payment.amount || 0).toLocaleString()}</p>
                              <p className="text-xs text-gray-400">{payment.status || 'paid'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No subscription payments recorded yet.</p>
                    )}
                  </div>

                  <div className="border-t border-gray-100 mt-4 pt-4">
                    <button
                      className="btn-secondary w-fit"
                      disabled={testingConnection}
                      onClick={async () => {
                        if (!cloudSettings.firebaseConfig) {
                          toast.error('Please enter a Firebase config first.')
                          return
                        }
                        setTestingConnection(true)
                        try {
                          await testCloudConnection()
                          toast.success('Connection successful! Firebase is ready.')
                        } catch (err) {
                          console.error(err)
                          toast.error(`Connection failed: ${err.message}`)
                        } finally {
                          setTestingConnection(false)
                        }
                      }}
                    >
                      <Database size={14} />
                      {testingConnection ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                </SettingsSection>
              </>
            ) : (
              <SettingsSection title="Local Mode Active">
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
                  <p className="text-sm font-medium text-green-800">
                    This customer is running local-only. No cloud sync and no monthly fee are required.
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Switch to Cloud Sync only when the customer subscribes to monthly or annual billing.
                  </p>
                </div>
              </SettingsSection>
            )}
          </div>
        )

      case 'license':
        return (
          <SettingsSection title="License Management">
            <div className="flex flex-col gap-4">
              {licenseActive ? (
                <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
                  <CheckCircle size={24} className="text-green-600" />
                  <div>
                    <p className="font-bold text-green-800">License Active</p>
                    <p className="text-xs text-green-600">Your CeyPos POS is fully activated</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-700 font-medium">⚠ Running in Trial Mode</p>
                  <p className="text-xs text-amber-600 mt-1">Enter your license key to unlock all features</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <Input
                  label="License Key"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                />
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Activated License Key</p>
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className="font-mono text-sm break-all text-gray-900">
                      {licenseKey || 'No active license key'}
                    </span>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={handleCopyLicenseKey}
                      disabled={!licenseKey}
                      title="Copy activated license key"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This key is checked by the portal and desktop app when they start and while they stay open.
                  </p>
                </div>
              </div>
              <button
                className="btn-primary w-fit"
                disabled={activatingLicense}
                onClick={async () => {
                  if (!licenseInput) return

                  setActivatingLicense(true)
                  try {
                    const result = await validateLicense(licenseInput)
                    if (!result.valid) {
                      toast.error(result.error || 'License activation failed')
                      return
                    }

                    activateLicense(licenseInput, result)
                    showSaved()
                    toast.success('License activated successfully')
                  } finally {
                    setActivatingLicense(false)
                  }
                }}
              >
                <Shield size={14} />
                {activatingLicense ? 'Activating...' : 'Activate License'}
              </button>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400">Device ID: <span className="font-mono">PXM-{Math.random().toString(36).slice(2, 10).toUpperCase()}</span></p>
              </div>
            </div>
          </SettingsSection>
        )

      case 'users':
        return <StaffTab />

      case 'qr-ordering':
        return <QrOrderingTab />

      default:
        return null
    }
  }

  return (
    <div className="h-full overflow-hidden flex">
      {/* Settings sidebar */}
      <div
        className="w-52 shrink-0 flex flex-col py-4 px-3 gap-1 overflow-y-auto"
        style={{ background: 'white', borderRight: '1px solid #f0f0f0' }}
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">Settings</p>
        {allowedTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full',
              activeTab === id
                ? 'bg-green-50 text-green-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Icon size={16} className={activeTab === id ? 'text-green-600' : 'text-gray-400'} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6" style={{ background: '#f4f7f5' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h1>
          <button
            onClick={showSaved}
            className="btn-primary"
          >
            {saved ? <><CheckCircle size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
          </button>
        </div>
        <div className="max-w-4xl">
          {renderTab()}
        </div>
      </div>
    </div>
  )
}

