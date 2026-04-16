import { useEffect, useRef, useState } from 'react'
import {
  uploadProfilePicture,
  getStoredFileObjectUrl,
  profilePictureFileNameFromPath,
} from '../../lib/filestore'

export default function ProfilePictureUpload({
  fieldKey, register, setValue,
  userId, facultyName, currentValue = '',
  required, error,
}) {
  const [status, setStatus] = useState('idle')
  const [fileName, setFileName] = useState('')
  const [storedPath, setStoredPath] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [progress, setProgress] = useState(0)
  const fileRef = useRef(null)
  const previewRef = useRef('')

  useEffect(() => {
    let active = true

    async function syncExistingPicture() {
      if (!currentValue) {
        if (status !== 'uploading') {
          setStoredPath('')
          setFileName('')
          setPreviewUrl('')
          if (status === 'done') setStatus('idle')
        }
        if (previewRef.current) {
          URL.revokeObjectURL(previewRef.current)
          previewRef.current = ''
        }
        return
      }

      setStoredPath(currentValue)
      setFileName(profilePictureFileNameFromPath(currentValue))
      if (status !== 'uploading') setStatus('done')

      try {
        const { objectUrl } = await getStoredFileObjectUrl(currentValue)
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        if (previewRef.current) URL.revokeObjectURL(previewRef.current)
        previewRef.current = objectUrl
        setPreviewUrl(objectUrl)
      } catch {
        if (active) setPreviewUrl('')
      }
    }

    syncExistingPicture()

    return () => {
      active = false
    }
  }, [currentValue])

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current)
        previewRef.current = ''
      }
    }
  }, [])

  const reg = register(fieldKey, {
    required: required ? 'Please upload a profile picture' : false,
  })

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const ext = file.name.toLowerCase()
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type) && !ext.endsWith('.jpg') && !ext.endsWith('.jpeg') && !ext.endsWith('.png') && !ext.endsWith('.webp')) {
      setStatus('error')
      setErrMsg('Only JPG, PNG, or WEBP images are allowed.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatus('error')
      setErrMsg(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`)
      return
    }

    setStatus('uploading')
    setErrMsg('')
    setProgress(15)

    const localPreview = URL.createObjectURL(file)
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = localPreview
    setPreviewUrl(localPreview)
    setFileName(file.name)

    try {
      setProgress(40)
      const result = await uploadProfilePicture(file, userId, facultyName)
      setProgress(100)
      setStoredPath(result.path)
      setFileName(result.fileName)
      setStatus('done')
      setValue(fieldKey, result.path, { shouldDirty: true, shouldValidate: true })
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
    setValue(fieldKey, '', { shouldDirty: true, shouldValidate: true })
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = ''
    }
    setPreviewUrl('')
  }

  return (
    <div className="space-y-3">
      <input type="hidden" {...reg} value={storedPath || currentValue || ''} readOnly />

      <div className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-gray-600">
          {previewUrl ? (
            <img src={previewUrl} alt="Profile preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-gray-400">👤</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Profile Picture {required && <span className="text-red-500">*</span>}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              JPG, PNG, or WEBP · max 5 MB · square image preferred
            </p>
          </div>

          {fileName && (
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate" title={fileName}>
              {fileName}
            </p>
          )}

          {status === 'uploading' && (
            <div>
              <div className="h-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
                <div className="h-full bg-pdeu-blue rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">Uploading image…</p>
            </div>
          )}

          {status === 'done' && storedPath && (
            <p className="text-xs text-green-600 dark:text-green-400 break-all">
              Saved to: <span className="font-mono">{storedPath}</span>
            </p>
          )}

          {status === 'error' && (
            <p className="text-xs text-red-500 dark:text-red-400">{errMsg}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleFile}
              className="hidden"
              id={`profile-picture-upload-${fieldKey}`}
            />
            <label htmlFor={`profile-picture-upload-${fieldKey}`} className="btn-secondary cursor-pointer">
              {status === 'done' ? 'Replace Picture' : 'Upload Picture'}
            </label>
            {(storedPath || currentValue) && (
              <button type="button" onClick={clearUpload} className="text-xs text-red-500 hover:underline">
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {error && status !== 'error' && (
        <p className="text-xs text-red-500 dark:text-red-400">{error.message}</p>
      )}
    </div>
  )
}
