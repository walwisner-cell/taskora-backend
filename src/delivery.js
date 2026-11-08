// Real SMS/email delivery, off by default. Every OTP/2FA code and
// password-reset link in this app currently shows up directly on screen
// in a "TEST MODE" banner instead of actually being sent — deliberate and
// clearly labeled, but obviously not how this should work once real
// customers are using it. This module is what turns that into the real
// thing, without changing anything for anyone until it's actually
// configured.
//
// Two provider choices, one per channel — Twilio for SMS, SendGrid for
// email. Both picked the same way Persona was: not because they're the
// only option, but because they're the most standard, most stable, most
// widely-documented choice in their category, which matters a lot when
// nobody here has a live account to test the exact request shape
// against. If you already use a different provider for either channel,
// swapping it in means changing the two send functions below — nothing
// else in the app needs to know or care which vendor is behind them.

function isSmsConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

// Twilio Verify — a separate Twilio product built specifically for
// one-time verification codes, distinct from plain SMS sending above.
// The real, meaningful difference: sending a code via plain SMS (via
// TWILIO_FROM_NUMBER) legally requires registering as a business under
// A2P 10DLC — a real brand/campaign registration with a 10-15 day
// carrier approval wait, and a paid Twilio account (trial accounts
// can't register at all). Verify is exempt from that whole process:
// no phone number to buy, no business registration, works the moment
// it's configured. The tradeoff is real too — Twilio generates and
// owns the actual code, so this can't be used anywhere the app needs
// to know the code itself (e.g. to use the same one as an email
// fallback) — see the 2FA login flow in this file for exactly that
// case, which deliberately stays on plain SMS for that reason.
function isVerifyConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}

// Starts a real Verify check — Twilio generates its own code and texts
// it directly, so there's no code for this app to see or store. Returns
// { started: true } on success; callers fall back to the existing
// test-mode/plain-SMS behavior on failure or when not configured.
async function startPhoneVerification(to) {
  if (!isVerifyConfigured()) return { started: false, error: 'not_configured' };
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: to, Channel: 'sms' });
    const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[delivery] Twilio Verify start failed (${res.status}): ${detail}`);
      return { started: false, error: `verify_${res.status}` };
    }
    return { started: true };
  } catch (e) {
    console.error('[delivery] Twilio Verify start threw:', e.message);
    return { started: false, error: 'network' };
  }
}

// Checks a code the person actually typed in against what Twilio Verify
// sent — this is the only way to know if it's correct, since this app
// never sees the real code Twilio generated.
async function checkPhoneVerification(to, code) {
  if (!isVerifyConfigured()) return { approved: false, error: 'not_configured' };
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: to, Code: code });
    const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[delivery] Twilio Verify check failed (${res.status}):`, JSON.stringify(data));
      return { approved: false, error: `verify_${res.status}` };
    }
    return { approved: data.status === 'approved' };
  } catch (e) {
    console.error('[delivery] Twilio Verify check threw:', e.message);
    return { approved: false, error: 'network' };
  }
}

// v147: email can go through any mailbox's SMTP server (for example the
// Namecheap Private Email box noreply@trothenpro.com: SMTP_HOST=
// mail.privateemail.com, SMTP_PORT=465, SMTP_USER=noreply@trothenpro.com,
// SMTP_PASS=its password), through SendGrid, or both. With both set, SMTP
// goes first and SendGrid is the backup. SendGrid ended its free plan in
// 2025: a free or trial account stops sending, which locks every admin out
// (admins sign in with an emailed code).
function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
function isSendgridConfigured() {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}
function isEmailConfigured() {
  return isSmtpConfigured() || isSendgridConfigured();
}
// What happened to the last email, for Admin → Go-Live (never the content).
let lastEmail = null;
function emailStatus() {
  return { smtp: isSmtpConfigured(), sendgrid: isSendgridConfigured(), smtpHost: process.env.SMTP_HOST || null, from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.SENDGRID_FROM_EMAIL || null, last: lastEmail };
}
// Turns a provider's refusal into plain words, and says whether it's the
// address (the person can fix it) or Trothen's email account (the team must).
function explainSendgrid(status, detail) {
  const d = String(detail || '');
  if (status === 401) return { words: 'SendGrid refused Trothen\'s API key: the key is wrong or was deleted, or the account\'s plan has ended (SendGrid ended its free plan in 2025). Upgrade the SendGrid plan, or set up SMTP with Trothen\'s own mailbox.', account: true };
  if (status === 403 && /sender identity|from address/i.test(d)) return { words: `SendGrid refused the sender ${process.env.SENDGRID_FROM_EMAIL}: it isn't a verified sender. Verify it (or the trothenpro.com domain) in SendGrid → Settings → Sender Authentication.`, account: true };
  if (status === 403) return { words: 'SendGrid refused to send: the account is paused, over its limit, or its plan has ended. Check the account in SendGrid, or set up SMTP with Trothen\'s own mailbox.', account: true };
  if (status === 429) return { words: 'SendGrid says too many emails were sent: the daily limit of the plan is used up.', account: true };
  if (status === 400 && /email/i.test(d) && /invalid|does not contain a valid/i.test(d)) return { words: 'SendGrid says the recipient\'s email address isn\'t valid.', account: false, badAddress: true };
  return { words: `SendGrid refused to send (error ${status}).`, account: true };
}
let transport = null;
function smtpTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transport = require('nodemailer').createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000 });
  }
  return transport;
}
async function sendViaSmtp(to, subject, text) {
  try {
    await smtpTransport().sendMail({ from: { name: 'Trothen', address: process.env.SMTP_FROM || process.env.SMTP_USER }, to, subject, text });
    return { sent: true, via: 'smtp' };
  } catch (e) {
    const code = Number(e.responseCode) || 0;
    const badAddress = code === 550 || code === 553 || code === 501 || e.code === 'EENVELOPE';
    const words = e.code === 'EAUTH' ? `The mail server ${process.env.SMTP_HOST} refused the username or password for ${process.env.SMTP_USER}. Check SMTP_USER and SMTP_PASS.`
      : ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(e.code) ? `Trothen couldn't reach the mail server ${process.env.SMTP_HOST} on port ${Number(process.env.SMTP_PORT) || 465}. Check SMTP_HOST and SMTP_PORT.`
      : badAddress ? 'The mail server says the recipient\'s address doesn\'t exist or can\'t receive mail.'
      : `The mail server refused to send${code ? ` (error ${code})` : ''}.`;
    console.error('[delivery] SMTP send failed:', e.code || '', code || '', String(e.message || '').slice(0, 300));
    return { sent: false, via: 'smtp', error: `smtp_${e.code || code || 'failed'}`, words, account: !badAddress, badAddress };
  }
}

// Returns { sent: true } on success, { sent: false, error } on any
// failure — callers fall back to the existing test-mode on-screen
// display when sent is false, for any reason (not configured, or a real
// send that failed), so nobody's ever stuck unable to sign in just
// because a text message bounced.
async function sendSms(to, body) {
  if (!isSmsConfigured()) return { sent: false, error: 'not_configured' };
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[delivery] Twilio SMS send failed (${res.status}): ${detail}`);
      return { sent: false, error: `twilio_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('[delivery] Twilio SMS send threw:', e.message);
    return { sent: false, error: 'network' };
  }
}

async function sendEmail(to, subject, text) {
  if (!isEmailConfigured()) return { sent: false, error: 'not_configured' };
  let r = null;
  if (isSmtpConfigured()) r = await sendViaSmtp(to, subject, text);
  if ((!r || (!r.sent && !r.badAddress)) && isSendgridConfigured()) {
    const g = await sendViaSendgrid(to, subject, text);
    // keep the SMTP reason if SendGrid (the backup) failed too
    r = g.sent || !r ? g : { ...r, backup: g.words };
  }
  lastEmail = { at: new Date().toISOString(), sent: r.sent, via: r.via, error: r.sent ? null : r.error, words: r.sent ? null : r.words, backup: r.backup || null, badAddress: !!r.badAddress };
  return r;
}
async function sendViaSendgrid(to, subject, text) {
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Trothen' },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[delivery] SendGrid email send failed (${res.status}): ${detail}`);
      return { sent: false, via: 'sendgrid', error: `sendgrid_${res.status}`, ...explainSendgrid(res.status, detail) };
    }
    return { sent: true, via: 'sendgrid' };
  } catch (e) {
    console.error('[delivery] SendGrid email send threw:', e.message);
    return { sent: false, via: 'sendgrid', error: 'network', words: 'Trothen couldn\'t reach SendGrid (network).', account: true };
  }
}

module.exports = { isSmsConfigured, isVerifyConfigured, sendSms, isEmailConfigured, isSmtpConfigured, isSendgridConfigured, emailStatus, sendEmail, startPhoneVerification, checkPhoneVerification };
