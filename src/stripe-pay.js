// Card payments through Stripe Checkout (v125).
//
// Switched on only when both of these are set on Render (Environment):
//   STRIPE_SECRET_KEY      the secret key from Stripe (starts sk_live_ or sk_test_)
//   STRIPE_WEBHOOK_SECRET  the signing secret of the webhook you add in Stripe
//                          for https://trothenpro.com/api/webhooks/stripe
// Optional:
//   PUBLIC_BASE_URL        where Stripe sends the customer back (default https://trothenpro.com)
//
// How it works, the way Stripe recommends:
// - The customer presses Pay. Trothen asks Stripe for a Checkout page for
//   the exact total and sends the customer there. Card details are typed on
//   Stripe's own secure page; they never touch Trothen's server.
// - Trothen marks the booking paid ONLY when Stripe says so: through the
//   signed webhook (checked with STRIPE_WEBHOOK_SECRET), or by asking Stripe
//   directly when the customer comes back. Never because a page says so.
// - Refunds of card payments go back to the same card automatically.
//
// It talks to Stripe's standard web API with fetch, so no extra package is
// needed. Paying pros out by card (Stripe Connect) is NOT part of this; pros
// are paid out the way Trothen already pays them.
const crypto = require('crypto');

const API = process.env.STRIPE_API_BASE || 'https://api.stripe.com/v1'; // the override is only for automated tests
function isOn() { return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET); }
function baseUrl() { return String(process.env.PUBLIC_BASE_URL || 'https://trothenpro.com').replace(/\/+$/, ''); }

// Stripe takes form-encoded bodies with nested keys like line_items[0][price_data][currency].
function flatten(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? flatten(item, `${key}[${i}]`, out) : out.push([`${key}[${i}]`, String(item)])));
    else out.push([key, String(v)]);
  }
  return out;
}
async function call(method, path, params, idempotencyKey) {
  if (!process.env.STRIPE_SECRET_KEY) throw Object.assign(new Error('Card payments are not switched on.'), { status: 400, expose: true });
  const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
  let body;
  if (params && method !== 'GET') { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(flatten(params)).toString(); }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(API + path, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe answered ${res.status}`;
    throw Object.assign(new Error(`The card payment could not be started: ${msg}`), { status: 502, expose: false, stripe: data && data.error });
  }
  return data;
}

// A Checkout page for one booking. amountUsd is the full total (job + fee).
async function createCheckout({ contract, escrowId, amountUsd, customerEmail, expiresAt }) {
  const cents = Math.round(Number(amountUsd) * 100);
  const expires = Math.floor(Math.min(new Date(expiresAt).getTime(), Date.now() + 23.5 * 60 * 60 * 1000) / 1000); // Stripe allows 30 min to 24 h
  return call('POST', '/checkout/sessions', {
    mode: 'payment',
    client_reference_id: contract.id,
    customer_email: customerEmail || undefined,
    expires_at: Math.max(expires, Math.floor(Date.now() / 1000) + 31 * 60),
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name: `Trothen booking #${contract.bookingNumber || ''}`.trim(), description: String(contract.service || 'Service').slice(0, 200) } } }],
    payment_intent_data: { description: `Trothen booking #${contract.bookingNumber || contract.id}`, metadata: { contractId: contract.id, escrowId } },
    metadata: { contractId: contract.id, escrowId },
    success_url: `${baseUrl()}/?paid=${encodeURIComponent(contract.id)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl()}/?paycancel=${encodeURIComponent(contract.id)}`,
  }, `checkout-${escrowId}`);
}
const getSession = (id) => call('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
const expireSession = (id) => call('POST', `/checkout/sessions/${encodeURIComponent(id)}/expire`, {});
// The idempotency key makes sure the same refund is never sent twice.
const refund = (paymentIntent, cents, key) => call('POST', '/refunds', { payment_intent: paymentIntent, amount: cents, metadata: { reason: 'Trothen booking refund' } }, key);

// Checks a webhook really came from Stripe (the Stripe-Signature header),
// and that it isn't an old one being replayed (5-minute window).
function verifyWebhook(rawBody, header, secret = process.env.STRIPE_WEBHOOK_SECRET, toleranceSec = 300) {
  if (!rawBody || !header || !secret) return null;
  const parts = String(header).split(',').map(p => p.split('='));
  const t = (parts.find(p => p[0] === 't') || [])[1];
  const sigs = parts.filter(p => p[0] === 'v1').map(p => p[1]);
  if (!t || !sigs.length) return null;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
  const ok = sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) return null;
  try { return JSON.parse(rawBody.toString('utf8')); } catch (e) { return null; }
}

module.exports = { isOn, baseUrl, createCheckout, getSession, expireSession, refund, verifyWebhook, flatten };
