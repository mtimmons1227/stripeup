// netlify/functions/send-invites.js
// Sends SMS via Twilio + Email via Resend — independent channels, both always attempted

import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { Resend } from 'resend'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER   = process.env.TWILIO_FROM_NUMBER
const RESEND_API_KEY       = process.env.RESEND_API_KEY
const BASE_URL             = process.env.BASE_URL || 'https://stripeup.netlify.app'
const FROM_EMAIL           = process.env.FROM_EMAIL || 'invites@thetimmonsfoundation.org'

console.log('[send-invites] START — FROM_EMAIL:', FROM_EMAIL, '| BASE_URL:', BASE_URL, '| RESEND present:', !!RESEND_API_KEY, '| SUPABASE present:', !!SUPABASE_URL)

function generateToken() {
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function isTestEmail(email) {
  if (!email) return true
  const e = email.toLowerCase().trim()
  if (e.startsWith('test@')) return true
  if (/^test\d*@/.test(e)) return true
  if (/test@\w+\.\w+\d+$/.test(e)) return true
  return false
}

function isTestPhone(phone) {
  if (!phone) return true
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length < 10) return true
  if (/^(\d)\1+$/.test(cleaned)) return true
  return false
}

function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) return '+1' + cleaned
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned
  return '+' + cleaned
}

function calcExpiresAt(tournamentDate) {
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  if (!tournamentDate) return sevenDays
  // Parse as local midnight (not UTC) to avoid off-by-one in US timezones.
  // new Date('YYYY-MM-DD') treats the string as UTC midnight = previous evening local.
  // Splitting and using new Date(y,m,d) gives true local midnight instead.
  const p = tournamentDate.split('-')
  const tournDay = new Date(+p[0], +p[1] - 1, +p[2]) // local midnight on tournament day
  tournDay.setDate(tournDay.getDate() + 1)            // expire midnight after tournament day
  return tournDay < sevenDays ? tournDay : sevenDays
}

function formatExpiryLabel(expiresAt) {
  const msLeft = expiresAt - Date.now()
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
  if (daysLeft <= 1) return 'today'
  if (daysLeft <= 7) return 'in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return 'on ' + months[expiresAt.getMonth()] + ' ' + expiresAt.getDate()
}

function buildSmsMessage(name, tournamentName, tournamentDate, inviteUrl, expiresAt) {
  const firstName  = (name || 'Official').split(' ')[0]
  const dateStr    = tournamentDate ? ' on ' + tournamentDate : ''
  const expiryStr  = formatExpiryLabel(expiresAt)
  return 'Hey ' + firstName + '! You are invited to self-schedule for ' + tournamentName + dateStr + '.\nPick your games (link expires ' + expiryStr + '):\n' + inviteUrl
}

function buildEmailHtml(name, tournamentName, tournamentDate, inviteUrl, expiresAt) {
  const firstName  = (name || 'Official').split(' ')[0]
  const dateStr    = tournamentDate ? ' on ' + tournamentDate : ''
  const expiryStr  = formatExpiryLabel(expiresAt)
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
  '<body style="margin:0;padding:0;background:#0a0f1e;font-family:Arial,sans-serif;">' +
  '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 20px;"><tr><td align="center">' +
  '<table width="600" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">' +
  '<tr><td style="background:#1a2744;padding:32px;text-align:center;border-bottom:3px solid #f5c842;">' +
  '<h1 style="margin:0;color:#f5c842;font-size:28px;font-weight:700;letter-spacing:2px;">StripeUp</h1>' +
  '<p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">Stripe Up. Show Up. Run the Game.</p></td></tr>' +
  '<tr><td style="padding:40px 32px;">' +
  '<h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;">Hey ' + firstName + '! 👋</h2>' +
  '<p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">You have been invited to self-schedule your games for <strong style="color:#ffffff;">' + tournamentName + '</strong>' + dateStr + '.</p>' +
  '<p style="margin:0 0 32px;color:#94a3b8;font-size:15px;line-height:1.6;">Click below to pick your blocks. Your link expires <strong style="color:#f5c842;">' + expiryStr + '</strong>.</p>' +
  '<table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;"><tr>' +
  '<td style="background:#f5c842;border-radius:8px;">' +
  '<a href="' + inviteUrl + '" style="display:block;padding:16px 40px;color:#1a2744;font-size:16px;font-weight:700;text-decoration:none;text-align:center;">Pick My Games →</a>' +
  '</td></tr></table>' +
  '<p style="margin:0;color:#64748b;font-size:12px;text-align:center;">Or copy this link:<br>' +
  '<a href="' + inviteUrl + '" style="color:#f5c842;word-break:break-all;">' + inviteUrl + '</a></p>' +
  '</td></tr>' +
  '<tr><td style="background:#0a0f1e;padding:20px 32px;text-align:center;border-top:1px solid #1e293b;">' +
  '<p style="margin:0;color:#475569;font-size:12px;">Sent by your assigner via StripeUp. Do not share this link.</p>' +
  '</td></tr></table></td></tr></table></body></html>'
}

export default async function handler(req) {

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  let body
  try { body = await req.json() }
  catch (e) {
    console.error('[send-invites] JSON parse error:', e.message)
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { officialIds, tournamentName, tournamentDate, tournamentId, forceResend } = body
  console.log('[send-invites] Request — officials:', officialIds && officialIds.length, '| tournament:', tournamentName, '| id:', tournamentId, '| forceResend:', !!forceResend)

  if (!officialIds || !officialIds.length || !tournamentName) {
    return new Response(JSON.stringify({ error: 'officialIds and tournamentName are required' }), { status: 400 })
  }

  const supabase     = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  const resend       = new Resend(RESEND_API_KEY)

  const { data: officials, error: fetchErr } = await supabase
    .from('officials')
    .select('id, name, phone, email')
    .in('id', officialIds)

  if (fetchErr) {
    console.error('[send-invites] Supabase fetch error:', fetchErr.message)
    return new Response(JSON.stringify({ error: 'Failed to fetch officials', detail: fetchErr.message }), { status: 500 })
  }

  console.log('[send-invites] Fetched', officials.length, 'officials from DB')

  // Counters — tracked independently per channel
  const counts = {
    smsSent:             0,
    smsFailed:           0,
    smsSkipped:          0,
    emailSent:           0,
    emailFailed:         0,
    emailSkipped:        0,
    noContact:           0,
    alreadyInvited:      0,
    alreadyConfirmed:    0
  }

  const results = { sent: [], skipped: [], failed: [] }

  // Check which officials are already confirmed for this tournament (via claims table)
  let confirmedOfficialIds = new Set()
  if (tournamentId) {
    const { data: confirmedClaims } = await supabase
      .from('claims')
      .select('official_id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'confirmed')
    if (confirmedClaims) confirmedClaims.forEach(c => confirmedOfficialIds.add(c.official_id))
    console.log('[send-invites] Already confirmed officials (claims):', confirmedOfficialIds.size)
  }

  // Belt-and-suspenders: skip officials whose token was already used (confirmed) or declined.
  // Protects against cascade-deleted claims scenario and respects explicit declines.
  let usedTokenOfficialIds = new Set()
  let declinedOfficialIds = new Set()
  if (tournamentId) {
    const { data: statusTokens } = await supabase
      .from('invite_tokens')
      .select('official_id,status,used')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
    if (statusTokens) {
      // For used/confirmed: scan ALL tokens for this official — a later forceResend may have
      // created a newer unused token on top of an older confirmed one. We must not miss the
      // confirmed token just because it isn't the most recent row.
      // For declined: only the most-recent token counts (a re-invite supersedes a decline).
      const seenForDeclined = new Set()
      statusTokens.forEach(t => {
        if (t.used || t.status === 'confirmed') usedTokenOfficialIds.add(t.official_id)
        if (!seenForDeclined.has(t.official_id) && t.status === 'declined') {
          declinedOfficialIds.add(t.official_id)
        }
        seenForDeclined.add(t.official_id)
      })
    }
    console.log('[send-invites] Officials with used/confirmed tokens:', usedTokenOfficialIds.size, '| declined:', declinedOfficialIds.size)
  }

  for (const official of officials) {

    // Skip already-confirmed officials (via claims table)
    if (confirmedOfficialIds.has(official.id)) {
      console.log('[send-invites] SKIPPED', official.name, '— already confirmed (claim)')
      counts.alreadyConfirmed++
      results.skipped.push({ officialId: official.id, name: official.name, reason: 'already confirmed' })
      continue
    }

    // Skip officials whose token was already used — they self-scheduled even if claims were lost
    if (usedTokenOfficialIds.has(official.id)) {
      console.log('[send-invites] SKIPPED', official.name, '— token already used (self-scheduled)')
      counts.alreadyConfirmed++
      results.skipped.push({ officialId: official.id, name: official.name, reason: 'already self-scheduled (used token)' })
      continue
    }

    // Skip officials who explicitly declined — unless forceResend (Re-invite button)
    if (!forceResend && declinedOfficialIds.has(official.id)) {
      console.log('[send-invites] SKIPPED', official.name, '— declined')
      counts.alreadyConfirmed++
      results.skipped.push({ officialId: official.id, name: official.name, reason: 'declined' })
      continue
    }

    const hasPhone = !isTestPhone(official.phone)
    const hasEmail = !isTestEmail(official.email)

    console.log('[send-invites]', official.name, '— phone valid:', hasPhone, '| email valid:', hasEmail, '| email:', official.email)

    // Skip only if BOTH channels are unavailable
    if (!hasPhone && !hasEmail) {
      console.log('[send-invites] SKIPPED', official.name, '— no valid phone or email')
      counts.noContact++
      counts.smsSkipped++
      counts.emailSkipped++
      results.skipped.push({ officialId: official.id, name: official.name, reason: 'no valid phone or email' })
      continue
    }

    // Track what was skipped per channel even if the other sends
    if (!hasPhone) counts.smsSkipped++
    if (!hasEmail) counts.emailSkipped++

    // Check for an existing active (unused, unexpired) token for this official+tournament
    // Only skip if the token was created within the last 24 hours — older tokens get replaced and resent
    let token, inviteUrl, expiresAt
    if (tournamentId) {
      const { data: existingTokens } = await supabase
        .from('invite_tokens')
        .select('id, token, created_at')
        .eq('official_id', official.id)
        .eq('tournament_id', tournamentId)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1)

      if (existingTokens && existingTokens.length > 0) {
        const tokenAgeMs = Date.now() - new Date(existingTokens[0].created_at).getTime()
        const twentyFourHours = 24 * 60 * 60 * 1000
        if (!forceResend && tokenAgeMs < twentyFourHours) {
          console.log('[send-invites] SKIPPED', official.name, '— active token < 24h old:', existingTokens[0].token)
          counts.alreadyInvited++
          results.skipped.push({ officialId: official.id, name: official.name, reason: 'already invited (token < 24h old)', token: existingTokens[0].token })
          continue
        }
        // Token is stale or forceResend — delete it and resend
        console.log('[send-invites] Deleting existing token for', official.name, '— forceResend:', !!forceResend, '| age:', Math.round(tokenAgeMs / 3600000) + 'h')
        await supabase.from('invite_tokens').delete().eq('id', existingTokens[0].id)
      }
    }

    token     = generateToken()
    inviteUrl = BASE_URL + '/self-schedule.html?signup=' + token
    expiresAt = calcExpiresAt(tournamentDate)

    try {
      // Insert invite token first (status=re-invited if forceResend, else invited)
      const { error: tokenErr } = await supabase
        .from('invite_tokens')
        .insert({
          token,
          official_id:     official.id,
          tournament_id:   tournamentId || null,
          tournament_name: tournamentName,
          tournament_date: tournamentDate || null,
          expires_at:      expiresAt.toISOString(),
          used:            false,
          status:          forceResend ? 're-invited' : 'invited'
        })

      if (tokenErr) throw new Error('Token insert failed: ' + tokenErr.message)
      console.log('[send-invites] Token created for', official.name)

      const sendResult = {
        officialId: official.id,
        name:       official.name,
        token,
        inviteUrl,
        channels:   [],
        smsStatus:  hasPhone  ? 'pending' : 'skipped',
        emailStatus:hasEmail  ? 'pending' : 'skipped'
      }

      // ── SMS — always attempt if valid phone, independent of email ──
      if (hasPhone) {
        try {
          const phone = formatPhone(official.phone)
          console.log('[send-invites] SMS → ', official.name, 'at', phone)
          await twilioClient.messages.create({
            body: buildSmsMessage(official.name, tournamentName, tournamentDate, inviteUrl, expiresAt),
            from: TWILIO_FROM_NUMBER,
            to:   phone
          })
          sendResult.phone      = phone
          sendResult.smsStatus  = 'sent'
          sendResult.channels.push('sms')
          counts.smsSent++
          console.log('[send-invites] SMS OK →', official.name)
        } catch (smsErr) {
          sendResult.smsStatus  = 'failed'
          sendResult.smsError   = smsErr.message
          counts.smsFailed++
          console.error('[send-invites] SMS FAILED →', official.name, ':', smsErr.message)
        }
      }

      // ── EMAIL — always attempt if valid email, independent of SMS ──
      if (hasEmail) {
        try {
          const firstName  = (official.name || 'Official').split(' ')[0]
          const dateStr    = tournamentDate ? ' on ' + tournamentDate : ''
          const fromAddr   = 'StripeUp <' + FROM_EMAIL + '>'
          console.log('[send-invites] Email → ', official.email, 'from', fromAddr)

          const { data: emailData, error: emailError } = await resend.emails.send({
            from:    fromAddr,
            to:      [official.email],
            subject: firstName + ', pick your games for ' + tournamentName + dateStr,
            html:    buildEmailHtml(official.name, tournamentName, tournamentDate, inviteUrl, expiresAt)
          })

          if (emailError) {
            sendResult.emailStatus = 'failed'
            sendResult.emailError  = emailError.message || JSON.stringify(emailError)
            counts.emailFailed++
            console.error('[send-invites] Email FAILED (Resend error) →', official.name, ':', JSON.stringify(emailError))
          } else {
            sendResult.email       = official.email
            sendResult.emailStatus = 'sent'
            sendResult.resendId    = emailData && emailData.id
            sendResult.channels.push('email')
            counts.emailSent++
            console.log('[send-invites] Email OK →', official.name, '| Resend ID:', emailData && emailData.id)
          }
        } catch (emailErr) {
          sendResult.emailStatus = 'failed'
          sendResult.emailError  = emailErr.message
          counts.emailFailed++
          console.error('[send-invites] Email EXCEPTION →', official.name, ':', emailErr.message)
        }
      }

      results.sent.push(sendResult)
      console.log('[send-invites]', official.name, '→ SMS:', sendResult.smsStatus, '| Email:', sendResult.emailStatus)

    } catch (err) {
      console.error('[send-invites] FAILED (token/db error) →', official.name, ':', err.message)
      await supabase.from('invite_tokens').delete().eq('token', token)
      results.failed.push({ officialId: official.id, name: official.name, error: err.message })
    }
  }

  console.log('[send-invites] COMPLETE ——')
  console.log('  Sent: ' + results.sent.length + ' | Already invited: ' + counts.alreadyInvited + ' | Already confirmed: ' + counts.alreadyConfirmed + ' | No contact: ' + counts.noContact + ' | Failed: ' + results.failed.length)
  console.log('  SMS:   sent=' + counts.smsSent + ' failed=' + counts.smsFailed + ' skipped=' + counts.smsSkipped)
  console.log('  Email: sent=' + counts.emailSent + ' failed=' + counts.emailFailed + ' skipped=' + counts.emailSkipped)

  return new Response(JSON.stringify({
    total:                   officials.length,
    sent:                    results.sent.length,
    skipped_already_invited: counts.alreadyInvited,
    skipped_confirmed:       counts.alreadyConfirmed,
    skipped_no_contact:      counts.noContact,
    failed:                  results.failed.length,
    sms: {
      sent:    counts.smsSent,
      failed:  counts.smsFailed,
      skipped: counts.smsSkipped
    },
    email: {
      sent:    counts.emailSent,
      failed:  counts.emailFailed,
      skipped: counts.emailSkipped
    },
    results
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}

export const config = { path: '/api/send-invites' }
