import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { TABS } from '../../config/tabs'
import { getFacultyRecords } from '../../lib/github'
import ResearchMetrics from './ResearchMetrics'
import CoauthorNetwork from './CoauthorNetwork'
import toast from 'react-hot-toast'

const BASE = import.meta.env.BASE_URL

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatBadge({ label, value }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">
      <span className="text-gray-400">{label}:</span> {value}
    </span>
  )
}

export default function FacultyProfile() {
  const { session }  = useAuth()
  const [data,    setData]    = useState({})
  const [loading, setLoading] = useState(true)
  const printRef = useRef()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const results = {}
        await Promise.all(TABS.map(async tab => {
          results[tab.id] = await getFacultyRecords(tab.id, session.userId)
        }))
        setData(results)
      } catch (e) { toast.error('Failed to load: ' + e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function printProfile() { window.print() }

  const profile  = data['tab1']?.[0] || {}
  const pubs     = data['tab5'] || []
  const totalRecs = Object.values(data).flat().length

  const filledTabs = TABS.filter(tab => !tab.isProfile && (data[tab.id]?.length || 0) > 0)

  if (loading) return (
    <div className="p-8 text-center text-gray-400 dark:text-gray-500">
      <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
      Loading your complete data…
    </div>
  )

  return (
    <>
      {/* ── Print stylesheet ──────────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* Hide everything except the print area */
          body > * { display: none !important; }
          #print-root { display: block !important; }

          /* Header */
          .print-header { background: #003087 !important; color: white !important; padding: 14pt !important; border-radius: 0 !important; margin-bottom: 10pt; }
          .print-header * { color: white !important; }

          /* Section cards */
          .print-card { page-break-inside: avoid; border: 1px solid #e5e7eb !important; border-radius: 6pt !important; padding: 8pt !important; margin-bottom: 8pt !important; background: white !important; box-shadow: none !important; }
          .print-card h3 { font-size: 10pt !important; font-weight: 600; color: #003087 !important; border-bottom: 1px solid #e5e7eb; padding-bottom: 3pt; margin-bottom: 5pt; }

          /* Tables */
          .print-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
          .print-table th { background: #f3f4f6 !important; text-align: left; padding: 3pt 5pt; font-weight: 600; border-bottom: 1px solid #d1d5db; }
          .print-table td { padding: 3pt 5pt; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
          .print-table tr:last-child td { border-bottom: none; }

          /* Metrics grid */
          .print-metric { display: inline-block; border: 1px solid #e5e7eb; border-radius: 4pt; padding: 4pt 8pt; margin: 2pt; text-align: center; }
          .print-metric .val { font-size: 16pt; font-weight: 700; color: #003087; }
          .print-metric .lbl { font-size: 7pt; color: #6b7280; }

          /* No-print elements */
          .no-print { display: none !important; }

          /* Page break hints */
          .page-break { page-break-before: always; }

          /* Footer */
          .print-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 7pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding: 4pt; }
        }

        @media screen {
          #print-root { display: none; }
        }
      `}</style>

      {/* ── Screen view ──────────────────────────────────────── */}
      <div className="p-6 max-w-5xl mx-auto no-print">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white">My Research Profile</h1>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">
              {filledTabs.length} of {TABS.length - 1} sections filled · {totalRecs} total records
            </p>
          </div>
          <button onClick={printProfile}
            className="btn-primary flex items-center gap-2">
            🖨️ Export Full PDF
          </button>
        </div>

        {/* Research Metrics */}
        <ResearchMetrics session={session} localPubs={pubs} />

        {/* Co-author Network */}
        <CoauthorNetwork publications={pubs} facultyName={session.fullName} />

        {/* Tab summaries */}
        {filledTabs.map(tab => {
          const records = data[tab.id] || []
          const previewFields = tab.fields
            .filter(f => !['file','boolean','proof_upload','sdg_multi','textarea'].includes(f.type))
            .slice(0, 5)
          return (
            <div key={tab.id} className="card mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  {tab.icon} {tab.number}. {tab.name}
                </h3>
                <span className="text-xs bg-pdeu-light dark:bg-gray-700 text-pdeu-blue dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                  {records.length} {records.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      {previewFields.map(f => (
                        <th key={f.key} className="text-left px-2 py-1.5 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec, i) => (
                      <tr key={rec.id} className={`border-b border-gray-50 dark:border-gray-700 ${i%2===1?'bg-gray-50/50 dark:bg-gray-800/50':''}`}>
                        {previewFields.map(f => (
                          <td key={f.key} className="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate"
                            title={String(rec[f.key] ?? '')}>
                            {rec[f.key] ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          {rec.drive_link
                            ? <span className="text-green-600 dark:text-green-400">✅</span>
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
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
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-3">📭</p>
            <p>No data yet. Fill in your tabs from the dashboard.</p>
          </div>
        )}
      </div>

      {/* ── Print view (hidden on screen, shown on print) ──────── */}
      <div id="print-root">
        {/* Cover header */}
        <div className="print-header" style={{ background: '#003087', color: 'white', padding: '14pt', marginBottom: '10pt' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12pt' }}>
            <img src={`${BASE}dic-mechanical-icon-primary-refined.svg`} alt="DIC"
              style={{ height: '36pt', filter: 'brightness(0) invert(1)' }} />
            <div>
              <div style={{ fontSize: '16pt', fontWeight: 700 }}>{session.fullName}</div>
              <div style={{ fontSize: '9pt', opacity: 0.8 }}>
                {profile.present_designation || 'Faculty'} · Department of Mechanical Engineering · PDEU
              </div>
              {profile.area_of_specialization && (
                <div style={{ fontSize: '8pt', opacity: 0.65, marginTop: '2pt' }}>
                  Specialisation: {profile.area_of_specialization}
                </div>
              )}
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: '8pt', opacity: 0.65 }}>
              <div>Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <div>DIC Mechanical Data Portal · PDEU</div>
              {profile.orcid && <div>ORCID: {profile.orcid}</div>}
              {profile.scopus_id && <div>SCOPUS: {profile.scopus_id}</div>}
            </div>
          </div>
        </div>

        {/* Summary stats row */}
        <div className="print-card">
          <h3>Summary</h3>
          <div>
            {[
              { lbl: 'Total Records', val: totalRecs },
              { lbl: 'Sections Filled', val: `${filledTabs.length} / ${TABS.length - 1}` },
              { lbl: 'Publications', val: pubs.length },
              { lbl: 'Published Papers', val: pubs.filter(p => p.status === 'Published').length },
              { lbl: 'Journal Papers', val: pubs.filter(p => p.pub_type === 'Journal Paper').length },
              { lbl: 'Conference Papers', val: pubs.filter(p => p.pub_type === 'Conference Paper').length },
            ].map(s => (
              <span key={s.lbl} className="print-metric">
                <div className="val">{s.val}</div>
                <div className="lbl">{s.lbl}</div>
              </span>
            ))}
          </div>
        </div>

        {/* Each tab */}
        {filledTabs.map((tab, tabIdx) => {
          const records = data[tab.id] || []
          const allFields = tab.fields.filter(f =>
            !['file','proof_upload','sdg_multi'].includes(f.type)
          )
          // For print: show all fields but group them smartly
          const mainFields = allFields.slice(0, 8)

          return (
            <div key={tab.id} className={`print-card ${tabIdx > 0 && tabIdx % 3 === 0 ? 'page-break' : ''}`}>
              <h3>{tab.icon} {tab.number}. {tab.name} ({records.length} {records.length === 1 ? 'entry' : 'entries'})</h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: '20pt' }}>#</th>
                    {mainFields.slice(0, 6).map(f => <th key={f.key}>{f.label}</th>)}
                    <th>Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={rec.id}>
                      <td>{i + 1}</td>
                      {mainFields.slice(0, 6).map(f => (
                        <td key={f.key} style={{ maxWidth: '120pt', wordBreak: 'break-word' }}>
                          {rec[f.key] ?? '—'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        {rec.drive_link ? '✓' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}

        {/* Footer */}
        <div className="print-footer">
          Powered by DIC Mechanical · © DIC Mechanical, PDEU · Coded by Anirudh Kulkarni, PhD.
        </div>
      </div>
    </>
  )
}
