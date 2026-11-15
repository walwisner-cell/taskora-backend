# Trothen v119: cash jobs paid for with Pro tokens, and escrow without in-app payments

This version also includes the v118.1 fix (store orders, rides and refunds). If you haven't deployed v118.1 yet, deploy this instead; it contains everything.

## The problem I'm solving
Cards and in-app mobile money aren't available yet, so:
- A customer can't pay into escrow inside the app.
- Many jobs will be paid in cash.

Before this version, Trothen collected nothing on a cash job, and the customer had no way to choose protection.

## Customers now choose how to pay ("How will you pay?" on the booking form and on Post a Job)

### 🛡️ Protected by Trothen (escrow), shown first and marked "Recommended"
- **In a country where you switch on payment codes** (Admin → Tokens → Countries → Protected payments → "Payment code"):
  - The customer gets a one-time code, for example TKV2E7AD, and the exact amount in their own money, for example LRD 12,426.
  - They send that amount by mobile money to Trothen's official number with the code in the reference, then press **I have sent it**.
  - The Pro is **not** asked to confirm until your finance team has found the payment and confirmed it in **Admin → Customer Payments**. That takes Trothen's own transaction ID and the amount that arrived. A short payment is refused, and each transaction ID can be used only once.
  - After that, escrow works exactly as before. Trothen holds the money, the Pro gets it when the customer confirms the job is done, and the customer is refunded if the Pro declines, doesn't answer, the booking is cancelled, or a dispute goes their way.
  - **Refunds to send:** any refund on a code-paid booking appears in a list for finance to send back by mobile money and mark as sent, with the transaction ID. The customer is told.
  - **Job board:** if the first Pro doesn't confirm, the money the customer already sent moves to the next Pro's booking instead of being refunded and paid again.
  - **Unpaid bookings:** cancelled automatically after 24 hours if the customer never says they paid. The customer can cancel any time before they report paying.
- **Everywhere else**, protected payments work exactly as they did before (test mode until real payments are on).

### 💵 Cash to the pro after the job
- Nothing is paid now and there's **no Trothen service fee** for the customer. They pay the Pro directly, only after the work is done.
- The app says plainly that a cash job **isn't covered by escrow**: Trothen never holds the money, so it can't refund it. The customer still gets the ID-checked Pro, the written contract, ratings and the dispute team.
- A cash job can't include store goods, a materials advance or loyalty points, because all three need Trothen to hold or pay money.
- When the customer marks the job done, they're asked **how much cash they paid**.

## How Trothen gets paid on a cash job: the Pro's commission, in tokens
1. **When the Pro accepts:** their commission is taken from their tokens at their plan rate (13% Starter, 12% Pro, 10% Super Pro) of the job price. Without enough tokens they can't accept, and they're told exactly how many to buy. The booking stays open until its answer deadline.
2. **When the customer confirms the cash paid:** the commission is corrected to that amount.
   - If the customer paid more (extra work agreed on the spot), the extra commission is taken.
   - If the Pro doesn't have enough tokens for it, the rest is recorded as owed, taken first from their next token purchase. They can't accept cash jobs until it's paid.
   - If the customer paid less, the difference goes back to the Pro.
   - A gap of more than 15% raises a flag for your team.
3. **When it comes back:** the commission is returned to the Pro if the customer cancels, if the Pro cancels for a protected reason (unsafe, wrong trade, needs a licence they don't hold), or if Trothen cancels. If the Pro cancels for an ordinary reason, Trothen keeps it, which stops Pros accepting jobs and then dropping them.
4. **Free-commission credits:** a top-scorer credit covers one cash job's commission.

This replaces v118's flat "job fee". On protected jobs nothing changes: commission still comes out of the payout, or from tokens if the Pro ticks that box.

## Disputes on cash jobs
- **Split:** not allowed, because there's no held money to split.
- **Decided for the customer:** the decision is recorded and both sides are told that Trothen didn't hold the money. Write in the note anything the Pro should pay back. The Pro's commission isn't returned automatically after a dispute, but the team can return it with **Change balance**.

## Reports
- Service-fee revenue no longer counts bookings that were never paid, or cash jobs (which carry no fee).
- The financial summary has a new figure, `cashJobCommission`: commission Pros paid in tokens on cash jobs, net of any given back.

## What I tested (live, on a local copy of your uploaded repo plus these changes)

**Cash jobs**
- No escrow and no fee on the booking.
- A Pro with 0 tokens was refused when accepting.
- With tokens, 7.8 tokens (13% of $60) were taken on accept.
- Completing without an amount was refused.
- Paid $80 → 2.6 more taken, and the gap was flagged. Paid $55 → 0.65 given back.
- The customer cancelled → the commission came back.
- Paid $120 with no tokens left → 7.8 recorded as owed. Accepting the next cash job was refused. Buying tokens cleared what was owed first, and the Pro could accept again.
- A materials advance on a cash job was refused.
- With cash switched off for a country, a cash booking was refused.
- A cash hire from the job board had no escrow and no fee.

**Protected jobs**
- In the US (no payment codes), escrow was held and the fee charged, as before.
- In Liberia with payment codes on:
  - The booking waited for payment, and the Pro couldn't see it or accept it.
  - The customer reported paying, and finance saw it at the top of the list.
  - A short payment was refused. Confirming moved the money into escrow and asked the Pro.
  - The Pro accepted. The customer cancelled and the refund was listed, then marked sent.
  - An unpaid booking was cancelled when its time ran out. A booking cancelled before payment had nothing to refund.
  - Reusing a transaction ID was refused.
  - Job board: paid by code, the first Pro declined, and the money moved to the second Pro's booking with nothing to refund.

**Browser (phone width)**
- The "How will you pay?" choice, the payment code screen, the cash booking confirmation (it no longer says "Escrow held"), the waiting-for-payment panel in My Bookings, and the "how much did you pay?" step for cash jobs.
- The Pro's Tokens page and both admin pages.
- No errors and no sideways scrolling.

**v118.1 checks (store orders and rides, both broken on your live site now)**
- Store: set up a store, added a good with a photo, got it approved, then:
  - **Placed a store order:** it worked.
  - **Cancelled it:** the money was refunded and the good went back on the shelf.
- Rides: put an approved driver online in Liberia, then:
  - **Requested an app-paid ride:** it worked.
  - **Cancelled it before the trip:** refunded.

**After the re-check fixes**
- Paying for tokens "in the app" is refused by default, and with no MTN connection the Pro isn't offered it at all.
- With the live-site switch on, a test-mode booking wasn't paid out, and a booking paid by code was paid out in full ($60).
- **Offers:**
  - A cash offer was accepted with 5.2 tokens of commission taken (13% of $40).
  - A protected offer by code was accepted, then waited for payment, still showed in the Pro's list, and became active once paid.
- **Pro token payments:**
  - Commission from tokens at payout: the Pro received the full $60.
  - The plan fee, an ad and a driver pass were paid with tokens, and a withdrawn ad gave its tokens back.
- All 87 automated checks across these runs pass. The server log showed no errors.
- A full browser run (customer, Pro and admin) made the 22 screenshots in the guide, with no page errors.

## Fixed in the full re-check (before packaging)
You asked me to check everything again before deploying. These are the gaps that check found, and all are now fixed:
1. **Free tokens:** "Pay in the app" was adding tokens without any real payment wherever in-app payments aren't connected, which is every country today. That would have let a Pro get tokens, and so pay commission, for nothing. It's now refused unless real mobile money is connected for that country. Pros are offered the payment code instead. A **TEST SITES ONLY** switch in Admin → Tokens turns the old behaviour back on for testing; leave it off on the live site.
2. **Payouts for money never paid in:** a protected booking in a country without payment codes is still in test mode, so nothing real was paid in. There's a new switch, **"LIVE SITE: pay out only money Trothen really received"**. With it on, a payout only includes bookings paid by a confirmed code or by mobile money, so test-mode bookings are left out. Turn it on when you go live.
3. **The Pro's screens now say "💵 Cash job":** in My Contracts, next to the service, and as "Cash to you" in the escrow column on Overview. A Pro accepting a cash job is told "Cash job confirmed — collect $X from the customer after the work".
4. **The customer's screens:**
   - My Bookings shows "💵 Cash" in the escrow column.
   - A booking waiting for payment shows **💳 Pay now** (it brings the code back) and **Cancel**.
   - The confirmation screen no longer says "held in escrow" on a cash booking ("Cash booking sent") or an unpaid one ("Booking created: waiting for your payment").
   - The Confirm button reads "Confirm cash booking" for cash.
   - The cancel questions now say what really happens: nothing to refund on a cash or unpaid booking.
5. **The job-board "Select this provider?" question** now explains the way that job is paid, instead of always saying "This funds escrow immediately".
6. **Messages to Pros and customers** no longer mention a refund on a cash booking that expires or is declined, because there's nothing to refund.
7. **Commission back right away:** when a customer cancels a cash job, the Pro's commission now comes back at once, not within 5 minutes.
8. **Tokens a super admin adds** now pay what a Pro owes first, the same as tokens they buy.
9. **Posting a cash job** in a country where cash jobs are off is now refused when the job is posted, not later when the customer hires.
10. **Account closure:** a Pro who owes commission is asked to settle it before closing their account.
11. **An offer the Pro already accepted** stays in their list while it waits for the customer's code payment. It no longer disappears.
12. **Rounding:** a code amount could come out L$1 too high because of floating-point rounding. Fixed.

## Not changed (honest limits)
- **Store orders and rides still use the old payment path:** test mode for store orders, and cash or test mode for rides, which already have their own cash option. Both work again thanks to the v118.1 fix (tested below).
- **Paying Pros on protected jobs** still goes through the existing payout requests in Admin → Payments, which your team sends by mobile money.

## Switches to set when you go live (Admin → Tokens → Settings)
- **TEST SITES ONLY: "Pay in the app" adds tokens without a real payment:** leave it **off**.
- **LIVE SITE: pay out only money Trothen really received:** turn it **on**.
- **For each country you operate in:** go to **Countries**, enter the official mobile money number and set **Protected payments → Payment code**. Until you do, protected bookings in that country are test mode.

## Still needs business or legal action (code can't settle these)
1. **Customer money in Trothen's account.** Holding customers' money for protected jobs is escrow, which is regulated. Your attorney should confirm how to do it in Liberia, Ghana and Nigeria; often that means working with a licensed partner or a separate trust or escrow account.
2. **An official company mobile money number** in each country, registered to the business, with statement access for finance. Plus someone checking it several times a day, because a Pro isn't asked until the payment is confirmed.
3. **Terms:**
   - The customer Terms should explain that cash jobs aren't covered by escrow, and how protected payment by code works.
   - The Provider Agreement should cover commission on cash jobs paid from tokens, what's owed, and when it comes back.
4. **A written refund procedure** for finance, covering who sends refunds, how fast, and from which number.
5. **The commission rate on cash jobs.** It uses each Pro's plan rate. If you want a different rate for cash jobs, tell me.

## Real payment logos (added at your request)
- The customer **Payments** page now uses the real logos instead of emoji:
  - The **Card** tab shows Visa and Mastercard.
  - The **Apple Pay** and **PayPal** tabs show their own logos.
  - The saved-methods list shows each card's brand logo (Visa, Mastercard, American Express, Discover), plus PayPal and Apple Pay.
  - The Pro's **PayPal for Payouts** panel shows the PayPal logo.
- **Where the logos come from:** licensed open-source icon sets, `payment-icons` (MPL-2.0) and `simple-icons` (CC0). They're kept in `public/img/pay/`, with a NOTICE.txt naming each source. The files are served from Trothen's own site, with no outside links.
- **Mobile money keeps its phone icon:** I had no licensed MTN MoMo or Orange Money logo file. Get those from MTN and Orange directly (merchant or partner brand kits) and I'll add them.
- **Brand rules, honestly:** Apple, PayPal, Visa and Mastercard only allow their logos where you really accept that method. Today these methods are test mode. Before the live site shows them to the public, connect a real processor for each method or hide the ones that don't work yet. At that point, swap in each company's official logo download.
