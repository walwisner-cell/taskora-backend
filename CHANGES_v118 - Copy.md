# Trothen v118: Tokens are for Pros, not customers

You asked for tokens to be for the Pro rather than the customer, for Pros to be able to spend them on everything they pay Trothen for, and for it all to follow best practice. v118 replaces the customer tokens from v115–v117. None of those were deployed, so this package is the only one you need, and it replaces the earlier token zips.

## The customer's money and escrow: unchanged
- Customers no longer see tokens anywhere. Booking, posting a job, store checkout and rides are exactly as they were in your uploaded v114 code. I put those files back to your originals rather than leaving dead code in them.
- The customer still pays for the job into escrow. It's released to the pro only when the customer confirms the job is done, or when a dispute is decided. Cancel, decline and no-show refunds work as before.
- A pro's tokens only ever pay **Trothen**. They can't pay for, replace or speed up release of the customer's money.

## What a Pro can pay with tokens
1. **Job fee:** a small fee in tokens for each job the pro **accepts**.
   - **Off until you switch it on** in Admin → Tokens, either for every country or per country. It can be a flat amount, a percent of the job price, or both, with a cap.
   - **Taken when the pro presses Accept.** If they don't have enough, the booking stays exactly as it was (the customer's money stays held) and they're told how many tokens to buy.
   - **Not charged** on rides (drivers have the driver pass and ride commission), on store deliveries, or when the customer's payment for an offer fails.
   - **Given back automatically** if the customer cancels, if the pro cancels for a reason that doesn't count against them (for example it became unsafe or needs a licence they don't hold), or if Trothen cancels the job.
   - **Kept** if the pro cancels for an ordinary reason. That's what stops "accept everything, then drop it". After a dispute, the team decides and can give it back with **Change balance**.
2. **Commission (pro's choice):** at cash-out, Trothen's commission comes from tokens, so the pro keeps the full amount they earned. If tokens don't cover it all, the rest comes out of the payout as before. The payout record and message show how much tokens paid.
3. **Monthly plan fee (pro's choice):** paid from tokens as soon as the month's invoice is made, or right away with **Pay with tokens** on the Tokens page. Anything tokens don't cover still comes from payouts as before. Plan billing itself is still switched off until you turn it on.
4. **Ads (pro's choice):** a self-serve ad is paid from tokens when the balance covers the whole price, otherwise the usual way. If the pro withdraws the ad before it runs, or an admin turns it down, the tokens come back.
5. **Driver pass (pro's choice):** a daily, weekly or monthly pass is paid from tokens when the balance covers it, otherwise the usual way.

The pro picks options 2–5 with tick boxes on their **Tokens** page (in the Pro menu, under Earnings & Payouts). The job fee isn't a choice; it's the rule you set.

## Kept from v115–v117, now for Pros
- **Buying:** in the app, with a **mobile money payment code** Trothen generates (send to Trothen's own number with the code in the reference; finance confirms it with Trothen's transaction ID), or in cash, at an agent or by bank deposit recorded by staff.
- **Africa-ready pricing:** prices in local money rounded to sensible amounts (L$, ₦, GH₵), small packs from $2 in Liberia, Ghana and Nigeria, optional fixed local prices with a ⚠️ when the exchange rate drifts 5% or more.
- **Limits and safety:** at most 200 tokens held and $100 bought a day in those three countries (500 and $200 elsewhere), a team flag at 4 purchases in a day, no double charge if the signal drops, and only verified pros can buy.
- **Admin → Tokens:** totals, settings, countries, mobile money codes, look up a pro, record a payment, change a balance (with a reason), and recent activity.
- Account closure asks a pro with tokens left to spend them or contact support first. Tokens are in "Download my data" and in the Go-Live demo cleanup.

## Files changed
Compared with the v114 code you uploaded, only 12 files are touched:
- **New:** `src/tokens.js`, `src/routes/tokens.routes.js`, `public/app/tokens.js`.
- **Changed:** `server.js`, `public/index.html` (loads the tokens page), `src/platform-settings.js`, `src/routes/marketplace.routes.js` (the job fee on Accept), `src/routes/payments.routes.js` (commission at payout), `src/routes/misc.routes.js` (ads), `src/ride-pass.js` (driver pass), `src/account-privacy.js`, `src/go-live.js`.
- `public/app/trothen.js` and `public/app/rides.js` are **not** in this package; your existing ones stay as they are.

## What I tested (live, on a local copy of the server)
- Customers: no tokens page, can't buy. A booking sent with a "pay with tokens" field still held the full $60 in escrow as normal.
- Job fee off: the pro accepted with 0 tokens.
- Job fee on (1 token + 5%, max 5):
  - The pro couldn't accept with 0 tokens, and the booking and the customer's held money were unchanged.
  - After buying 10 tokens, accepting took 4.
  - The customer cancelled and the 4 came back.
  - The pro cancelled another job for a schedule conflict and the fee was kept.
- Commission: the customer confirmed the job, and the pro cashed out with "commission from tokens" on. On $60 earned with $7.80 commission, 6 tokens paid part of it and the pro received $58.20. The figures add up.
- Plan fee: a $15 invoice was paid with 15 tokens, and next month's was paid automatically.
- Ads: an ad was paid with 25 tokens. Withdrawn before running, they came back; turned down by an admin, they came back; with too few tokens, it was paid the usual way and the tokens weren't touched.
- Driver pass: a daily pass was paid with 2 tokens.
- Mobile money payment codes: the whole flow again, as a pro (24 checks, including duplicates, underpayment, expiry and permissions).
- Browser: the pro's Tokens page at phone width (no sideways scrolling) and the admin job fee settings, with no errors.

## Still needs business or legal action (code can't settle these)
1. **The job fee amount.** Pros already pay commission, so a job fee on top should be small, or you might lower commission for pros who pay job fees. It's off until you decide. Tell your pros before you switch it on.
2. **Pro agreement.** The Provider Agreement should mention tokens, the job fee and when it's given back, before you charge it. Have your attorney look at the wording.
3. **Stored money.** The licensing point still applies: pros' token balances are money Trothen holds for them. Selling tokens only to pros, to pay only Trothen's own fees, is usually a lower-risk shape (closer to prepaid fees than to a wallet), but your attorney should confirm it for Liberia, Ghana and Nigeria.
4. **Mobile money codes.** You need an official company number in each country (set in Admin → Tokens → Countries) and someone checking the statement every day.
5. **Accounting.** Tokens bought are prepaid fees, which count as revenue only when spent. Bonus tokens are a discount.
