# Trothen — Deployment Steps (Final, This Session)

16 files total: 11 modified, 5 new. All syntax-checked (`node --check` on every backend file plus the full extracted frontend script).

## 1. Files and where they go

Drop these into your local `trothen-backend` clone at the **exact same relative paths** — all complete drop-in replacements, not diffs.

| File | Status | Bytes |
|---|---|---|
| `public/index.html` | modified | 687,348 |
| `public/manifest.json` | new | 793 |
| `public/sw.js` | new | 700 |
| `public/icon-192.png` | new | 15,672 |
| `public/icon-512.png` | new | 67,430 |
| `public/apple-touch-icon.png` | new | 14,158 |
| `server.js` | modified | 9,431 |
| `src/auth.js` | modified | 7,606 |
| `src/document-expiry-scheduler.js` | new | 3,689 |
| `src/persona-verification.js` | **new (this round)** | 3,253 |
| `src/referral-code.js` | new | 1,000 |
| `src/routes/admin.routes.js` | modified | 101,108 |
| `src/routes/auth.routes.js` | modified | 41,325 |
| `src/routes/marketplace.routes.js` | modified | 88,761 |
| `src/routes/misc.routes.js` | **modified again this round** | 27,231 |
| `src/routes/payments.routes.js` | modified | 46,408 |

Everything else in the repo is untouched — same list as before.

## 2. cmd.exe deploy steps

```
cd path\to\trothen-backend
dir public\index.html
dir server.js
dir src\auth.js
dir src\document-expiry-scheduler.js
dir src\persona-verification.js
dir src\referral-code.js
dir src\routes\admin.routes.js
dir src\routes\auth.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\misc.routes.js
dir src\routes\payments.routes.js
dir public\manifest.json
dir public\sw.js
dir public\icon-192.png
dir public\icon-512.png
dir public\apple-touch-icon.png
```

Compare against the table above, then:

```
git add .
git commit -m "Add ID verification (Persona), plus regional support contacts, referrals, wallets, PWA, open job board + negotiation, GPS stamps, security fixes"
git push
```

## 3. New this round — ID verification is real, but off until you configure it

This app's identity verification was fully manual/simulated before (an admin just toggles a checkbox — no real ID check happens). It now supports a **real** integration with Persona, a live ID/selfie verification vendor — but it stays exactly as manual as it is today until you actually set it up. Nothing breaks or changes if you skip this section.

**To turn it on**, in Render → `trothen-api` → Environment, add:

| Variable | What it is |
|---|---|
| `PERSONA_TEMPLATE_ID` | The verification template you build in Persona's dashboard (what it checks — government ID + selfie match, etc.) |
| `PERSONA_ENVIRONMENT_ID` | Your sandbox or production environment id from Persona |
| `PERSONA_WEBHOOK_SECRET` | The signing secret Persona gives you when you set up a webhook endpoint pointed at `https://<your-render-domain>/api/webhooks/persona` |

All three need to exist at once for it to activate — with any one missing, customers/providers just see the same manual upload flow as today (no error, no broken state).

**One thing I need to be honest about:** I built this against Persona's two most stable, well-documented API surfaces — their Hosted Flow (a plain URL, no server-to-server call needed to start a verification) and their webhook signature scheme (HMAC, same pattern as Stripe's). Those two pieces I'm confident are correct. What I could **not** verify without a real Persona sandbox account is the exact JSON shape of the webhook payload itself (`src/routes/misc.routes.js`, the `POST /webhooks/persona` handler) — Persona's docs describe this, but field nesting in real API payloads sometimes differs slightly from documentation, and I have no way to test against a live payload here. The code fails safe either way (an unexpected shape just means it does nothing rather than acting incorrectly), so this won't break anything — but once you have a real Persona sandbox account, send a test verification through and check your server logs / Persona's webhook delivery log (they let you view and replay actual payloads) to confirm the field paths match. If they don't, that's a quick, contained fix in one function, not a rebuild.

## 4. Post-deploy smoke test

Same list as before, plus:

11. **ID verification** — if you've set up Persona: as a customer/provider, open Verification and confirm a real "Verify My Identity Now" button appears (not the manual upload boxes). If you haven't set up Persona: confirm the manual upload flow still works exactly as before. Either way, nothing should error.

(Full list 1–10 from the prior deployment doc still applies — logo, sign-in screen, forced password change, regional support contact, referrals, payment methods, PWA install, open job board + negotiation, GPS stamps, document expiry reminders.)

## 5. What's still open

- **#15 Provider settings logout bug** — the only item left from your original list. I've now gone through every relevant code path multiple times across this whole session and found nothing that would cause it — I don't want to guess-patch this blind since a wrong fix could mask the real bug. This one genuinely needs your eyes: which exact tab/button, and what you see happen (blank screen, bounced to sign-in, something else). A browser console screenshot (F12) at the moment it happens would let me find the actual line of code instead of guessing.

Everything else from the original 16-item list — including #9, closed out this round — is done and in this package.
