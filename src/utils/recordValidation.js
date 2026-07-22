const RANGE_RULES = {
  tab4: [['start_date', 'end_date', 'End Date cannot be earlier than Start Date.']],
  tab6: [['start_date', 'end_date', 'End Date cannot be earlier than Start Date.']],
  tab9: [['start_date', 'end_date', 'End Date cannot be earlier than Start Date.']],
  tab13: [['start_date', 'end_date', 'End Date cannot be earlier than Start Date.']],
  tab14: [['start_date', 'end_date', 'End Date cannot be earlier than Start Date.']],
  tab15: [['start_date', 'end_date', 'End Date cannot be earlier than Start Date.']],
}

function comparable(value) {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

export function validateRecord(tab, values, options = {}) {
  const issues = []

  for (const [startKey, endKey, message] of RANGE_RULES[tab.id] || []) {
    const start = comparable(values[startKey])
    const end = comparable(values[endKey])
    if (start !== null && end !== null && end < start) {
      issues.push({ field: endKey, message })
    }
  }

  if (tab.id === 'tab1') {
    const ordered = [
      ['date_of_joining', 'Date of Joining'],
      ['date_promotion_asst_prof', 'Assistant Professor promotion date'],
      ['date_promotion_assoc_prof', 'Associate Professor promotion date'],
      ['date_promotion_prof', 'Professor promotion date'],
    ].filter(([key]) => values[key])

    for (let index = 1; index < ordered.length; index++) {
      const previous = comparable(values[ordered[index - 1][0]])
      const current = comparable(values[ordered[index][0]])
      if (previous !== null && current !== null && current < previous) {
        issues.push({
          field: ordered[index][0],
          message: `${ordered[index][1]} cannot be earlier than ${ordered[index - 1][1]}.`,
        })
      }
    }
  }

  if (tab.id === 'tab8' && values.start_datetime && values.end_time) {
    const start = new Date(values.start_datetime)
    const [hours, minutes] = String(values.end_time).split(':').map(Number)
    if (!Number.isNaN(start.getTime()) && Number.isFinite(hours) && Number.isFinite(minutes)) {
      const end = new Date(start)
      end.setHours(hours, minutes, 0, 0)
      if (end < start) {
        issues.push({
          field: 'end_time',
          message: 'End Time cannot be earlier than Start Time.',
        })
      }
    }
  }


  const integerFields = new Set([
    'citations_count', 'h_index', 'i10_index', 'journal_papers',
    'conference_papers', 'patents_published', 'working_models',
    'btech_graduated', 'phd_graduated', 'me_graduated',
    'btech_attendees', 'mtech_attendees', 'outside_professionals',
    'students_participated', 'attendees_count',
  ])

  for (const field of tab.fields.filter(item => item.type === 'number')) {
    const raw = values[field.key]
    if (raw === '' || raw === null || raw === undefined) continue
    const value = Number(raw)
    if (!Number.isFinite(value)) {
      issues.push({ field: field.key, message: `${field.label} must be a valid number.` })
      continue
    }
    if (value < 0) {
      issues.push({ field: field.key, message: `${field.label} cannot be negative.` })
    }
    if (integerFields.has(field.key) && !Number.isInteger(value)) {
      issues.push({ field: field.key, message: `${field.label} must be a whole number.` })
    }
  }

  if (values.cpi !== '' && values.cpi !== null && values.cpi !== undefined) {
    const cpi = Number(values.cpi)
    if (Number.isFinite(cpi) && cpi > 10) {
      issues.push({ field: 'cpi', message: 'CPI cannot exceed 10.' })
    }
  }

  if (tab.id === 'tab1') {
    const total = Number(values.total_experience)
    const teaching = Number(values.teaching_experience)
    const pdeu = Number(values.teaching_experience_pdeu)

    if (Number.isFinite(teaching) && Number.isFinite(total) && teaching > total) {
      issues.push({
        field: 'teaching_experience',
        message: 'Teaching Experience cannot exceed Total Experience.',
      })
    }
    if (Number.isFinite(pdeu) && Number.isFinite(teaching) && pdeu > teaching) {
      issues.push({
        field: 'teaching_experience_pdeu',
        message: 'Teaching Experience at PDEU cannot exceed total Teaching Experience.',
      })
    }
  }

  if (
    tab.id === 'tab9' &&
    values.fund_received !== '' &&
    values.fund_utilized !== '' &&
    Number(values.fund_utilized) > Number(values.fund_received)
  ) {
    issues.push({
      field: 'fund_utilized',
      message: 'Fund Utilized cannot exceed Fund Received.',
    })
  }

  if (
    tab.id === 'tab20' &&
    values.amount_lacs !== '' &&
    values.amount_utilized_lacs !== '' &&
    Number(values.amount_utilized_lacs) > Number(values.amount_lacs)
  ) {
    issues.push({
      field: 'amount_utilized_lacs',
      message: 'Amount Utilized cannot exceed the sanctioned grant amount.',
    })
  }

  const yearFields = [
    'year_phd_guide_recognition',
    'higher_studies_admission_year',
    'business_start_year',
  ]

  for (const key of yearFields) {
    const value = values[key]
    if (!value) continue
    if (!/^\d{4}$/.test(String(value)) || Number(value) < 1900 || Number(value) > 2100) {
      issues.push({ field: key, message: 'Enter a valid four-digit year.' })
    }
  }

  for (const key of ['enrollment_year']) {
    const value = values[key]
    if (!value) continue
    if (!/^\d{4}-\d{2}$/.test(String(value))) {
      issues.push({ field: key, message: 'Use academic-year format YYYY-YY, for example 2025-26.' })
    }
  }

  if (options.requireProof !== false) {
    for (const field of tab.fields) {
      if (field.type === 'proof_upload' && field.required && !values[field.key]) {
        issues.push({
          field: field.key,
          message: `${field.label.replace(/^Upload\s+/i, '')} is required.`,
        })
      }
    }
  }

  return issues
}
