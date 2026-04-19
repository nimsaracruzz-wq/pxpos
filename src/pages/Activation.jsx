import React, { useState } from 'react'
import { validateLicense } from '@/lib/license'
import { useAppStore } from '@/store'
import { BRAND } from '@/lib/brand'

export default function Activation() {
  const [key, setKey]         = useState('')
  const [status, setStatus]   = useState('idle') // idle | loading | error | success
  const [message, setMessage] = useState('')
  const activateLicense = useAppStore((s) => s.activateLicense)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'

  // Normalize key input while allowing full-length product keys.
  function handleInput(e) {
    const normalized = e.target.value
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9-]/g, '')
    setKey(normalized)
  }

  async function handleActivate(e) {
    e.preventDefault()
    if (key.trim().length < 8) {
      setStatus('error')
      setMessage('Please enter a valid full license key.')
      return
    }
    setStatus('loading')
    setMessage('')
    const result = await validateLicense(key)
    if (result.valid) {
      setStatus('success')
      setMessage(`Welcome, ${result.businessName}!`)
      setTimeout(() => activateLicense(key), 1200)
    } else {
      setStatus('error')
      setMessage(result.error)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark
        ? 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
        : 'linear-gradient(135deg, #ecfeff, #d1fae5, #dcfce7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      padding: '24px',
    }}>
      <button
        type="button"
        onClick={toggleTheme}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          width: 42,
          height: 42,
          borderRadius: 12,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(100,116,139,0.16)'}`,
          background: isDark ? 'rgba(15,23,42,0.85)' : '#ffffff',
          color: isDark ? '#facc15' : '#475569',
          cursor: 'pointer',
          fontSize: 18,
        }}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      {/* Glow blobs */}
      <div style={{ position: 'fixed', top: '-200px', left: '-200px', width: '600px', height: '600px', borderRadius: '50%', background: isDark ? 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-200px', right: '-200px', width: '600px', height: '600px', borderRadius: '50%', background: isDark ? 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(34,197,94,0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{
        background: isDark ? 'rgba(15,23,42,0.95)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#edf1f5'}`,
        borderRadius: '24px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '460px',
        boxShadow: isDark ? '0 32px 80px rgba(0,0,0,0.5)' : '0 28px 70px rgba(16,185,129,0.18)',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px', height: '72px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
          }}>
            <span style={{ fontSize: '32px' }}>🔐</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: isDark ? '#fff' : '#334155', letterSpacing: '-0.5px' }}>
            {BRAND.name} POS
          </h1>
          <p style={{ margin: '8px 0 0', color: isDark ? 'rgba(255,255,255,0.5)' : '#475569', fontSize: '14px' }}>
            Enter your license key to activate
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleActivate}>
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label style={{ display: 'block', color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              License Key
            </label>
            <input
              type="text"
              value={key}
              onChange={handleInput}
              placeholder="PX-XXXX-XXXX-XXXX"
              maxLength={64}
              disabled={status === 'loading' || status === 'success'}
              style={{
                width: '100%',
                padding: '14px 18px',
                background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.96)',
                border: `1.5px solid ${status === 'error' ? '#f87171' : status === 'success' ? '#34d399' : (isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1')}`,
                borderRadius: '12px',
                color: isDark ? '#fff' : '#334155',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '3px',
                outline: 'none',
                textAlign: 'center',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* Status message */}
          {message && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: status === 'error' ? 'rgba(248,113,113,0.1)' : (isDark ? 'rgba(52,211,153,0.1)' : 'rgba(16,185,129,0.12)'),
              border: `1px solid ${status === 'error' ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.3)'}`,
              color: status === 'error' ? '#f87171' : '#34d399',
              fontSize: '13px',
              marginBottom: '16px',
              textAlign: 'left',
            }}>
              {status === 'error' ? '⚠️ ' : '✅ '}{message}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || status === 'success'}
            style={{
              width: '100%',
              padding: '14px',
              background: status === 'success'
                ? 'linear-gradient(135deg, #059669, #34d399)'
                : isDark
                  ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                  : 'linear-gradient(135deg, #0f766e, #10b981)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 700,
              cursor: status === 'loading' || status === 'success' ? 'not-allowed' : 'pointer',
              opacity: status === 'loading' ? 0.8 : 1,
              transition: 'all 0.2s',
              letterSpacing: '0.3px',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
            }}
          >
            {status === 'loading' ? '⏳ Verifying...' : status === 'success' ? '✅ Activated! Loading...' : '🚀 Activate License'}
          </button>
        </form>

        {/* Footer */}
        <p style={{ marginTop: '32px', color: isDark ? 'rgba(255,255,255,0.3)' : '#64748b', fontSize: '12px' }}>
          Don't have a license?{' '}
          <span style={{ color: isDark ? 'rgba(99,102,241,0.8)' : '#0f766e', cursor: 'pointer' }}>
            Contact {BRAND.name} Support
          </span>
        </p>
      </div>
    </div>
  )
}

