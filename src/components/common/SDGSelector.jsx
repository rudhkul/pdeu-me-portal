// ── 17 UN Sustainable Development Goals ──────────────────────
export const SDG_LIST = [
  { num: 1,  label: 'No Poverty' },
  { num: 2,  label: 'Zero Hunger' },
  { num: 3,  label: 'Good Health and Well-being' },
  { num: 4,  label: 'Quality Education' },
  { num: 5,  label: 'Gender Equality' },
  { num: 6,  label: 'Clean Water and Sanitation' },
  { num: 7,  label: 'Affordable and Clean Energy' },
  { num: 8,  label: 'Decent Work and Economic Growth' },
  { num: 9,  label: 'Industry, Innovation and Infrastructure' },
  { num: 10, label: 'Reduced Inequalities' },
  { num: 11, label: 'Sustainable Cities and Communities' },
  { num: 12, label: 'Responsible Consumption and Production' },
  { num: 13, label: 'Climate Action' },
  { num: 14, label: 'Life Below Water' },
  { num: 15, label: 'Life on Land' },
  { num: 16, label: 'Peace, Justice and Strong Institutions' },
  { num: 17, label: 'Partnerships for the Goals' },
]

// Colour strip per SDG (official UN palette)
const SDG_COLORS = {
  1:'#E5243B', 2:'#DDA63A', 3:'#4C9F38', 4:'#C5192D',
  5:'#FF3A21', 6:'#26BDE2', 7:'#FCC30B', 8:'#A21942',
  9:'#FD6925', 10:'#DD1367', 11:'#FD9D24', 12:'#BF8B2E',
  13:'#3F7E44', 14:'#0A97D9', 15:'#56C02B', 16:'#00689D',
  17:'#19486A',
}

/**
 * Multi-select SDG picker.
 * Stores as comma-separated SDG numbers, e.g. "3,7,13"
 *
 * Props: fieldKey, register, value (controlled), onChange(newVal)
 */
export default function SDGSelector({ fieldKey, register, value = '', onChange }) {
  const selected = value
    ? value.split(',').map(Number).filter(Boolean)
    : []

  function toggle(num) {
    const next = selected.includes(num)
      ? selected.filter(n => n !== num)
      : [...selected, num].sort((a, b) => a - b)
    onChange(next.join(','))
  }

  return (
    <div>
      {/* Hidden input for react-hook-form */}
      <input type="hidden" {...register(fieldKey)} value={value} />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map(num => {
            const g = SDG_LIST.find(s => s.num === num)
            return (
              <span key={num}
                className="inline-flex items-center gap-1 text-white text-xs font-semibold px-2 py-1 rounded-full"
                style={{ backgroundColor: SDG_COLORS[num] }}>
                SDG {num}: {g?.label}
                <button type="button" onClick={() => toggle(num)}
                  className="ml-1 opacity-70 hover:opacity-100 leading-none">✕</button>
              </span>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto pr-1
                      border border-gray-200 dark:border-gray-600 rounded-lg p-2
                      bg-white dark:bg-gray-800">
        {SDG_LIST.map(({ num, label }) => {
          const active = selected.includes(num)
          return (
            <button
              key={num}
              type="button"
              onClick={() => toggle(num)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors
                ${active
                  ? 'text-white font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              style={active ? { backgroundColor: SDG_COLORS[num] } : {}}
            >
              {/* SDG number badge */}
              <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0
                ${active ? 'bg-white/30' : 'text-white'}`}
                style={active ? {} : { backgroundColor: SDG_COLORS[num] }}>
                {num}
              </span>
              <span className="truncate">{label}</span>
              {active && <span className="ml-auto flex-shrink-0">✓</span>}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Click to select/deselect. Multiple SDGs allowed.
      </p>
    </div>
  )
}
