import React, { useState, useEffect } from 'react'
import { Lock, ScanBarcode, User, Loader2, Zap, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store'
import { useToast } from '@/components/Toast'
import { BRAND } from '@/lib/brand'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [scanPulse, setScanPulse] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loginByBarcode } = useAuthStore()
  const toast = useToast()

  // Background barcode scanner listener
  useEffect(() => {
    let barcode = ''
    let timer = null
    const handleKeyDown = async (e) => {
      if (e.key === 'Enter' && barcode.length > 3) {
        const code = barcode
        barcode = ''
        const ok = await loginByBarcode(code)
        if (!ok) {
          toast.error('Unrecognized namecard barcode')
          setErrorText('Invalid badge or user not found')
        } else {
          setErrorText('')
        }
        return
      }
      if (e.key.length === 1) {
        barcode += e.key
        clearTimeout(timer)
        timer = setTimeout(() => { barcode = '' }, 50)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loginByBarcode, toast])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setErrorText('Please enter both username and password')
      toast.error('Please enter username and password')
      return
    }
    setErrorText('')
    setLoading(true)
    const ok = await login(username, password)
    setLoading(false)
    if (!ok) {
      setErrorText('Invalid username or password')
      toast.error('Invalid username or password')
      setPassword('')
    }
  }

  const simulateScan = () => {
    setScanPulse(true)
    setTimeout(() => setScanPulse(false), 2200)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f1a12] p-4">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-30" style={{
        backgroundImage: 'linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div className="pointer-events-none absolute -left-28 -top-28 z-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,#16a34a,transparent)] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 z-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,#15803d,transparent)] blur-[80px]" />
      <div className="pointer-events-none absolute left-[58%] top-[48%] z-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,#166534,transparent)] blur-[80px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div className="w-full max-w-[420px] rounded-[24px] border border-[rgba(34,197,94,0.12)] bg-[#131f16] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(34,197,94,0.06)] sm:px-10 sm:py-10">
          <div className="mx-auto mb-8 h-[2px] w-[80%] rounded bg-gradient-to-r from-transparent via-[#22c55e] to-transparent" />

          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#16a34a] to-[#15803d] shadow-[0_8px_32px_rgba(22,163,74,0.4)]">
              <Zap size={30} color="white" />
            </div>
            <h1 className="text-[30px] font-extrabold leading-none text-[#f0fdf4]" style={{ fontFamily: 'Syne, DM Sans, sans-serif' }}>{BRAND.name} <span className="text-[#22c55e]">POS</span></h1>
            <p className="mt-2 text-[13px] text-[#6b8f72]">Secure staff login</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[1.2px] text-[#6b8f72]">Username</label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b8f72]" />
                <input
                  autoFocus
                  className="w-full rounded-xl border border-[#1f3325] bg-[#0a1209] py-3.5 pl-11 pr-3 text-sm text-[#f0fdf4] outline-none transition focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.35)]"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  autoComplete="username"
                  spellCheck={false}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10.5px] font-bold uppercase tracking-[1.2px] text-[#6b8f72]">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b8f72]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-xl border border-[#1f3325] bg-[#0a1209] py-3.5 pl-11 pr-10 text-sm text-[#f0fdf4] outline-none transition focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(34,197,94,0.35)]"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#6b8f72] transition hover:text-[#22c55e]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errorText && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle size={12} /> {errorText}
                </p>
              )}
            </div>

            <label className="mt-1 inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only"
              />
              <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition ${rememberMe ? 'border-[#16a34a] bg-[#16a34a]' : 'border-[#1f3325] bg-[#0a1209]'}`}>
                {rememberMe && <Check size={11} color="white" />}
              </span>
              <span className="text-[13px] text-[#6b8f72]">Keep me signed in on this device</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-[13px] bg-gradient-to-br from-[#16a34a] to-[#15803d] py-3.5 text-sm font-bold tracking-[0.4px] text-white shadow-[0_4px_20px_rgba(22,163,74,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_28px_rgba(22,163,74,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ fontFamily: 'Syne, DM Sans, sans-serif' }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <Lock size={15} /> Secure Login
                </>
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1f3325]" />
            <span className="text-[11px] tracking-[0.5px] text-[#6b8f72]">OR USE ID BADGE</span>
            <div className="h-px flex-1 bg-[#1f3325]" />
          </div>

          <button
            type="button"
            onClick={simulateScan}
            className={`mb-6 flex w-full items-center justify-center gap-2 rounded-[13px] border py-3 text-[13px] font-medium transition ${scanPulse ? 'border-[#16a34a] bg-[rgba(34,197,94,0.18)] text-[#22c55e]' : 'border-[#1f3325] bg-transparent text-[#6b8f72] hover:border-[#16a34a] hover:bg-[rgba(34,197,94,0.18)] hover:text-[#22c55e]'}`}
          >
            <span className="h-[7px] w-[7px] rounded-full bg-[#22c55e]" />
            <ScanBarcode size={17} />
            {scanPulse ? 'Scanning... hold badge steady' : 'Scan ID Badge to Login'}
          </button>

          <div className="flex items-center justify-center gap-2 border-t border-[#1f3325] pt-4 text-[11px] text-[#2d4a35]">
            <span>{BRAND.name}</span>
            <span className="h-1 w-1 rounded-full bg-[#2d4a35]" />
            <span>{BRAND.website}</span>
            <span className="h-1 w-1 rounded-full bg-[#2d4a35]" />
            <span>Secure Login</span>
            <span className="h-1 w-1 rounded-full bg-[#2d4a35]" />
            <span>© 2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
