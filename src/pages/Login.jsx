import React, { useState, useEffect } from 'react'
import { Lock, ScanBarcode, User, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store'
import { useToast } from '@/components/Toast'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
        if (!ok) toast.error('Unrecognized namecard barcode')
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
    if (!username || !password) { toast.error('Please enter username and password'); return }
    setLoading(true)
    const ok = await login(username, password)
    setLoading(false)
    if (!ok) toast.error('Invalid username or password')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="card p-8 max-w-md w-full relative overflow-hidden shadow-2xl border-0">
        <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200">
            <Lock size={28} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Paxxmo POS</h1>
          <p className="text-sm text-gray-500 mt-2">Enter credentials or scan your ID badge</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Username</label>
            <div className="relative mt-1">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                className="input-base pl-10 h-12 text-sm"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin"
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                className="input-base pl-10 h-12 tracking-widest text-lg"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3.5 mt-2 text-base font-bold shadow-lg shadow-green-500/20 disabled:opacity-60"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Secure Login'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t flex flex-col items-center justify-center text-gray-400">
          <ScanBarcode size={32} className="mb-2 opacity-60 text-green-500" />
          <p className="text-xs font-medium text-center">Ready for Barcode Scan</p>
        </div>
      </div>
    </div>
  )
}

