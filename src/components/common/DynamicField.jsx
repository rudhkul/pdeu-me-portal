import { useState } from 'react'
import RichTextarea from './RichTextarea'
import SDGSelector from './SDGSelector'

// ── Searchable select ─────────────────────────────────────────
function SearchableSelect({ label, options, fieldKey, register, required, error }) {
  const [search, setSearch] = useState('')
  const [open,   setOpen]   = useState(false)
  const [value,  setValue]  = useState('')
  const reg      = register(fieldKey, { required: required ? `${label} is required` : false })
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative">
      <input type="hidden" {...reg} value={value} />
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`form-input text-left flex items-center justify-between ${error ? 'border-red-400' : ''}`}>
        <span className={value ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {value || '— Select —'}
        </span>
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
              className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              — Select —
            </li>
            {filtered.length === 0
              ? <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
              : filtered.map(o => (
                  <li key={o} onClick={() => { setValue(o); setOpen(false); setSearch('') }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-pdeu-light dark:hover:bg-gray-700
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
function MultiFileInput({ fieldKey, register, required, error }) {
  const [links, setLinks] = useState([''])
  const reg = register(fieldKey, {
    required: required ? 'A proof link is required' : false,
    validate: val => {
      if (!val && !required) return true
      const urls = (val || '').split('\n').filter(Boolean)
      if (!urls.length) return required ? 'At least one proof link is required' : true
      const badUrl = urls.find(u => !isValidDriveLink(u))
      if (badUrl) return 'Links must be from OneDrive or Google Drive'
      return true
    },
  })

  function syncValue(newLinks) {
    setLinks(newLinks)
    const el = document.getElementById(`hidden_${fieldKey}`)
    if (el) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, newLinks.filter(Boolean).join('\n'))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" id={`hidden_${fieldKey}`} {...reg} />
      {links.map((link, i) => (
        <div key={i} className="flex gap-2">
          <input type="url" value={link}
            placeholder="https://pdpu-my.sharepoint.com/… or https://drive.google.com/…"
            onChange={e => { const n = [...links]; n[i] = e.target.value; syncValue(n) }}
            className={`form-input flex-1 ${error && i === 0 ? 'border-red-400 ring-1 ring-red-200' : ''}`} />
          {links.length > 1 && (
            <button type="button" onClick={() => syncValue(links.filter((_, j) => j !== i))}
              className="text-red-400 hover:text-red-600 px-2 text-lg leading-none">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => syncValue([...links, ''])}
        className="text-xs text-pdeu-blue dark:text-blue-400 hover:underline flex items-center gap-1">
        + Add another link
      </button>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Must be a valid <strong>OneDrive</strong> or <strong>Google Drive</strong> sharing link.
        Upload file → right-click → Share → Copy link → paste above.
      </p>
    </div>
  )
}

// ── Proof link validator ──────────────────────────────────────
function isValidDriveLink(url) {
  if (!url) return false
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    return (
      host.includes('sharepoint.com')   ||   // OneDrive institutional
      host.includes('onedrive.live.com') ||   // OneDrive personal
      host.includes('1drv.ms')           ||   // OneDrive short link
      host.includes('drive.google.com')  ||   // Google Drive
      host.includes('docs.google.com')        // Google Docs/Sheets
    )
  } catch { return false }
}

// ── Standalone proof_link field (required, validated) ─────────
function ProofLinkField({ fieldKey, register, required, error, placeholder }) {
  const reg = register(fieldKey, {
    required: required ? 'A proof link from OneDrive or Google Drive is required' : false,
    validate: val => {
      if (!val && !required) return true
      if (!val) return 'A proof link is required'
      if (!isValidDriveLink(val))
        return 'Must be a valid OneDrive (sharepoint.com / onedrive.live.com) or Google Drive link'
      return true
    },
  })

  return (
    <div className="space-y-1.5">
      <input
        type="url"
        {...reg}
        placeholder={placeholder || 'https://pdpu-my.sharepoint.com/… or https://drive.google.com/…'}
        className={`form-input ${error ? 'border-red-400 ring-1 ring-red-200' : ''}`}
      />
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Must be from <strong>OneDrive</strong> (SharePoint / onedrive.live.com) or <strong>Google Drive</strong>.
      </p>
    </div>
  )
}

// ── Field-level validators ────────────────────────────────────
const FIELD_VALIDATORS = {
  orcid:          { pattern: /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, message: 'Format: 0000-0000-0000-000X' },
  scopus_id:      { pattern: /^\d{11}$/,                         message: 'Must be exactly 11 digits' },
  researcher_id:  { pattern: /^[A-Z]-\d{4}-\d{4}$/,             message: 'WoS format: X-0000-0000' },
  contact_number: { pattern: /^[0-9]{10}$/,                      message: 'Must be 10 digits' },
  doi:            { pattern: /^10\./,                            message: 'DOI must start with 10.' },
  impact_factor:  { min: 0, max: 100,                            message: 'Must be between 0 and 100' },
  report_name:    {
    pattern: /^[\w\s\-_\.]+$/,
    message: 'Use only letters, numbers, underscores, hyphens. E.g. 5_Publications_DrRaviKant',
  },
}

// ── Main DynamicField ─────────────────────────────────────────
export default function DynamicField({ field, register, watch, setValue, errors }) {

  // Conditional display — supports '__nonempty__' sentinel for SDG details
  if (field.conditionalOn) {
    const watchVal = watch(field.conditionalOn.key)
    if (field.conditionalOn.value === '__nonempty__') {
      if (!watchVal) return null
    } else {
      if (watchVal !== field.conditionalOn.value) return null
    }
  }

  const err = errors?.[field.key]

  // Build validation rules
  const rules = {
    required: field.required ? `${field.label} is required` : false,
  }
  const fv = FIELD_VALIDATORS[field.key]
  if (fv?.pattern) rules.pattern = { value: fv.pattern, message: fv.message }
  if (fv?.min !== undefined) {
    rules.min = { value: fv.min, message: fv.message }
    rules.max = { value: fv.max, message: fv.message }
  }

  const baseReg = register(field.key, rules)
  const cls     = `form-input${err ? ' border-red-400 ring-1 ring-red-200' : ''}`
  const useSearchable = field.type === 'select' && (field.options?.length || 0) > 5

  // Current SDG value (needed for SDGSelector)
  const sdgValue = watch ? watch(field.key) || '' : ''

  return (
    <div>
      <label htmlFor={field.key} className="form-label">
        {field.label}
        {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
        {fv && field.type !== 'sdg_multi' && (
          <span className="text-gray-400 dark:text-gray-500 text-xs ml-1 font-normal">
            ({fv.message})
          </span>
        )}
      </label>

      {/* ── SDG multi-select ── */}
      {field.type === 'sdg_multi' && (
        <SDGSelector
          fieldKey={field.key}
          register={register}
          value={sdgValue}
          onChange={val => setValue(field.key, val, { shouldDirty: true })}
        />
      )}

      {/* ── Proof link (validated drive URL) ── */}
      {field.type === 'proof_link' && (
        <ProofLinkField
          fieldKey={field.key}
          register={register}
          required={field.required}
          error={err}
          placeholder={field.placeholder}
        />
      )}

      {/* ── Textarea ── */}
      {field.type === 'textarea' && (
        field.richText
          ? <RichTextarea id={field.key} register={baseReg} error={err} />
          : <textarea id={field.key} {...baseReg} rows={3} className={`${cls} resize-y`} />
      )}

      {/* ── Select ── */}
      {field.type === 'select' && useSearchable && (
        <SearchableSelect
          label={field.label} options={field.options}
          fieldKey={field.key} register={register}
          required={field.required} error={err}
        />
      )}
      {field.type === 'select' && !useSearchable && (
        <select id={field.key} {...baseReg} className={cls}>
          <option value="">— Select —</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {/* ── Boolean ── */}
      {field.type === 'boolean' && (
        <div className="flex gap-4 mt-1">
          {['true', 'false'].map(v => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm dark:text-gray-300">
              <input type="radio" value={v} {...baseReg} />
              {v === 'true' ? 'Yes' : 'No'}
            </label>
          ))}
        </div>
      )}

      {/* ── File (multi-link) ── */}
      {field.type === 'file' && (
        <MultiFileInput fieldKey={field.key} register={register} required={field.required} error={err} />
      )}

      {/* ── Standard inputs ── */}
      {field.type === 'url'      && <input id={field.key} {...baseReg} type="url" placeholder="https://" className={cls} />}
      {field.type === 'date'     && <input id={field.key} {...baseReg} type="date"            className={cls} />}
      {field.type === 'datetime' && <input id={field.key} {...baseReg} type="datetime-local"  className={cls} />}
      {field.type === 'number'   && <input id={field.key} {...baseReg} type="number" step="any" min="0" className={cls} />}
      {(!field.type || field.type === 'text') && (
        <input
          id={field.key} {...baseReg} type="text"
          placeholder={field.placeholder || ''}
          className={cls}
        />
      )}

      {err && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{err.message}</p>}
    </div>
  )
}
