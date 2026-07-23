const STORAGE_PERIOD = 'portal_active_reporting_period'
const STORAGE_ACCESS = 'portal_monthly_reporting_access'
const TEST_PERIOD = 'portal_monthly_test_period'
const REPORTING_START = '2026-01'

export function formatPeriod(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function periodLabel(period) {
  if (!/^\d{4}-\d{2}$/.test(period || '')) return period || ''
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  })
}

function nextPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return formatPeriod(new Date(year, month, 1))
}

export function previousPeriod(date = new Date()) {
  return formatPeriod(new Date(date.getFullYear(), date.getMonth() - 1, 1))
}

export function completedReportingPeriods(date = new Date()) {
  const override = sessionStorage.getItem(TEST_PERIOD)
  if (/^\d{4}-\d{2}$/.test(override || '')) return [override]

  const end = previousPeriod(date)
  if (end < REPORTING_START) return []

  const periods = []
  let period = REPORTING_START
  while (period <= end) {
    periods.push(period)
    period = nextPeriod(period)
  }
  return periods
}

export function requiredClosurePeriod(closures = [], date = new Date()) {
  const closed = new Set((closures || []).map(entry => entry.period))
  return completedReportingPeriods(date).find(period => !closed.has(period)) || null
}

export function closureDueDate(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month, 5, 23, 59, 59)
}

export function setReportingAccess(period) {
  sessionStorage.setItem(STORAGE_PERIOD, period)
  sessionStorage.setItem(STORAGE_ACCESS, period)
}

export function clearReportingAccess() {
  sessionStorage.removeItem(STORAGE_PERIOD)
  sessionStorage.removeItem(STORAGE_ACCESS)
}

export function hasReportingAccess(period) {
  return sessionStorage.getItem(STORAGE_ACCESS) === period
}

export function activeReportingPeriod(date = new Date()) {
  return sessionStorage.getItem(STORAGE_PERIOD) || formatPeriod(date)
}
