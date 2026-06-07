// netlify/functions/send-confirmation.js
// Sends a confirmation summary email to an official after they confirm their block selections

import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL     = process.env.FROM_EMAIL || 'invites@thetimmonsfoundation.org'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { official_name, official_email, tournament_name, tournament_date, blocks, total_games, total_pay } = body

  if (!official_email || !official_name || !blocks || !blocks.length) {
    return new Response('Missing required fields', { status: 400 })
  }

  // Skip test emails
  const email = official_email.toLowerCase().trim()
  if (email.startsWith('test@') || /^test\d*@/.test(email)) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 })
  }

  if (!RESEND_API_KEY) {
    return new Response('RESEND_API_KEY not set', { status: 500 })
  }

  const resend = new Resend(RESEND_API_KEY)
  const firstName = official_name.split(' ')[0]

  // Build block rows for email
  const blockRows = blocks.map(b =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E0E6F0;font-weight:600;color:#1B2A4A">${b.block_name} — ${b.court}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E0E6F0;color:#4B5563">${b.start_time}–${b.end_time}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E0E6F0;color:#4B5563;text-align:center">${b.game_count} games</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E0E6F0;color:#1A7A4A;font-weight:700;text-align:right">$${b.total_pay}</td>
    </tr>`
  ).join('')

  const dateDisplay = tournament_date
    ? new Date(tournament_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1B2A4A;padding:24px 28px">
      <div style="font-size:22px;font-weight:800;color:#C9A84C;letter-spacing:1px">StripeUp</div>
      <div style="font-size:13px;color:#8A9BB8;margin-top:2px">Official Scheduling Platform</div>
    </div>
    <div style="padding:28px">
      <div style="font-size:20px;font-weight:700;color:#1B2A4A;margin-bottom:4px">You're locked in, ${firstName}!</div>
      <div style="font-size:14px;color:#6B7A99;margin-bottom:20px">${tournament_name}${dateDisplay ? ' &nbsp;·&nbsp; ' + dateDisplay : ''}</div>

      <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:8px;overflow:hidden;margin-bottom:16px">
        <thead>
          <tr style="background:#EDF1F8">
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8">Block</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8">Time</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8">Games</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8">Pay</th>
          </tr>
        </thead>
        <tbody>${blockRows}</tbody>
      </table>

      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;color:#166534;font-weight:600">${total_games} total games</span>
        <span style="font-size:18px;color:#15803D;font-weight:800">$${total_pay} total</span>
      </div>

      <div style="margin-top:20px;padding:14px 16px;background:#FEF3DC;border-radius:8px;border:1px solid #FAC775">
        <div style="font-size:12px;color:#A0620A;font-weight:600;margin-bottom:4px">Important</div>
        <div style="font-size:13px;color:#92400E">Save this email as your record. Contact your assigner if you need to make changes.</div>
      </div>
    </div>
    <div style="background:#F4F6F9;padding:16px 28px;text-align:center;font-size:11px;color:#9CA3AF">
      StripeUp &nbsp;·&nbsp; Timmons Foundation &nbsp;·&nbsp; This is an automated confirmation
    </div>
  </div>
</body>
</html>`

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: official_email,
      subject: `Your assignment confirmed — ${tournament_name}`,
      html
    })
    if (result.error) {
      console.error('[send-confirmation] Resend error:', result.error)
      return new Response(JSON.stringify({ error: result.error }), { status: 500 })
    }
    console.log('[send-confirmation] Sent to', official_email, '| id:', result.data?.id)
    return new Response(JSON.stringify({ ok: true, id: result.data?.id }), { status: 200 })
  } catch (e) {
    console.error('[send-confirmation] Exception:', e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
