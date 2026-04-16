import { useEffect, useState, useRef } from 'react'
import { uploadProof, buildFileName, openProofInBrowser, proofFileNameFromPath } from '../../lib/filestore'

/**
 * PDF proof uploader — stores files in the private GitHub data repo.
 * No Azure, no Microsoft sign-in, no popups.
 * Uses the same GitHub PAT that's already in the build.
 *
 * Auto-names files: {TabNum}_{FacultyLastName}_{KeyIdentifier}_{Date}.pdf
 * Stores at: proofs/{tabId}/{userId}/{filename}.pdf
 */
export default function ProofUpload({
  fieldKey, register, setValue,
  tabId, userId, facultyName, watchValues = {}, currentValue = '',
  required, error
}) {
  const [status,   setStatus]   = useState('idle')   // idle | uploading | done | error
  const [fileName, setFileName] = useState('')
  const [storedPath, setStoredPath] = useState('')
  const [progress, setProgress] = useState(0)
  const [errMsg,   setErrMsg]   = useState('')
  const fileRef = useRef()

  useEffect(() => {
    if (!currentValue) {
      if (status !== 'uploading') {
        setStoredPath('')
        setFileName('')
        if (status === 'done') setStatus('idle')
      }
      return
    }

    setStoredPath(currentValue)
    setFileName(proofFileNameFromPath(currentValue))
    if (status !== 'uploading' && status !== 'done') setStatus('done')
  }, [currentValue])


  const reg = register(fieldKey, {
    required: required ? 'Please upload a PDF proof file' : false,
  })

  // Preview the auto-generated filename as soon as a file is selected
  function previewName(file) {
    if (!file) return ''
    return buildFileName(tabId, facultyName, watchValues)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Validate type
    if (!file.type?.includes('pdf') && !file.name?.toLowerCase().endsWith('.pdf')) {
      setStatus('error')
      setErrMsg('Only PDF files are accepted. Please save your document as PDF first.')
      return
    }

    // Validate size
    if (file.size > 10 * 1024 * 1024) {
      setStatus('error')
      setErrMsg(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`)
      return
    }

    setStatus('uploading')
    setErrMsg('')
    setProgress(15)
    setFileName(previewName(file))

    try {
      setProgress(30)
      const result = await uploadProof(file, tabId, userId, facultyName, watchValues)
      setProgress(100)

      setFileName(result.fileName)
      setStoredPath(result.path)
      setStatus('done')

      // Store the GitHub path in drive_link
      setValue(fieldKey, result.path, { shouldDirty: true, shouldValidate: true })
      // Auto-set report_name from the generated filename (no manual input needed)
      setValue('report_name', result.fileName, { shouldDirty: true })

    } catch (err) {
      setStatus('error')
      setErrMsg(err.message || 'Upload failed. Please try again.')
      setProgress(0)
    }
  }

  function clearUpload() {
    setStatus('idle')
    setFileName('')
    setStoredPath('')
    setErrMsg('')
    setProgress(0)
    setValue(fieldKey, '', { shouldDirty: true })
  }

  return (
    <div className="space-y-2">
      {/* Hidden input holds the stored path value for react-hook-form */}
      <input type="hidden" {...reg} value={storedPath || currentValue || ''} readOnly />

      {/* ── Idle state — file picker ── */}
      {status === 'idle' && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFile}
            className="hidden"
            id={`pdf-upload-${fieldKey}`}
          />
          <label
            htmlFor={`pdf-upload-${fieldKey}`}
            className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors
              ${error
                ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-pdeu-blue hover:bg-pdeu-light dark:hover:bg-gray-700'
              }`}
          >
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 text-xl">
              📄
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Upload PDF Proof {required && <span className="text-red-500">*</span>}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                PDF only · max 10 MB · file will be auto-named and saved securely
              </p>
            </div>
            <span className="ml-auto text-xs text-pdeu-blue dark:text-blue-400 font-medium flex-shrink-0">
              Browse →
            </span>
          </label>
        </div>
      )}

      {/* ── Uploading state ── */}
      {status === 'uploading' && (
        <div className="border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm font-semibold text-pdeu-blue dark:text-blue-300">Uploading…</p>
          </div>
          <div className="h-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-pdeu-blue rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {fileName && (
            <p className="text-xs font-mono text-blue-500 dark:text-blue-400 truncate">{fileName}</p>
          )}
          <p className="text-xs text-blue-400 dark:text-blue-500 mt-1">
            This takes a few seconds — do not close the tab.
          </p>
        </div>
      )}

      {/* ── Done state ── */}
      {status === 'done' && (
        <div className="border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-green-500 text-lg flex-shrink-0 mt-0.5">✅</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  PDF uploaded successfully
                </p>
                <p className="text-xs font-mono text-green-600 dark:text-green-500 mt-0.5 truncate" title={fileName}>
                  {fileName}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Saved to: <span className="font-mono">{storedPath}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await openProofInBrowser(storedPath || currentValue)
                  } catch (err) {
                    setStatus('error')
                    setErrMsg(err.message || 'Could not open the uploaded PDF.')
                  }
                }}
                className="text-xs text-pdeu-blue hover:underline dark:text-blue-400 whitespace-nowrap"
              >
                View PDF
              </button>
              <button
                type="button"
                onClick={clearUpload}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 whitespace-nowrap"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'error' && (
        <div className="border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-red-500 flex-shrink-0">❌</span>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Upload failed</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{errMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearUpload}
            className="mt-2 text-xs text-pdeu-blue dark:text-blue-400 underline"
          >
            Try again
          </button>
        </div>
      )}

      {error && status === 'idle' && (
        <p className="text-xs text-red-500 dark:text-red-400">{error.message}</p>
      )}
    </div>
  )
}
