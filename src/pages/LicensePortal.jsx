import React, { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Plus, RefreshCcw, Search, ShieldCheck, ShieldOff, Trash2, Pencil, RotateCcw, Loader2, LogOut, Lock, UserPlus, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { Button, Input, Modal, Select, Badge } from '@/components/ui'
import { BRAND } from '@/lib/brand'
import { deleteLicense, generateLicenseKey, listLicenses, resetLicenseDevice, setLicenseStatus, upsertLicense } from '@/lib/license'
import { clearPortalSession, createPortalAdmin, getPortalSession, listPortalAdmins, verifyPortalLogin } from '@/lib/portalAuth'

const PLAN_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
]

function formatDate(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

function statusVariant(active) {
  return active ? 'green' : 'red'
}

function normalizeActivatedDevices(license = {}) {
  const list = Array.isArray(license.activatedDevices) ? license.activatedDevices : []
  if (list.length > 0) {
    return list
      .map((item) => ({
        deviceId: String(item?.deviceId || '').trim(),
        hostname: String(item?.hostname || '').trim(),
        ipAddresses: Array.isArray(item?.ipAddresses)
          ? item.ipAddresses.map((ip) => String(ip || '').trim()).filter(Boolean)
          : [],
        lastIp: String(item?.lastIp || '').trim(),
        activatedAt: item?.activatedAt || null,
        lastSeen: item?.lastSeen || null,
      }))
      .filter((item) => item.deviceId)
  }

  if (license.deviceId) {
    return [{
      deviceId: String(license.deviceId || '').trim(),
      hostname: '',
      ipAddresses: [],
      lastIp: '',
      activatedAt: license.activatedAt || null,
      lastSeen: license.lastSeen || null,
    }]
  }

  return []
}

function deviceIps(device = {}) {
  const fromArray = Array.isArray(device.ipAddresses) ? device.ipAddresses.filter(Boolean) : []
  const withLast = device.lastIp && !fromArray.includes(device.lastIp)
    ? [...fromArray, device.lastIp]
    : fromArray
  return withLast.length > 0 ? withLast.join(', ') : '-'
}

function emptyForm() {
  return {
    key: generateLicenseKey('CEY'),
    businessName: '',
    businessEmail: '',
    ownerName: '',
    plan: 'basic',
    expiresAt: '',
    notes: '',
    active: true,
    maxDevices: 1,
    activatedDevices: [],
    deviceId: '',
    activatedAt: '',
    lastSeen: '',
    createdAt: '',
  }
}

export default function LicensePortal() {
  const portalUrl = 'https://ceypos.paxxmo.com/license-portal'
  const toast = useToast()
  const [portalSession, setPortalSession] = useState(() => getPortalSession())
  const [portalAdmins, setPortalAdmins] = useState([])
  const [authLoading, setAuthLoading] = useState(true)
  const [authSaving, setAuthSaving] = useState(false)
  const [authError, setAuthError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [setupForm, setSetupForm] = useState({ fullName: '', username: '', password: '' })
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(emptyForm())

  const loadPortalAdmins = async () => {
    try {
      const items = await listPortalAdmins()
      setPortalAdmins(items)
    } catch (error) {
      toast.error(error?.message || 'Unable to load portal admins')
    }
  }

  const loadLicenses = async () => {
    setLoading(true)
    try {
      const items = await listLicenses()
      setLicenses(items)
    } catch (error) {
      toast.error(error?.message || 'Unable to load licenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setAuthLoading(true)
      await loadPortalAdmins()
      const session = getPortalSession()
      setPortalSession(session)
      setAuthLoading(false)
      if (session) {
        await loadLicenses()
      }
    }
    init()
  }, [])

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthSaving(true)
    setAuthError('')
    try {
      const result = await verifyPortalLogin(loginForm)
      if (!result.success) {
        setAuthError(result.error || 'Login failed')
        toast.error(result.error || 'Login failed')
        return
      }
      setPortalSession(result.user)
      toast.success('Portal login successful')
      setLoginForm({ username: '', password: '' })
      await loadLicenses()
    } catch (error) {
      const message = error?.message || 'Unable to login'
      setAuthError(message)
      toast.error(message)
    } finally {
      setAuthSaving(false)
    }
  }

  const handleCreateFirstAdmin = async (event) => {
    event.preventDefault()
    setAuthSaving(true)
    setAuthError('')
    try {
      await createPortalAdmin({
        username: setupForm.username,
        password: setupForm.password,
        fullName: setupForm.fullName,
        role: 'super_admin',
      })
      toast.success('Portal admin created')
      setSetupForm({ fullName: '', username: '', password: '' })
      await loadPortalAdmins()
      const result = await verifyPortalLogin({ username: setupForm.username, password: setupForm.password })
      if (result.success) {
        setPortalSession(result.user)
        await loadLicenses()
      }
    } catch (error) {
      const message = error?.message || 'Unable to create portal admin'
      setAuthError(message)
      toast.error(message)
    } finally {
      setAuthSaving(false)
    }
  }

  const handleLogout = () => {
    clearPortalSession()
    setPortalSession(null)
    toast.success('Logged out')
  }

  const stats = useMemo(() => {
    const total = licenses.length
    const active = licenses.filter((license) => license.active).length
    const inactive = licenses.filter((license) => !license.active).length
    const expiringSoon = licenses.filter((license) => {
      if (!license.expiresAt) return false
      const expiresAt = new Date(license.expiresAt)
      if (Number.isNaN(expiresAt.getTime())) return false
      const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= 30
    }).length
    return { total, active, inactive, expiringSoon }
  }, [licenses])

  const filteredLicenses = useMemo(() => {
    const term = search.trim().toLowerCase()
    return licenses.filter((license) => {
      const matchesSearch = !term || [license.key, license.businessName, license.businessEmail, license.ownerName, license.plan]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
      const matchesStatus = activeOnly === 'all' || String(Boolean(license.active)) === activeOnly
      return matchesSearch && matchesStatus
    })
  }, [licenses, search, activeOnly])

  const openCreate = () => {
    setEditing(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (license) => {
    const devices = normalizeActivatedDevices(license)
    setEditing({
      key: license.key || '',
      businessName: license.businessName || '',
      businessEmail: license.businessEmail || '',
      ownerName: license.ownerName || '',
      plan: license.plan || 'basic',
      expiresAt: license.expiresAt ? String(license.expiresAt).slice(0, 10) : '',
      notes: license.notes || '',
      active: Boolean(license.active),
      maxDevices: Number(license.maxDevices || 1),
      activatedDevices: devices,
      deviceId: license.deviceId || '',
      activatedAt: license.activatedAt || '',
      lastSeen: license.lastSeen || '',
      createdAt: license.createdAt || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editing.key.trim()) {
      toast.error('License key is required')
      return
    }
    setSaving(true)
    try {
      await upsertLicense({
        ...editing,
        maxDevices: Math.max(1, parseInt(editing.maxDevices, 10) || 1),
        expiresAt: editing.expiresAt ? new Date(editing.expiresAt).toISOString() : null,
      })
      toast.success('License saved')
      setModalOpen(false)
      await loadLicenses()
    } catch (error) {
      toast.error(error?.message || 'Unable to save license')
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }

  const handleToggle = async (license) => {
    setSaving(true)
    try {
      await setLicenseStatus(license.key, !license.active)
      toast.success(`License ${license.active ? 'deactivated' : 'activated'}`)
      await loadLicenses()
    } catch (error) {
      toast.error(error?.message || 'Unable to update license status')
    } finally {
      setSaving(false)
    }
  }

  const handleResetDevice = async (license) => {
    if (!window.confirm(`Reset device lock for ${license.key}?`)) return
    setSaving(true)
    try {
      await resetLicenseDevice(license.key)
      toast.success('Device lock reset')
      await loadLicenses()
    } catch (error) {
      toast.error(error?.message || 'Unable to reset device lock')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (license) => {
    if (!window.confirm(`Delete license ${license.key}? This cannot be undone.`)) return
    setSaving(true)
    try {
      await deleteLicense(license.key)
      toast.success('License deleted')
      await loadLicenses()
    } catch (error) {
      toast.error(error?.message || 'Unable to delete license')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-2 text-slate-300">
          <Loader2 className="animate-spin" size={18} /> Loading portal...
        </div>
      </div>
    )
  }

  if (!portalSession) {
    const hasAdmins = portalAdmins.length > 0

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-6">
          <div className="text-center mb-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/80 font-bold">{BRAND.name} Portal</p>
            <h1 className="text-3xl font-black mt-2">License Management Login</h1>
            <p className="text-sm text-slate-300 mt-2">
              Sign in to manage licenses or create the first super-admin portal account.
            </p>
          </div>

          {!hasAdmins ? (
            <form className="space-y-4" onSubmit={handleCreateFirstAdmin}>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                No portal admin exists yet. Create the first super-admin account below.
              </div>
              <Input
                label="Your Name"
                value={setupForm.fullName}
                onChange={(e) => setSetupForm((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="e.g. Nimsara"
              />
              <Input
                label="Username"
                value={setupForm.username}
                onChange={(e) => setSetupForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="superadmin"
              />
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={setupForm.password}
                  onChange={(e) => setSetupForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Choose a strong password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-[42px] text-slate-400 hover:text-white"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {authError && <p className="text-sm text-red-300">{authError}</p>}
              <Button type="submit" className="w-full" disabled={authSaving}>
                {authSaving ? <Loader2 className="animate-spin" size={15} /> : <UserPlus size={15} />}
                Create Portal Admin
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                Portal access is restricted to authorized admins only.
              </div>
              <Input
                label="Username"
                value={loginForm.username}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="superadmin"
              />
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter portal password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-[42px] text-slate-400 hover:text-white"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {authError && <p className="text-sm text-red-300">{authError}</p>}
              <Button type="submit" className="w-full" disabled={authSaving}>
                {authSaving ? <Loader2 className="animate-spin" size={15} /> : <Lock size={15} />}
                Login to Portal
              </Button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/80 font-bold">Super Admin Portal</p>
              <h1 className="text-3xl font-black mt-2">License Management</h1>
              <p className="text-sm text-slate-300 mt-2 max-w-2xl">
                Create, activate, revoke, and transfer licenses for {BRAND.name}. Data is stored in your Firebase <span className="font-mono">licenses</span> collection.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Direct link: <span className="font-mono text-emerald-300">{portalUrl}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Logged in as: <span className="text-white font-semibold">{portalSession.fullName || portalSession.username}</span>
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" onClick={handleLogout} disabled={saving}>
                <LogOut size={15} /> Logout
              </Button>
              <Button variant="secondary" onClick={loadLicenses} disabled={loading || saving}>
                <RefreshCcw size={15} /> Refresh
              </Button>
              <Button onClick={openCreate} disabled={saving}>
                <Plus size={15} /> New License
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Total', value: stats.total },
              { label: 'Active', value: stats.active },
              { label: 'Inactive', value: stats.inactive },
              { label: 'Expiring 30d', value: stats.expiringSoon },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-bold">{stat.label}</p>
                <p className="text-3xl font-black mt-2">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3 mt-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by key, business, email, owner, plan"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <Select value={activeOnly} onChange={(e) => setActiveOnly(e.target.value)}>
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-10 flex items-center justify-center text-slate-300 gap-2">
              <Loader2 className="animate-spin" size={18} /> Loading licenses...
            </div>
          ) : filteredLicenses.length === 0 ? (
            <div className="p-10 text-center text-slate-300">
              <KeyRound className="mx-auto mb-3 text-slate-500" size={36} />
              No licenses found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-[0.14em] text-[11px]">
                  <tr>
                    <th className="text-left px-4 py-3">License</th>
                    <th className="text-left px-4 py-3">Business</th>
                    <th className="text-left px-4 py-3">Plan</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Devices</th>
                    <th className="text-left px-4 py-3">Expiry</th>
                    <th className="text-left px-4 py-3">Last Seen</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((license) => {
                    const devices = normalizeActivatedDevices(license)
                    const maxDevices = Math.max(1, Number(license.maxDevices || 1))
                    return (
                    <tr key={license.key} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-4 py-4 align-top">
                        <div className="font-mono font-bold text-white flex items-center gap-2">
                          {license.key}
                          <button className="text-slate-400 hover:text-white" onClick={() => handleCopy(license.key)} title="Copy key">
                            <Copy size={13} />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Created {formatDate(license.createdAt)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-white">{license.businessName || 'Unnamed business'}</div>
                        <div className="text-xs text-slate-400">{license.businessEmail || license.ownerName || '-'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant="blue">{license.plan || 'basic'}</Badge>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant={statusVariant(license.active)}>
                          {license.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {devices.length} / {maxDevices} device slots used
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-300 max-w-[280px]">
                        {devices.length === 0 ? (
                          <span className="font-mono">-</span>
                        ) : (
                          <div className="space-y-2">
                            {devices.slice(0, 2).map((device) => (
                              <div key={device.deviceId} className="rounded-lg border border-white/10 bg-slate-900/60 p-2">
                                <p className="font-mono break-all text-[11px] text-white">{device.deviceId}</p>
                                <p className="text-[11px] text-slate-400">IP: {deviceIps(device)}</p>
                              </div>
                            ))}
                            {devices.length > 2 && (
                              <p className="text-[11px] text-emerald-300">+{devices.length - 2} more device(s)</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-slate-300">
                        {formatDate(license.expiresAt)}
                      </td>
                      <td className="px-4 py-4 align-top text-slate-300">
                        {formatDate(license.lastSeen)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(license)}>
                            <Pencil size={13} /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggle(license)} disabled={saving}>
                            {license.active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                            {license.active ? 'Revoke' : 'Activate'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleResetDevice(license)} disabled={saving}>
                            <RotateCcw size={13} /> Reset Device
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(license)} disabled={saving}>
                            <Trash2 size={13} /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing.createdAt ? 'Edit License' : 'Create License'}
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="License Key" value={editing.key} onChange={(e) => setEditing((prev) => ({ ...prev, key: e.target.value.toUpperCase() }))} placeholder="CEY-XXXX-XXXX-XXXX-XXXX" />
          <Select label="Plan" value={editing.plan} onChange={(e) => setEditing((prev) => ({ ...prev, plan: e.target.value }))}>
            {PLAN_OPTIONS.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}
          </Select>
          <Input label="Business Name" value={editing.businessName} onChange={(e) => setEditing((prev) => ({ ...prev, businessName: e.target.value }))} />
          <Input label="Business Email" value={editing.businessEmail} onChange={(e) => setEditing((prev) => ({ ...prev, businessEmail: e.target.value }))} />
          <Input label="Owner Name" value={editing.ownerName} onChange={(e) => setEditing((prev) => ({ ...prev, ownerName: e.target.value }))} />
          <Input
            label="Allowed Devices"
            type="number"
            min={1}
            max={50}
            value={editing.maxDevices}
            onChange={(e) => setEditing((prev) => ({ ...prev, maxDevices: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)) }))}
          />
          <Input label="Expiry Date" type="date" value={editing.expiresAt} onChange={(e) => setEditing((prev) => ({ ...prev, expiresAt: e.target.value }))} />
          <Input label="Device ID" value={editing.deviceId} onChange={(e) => setEditing((prev) => ({ ...prev, deviceId: e.target.value }))} placeholder="Leave blank for unassigned" />
          <Select label="Status" value={String(Boolean(editing.active))} onChange={(e) => setEditing((prev) => ({ ...prev, active: e.target.value === 'true' }))}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Activated Devices & IPs</p>
            {editing.activatedDevices?.length ? (
              <div className="mt-3 space-y-2">
                {editing.activatedDevices.map((device) => (
                  <div key={device.deviceId} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="font-mono text-xs text-white break-all">{device.deviceId}</p>
                    <p className="text-xs text-slate-400 mt-1">Host: {device.hostname || '-'}</p>
                    <p className="text-xs text-slate-400 mt-1">IP: {deviceIps(device)}</p>
                    <p className="text-xs text-slate-500 mt-1">Activated: {formatDate(device.activatedAt)} · Last seen: {formatDate(device.lastSeen)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-3">No devices have activated this license yet.</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Notes</label>
            <textarea
              value={editing.notes}
              onChange={(e) => setEditing((prev) => ({ ...prev, notes: e.target.value }))}
              className="input-base w-full min-h-[100px] p-3"
              placeholder="Internal license notes"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
            Save License
          </Button>
        </div>
      </Modal>
    </div>
  )
}
