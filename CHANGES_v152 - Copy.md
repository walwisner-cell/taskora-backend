# Trothen v152: wording that reads like a professional company wrote it

What Walter asked: "improve on AI generated text to be much more humanized and the system should not look like an AI generated system. Improve on the professional outlook and feel with text."

## What made it read like AI
v130 cleaned up the wording once. Since then, every new feature (v131 to v151) brought its own text, and that text had drifted back into the same habits:
- **Long explanations in small places.** A setup item, a tip under a field or a score card often had three or four sentences explaining how the system works. A professional app says what to do in one short line and leaves the detail to the help pages.
  - The Trothen Score card had a 90-word paragraph.
  - The Tokens page had seven long bullet points.
  - The pro's Overview was over 8,000 pixels tall on a phone.
- **The app talking as "I".** Some admin screens said "unless I've changed it", "I approved the store" and "a decision for me and the attorney". Software never speaks as one person.
- **Slogans.** "Verified pros. Protected payments. Zero guesswork." "Help build the trust layer for local services." "Local services shouldn't require a leap of faith."
- **Inconsistent names.**
  - "Provider Score", "Trust Score" and "Trothen Score" were used for the same thing.
  - "Needed" was used where apps say "Required".
  - "Two-step sign-in" was used where apps say "Two-step verification".
  - "licence" and "license" were mixed on the same screen.
- **Things that didn't agree:**
  - The Overview said "$220 available to withdraw" while Earnings said "$191.40". The first was before commission, the second after.
  - The Store said "Trothen keeps 8%… No commission is taken on your goods."
  - The FAQ promised a background check that doesn't exist yet, and talked about zip codes.
  - The sign-up screen said "Join as a customer, provider, or **admin**".
- **Computer-style dates in messages** ("expired on 2024-01-01"), decimals nobody needs ("0.4/20", "4.80★"), and duplicated currency ("L$190 LRD").

## The style used now
This follows the style guides most large apps publish, such as Google's Material, Apple's and Shopify's:
- **One short line of help under a heading.** Detail only where a decision depends on it.
- **The app speaks as "we" or not at all,** never "I".
- **Buttons are short verbs in Title Case,** as decided in v130: Add Photo, Add Details, Set Price, Verify ID, View Payouts, Manage Tokens. There are no arrows on buttons.
- **The same name for the same thing everywhere:**
  - Trothen Score;
  - Required and Recommended;
  - two-step verification;
  - license (US spelling, as Liberia uses);
  - payout.
- **Dates as people read them** ("Jan 1, 2024"), whole numbers in scores, and "L$190" (the "L$" already says which dollar).
- **No sales slogans** on working screens.

## What changed on screen
**Pro Overview** (about 30% shorter on a phone):
- "Welcome back" now comes first. Before, the checklist and the rides card sat above the greeting.
- **"Finish setting up your account" is now "Complete your profile"** ("Complete your account" for customers), with "7 of 14 complete" and a thin progress bar.
- Each item is one bold action plus one short line, marked **Required** or **Recommended**.
- Only the Required items and the two most useful Recommended ones show at first. "Show 3 more" opens the rest, and "Completed (7)" lists what's done.
- The profile photo is now marked **Required**, because without it a pro really is hidden from search. The separate "Customers cannot find you yet" box no longer repeats it on the Overview; it still shows on Job Matches and Settings.
- The payout box shows the **same figure as Earnings** (after commission): "$191.40 available for payout".
- **Path to Pro:** "4.8★ ✓" and "0% ✓" instead of "4.80★" and "0.0%". The footnote is one sentence.
- **Your Trothen Score:** the 90-word note is now 2 lines. Whole numbers ("0/20", not "0.4/20"), with clearer names: ID Verification, Customer Rating, Response Time.
- **Give rides:** one sentence, and a "Learn More" button.

**Earnings:**
- "Total Paid Out", "Available for Payout" and "Pending" are now short labels.
- "How Commission Works" is in three short steps.
- "Weekly Payouts".
- The plan fee reads "Starter plan: L$2,850 (about $15) a month. Not charged yet."

**Tokens:**
- The subtitle is "Prepaid credit for commission and fees".
- The balance line is "Maximum balance: 200 tokens · Available to buy today: $100.00".
- "How tokens work" has 5 short points instead of 7 long ones.
- The four "also pay from tokens" choices each have one line.

**Settings:**
- About 25 help lines were shortened. For example:
  - Payout name: 45 words → 19.
  - Close account: 55 words → 27.
  - Sign out everywhere: 37 words → 10.
- Every fact was kept.

**Store and Market:**
- The fee line is now honest: "Fee: 8% of each sale (minimum $0.50). Customers pay the listed price." It no longer adds "no commission".
- The returns policy, discount codes and order messages are one or two lines each.

**Sign-in and public pages:**
- "Hire local pros with confidence."
- "Every pro's ID is checked, every job is agreed in writing, and your payment is held until the work is done."
- "Sign in to your account." and "Create your account to get started." The word "admin" is gone from the public sign-up.
- Careers: "Work at Trothen".

**FAQ:**
- The answer about pros now says what's true: pros verify their ID and can add references. It no longer promises a background check before the first job.
- Zip codes are no longer mentioned.

**The early-access banner:**
- "Early access. Payments are in test mode. No real money is charged."
- When codes are shown on screen, one line instead of two.

**Admin:**
- Every "I" and "me" was removed.
- About 20 long help paragraphs were cut to one or two sentences: Rides, Stores, Tokens, Go-Live, People, Settings and Call health.

**Notifications:**
- Two broken sentences were fixed: "X signed up wanting to offer "Y" is not a listed category".
- Others were tightened: the account pause, the tip and an approved extra charge.

**Spanish:** the new wording has Spanish translations (`es-v152.js`).

## What I deliberately did not change
- **The Terms of Service, Privacy Policy and Ride and Store rules.** These are legal texts; change them only with your lawyer.
- **What people type** (messages, reviews, job titles such as "SAT prep — 4 sessions").
- **The homepage wording,** which you can edit in Admin → Settings → Front page wording. It already reads well.
- **Your company details.** The footer still shows "Trothen Tech Group · Atlanta, GA · support@trothen.io", which are the defaults. If your real support address is support@trothenpro.com, change it in Admin → Settings → Footer.
- **The homepage support number.** It still shows a placeholder: Admin → Settings → Support contact.

## What I tested
- **All test suites pass,** including:
  - every screen for a customer, a pro and the admin on a phone, a tablet and a computer;
  - the 4,256-call fuzz test;
  - the accessibility scan, still at 0 problems;
  - the privacy and security checks from v151.
- **Tests updated for the new wording:**
  - the setup card now shows "Show more" and "Completed";
  - "Required";
  - dates such as "Jan 1, 2020";
  - "Fee: 8% of each sale";
  - "Currently Pro";
  - the photo banner on Job Matches.
- **Before-and-after screenshots** are in `screenshots\`.

## Files
- **New:**
  - `CHANGES_v152.md`
  - `public/app/es-v152.js` (Spanish for the new wording)
- **Changed:**
  - `public/app/`: trothen.js, checks.js, commission.js, tokens.js, listing.js, rides.js, market.js, store-plus.js, payout-details.js, payways.js, chats.js, polish.js, price-units.js and voice.js
  - `public/index.html`
  - `src/readiness.js`, `src/fraud-detection.js` and `src/ride-pass.js`
  - `src/routes/auth.routes.js` and `src/routes/payments.routes.js`

No database changes, no new packages and no new settings.
