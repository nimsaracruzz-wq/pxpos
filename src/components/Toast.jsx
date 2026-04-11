import React, { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

// ─── Toast Store ─────────────────────────────────────────────────────────────
export const useToastStore = create((set, get) => ({
  toasts: [],
  add: (toast) => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, ...toast }] }))
    setTimeout(() => get().remove(id), toast.duration || 3000)
    return id
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// ─── Toast helper hooks ───────────────────────────────────────────────────────
export const useToast = () => {
  const { add } = useToastStore()
  return {
    success: (message, opts) => add({ type: 'success', message, ...opts }),
    error: (message, opts) => add({ type: 'error', message, ...opts }),
    warning: (message, opts) => add({ type: 'warning', message, ...opts }),
    info: (message, opts) => add({ type: 'info', message, ...opts }),
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
        gap: 10,
        padding: '12px 14px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        minWidth: 280,
        maxWidth: 360,
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(32px) scale(0.95)',
        marginBottom: 8,
        cursor: 'pointer',
      }}
      onClick={() => remove(id)}
    >
      <Icon size={18} style={{ color: style.icon_color, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        {title && <p style={{ fontWeight: 700, fontSize: 13, color: style.text, marginBottom: 2 }}>{title}</p>}
        <p style={{ fontSize: 13, color: style.text, lineHeight: 1.4 }}>{message}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); remove(id) }}
        style={{ color: style.icon_color, opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <X size={14} />
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
