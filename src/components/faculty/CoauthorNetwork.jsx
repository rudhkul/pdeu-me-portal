import { useEffect, useRef } from 'react'

/**
 * Co-author Network — chord diagram from Tab 5 publications.
 * Reads the `coauthors` field (semicolon-separated names).
 */
export default function CoauthorNetwork({ publications = [], facultyName = '' }) {
  const svgRef = useRef()

  // Parse all co-authors from ALL publications
  function parseCoauthors() {
    const map = {}
    for (const pub of publications) {
      if (!pub.coauthors) continue
      // Split by semicolon, clean up whitespace and stray punctuation
      const names = pub.coauthors
        .split(/[;,]+/)
        .map(n => n.trim().replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s*/i, '').trim())
        .filter(n => {
          if (!n || n.length < 2) return false
          // Remove if it's the faculty themselves (rough match on last name)
          const lastName = facultyName.split(' ').pop().toLowerCase()
          return !n.toLowerCase().includes(lastName)
        })

      for (const name of names) {
        // Truncate long names for display
        const key = name.length > 22 ? name.slice(0, 20) + '…' : name
        map[key] = (map[key] || 0) + 1
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  useEffect(() => { draw() }, [publications, facultyName])

  function draw() {
    const svg = svgRef.current
    if (!svg) return

    const entries = parseCoauthors().slice(0, 28)

    if (entries.length === 0) {
      svg.innerHTML = `
        <text x="280" y="180" text-anchor="middle" font-size="14"
          font-family="system-ui,sans-serif" fill="#9ca3af">
          No co-author data found.
        </text>
        <text x="280" y="205" text-anchor="middle" font-size="12"
          font-family="system-ui,sans-serif" fill="#9ca3af">
          Fill the "Co-authors" field in Tab 5 (separate names with ";")
        </text>`
      svg.setAttribute('viewBox', '0 0 560 280')
      return
    }

    const W = 560, H = 400
    const cx = W / 2, cy = H / 2 - 10
    const R  = Math.min(cx - 10, cy - 10) - 70   // outer ring radius
    const r  = R - 18                              // inner radius for chord endpoints
    const maxCount = Math.max(...entries.map(e => e[1]))

    const COLORS = [
      '#1F4AA8','#2563eb','#7c3aed','#db2777','#ea580c',
      '#16a34a','#0891b2','#ca8a04','#dc2626','#4f46e5',
      '#0d9488','#c026d3','#65a30d','#b45309','#1d4ed8',
      '#7e22ce','#be185d','#b45309','#15803d','#0369a1',
    ]

    // All nodes: [faculty, ...coauthors]
    const facultyShort = facultyName.split(' ').slice(-1)[0] || 'Faculty'
    const nodes = [
      { name: facultyShort, count: publications.length, isFaculty: true },
      ...entries.map(([name, count]) => ({ name, count, isFaculty: false })),
    ]

    // Compute arc spans proportional to collaboration count
    const GAP      = 0.015
    const total    = 2 * Math.PI - nodes.length * GAP
    const wSum     = nodes.reduce((s, n) => s + n.count, 0)
    const spans    = nodes.map(n => (n.count / wSum) * total)

    let angle = -Math.PI / 2
    const arcs = nodes.map((node, i) => {
      const start = angle
      const end   = angle + spans[i]
      angle = end + GAP
      return {
        node, start, end,
        mid:   (start + end) / 2,
        color: node.isFaculty ? '#003087' : COLORS[i % COLORS.length],
      }
    })

    const fArc = arcs[0]
    let html = ''

    // ── Chords from faculty arc to each co-author ──────────────
    for (let i = 1; i < arcs.length; i++) {
      const ca    = arcs[i]
      const alpha = ca.node.count / maxCount
      const opacity = (0.12 + alpha * 0.45).toFixed(2)
      const width   = (0.8 + alpha * 3.5).toFixed(1)

      // Point on faculty arc (distribute evenly across faculty arc)
      const fAngle = fArc.start + (fArc.end - fArc.start) * (i / arcs.length)
      const fx = cx + r * Math.cos(fAngle)
      const fy = cy + r * Math.sin(fAngle)
      // Midpoint of co-author arc
      const cx1 = cx + r * Math.cos(ca.mid)
      const cy1 = cy + r * Math.sin(ca.mid)

      html += `<path d="M${fx.toFixed(1)},${fy.toFixed(1)} Q${cx},${cy} ${cx1.toFixed(1)},${cy1.toFixed(1)}"
        fill="none" stroke="${ca.color}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round"/>`
    }

    // ── Arc segments ───────────────────────────────────────────
    for (const arc of arcs) {
      const x1 = cx + R * Math.cos(arc.start)
      const y1 = cy + R * Math.sin(arc.start)
      const x2 = cx + R * Math.cos(arc.end)
      const y2 = cy + R * Math.sin(arc.end)
      const largeArc = arc.end - arc.start > Math.PI ? 1 : 0
      const strokeW  = arc.node.isFaculty ? 16 : 10

      html += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)}"
        fill="none" stroke="${arc.color}" stroke-width="${strokeW}" stroke-linecap="round" opacity="0.92"/>`

      // ── Labels ─────────────────────────────────────────────
      const LR       = R + 14
      const lx       = cx + LR * Math.cos(arc.mid)
      const ly       = cy + LR * Math.sin(arc.mid)
      // Determine text-anchor based on which side of the circle
      const rightSide = Math.cos(arc.mid) > 0
      const anchor    = rightSide ? 'start' : 'end'
      // Rotate label to follow the arc tangent
      const deg = arc.mid * 180 / Math.PI + (rightSide ? 0 : 180)

      html += `
        <g transform="rotate(${deg.toFixed(1)},${lx.toFixed(1)},${ly.toFixed(1)})">
          <text x="${lx.toFixed(1)}" y="${(ly - 3).toFixed(1)}"
            text-anchor="${anchor}" font-size="10.5" font-weight="600"
            font-family="system-ui,sans-serif" fill="${arc.color}">
            ${arc.node.name}
          </text>
          <text x="${lx.toFixed(1)}" y="${(ly + 9).toFixed(1)}"
            text-anchor="${anchor}" font-size="9"
            font-family="system-ui,sans-serif" fill="#9ca3af">
            ${arc.node.isFaculty ? `${publications.length} pubs` : `×${arc.node.count}`}
          </text>
        </g>`
    }

    // ── Centre label ──────────────────────────────────────────
    html += `
      <text x="${cx}" y="${cy - 6}" text-anchor="middle"
        font-size="13" font-weight="700" font-family="system-ui,sans-serif"
        fill="#003087">${facultyShort}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle"
        font-size="11" font-family="system-ui,sans-serif" fill="#6b7280">
        ${entries.length} co-authors
      </text>
      <text x="${cx}" y="${cy + 24}" text-anchor="middle"
        font-size="10" font-family="system-ui,sans-serif" fill="#9ca3af">
        ${publications.length} publications
      </text>`

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.innerHTML = html
  }

  const coauthorCount = parseCoauthors().length

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          🕸️ Co-author Network
        </h2>
        {coauthorCount > 0 && (
          <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 px-3 py-1 rounded-full">
            {coauthorCount} unique co-authors across {publications.length} publications
          </span>
        )}
      </div>

      {publications.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <p className="text-3xl mb-2">📄</p>
          <p className="text-sm">Add publications in Tab 5 to see your co-author network.</p>
        </div>
      ) : (
        <>
          <svg ref={svgRef} width="100%" className="overflow-visible" style={{ minHeight: 320 }} />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Arc thickness = number of joint publications. Separate co-authors with ";" in Tab 5.
          </p>
        </>
      )}
    </div>
  )
}
