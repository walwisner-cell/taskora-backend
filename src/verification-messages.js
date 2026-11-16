// v167: Walter, looking at "Identity Verification: Submitted, awaiting
// review": "at this stage the system should send a message to whoever is
// registering, to let them know the next steps."
//
// Before, the person who sent their ID got nothing: only the reviewers were
// told. They saw "awaiting review" with no idea how long it takes, what they
// can do meanwhile, or what happens if something is wrong.
//
// Good practice (banks, Uber, Airbnb and other ID checks) is to confirm
// straight away, by email and in the app, with:
//   - that the documents arrived, and when;
//   - what happens next and how long it usually takes;
//   - what they can already do, and what opens once approved;
//   - what happens if something needs fixing;
//   - a safety line: Trothen never asks for the documents again by phone,
//     WhatsApp or email, or for a password;
//   - where to ask for help.
// And the same again when it is decided: approved (what is open now) or not
// approved (the reason, and how to send it again).
//
// These go out whatever the person's email settings are: they are about the
// person's own account, not marketing. A text message (SMS) also goes when
// Twilio is set up, as many people in Liberia read texts before email.
const { notify } = require('./notify');
const db = require('./db');

const SUPPORT = 'support@trothenpro.com';
const base = () => (process.env.APP_URL || 'https://trothenpro.com').trim().replace(/\/$/, '');
const firstName = (u) => String((u && u.name) || '').trim().split(/\s+/)[0] || 'there';
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// "within 48 hours" as a day and time the person can plan around, in their own time zone if known.
function byWhen(deadline, user) {
  const d = new Date(deadline);
  if (!Number.isFinite(d.getTime())) return '';
  try {
    return d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: (user && user.timeZone) || (user && user.country === 'Liberia' ? 'Africa/Monrovia' : 'UTC') });
  } catch (e) { return d.toUTCString(); }
}

// One email: a heading, short paragraphs, a numbered list of steps, a button.
function emailParts({ title, intro, steps, after, button, link }) {
  const text = [title, '', ...intro, '', ...steps.map((s, i) => `${i + 1}. ${s}`), '', ...after, '', `${button}: ${link}`, '', `Questions? Reply to this email or write to ${SUPPORT}.`, '', 'Trothen'].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2a44;max-width:560px;margin:0 auto;">
  <h2 style="font-size:20px;margin:0 0 12px;color:#12203a;">${esc(title)}</h2>
  ${intro.map(p => `<p style="margin:0 0 10px;">${esc(p)}</p>`).join('')}
  <ol style="margin:4px 0 14px;padding-left:22px;">${steps.map(s => `<li style="margin:0 0 6px;">${esc(s)}</li>`).join('')}</ol>
  ${after.map(p => `<p style="margin:0 0 10px;">${esc(p)}</p>`).join('')}
  <p style="margin:18px 0;"><a href="${esc(link)}" style="background:#1d5fa8;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;display:inline-block;font-weight:bold;">${esc(button)}</a></p>
  <p style="margin:0;color:#5a6577;font-size:13px;">Questions? Reply to this email or write to <a href="mailto:${SUPPORT}" style="color:#1d5fa8;">${SUPPORT}</a>.</p>
</div>`;
  return { text, html };
}

async function send(user, subject, parts, sms, inApp, icon) {
  // The in-app notice would also be emailed (email-notify) when the person is
  // away; this fuller email replaces it, so that short one is marked as sent.
  try { const log = require('./email-notify')._sentLog; log.set(user.id, [...(log.get(user.id) || []), { at: Date.now(), text: inApp }]); } catch (e) {}
  try { await notify(user.id, icon, inApp, null, { section: 'verification' }); } catch (e) { /* the email still goes */ }
  const { sendEmail, sendSms, isSmsConfigured } = require('./delivery');
  if (user.email) { try { await sendEmail(user.email, subject, parts.text, { html: parts.html }); } catch (e) { console.error('[verification] email failed:', e.message); } }
  if (sms && user.phone && isSmsConfigured()) { try { await sendSms(user.phone, sms); } catch (e) { console.error('[verification] sms failed:', e.message); } }
}

// Straight after the documents are sent.
async function submitted(user, record) {
  if (!user) return;
  const pro = user.role === 'provider';
  const when = byWhen(record.reviewDeadline, user);
  const nameCheck = record.status === 'review_required';
  const intro = [
    `Hi ${firstName(user)},`,
    `Thank you. We have received your ID${record.backFilename ? ' (front and back)' : ''} and your photo, and they are now waiting for review. They are stored securely and are only seen by the Trothen team that checks IDs.`,
    ...(nameCheck ? ['The name on your ID is not exactly the same as the name on your Trothen account, so a person will look at it closely. That is common (a middle name, a married name, a different spelling) and it can take a little longer.'] : []),
  ];
  const steps = [
    `We check your ID and compare it with your photo. This usually takes up to 48 hours${when ? `, so by ${when}` : ''}.`,
    'We tell you as soon as it is done, by email and in Trothen.',
    pro
      ? 'Once approved, customers see "ID checked" on your profile and you appear in search and job matches.'
      : 'Once approved, you can book pros and post jobs.',
    'If something needs fixing (for example, a blurred photo), we tell you exactly what, and you can send it again from the same page.',
  ];
  const after = [
    pro
      ? 'While you wait: add a clear profile picture, your skills and your prices in Settings, so your profile is ready the moment you are approved.'
      : 'While you wait: you can look around, browse pros and the Market, and save the pros you like.',
    'For your safety: Trothen will never ask you to send your ID again by phone, WhatsApp, text or email, and never asks for your password or a code we sent you.',
  ];
  const parts = emailParts({ title: 'We have your ID. Here is what happens next.', intro, steps, after, button: 'See your verification', link: `${base()}/?verify=1` });
  await send(user, 'We received your ID: what happens next', parts,
    `Trothen: we received your ID. We check it within 48 hours and tell you when it is done. Trothen never asks for your ID or password by phone or WhatsApp.`,
    `We received your ID. We check it within 48 hours${when ? ` (by ${when})` : ''} and tell you when it is done. ${pro ? 'Meanwhile, finish your profile in Settings.' : 'Meanwhile, you can browse pros and the Market.'}`, '📨');
}

// When a reviewer decides.
async function decided(user, decision, reason) {
  if (!user) return;
  const pro = user.role === 'provider';
  if (decision === 'approve') {
    const needPhoto = pro && !user.profilePhotoUrl;
    const steps = pro
      ? [...(needPhoto ? ['Add a profile picture in Settings. Customers only see pros with a photo.'] : []), 'Check your skills, prices and the area you cover in Settings.', 'Turn on bookings, and answer job matches quickly: fast answers get more work.']
      : ['Find a pro by what you need, or post a job and let pros answer.', 'Agree the price in Trothen. Your money is held safely and only paid when the work is done.', 'Need a ride or a delivery? Open Rides.'];
    const parts = emailParts({ title: 'Your ID is verified', intro: [`Hi ${firstName(user)},`, pro ? 'Good news: your identity is verified, and customers will see "ID checked" on your profile.' : 'Good news: your identity is verified. You can now book pros and post jobs on Trothen.'], steps, after: [], button: 'Open Trothen', link: base() });
    return send(user, 'Your ID is verified', parts, `Trothen: your ID is verified. ${pro ? 'Customers now see "ID checked" on your profile.' : 'You can now book pros and post jobs.'}`,
      needPhoto ? 'Your identity verification was approved. One more step before you appear in search and job matches: add a profile picture in Settings.' : 'Your identity verification was approved.', '✅');
  }
  const why = String(reason || '').trim();
  const parts = emailParts({ title: 'Your ID needs to be sent again', intro: [`Hi ${firstName(user)},`, 'We could not verify your identity from the documents you sent.', ...(why ? [`The reason: ${why}`] : [])],
    steps: ['Open Verification in Trothen.', 'Take new photos: the whole document, flat, all four corners showing, no glare, and your face clearly in the selfie.', 'Enter your full name exactly as it is printed on the ID, and send it again.'],
    after: ['We check it again within 48 hours. If you think this is a mistake, reply to this email.'], button: 'Send my ID again', link: `${base()}/?verify=1` });
  return send(user, 'Your ID needs to be sent again', parts, `Trothen: we could not verify your ID${why ? ` (${why})` : ''}. Please send it again from Verification in the app.`,
    `Your identity verification was rejected: ${why}. Please resubmit your documents.`, '❌');
}

module.exports = { submitted, decided, byWhen };
