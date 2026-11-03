# Trothen v132: how commission is paid, shown clearly, and tokens used for it

This one package includes everything since the version on your GitHub `main` before v128: v128, v129, v130 and v131. Deploy only this one. It works whether or not v128 is already live.

## What I asked about
1. I could not see how the commission was paid.
2. The admin Tokens page showed tokens sold but 0 spent.

## What was wrong
**The commission was being taken correctly, but the screens did not show how.**
- **When it is taken.** Commission is taken when a pro requests a payout, not when a job finishes.
- **Earnings page.** It showed an estimate based only on the plan, so it was wrong for organisation rates, custom rates, rides, store goods and token payments.
- **Payout History.** A payout showed one commission total, without the jobs it came from or whether it was taken from the payout or paid with tokens.
- **Cash jobs.** Their commission (paid with tokens) did not appear on Earnings at all.
- **Admins.** They only saw estimates.

**Tokens were never spent on commission.** Tokens pay commission in two cases:
- on cash jobs, which are switched off in your settings;
- when a pro ticks "pay commission with tokens", which started unticked and no pro had found.

So every commission came out of payouts, and the tokens pros bought just sat there.

## What changed

### For pros (Earnings & Payouts)
- **New section: "How Your Commission Is Paid".** It shows:
  - the pro's actual rate, and where it comes from (plan, organisation or a custom rate), with the ride rate;
  - the commission due at the next payout and how it will be paid;
  - the commission paid so far, split into payouts, tokens at payout and tokens on cash jobs;
  - three short steps explaining protected jobs, cash jobs and paying with tokens.
- **New Commission Statement, job by job.** For each job it shows the date, booking, amount, rate and commission, and how the commission is paid. Each job's status is one of:
  - **Awaiting Completion**: the customer has not confirmed the job yet;
  - **Due at Next Payout**;
  - **Paid**;
  - **Returned**: a cash job that did not go ahead.
- **Available for Payout card.** It now uses the exact calculation the payout uses, so the amount shown is the amount paid. Its details list the commission and "You receive" for each job.
- **Payout History.** It gains a "How Commission Was Paid" column. Opening a payout shows a statement:
  - earned from jobs;
  - commission, and whether it was taken from the payout or paid with tokens;
  - store fees, plan fee and tips;
  - what was paid to the pro;
  - each job's commission.
- **Payout notification.** It now says how the commission was paid, for example: "Commission: $37.40 (13%) on $350 earned. The commission was taken from the payout."

### Tokens now pay commission first (standard practice)
- **Tokens first, automatically.** For pros who hold tokens, the tokens now pay the commission at payout before anything is taken from the payout. The pro keeps the full payout as long as their tokens cover the commission.
- **Pros can switch it off.** The box is on the pro's Tokens page, and once a pro chooses, their choice is kept.
- **Why this is standard.** It's how marketplaces normally treat a prepaid balance: a pro who bought tokens expects them to be used.
- **It also reduces what you owe pros.** Tokens a pro holds are money Trothen owes them until it is spent.

### For admins (Payments)
- **New "Commission Received" list.** It shows every commission and how it was paid:
  - taken from a payout, with the payout's bookings;
  - paid with tokens at payout;
  - paid with tokens on a cash job.

  It has totals and follows the date range at the top of the page.
- **Platform Transactions.** It shows the real commission once a job's commission has been charged. Until then it shows the estimate, labelled as one.
- **Regional admins** see only their own area, as with every other financial view.

### Token safety
- **Live-site guard.** While "LIVE SITE: pay out only money Trothen really received" is ticked, the "TEST SITES ONLY" free-token option no longer works, even if it was left ticked.
- **"Sold" counts only paid tokens.** Tokens given out by test purchases, with no payment, are shown on their own line.

## What needs your decision (settings, not code)
- **Cash jobs** are switched off (Admin → Tokens → Settings). Turn them on only where customers really pay pros in cash. Cash jobs cost Trothen some control, because the money never passes through Trothen.
- **The "TEST SITES ONLY" box is ticked.** Untick it before real money starts. Tokens bought while it was on were not paid for. Those purchases are marked "simulated" and no longer count as sales.

- **Your Provider Terms (legal, for you and your lawyer).** They say "Trothen deducts a commission from each completed job before paying you out" and do not mention tokens. When tokens pay the commission, the effect for the pro is the same, but the Terms don't describe it. I suggest one added sentence, for example: "If you hold Trothen Tokens, the commission is paid from your tokens first unless you switch this off; any part they do not cover is deducted from the payout." I have not changed the Terms, because legal documents should only change with your lawyer.
- **If you later turn on cash jobs.** A pro needs tokens to accept a cash job. With tokens paying commission first, a payout can use up the tokens a pro was keeping for cash jobs. If that becomes a problem in a country where cash jobs are on, pros can switch tokens-first off on their Tokens page. I can also make it skip pros who need their tokens for cash jobs.

## What I tested
- **Old code against new code.** Both made the same payout to the cent ($350 earned, $37.40 commission, $322.60 paid out) for:
  - a normal job, a ride, store goods, a materials advance and a tip;
  - a free-commission credit;
  - an organisation's 4% rate.
- **Commission checks (25).** The preview always equals the real payout, the per-job amounts add up to the total, and the statement, admin list and transactions show the right figures and payment method.
- **Token checks (12):**
  - tokens pay commission by default and the payout goes up by that much;
  - the admin Spent figure counts it;
  - a pro can switch it off and it stays off;
  - test purchases stop on the live site;
  - test tokens are not counted as sales.
- **Screen checks (9).** On laptop and phone, and in Spanish. No page errors and no sideways scrolling on a phone.
- **Earlier tests.** All still pass: 40, 25, the phone checks and 35 across five screen sizes.

## Files
- **New:** `src/commission-statement.js`, `public/app/commission.js`.
- **Changed:**
  - `src/routes/payments.routes.js`
  - `src/routes/admin.routes.js`
  - `src/routes/tokens.routes.js`
  - `src/tokens.js`
  - `public/app/tokens.js`
  - `public/app/trothen.js`
  - `public/index.html`

No new packages, environment variables or database changes.
