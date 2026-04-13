// ── Email Notifications via EmailJS ──────────────────────────
// Free plan: 200 emails/month — plenty for an internal tool
// Docs: https://www.emailjs.com/docs/
//
// Set VITE_EMAILJS_* vars in .env and GitHub secrets to enable.
// Leave them empty/unset to silently skip notifications.

import emailjs from '@emailjs/browser'
import { ADMIN_TAB_MAP } from '../config/tabs'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

// Map admin fullName → email from env vars
// Env var names can't have spaces so we strip them: "Vivek Jaiswal" → VivekJaiswal
const ADMIN_EMAILS = {
  'Salman':       import.meta.env.VITE_ADMIN_EMAIL_Salman,
  'Krunal':       import.meta.env.VITE_ADMIN_EMAIL_Krunal,
  'Vivek Jaiswal':import.meta.env.VITE_ADMIN_EMAIL_VivekJaiswal,
  'Anirudh':      import.meta.env.VITE_ADMIN_EMAIL_Anirudh,
  'Abhinaya':     import.meta.env.VITE_ADMIN_EMAIL_Abhinaya,
}

let _initialised = false
function init() {
  if (_initialised || !PUBLIC_KEY) return
  emailjs.init({ publicKey: PUBLIC_KEY })
  _initialised = true
}

/**
 * Send a notification email to the admin who owns this tab.
 * Called silently after a faculty saves a record — never blocks the UI.
 *
 * @param {object} params
 * @param {string} params.tabId        e.g. 'tab5'
 * @param {string} params.tabName      e.g. 'Publications & Conferences'
 * @param {string} params.facultyName  e.g. 'Dr. Anirudh Kulkarni'
 * @param {string} params.action       'added' | 'updated' | 'deleted'
 */
export async function notifyAdmin({ tabId, tabName, facultyName, action = 'added' }) {
  // Silently skip if EmailJS is not configured
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return

  const adminName  = ADMIN_TAB_MAP[tabId]
  const adminEmail = ADMIN_EMAILS[adminName]
  if (!adminEmail) return   // no email configured for this admin

  try {
    init()
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_name:      adminName,
      to_email:     adminEmail,
      faculty_name: facultyName,
      tab_name:     tabName,
      action,
      portal_url:   window.location.origin + window.location.pathname,
      timestamp:    new Date().toLocaleString('en-IN'),
    })
  } catch (err) {
    // Never surface email errors to the user — data was saved successfully
    console.warn('[notify] Email failed silently:', err?.text || err)
  }
}
