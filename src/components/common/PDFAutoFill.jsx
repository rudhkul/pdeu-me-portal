import { useState } from 'react'

/**
 * PDFAutoFill — reads the first page of a PDF, runs OCR via Tesseract.js (CDN),
 * then attempts to extract: title, authors, journal, DOI, abstract, affiliation.
 *
 * Purely client-side — no server needed.
 * Used in Tab 5 (Publications) to pre-fill form fields from a PDF upload.
 */

// Load pdfjs and Tesseract from CDN dynamically (no npm install needed)
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

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js'
    s.onload  = () => resolve(window.Tesseract)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

// Render first page of PDF to a canvas, return ImageData
async function pdfFirstPageImage(file) {
  const pdfjsLib = await loadPdfJs()
  const arrayBuf = await file.arrayBuffer()
  const pdf      = await pdfjsLib.getDocument({ data: arrayBuf }).promise
  const page     = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2.0 })  // higher scale = better OCR
  const canvas   = document.createElement('canvas')
  canvas.width   = viewport.width
  canvas.height  = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas
}

// Extract text from canvas via Tesseract OCR
async function ocrCanvas(canvas, onProgress) {
  const Tesseract = await loadTesseract()
  const result    = await Tesseract.recognize(canvas, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100))
    },
  })
  return result.data.text
}

// Parse known fields from raw OCR text
function parseFields(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const lower = text.toLowerCase()

  // DOI — very reliable regex
  const doiMatch = text.match(/\b(10\.\d{4,}\/[^\s"<>]+)/i)
  const doi = doiMatch ? doiMatch[1].replace(/[.,;)\]]+$/, '') : ''

  // Abstract — look for "Abstract" keyword
  const absIdx = lower.indexOf('abstract')
  let abstract = ''
  if (absIdx !== -1) {
    const afterAbs = text.slice(absIdx + 8, absIdx + 800).trim()
    abstract = afterAbs.replace(/^[\s:—-]+/, '').split('\n').slice(0, 5).join(' ').trim()
  }

  // Keywords
  const kwIdx = lower.indexOf('keyword')
  let keywords = ''
  if (kwIdx !== -1) {
    const afterKw = text.slice(kwIdx, kwIdx + 200)
    const kwMatch = afterKw.match(/[Kk]eywords?[:—\s]+([^\n]+)/)
    if (kwMatch) keywords = kwMatch[1].trim()
  }

  // Journal / Conference name — look for common patterns
  let journal = ''
  const journalPatterns = [
    /(?:journal of|proceedings of|conference on|international journal)[^\n]{3,60}/i,
    /(?:IEEE|ACM|Elsevier|Springer|Taylor|Wiley|MDPI|Nature|Sage)[^\n]{3,60}/i,
  ]
  for (const p of journalPatterns) {
    const m = text.match(p)
    if (m) { journal = m[0].trim(); break }
  }

  // Title — usually the largest/first meaningful line in the first ~10 lines
  // Heuristic: first line with 5+ words that isn't an affiliation or email
  let title = ''
  for (const line of lines.slice(0, 15)) {
    if (line.length < 10) continue
    if (/[@\d{4}]/.test(line) && line.length < 30) continue  // skip year/email lines
    if (/university|institute|department|college/i.test(line)) continue
    if (line.split(' ').length >= 4 && line.length > 20) { title = line; break }
  }

  // Authors — line with multiple comma/semicolon separated names, often has superscripts
  let authors = ''
  for (const line of lines.slice(0, 20)) {
    if (/,\s*[A-Z]/.test(line) && line.split(',').length >= 2 && line.length < 200) {
      // Looks like "Smith, J., Jones, A.B., ..."
      if (!/abstract|journal|volume|doi/i.test(line)) { authors = line; break }
    }
  }

  // Affiliation — look for university/institute line
  let affiliation = ''
  for (const line of lines.slice(0, 30)) {
    if (/university|institute|department|college|pvt|ltd/i.test(line) && line.length > 15) {
      affiliation = line; break
    }
  }

  return { doi, title, authors, abstract, keywords, journal, affiliation }
}

export default function PDFAutoFill({ onFill, disabled }) {
  const [status,   setStatus]   = useState('idle')  // idle|loading|ocr|done|error
  const [progress, setProgress] = useState(0)
  const [preview,  setPreview]  = useState(null)
  const [error,    setError]    = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.')
      return
    }

    setStatus('loading')
    setError('')
    setPreview(null)

    try {
      setStatus('loading')
      const canvas = await pdfFirstPageImage(file)

      setStatus('ocr')
      const text   = await ocrCanvas(canvas, setProgress)
      const fields = parseFields(text)
      setPreview(fields)
      setStatus('done')
    } catch (e) {
      setError('OCR failed: ' + (e.message || 'Unknown error'))
      setStatus('error')
    }
  }

  function applyFields() {
    if (!preview) return
    onFill(preview)
    setStatus('idle')
    setPreview(null)
  }

  return (
    <div className="mb-5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🔍</span>
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          Auto-fill from PDF
        </p>
        <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-auto">
          Upload the publication PDF to extract details automatically
        </span>
      </div>

      {status === 'idle' || status === 'error' ? (
        <>
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
            ${disabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}>
            📄 Choose PDF to scan
            <input type="file" accept=".pdf,application/pdf" onChange={handleFile}
              className="hidden" disabled={disabled} />
          </label>
          {error && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{error}</p>}
        </>
      ) : status === 'loading' ? (
        <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
          Rendering PDF first page…
        </div>
      ) : status === 'ocr' ? (
        <div>
          <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 mb-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
            Running OCR… {progress}%
          </div>
          <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : status === 'done' && preview && (
        <div>
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
            ✅ Extracted — review and click Apply:
          </p>
          <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
            {Object.entries(preview).map(([key, val]) => {
              if (!val) return null
              const labels = {
                doi: 'DOI', title: 'Title', authors: 'Authors',
                journal: 'Journal / Conference', abstract: 'Abstract',
                keywords: 'Keywords', affiliation: 'Affiliation',
              }
              return (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="text-indigo-500 dark:text-indigo-400 font-medium w-20 flex-shrink-0">
                    {labels[key]}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 truncate" title={val}>
                    {val.length > 80 ? val.slice(0, 80) + '…' : val}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={applyFields}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-medium">
              ✅ Apply to form
            </button>
            <button type="button" onClick={() => { setStatus('idle'); setPreview(null) }}
              className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg">
              Discard
            </button>
          </div>
          <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2">
            OCR is not perfect — always review and correct extracted values.
          </p>
        </div>
      )}
    </div>
  )
}
