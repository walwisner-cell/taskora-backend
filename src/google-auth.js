// Verifies a Google ID token server-side using Google's own library —
// never trusts a client-supplied payload directly. The library fetches
// Google's public signing keys itself and checks the token's signature,
// issuer, audience (must match our own GOOGLE_CLIENT_ID), and expiry.
// A token that fails any of those checks throws, which callers below
// turn into a clean rejection rather than a crash.
const { OAuth2Client } = require('google-auth-library');

function isGoogleSignInConfigured() {
  return !!process.env.GOOGLE_CLIENT_ID;
}

const client = isGoogleSignInConfigured() ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Returns { googleId, email, emailVerified, name } on success, or null on
// any failure (expired token, wrong audience, tampered signature, Google
// sign-in not configured at all). Deliberately swallows the underlying
// error rather than propagating it — the caller only ever needs to know
// "valid" or "not valid," and logging the raw error is enough for our
// own debugging without leaking verification internals in an API
// response.
async function verifyGoogleIdToken(idToken) {
  if (!client || !idToken) return null;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) return null;
    return {
      googleId: payload.sub,
      email: payload.email,
      // Google only issues a token for an address it has already
      // confirmed belongs to the account signing in — but this flag is
      // still checked explicitly rather than assumed, since Google's own
      // docs describe it as something a relying party should verify.
      emailVerified: payload.email_verified === true,
      name: payload.name || payload.email.split('@')[0],
    };
  } catch (e) {
    console.error('[google-auth] ID token verification failed:', e.message);
    return null;
  }
}

module.exports = { isGoogleSignInConfigured, verifyGoogleIdToken };
