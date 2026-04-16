import React, { useRef } from 'react'
import { Download, Printer, Copy } from 'lucide-react'
import Barcode from 'react-barcode'
import { useAppStore } from '@/store'

/**
 * Generate a unique barcode value for a user
 * Format: USER-{role}-{id}
 * Example: USER-staff-550e8400-e29b-41d4-a716-446655440000
 */
export function generateUserBarcode(userId, role) {
  return `USER-${String(role || 'staff').toLowerCase()}-${userId}`
}

/**
 * User Barcode Generator Component
 * Displays barcode, print, and download options
 */
export default function UserBarcodeGenerator({ user, onClose }) {
  const barcodeRef = useRef(null)
  const { businessInfo } = useAppStore()

  if (!user) return null

  const barcodeValue = generateUserBarcode(user.id, user.role)

  const handlePrint = async () => {
    const barcodeEl = barcodeRef.current
    if (!barcodeEl) return

    const svg = barcodeEl.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 400
    const ctx = canvas.getContext('2d')

    // White background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()

    img.onload = () => {
      ctx.drawImage(img, 50, 80, 700, 120)

      // Add metadata
      ctx.fillStyle = '#333'
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${user.name}`, canvas.width / 2, 50)

      ctx.font = '16px Arial'
      ctx.fillStyle = '#666'
      ctx.fillText(`Role: ${user.role} | ID: ${user.id}`, canvas.width / 2, 230)
      ctx.fillText(barcodeValue, canvas.width / 2, 270)

      // Print canvas
      const printWindow = window.open('', '_blank', 'width=400,height=720')
      if (!printWindow) return
      printWindow.document.write(canvas.toDataURL('image/png'))
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 200)

      URL.revokeObjectURL(url)
    }

    img.src = url
  }

  const handleDownload = async () => {
    const barcodeEl = barcodeRef.current
    if (!barcodeEl) return

    const svg = barcodeEl.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 400
    const ctx = canvas.getContext('2d')

    // White background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()

    img.onload = () => {
      ctx.drawImage(img, 50, 80, 700, 120)

      // Add metadata
      ctx.fillStyle = '#333'
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${user.name}`, canvas.width / 2, 50)

      ctx.font = '16px Arial'
      ctx.fillStyle = '#666'
      ctx.fillText(`Role: ${user.role} | ID: ${user.id}`, canvas.width / 2, 230)
      ctx.fillText(barcodeValue, canvas.width / 2, 270)

      // Download
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `${user.name}-namecard-${Date.now()}.png`
      link.click()

      URL.revokeObjectURL(url)
    }

    img.src = url
  }

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeValue)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="animate-fade-in"
        style={{
          background: 'white',
          borderRadius: 16,
          width: 500,
          maxHeight: '92vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#1f2937' }}>
            {user.name} - Employee Badge
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Role: <span style={{ fontWeight: 600, color: '#111' }}>{user.role}</span>
          </p>
        </div>

        {/* Barcode Display */}
        <div
          ref={barcodeRef}
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <Barcode
              value={barcodeValue}
              width={2}
              height={80}
              fontSize={12}
              margin={10}
            />
          </div>
          <p style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {barcodeValue}
          </p>
        </div>

        {/* Info Section */}
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
            fontSize: 12,
          }}
        >
          <p style={{ color: '#1e40af', margin: 0 }}>
            ℹ️ This barcode uniquely identifies <strong>{user.name}</strong> for login and access control.
            Print it as an ID card or name badge for easy scanning at login.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={handleCopyBarcode}
            style={{
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#374151',
            }}
          >
            <Copy size={16} />
            Copy Code
          </button>

          <button
            onClick={handlePrint}
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'white',
            }}
          >
            <Printer size={16} />
            Print Badge
          </button>

          <button
            onClick={handleDownload}
            style={{
              background: '#10b981',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'white',
            }}
          >
            <Download size={16} />
            Download
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
