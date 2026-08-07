// netlify/functions/send-invites.js
// Sends SMS via Twilio + Email via Resend — independent channels, both always attempted

import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER   = process.env.TWILIO_FROM_NUMBER
const RESEND_API_KEY       = process.env.RESEND_API_KEY
const BASE_URL             = process.env.BASE_URL || 'https://officials-scheduler.netlify.app'
const FROM_EMAIL           = process.env.FROM_EMAIL || 'invites@thetimmonsfoundation.org'

// CORS / JSON response helpers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}
const CORS_JSON_HEADERS = Object.assign({'Content-Type': 'application/json'}, CORS_HEADERS)
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS_JSON_HEADERS })
}

// Validate required environment variables (simple check at import-time)
const REQUIRED_ENVS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER',
  'RESEND_API_KEY'
]
const MISSING_ENVS = REQUIRED_ENVS.filter(k => !process.env[k])
if (MISSING_ENVS.length) {
  console.warn('[send-invites] Missing env vars:', MISSING_ENVS.join(', '))
}

console.log('[send-invites] START — FROM_EMAIL:', FROM_EMAIL, '| BASE_URL:', BASE_URL, '| RESEND present:', !!RESEND_API_KEY, '| SUPABASE present:', !!SUPABASE_URL)

function generateToken() {
  // Use Node's crypto.randomBytes for server-side safety
  try {
    return randomBytes(12).toString('hex')
  } catch (e) {
    // Fallback to Web Crypto if available
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(12)
      globalThis.crypto.getRandomValues(arr)
      return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
    }
    // Last-resort: timestamp + random
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  }
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

function buildSmsMessage(name, tournamentName, tournamentDate, inviteUrl) {
  const firstName = (name || 'Official').split(' ')[0]
  const dateStr   = tournamentDate ? ' on ' + tournamentDate : ''
  return 'Hey ' + firstName + '! You are invited to self-schedule for ' + tournamentName + dateStr + '.\nPick your games (link expires 7 days):\n' + inviteUrl
}

function buildEmailHtml(name, tournamentName, tournamentDate, inviteUrl) {
  const firstName = (name || 'Official').split(' ')[0]
  const dateStr   = tournamentDate ? ' on ' + tournamentDate : ''
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
  '<p style="margin:0 0 32px;color:#94a3b8;font-size:15px;line-height:1.6;">Click below to pick your blocks. Your link expires in <strong style="color:#f5c842;">7 days</strong>.</p>' +
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
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body
  try { body = await req.json() }
  catch (e) {
    console.error('[send-invites] JSON parse error:', e.message)
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  // If required env vars are missing, fail fast with clear message
  if (MISSING_ENVS.length) {
    return jsonResponse({ error: 'Missing required environment variables', missing: MISSING_ENVS }, 500)
  }

  const { officialIds, tournamentName, tournamentDate, tournamentId } = body
  console.log('[send-invites] Request — officials:', officialIds && officialIds.length, '| tournament:', tournamentName, '| id:', tournamentId)

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
    return jsonResponse({ error: 'Failed to fetch officials', detail: fetchErr.message }, 500)
  }

  console.log('[send-invites] Fetched', officials.length, 'officials from DB')

  // Counters — tracked independently per channel
  const counts = {
    smsSent:      0,
    smsFailed:    0,
    smsSkipped:   0,
    emailSent:    0,
    emailFailed:  0,
    emailSkipped: 0,
    noContact:    0
  }

  const results = { sent: [], skipped: [], failed: [] }

  // Process officials in concurrent batches to improve throughput while avoiding rate-limit bursts.
  const CONCURRENCY = parseInt(process.env.SEND_CONCURRENCY || '6', 10) || 6

  async function processOfficial(official) {
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
      return
    }

    if (!hasPhone) counts.smsSkipped++
    if (!hasEmail) counts.emailSkipped++

    const token     = generateToken()
    const inviteUrl = BASE_URL + '/self-schedule.html?signup=' + token

    try {
      const { error: tokenErr } = await supabase
        .from('invite_tokens')
        .insert({
          token,
          official_id:     official.id,
          tournament_id:   tournamentId || null,
          tournament_name: tournamentName,
          tournament_date: tournamentDate || null,
          expires_at:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used:            false
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

      if (hasPhone) {
        try {
          const phone = formatPhone(official.phone)
          console.log('[send-invites] SMS → ', official.name, 'at', phone)
          await twilioClient.messages.create({
            body: buildSmsMessage(official.name, tournamentName, tournamentDate, inviteUrl),
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
            html:    buildEmailHtml(official.name, tournamentName, tournamentDate, inviteUrl)
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

  // Run in batches
  for (let i = 0; i < officials.length; i += CONCURRENCY) {
    const batch = officials.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(o => processOfficial(o)))
  }

  console.log('[send-invites] COMPLETE ——')
  console.log('  SMS:   sent=' + counts.smsSent + ' failed=' + counts.smsFailed + ' skipped=' + counts.smsSkipped)
  console.log('  Email: sent=' + counts.emailSent + ' failed=' + counts.emailFailed + ' skipped=' + counts.emailSkipped)
  console.log('  No contact: ' + counts.noContact)

  return jsonResponse({
    total:        officials.length,
    noContact:    counts.noContact,
    sent:         results.sent.length,
    skipped:      results.skipped.length,
    failed:       results.failed.length,
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
  }, 200)
}

export const config = { path: '/api/send-invites' }
