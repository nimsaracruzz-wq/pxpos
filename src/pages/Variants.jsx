import React, { useState, useMemo } from 'react'
import { Plus, Package, Layers, Save, Tag } from 'lucide-react'
import { SectionHeader, EmptyState, Badge } from '@/components/ui'
import { useProductStore } from '@/store'

export default function Variants() {
  const { products } = useProductStore()

  const styles = useMemo(() => {
    return products
      .filter((p) => p.module === 'clothing' && p.active)
      .map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || 'Uncategorized',
        brand: p.brand || 'No Brand',
        sizes: p.sizes ? p.sizes.split(',').map(s => s.trim()).filter(Boolean) : ['Standard'],
        colors: p.colors ? p.colors.split(',').map(c => c.trim()).filter(Boolean) : ['Standard']
      }))
  }, [products])

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: `#f4f7f5` }}>
      <SectionHeader 
        title="Style & Variants Matrix" 
        subtitle="Manage sizes, colors, and SKUs for apparel"
        action={
          <button className="btn-primary">
            <Plus size={15} /> Add New Style
          </button>
        }
      />

      <div className="flex flex-col gap-5 mt-5">
        {styles.length === 0 && (
          <EmptyState 
            icon={<Layers size={48} />} 
            title="No styles found" 
            description="Add products to the Clothing module via the Products tab to see variants here." 
          />
        )}
        {styles.map(style => (
          <div key={style.id} className="card p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Layers size={18} className="text-blue-500"/> {style.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{style.brand} · {style.category}</p>
              </div>
              <Badge variant="blue">{style.sizes.length * style.colors.length} Variants Generated</Badge>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden mt-4">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Color / Size</th>
                    {style.sizes.map(s => <th key={s} className="text-center">{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {style.colors.map(color => (
                    <tr key={color}>
                      <td className="font-semibold text-gray-700 bg-gray-50">{color}</td>
                      {style.sizes.map(size => (
                        <td key={size} className="text-center p-2">
                          <div className="flex flex-col gap-1 items-center">
                            <input 
                              type="text" 
                              placeholder="SKU" 
                              className="input-base text-xs text-center w-24 h-8" 
                              defaultValue={`${style.name.split(' ')[0].toUpperCase()}-${color.substring(0,3).toUpperCase()}-${size}`}
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">Qty:</span>
                              <input type="number" defaultValue="10" className="input-base text-xs text-center w-12 h-6 px-1" />
                            </div>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <button className="btn-secondary text-sm">
                <Save size={14} /> Update Matrices
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

