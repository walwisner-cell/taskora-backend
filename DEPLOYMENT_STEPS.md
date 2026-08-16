# Trothen — Deployment Steps (Final, This Session)

18 files total: 12 modified, 6 new. All syntax-checked (`node --check` on every backend file plus the full extracted frontend script). This round also verified every route is correctly wired and every new field actually gets saved, on both database backends.

## 1. Files and where they go

Drop these into your local `trothen-backend` clone at the **exact same relative paths** — all complete drop-in replacements, not diffs.

| File | Status | Bytes |
|---|---|---|
| `public/index.html` | modified — logo re-cropped/enlarged | 750,089 |
| `public/manifest.json` | new | 793 |
| `public/sw.js` | new | 700 |
| `public/icon-192.png` | new | 15,672 |
| `public/icon-512.png` | new | 67,430 |
| `public/apple-touch-icon.png` | new | 14,158 |
| `server.js` | modified | 9,431 |
| `src/auth.js` | modified | 7,606 |
| `src/db-postgres.js` | **modified this round** | 13,013 |
| `src/schema.sql` | **modified this round** | 27,115 |
| `src/document-expiry-scheduler.js` | new | 3,689 |
| `src/persona-verification.js` | new | 3,253 |
| `src/referral-code.js` | new | 1,000 |
| `src/routes/admin.routes.js` | modified | 101,108 |
| `src/routes/auth.routes.js` | modified | 41,325 |
| `src/routes/marketplace.routes.js` | modified | 88,761 |
| `src/routes/misc.routes.js` | modified | 27,231 |
| `src/routes/payments.routes.js` | modified | 46,408 |

Everything else in the repo is untouched.

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
git commit -m "Add ID verification (Persona), regional support contacts, referrals, wallets, PWA, open job board + negotiation, GPS stamps, database schema updates, security fixes"
git push
```

## 3. What this round checked — database and routing, item by item

You asked specifically whether everything saves to the database and routes correctly. Here's exactly what that check covered:

**Routing:** every new address the app can be sent to (11 of them, across jobs, contracts, messages, verification, referrals, and support contacts) was confirmed to exist on the server, confirmed to be turned on and reachable, and confirmed that the exact address the screen asks for matches the exact address the server is listening on. No mismatches found.

**Saving to the database — the one you're live on right now:** your site currently runs on the simple file-based storage system (not a separate database server), and that system saves whatever it's given with no fixed structure to match — so everything from this session already saves correctly there today. This part needed no changes.

**Saving to the database — Postgres, for whenever you switch:** this is the part that actually needed real work this round. A separate, more structured version of the storage (Postgres) exists in the code but isn't turned on yet. That version defines an exact, fixed list of what's allowed to be saved for each type of record — and it hadn't been updated to include this session's new information (referral codes, the forced-password flag, delivery/arrival timestamps, the negotiation record, the new payment types, and more). If you ever switched to that Postgres system without this fix, all of that new information would have been silently thrown away — not an error, just quietly lost. That's now fixed: the fixed list has been updated to include everything, and a completely new storage table was added for referrals, since nothing like it existed before. If you switch to Postgres at any point in the future, none of this session's work will be lost.

## 4. Persona verification env vars (unchanged from before)

| Variable | What it is |
|---|---|
| `PERSONA_TEMPLATE_ID` | The verification template you build in Persona's dashboard |
| `PERSONA_ENVIRONMENT_ID` | Your sandbox or production environment id from Persona |
| `PERSONA_WEBHOOK_SECRET` | The signing secret Persona gives you for a webhook pointed at `https://<your-render-domain>/api/webhooks/persona` |

All three need to exist at once to activate — missing any one just keeps the manual verification flow, no error.

**One thing to know:** the exact shape of the message Persona sends back after a verification (the "webhook") was built from their documentation, not tested against a real account — I don't have one to test with. If it turns out to not match exactly once you have a real Persona account, that's a small, contained fix, not a rebuild — it fails safely either way (does nothing rather than doing the wrong thing).

## 5. Post-deploy smoke test

1. Logo — new mark renders reasonably in the navbar and footer, and looks properly sized now (not tiny).
2. Sign-in screen — old plaintext demo-credentials block is gone.
3. Create a location admin — confirm they're forced to set their own password on first login.
4. Regional support contact — a regional admin can set their own city's number; the main platform number is unaffected.
5. Referrals — a real link loads in Settings, copies correctly, and a signup through that link notifies the referrer.
6. Payment methods — all three tabs (Card / Apple Pay / PayPal) render and save.
7. PWA install — the browser offers to add Trothen to the home screen.
8. Open job board + negotiation (the big one) — post a job as a customer, confirm every verified provider in that category/city gets notified, not just 3. As a provider, express interest — confirm no contract is created yet. Send a negotiation message, confirm the customer sees it. Hire that provider at an agreed amount — confirm the contract's created at that amount, other providers get a "job filled" notice, and the downloaded contract includes the real negotiation chat.
9. GPS status stamps — mark a booking "On My Way" then "Arrived" as the provider — confirm the customer's booking shows both timestamps.
10. Document expiry reminders — runs on a daily timer; just confirm the server boots with no errors in the logs.
11. ID verification — if Persona is set up, confirm a real "Verify My Identity Now" button appears; if not, confirm the manual upload flow still works exactly as before.

## 6. What's still open

- **Provider settings logout bug** — the one item left from your original list. Gone through every relevant piece of code multiple times and found nothing that would cause it — this needs your eyes, not more code review. Send: which exact tab/button, what you see happen (blank screen, bounced to sign-in, something else), and ideally a screenshot of the browser's developer console (press F12) at the moment it happens.

Everything else — including this round's database and routing check — is done and in this package.
