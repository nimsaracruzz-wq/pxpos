import React, { useState } from 'react'
import {
  Store, Receipt, Percent, Globe, Key, Shield,
  Printer, Barcode, Save, CheckCircle, ChevronRight,
  ShoppingBag, Utensils, Shirt, Pill, Truck, Cloud, Database, Users
} from 'lucide-react'
import { useAppStore, useAuthStore } from '@/store'
import { Toggle, Input, Select, SectionHeader, StatCard } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { testCloudConnection } from '@/lib/firebase'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'business', label: 'Business Info', icon: Store },
  { id: 'tax', label: 'Tax & Charges', icon: Percent },
  { id: 'modules', label: 'Modules', icon: ShoppingBag },
  { id: 'receipt', label: 'Receipt', icon: Receipt },
  { id: 'hardware', label: 'Hardware', icon: Printer },
  { id: 'cloud', label: 'Cloud Sync', icon: Cloud },
  { id: 'users', label: 'Staff & Roles', icon: Users },
  { id: 'license', label: 'License', icon: Key },
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

function UserForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || { name:'', username:'', password:'', barcode:'', role:'staff' })
  const isEdit = !!initial?.id
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
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">ID Badge / Barcode</label>
          <input className="input-base mt-1 text-sm font-mono" value={form.barcode} onChange={e=>setForm(f=>({...f,barcode:e.target.value}))} placeholder="e.g. STF-0042" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</label>
          <select className="input-base mt-1 text-sm w-full" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
            {ROLE_OPTIONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
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

  const handleAdd = async (form) => {
    if (!form.name || !form.username || !form.password) { toast.error('Name, username and password are required'); return }
    setSaving(true)
    const res = await addUser(form)
    setSaving(false)
    if (res?.success) { setShowAdd(false); toast.success('User created successfully!') }
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

        {showAdd && <UserForm onSave={handleAdd} onCancel={()=>setShowAdd(false)} saving={saving} />}

        <div className="flex flex-col gap-2">
          {users.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No users loaded yet...</p>}
          {users.map(u => (
            <div key={u.id}>
              {editing?.id === u.id ? (
                <UserForm initial={editing} onSave={handleEdit} onCancel={()=>setEditing(null)} saving={saving} />
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
                    <button onClick={()=>setEditing({...u,password:''})} className="btn-ghost text-xs py-1.5 px-3 border border-gray-200 hover:border-green-300 hover:text-green-600">Edit</button>
                    <button onClick={()=>handleDelete(u)} className="btn-ghost text-xs py-1.5 px-3 border border-red-100 text-red-400 hover:bg-red-50 hover:border-red-300">Delete</button>
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
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('business')
  const [saved, setSaved] = useState(false)
  const [licenseInput, setLicenseInput] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const toast = useToast()
  const {
    businessInfo, updateBusinessInfo,
    taxSettings, updateTaxSettings,
    serviceChargeSettings, updateServiceChargeSettings,
    receiptSettings, updateReceiptSettings,
    hardwareSettings, updateHardwareSettings,
    modules, toggleModule,
    licenseActive, activateLicense,
    cloudSettings, updateCloudSettings,
  } = useAppStore()
  const { hasPermission, users, roles } = useAuthStore()

  const allowedTabs = TABS.filter(t => t.id !== 'users' || hasPermission('manage_users'))

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
                🧩 Enable or disable business modules to customize Paxxmo POS for your specific needs.
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
              <Input label="Receipt Header Text" value={receiptSettings.header} onChange={(e) => updateReceiptSettings({ header: e.target.value })} placeholder="Custom header" />
              <Input label="Receipt Footer Text" value={receiptSettings.footer} onChange={(e) => updateReceiptSettings({ footer: e.target.value })} placeholder="Custom footer" />
              <Toggle checked={receiptSettings.showBarcode} onChange={(v) => updateReceiptSettings({ showBarcode: v })} label="Show barcode on receipt" />
              <Toggle checked={receiptSettings.showTax} onChange={(v) => updateReceiptSettings({ showTax: v })} label="Show tax breakdown" />
              <Toggle checked={receiptSettings.autoPrint} onChange={(v) => updateReceiptSettings({ autoPrint: v })} label="Auto-print on sale complete" />
              <Toggle checked={receiptSettings.showCashier} onChange={(v) => updateReceiptSettings({ showCashier: v })} label="Show cashier name" />
            </div>
          </SettingsSection>
        )

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
              </div>
            </SettingsSection>
            <SettingsSection title="Receipt Printer">
              <div className="flex flex-col gap-3">
                <Select label="Printer Type" value={hardwareSettings.printerType} onChange={(e) => updateHardwareSettings({ printerType: e.target.value })}>
                  <option value="Thermal (ESC/POS)">Thermal (ESC/POS)</option>
                  <option value="Desktop (Windows Print)">Desktop (Windows Print)</option>
                  <option value="PDF Export">PDF Export</option>
                </Select>
                <Input label="Printer Name / Port" value={hardwareSettings.printerPort} onChange={(e) => updateHardwareSettings({ printerPort: e.target.value })} placeholder="e.g. POS-58, COM3, USB001" />
                <Input label="Paper Width" value={hardwareSettings.paperWidth} onChange={(e) => updateHardwareSettings({ paperWidth: e.target.value })} placeholder="e.g. 80mm or 58mm" />
                <button className="btn-secondary w-fit">
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

      case 'cloud':
        return (
          <div className="flex flex-col gap-4">
            <div className="card p-4 mb-2" style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1px solid #bfdbfe' }}>
              <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                <Cloud size={18} />
                Real-Time Cloud Synchronization
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Sync your data to a remote database (e.g. Firebase, Supabase) for multi-device support, remote access, and secure backups.
              </p>
            </div>
            
            <SettingsSection title="Cloud Configuration">
              <div className="flex flex-col gap-5">
                <Toggle
                  checked={cloudSettings.enabled}
                  onChange={(v) => updateCloudSettings({ enabled: v })}
                  label="Enable Automatic Cloud Sync"
                />
                
                {cloudSettings.enabled && (
                  <div className="flex flex-col gap-4 animate-fade-in pt-2">
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
                        value={cloudSettings.firebaseConfig}
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

                    <div className="border-t border-gray-100 mt-2 pt-4">
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
                  </div>
                )}
              </div>
            </SettingsSection>
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
                    <p className="text-xs text-green-600">Your Paxxmo POS is fully activated</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-700 font-medium">⚠ Running in Trial Mode</p>
                  <p className="text-xs text-amber-600 mt-1">Enter your license key to unlock all features</p>
                </div>
              )}
              <Input
                label="License Key"
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
              />
              <button
                className="btn-primary w-fit"
                onClick={() => {
                  if (licenseInput) {
                    activateLicense(licenseInput)
                    showSaved()
                  }
                }}
              >
                <Shield size={14} />
                Activate License
              </button>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400">Device ID: <span className="font-mono">PXM-{Math.random().toString(36).slice(2, 10).toUpperCase()}</span></p>
              </div>
            </div>
          </SettingsSection>
        )

      case 'users':
        return <StaffTab />


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
      <div className="flex-1 overflow-y-auto p-6">
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
        {renderTab()}
      </div>
    </div>
  )
}
