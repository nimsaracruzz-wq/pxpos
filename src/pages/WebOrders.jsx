import React, { useState } from 'react'
import { Globe, RefreshCw, ShoppingBag, Truck, CheckCircle } from 'lucide-react'
import { SectionHeader, SearchInput, Badge, EmptyState } from '@/components/ui'
import { useSalesStore } from '@/store'
import { formatCurrency } from '@/lib/utils'

export default function WebOrders() {
  const { sales } = useSalesStore()
  const [syncing, setSyncing] = useState(false)
  
  const webOrders = sales.filter(s => s.source === 'web' || s.source === 'qr' || s.source === 'shopify' || s.source === 'woocommerce')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => setSyncing(false), 2000)
  }

  return (
    <div className="h-full flex flex-col p-5 overflow-hidden">
      <SectionHeader 
        title="Web Orders" 
        subtitle="Manage and fulfill online e-commerce orders"
        action={
          <button 
            className="btn-primary" 
            onClick={handleSync}
            disabled={syncing}
            style={{ background: '#0ea5e9' }}
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing with Platforms...' : 'Sync Orders Update'}
          </button>
        }
      />

      <div className="flex gap-6 mt-5 h-full overflow-hidden">
        {/* Left List */}
        <div className="w-1/3 flex flex-col gap-4 border-r border-gray-100 pr-6 h-full overflow-y-auto">
          <SearchInput placeholder="Search Order ID or Customer..." />
          <div className="flex flex-col gap-3 mt-2">
            {webOrders.length === 0 && (
              <EmptyState 
                icon={<Globe size={48} />} 
                title="No Web Orders" 
                description="Sync with Shopify or WooCommerce to pull in latest orders." 
              />
            )}
            {webOrders.map(order => (
              <div key={order.id} className="card p-4 border-l-4 border-sky-500 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800">{order.receiptNo || order.id}</span>
                  <Badge variant={order.status === 'unfulfilled' || order.status === 'pending' ? 'red' : order.status === 'processing' ? 'yellow' : 'green'}>
                    {(order.status || 'Received').toUpperCase()}
                  </Badge>
                </div>
                <p className="text-gray-700 font-medium">{order.customerName || order.customer || 'Guest Checkout'}</p>
                <div className="flex justify-between items-end mt-3">
                  <div>
                    <p className="text-xs text-gray-400 capitalize">{order.source}</p>
                    <p className="text-xs text-gray-500 font-medium">{order.items} items</p>
                  </div>
                  <p className="font-black text-sky-700">{formatCurrency(order.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {webOrders.length > 0 ? (
          <div className="flex-1 bg-white border border-gray-100 shadow-sm rounded-2xl p-6 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 rounded-full blur-3xl -mx-20 -my-20 opacity-50 pointer-events-none" />
            <div className="relative z-10 flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Globe size={20} className="text-sky-500" />
                  <h2 className="text-2xl font-black text-gray-800">{webOrders[0].receiptNo || webOrders[0].id}</h2>
                </div>
                <p className="text-gray-500 font-medium mt-1">Customer: <span className="text-gray-800">{webOrders[0].customerName || 'Guest'}</span></p>
                <p className="text-sm text-gray-400 mt-1">Placed via <span className="capitalize">{webOrders[0].source}</span> on {new Date(webOrders[0].date).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Order Total</p>
                <p className="text-2xl font-black text-sky-600">{formatCurrency(webOrders[0].total)}</p>
                <Badge variant={webOrders[0].status === 'completed' || webOrders[0].status === 'shipped' ? 'green' : 'red'} className="mt-1">
                  {(webOrders[0].status || 'RECEIVED').toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="relative z-10 flex-1">
              <h3 className="font-bold text-gray-700 mb-3">Order Items</h3>
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-5">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webOrders[0].cartItems?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-bold text-gray-800">{item.name}</td>
                        <td className="text-xs font-mono text-gray-500">{item.barcode || 'N/A'}</td>
                        <td>{item.qty}</td>
                        <td className="font-bold text-gray-700">{formatCurrency(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <h3 className="font-bold text-gray-700 mb-3">Fulfillment Status</h3>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Shipping Address: <strong>Pending verification</strong></p>
                <p className="text-sm text-gray-600">Method: <strong>Standard Delivery</strong></p>
              </div>
            </div>

            <div className="relative z-10 pt-4 border-t border-gray-100 flex gap-3 justify-end mt-4">
              <button className="btn-secondary">Cancel Order</button>
              <button className="btn-primary" style={{ background: '#0ea5e9' }}>
                <Truck size={16} /> Mark as Fulfilled & Notify
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 border border-gray-100 shadow-sm rounded-2xl h-full">
             <p className="text-gray-400 font-semibold">Select an order to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}

