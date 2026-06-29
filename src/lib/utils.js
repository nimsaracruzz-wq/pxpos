import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount, symbol = 'Rs.') {
  return `${symbol} ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`
}

// Monotonic receipt counter — avoids same-second collisions
let _receiptSeq = 0
let _receiptLastSec = 0

export function generateReceiptNumber() {
  const prefix = 'INV'
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  // Monotonic per-second sequence so same-second sales still get unique numbers
  const sec = Math.floor(Date.now() / 1000)
  if (sec !== _receiptLastSec) {
    _receiptLastSec = sec
    _receiptSeq = 0
  }
  _receiptSeq += 1
  const seq = String(_receiptSeq).padStart(3, '0')
  // 4-digit random for extra collision safety (total entropy: seq + rand)
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  // Format: INV-YYMMDD-SEQ-RAND  e.g. INV-260629-001-4521
  // Fully CODE128-compatible; human-readable; scanner-safe (no spaces)
  return `INV-${y}${m}${d}-${seq}${rand}`
}

export function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
