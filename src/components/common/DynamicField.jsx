import { useState } from 'react'

// ── Searchable select for long option lists ───────────────────
function SearchableSelect({ id, options, register, fieldKey, required, error }) {
  const [search, setSearch] = useState('')
  const [open,   setOpen]   = useState(false)
  const [value,  setValue]  = useState('')

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  // We manage value ourselves and sync to a hidden input for react-hook-form
  const reg = register(fieldKey, { required: required ? `${id} is required` : false })

  return (
    <div className="relative">
      {/* Hidden input for react-hook-form */}
      <input type="hidden" {...reg} value={value} />

      {/* Display button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`form-input text-left flex items-center justify-between ${error ? 'border-red-400' : ''}`}
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value || '— Select —'}
        </span>
        <span className="text-gray-400 ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              autoFocus
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pdeu-blue"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            <li
              className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 cursor-pointer"
              onClick={() => { setValue(''); setOpen(false); setSearch('') }}
            >
              — Select —
            </li>
            {filtered.length === 0
              ? <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
              : filtered.map(o => (
                  <li
                    key={o}
                    onClick={() => { setValue(o); setOpen(false); setSearch('') }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-pdeu-light hover:text-pdeu-blue ${value === o ? 'bg-pdeu-light text-pdeu-blue font-medium' : 'text-gray-700'}`}
                  >
                    {o}
                  </li>
                ))
            }
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Main DynamicField component ───────────────────────────────
export default function DynamicField({ field, register, watch, setValue, errors }) {
  // Conditional display
  if (field.conditionalOn) {
    const val = watch(field.conditionalOn.key)
    if (val !== field.conditionalOn.value) return null
  }

  const err     = errors?.[field.key]
  const baseReg = register(field.key, {
    required: field.required ? `${field.label} is required` : false,
  })
  const cls = `form-input${err ? ' border-red-400 ring-1 ring-red-200' : ''}`

  // Use searchable select for dropdowns with more than 5 options
  const useSearchable = field.type === 'select' && field.options?.length > 5

  return (
    <div>
      <label htmlFor={field.key} className="form-label">
        {field.label}
        {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
      </label>

      {field.type === 'textarea' && (
        <textarea id={field.key} {...baseReg} rows={3} className={`${cls} resize-y`} />
      )}

      {field.type === 'select' && useSearchable && (
        <SearchableSelect
          id={field.label}
          options={field.options}
          register={register}
          fieldKey={field.key}
          required={field.required}
          error={err}
        />
      )}

      {field.type === 'select' && !useSearchable && (
        <select id={field.key} {...baseReg} className={cls}>
          <option value="">— Select —</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {field.type === 'boolean' && (
        <div className="flex gap-4 mt-1">
          {['true', 'false'].map(v => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input type="radio" value={v} {...baseReg} />
              {v === 'true' ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      )}

      {field.type === 'file' && (
        <div>
          <input id={field.key} {...baseReg} type="url"
            placeholder="Paste your OneDrive / Google Drive sharing link here"
            className={cls}
          />
          <p className="text-xs text-gray-400 mt-1">
            Upload to OneDrive → right-click → Share → Copy link → paste above.
          </p>
        </div>
      )}

      {field.type === 'url'      && <input id={field.key} {...baseReg} type="url"            placeholder="https://" className={cls} />}
      {field.type === 'date'     && <input id={field.key} {...baseReg} type="date"           className={cls} />}
      {field.type === 'datetime' && <input id={field.key} {...baseReg} type="datetime-local" className={cls} />}
      {field.type === 'number'   && <input id={field.key} {...baseReg} type="number" step="any" min="0" className={cls} />}

      {(!field.type || field.type === 'text') && (
        <input id={field.key} {...baseReg} type="text" className={cls} />
      )}

      {err && <p className="text-xs text-red-500 mt-1">{err.message}</p>}
    </div>
  )
}
