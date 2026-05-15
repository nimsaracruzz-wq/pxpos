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
  const passwordRef = React.useRef(null)

  // Background barcode scanner listener
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = 0
    const BARCODE_SPEED_MS = 60 // chars faster than this = scanner input
    const MIN_BARCODE_LEN  = 3

    const handleKeyDown = async (e) => {
      const now = Date.now()
      
      if (e.key === 'Enter') {
        const code = buffer.trim()
        buffer = ''
        
        if (code.length < MIN_BARCODE_LEN) return
        
        e.preventDefault()
        
        const active = document.activeElement
        if (active && active.tagName.toLowerCase() === 'input') {
          active.value = ''
          active.blur()
        }

        const ok = await loginByBarcode(code)
        if (!ok) {
          toast.error(`Unrecognized barcode: ${code}`)
          setErrorText(`Barcode "${code}" is not linked to any active user.`)
        } else {
          setUsername('')
          setPassword('')
          setErrorText('')
          setShowPassword(false)
        }
        return
      }

      if (e.key.length === 1) {
        if (now - lastKeyTime > BARCODE_SPEED_MS * 3) buffer = '' // too slow — reset
        buffer += e.key
        lastKeyTime = now
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#2F3E46] p-6 relative overflow-hidden font-sans">
      {/* Premium Background Ambient Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#52BF90]/20 to-[#317256]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-[#52BF90]/20 to-[#317256]/10 blur-[120px] pointer-events-none" />
      
      {/* Subtle grid pattern for depth */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)',
        backgroundSize: '36px 36px'
      }} />

      <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-[0_32px_64px_rgba(0,0,0,0.3)] border border-white/20 p-8 sm:p-10 relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/ceypos_logo_png.png" alt="CeyPos Logo" className="h-16 w-auto object-contain drop-shadow-sm" />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-[#2F3E46] tracking-tight">Sign In</h2>
          <p className="text-[14px] text-gray-500 mt-2 font-medium">Access your point of sale system</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Username</label>
            <div className="relative group">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#52BF90] transition-colors pointer-events-none" />
              <input
                autoFocus
                className="w-full rounded-[16px] border border-gray-200 bg-gray-50/50 py-3.5 pl-11 pr-4 text-[15px] font-bold text-[#2F3E46] outline-none transition-all placeholder:text-gray-300 focus:bg-white focus:border-[#52BF90] focus:ring-4 focus:ring-[#52BF90]/10"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (!e.currentTarget.value?.trim()) {
                      passwordRef.current?.focus()
                    }
                  }
                }}
                placeholder="Enter username"
                autoComplete="username"
                spellCheck={false}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">Password</label>
              <button type="button" className="text-[11px] font-bold text-[#52BF90] hover:text-[#317256] transition-colors pr-1">Forgot?</button>
            </div>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#52BF90] transition-colors pointer-events-none" />
              <input
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-[16px] border border-gray-200 bg-gray-50/50 py-3.5 pl-11 pr-12 text-[15px] font-bold text-[#2F3E46] outline-none transition-all placeholder:text-gray-300 focus:bg-white focus:border-[#52BF90] focus:ring-4 focus:ring-[#52BF90]/10"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {errorText && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600 border border-red-100 animate-slide-up">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> 
                <p>{errorText}</p>
              </div>
            )}
          </div>

          <label className="mt-4 flex items-center gap-2.5 group cursor-pointer w-max pl-1">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="sr-only"
            />
            <span className={`flex h-[20px] w-[20px] items-center justify-center rounded-[6px] border-[1.5px] transition-all ${rememberMe ? 'border-[#52BF90] bg-[#52BF90]' : 'border-gray-300 bg-white group-hover:border-gray-400'}`}>
              {rememberMe && <Check size={13} color="white" strokeWidth={3.5} />}
            </span>
            <span className="text-[13px] font-semibold text-gray-500 select-none">Remember me</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-[16px] py-4 text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(82,191,144,0.25)] active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
            style={{ background: 'linear-gradient(to right, #52BF90, #317256)', height: 54 }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-[1px] flex-1 bg-gray-100" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">or</span>
          <div className="h-[1px] flex-1 bg-gray-100" />
        </div>

        <button
          type="button"
          onClick={simulateScan}
          className={`flex w-full items-center justify-center gap-2.5 rounded-[16px] border py-3.5 text-[14px] font-bold transition-all ${scanPulse ? 'border-[#52BF90] bg-[#52BF90]/5 text-[#317256]' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'} active:scale-[0.98]`}
        >
          <ScanBarcode size={18} className={scanPulse ? 'text-[#52BF90]' : 'text-gray-400'} />
          {scanPulse ? 'Scanning...' : 'Scan ID Badge'}
        </button>
        
        <div className="mt-8 pt-6 border-t border-gray-50 flex justify-center text-[12px] font-semibold text-gray-400">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
