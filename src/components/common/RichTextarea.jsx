import { useRef } from 'react'

// Simple markdown-style toolbar for textarea fields
// Stores plain markdown, renders as text in tables
export default function RichTextarea({ id, register, error, rows = 4 }) {
  const ref = useRef(null)

  function wrap(before, after = before) {
    const el    = ref.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = el.value.slice(start, end) || 'text'
    const newVal = el.value.slice(0, start) + before + sel + after + el.value.slice(end)
    // Trigger react-hook-form's onChange via native input event
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    nativeInputValueSetter.call(el, newVal)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
    el.selectionStart = start + before.length
    el.selectionEnd   = start + before.length + sel.length
  }

  function bulletLine() {
    const el    = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = el.value.lastIndexOf('\n', start - 1) + 1
    const insert = el.value.slice(lineStart, lineStart + 2) === '- ' ? '' : '- '
    const newVal = el.value.slice(0, lineStart) + insert + el.value.slice(lineStart)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    nativeInputValueSetter.call(el, newVal)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
  }

  const btnCls = 'px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors'

  return (
    <div className={`border rounded-lg overflow-hidden dark:border-gray-600 ${error ? 'border-red-400' : 'border-gray-300'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
        <button type="button" onClick={() => wrap('**')}   className={btnCls} title="Bold"><b>B</b></button>
        <button type="button" onClick={() => wrap('*')}    className={btnCls} title="Italic"><i>I</i></button>
        <button type="button" onClick={bulletLine}          className={btnCls} title="Bullet">• List</button>
        <span className="ml-auto text-xs text-gray-300 dark:text-gray-600 pr-1">Markdown</span>
      </div>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        {...register}
        className="w-full px-3 py-2 text-sm focus:outline-none resize-y bg-white dark:bg-gray-900 dark:text-gray-100"
      />
    </div>
  )
}
