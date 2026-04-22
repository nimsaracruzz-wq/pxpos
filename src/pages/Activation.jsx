import React, { useState, useEffect } from 'react'
import { validateLicense } from '@/lib/license'
import { useAppStore } from '@/store'
import { BRAND } from '@/lib/brand'
import { KeyRound, ShieldCheck, Sun, Moon, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export default function Activation() {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | error | success
  const [message, setMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const activateLicense = useAppStore((s) => s.activateLicense)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleInput(e) {
    const normalized = e.target.value
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9-]/g, '')
    setKey(normalized)
    
    // Auto-clear error when user starts typing again
    if (status === 'error') {
      setStatus('idle')
      setMessage('')
    }
  }

  async function handleActivate(e) {
    e.preventDefault()
    if (key.trim().length < 8) {
      setStatus('error')
      setMessage('Please enter a valid format license key')
      return
    }
    setStatus('loading')
    setMessage('')
    const result = await validateLicense(key)
    if (result.valid) {
      setStatus('success')
      setMessage(`Welcome to ${BRAND.name}, ${result.businessName}!`)
      setTimeout(() => activateLicense(key, result), 1500)
    } else {
      setStatus('error')
      setMessage(result.error)
    }
  }

  if (!mounted) return null

  return (
    <div className={`min-h-screen relative flex items-center justify-center overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f4f7f5]'}`}>
      
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full mix-blend-multiply filter blur-[80px] opacity-70 animate-pulse-slow" 
           style={{ backgroundColor: isDark ? 'rgba(79, 70, 229, 0.15)' : 'rgba(16, 185, 129, 0.15)', animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse-slow" 
           style={{ backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : 'rgba(52, 211, 153, 0.15)', animationDuration: '12s' }} />

      {/* Theme Toggle Overlay */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-2xl backdrop-blur-md shadow-sm border transition-all duration-300 hover:scale-105 active:scale-95"
        style={{
          background: isDark ? 'rgba(39,39,42,0.6)' : 'rgba(255,255,255,0.7)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        }}
      >
        {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-500" />}
      </button>

      {/* Main Activation Card */}
      <main className="relative z-10 w-full max-w-[480px] p-6 lg:p-0">
        <div 
          className="rounded-[32px] overflow-hidden backdrop-blur-2xl transition-all duration-500"
          style={{
            background: isDark ? 'rgba(24,24,27,0.65)' : 'rgba(255,255,255,0.85)',
            boxShadow: isDark 
              ? '0 0 0 1px rgba(255,255,255,0.05), 0 30px 60px rgba(0,0,0,0.6)' 
              : '0 0 0 1px rgba(0,0,0,0.02), 0 30px 60px rgba(0,0,0,0.06)',
          }}
        >
          <div className="p-10 sm:p-12">
            
            {/* Header Area */}
            <div className="flex flex-col items-center mb-10 text-center">
              <div 
                className="w-20 h-20 rounded-[24px] flex items-center justify-center mb-6 shadow-xl relative"
                style={{
                  background: isDark ? 'linear-gradient(135deg, #4f46e5, #9333ea)' : 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: isDark ? '0 12px 30px rgba(79,70,229,0.3)' : '0 12px 30px rgba(16,185,129,0.3)'
                }}
              >
                {/* Embedded subtle glow behind icon */}
                <div className="absolute inset-0 bg-white opacity-20 rounded-[24px] rounded-br-[48px]" />
                <ShieldCheck className="w-9 h-9 text-white relative z-10" />
              </div>
              
              <h1 className="text-3xl font-black tracking-tight mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Activate {BRAND.name}
              </h1>
              <p className="text-[15px] font-medium" style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}>
                Securely bind this device to your business.
              </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleActivate} className="flex flex-col gap-6">
              
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest pl-1" style={{ color: isDark ? '#71717a' : '#9ca3af' }}>
                  License Key
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="w-5 h-5 transition-colors duration-200" style={{ color: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : isDark ? '#52525b' : '#9ca3af' }} />
                  </div>
                  <input
                    type="text"
                    value={key}
                    onChange={handleInput}
                    placeholder="ENTER-YOUR-KEY-HERE"
                    maxLength={30}
                    disabled={status === 'loading' || status === 'success'}
                    autoFocus
                    className="w-full pl-12 pr-4 py-4 rounded-2xl outline-none text-center tracking-widest font-mono text-lg font-bold transition-all duration-300"
                    style={{
                      background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(243,244,246,0.6)',
                      color: isDark ? '#ffffff' : '#111827',
                      border: `1.5px solid ${
                        status === 'error' ? 'rgba(239, 68, 68, 0.4)' 
                        : status === 'success' ? 'rgba(16, 185, 129, 0.4)' 
                        : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                      }`,
                      boxShadow: status === 'error' 
                        ? '0 0 0 4px rgba(239,68,68,0.08)' 
                        : status === 'success' ? '0 0 0 4px rgba(16,185,129,0.08)' : 'none'
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Status / Error Panel */}
              <div className={`overflow-hidden transition-all duration-300 ease-out flex flex-col gap-3 ${message ? 'max-h-[100px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border" style={{
                  background: status === 'error' ? (isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(254, 226, 226, 0.5)') : (isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(209, 250, 229, 0.5)'),
                  borderColor: status === 'error' ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(252, 165, 165, 0.5)') : (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(167, 243, 208, 0.5)'),
                }}>
                  {status === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />}
                  <p className="text-sm font-medium leading-relaxed" style={{ color: status === 'error' ? (isDark ? '#fca5a5' : '#b91c1c') : (isDark ? '#6ee7b7' : '#047857') }}>
                    {message}
                  </p>
                </div>
              </div>

              <div className="mt-2">
                <button
                  type="submit"
                  disabled={status === 'loading' || status === 'success' || !key}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
                  style={{
                    background: status === 'success' 
                      ? (isDark ? '#10b981' : '#059669')
                      : (isDark ? '#4f46e5' : '#10b981'),
                  }}
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Validating Securely...
                    </>
                  ) : status === 'success' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      System Verified
                    </>
                  ) : (
                    <>
                      Activate Software
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
            
          </div>
          
          {/* Footer Ribbon */}
          <div className="py-5 text-center backdrop-blur-md border-t" style={{ 
            background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(249,250,251,0.5)',
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
          }}>
            <p className="text-xs font-medium" style={{ color: isDark ? '#71717a' : '#6b7280' }}>
              Need assistance? <span className="font-bold cursor-pointer transition-colors" style={{ color: isDark ? '#a855f7' : '#059669' }}>Contact Provider</span>
            </p>
          </div>
        </div>
      </main>
      
      {/* Soft CSS Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 0.5; }
        }
        .animate-pulse-slow {
          animation: pulse-slow infinite ease-in-out;
        }
      `}} />
    </div>
  )
}

