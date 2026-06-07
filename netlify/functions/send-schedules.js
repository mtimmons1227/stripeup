// netlify/functions/send-schedules.js
// Sends each confirmed official their full schedule + partner info for a tournament

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

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch { return new Response('Invalid JSON', { status: 400 }) }

  const { tournament_id } = body
  if (!tournament_id) return new Response('Missing tournament_id', { status: 400 })
  if (!RESEND_API_KEY)  return new Response('RESEND_API_KEY not set', { status: 500 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const resend   = new Resend(RESEND_API_KEY)

  // 1. Tournament info
  const { data: tournRows } = await supabase
    .from('tournaments')
    .select('name,date,start_date,location,tournament_city,tournament_state,pay_per_game,officials_per_game')
    .eq('id', tournament_id)
    .limit(1)
  const tourn = tournRows?.[0]
  if (!tourn) return new Response('Tournament not found', { status: 404 })

  const tournDate = tourn.date || tourn.start_date
  const dateDisplay = tournDate
    ? new Date(tournDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const locationDisplay = [tourn.location, tourn.tournament_city, tourn.tournament_state].filter(Boolean).join(', ')
  const ppg = parseFloat(tourn.pay_per_game) || 0

  // 2. All confirmed claims for this tournament
  const { data: claims } = await supabase
    .from('claims')
    .select('official_id,official_name,official_email,official_phone,block_id')
    .eq('tournament_id', tournament_id)
    .eq('status', 'confirmed')
  if (!claims?.length) return new Response(JSON.stringify({ sent: 0, message: 'No confirmed officials' }), { status: 200 })

  // 3. Block details for all claimed blocks
  const blockIds = [...new Set(claims.map(c => c.block_id))]
  const { data: blocks } = await supabase
    .from('available_blocks')
    .select('id,block_name,court_first,start_time,end_time,game_count')
    .in('id', blockIds)
  const blockMap = {}
  ;(blocks || []).forEach(b => { blockMap[b.id] = b })

  // 4. Build co-official map: block_id → [official names]
  const blockOfficials = {}
  claims.forEach(c => {
    if (!blockOfficials[c.block_id]) blockOfficials[c.block_id] = []
    blockOfficials[c.block_id].push(c.official_name)
  })

  // 5. Group claims by official
  const officialMap = {}
  claims.forEach(c => {
    if (!officialMap[c.official_id]) {
      officialMap[c.official_id] = {
        name: c.official_name, email: c.official_email, phone: c.official_phone, blocks: []
      }
    }
    const blk = blockMap[c.block_id]
    if (blk) officialMap[c.official_id].blocks.push({ ...blk, claim_block_id: c.block_id })
  })

  // 6. Sort each official's blocks by start_time and send emails
  let sent = 0, skipped = 0, errors = 0
  const results = []

  for (const official of Object.values(officialMap)) {
    if (isTestEmail(official.email)) { skipped++; continue }

    official.blocks.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

    const totalGames = official.blocks.reduce((s, b) => s + (b.game_count || 0), 0)
    const totalPay   = official.blocks.reduce((s, b) => s + (b.game_count || 0) * ppg, 0)
    const firstName  = official.name ? official.name.split(' ')[0] : 'Official'

    const blockRows = official.blocks.map(b => {
      const partners = (blockOfficials[b.claim_block_id] || [])
        .filter(n => n !== official.name)
      const partnerHtml = partners.length
        ? `<div style="font-size:11px;color:#6B7A99;margin-top:3px">Partner: <strong style="color:#1B2A4A">${partners.join(', ')}</strong></div>`
        : `<div style="font-size:11px;color:#9CA3AF;margin-top:3px">Solo assignment</div>`
      return `<tr>
        <td style="padding:12px 14px;border-bottom:1px solid #E0E6F0;vertical-align:top">
          <div style="font-weight:700;color:#1B2A4A">${b.block_name || ''} — ${b.court_first || ''}</div>
          ${partnerHtml}
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #E0E6F0;color:#4B5563;vertical-align:top;white-space:nowrap">${b.start_time || ''}–${b.end_time || ''}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #E0E6F0;color:#4B5563;text-align:center;vertical-align:top">${b.game_count || 0}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #E0E6F0;color:#1A7A4A;font-weight:700;text-align:right;vertical-align:top">$${(b.game_count || 0) * ppg}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:Arial,sans-serif">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#1B2A4A;padding:24px 28px">
    <div style="font-size:22px;font-weight:800;color:#C9A84C;letter-spacing:1px">StripeUp</div>
    <div style="font-size:13px;color:#8A9BB8;margin-top:2px">Your Schedule — ${tourn.name}</div>
  </div>
  <div style="padding:28px">
    <div style="font-size:20px;font-weight:700;color:#1B2A4A;margin-bottom:4px">Hey ${firstName}, here's your schedule!</div>
    <div style="font-size:14px;color:#6B7A99;margin-bottom:20px">${dateDisplay}${locationDisplay ? ' &nbsp;·&nbsp; ' + locationDisplay : ''}</div>

    <table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead>
        <tr style="background:#EDF1F8">
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8">Block / Court</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8;white-space:nowrap">Time</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8">Games</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8A9BB8">Pay</th>
        </tr>
      </thead>
      <tbody>${blockRows}</tbody>
    </table>

    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <span style="font-size:14px;color:#166534;font-weight:600">${totalGames} games</span>
      <span style="font-size:18px;color:#15803D;font-weight:800">$${totalPay} total</span>
    </div>

    <div style="background:#FEF3DC;border:1px solid #FAC775;border-radius:8px;padding:14px 18px;font-size:13px;color:#92400E">
      <strong>Game day reminders:</strong> Arrive 15 minutes early. Contact your assigner with any questions or conflicts.
    </div>
  </div>
  <div style="background:#F4F6F9;padding:16px 28px;text-align:center;font-size:11px;color:#9CA3AF">
    StripeUp &nbsp;·&nbsp; Timmons Foundation &nbsp;·&nbsp; This is your official schedule reminder
  </div>
</div>
</body></html>`

    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: official.email,
        subject: `Your schedule — ${tourn.name}${dateDisplay ? ' · ' + dateDisplay : ''}`,
        html
      })
      if (result.error) { errors++; results.push({ email: official.email, error: result.error.message }) }
      else { sent++; results.push({ email: official.email, ok: true }) }
    } catch (e) {
      errors++; results.push({ email: official.email, error: e.message })
    }
  }

  return new Response(JSON.stringify({ sent, skipped, errors, results }), { status: 200 })
}
