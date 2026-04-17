import { useEffect, useState } from 'react'
import { getAllRecordsForTab, getAllFaculties } from '../../lib/github'

/**
 * Shows publications where the current faculty is tagged as a dept co-author
 * (via the dept_coauthors field in someone else's tab5 entry).
 * Prevents duplicate data entry — if you're tagged, no need to re-enter.
 */
export default function SharedPublications({ session }) {
  const [sharedPubs, setSharedPubs] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Get ALL tab5 records across all faculty
      const [allPubs, allFaculty] = await Promise.all([
        getAllRecordsForTab('tab5'),
        getAllFaculties(),
      ])

      // Find pubs where this faculty is tagged in dept_coauthors
      const myName = session.fullName
      const tagged = allPubs.filter(pub => {
        if (!pub.dept_coauthors) return false
        const names = pub.dept_coauthors.split(';').map(s => s.trim())
        return names.some(n => n.toLowerCase() === myName.toLowerCase())
      })

      setSharedPubs(tagged)
    } catch { setSharedPubs([]) }
    setLoading(false)
  }

  if (loading) return (
    <div className="card mb-4">
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
        <div className="w-4 h-4 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin"/>
        Checking for shared publications…
      </div>
    </div>
  )

  if (sharedPubs.length === 0) return null

  return (
    <div className="card mb-6 border-l-4 border-pdeu-blue">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          🔗 Publications Shared by Colleagues
          <span className="text-xs bg-pdeu-light dark:bg-blue-900/30 text-pdeu-blue dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
            {sharedPubs.length} entries
          </span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          You are tagged as co-author — no need to re-enter these
        </p>
      </div>

      <div className="space-y-2">
        {sharedPubs.map((pub, i) => (
          <div key={pub.id || i}
            className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="text-base flex-shrink-0 mt-0.5">
                {pub.pub_type === 'Journal Paper' ? '📰' :
                 pub.pub_type === 'Conference Paper' ? '🎤' : '📄'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug">
                  {pub.title}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {pub.facultyName && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Entered by: <strong>{pub.facultyName}</strong>
                    </span>
                  )}
                  {pub.journal_or_conf_name && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {pub.journal_or_conf_name}
                    </span>
                  )}
                  {pub.academic_year && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {pub.academic_year}
                    </span>
                  )}
                  {pub.status && (
                    <span className={`text-xs font-medium ${
                      pub.status === 'Published' ? 'text-green-600 dark:text-green-400' :
                      pub.status === 'Accepted'  ? 'text-blue-600 dark:text-blue-400' :
                      'text-amber-600 dark:text-amber-400'
                    }`}>
                      {pub.status}
                    </span>
                  )}
                  {pub.doi && (
                    <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-pdeu-blue dark:text-blue-400 hover:underline font-mono">
                      DOI ↗
                    </a>
                  )}
                </div>
              </div>
              {pub.drive_link && (
                <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">✅ PDF</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        These appear in admin exports under your name automatically. Contact the entry owner to correct any errors.
      </p>
    </div>
  )
}
