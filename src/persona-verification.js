const crypto = require('crypto');

// Real Persona integration, off by default until you actually have a
// Persona account. Two env vars turn it on:
//   PERSONA_TEMPLATE_ID       — the verification template you build in
//                               Persona's dashboard (what documents/checks
//                               it asks for)
//   PERSONA_ENVIRONMENT_ID    — sandbox or production environment id
// A third, PERSONA_WEBHOOK_SECRET, is required separately to actually
// trust results coming back (see verifyWebhookSignature below) — without
// it, webhook results are rejected rather than trusted blindly.
//
// This deliberately uses Persona's Hosted Flow (a plain URL Persona's own
// page reads directly — https://docs.withpersona.com/docs/hosted-flow) to
// start a verification, not their inquiry-creation REST endpoint. Hosted
// Flow's URL shape has been stable for years and needs no server-to-server
// call to start; the inquiry-creation API surface changes more often and
// isn't something worth guessing at without a real account to test
// against. The tradeoff: this app finds out the result only via webhook,
// not by polling — which is fine, since Persona's own hosted page already
// tells the person the outcome in real time.
function isPersonaConfigured() {
  return !!(process.env.PERSONA_TEMPLATE_ID && process.env.PERSONA_ENVIRONMENT_ID);
}

function isPersonaWebhookConfigured() {
  return !!process.env.PERSONA_WEBHOOK_SECRET;
}

// referenceId is Trothen's own user id — Persona echoes it straight back
// on the webhook event, which is what ties a real-world verification
// result back to a specific account with no extra lookup table needed.
function buildHostedFlowUrl(referenceId) {
  const params = new URLSearchParams({
    'inquiry-template-id': process.env.PERSONA_TEMPLATE_ID,
    'environment-id': process.env.PERSONA_ENVIRONMENT_ID,
    'reference-id': referenceId,
  });
  return `https://withpersona.com/verify?${params.toString()}`;
}

// Persona signs webhooks as `Persona-Signature: t=<timestamp>,v1=<hash>`,
// where hash = HMAC-SHA256(webhookSecret, `${timestamp}.${rawBody}`) —
// same general scheme as Stripe's webhook signing. Requires the RAW
// request body (before JSON parsing mutates it), which is why server.js
// captures req.rawBody via express.json()'s verify callback.
function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=')).filter(p => p.length === 2)
  );
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  // Constant-time comparison — a signature check that leaks timing
  // information is a real, if narrow, attack surface.
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(parts.v1, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

module.exports = { isPersonaConfigured, isPersonaWebhookConfigured, buildHostedFlowUrl, verifyWebhookSignature };
