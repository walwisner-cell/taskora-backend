// Liberia mobile money — Lonestar Cell MTN Mobile Money Inc. (LCMMMI).
//
// This is a real, working implementation of MTN's actual, public "MoMo
// Open API" — the same "Open API Platform" LCMMMI's own contract
// language names directly ("successfully setup on the LCMMMI Open API
// Platform"). MTN operates this same API pattern across every market it
// runs Mobile Money in (momodeveloper.mtn.com is the public developer
// portal), so this is built against real, current, cross-verified public
// documentation — not invented. What's still genuinely unknown, and has
// to come from LCMMMI directly once the partner application clears:
// Liberia's specific PRODUCTION base URL and the real subscription
// keys/API user credentials.
//
// RIGHT NOW, NONE OF THIS CAN ACTUALLY REACH MTN — ON PURPOSE. Walter's
// explicit instruction: this stays fully built and ready on Trothen's
// own side, but doesn't touch MTN's real servers — sandbox included,
// not just production — until he says so, even after credentials exist.
// See isLiberiaMoMoEnabled() below: it's a deliberate, separate switch
// from having credentials configured, requires the exact string "true"
// to ever turn on, and every function here that makes a real network
// call checks it independently, not just once at the top. Everything
// else below — the auth flow, the request shapes, the status-check
// pattern — matches MTN's real documented API exactly, and is ready to
// actually try in MTN's own public sandbox the moment it's turned on.
//
// Two genuinely separate MTN "products," each with its own subscription
// key and its own API user/API key pair — this is how MTN's own API is
// actually structured, not a simplification:
//   - Collections: pulls a payment FROM a customer's wallet
//   - Disbursement: pushes a payment TO a wallet
//
// Real commercial terms from LCMMMI's own paperwork, worth keeping in
// mind wherever this gets used: Collections costs LCMMMI a 2% fee per
// payment, taken automatically from Trothen's own collections account;
// Disbursement costs a flat $10/month, drawn from a disbursement account
// that has to be pre-funded through an LCMMMI partner bank before any
// payout can succeed — this is fund-ahead, not pay-as-you-go.

const { currencyForCountry, convertFromUSD } = require('./currency-data');

// ── THE MASTER SWITCH ───────────────────────────────────────────────────
// Walter's explicit instruction: don't let this code touch MTN's real
// servers — sandbox included, not just production — until he says so,
// even after credentials exist and even after the paperwork is done.
// This is deliberately a SEPARATE gate from having credentials set.
// Someone could set every LCMMMI_* credential below while testing
// things out, reviewing the setup, or just getting ready — none of that
// should be enough on its own to let a real network call go out. Only
// this one flag does. It requires the exact string "true" (not "1", not
// "yes", not any other truthy value) specifically so a typo or a stray
// env var can never accidentally turn this on — the safe direction to
// fail in is OFF, always. Every function below that would make a real
// network call checks this FIRST, before it even looks at whether
// credentials exist.
function isLiberiaMoMoEnabled() {
  return process.env.LCMMMI_INTEGRATION_ENABLED === 'true';
}
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://sandbox.momodeveloper.mtn.com'; // MTN's real public sandbox — safe default until real production credentials exist
const BASE_URL = process.env.LCMMMI_BASE_URL || DEFAULT_BASE_URL;
const TARGET_ENVIRONMENT = process.env.LCMMMI_TARGET_ENVIRONMENT || 'sandbox'; // becomes LCMMMI's real environment name once known — see their onboarding docs

function isCollectionsConfigured() {
  return isLiberiaMoMoEnabled() && !!(process.env.LCMMMI_COLLECTIONS_SUBSCRIPTION_KEY && process.env.LCMMMI_COLLECTIONS_API_USER && process.env.LCMMMI_COLLECTIONS_API_KEY);
}
function isDisbursementConfigured() {
  return isLiberiaMoMoEnabled() && !!(process.env.LCMMMI_DISBURSEMENT_SUBSCRIPTION_KEY && process.env.LCMMMI_DISBURSEMENT_API_USER && process.env.LCMMMI_DISBURSEMENT_API_KEY);
}
// Kept for callers that just want "is Liberia mobile money usable at
// all" without caring which specific product. Already reflects the
// master switch above through the two functions it calls.
function isLiberiaMoMoConfigured() {
  return isCollectionsConfigured() || isDisbursementConfigured();
}

// Real access tokens expire in about an hour (MTN's own documented
// behavior) — cached per product so a burst of requests doesn't request
// a fresh token every single time. A 60-second safety margin before the
// real expiry avoids a token expiring mid-request.
const tokenCache = { collection: null, disbursement: null };

async function fetchAccessToken(product) {
  // Second, independent check right at the point a real network call is
  // about to happen — not just trusting that whatever called this
  // already checked isCollectionsConfigured()/isDisbursementConfigured().
  // Belt and suspenders, deliberately, given what's at stake here.
  if (!isLiberiaMoMoEnabled()) {
    throw new Error('Liberia mobile money is not yet enabled (LCMMMI_INTEGRATION_ENABLED is not set to "true") — this is intentional until it\'s explicitly turned on.');
  }
  const cached = tokenCache[product];
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const subscriptionKey = product === 'collection' ? process.env.LCMMMI_COLLECTIONS_SUBSCRIPTION_KEY : process.env.LCMMMI_DISBURSEMENT_SUBSCRIPTION_KEY;
  const apiUser = product === 'collection' ? process.env.LCMMMI_COLLECTIONS_API_USER : process.env.LCMMMI_DISBURSEMENT_API_USER;
  const apiKey = product === 'collection' ? process.env.LCMMMI_COLLECTIONS_API_KEY : process.env.LCMMMI_DISBURSEMENT_API_KEY;

  const basicAuth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
  const res = await fetch(`${BASE_URL}/${product}/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LCMMMI ${product} token request failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  tokenCache[product] = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return data.access_token;
}

// A real Liberian mobile money charge is almost certainly denominated
// in Liberian dollars, not US dollars — reuses the exact same LRD
// conversion already built and working throughout the rest of the app.
// Takes an optional rateOverride so a super admin's own edited LRD rate
// (see src/plan-pricing.js resolveRate, already used everywhere else
// escrow gets funded) is respected here too, instead of silently
// falling back to the static approximate table and drifting from what
// the rest of Trothen actually charges.
function usdToLrd(amountUsd, rateOverride) {
  const currency = currencyForCountry('Liberia'); // always LRD — Liberia's currency doesn't depend on who's asking
  return convertFromUSD(amountUsd, currency.code, rateOverride);
}

// requestMobileMoneyCollection — the real "pull": charges a Liberian
// customer's MTN Mobile Money wallet. msisdn is the customer's mobile
// money phone number (already collected today via the existing
// "mobile_money" payment method type in src/routes/payments.routes.js).
// contractId becomes MTN's externalId, so a later status check or
// webhook can always be matched back to the right booking.
//
// MTN's own API responds 202 Accepted immediately (the request was
// merely ACCEPTED for processing, not completed) — the real outcome
// only becomes known via a follow-up status check or their webhook
// callback, never from this call's own response. Callers must not treat
// a successful return from this function as "the customer paid" — only
// checkCollectionStatus() or a real webhook tells you that.
async function requestMobileMoneyCollection(msisdn, amountUsd, contractId, rateOverride) {
  if (!isCollectionsConfigured()) {
    const reason = !isLiberiaMoMoEnabled()
      ? 'Liberia mobile money is intentionally not yet enabled (waiting on the go-ahead) — see LCMMMI_INTEGRATION_ENABLED in src/liberia-momo.js.'
      : 'Liberia mobile money collections are missing required credentials — see the LCMMMI_COLLECTIONS_* environment variables this needs.';
    return { success: false, error: 'not_configured', message: reason };
  }
  const referenceId = require('crypto').randomUUID();
  const token = await fetchAccessToken('collection');
  const amountLrd = usdToLrd(amountUsd, rateOverride);

  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': process.env.LCMMMI_COLLECTIONS_SUBSCRIPTION_KEY,
      'Content-Type': 'application/json',
      ...(process.env.LCMMMI_CALLBACK_URL ? { 'X-Callback-Url': process.env.LCMMMI_CALLBACK_URL } : {}),
    },
    body: JSON.stringify({
      amount: String(Math.round(amountLrd)),
      currency: 'LRD',
      externalId: contractId,
      payer: { partyIdType: 'MSISDN', partyId: msisdn.replace(/\D/g, '') },
      payerMessage: `Trothen booking ${contractId}`,
      payeeNote: 'Trothen escrow payment',
    }),
  });
  if (res.status !== 202) {
    const body = await res.text().catch(() => '');
    return { success: false, error: 'request_failed', message: `LCMMMI collection request was not accepted: ${res.status} ${body}` };
  }
  return { success: true, referenceId, amountLrd, status: 'PENDING' };
}

// checkCollectionStatus — MTN's requesttopay is async; this is the real
// follow-up call to find out what actually happened. Real statuses per
// MTN's documented API: PENDING, SUCCESSFUL, FAILED.
async function checkCollectionStatus(referenceId) {
  const token = await fetchAccessToken('collection');
  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': process.env.LCMMMI_COLLECTIONS_SUBSCRIPTION_KEY,
    },
  });
  if (!res.ok) throw new Error(`LCMMMI collection status check failed: ${res.status}`);
  return res.json(); // { status: 'PENDING'|'SUCCESSFUL'|'FAILED', ... }
}

// requestMobileMoneyDisbursement — pays a Liberian provider out to their
// MTN Mobile Money wallet. Same async shape as Collections: a 202 here
// means "accepted," not "paid" — check the real outcome with
// checkDisbursementStatus(). Worth remembering LCMMMI's own paperwork:
// the disbursement OVA has to be pre-funded through a partner bank
// before this can ever actually succeed, so a real balance check
// belongs before this is called in production, not just the API call
// itself.
async function requestMobileMoneyDisbursement(msisdn, amountUsd, payoutId, rateOverride) {
  if (!isDisbursementConfigured()) {
    const reason = !isLiberiaMoMoEnabled()
      ? 'Liberia mobile money is intentionally not yet enabled (waiting on the go-ahead) — see LCMMMI_INTEGRATION_ENABLED in src/liberia-momo.js.'
      : 'Liberia mobile money disbursement is missing required credentials — see the LCMMMI_DISBURSEMENT_* environment variables this needs.';
    return { success: false, error: 'not_configured', message: reason };
  }
  const referenceId = require('crypto').randomUUID();
  const token = await fetchAccessToken('disbursement');
  const amountLrd = usdToLrd(amountUsd, rateOverride);

  const res = await fetch(`${BASE_URL}/disbursement/v1_0/transfer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': process.env.LCMMMI_DISBURSEMENT_SUBSCRIPTION_KEY,
      'Content-Type': 'application/json',
      ...(process.env.LCMMMI_CALLBACK_URL ? { 'X-Callback-Url': process.env.LCMMMI_CALLBACK_URL } : {}),
    },
    body: JSON.stringify({
      amount: String(Math.round(amountLrd)),
      currency: 'LRD',
      externalId: payoutId,
      payee: { partyIdType: 'MSISDN', partyId: msisdn.replace(/\D/g, '') },
      payerMessage: 'Trothen payout',
      payeeNote: `Trothen payout ${payoutId}`,
    }),
  });
  if (res.status !== 202) {
    const body = await res.text().catch(() => '');
    return { success: false, error: 'request_failed', message: `LCMMMI disbursement request was not accepted: ${res.status} ${body}` };
  }
  return { success: true, referenceId, amountLrd, status: 'PENDING' };
}

async function checkDisbursementStatus(referenceId) {
  const token = await fetchAccessToken('disbursement');
  const res = await fetch(`${BASE_URL}/disbursement/v1_0/transfer/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': process.env.LCMMMI_DISBURSEMENT_SUBSCRIPTION_KEY,
    },
  });
  if (!res.ok) throw new Error(`LCMMMI disbursement status check failed: ${res.status}`);
  return res.json();
}

module.exports = {
  isLiberiaMoMoConfigured, isCollectionsConfigured, isDisbursementConfigured,
  requestMobileMoneyCollection, checkCollectionStatus,
  requestMobileMoneyDisbursement, checkDisbursementStatus,
  usdToLrd,
};
