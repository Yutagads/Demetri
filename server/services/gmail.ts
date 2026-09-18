import nodemailer from 'nodemailer'

const smtpUser = process.env.SMTP_USER?.trim()
const smtpPass = process.env.SMTP_PASS?.trim()

const senderName =
  process.env.GMAIL_SENDER_NAME?.trim() ||
  'Exequiel R. Lina High School SMARTCLASS'

const gmailClientId = process.env.GMAIL_CLIENT_ID?.trim()
const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET?.trim()
const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim()

const hasGmailApiConfig =
  Boolean(gmailClientId && gmailClientSecret && gmailRefreshToken && smtpUser)

export type SendGmailEmailParams = {
  to: string
  subject: string
  text: string
  html?: string
}

function base64Url(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function encodeHeader(value: string) {
  return value.replace(/[\r\n]/g, ' ').trim()
}

function buildMimeMessage(params: SendGmailEmailParams) {
  const from = `"${encodeHeader(senderName)}" <${encodeHeader(smtpUser || '')}>`
  const to = encodeHeader(params.to)
  const subject = encodeHeader(params.subject)
  const text = params.text.replace(/\r?\n/g, '\r\n')
  const html = (params.html || '').replace(/\r?\n/g, '\r\n')

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Reply-To: ${encodeHeader(smtpUser || '')}`,
    'MIME-Version: 1.0',
  ]

  if (html) {
    const boundary = `smartclass_${Date.now()}_${Math.random().toString(36).slice(2)}`
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 8bit')
    lines.push('')
    lines.push(text)
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 8bit')
    lines.push('')
    lines.push(html)
    lines.push(`--${boundary}--`)
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 8bit')
    lines.push('')
    lines.push(text)
  }

  return lines.join('\r\n')
}

async function getGmailAccessToken() {
  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    throw new Error(
      'Gmail API is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and SMTP_USER.',
    )
  }

  const body = new URLSearchParams({
    client_id: gmailClientId,
    client_secret: gmailClientSecret,
    refresh_token: gmailRefreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await response.json().catch(() => ({})) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Gmail OAuth token request failed: ${data.error_description || data.error || `HTTP ${response.status}`}`,
    )
  }

  return data.access_token
}

async function sendViaGmailApi(params: SendGmailEmailParams) {
  if (!smtpUser) {
    throw new Error('SMTP_USER is required as the Gmail sender address.')
  }

  const accessToken = await getGmailAccessToken()
  const raw = base64Url(buildMimeMessage(params))

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    },
  )

  const data = await response.json().catch(() => ({})) as {
    id?: string
    threadId?: string
    error?: { message?: string }
  }

  if (!response.ok || !data.id) {
    throw new Error(
      `Gmail API send failed: ${data.error?.message || `HTTP ${response.status}`}`,
    )
  }

  return {
    messageId: data.id,
    threadId: data.threadId,
  }
}

async function sendViaSmtp(params: SendGmailEmailParams) {
  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP_USER and SMTP_PASS are not configured.')
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  return transporter.sendMail({
    from: `"${senderName}" <${smtpUser}>`,
    to: params.to,
    subject: params.subject,
    replyTo: smtpUser,
    text: params.text,
    html: params.html,
  })
}

export async function sendGmailEmail(params: SendGmailEmailParams) {
  // Render should use the Gmail API over HTTPS. This avoids direct SMTP
  // connection timeouts. Local development can continue using SMTP until
  // the Gmail API environment variables are configured.
  if (hasGmailApiConfig) {
    return sendViaGmailApi(params)
  }

  return sendViaSmtp(params)
}

export function gmailEmailConfiguration() {
  return {
    senderName,
    senderEmail: smtpUser || '',
    mode: hasGmailApiConfig ? 'GMAIL_API' : 'SMTP',
  }
}
