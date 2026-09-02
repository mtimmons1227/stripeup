// netlify/functions/send-cancellation.js
// Notifies officials that a tournament has been cancelled.
//
// Replaces a client-side block in index.html that could never have worked:
//   * it was never called from anywhere,
//   * it authenticated with `window.RESEND_KEY`, hardcoded to '' at index.html:1193,
//     so every request would have been a 401,
//   * it sent from 'onboarding@resend.dev' — Resend's sandbox sender, which only
//     delivers to the account owner,
//   * and it drew recipients from `availability`, a table nothing populates.
//
// Recipients now come from `claims` (officials who actually confirmed a block) plus
// `invite_tokens` (officials who were invited but hadn't answered yet) — both of which
// are real. The lookup happens here with the service key, so the browser is never
// trusted with a recipient list or an API key.

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const RESEND_API_KEY       = process.env.RESEND_API_KEY
const FROM_EMAIL           = process.env.FROM_EMAIL || 'invites@thetimmonsfoundation.org'

function isTestEmail(email) {
  if (!email) return true
  const e = email.toLowerCase().trim()
  return e.startsWith('test@') || /^test\d*@/.test(e) || /test@\w+\.\w+\d+$/.test(e)
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const { tournament_id, reason } = body
  if (!tournament_id) return new Response('Missing tournament_id', { status: 400 })
  if (!RESEND_API_KEY) return new Response('RESEND_API_KEY not set', { status: 500 })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response('Supabase env vars not set', { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const resend   = new Resend(RESEND_API_KEY)

  // --- tournament -----------------------------------------------------------
  const { data: tRows, error: tErr } = await supabase
    .from('tournaments')
    .select('id,name,date,location')
    .eq('id', tournament_id)
    .limit(1)

  if (tErr)          return new Response(JSON.stringify({ error: tErr.message }), { status: 500 })
  if (!tRows?.length) return new Response('Tournament not found', { status: 404 })
  const tourn = tRows[0]

  // --- recipients: anyone who confirmed, plus anyone still holding an invite --
  const [claimsRes, tokensRes] = await Promise.all([
    supabase.from('claims')
      .select('official_id,official_name,official_email')
      .eq('tournament_id', tournament_id)
      .eq('status', 'confirmed'),
    supabase.from('invite_tokens')
      .select('official_id,status,used')
      .eq('tournament_id', tournament_id)
  ])

  if (claimsRes.error) {
    return new Response(JSON.stringify({ error: claimsRes.error.message }), { status: 500 })
  }

  const byEmail = new Map()

  for (const c of claimsRes.data || []) {
    if (c.official_email && !byEmail.has(c.official_email.toLowerCase())) {
      byEmail.set(c.official_email.toLowerCase(), {
        name: c.official_name || 'Official',
        email: c.official_email,
        state: 'confirmed'
      })
    }
  }

  // Invited-but-unanswered officials still need telling — they may be holding the date.
  const pendingIds = (tokensRes.data || [])
    .filter(t => !t.used && t.status !== 'declined' && t.official_id)
    .map(t => t.official_id)

  if (pendingIds.length) {
    const { data: offs } = await supabase
      .from('officials')
      .select('id,name,email')
      .in('id', pendingIds)
    for (const o of offs || []) {
      if (o.email && !byEmail.has(o.email.toLowerCase())) {
        byEmail.set(o.email.toLowerCase(), {
          name: o.name || 'Official',
          email: o.email,
          state: 'invited'
        })
      }
    }
  }

  const recipients = [...byEmail.values()]
  const sendable   = recipients.filter(r => !isTestEmail(r.email))
  const skipped    = recipients.length - sendable.length

  if (!sendable.length) {
    console.log('[send-cancellation] nobody to notify for', tournament_id,
                '| recipients:', recipients.length, '| skipped as test:', skipped)
    return new Response(JSON.stringify({ sent: 0, skipped, recipients: recipients.length }), { status: 200 })
  }

  const when = tourn.date
    ? new Date(tourn.date + 'T12:00:00').toLocaleDateString('en-US',
        { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const results = []
  let sent = 0
  const errors = []

  for (const r of sendable) {
    const firstName = (r.name || 'Official').split(' ')[0]
    const html = `<!doctype html>
<html><body style="margin:0;background:#F4F6F9">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#1B2A4A;padding:22px;text-align:center">
      <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-.5px">STRIPE<span style="color:#C9A84C">UP</span></div>
    </div>
    <div style="padding:26px 28px">
      <p style="margin:0 0 14px">Hi ${esc(firstName)},</p>
      <p style="margin:0 0 16px">This tournament has been <strong>cancelled</strong>:</p>
      <div style="background:#FDECEA;border-left:4px solid #C0392B;padding:14px 16px;margin:0 0 18px;border-radius:4px">
        <div style="font-size:18px;font-weight:700;color:#C0392B">${esc(tourn.name)}</div>
        ${when ? `<div style="font-size:13px;color:#7A4340;margin-top:3px">${esc(when)}</div>` : ''}
        ${tourn.location ? `<div style="font-size:13px;color:#7A4340">${esc(tourn.location)}</div>` : ''}
      </div>
      ${reason ? `<p style="margin:0 0 16px"><strong>Reason:</strong> ${esc(reason)}</p>` : ''}
      ${r.state === 'confirmed'
        ? '<p style="margin:0 0 16px">Your confirmed blocks for this event are released. There is nothing you need to do.</p>'
        : '<p style="margin:0 0 16px">Your invitation for this event is withdrawn. There is nothing you need to do.</p>'}
      <p style="margin:0 0 16px">Sorry for the short notice, and thank you for being willing to work it.</p>
      <p style="margin:0;color:#6B7A99;font-size:14px">You will keep receiving invitations for future tournaments.</p>
    </div>
    <div style="background:#F4F6F9;padding:16px 28px;text-align:center;font-size:11px;color:#9CA3AF">
      StripeUp &nbsp;·&nbsp; This is an automated notice
    </div>
  </div>
</body></html>`

    try {
      const out = await resend.emails.send({
        from: `StripeUp <${FROM_EMAIL}>`,
        to: r.email,
        subject: `Cancelled: ${tourn.name}`,
        html
      })
      if (out.error) {
        errors.push({ email: r.email, error: out.error.message || String(out.error) })
        console.error('[send-cancellation] Resend error for', r.email, out.error)
      } else {
        sent++
        results.push({ email: r.email, id: out.data?.id, state: r.state })
      }
    } catch (e) {
      errors.push({ email: r.email, error: e.message })
      console.error('[send-cancellation] Exception for', r.email, e.message)
    }
  }

  console.log('[send-cancellation]', tourn.name, '| sent:', sent, '| skipped(test):', skipped, '| errors:', errors.length)

  return new Response(JSON.stringify({ sent, skipped, errors, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
