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

## Full system audit — this round

You asked for a full audit rather than just moving to the next feature. Here's what that actually meant and what it found.

**A systematic check, not a guess.** I wrote a script that compares every field the code actually saves against the real column list your production database (Postgres) knows about — because this app runs two different datastores (a simple file-based one for local testing, real Postgres live on Render), and a field can exist perfectly well in the code and in local testing while silently never being saved at all in production, with no error, because the database simply doesn't know that column exists. That gap already caused two near-misses earlier this session that I caught by luck; this pass was about finding the ones I hadn't caught yet.

**It found two real, pre-existing bugs — not caused by this session's changes:**
1. **Phone verification could break the moment Twilio Verify is actually turned on.** The app remembers, per verification code, whether that code was sent through Twilio's own verification service or handled locally — because it has to check it back the same way it was sent. That memory was never actually being saved in production. The practical effect: any phone verification sent through real Twilio Verify would have been checked against the wrong thing and incorrectly rejected, the moment that feature was ever actually turned on live.
2. **Promotion emails always showed the wrong count.** When you send a promotional email blast to customers or providers, the app tracks how many people it actually emailed. That count was never being saved in production either — so the "emailed to X people" confirmation would always show blank/zero regardless of how many people actually got it.

Both are now fixed, with the database updates included in this package.

**Also rebuilt: the custom confirmation popups.** Every "are you sure?" moment in the app (canceling a booking, deleting a category, rejecting an application, etc.) had reverted to the browser's own plain gray confirm popup — the kind that can't be styled and that browsers can start silently blocking after a few appear in a row. This was already built properly once before. Rebuilt it across all 13 places it's used, with clear confirm/cancel buttons, click-outside-to-cancel, and destructive actions (deletes) shown in red.

## The three "honest gaps" — revisited and fixed

Three of the four gaps flagged after the audit turned out to be genuinely fixable, not fundamental limitations.

**1. Background push notifications — now real, not partial.** Previously, notifications only made sound/vibration while the app was open in a tab. Now there's a complete push notification system: a real cryptographic keypair (VAPID) that identifies this server to browsers' push services, a subscription system that remembers which of someone's devices want push, and a service worker that actually shows the notification and routes a click back into the right part of the app — even with the browser fully closed. There's a new toggle for it in Settings. **Two new environment variables are needed for this to actually turn on** — see the deploy steps below.

**2. City validation — meaningfully improved, not a full fix.** A complete worldwide city database still isn't realistic. What's now real: a curated list of well-known cities for every state/region in the countries this app actually operates in. It's deliberately one-directional — it will catch someone entering a city that's clearly a well-known match for a *different* country (exactly "Philadelphia" under "Liberia," the original example), but it will never reject a real small town just because it isn't on the list. A stricter check would have started incorrectly blocking legitimate signups from smaller towns, which is a worse problem than the one being solved.

**3. Data Cleanup flagging demo accounts — fixed outright.** The app's own seed/demo accounts (jordan@example.com and the rest) now carry a permanent marker that the cleanup tool explicitly excludes, regardless of transaction history. Previewing a cleanup will no longer list them.

**Google Sign-In's live-testing limitation is unchanged** — that one isn't a code gap, it's a genuine limitation of the environment used to build this (no path to Google's servers to test with). Everything else about it is real and ready; it just needs a real click-through once deployed.

## This round: Joseph's newest reports, worked through one at a time

**Real bugs found and fixed, all tested live:**

- **Membership pricing looked US-only.** The backend never actually blocked other countries — the real problem was the price always showing as a bare "$9.99" with no context. Now it shows the real local-currency equivalent alongside it (e.g. "$9.99 ≈ L$1,898 LRD" for a Liberian customer), using the same currency system already used for job payments.
- **"Contact us doesn't reach administrator."** This was worse than it sounded — messages only ever notified super admins, and there was no admin screen anywhere to actually go review them, just a passing notification. Built the missing review screen, and added an optional city field so a message can route to the right regional team too, not just super admins.
- **Multi-language selection.** Found something worth knowing: a real, already-tested language switcher existed in the code but had been deliberately hidden from view in an earlier round. Since it's being asked for again, it's switched back on — 7 languages, including right-to-left Arabic.
- **Search missed very natural queries.** Searching "plumber" found nothing, because the category is named "Plumbing" and plain text matching doesn't know those are the same word. Added a real, hand-checked list connecting ~90 common everyday search terms (plumber, electrician, cleaner, mover, painter, and so on) to their actual category — tested live and confirmed "plumber" now correctly finds Plumbing-category providers.
- **A real gap found while working on this: the sign-out fix from an earlier round wasn't in this copy of the code.** The upload this round predates that fix, so it was ported back in and re-verified here from scratch — signing out one device now correctly leaves other devices signed in, tested live in this exact codebase.

**Checked carefully and found already working — nothing changed:**
- Rejecting a provider application, cover letters (both the marketplace and job-application kind), and the provider's downloadable payout/tax PDF report all already exist and work.
- Push notifications defaulting to "off" until permission is granted is the correct, expected behavior, not a bug.
- The Data Cleanup tool was tested live and worked correctly — "no eligible accounts" is very likely the honest answer for whatever country was tried, not a malfunction.

**Concluded not worth building:**
- The cookie-consent banner Joseph saw isn't from this app at all — a full search of the codebase found zero references to cookies anywhere. It's almost certainly the browser's own translate feature doing something unrelated.
- "Government services" as a request was too ambiguous to safely guess at, and doesn't need code anyway — any admin can already add a new category directly through the existing Categories panel.

**One housekeeping note:** this round's upload had some things mixed in that don't belong in a source delivery — real uploaded files, local runtime data, and an unrelated project folder that got swept up in the zip. The final package here was rebuilt from just the real source tree.

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

**7a. Generate and set two more environment variables for real push notifications:** `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. These only ever need to be generated once, ever — run this locally and copy both values into Render:
```
node -e "console.log(require('web-push').generateVAPIDKeys())"
```
Optionally also set `VAPID_SUBJECT` to a real contact email (e.g. `mailto:support@trothenpro.com`) — without it, a generic default is used, which is fine but less useful if a push provider ever needs to reach you about a delivery problem. Without any of these set, push notifications are simply disabled (the server logs this clearly on startup) — everything else keeps working normally.

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
8. Turn on push notifications in Settings, close the app entirely (or put the tab in the background on mobile), and have someone trigger a notification for that account (a message, a booking update) — confirm it actually shows up as a real OS-level notification
9. Try signing up with an obviously wrong city/country combination (e.g. a well-known US city under a different country) — confirm it's rejected — and separately with a real but small/less-common town — confirm that one goes through fine
10. Search "plumber" on the homepage and confirm a Plumbing-category provider shows up
11. Sign in on two different browsers, sign out of one, confirm the other stays signed in — then use "Sign out of all devices" in Settings and confirm both end at once
12. Send a Contact Us message with a city filled in, then check that a regional admin for that city can see it in the new Contact Us Messages panel

If anything looks wrong, a screenshot plus what you expected instead is always the fastest way for me to trace it.
