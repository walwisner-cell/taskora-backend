# Trothen — This Session's Changes & Deployment Notes

I'm writing this in plain language so you have a real record of what changed, why, and what (if anything) you need to do on your end beyond deploying the code.

## The big thing to know first

The package you uploaded to start this session was an older snapshot — it was missing a few things that were already built and confirmed working in earlier sessions: the password policy had reverted to an old, overly strict rule, the custom confirm-dialog popups were gone (back to plain browser popups), and the real identity-document upload system was missing entirely (it had regressed back to only storing a text label, no actual file). I rebuilt all of that this session. If you've deployed anything between when that earlier work was done and now, it's worth comparing what's actually live on Render against this package before assuming everything else is current — I only caught what I happened to touch or test.

## Everything that changed, plain language

**Real bugs fixed:**
- Regional administrator password requirements — restored to a sane 8-72 character rule (this was almost certainly your "reset password requirements" complaint)
- The core booking bug — customers hiring a provider off a job posting used to go straight to "active" with escrow funded, before the provider had actually confirmed. Now it correctly waits for the provider to accept, exactly like a direct booking does.
- Automatic job reassignment — if a selected provider declines or doesn't respond in time, the job now automatically goes to the next available candidate at the same price, instead of just dying and leaving the customer to start over.
- Notification sound only ever played for chat messages — a provider's "you got a job" alert and a customer's "provider arrived" alert never made a sound. Fixed, plus notifications now sort newest-first and poll every 5 seconds again (this had also quietly reverted to 20 seconds).
- Regional managers couldn't see verification documents or guarantors — the permission logic was actually already correct, the document-viewing route itself just didn't exist. Built it.

**The 16-item list, fully implemented:**
1. Customer arrival notification — sound, vibration, sorts to the top
2. Provider ringtone for job offers — same sound/vibration fix as above
3. Cover letter — providers can attach a short note when expressing interest
4. Contract status — fixed as part of the core booking bug above
5. High-score reward — 90+ trust score earns 2 real commission-free jobs
6. Mandatory profile picture — enforced before a provider shows up in search or matching
7. ID name matching — real comparison between account name and the ID's legal name, routes mismatches to manual review instead of silently blocking or passing
8. Address & location — already existed; confirmed working
9. Provider score & job access — replaced the old all-or-nothing cutoff with your exact weekly tier table (90+ unlimited down to 0-19 suspended)
10. Automatic job reassignment — see above
11. Customer booking status — see above
12. Document verification & rejection — real file upload, Pending/Approved/Rejected/Review Required states, required rejection reasons
13. Data management & cleanup — a real tool to clear untouched test accounts under a country, with a typed confirmation phrase and a permanent audit log. **This is what actually lets you delete a country now** — it was already correctly refusing to delete Liberia because real accounts exist under it; this tool clears the ones with zero real transaction history first.
14. Super Admin Dispute Actions — request info, escalate, reject, close, reopen, all with a real permanent audit trail, restricted to super admin
15. Country/region validation — state is now checked against country at signup (city stays free-text on purpose — there's no real city database behind this app, so that specific check isn't technically possible without a much bigger project)
16. Administration Announcement Center — compose and send announcements with priority levels, target specific regions or everyone, schedule for later, and real read-tracking per admin

## What I decided on your behalf (per your "use good judgment" instruction)

For item 9 (weekly job tiers), I made four calls rather than waiting on you:
- "A job" = a new match shown to the provider, not a completed job
- Resets on a rolling 7 days, not a fixed calendar week
- A capped-out provider just stops appearing in new matches until back under the cap — no separate flagging UI
- Brand new/unrated providers get a flat 15/week starting allowance

## Google Sign-In — rebuilt this round

You uploaded a second, older zip (`trothen-updates_22_.zip`) and asked me to check it for anything worth merging. I diffed it file-by-file against everything built this session — it's strictly older than what you already have, nothing in it needs to come across. But that comparison is what surfaced this: **Google Sign-In wasn't in that zip, and it wasn't in the current codebase either.** It had been fully built and confirmed working in an earlier session, so this is the same kind of quiet regression as the password policy and the document upload system — I rebuilt it from what I know worked before.

- Real Google button on the login/signup screen (replaces the old placeholder that just showed a "not connected yet" toast); the Facebook placeholder button is gone entirely
- Signing in with Google either logs you straight into an existing account (auto-linking it the first time, if the Google email matches one you already have) or, if no account exists yet, drops you into a shortened signup form with your name and email locked in from Google and no password field — email is already verified by Google, so there's no code-entry step needed
- The popup-breaking Cross-Origin-Opener-Policy issue from before is fixed again too — Helmet's default header silently breaks Google's popup flow, and this had reverted along with everything else

**I could only partially test this one.** Real Google-token verification needs to reach Google's own servers, which this sandbox's network rules don't allow — so I confirmed the code fails cleanly (a proper error, not a crash) when it can't reach Google, and confirmed nothing else broke, but I could not run an actual successful Google sign-in end to end the way I tested everything else this session. You'll want to genuinely click through it once this is live.

## Honest gaps — things I did NOT build

- **True background push notifications.** What I built makes sound/vibration work while the app is open. Real notifications that fire when the app is closed need actual push infrastructure (VAPID keys, a subscription flow) that doesn't exist in this codebase at all. I didn't want to half-build this and call it done.
- **The Data Cleanup tool will also flag your own seed/demo accounts** (jordan@example.com, marcus@example.com, etc.) as eligible if they have zero transaction history in a given database — because there's no way to tell "a seed demo account" apart from "an abandoned test signup" except by whether it's ever actually been used. This is working exactly as designed (protect anything with real history, nothing else), just worth knowing before you run it on a fresh database.
- **City-level geo validation** (item 15's literal "Philadelphia can't be listed under Liberia" example) isn't fully possible — only country/state is checked, since city is deliberately free-text with no real database behind it.

## Deployment (cmd.exe)

This is a complete repo package — everything in `src/`, `public/`, `server.js`, plus a new `schema.sql` migration and one new file (`src/announcement-scheduler.js`).

**First, confirm your real data survives — don't skip this:**
```
cd path\to\trothen-backend
dir data
dir node_modules
```
Both should show real content. If either is empty or missing, stop and check you're in the right folder before continuing.

**1. Extract the new package into a separate folder first:**
```
cd path\to\where\you\downloaded\it
tar -xf trothen-v16-FINAL.zip
dir code-final
```

**2. Copy everything over — `data/`, `uploads/`, `node_modules/`, and `.git/` are never touched because they're not in this folder at all:**
```
xcopy code-final\src path\to\trothen-backend\src /E /Y
xcopy code-final\public path\to\trothen-backend\public /E /Y
copy code-final\server.js path\to\trothen-backend\server.js /Y
copy code-final\package.json path\to\trothen-backend\package.json /Y
```

**3. Verify the two biggest files actually copied completely — compare byte sizes against the source:**
```
dir code-final\public\index.html
dir path\to\trothen-backend\public\index.html
dir code-final\src\routes\admin.routes.js
dir path\to\trothen-backend\src\routes\admin.routes.js
```
The byte counts on each pair should match exactly. If they don't, the copy didn't finish — re-run the `xcopy`/`copy` command for that file before going further.

**4. Install the one new dependency this round (`google-auth-library`, for real Google token verification):**
```
npm install
```

**5. Sanity check before deploying:**
```
node --check server.js
```
Silence = success. A red error means stop and send it to me before pushing.

**6. Confirm your Google OAuth Client ID is still set on Render:** `GOOGLE_CLIENT_ID` — this should already be set from the earlier session where Google Sign-In was first built, but worth double-checking now given it went missing from the code itself. If it's not set, the Google button simply won't appear (the app checks for this and hides it cleanly rather than showing a broken button) — nothing else breaks either way.

**7. Set one new environment variable on Render, if it isn't already set:** `PRIVATE_UPLOADS_DIR` — a path on your persistent disk (e.g. `/var/data/private-uploads`), separate from your existing `UPLOADS_DIR`. This is where real identity documents now actually get saved. If you skip this, the server still runs, but uploaded ID documents won't survive a redeploy or restart — the server logs a warning about this on startup if it's missing, so you'll see it.

**8. Commit and push:**
```
git add .
git commit -m "Password policy fix, booking confirmation fix, auto-reassignment, weekly job-access tiers, document verification rebuild, dispute actions, data cleanup, announcements"
git push
```
Render picks this up automatically.

**9. Database migration — no manual SQL needed.** The new tables and columns (`dispute_audit_log`, `announcements`, `data_cleanup_audit_log`, plus new columns on `verifications` and `matches`) are created automatically the moment the server starts, using `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` — safe to run against your live database with real data in it. Just watch the Render deploy log for any red errors during startup.

## Post-deploy smoke test

1. Log in as a regional admin, try creating another admin with a long passphrase-style password (should work now)
2. Post a job as a customer, have a provider express interest with a cover letter, select them — confirm the contract shows "Awaiting Confirmation," not active, until the provider actually confirms
3. As super admin, go to Data Cleanup, preview a country, confirm it shows exactly who's eligible before you type anything
4. As super admin, send an announcement — confirm a regional admin sees and can acknowledge it
5. Open a dispute as super admin, try Escalate, confirm the audit trail shows it
6. As a provider with no profile picture, confirm you don't show up in search until you add one
7. **Click the actual Google button and sign in for real** — this is the one thing I couldn't test myself this round. Try it with an email that already has a Trothen account, and separately with a Google account that doesn't, and confirm both the login and the signup paths actually work

If anything looks wrong, a screenshot plus what you expected instead is always the fastest way for me to trace it.
