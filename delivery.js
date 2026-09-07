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

// Twilio Verify is a DIFFERENT product from plain Twilio SMS above — it's
// purpose-built for exactly one thing (send a code, check a code) and
// deliberately doesn't need a sending phone number or A2P 10DLC
// registration the way sendSms()'s raw Messages API does. Twilio
// generates and tracks the code itself; this app never sees or stores
// it — startPhoneVerification() and checkPhoneVerification() below are
// the only two calls involved. If both this AND plain SMS end up
// configured, callers should prefer Verify for anything that's actually
// a verification code, and reserve sendSms() for free-text messages
// Verify has no way to send (e.g. the document-upload reminder nudge).
function isPhoneVerifyConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}

async function startPhoneVerification(phone) {
  if (!isPhoneVerifyConfigured()) return { started: false, error: 'not_configured' };
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: phone, Channel: 'sms' });
    const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[delivery] Twilio Verify start failed (${res.status}): ${data.message || ''}`);
      return { started: false, error: `twilio_verify_${res.status}` };
    }
    return { started: data.status === 'pending' };
  } catch (e) {
    console.error('[delivery] Twilio Verify start threw:', e.message);
    return { started: false, error: 'network' };
  }
}

// Returns { approved: true } only when Twilio itself confirms the code
// matches what it sent — this app never has its own copy of the code to
// compare against, which is the whole point of using Verify.
async function checkPhoneVerification(phone, code) {
  if (!isPhoneVerifyConfigured()) return { approved: false, error: 'not_configured' };
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: phone, Code: code });
    const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // A 404 here just means "no pending verification for this number"
      // (expired, already used, or never started) — a normal outcome,
      // not a real error worth logging loudly.
      if (res.status !== 404) console.error(`[delivery] Twilio Verify check failed (${res.status}): ${data.message || ''}`);
      return { approved: false };
    }
    return { approved: data.status === 'approved' };
  } catch (e) {
    console.error('[delivery] Twilio Verify check threw:', e.message);
    return { approved: false, error: 'network' };
  }
}

function isEmailConfigured() {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
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
      return { sent: false, error: `sendgrid_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('[delivery] SendGrid email send threw:', e.message);
    return { sent: false, error: 'network' };
  }
}

module.exports = { isSmsConfigured, isEmailConfigured, sendSms, sendEmail, isPhoneVerifyConfigured, startPhoneVerification, checkPhoneVerification };
