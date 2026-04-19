import React, { useEffect, useState } from 'react'
import CustomerDisplay from '@/components/CustomerDisplay'
import {
  clearCustomerDisplay,
  getCustomerDisplaySettings,
  getCustomerDisplayPayload,
  subscribeCustomerDisplaySettings,
  subscribeCustomerDisplay,
} from '@/lib/customerDisplayChannel'

export default function CustomerScreen() {
  const [payload, setPayload] = useState(() => getCustomerDisplayPayload())
  const [displaySettings, setDisplaySettings] = useState(() => getCustomerDisplaySettings())

  useEffect(() => {
    const unsubscribe = subscribeCustomerDisplay((nextPayload) => {
      setPayload(nextPayload)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeCustomerDisplaySettings((nextSettings) => {
      setDisplaySettings(nextSettings)
    })
    return unsubscribe
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
      <CustomerDisplay
        open
        showCloseButton={false}
        displaySettings={displaySettings}
        amount={payload?.amount || 0}
        qrData={payload?.qrData || ''}
        paymentMethod={payload?.paymentMethod || 'helaqr'}
        status={payload?.status || 'idle'}
        cashGiven={payload?.cashGiven || 0}
        change={payload?.change || 0}
        reference={payload?.reference || ''}
        title={payload?.title || 'Customer Display'}
        subtitle={payload?.subtitle || 'Please wait for cashier'}
        onAutoReset={() => {
          clearCustomerDisplay()
          setPayload(null)
        }}
        onClose={() => {
          clearCustomerDisplay()
          setPayload(null)
        }}
      />
    </div>
  )
}
