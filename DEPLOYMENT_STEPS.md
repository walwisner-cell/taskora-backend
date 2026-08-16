# Trothen — Deployment Steps (Final)

18 files total: 13 modified, 5 new. Every backend file re-checked for syntax errors, and every file below matches what's actually in the package.

## 1. Files and where they go

Drop these into your local `trothen-backend` clone at the **exact same relative paths** — all complete drop-in replacements, not diffs.

| File | Status | Bytes |
|---|---|---|
| `public/index.html` | **modified again — see section 3 below** | 752,089 |
| `public/manifest.json` | new | 793 |
| `public/sw.js` | new | 700 |
| `public/icon-192.png` | new | 15,672 |
| `public/icon-512.png` | new | 67,430 |
| `public/apple-touch-icon.png` | new | 14,158 |
| `server.js` | modified | 9,431 |
| `src/auth.js` | modified | 7,606 |
| `src/db-postgres.js` | modified | 13,013 |
| `src/schema.sql` | modified | 27,115 |
| `src/document-expiry-scheduler.js` | new | 3,689 |
| `src/persona-verification.js` | new | 3,253 |
| `src/referral-code.js` | new | 1,000 |
| `src/routes/admin.routes.js` | modified | 101,108 |
| `src/routes/auth.routes.js` | modified | 41,325 |
| `src/routes/marketplace.routes.js` | modified | 88,761 |
| `src/routes/misc.routes.js` | modified | 27,231 |
| `src/routes/payments.routes.js` | modified | 46,408 |

## 2. cmd.exe deploy steps

```
cd path\to\trothen-backend
dir public\index.html
dir server.js
dir src\auth.js
dir src\db-postgres.js
dir src\schema.sql
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
git commit -m "Add safety net for the settings logout issue, plus ID verification, referrals, wallets, PWA, open job board, GPS stamps, database schema updates"
git push
```

## 3. About the logout problem — what actually changed this round

I went through the code again, from a new angle: checked every place the server could suspend an account or invalidate a session, and traced it all the way through the settings-save process. None of it touches those triggers. That rules out the last real theory I had.

Since more code-reading wasn't finding it, I added something that will actually help: **every dashboard section now has a safety net.** If a section ever hits an error while loading — instead of the screen going blank or looking broken (which looks exactly like getting logged out, even though it isn't one), it now shows a plain message on screen that says "you're still signed in, this is a display problem" along with the actual technical error underneath it.

Two things this gets you:

- If this *was* the cause of what you're seeing, it's fixed now — you'll see a real message instead of a blank/broken screen.
- If it happens again for any other reason, you can screenshot that on-screen error and send it to me. That turns "I don't know what's happening" into an exact line of code I can go fix — the difference between guessing and actually solving it.

This doesn't touch your sign-in state at all either way, so it can't make anything about signing in or out behave differently than it already does.

## 4. Persona verification env vars (unchanged)

| Variable | What it is |
|---|---|
| `PERSONA_TEMPLATE_ID` | The verification template you build in Persona's dashboard |
| `PERSONA_ENVIRONMENT_ID` | Your sandbox or production environment id from Persona |
| `PERSONA_WEBHOOK_SECRET` | The signing secret Persona gives you for a webhook pointed at `https://<your-render-domain>/api/webhooks/persona` |

All three need to exist at once to activate — missing any one just keeps the manual verification flow, no error.

## 5. Post-deploy smoke test

1. Logo — renders properly sized in the navbar and footer.
2. Sign-in screen — old plaintext demo-credentials block is gone.
3. Create a location admin — forced to set their own password on first login.
4. Regional support contact — a regional admin can set their own city's number.
5. Referrals — a real link loads in Settings and copies correctly.
6. Payment methods — Card / Apple Pay / PayPal tabs all render and save.
7. PWA install — the browser offers to add Trothen to the home screen.
8. Open job board + negotiation — post a job, confirm every verified provider in that category/city gets notified. Express interest as a provider, confirm no contract yet. Negotiate by message, then hire — confirm the contract's created at the agreed amount and the PDF includes the real chat.
9. GPS status stamps — mark a booking "On My Way" then "Arrived," confirm both show up on the customer's side.
10. Document expiry reminders — confirm the server boots with no errors in the logs.
11. ID verification — confirms either the real Persona flow (if set up) or the manual flow (if not).
12. **The settings logout issue** — go back through provider settings the way you normally would when it happens. If it still happens, you should now see the on-screen error message described in section 3 instead of a blank/broken screen — screenshot it and send it over.

## 6. What's still open

The logout problem itself isn't confirmed fixed — I couldn't find its actual cause through the code, so what shipped this round is a safety net, not a guaranteed fix. If step 12 above still shows something going wrong, the new error message on screen is what gets this closed out for real.

Everything else from your original list is done.
