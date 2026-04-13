import { useState } from 'react'
import RichTextarea from './RichTextarea'

// ── Searchable select ─────────────────────────────────────────
function SearchableSelect({ label, options, fieldKey, register, required, error }) {
  const [search, setSearch] = useState('')
  const [open,   setOpen]   = useState(false)
  const [value,  setValue]  = useState('')
  const reg = register(fieldKey, { required: required ? `${label} is required` : false })
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative">
      <input type="hidden" {...reg} value={value} />
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`form-input text-left flex items-center justify-between ${error ? 'border-red-400' : ''}`}>
        <span className={value ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}>{value || '— Select —'}</span>
        <span className="text-gray-400 ml-2 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input autoFocus type="text" placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pdeu-blue" />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            <li onClick={() => { setValue(''); setOpen(false); setSearch('') }}
              className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">— Select —</li>
            {filtered.length === 0
              ? <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
              : filtered.map(o => (
                  <li key={o} onClick={() => { setValue(o); setOpen(false); setSearch('') }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-pdeu-light dark:hover:bg-gray-700 hover:text-pdeu-blue
                      ${value === o ? 'bg-pdeu-light text-pdeu-blue font-medium' : 'text-gray-700 dark:text-gray-200'}`}>
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

// ── Multi-file input ──────────────────────────────────────────
function MultiFileInput({ fieldKey, register, error }) {
  const [links, setLinks] = useState([''])
  const reg = register(fieldKey)

  function syncValue(newLinks) {
    setLinks(newLinks)
    // Store as newline-separated string in hidden input
    const el = document.getElementById(`hidden_${fieldKey}`)
    if (el) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      nativeSetter.call(el, newLinks.filter(Boolean).join('\n'))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" id={`hidden_${fieldKey}`} {...reg} />
      {links.map((link, i) => (
        <div key={i} className="flex gap-2">
          <input type="url" value={link} placeholder="Paste OneDrive / Google Drive link"
            onChange={e => { const n = [...links]; n[i] = e.target.value; syncValue(n) }}
            className={`form-input flex-1 ${error && i === 0 ? 'border-red-400' : ''}`} />
          {links.length > 1 && (
            <button type="button" onClick={() => syncValue(links.filter((_, j) => j !== i))}
              className="text-red-400 hover:text-red-600 px-2">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => syncValue([...links, ''])}
        className="text-xs text-pdeu-blue hover:underline flex items-center gap-1">
        + Add another link
      </button>
      <p className="text-xs text-gray-400">Upload to OneDrive → Share → Copy link → paste above.</p>
    </div>
  )
}

// ── Validation rules by field key ─────────────────────────────
const FIELD_VALIDATORS = {
  orcid:         { pattern: /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, message: 'Format: 0000-0000-0000-000X' },
  scopus_id:     { pattern: /^\d{11}$/,                        message: 'Must be exactly 11 digits' },
  researcher_id: { pattern: /^[A-Z]-\d{4}-\d{4}$/,            message: 'WoS format: X-0000-0000' },
  contact_number:{ pattern: /^[0-9]{10}$/,                     message: 'Must be 10 digits' },
  doi:           { pattern: /^10\./,                           message: 'DOI must start with 10.' },
  impact_factor: { min: 0, max: 100, message: 'Must be between 0 and 100' },
}

// ── Main DynamicField ─────────────────────────────────────────
export default function DynamicField({ field, register, watch, setValue, errors }) {
  if (field.conditionalOn) {
    const val = watch(field.conditionalOn.key)
    if (val !== field.conditionalOn.value) return null
  }

  const err = errors?.[field.key]

  // Build validation object for react-hook-form
  const validationRules = {
    required: field.required ? `${field.label} is required` : false,
  }
  const fv = FIELD_VALIDATORS[field.key]
  if (fv?.pattern) {
    validationRules.pattern = { value: fv.pattern, message: fv.message }
  }
  if (fv?.min !== undefined) {
    validationRules.min = { value: fv.min, message: fv.message }
    validationRules.max = { value: fv.max, message: fv.message }
  }

  const baseReg = register(field.key, validationRules)
  const cls = `form-input${err ? ' border-red-400 ring-1 ring-red-200' : ''}`
  const useSearchable = field.type === 'select' && (field.options?.length || 0) > 5

  return (
    <div>
      <label htmlFor={field.key} className="form-label">
        {field.label}
        {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        {fv && <span className="text-gray-400 text-xs ml-1">({fv.message})</span>}
      </label>

      {field.type === 'textarea' && field.richText && (
        <RichTextarea id={field.key} register={baseReg} error={err} />
      )}
      {field.type === 'textarea' && !field.richText && (
        <textarea id={field.key} {...baseReg} rows={3} className={`${cls} resize-y`} />
      )}

      {field.type === 'select' && useSearchable && (
        <SearchableSelect label={field.label} options={field.options}
          fieldKey={field.key} register={register} required={field.required} error={err} />
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
            <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm dark:text-gray-300">
              <input type="radio" value={v} {...baseReg} />{v === 'true' ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      )}

      {field.type === 'file' && (
        <MultiFileInput fieldKey={field.key} register={register} error={err} />
      )}

      {field.type === 'url'      && <input id={field.key} {...baseReg} type="url" placeholder="https://" className={cls} />}
      {field.type === 'date'     && <input id={field.key} {...baseReg} type="date"            className={cls} />}
      {field.type === 'datetime' && <input id={field.key} {...baseReg} type="datetime-local"  className={cls} />}
      {field.type === 'number'   && <input id={field.key} {...baseReg} type="number" step="any" min="0" className={cls} />}
      {(!field.type || field.type === 'text') && (
        <input id={field.key} {...baseReg} type="text" className={cls} />
      )}

      {err && <p className="text-xs text-red-500 mt-1">{err.message}</p>}
    </div>
  )
}
