import React, { useState } from 'react'
import { Printer, Search, Barcode, Check } from 'lucide-react'
import { SectionHeader, SearchInput } from '@/components/ui'

export default function BarcodeLabels() {
  const [selectedItems, setSelectedItems] = useState([
    { id: 1, name: 'Slim Fit Denim Jeans', size: '32', color: 'Blue Wash', barcode: 'JEANS-BLU-32', price: 4500, qtyToPrint: 24 },
    { id: 2, name: 'Cotton Crewneck Tee', size: 'L', color: 'Black', barcode: 'TEE-BLK-L', price: 1800, qtyToPrint: 50 },
  ])

  return (
    <div className="h-full flex flex-col p-5 overflow-hidden">
      <SectionHeader 
        title="Print Barcode Labels" 
        subtitle="Generate printable stick-on labels for apparel tags"
        action={
          <button className="btn-primary">
            <Printer size={15} /> Print {selectedItems.reduce((sum, i) => sum + i.qtyToPrint, 0)} Labels
          </button>
        }
      />

      <div className="flex gap-6 mt-5 h-full overflow-hidden">
        {/* Selection panel */}
        <div className="w-1/3 flex flex-col gap-4 border-r border-gray-100 pr-6 h-full overflow-y-auto">
          <label className="text-sm font-semibold text-gray-700">Search Products to Print</label>
          <SearchInput placeholder="Scan barcode or search by name..." />
          
          <div className="flex flex-col gap-2 mt-2">
            {selectedItems.map((item, i) => (
              <div key={i} className="card p-3 flex gap-3 border-l-4 border-blue-500">
                <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded flex items-center justify-center shrink-0">
                  <Barcode size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.color} · Size: {item.size}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-gray-500">Print Qty:</label>
                    <input 
                      type="number" 
                      className="input-base text-xs h-6 w-16 px-1" 
                      value={item.qtyToPrint} 
                      onChange={e => {
                        const newQ = parseInt(e.target.value) || 0;
                        setSelectedItems(items => items.map(x => x.id === item.id ? {...x, qtyToPrint: newQ} : x))
                      }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="flex-1 flex flex-col bg-gray-50 rounded-2xl border border-gray-200 p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Printer size={18} className="text-gray-400" /> Print Layout Preview
            </h3>
            <select className="input-base text-sm py-1.5 px-3 bg-white">
              <option>A4 Sheet (3x8 Labels)</option>
              <option>Thermal Roll (40mm x 30mm)</option>
              <option>Thermal Roll (50mm x 30mm)</option>
            </select>
          </div>

          <div className="bg-white m-auto p-8 rounded shadow-sm border border-gray-200 w-full max-w-2xl min-h-[500px]">
            {/* Mock sticker sheet preview */}
            <div className="grid grid-cols-3 gap-4">
              {selectedItems.slice(0, 1).map(item => (
                Array.from({length: 6}).map((_, i) => (
                  <div key={i} className="border border-dashed border-gray-300 p-3 flex flex-col items-center text-center">
                    <p className="text-[10px] font-bold text-gray-800 max-w-full truncate">{item.name}</p>
                    <p className="text-[9px] text-gray-500">{item.color} - Size: {item.size}</p>
                    {/* Visual Barcode Bars */}
                    <div className="flex justify-center h-8 my-1.5 opacity-80" style={{ width: '100%' }}>
                      {Array.from({length: 24}).map((_, bi) => (
                        <div key={bi} style={{ width: Math.random() > 0.5 ? 2 : 1, height: '100%', background: '#000', marginRight: 1 }} />
                      ))}
                    </div>
                    <p className="font-mono text-[8px] tracking-widest">{item.barcode}</p>
                    <p className="text-xs font-black mt-1">Rs. {item.price.toLocaleString()}</p>
                  </div>
                ))
              ))}
            </div>
            <div className="text-center mt-8 text-gray-400 text-sm italic">
              Showing first 6 labels as preview...
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

