import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { TABS } from '../../config/tabs'
import { getFacultyRecords } from '../../lib/github'
import { getStoredFileObjectUrl, openProofInBrowser } from '../../lib/filestore'
import toast from 'react-hot-toast'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

export default function FacultyProfile() {
  const { session } = useAuth()
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [profileImageUrl, setProfileImageUrl] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const results = {}
        await Promise.all(TABS.map(async tab => {
          const records = await getFacultyRecords(tab.id, session.userId)
          results[tab.id] = records
        }))
        setData(results)
      } catch (e) {
        toast.error('Failed to load: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session.userId])

  const profile = data['tab1']?.[0] || {}
  const totalRecs = Object.values(data).flat().length

  useEffect(() => {
    let active = true
    let objectUrl = ''

    async function loadProfileImage() {
      if (!profile.profile_picture) {
        setProfileImageUrl('')
        return
      }
      try {
        const result = await getStoredFileObjectUrl(profile.profile_picture)
        objectUrl = result.objectUrl
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setProfileImageUrl(objectUrl)
      } catch {
        if (active) setProfileImageUrl('')
      }
    }

    loadProfileImage()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profile.profile_picture])

  function print() {
    window.print()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white">🖨️ My Data Summary</h1>
        <button onClick={print} className="btn-primary flex items-center gap-2">
          🖨️ Print / Save as PDF
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          Loading your data…
        </div>
      ) : (
        <div className="space-y-6" id="print-area">
          <div className="bg-pdeu-blue text-white rounded-xl p-6 print:rounded-none">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt={session.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold">{session.fullName?.[0]?.toUpperCase() || '?'}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">
                  Department of Mechanical Engineering — PDEU
                </p>
                <h2 className="text-2xl font-bold">{session.fullName}</h2>
                <p className="text-sm opacity-80 mt-0.5">
                  {profile.present_designation || 'Faculty'} · {profile.area_of_specialization || ''}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs opacity-70">
                  {profile.orcid && <span>ORCID: {profile.orcid}</span>}
                  {profile.scopus_id && <span>SCOPUS: {profile.scopus_id}</span>}
                  {profile.vidwan_id && <span>Vidwan: {profile.vidwan_id}</span>}
                </div>
                <p className="text-xs opacity-60 mt-2">
                  Generated: {new Date().toLocaleString('en-IN')} · Total records: {totalRecs}
                </p>
              </div>
            </div>
          </div>

          {TABS.filter(tab => !tab.isProfile && (data[tab.id]?.length || 0) > 0).map(tab => {
            const records = data[tab.id] || []
            const previewFields = tab.fields
              .filter(f => !['file','boolean','proof_upload','profile_picture_upload','sdg_multi','textarea'].includes(f.type))
              .slice(0, 5)

            return (
              <div key={tab.id} className="card print:shadow-none print:border print:border-gray-200">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <span>{tab.icon}</span>
                  {tab.number}. {tab.name}
                  <span className="ml-auto text-xs bg-pdeu-light dark:bg-gray-700 text-pdeu-blue dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                    {records.length} entries
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        {previewFields.map(f => (
                          <th key={f.key} className="text-left px-2 py-1.5 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                        <th className="text-left px-2 py-1.5 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((rec, i) => (
                        <tr key={rec.id} className={`border-b border-gray-50 dark:border-gray-700 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                          {previewFields.map(f => (
                            <td key={f.key} className="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={String(rec[f.key] ?? '')}>
                              {rec[f.key] != null && rec[f.key] !== '' ? String(rec[f.key]) : <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            {rec.drive_link
                              ? <button type="button" onClick={() => openProofInBrowser(rec.drive_link)} className="text-green-600 dark:text-green-400 hover:underline">✅ View</button>
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {totalRecs === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">📭</p>
              <p>No data entered yet. Fill in your tabs from the dashboard.</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
