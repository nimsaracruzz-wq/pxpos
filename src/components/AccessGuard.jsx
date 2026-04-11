import React from 'react'
import { ShieldOff } from 'lucide-react'
import { useAuthStore } from '@/store'

/**
 * AccessGuard - wraps any page and shows an Access Denied wall
 * if the current user lacks the required permission.
 * 
 * Usage: <AccessGuard permission="view_reports"><Reports /></AccessGuard>
 */
export default function AccessGuard({ permission, children }) {
  const { hasPermission, currentUser } = useAuthStore()

  if (permission && !hasPermission(permission)) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '1px solid #fecaca' }}
          >
            <ShieldOff size={36} className="text-red-400" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your account role (<span className="font-bold text-gray-700 uppercase">{currentUser?.role?.replace('_',' ')}</span>) does not have
            permission to access this section.
          </p>
          <p className="text-xs text-gray-400 mt-4 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            Required permission: <span className="font-mono font-bold text-gray-600">{permission.replace(/_/g,' ')}</span>
          </p>
        </div>
      </div>
    )
  }

  return children
}
