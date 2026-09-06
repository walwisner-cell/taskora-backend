// Google Sign-In — verifies the ID token Google's own Identity Services
// button hands back to the browser, and never trusts anything the client
// sends about who the person is. The ID token itself is a signed JWT from
// Google; verifyIdToken checks that signature against Google's public
// keys and confirms it was actually issued for *this* app (the audience
// check against GOOGLE_CLIENT_ID), so a forged or replayed token from a
// different site can't be used to log into a Trothen account.
const { OAuth2Client } = require('google-auth-library');

function isGoogleConfigured() {
  return !!process.env.GOOGLE_CLIENT_ID;
}

const client = isGoogleConfigured() ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Returns { email, name, sub } for a valid, verified token. Throws a
// plain Error with a message safe to show the person directly if the
// token is missing, expired, forged, meant for a different app, or
// belongs to an email Google itself hasn't confirmed.
async function verifyGoogleIdToken(idToken) {
  if (!isGoogleConfigured()) {
    throw new Error('Google sign-in is not configured on this server yet.');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Google credential.');
  }
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  } catch (e) {
    throw new Error('Could not verify Google sign-in — please try again.');
  }
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Google did not return an email address for this account.');
  }
  if (!payload.email_verified) {
    throw new Error('Google has not verified this email address yet.');
  }
  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    sub: payload.sub,
  };
}

module.exports = { verifyGoogleIdToken, isGoogleConfigured };
