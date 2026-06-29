import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

// ─── Button ──────────────────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', className, disabled, onClick, type = 'button', ...props }) {
  const variants = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    ghost:     'btn-ghost',
    danger:    'btn-danger',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs !min-h-[36px]',
    md: '',
    lg: 'px-6 py-3 text-base !min-h-[52px]',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = forwardRef(function Input({ className, label, error, hint, ...props }, ref) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={cn(
          'input-base',
          error && 'border-red-400 focus:border-red-400 focus:shadow-none',
          className
        )}
        {...props}
      />
      {hint && !error && <span className="text-xs text-gray-400 dark:text-zinc-500">{hint}</span>}
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  )
})

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ className, label, error, children, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        className={cn('input-base appearance-none cursor-pointer', error && 'border-red-400', className)}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className, onClick, padding = true, ...props }) {
  return (
    <div
      className={cn('card', padding && 'p-5', onClick && 'cursor-pointer', className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'gray', className }) {
  const variants = {
    green:  'badge-green',
    red:    'badge-red',
    yellow: 'badge-yellow',
    blue:   'badge-blue',
    gray:   'badge-gray',
  }
  return (
    <span className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ title, value, subtitle, icon, color = '#16a34a', trend, className }) {
  const isPositive = trend === undefined ? null : trend >= 0
  return (
    <div className={cn('stat-card animate-fade-in', className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{title}</p>
        {icon && (
          <div
            className="flex items-center justify-center w-10 h-10 rounded-2xl shrink-0 transition-transform hover:scale-110"
            style={{ background: `${color}18`, color }}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-zinc-100 leading-tight">{value}</p>
      <div className="flex items-center justify-between mt-2">
        {subtitle && <p className="text-xs text-gray-400 dark:text-zinc-500">{subtitle}</p>}
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full',
              isPositive ? 'text-green-700 bg-green-50' : 'text-red-500 bg-red-50'
            )}
          >
            {isPositive
              ? <ArrowUpRight size={12} />
              : <ArrowDownRight size={12} />
            }
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn('modal-content animate-scale-in w-full', maxWidth)}>
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-all active:scale-90"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = '#16a34a' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      style={{ animation: 'spin 0.75s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ className, style }) {
  return <div className={cn('skeleton', className)} style={style} />
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {icon && (
        <div className="w-20 h-20 rounded-3xl bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-center mb-4 text-gray-300 dark:text-zinc-600">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-600 dark:text-zinc-300">{title}</h3>
      {description && <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1.5 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className="relative transition-all"
        style={{ width: 44, height: 24 }}
      >
        <div
          style={{
            width: 44,
            height: 24,
            borderRadius: 999,
            background: checked ? '#16a34a' : '#d1d5db',
            transition: 'background 0.2s ease',
            cursor: 'pointer',
            boxShadow: checked ? '0 0 0 3px rgba(22,163,74,0.12)' : 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 1px 5px rgba(0,0,0,0.22)',
            transition: 'left 0.2s ease',
          }}
        />
      </div>
      {label && <span className="text-sm font-medium text-gray-700 dark:text-zinc-200">{label}</span>}
    </label>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── Search Input ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...', className, icon, rightSlot, inputProps = {} }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-0.5">
      <span className="shrink-0 text-gray-400 pointer-events-none">
        {icon || (
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        )}
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn('flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-gray-700 placeholder:text-gray-400 py-2', className)}
        {...inputProps}
      />
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ label, className }) {
  if (!label) return (
    <div className={cn('border-t border-gray-100 dark:border-zinc-800 my-4', className)} />
  )
  return (
    <div className={cn('flex items-center gap-3 my-4', className)}>
      <div className="flex-1 border-t border-gray-100 dark:border-zinc-800" />
      <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex-1 border-t border-gray-100 dark:border-zinc-800" />
    </div>
  )
}

// ─── Info Card ────────────────────────────────────────────────────────────────
export function InfoCard({ icon, title, description, color = '#16a34a', onClick }) {
  return (
    <div
      className={cn('card p-4 flex items-start gap-3', onClick && 'cursor-pointer hover:shadow-md')}
      onClick={onClick}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {icon && (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{title}</p>
        {description && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{description}</p>}
      </div>
    </div>
  )
}
