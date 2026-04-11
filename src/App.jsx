import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ToastContainer } from '@/components/Toast'
import AccessGuard from '@/components/AccessGuard'
import Dashboard from '@/pages/Dashboard'
import POS from '@/pages/POS'
import Products from '@/pages/Products'
import Inventory from '@/pages/Inventory'
import Customers from '@/pages/Customers'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import GRN from '@/pages/GRN'
import Tables from '@/pages/Tables'
import Ledger from '@/pages/Ledger'
import TakeOut from '@/pages/TakeOut'
import Variants from '@/pages/Variants'
import BarcodeLabels from '@/pages/BarcodeLabels'
import Batches from '@/pages/Batches'
import Prescriptions from '@/pages/Prescriptions'
import WebOrders from '@/pages/WebOrders'
import Login from '@/pages/Login'
import { useAuthStore } from '@/store'

export default function App() {
  const { currentUser } = useAuthStore()

  if (!currentUser) {
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    )
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />

          {/* Sales — all logged-in users */}
          <Route path="/pos" element={<AccessGuard permission="sales"><POS /></AccessGuard>} />
          <Route path="/tables" element={<AccessGuard permission="sales"><Tables /></AccessGuard>} />
          <Route path="/takeout" element={<AccessGuard permission="sales"><TakeOut /></AccessGuard>} />
          <Route path="/prescriptions" element={<AccessGuard permission="sales"><Prescriptions /></AccessGuard>} />

          {/* Inventory management — manager and above */}
          <Route path="/products" element={<AccessGuard permission="manage_inventory"><Products /></AccessGuard>} />
          <Route path="/inventory" element={<AccessGuard permission="manage_inventory"><Inventory /></AccessGuard>} />
          <Route path="/customers" element={<AccessGuard permission="manage_inventory"><Customers /></AccessGuard>} />
          <Route path="/grn" element={<AccessGuard permission="manage_inventory"><GRN /></AccessGuard>} />
          <Route path="/ledger" element={<AccessGuard permission="manage_inventory"><Ledger /></AccessGuard>} />
          <Route path="/variants" element={<AccessGuard permission="manage_inventory"><Variants /></AccessGuard>} />
          <Route path="/barcodes" element={<AccessGuard permission="manage_inventory"><BarcodeLabels /></AccessGuard>} />
          <Route path="/batches" element={<AccessGuard permission="manage_inventory"><Batches /></AccessGuard>} />
          <Route path="/web-orders" element={<AccessGuard permission="manage_inventory"><WebOrders /></AccessGuard>} />

          {/* Reports — manager and above */}
          <Route path="/reports" element={<AccessGuard permission="view_reports"><Reports /></AccessGuard>} />

          {/* Settings — owner and above */}
          <Route path="/settings" element={<AccessGuard permission="manage_settings"><Settings /></AccessGuard>} />
        </Routes>
      </Layout>
      <ToastContainer />
    </BrowserRouter>
  )
}


