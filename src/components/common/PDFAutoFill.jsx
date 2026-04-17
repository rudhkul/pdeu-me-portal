import { useState } from 'react'

/**
 * PDFAutoFill — extracts text from PDF using pdf.js text layer (no OCR).
 * Digital PDFs (from journals, IEEE, Elsevier etc.) have embedded text — 
 * extraction is instant and accurate. Only scanned PDFs need OCR.
 */

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
}

// Extract text from first 2 pages using pdf.js text layer
async function extractPdfText(file) {
  const pdfjsLib = await loadPdfJs()
  const buf  = await file.arrayBuffer()
  const pdf  = await pdfjsLib.getDocument({ data: buf }).promise
  const pages = Math.min(pdf.numPages, 2)
  let fullText = ''
  for (let i = 1; i <= pages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Join items — preserve line breaks by checking y-position gaps
    let lastY = null
    let pageText = ''
    for (const item of content.items) {
      if (!item.str) continue
      const y = item.transform?.[5]
      if (lastY !== null && Math.abs(y - lastY) > 5) pageText += '\n'
      pageText += item.str
      lastY = y
    }
    fullText += pageText + '\n\n'
  }
  return fullText.trim()
}

function parseFields(text) {
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean)
  const lower  = text.toLowerCase()

  // ── DOI — most reliable ─────────────────────────────────────
  const doiMatch = text.match(/\b(10\.\d{4,9}\/[^\s"<>\]]+)/i)
  const doi = doiMatch ? doiMatch[1].replace(/[.,;)\]]+$/, '') : ''

  // ── Title ───────────────────────────────────────────────────
  // Usually the longest line in the first 20 lines that isn't metadata
  let title = ''
  const skipPatterns = /^(abstract|introduction|keywords?|received|accepted|doi|volume|issue|page|©|www\.|http|email|university|department|institute|college)/i
  const candidates = lines.slice(0, 25).filter(l =>
    l.length > 15 && l.length < 300 && !skipPatterns.test(l) && !/^\d/.test(l)
  )
  // Prefer lines with title-case or all-caps, length 20–200
  title = candidates.find(l => l.length > 20 && l.length < 200) || ''

  // ── Authors ─────────────────────────────────────────────────
  // Look for lines with multiple names separated by commas, and/or superscript numbers
  let authors = ''
  const authorPatterns = [
    // "Firstname Lastname1, Firstname Lastname2" pattern
    /^([A-Z][a-z]+\s+[A-Z][a-z.]+(?:\s*,\s*[A-Z][a-z]+\s+[A-Z][a-z.]+){1,})/,
    // With superscripts: "Smith A¹, Jones B², ..."
    /^([A-Z][a-z]+\s+[A-Z][.,\d*†‡§¹²³]+(?:\s*,\s*[A-Z][a-z]+\s+[A-Z][.,\d*†‡§¹²³]+)+)/,
  ]
  for (const line of lines.slice(0, 30)) {
    for (const pat of authorPatterns) {
      if (pat.test(line) && line.length < 300) { authors = line; break }
    }
    if (authors) break
  }

  // ── Journal / Conference name ────────────────────────────────
  let journal = ''
  const journalKw = /journal|proceedings|conference|symposium|workshop|transaction|letters|review|bulletin|annals|advances/i
  for (const line of lines.slice(0, 40)) {
    if (journalKw.test(line) && line.length > 5 && line.length < 150) {
      journal = line; break
    }
  }
  // Also check for publisher imprints
  if (!journal) {
    const publisherMatch = text.match(/(IEEE|Elsevier|Springer|Wiley|MDPI|Taylor|Nature|Sage|ACM)[^\n]{0,80}/i)
    if (publisherMatch) journal = publisherMatch[0].trim()
  }

  // ── Abstract ────────────────────────────────────────────────
  let abstract = ''
  const absIdx = lower.indexOf('abstract')
  if (absIdx !== -1) {
    // Take text after "abstract" up to "introduction" or "keywords" or 600 chars
    let afterAbs = text.slice(absIdx + 8)
    const endMarkers = ['introduction', 'keywords', '1.', 'i.', 'background']
    let endIdx = afterAbs.length
    for (const m of endMarkers) {
      const idx = afterAbs.toLowerCase().indexOf(m)
      if (idx > 50 && idx < endIdx) endIdx = idx
    }
    abstract = afterAbs.slice(0, Math.min(endIdx, 600)).replace(/^\s*[—:\-]\s*/, '').trim()
  }

  // ── Keywords ────────────────────────────────────────────────
  let keywords = ''
  const kwIdx = lower.indexOf('keyword')
  if (kwIdx !== -1) {
    const afterKw = text.slice(kwIdx, kwIdx + 300)
    const kwMatch = afterKw.match(/[Kk]ey\s*[Ww]ords?\s*[:\-—]?\s*([^\n]{5,200})/)
    if (kwMatch) keywords = kwMatch[1].trim()
  }

  // ── Affiliation ─────────────────────────────────────────────
  let affiliation = ''
  const affKw = /university|institute|department|college|school of|faculty of|pvt\.|ltd\.|inc\./i
  for (const line of lines.slice(0, 40)) {
    if (affKw.test(line) && line.length > 10 && line.length < 200) {
      affiliation = line; break
    }
  }

  // ── Publication year ─────────────────────────────────────────
  const yearMatch = text.match(/\b(20\d{2})\b/)
  const year = yearMatch ? yearMatch[1] : ''

  // ── Volume / Issue / Pages ───────────────────────────────────
  const volMatch  = text.match(/[Vv]ol(?:ume)?\.?\s*(\d+)/);  const volume = volMatch  ? volMatch[1]  : ''
  const issMatch  = text.match(/[Nn]o\.?\s*(\d+)/);           const issue  = issMatch  ? issMatch[1]  : ''
  const pageMatch = text.match(/[Pp]p?\.?\s*(\d+\s*[-–]\s*\d+)/); const pages = pageMatch ? pageMatch[1] : ''

  return { doi, title, authors, journal, abstract, keywords, affiliation, year, volume, issue, pages }
}

const FIELD_MAP = {
  doi:         { key: 'doi',                   label: 'DOI' },
  title:       { key: 'title',                 label: 'Title' },
  authors:     { key: 'coauthors',             label: 'Co-authors' },
  journal:     { key: 'journal_or_conf_name',  label: 'Journal / Conference' },
  affiliation: { key: 'coauthor_affiliations', label: 'Affiliations' },
  abstract:    { key: null,                    label: 'Abstract (preview only)' },
  keywords:    { key: null,                    label: 'Keywords (preview only)' },
  year:        { key: null,                    label: 'Year' },
  volume:      { key: 'volume_no',             label: 'Volume' },
  issue:       { key: 'issue_no',              label: 'Issue' },
  pages:       { key: 'page_nos',              label: 'Pages' },
}

export default function PDFAutoFill({ onFill, disabled }) {
  const [status,   setStatus]   = useState('idle')
  const [fields,   setFields]   = useState(null)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState({})

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setError('Please select a PDF file.'); return
    }

    setStatus('loading'); setError(''); setFields(null)

    try {
      const text   = await extractPdfText(file)
      if (!text || text.length < 50) {
        setError('This PDF has no extractable text (possibly a scan). Try entering details manually.')
        setStatus('error'); return
      }
      const parsed = parseFields(text)
      setFields(parsed)
      // Pre-select all fields that have a value and a form mapping
      const preselect = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (v && FIELD_MAP[k]?.key) preselect[k] = true
      }
      setSelected(preselect)
      setStatus('done')
    } catch (e) {
      setError('Failed to read PDF: ' + (e.message || 'Unknown error'))
      setStatus('error')
    }
  }

  function apply() {
    const out = {}
    for (const [k, checked] of Object.entries(selected)) {
      if (!checked) continue
      const map = FIELD_MAP[k]
      if (map?.key && fields[k]) out[map.key] = fields[k]
    }
    onFill(out)
    setStatus('idle'); setFields(null); setSelected({})
  }

  return (
    <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span>🔍</span>
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          Auto-fill from Publication PDF
        </p>
        <span className="text-xs text-indigo-400 dark:text-indigo-500 ml-auto">
          Extracts text directly — no OCR needed
        </span>
      </div>

      {(status === 'idle' || status === 'error') && (
        <>
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
            ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
            📄 Choose PDF
            <input type="file" accept=".pdf,application/pdf"
              onChange={handleFile} className="hidden" disabled={disabled} />
          </label>
          {error && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{error}</p>}
          <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2">
            Works best with digital PDFs from IEEE, Elsevier, Springer, etc.
          </p>
        </>
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
          Reading PDF…
        </div>
      )}

      {status === 'done' && fields && (
        <div>
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
            Select fields to apply:
          </p>

          <div className="space-y-1.5 mb-3 max-h-52 overflow-y-auto">
            {Object.entries(FIELD_MAP).map(([key, map]) => {
              const val = fields[key]
              if (!val) return null
              return (
                <label key={key}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer text-xs
                    ${map.key ? 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30' : 'opacity-60 cursor-default'}`}>
                  {map.key ? (
                    <input type="checkbox"
                      checked={!!selected[key]}
                      onChange={e => setSelected(s => ({ ...s, [key]: e.target.checked }))}
                      className="mt-0.5 flex-shrink-0 accent-indigo-600"
                    />
                  ) : (
                    <span className="w-3 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {map.label}{!map.key && ' ℹ️'}
                    </span>
                    <p className="text-gray-600 dark:text-gray-400 mt-0.5 break-words leading-relaxed">
                      {val.length > 120 ? val.slice(0, 120) + '…' : val}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={apply}
              disabled={!Object.values(selected).some(Boolean)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs rounded-lg font-medium">
              ✅ Apply selected
            </button>
            <button type="button" onClick={() => { setStatus('idle'); setFields(null) }}
              className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg">
              Discard
            </button>
          </div>
          <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2">
            Always review before saving — extraction is automatic but not perfect.
          </p>
        </div>
      )}
    </div>
  )
}
