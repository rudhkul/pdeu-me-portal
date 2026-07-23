import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { getMonthlyClosures, saveMonthlyClosure } from '../lib/github'
import {
  clearReportingAccess,
  closureDueDate,
  completedReportingPeriods,
  hasReportingAccess,
  periodLabel,
  requiredClosurePeriod,
  setReportingAccess,
} from '../utils/reportingPeriod'

export default function MonthlyClosureGate({ children }) {
  const { session, effectiveRole } = useAuth()
  const [loading, setLoading] = useState(true)
  const [closures, setClosures] = useState([])
  const [period, setPeriod] = useState(null)
  const [access, setAccess] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session || effectiveRole === 'admin') {
      setLoading(false)
      return
    }

    getMonthlyClosures(session.userId)
      .then(entries => {
        const pending = requiredClosurePeriod(entries)
        setClosures(entries)
        setPeriod(pending)
        setAccess(pending ? hasReportingAccess(pending) : false)
      })
      .catch(error => toast.error(`Monthly status could not be loaded: ${error.message}`))
      .finally(() => setLoading(false))
  }, [session?.userId, effectiveRole])

  if (effectiveRole === 'admin') return children

  async function declare(status) {
    if (status === 'extension' && !remarks.trim()) {
      toast.error('State why additional time is required.')
      return
    }

    setSaving(true)
    try {
      const updated = await saveMonthlyClosure(session.userId, {
        period,
        status,
        remarks: remarks.trim(),
      })
      clearReportingAccess()
      const next = requiredClosurePeriod(updated)
      setClosures(updated)
      setPeriod(next)
      setAccess(false)
      setRemarks('')
      toast.success(
        next
          ? `${periodLabel(period)} recorded. Continue with ${periodLabel(next)}.`
          : 'All completed reporting months have been acknowledged.'
      )
    } catch (error) {
      toast.error(`Status could not be saved: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading monthly reporting status…
      </div>
    )
  }

  if (!period) return children

  const periods = completedReportingPeriods()
  const completed = periods.filter(item =>
    closures.some(entry => entry.period === item)
  ).length

  if (access) {
    return (
      <>
        {children}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl bg-amber-50 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded-xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Entering records for {periodLabel(period)}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              New records are assigned to this reporting month.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => setAccess(false)}
          >
            Complete {periodLabel(period)}
          </button>
        </div>
      </>
    )
  }

  const overdue = new Date() > closureDueDate(period)

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pdeu-blue dark:text-blue-400">
              Monthly Data Closure
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              Close reporting for {periodLabel(period)}
            </h1>
          </div>
          <span className="text-xs text-gray-500">
            {completed} of {periods.length} months acknowledged
          </span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
          Account for every reportable activity during {periodLabel(period)}. Months are closed sequentially from January 2026.
        </p>

        {overdue && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
            This monthly acknowledgement is overdue.
          </div>
        )}

        <label className="form-label mt-5" htmlFor="monthly-remarks">
          Remarks
        </label>
        <textarea
          id="monthly-remarks"
          className="form-input"
          rows={3}
          value={remarks}
          onChange={event => setRemarks(event.target.value)}
          placeholder="Optional, except when requesting additional time"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            disabled={saving}
            className="btn-secondary text-left p-4"
            onClick={() => {
              setReportingAccess(period)
              setAccess(true)
            }}
          >
            <span className="block font-semibold">Review or Add Data</span>
            <span className="block text-xs font-normal mt-1">Enter records for {periodLabel(period)}.</span>
          </button>

          <button
            type="button"
            disabled={saving}
            className="btn-primary text-left p-4"
            onClick={() => declare('submitted')}
          >
            <span className="block font-semibold">Data Submitted</span>
            <span className="block text-xs font-normal mt-1">All reportable activities are entered.</span>
          </button>

          <button
            type="button"
            disabled={saving}
            className="btn-secondary text-left p-4"
            onClick={() => declare('no_data')}
          >
            <span className="block font-semibold">No Reportable Data</span>
            <span className="block text-xs font-normal mt-1">No reportable activity occurred.</span>
          </button>

          <button
            type="button"
            disabled={saving}
            className="btn-secondary text-left p-4"
            onClick={() => declare('extension')}
          >
            <span className="block font-semibold">Additional Time Required</span>
            <span className="block text-xs font-normal mt-1">Remarks are mandatory.</span>
          </button>
        </div>
      </div>
    </div>
  )
}
