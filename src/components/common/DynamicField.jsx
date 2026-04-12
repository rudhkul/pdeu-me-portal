// Renders the correct input for each field type.
// File fields = paste a sharing link (OneDrive/Drive link manually copied)
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

  return (
    <div>
      <label htmlFor={field.key} className="form-label">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === 'textarea' && (
        <textarea id={field.key} {...baseReg} rows={3} className={`${cls} resize-y`} />
      )}

      {field.type === 'select' && (
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
          <input
            id={field.key}
            {...baseReg}
            type="url"
            placeholder="Paste your OneDrive / Google Drive sharing link here"
            className={cls}
          />
          <p className="text-xs text-gray-400 mt-1">
            Upload the file to your OneDrive → right-click → Share → Copy link → paste above.
          </p>
        </div>
      )}

      {field.type === 'url' && (
        <input id={field.key} {...baseReg} type="url" placeholder="https://" className={cls} />
      )}

      {field.type === 'date'     && <input id={field.key} {...baseReg} type="date"           className={cls} />}
      {field.type === 'datetime' && <input id={field.key} {...baseReg} type="datetime-local"  className={cls} />}
      {field.type === 'number'   && <input id={field.key} {...baseReg} type="number" step="any" min="0" className={cls} />}

      {(!field.type || field.type === 'text') && (
        <input id={field.key} {...baseReg} type="text" className={cls} />
      )}

      {err && <p className="text-xs text-red-500 mt-1">{err.message}</p>}
    </div>
  )
}
