import React, { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

// ─── Toast Store ─────────────────────────────────────────────────────────────
export const useToastStore = create((set, get) => ({
  toasts: [],
  add: (toast) => {
    const id = toast.id || Date.now()
    set((s) => {
      const exists = s.toasts.some(t => t.id === id)
      if (exists) {
        return { toasts: s.toasts.map(t => t.id === id ? { ...t, ...toast, id } : t) }
      }
      return { toasts: [...s.toasts, { id, ...toast }] }
    })
    if (toast.duration !== Infinity) {
      setTimeout(() => get().remove(id), toast.duration || 3000)
    }
    return id
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// ─── Toast helper hooks ───────────────────────────────────────────────────────
export const useToast = () => {
  const { add, remove } = useToastStore()
  return {
    success: (message, opts) => add({ type: 'success', message, ...opts }),
    error: (message, opts) => add({ type: 'error', message, ...opts }),
    warning: (message, opts) => add({ type: 'warning', message, ...opts }),
    info: (message, opts) => add({ type: 'info', message, ...opts }),
    loading: (message, opts) => add({ type: 'info', message, duration: Infinity, ...opts }),
    dismiss: (id) => remove(id),
  }
}

// ─── Toast icons/colors ────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: { icon: CheckCircle, bg: '#f0fdf4', border: '#bbf7d0', icon_color: '#16a34a', text: '#166534' },
  error:   { icon: XCircle,     bg: '#fef2f2', border: '#fecaca', icon_color: '#dc2626', text: '#991b1b' },
  warning: { icon: AlertTriangle,bg: '#fffbeb', border: '#fde68a', icon_color: '#d97706', text: '#92400e' },
  info:    { icon: Info,         bg: '#eff6ff', border: '#bfdbfe', icon_color: '#2563eb', text: '#1e40af' },
}

// ─── Single Toast ─────────────────────────────────────────────────────────────
function Toast({ id, type = 'info', message, title }) {
  const { remove } = useToastStore()
  const [visible, setVisible] = useState(false)
  const style = TOAST_STYLES[type] || TOAST_STYLES.info
  const Icon = style.icon

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => setVisible(false)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 16px 13px 14px',
        background: 'white',
        border: `1px solid ${style.border}`,
        borderLeft: `4px solid ${style.icon_color}`,
        borderRadius: 14,
        boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        minWidth: 290,
        maxWidth: 380,
        transition: 'all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.92)',
        marginBottom: 8,
        cursor: 'pointer',
      }}
      onClick={() => remove(id)}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={17} style={{ color: style.icon_color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 2 }}>{title}</p>}
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.45, fontWeight: title ? 400 : 600 }}>{message}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); remove(id) }}
        style={{
          color: '#9ca3af', background: 'none', border: 'none',
          cursor: 'pointer', padding: 2, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6, transition: 'background 0.1s',
        }}
        onMouseOver={e => e.currentTarget.style.background = '#f3f4f6'}
        onMouseOut={e => e.currentTarget.style.background = 'none'}
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Toast Container ──────────────────────────────────────────────────────────
export function ToastContainer() {
  const { toasts } = useToastStore()
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast {...t} />
        </div>
      ))}
    </div>
  )
}
