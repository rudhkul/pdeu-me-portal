import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getMonthlyClosures, getUsers } from '../../lib/github'
import { completedReportingPeriods, periodLabel } from '../../utils/reportingPeriod'

const STATUS = {
  submitted: { short: 'Submitted', cls: 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20' },
  no_data: { short: 'No Data', cls: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20' },
  extension: { short: 'Extension', cls: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/20' },
  pending: { short: 'Pending', cls: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20' },
}

export default function MonthlyClosureStatus() {
  const periods = completedReportingPeriods()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(periods.length > 0)

  useEffect(() => {
    if (!periods.length) {
      setLoading(false)
      return
    }

    async function load() {
      try {
        const users = (await getUsers()).filter(user => user.role === 'faculty')
        const results = await Promise.all(users.map(async user => ({
          ...user,
          closures: await getMonthlyClosures(user.id).catch(() => []),
        })))
        setRows(results)
      } catch (error) {
        toast.error(`Monthly closure status could not be loaded: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [periods.join(',')])

  if (!periods.length) return null

  if (loading) {
    return <div className="card mb-6 text-sm text-gray-500">Loading monthly closure status…</div>
  }

  const totalRequired = rows.length * periods.length
  const totalAcknowledged = rows.reduce(
    (sum, row) => sum + periods.filter(period =>
      row.closures.some(entry => entry.period === period)
    ).length,
    0
  )

  return (
    <div className="card mb-6">
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Monthly Closure Matrix
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            January 2026 through the latest completed month.
          </p>
        </div>
        <span className="text-sm font-semibold text-pdeu-blue dark:text-blue-400">
          {totalAcknowledged} of {totalRequired} acknowledgements
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="py-2 pr-4 sticky left-0 bg-white dark:bg-gray-800">Faculty</th>
              {periods.map(period => (
                <th key={period} className="py-2 px-2 whitespace-nowrap">
                  {periodLabel(period)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-2 pr-4 sticky left-0 bg-white dark:bg-gray-800 min-w-[180px]">
                  <p className="font-medium text-gray-800 dark:text-gray-100">{row.fullName}</p>
                  <p className="text-[10px] text-gray-400">{row.email}</p>
                </td>
                {periods.map(period => {
                  const closure = row.closures.find(entry => entry.period === period)
                  const key = closure?.status || 'pending'
                  const item = STATUS[key] || STATUS.pending
                  return (
                    <td key={period} className="py-2 px-2">
                      <span
                        className={`inline-block px-2 py-1 rounded-full whitespace-nowrap ${item.cls}`}
                        title={closure
                          ? `${closure.remarks || 'No remarks'} · ${new Date(closure.declaredAt).toLocaleString('en-IN')}`
                          : 'No response'}
                      >
                        {item.short}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
