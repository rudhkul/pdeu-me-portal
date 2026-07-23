import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../hooks/useAuth'
import { getTab, PROOF_REQUIRED_TABS } from '../../config/tabs'
import { getFacultyRecords, addRecord, updateRecord, deleteRecord } from '../../lib/github'
import { notifyAdmin } from '../../lib/notify'
import DynamicField from '../common/DynamicField'
import CSVImport from '../common/CSVImport'
import { validateRecord } from '../../utils/recordValidation'
import { activeReportingPeriod } from '../../utils/reportingPeriod'
import SharedPublications from './SharedPublications'
import DOILookup from '../common/DOILookup'
import toast from 'react-hot-toast'
import { openProofInBrowser } from '../../lib/filestore'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isDuplicate(records, values, editingId) {
  const keyFields = ['title','course_name','patent_number','student_name','event_name','training_name','project_title','doi']
  const keyField  = keyFields.find(f => values[f])
  if (!keyField) return null
  const newVal = String(values[keyField]).toLowerCase().trim()
  return records.find(r =>
    r.id !== editingId && r[keyField] &&
    String(r[keyField]).toLowerCase().trim() === newVal
  )
}

const RECORD_IDENTIFIER_KEYS = {
  tab1: 'employee_code',
  tab2: 'details',
  tab3: 'course_name',
  tab4: 'student_name',
  tab5: 'title',
  tab6: 'title',
  tab7: 'brief_detail',
  tab8: 'meeting_details',
  tab9: 'event_name',
  tab10: 'society_name',
  tab11: 'course_name',
  tab12: 'course_name',
  tab13: 'event_name',
  tab14: 'training_name',
  tab15: 'event_name',
  tab16: 'industry_name',
  tab17: 'course_title',
  tab18: 'student_name',
  tab19: 'organisation_name',
  tab20: 'project_title',
  tab21: 'student_name',
}

export default function TabForm() {
  const { tabId }    = useParams()
  const { session }  = useAuth()
  const tab          = getTab(tabId)
  const proofRequired = PROOF_REQUIRED_TABS.includes(tabId)

  const [records,  setRecords]  = useState([])
  const [editing,  setEditing]  = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [isDirty,  setIsDirty]  = useState(false)
  const [search,   setSearch]   = useState('')

  const { register, handleSubmit, reset, watch, setValue, setError, clearErrors,
          formState: { errors, isDirty: formDirty } } = useForm({
    shouldUnregister: true,
  })

  useEffect(() => { setIsDirty(formDirty) }, [formDirty])

  useEffect(() => {
    if (!isDirty) return
    const fn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [isDirty])

  useEffect(() => {
    if (!showForm && !tab?.isProfile) return
    const fn = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('tab-form-submit')?.click()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showForm, tab])

  useEffect(() => { if (tab) fetchRecords() }, [tabId])

  async function fetchRecords() {
    setLoading(true)
    try {
      const data = await getFacultyRecords(tab.id, session.userId)
      setRecords(data)
      if (tab.isProfile && data.length > 0) reset(data[0])
    } catch (e) { toast.error('Failed to load: ' + e.message) }
    finally { setLoading(false) }
  }

  async function onSubmit(values) {
    clearErrors()
    const validationIssues = validateRecord(tab, values)
    if (validationIssues.length > 0) {
      for (const issue of validationIssues) {
        setError(issue.field, { type: 'validate', message: issue.message })
      }
      toast.error(validationIssues[0].message)
      return
    }

    // Proof required check
    if (proofRequired && !values.drive_link) {
      toast.error('Please upload a PDF supporting document before saving.')
      return
    }

    // Duplicate DOI check for publications
    if (tab.id === 'tab5' && values.doi && !editing) {
      const doiDup = records.find(r =>
        r.doi && r.doi.toLowerCase().trim() === values.doi.toLowerCase().trim()
      )
      if (doiDup) {
        toast.error(`A publication with DOI "${values.doi}" already exists in your records.`)
        return
      }
    }

    // General duplicate check
    const dup = isDuplicate(records, values, editing)
    if (dup && !confirm(
      `A similar record already exists:\n"${dup.title || dup.course_name || dup.event_name || dup.student_name}"\n\nSubmit another record?`
    )) return

    setSaving(true)
    try {
      const payload = {
        ...values,
        facultyName: session.fullName,
        _reportingMonth: editing
          ? records.find(record => record.id === editing)?._reportingMonth || activeReportingPeriod()
          : activeReportingPeriod(),
      }
      let action = 'added'

      if (tab.isProfile) {
        const cur = records[0]
        const updated = cur
          ? await updateRecord(tab.id, session.userId, cur.id, payload)
          : await addRecord(tab.id, session.userId, payload)
        setRecords(updated)
        action = cur ? 'updated' : 'added'
        window.dispatchEvent(new Event('pdeu-profile-updated'))
        toast.success('Profile saved.')
      } else if (editing) {
        setRecords(await updateRecord(tab.id, session.userId, editing, payload))
        setEditing(null); setShowForm(false); reset()
        action = 'updated'
        toast.success('Record updated.')
      } else {
        setRecords(await addRecord(tab.id, session.userId, payload))
        setShowForm(false); reset()
        toast.success('Record saved.')
      }
      setIsDirty(false)
      notifyAdmin({ tabId: tab.id, tabName: tab.name, facultyName: session.fullName, action })
    } catch (e) { toast.error('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  // CSV import — proof not required for CSV (they can't upload PDFs in bulk)
  async function handleCSVImport(rows) {
    let saved = 0
    let current = records
    for (const row of rows) {
      const payload = {
        ...row,
        drive_link: '',
        proof_link: '',
        event_report_link: '',
        facultyName: session.fullName,
        _reportingMonth: activeReportingPeriod(),
      }
      try {
        current = await addRecord(tab.id, session.userId, payload)
        saved++
      } catch (e) {
        toast.error(`Row ${saved + 1} failed: ${e.message}`)
        break
      }
    }
    setRecords(current)
    toast.success(
      ` Imported ${saved} of ${rows.length} records.` +
      (proofRequired ? ' Open each record and upload its supporting document.' : ''),
      { duration: 6000 }
    )
    notifyAdmin({ tabId: tab.id, tabName: tab.name, facultyName: session.fullName, action: `bulk-imported ${saved} records` })
  }

  function handleDOIFill(fields) {
    reset()
    Object.entries(fields).forEach(([key, val]) =>
      setValue(key, val, { shouldDirty: true })
    )
  }

  async function handleOpenProof(storedPath) {
    try {
      await openProofInBrowser(storedPath)
    } catch (e) {
      toast.error('Could not open PDF: ' + e.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this record? Cannot be undone.')) return
    try {
      setRecords(await deleteRecord(tab.id, session.userId, id))
      toast.success('Deleted')
      notifyAdmin({ tabId: tab.id, tabName: tab.name, facultyName: session.fullName, action: 'deleted' })
    } catch (e) { toast.error(e.message) }
  }

  function startEdit(row) {
    setEditing(row.id); reset(row); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    if (isDirty && !confirm('Discard unsaved changes?')) return
    reset(); setEditing(null); setShowForm(false); setIsDirty(false)
  }

  if (!tab) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Tab not found.</div>

  const availablePreviewFields = tab.fields.filter(
    field => !['file', 'textarea', 'boolean', 'proof_upload', 'sdg_multi'].includes(field.type)
  )
  const identifierKey = RECORD_IDENTIFIER_KEYS[tab.id]
  const identifierField = tab.fields.find(field => field.key === identifierKey)
  const previewFields = [
    identifierField,
    ...availablePreviewFields.filter(field => field.key !== identifierKey),
  ].filter(Boolean).slice(0, 4)

  function getUploadedDocuments(row) {
    return tab.fields
      .filter(field => field.type === 'proof_upload' && row[field.key])
      .map(field => ({
        key: field.key,
        path: row[field.key],
        label: field.label
          .replace(/^Upload\s+/i, '')
          .replace(/\s*\(PDF\)\s*$/i, ''),
      }))
  }

  // Client-side search within faculty's own records
  const filteredRecords = search
    ? records.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
    : records

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/faculty" className="text-gray-400 hover:text-pdeu-blue dark:hover:text-blue-400">← Dashboard</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="font-bold text-pdeu-blue dark:text-white text-lg flex items-center gap-2">
          {tab.name}
        </h1>
        {proofRequired && (
          <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
            Supporting document required
          </span>
        )}
      </div>

      {tab.emphasis && (
        <div className="mb-5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
          <strong>{tab.emphasis}</strong>{' '}
          {tab.description}
        </div>
      )}

      {saving && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Saving to repository…
        </div>
      )}

      {isDirty && !saving && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-4 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
           Unsaved changes —
          <kbd className="bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+S</kbd>
        </div>
      )}

      {/* CSV Bulk Import */}
      {!tab.isProfile && (
        <CSVImport tab={tab} onImport={handleCSVImport} disabled={saving} />
      )}

      {/* Form */}
      {(showForm || tab.isProfile) && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">
              {editing ? 'Edit Record' : tab.isProfile ? 'Faculty Profile' : 'Add Record'}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              <span className="text-red-500">*</span> Required
            </p>
          </div>

          {tab.id === 'tab5' && !editing && <DOILookup onFill={handleDOIFill} facultyName={session.fullName} />}


          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tab.fields.map(field => {
                // Override proof required based on tab
                const f = field.key === 'drive_link'
                  ? { ...field, required: proofRequired }
                  : field
                return (
                  <div key={field.key} className={['textarea','file','url','proof_upload'].includes(field.type) ? 'md:col-span-2' : ''}>
                    <DynamicField
                      field={f} register={register}
                      watch={watch} setValue={setValue} errors={errors}
                      tab={{ ...tab, _facultyName: session.fullName, _userId: session.userId, _watchValues: watch() }}
                    />
                  </div>
                )
              })}
            </div>

            {/* CSV import notice */}
            {editing && !watch('drive_link') && proofRequired && (
              <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
                 This record was imported through CSV and does not include a supporting document. Upload the required PDF above.
              </div>
            )}

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button id="tab-form-submit" type="submit" className="btn-primary" disabled={saving}>
                {saving ? ' Saving…' : editing ? 'Update' : 'Save'}
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                or <kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono text-xs">Ctrl+S</kbd>
              </span>
              {!tab.isProfile && (
                <button type="button" onClick={cancelForm} className="btn-secondary ml-auto">Cancel</button>
              )}
            </div>
          </form>

          {tab.isProfile && records[0] && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
              <p>Created: {formatDate(records[0].createdAt)}</p>
              <p>Last updated: {formatDate(records[0].updatedAt || records[0].createdAt)}</p>
            </div>
          )}
        </div>
      )}

      {!tab.isProfile && !showForm && (
        <button onClick={() => { setEditing(null); reset(); setShowForm(true) }} className="btn-primary mb-6">
           Add Record
        </button>
      )}

      {/* Tab5: Show publications where this faculty is tagged as dept co-author */}
      {tab.id === 'tab5' && <SharedPublications session={session} />}

      {/* Records table */}
      {!tab.isProfile && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">
              Submitted Records ({records.length})
            </h2>
            {records.length > 3 && (
              <input
                type="text"
                placeholder="Search submitted records…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input max-w-xs text-sm"
              />
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading…
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <p>No records have been submitted. Use "Add Record" or "Bulk Import via CSV".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {previewFields.map(f => (
                      <th key={f.key} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Updated</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Supporting Document</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row, idx) => (
                    <tr key={row.id}
                      className={`border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50
                        ${idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-gray-800/40' : ''}`}>
                      {previewFields.map(f => (
                        <td key={f.key} className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[160px] truncate"
                          title={String(row[f.key] ?? '')}>
                          {row[f.key] ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(row.updatedAt || row.createdAt)}
                      </td>
                      {/* Uploaded supporting documents */}
                      <td className="px-3 py-2 text-xs">
                        {getUploadedDocuments(row).length > 0 ? (
                          <div className="flex flex-col items-start gap-1">
                            {getUploadedDocuments(row).map(document => (
                              <button
                                key={document.key}
                                type="button"
                                onClick={() => handleOpenProof(document.path)}
                                className="text-green-600 dark:text-green-400 font-medium hover:underline text-left"
                              >
                                {document.label}
                              </button>
                            ))}
                          </div>
                        ) : proofRequired ? (
                          <span className="text-red-500 dark:text-red-400">Not Submitted</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-3">
                          <button onClick={() => startEdit(row)} className="text-pdeu-blue dark:text-blue-400 hover:underline text-xs">Edit</button>
                          <button onClick={() => handleDelete(row.id)} className="text-red-400 hover:underline text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {search && filteredRecords.length === 0 && (
                <p className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">No records match "{search}"</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
