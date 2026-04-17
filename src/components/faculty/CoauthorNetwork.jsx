import { useEffect, useRef, useState } from 'react'

/**
 * Co-author network — chord diagram built with pure SVG + JS.
 * Input: publications from tab5, each with a `coauthors` field (semicolon-separated).
 * Shows collaboration strength between faculty and their co-authors.
 */
export default function CoauthorNetwork({ publications = [], facultyName }) {
  const svgRef  = useRef()
  const [filter, setFilter] = useState('All')
  const [years,  setYears]  = useState([])

  // Parse co-author data from publications
  const allYears = [...new Set(
    publications.map(p => p.academic_year).filter(Boolean)
  )].sort().reverse()

  const filtered = filter === 'All'
    ? publications
    : publications.filter(p => p.academic_year === filter)

  useEffect(() => {
    setYears(allYears)
  }, [publications])

  useEffect(() => {
    drawChord()
  }, [filtered, facultyName])

  function drawChord() {
    const svg = svgRef.current
    if (!svg) return

    // Parse co-authors from filtered publications
    const coauthorMap = {}
    for (const pub of filtered) {
      if (!pub.coauthors) continue
      const authors = pub.coauthors.split(';')
        .map(a => a.trim())
        .filter(a => a && a.toLowerCase() !== facultyName?.toLowerCase())

      for (const author of authors) {
        const key = author.length > 25 ? author.slice(0, 22) + '…' : author
        coauthorMap[key] = (coauthorMap[key] || 0) + 1
      }
    }

    const entries = Object.entries(coauthorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)  // max 30 co-authors

    if (entries.length === 0) {
      svg.innerHTML = `
        <text x="280" y="200" text-anchor="middle" font-size="14"
          fill="var(--color-text-secondary)" font-family="sans-serif">
          No co-author data found in publications.
        </text>
        <text x="280" y="225" text-anchor="middle" font-size="12"
          fill="var(--color-text-secondary)" font-family="sans-serif">
          Fill the "Co-authors" field in Tab 5 to see the network.
        </text>`
      return
    }

    const W = 560, H = 420
    const cx = W / 2, cy = H / 2
    const R  = Math.min(cx, cy) - 80  // outer radius
    const r  = R - 22                  // inner radius (chord ends)

    // Color palette
    const colors = [
      '#1F4AA8','#2563eb','#7c3aed','#db2777','#ea580c',
      '#16a34a','#0891b2','#ca8a04','#dc2626','#4f46e5',
      '#0d9488','#c026d3','#65a30d','#b45309','#1d4ed8',
    ]

    const n = entries.length + 1  // +1 for the faculty node
    const facultyShort = (facultyName || 'Faculty').split(' ').pop()
    const nodes = [{ name: facultyShort, count: filtered.length }, ...entries.map(([name, count]) => ({ name, count }))]
    const maxCount = Math.max(...entries.map(e => e[1]))

    // Arc angles
    const gap = 0.018
    const total = 2 * Math.PI - n * gap
    const weights = nodes.map((node, i) => i === 0 ? filtered.length : node.count)
    const wSum = weights.reduce((a, b) => a + b, 0)
    const spans = weights.map(w => (w / wSum) * total)

    let angle = -Math.PI / 2
    const arcs = nodes.map((node, i) => {
      const start = angle
      const end   = angle + spans[i]
      angle = end + gap
      const mid = (start + end) / 2
      return { node, start, end, mid, color: i === 0 ? '#003087' : colors[i % colors.length] }
    })

    // Build SVG
    let html = `<defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.15"/>
      </filter>
    </defs>`

    // Draw chords (connections from faculty arc to each co-author arc)
    const fArc = arcs[0]
    for (let i = 1; i < arcs.length; i++) {
      const cArc  = arcs[i]
      const alpha = cArc.node.count / maxCount
      const opacity = 0.15 + alpha * 0.5

      // Midpoint of each arc's inner edge
      const fx1 = cx + r * Math.cos(fArc.start + (fArc.end - fArc.start) * (i / (arcs.length - 1)))
      const fy1 = cy + r * Math.sin(fArc.start + (fArc.end - fArc.start) * (i / (arcs.length - 1)))
      const cx1 = cx + r * Math.cos(cArc.mid)
      const cy1 = cy + r * Math.sin(cArc.mid)

      html += `<path
        d="M${fx1.toFixed(1)},${fy1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${cx1.toFixed(1)},${cy1.toFixed(1)}"
        fill="none" stroke="${cArc.color}" stroke-width="${1 + alpha * 3}" opacity="${opacity.toFixed(2)}"
        stroke-linecap="round"/>`
    }

    // Draw arcs
    for (const arc of arcs) {
      const x1 = cx + R * Math.cos(arc.start)
      const y1 = cy + R * Math.sin(arc.start)
      const x2 = cx + R * Math.cos(arc.end)
      const y2 = cy + R * Math.sin(arc.end)
      const large = arc.end - arc.start > Math.PI ? 1 : 0

      html += `<path
        d="M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)}"
        fill="none" stroke="${arc.color}" stroke-width="${arc === arcs[0] ? 14 : 10}"
        stroke-linecap="round" opacity="0.9"/>`

      // Labels
      const labelR = R + 18
      const lx = cx + labelR * Math.cos(arc.mid)
      const ly = cy + labelR * Math.sin(arc.mid)
      const anchor = arc.mid > Math.PI / 2 && arc.mid < 3 * Math.PI / 2 ? 'end' : 'start'
      const rotate = arc.mid * 180 / Math.PI + (anchor === 'end' ? 180 : 0)
      const countLabel = arc === arcs[0] ? `${filtered.length} pubs` : `×${arc.node.count}`

      html += `<text
        x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"
        text-anchor="${anchor}"
        transform="rotate(${rotate.toFixed(1)},${lx.toFixed(1)},${ly.toFixed(1)})"
        font-size="11" font-family="sans-serif"
        fill="${arc.color}" font-weight="500">${arc.node.name}</text>
      <text
        x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}"
        text-anchor="${anchor}"
        transform="rotate(${rotate.toFixed(1)},${lx.toFixed(1)},${(ly + 12).toFixed(1)})"
        font-size="9" font-family="sans-serif"
        fill="var(--color-text-secondary)">${countLabel}</text>`
    }

    // Centre label
    html += `<text x="${cx}" y="${cy - 8}" text-anchor="middle"
      font-size="13" font-weight="600" font-family="sans-serif"
      fill="var(--color-text-primary)">${facultyShort}</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle"
      font-size="11" font-family="sans-serif"
      fill="var(--color-text-secondary)">${entries.length} co-authors</text>`

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.innerHTML = html
  }

  return (
    <div className="card mb-6 print:shadow-none print:border print:border-gray-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          🕸️ Co-author Network
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Filter year:</span>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="form-input text-xs py-1 max-w-[120px]"
          >
            <option value="All">All Years</option>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {publications.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <p className="text-3xl mb-2">📄</p>
          <p className="text-sm">Add publications in Tab 5 to see your co-author network.</p>
        </div>
      ) : (
        <svg ref={svgRef} width="100%" style={{ minHeight: 360 }}
          className="overflow-visible" />
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        Built from the co-authors field in Tab 5 (Publications). Arc thickness = number of collaborations.
      </p>
    </div>
  )
}
