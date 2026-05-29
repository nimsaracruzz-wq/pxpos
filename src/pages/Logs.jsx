import React, { useEffect, useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import { useActivityStore } from '@/store'
import { Badge, Modal, SectionHeader } from '@/components/ui'
import { format } from 'date-fns'

export default function Logs() {
  const { logs } = useActivityStore()
  const [selectedLog, setSelectedLog] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25
  const pageCount = Math.max(1, Math.ceil(logs.length / pageSize))

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  const displayedLogs = useMemo(
    () => logs.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [logs, currentPage]
  )

  const formatTimestamp = (value) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return 'Unknown time'
    try {
      return format(d, 'MMM d, yyyy - hh:mm:ss aa')
    } catch {
      return d.toLocaleString()
    }
  }

  return (
    <div className="h-full overflow-y-auto p-5 pb-20" style={{ background: `#f4f7f5` }}>
      <SectionHeader
        title="Activity Logs"
        subtitle="System-wide action history for all users"
      />

      <div className="card p-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-gray-500" />
          <h3 className="font-bold text-gray-900 text-sm">System Activity History</h3>
          <span className="ml-auto text-xs font-semibold text-gray-500">{logs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-8 text-gray-400 font-medium">No system activities logged yet.</td></tr>
              ) : (
                displayedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(log.date)}</td>
                    <td>
                      <Badge variant="gray">{log.user}</Badge>
                    </td>
                    <td className="font-semibold text-sm text-gray-800">{log.action}</td>
                    <td className="text-sm text-gray-600 line-clamp-1">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {logs.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-500">
              Showing {displayedLogs.length} of {logs.length} entries · Page {currentPage} of {pageCount}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setCurrentPage(pageCount)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Activity Details"
        maxWidth="max-w-xl"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Timestamp</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{formatTimestamp(selectedLog.date)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">User</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{selectedLog.user || 'System'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Action</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{selectedLog.action || '-'}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Details</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{selectedLog.details || '-'}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Log ID</p>
              <p className="text-xs font-mono text-gray-700 mt-1 break-all">{selectedLog.id}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


