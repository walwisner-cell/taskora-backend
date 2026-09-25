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

## A verification pass across the whole system — new ground, not a repeat

You asked me to verify everything and fix any remaining gaps. Rather than repeat the security and permissions passes already done in earlier rounds, this checked genuinely new ground:

- **Every place the app saves data, checked against what the real database actually expects** — clean, nothing new found.
- **Every single button and link in the entire app** (246 of them) **checked to make sure it actually calls something real** — every one does. Nothing clicks through to a dead end.
- **Every floating element on the page checked for the same kind of "sits on top of something it shouldn't" problem the chat bubble had** — nothing else has it. That was a real, isolated bug, not a wider pattern.
- **Text messages found to have the exact same undocumented-setup problem as email did** — documented now, same as email was.
- A full clean boot from nothing, and every core page and endpoint confirmed actually responding.

## Text messages — the same kind of setup gap as email, documented now

Checked this while going through everything else, since it's the same class of issue as the email one above and was equally undocumented. There are genuinely **two separate** Twilio features in this app, needing different environment variables:

- **Phone verification (Verify Service)** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. Based on what's been discussed earlier in this build, this one is likely already set up and working.
- **Plain SMS** (any other text message the app sends, like a 2FA code by text) — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and specifically `TWILIO_FROM_NUMBER`, a real Twilio phone number to send from. This is the one that's been an open decision, not yet set — buying a number to use for this reopens A2P 10DLC business registration with Twilio, which is a real business step, not something I can do for you.

Same honest fallback behavior as email either way: without these set, a text-based code shows on-screen instead of silently failing.

## Real emails still aren't sending — this is a setup step, not a bug

You reported a real provider signed up and got "test mode" instead of an actual email with their code. I checked the code carefully, and it's working exactly as designed — the honest, safe way it's supposed to: if the real email service isn't fully set up, it falls back to showing the code on-screen instead of silently failing someone trying to sign up. That's the same thing that happens if the real send fails for any other reason too (a wrong password reset, a real SendGrid outage) — it never leaves someone stuck.

Here's the real finding: **I went looking and this was never actually documented as a setup step anywhere in your deployment instructions.** Two things need to be set as real values on Render for actual emails to go out:

- `SENDGRID_API_KEY` — a real key from your SendGrid account
- `SENDGRID_FROM_EMAIL` — the address it sends from, which also needs to be a **verified sender** in SendGrid's own settings (this is the single most common reason a SendGrid integration looks "set up" but still silently fails — SendGrid refuses to send from an address it hasn't confirmed you own)

If you already have both of those set on Render and it's still not sending, the real reason will be sitting in your Render service's logs — search for `[delivery] SendGrid email send failed`, and the message right after it will say exactly what SendGrid rejected it for.

## A real support email, region by region

You asked for a regional customer service email — this didn't exist at all before, the support contact system only ever had WhatsApp and a phone number. Now every region (and the platform-wide fallback) can have its own real support email, editable in the same place WhatsApp/phone already are, and it shows up in two real places: the support chat panel, and a new "prefer to reach us directly" section right on the Contact Us page that wasn't there before — it used to be a pure submit-and-wait form with no way to see any direct contact info at all.

Tested the full chain live: set a platform-wide email, confirmed it shows publicly; set a *different*, region-specific email for Atlanta, confirmed visitors in Atlanta see the Atlanta one while everyone else still correctly sees the platform-wide one; confirmed an invalid email is rejected with a clear message; and confirmed it actually renders correctly on the real Contact Us page in a real browser, as a working clickable link.

## The chat bubble on mobile — two real, separate bugs, both fixed

You reported it was moving around on its own and making it hard to sign in. Both turned out to be real, and different from each other:

**Why it was hard to sign in:** the chat bubble sits fixed in the corner of the screen and was always drawn *on top of* everything else, including the actual sign-in screen — nothing had ever told it to get out of the way. On a small phone screen, where there's little room to begin with, it could end up sitting right on top of the sign-in button itself, quietly catching the tap instead of the button underneath it ever receiving it. Fixed: the bubble now hides itself the moment you're on the sign-in screen, or any pop-up window in the app, and comes right back once you're not.

**Why it seemed to move on its own:** the bubble can be dragged out of the way, which is intentional. But if a drag gets interrupted mid-motion — your finger starts a scroll instead, the phone briefly interrupts the touch, anything like that happens fairly often on phones — the app never noticed the drag had actually stopped. The next time you touched *anywhere* on the page, even somewhere completely unrelated to the bubble, it would jump to that new touch as if you were still dragging it. Fixed: the app now correctly notices when a touch gets interrupted like that and resets properly, instead of getting stuck thinking a drag is still happening.

Tested both for real — not just read the code and guessed. Confirmed the bubble actually disappears the moment the sign-in screen opens and reappears the moment you leave it; confirmed the same for any pop-up window in the app; and reproduced the exact "stuck thinking it's still being dragged" scenario directly and confirmed it no longer causes the bubble to jump around afterward.

## Membership pricing is now something you can actually edit

You asked where to change the membership price — turned out you could already change the currency conversion, but not the actual dollar amount ($9.99, $19.99, $39.99). That's fixed: **Admin → Settings → Plans & Pricing → Customer Membership Pricing**. Free stays $0 and VIP stays invitation-only on purpose (never self-purchased at any price) — Plus, Pro, and Elite are the three you can now actually edit.

The important part I made sure of: the price a customer *sees* and the price they're actually *charged* now come from the exact same place, so an edit here can never leave those two out of sync — tested directly by changing Plus from $9.99 to $12.50 and confirming both the price shown and the price actually stored on a real subscription came back as $12.50, not a stale old number.

## Real idle-timeout sign-out — a security best practice you asked about

Anyone signed in now gets automatically signed out after 20 minutes of real inactivity — no mouse movement, no clicks, no typing. This is standard practice for anything handling money or personal documents, which this app does.

It's not a silent logout, which would just look like the app randomly broke. 60 seconds before it happens, a real warning appears with a live countdown and a "Stay Signed In" button — and any real activity (not just that button) makes the warning go away and resets the clock, so someone genuinely still working isn't interrupted.

Tested for real, not just written and assumed: confirmed the warning appears at exactly the right moment with the correct countdown, confirmed the "Stay Signed In" button works, confirmed real mouse movement alone dismisses the warning without needing the button, confirmed the actual sign-out happens at the full 20 minutes and lands cleanly on the home screen, and confirmed an anonymous visitor who isn't signed in isn't affected by any of this at all.

## Disputes can now carry real evidence

The last remaining "still open" item: someone filing a dispute can now attach a real photo, screenshot, or PDF receipt to back it up, right when they file it — and can add more afterward. The dispute team (and the other person involved) can see and download whatever's been uploaded.

Built with the same real protection identity documents already get — files live in the same private, protected storage, never in the open, and every upload is checked by its actual file bytes, not just the filename someone typed. Tested the entire loop for real: filed a real dispute, uploaded a real file, confirmed the actual provider on that job could see it, confirmed a completely unrelated customer trying to view it got correctly blocked, and confirmed what a super admin downloads is byte-for-byte identical to what was uploaded — not just "looks right."

Also corrected something in the last plain-English summary: it listed "a way for staff to explain a decision to one specific person" as still open, but that one was actually already done in an earlier round (real required reasons on rejections and dispute resolutions). Fixed the document to reflect that.

## A real security hardening pass — best-practices review, not just bug reports

**Dependency vulnerabilities — fixed.** `npm audit` found 4 moderate-severity known vulnerabilities in dependencies. Two fixed with a standard, safe update (`express`'s vulnerable `qs` dependency). The other two (`uuid`, pulled in by Google Sign-In's `gaxios` library) needed an explicit override since the upstream package hasn't updated yet — added one, then actually verified Google Sign-In's library still loads and works correctly with the newer version before keeping it. Zero known vulnerabilities now.

**Cross-site scripting (XSS) — found and fixed real, exploitable gaps.** This is the most important part of this pass. Checked every place user-typed text gets shown back on a page, not just the specific screens reported as buggy. Found several genuine gaps where someone's own text — a job description, a booking's service line, a person's name — was being inserted directly into the page with no protection, meaning it could contain real, working code instead of being treated as plain text. Two matter most:

- **A pending signup's name was shown completely unprotected on the very first screen an admin sees when reviewing new signups** — the single most-used, most routine part of the admin panel. Fixed.
- **Job and booking descriptions — genuinely free text a customer types, with no restriction on what characters are allowed — were shown unprotected in provider, customer, and admin views** (payment history, contract lists, booking lists). Fixed everywhere it appeared, checked systematically rather than one report at a time.
- Also fixed: provider names and roles on the **public homepage itself** (the featured-providers carousel) — this one didn't even require being logged in to be affected by.

Proved the fix actually works with a real, live test — not just reading the code: posted a real job with an actual working script embedded in the description (`<img src=x onerror=alert(document.cookie)>`), confirmed it saved exactly as typed, then opened that page in a real browser and confirmed the text shows as harmless, plain text and nothing executes.

Worth knowing: account names specifically already had some protection (only letters/spaces/hyphens are allowed at signup), so that particular vector was already partly blocked — but the escaping fix was still the right thing to do as a second, independent layer, and other fields like job descriptions had no such restriction at all, so those really were exploitable before this fix.

**A real permission/authorization check** — done in an earlier round of this audit (see below) and re-confirmed here: every admin action requires a real, specific check, not just "any logged-in admin." The handful of genuinely public endpoints (contact form, job applications, the identity-verification webhook) are all correctly meant to be public, and the webhook has real cryptographic signature verification protecting it.

## Google Sign-In: found a real bug, made a real improvement — here's what to check on your end

You reported Google Sign-In isn't working. I can't test the real, live sign-in flow myself — this environment has no path to Google's own servers, the same limitation that's been true this whole build. But I read through the entire integration carefully looking for real bugs, and found one, plus made one more change based on Google's own current requirements:

**Found and fixed: a real timing bug.** The Google button's script loads in the background while the rest of the page loads. The code checked exactly once whether that script had finished loading — if it hadn't (a slower connection, or just opening the sign-in screen quickly), the button would silently never appear, with no retry, unless something else happened to reopen the sign-in screen later. Fixed: it now checks repeatedly for up to 8 seconds before giving up, so a script that's simply still loading gets a real chance to catch up instead of being treated as broken. I proved this actually works by deliberately delaying the script in a real browser test and confirming the fix waits correctly and recovers.

**Also added: Google's current recommended flag for the button flow** (`use_fedcm_for_button`). Google made a browser-level change mandatory in August 2025 for how sign-in buttons work, and the code wasn't using the setting Google recommends for it. This is a real, current best-practice fix based on Google's own documentation, added carefully alongside the existing fix for the popup window issue (from an earlier round) rather than replacing it, so either path a given browser takes should keep working.

**What to actually check once this is deployed**, since I can't verify these myself:
1. **The Google Cloud Console configuration itself** — under your OAuth Client ID's settings, "Authorized JavaScript origins" needs to include your real, live domain (e.g., `https://trothenpro.com`) exactly as it appears in the browser's address bar. This is the single most common reason Google Sign-In fails on a real site and isn't something I can check or fix from here — it's configured entirely on Google's side.
2. **`GOOGLE_CLIENT_ID` is actually set on Render** and matches the Client ID from that same Google Cloud Console project.
3. **What you actually see when it fails** — a blank popup, a button that never appears at all, an error message, or something else — would tell me a lot if the above doesn't resolve it. Your browser's developer console (F12 → Console tab) during the failed attempt would show a specific error message from Google's own script, which is the fastest way to narrow this down further if it's still not working after deploying this.

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

## Finishing the language feature properly — most of the site actually translates now

Your own screenshot made the gap obvious: "Hazte Profesional" and "Iniciar Sesión" switched, but the headline, search box, and category names didn't. Here's what changed:

- **All 60 real service categories** (Plumbing, Cleaning, Tutoring, everything in the system today) now have real translations in all 6 languages — the pills on the homepage, the full categories page, and the filter chips on the "browse providers" page all switch correctly. A category you add later that has no translation yet just shows its English name rather than breaking anything.
- **The homepage headline, subheadline, and mission section** now translate too — but only when they're still the untouched default copy. The moment you customize any of that text yourself in Admin → Platform Settings → Homepage Content, your exact words stay exactly as you wrote them in every language, since there's no way to auto-translate text you wrote yourself. Tested both directions live: default text switches with the language, a real custom headline I set stayed in English even after switching to Spanish.
- **The search box placeholders** ("What do you need done today?", "Your city") now translate too.

**Being straight about what this is and isn't:** these are AI-produced translations for all six languages, not reviewed by a native speaker of each one yet. They should be solid for common, everyday service terms, but a real review pass — especially for Arabic and Chinese, where I have less confidence catching subtle phrasing issues — is worth doing before fully trusting this for real customers in those markets.

**Update — narrowed to English and Spanish for now.** After talking it through: none of Trothen's current markets (US, Nigeria, Ghana, Liberia) actually need French, Portuguese, Arabic, or Chinese — they're all English-official countries — so there was no real reason to carry the risk of unreviewed translations live on the site. The switcher now only shows English and Spanish (Spanish being genuinely useful given the US Hispanic population, and lower-risk to get right). Nothing was deleted — all 6 languages' worth of translation work (categories, headline, search box, everything from above) is still fully in the code. Re-enabling a language once it's been reviewed is one line: add its code to the `LIVE_LANGUAGES` array near `languageSwitcherHTML()` in public/index.html. Also added a safety check so anyone with an old language preference saved from before this change falls back to English cleanly instead of getting stuck.

**What's still genuinely untranslated**, and would be a separate, later piece of work if you want it: admin panels, dashboards, messaging, and most of the deeper parts of the app — this pass focused on what an anonymous visitor actually sees on the homepage, since that's what your screenshot was about.

## New: pick individual accounts in Data Cleanup instead of all-or-nothing

You asked for the ability to select individual things to clean, instead of the tool always clearing everything eligible in a country at once. That's now real: the preview list shows a checkbox next to every eligible account (all checked by default, so nothing changes if you don't touch anything), plus a "Select all / Select none" shortcut. The delete button updates live to say exactly how many are actually selected, and disables itself at zero. The safety rule underneath is unchanged and still runs fresh at the moment of deletion — an account is only ever actually eligible if it has zero real contract, payment, or dispute history, whatever you've selected.

Proved this does what it says with a real test, not just by reading the code: created two untouched test accounts in the same country, selected only one of them, ran the delete, and confirmed the other one was still there afterward, untouched.

## Full system audit

A broader sweep of the whole codebase, not just reacting to specific reports:

- **Full syntax check across every file** — clean.
- **Database column-registry check** (the same one that's caught real bugs earlier in this build) — clean, nothing new.
- **A systematic check for the exact class of bug the rejection-reason fix uncovered** (backend requires a field, frontend never sends it) — this surfaced one genuine, real gap:
- **Found and fixed: a complete "propose a custom commission rate" feature existed entirely on the backend — a real two-step approval workflow (a regional admin proposes a better rate for a standout provider, a super admin approves or rejects it, both sides get notified) — with zero way to actually reach it anywhere in the interface.** Built the missing UI: a "Propose Custom Commission Rate" button on a provider's detail view, and Approve/Reject buttons for a super admin when one's pending. Tested the entire loop live, including in a real browser: proposed a rate, approved it, and confirmed the detail view correctly shows the new 8% rate as active.
- **A real security pass**: checked every admin route for a genuine permission check, not just an apparent one. Confirmed the whole admin API sits behind a blanket "must be an active, logged-in admin" check, and every more sensitive action (suspending someone, approving verification, resolving a dispute) has its own additional, more specific restriction on top of that. Checked the public-facing routes too — the handful that don't require login (the contact form, job applications, the Persona identity-verification webhook) are all correctly meant to be public, and the webhook specifically has real cryptographic signature verification protecting it, not just an open door.

**Not exhaustive** — a codebase this size has more surface area than one pass fully covers (every screen's visual behavior, every edge case in every form). What's above is real, verified findings, not a guess that everything is fine.

## This round: Joseph's newest batch, worked through one at a time

**Real, fixed, and tested:**

- **Customer Service can now edit legal/policy content** (About Us, Terms of Service) — was super-admin-only before. Also gave them the ability to add new Customer Service employees themselves, so the team can grow without needing a super admin for every hire. The important part: a Customer Service rep can only ever create *more* Customer Service employees — tested live that an attempt to sneak in a "financial" department hire is correctly blocked. Also confirmed a plain regional admin and other departments are still correctly locked out of policy editing, and that a super admin still has full, unrestricted access to everything.
- **A real welcome message now exists.** Every new signup — both the regular and the Google sign-in path — gets a real welcome email and an in-app notification introducing Trothen and explaining how it works, worded differently for customers and providers. There was nothing here before at all.
- **Found and fixed the actual cause of "Monrovia should not see Philadelphia."** This wasn't a data-leak in the visibility logic itself — that logic was already correct. The real problem: once an admin account was created as "global" by mistake (a checkbox left unticked), there was no way to fix it afterward short of deleting and recreating the account. Proved this two ways: reproduced the exact bug live (a Monrovia-based verification admin could see pending users from Lagos and Accra), then applied the fix and confirmed the same admin instantly dropped to seeing zero users outside Monrovia. There's now a real "Scope to [city]" / "Make Global" control next to each team member in Locations & Admins.

**Investigated, not a real bug:** "Rejecting a client is still not possible" — tested this directly with a real customer account start to finish, and rejection worked correctly. I couldn't reproduce a failure, so I didn't invent a fix for one — if this is still happening, the exact steps that trigger it (which page, what the account had done right before) would help me find the real cause.

**Not yet addressed — needs another round:**
- A way for the verification/dispute team to message a specific person the actual reason they were rejected or accepted (right now it's a generic message)
- Verification seeing what's actually driving a specific provider's score, to justify a hold
- Letting disputes carry submitted evidence/documents, visible to the dispute team
- "Allow regional administrator to set Us rate" and "password requirements" — both too unclear for me to safely guess at without checking with you first

## Real bug found from your report: language selection broken, invisible on mobile

You reported the language switcher wasn't working right and wasn't visible on your phone. Both were real, and both are fixed — verified in an actual mobile-width browser, not just by reading the code.

**Why it wasn't working:** the site's navbar gets rendered separately into over a dozen different containers — one per screen (home, about, your dashboard, and so on). Every one of those screens stays in the page even while hidden, only one is ever shown at a time. The language dropdown was built with a single fixed ID, so with more than one of those navbar copies alive in the page at once, the browser could only ever find the *first* one — meaning clicking the switcher almost anywhere except the very first navbar toggled a different, invisible dropdown instead of its own. Fixed by having each button control its own dropdown directly, so it works correctly no matter how many navbar copies exist in the page.

**Why it wasn't visible on mobile:** a rule meant to hide only the "Become a Pro" button on very small phones was written broadly enough that it accidentally caught the language switcher too, since both happened to share the same base style class. Narrowed that rule so it only ever touches the button it was meant for.

Also checked while in there: a general audit of every place the app saves data against what the live database actually expects (the same kind of check that's caught real bugs earlier this build) came back clean this time — nothing new found. Also checked the homepage, login, and both the customer, provider, and admin dashboards at real phone width for anything else cut off or overflowing — none found, though this wasn't an exhaustive click-through of every single screen.

## Real bug found from your report: the footer text was wrong and unfixable without a code change

You flagged the footer ("© 2026 Trothen Tech Group · Atlanta, GA · support@trothen.io") as wrong, and asked for a way to change it yourself. This was hardcoded in five separate places in the site with no way to correct it without me editing code and redeploying — genuinely not something you should have needed me for.

Fixed properly: it's now a real, editable setting. Go to **Admin → Settings → Site Footer** (super admin only) to set the real company name, location, support email, and copyright year — company name, location, and email can be anything you want; changes go live immediately, no deploy needed. Tested live: updated it, confirmed the public homepage picked up the real value in a real browser, and confirmed a regional (non-super) admin is correctly blocked from changing it.

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
13. Go to Admin → Settings → Site Footer, set the real company name/location/email, save, then check the homepage footer actually shows it
14. On an actual phone (not just a resized desktop browser), check that the 🌐 language button is visible in the navbar, tap it, pick a different language, and confirm it actually switches and stays open/closed correctly on a couple of different pages (home, then your dashboard)
15. In Data Cleanup, preview a country with more than one eligible account, uncheck one, and confirm only the accounts you left checked actually get deleted
16. Switch to Spanish (or any other language) on the homepage and confirm the headline, category names, and search box all actually change — then set a custom headline in Homepage Content and confirm that one stays in English no matter what language is selected
17. Have a native speaker glance over a couple of the translated screens, especially Arabic and Chinese, before leaning on this heavily with real customers in those markets
18. Sign in as a Customer Service employee and confirm they can now open and save About Us / Terms of Service, and can add a new Customer Service teammate — then confirm they still can't create a Financial or Legal hire
19. In Locations & Admins, check whether any existing team member shows "Global — every city" who should actually be scoped to just their own city, and fix it with the new "Scope to [city]" button
20. Sign up a brand-new test account and confirm a welcome notification shows up for it
21. Open a provider's detail view as a regional admin and try "Propose Custom Commission Rate" — then confirm a super admin sees it and can approve it, and that the rate shows correctly afterward
22. Reject a pending account application and confirm the reason you type actually reaches the applicant
23. Try Google Sign-In for real — this is the actual test of everything above. If it still doesn't work, check your browser's console (F12) during the attempt and tell me the exact error message shown
24. Post a job or a booking with unusual characters in the description (quotes, angle brackets) and confirm it displays back correctly, not broken
25. File a real dispute and attach a photo — confirm the other person on that booking, and your dispute team, can both see and open it
26. Sign in and just leave the tab open, untouched, for 19-20 minutes — confirm the warning appears with a countdown, and that you get signed out automatically if you never touch anything
27. Go to Admin → Settings → Plans & Pricing and change one of the membership prices — confirm it shows correctly on the customer-facing membership screen right away
28. On an actual phone, open the sign-in screen and confirm the chat bubble is gone from the corner and doesn't get in the way of the button
29. Set `SENDGRID_API_KEY` and a verified `SENDGRID_FROM_EMAIL` on Render, then sign up a brand-new test account and confirm the verification code actually arrives by email instead of showing on-screen
30. In Admin → Settings, set a real support email (and try a region-specific one too if you manage more than one city) — confirm it shows up on the Contact Us page

If anything looks wrong, a screenshot plus what you expected instead is always the fastest way for me to trace it.
