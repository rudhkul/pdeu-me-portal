import { useEffect, useState } from 'react'
import { getAllFaculties } from '../../lib/github'

/**
 * Multi-select picker for department faculty.
 * Stores as semicolon-separated names e.g. "Dr. Vivek Jaiswal;Dr. Krunal Patel"
 * Used in Tab 5 to tag dept faculty co-authors — prevents duplicate publication entries.
 */
export default function FacultySelect({ fieldKey, register, value = '', onChange, currentFacultyName }) {
  const [faculties,  setFaculties]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')

  const selected = value
    ? value.split(';').map(s => s.trim()).filter(Boolean)
    : []

  useEffect(() => {
    getAllFaculties()
      .then(list => {
        // Exclude the current user from the list
        setFaculties(list.filter(f =>
          f.fullName && f.fullName !== currentFacultyName
        ))
      })
      .catch(() => setFaculties([]))
      .finally(() => setLoading(false))
  }, [])

  function toggle(name) {
    const next = selected.includes(name)
      ? selected.filter(n => n !== name)
      : [...selected, name]
    onChange(next.join(';'))
  }

  const filtered = faculties.filter(f =>
    f.fullName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <input type="hidden" {...register(fieldKey)} value={value} />

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(name => (
            <span key={name}
              className="inline-flex items-center gap-1 bg-pdeu-blue text-white text-xs px-2 py-1 rounded-full">
              {name}
              <button type="button" onClick={() => toggle(name)}
                className="opacity-70 hover:opacity-100 ml-0.5">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Search + list */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search faculty…"
            className="w-full text-sm bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 p-3">Loading faculty list…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 p-3">No faculty found.</p>
          ) : filtered.map(f => {
            const active = selected.includes(f.fullName)
            return (
              <button key={f.id} type="button" onClick={() => toggle(f.fullName)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                  ${active
                    ? 'bg-pdeu-blue text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold
                  ${active ? 'bg-white/30' : 'bg-pdeu-light dark:bg-gray-700 text-pdeu-blue dark:text-blue-400'}`}>
                  {f.fullName[0]?.toUpperCase()}
                </div>
                <span className="truncate">{f.fullName}</span>
                {active && <span className="ml-auto flex-shrink-0 text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Select dept. colleagues who co-authored this publication — avoids duplicate entries in their profile.
      </p>
    </div>
  )
}
