# Trothen v115: Trothen Tokens — customers can buy tokens and pay with them

You asked for customers to be able to buy tokens as another way to use the system, and chose "Both": tokens as a prepaid balance that pays for bookings, and tokens that can cover just the Trothen fee. That's what this version adds. It's built on the v114 code you sent (trothen-backend.rar).

## How it works for a customer

- I added a **Tokens** page to the customer menu (🪙, under Payments). It shows the balance (with the local-currency amount next to it), the packs for sale, a short "How tokens work" list, and a full history of every token bought, spent and given back.
- **1 token is always worth US$1.00** when spent. That never changes, so nobody's balance loses value. Bigger packs come with bonus tokens. The starting packs are Small ($10 = 10 tokens), Medium ($25 = 26), Large ($50 = 53) and Extra large ($100 = 110). These are placeholders; you set the real ones in Admin → Tokens.
- To buy, the customer picks a pack, ticks a box saying they've read how tokens work, and pays. Like every other payment in the app today, this is **simulated** until real payments are switched on. When Liberian mobile money (MTN MoMo) is configured, a real collection request is made, and the tokens are only added once MTN confirms the money arrived (the server checks every 5 minutes and whenever the customer opens their Tokens page).
- At checkout, a new **"Pay with"** choice appears on the booking form, Post a Job, store checkout and rides:
  - My usual payment method (what happens today)
  - Tokens: the whole amount (job + Trothen fee)
  - Tokens: only the Trothen fee (the job price is paid the usual way)
- If the balance is too small, nothing gets booked or taken. The customer sees exactly how many more tokens they need, with a button straight to the Tokens page.

## The money rules I built in

- **Tokens are taken first.** Same "charge before anything is written down" rule from v110. If tokens can't be taken, no booking, no stock held, nothing.
- **Refunds give the tokens back automatically.** I hooked every refund path: customer or pro cancels, pro declines, booking expires unanswered, store order cancelled or swept, ride no-show or not started, dispute refunded in full. For a **dispute split**, the refunded part comes back as tokens. It happens once per payment and never returns more than was taken. A background check every 5 minutes catches any refund that slips through.
- **Two quick taps can't spend the same tokens twice.** In testing I fired 5 bookings at once with enough tokens for 2. Exactly 2 went through and the other 3 were refused.
- **Offers:** a Mutual Agreement offer is paid when the pro accepts. If the customer's balance has dropped by then, the pro is told to try again later and the customer is asked to top up.
- **Job board:** the "Pay with" choice is saved with the job and used when the customer hires. If the first pro doesn't confirm and the balance can't cover the automatic hand-over to the next pro, the job is reopened and the customer is told to top up and pick again. Nobody gets charged in a way they didn't choose.
- **Extra work approvals:** on a booking paid with tokens, the extra is paid with tokens if the balance covers it. If not, it's paid the usual way and the customer is told.
- **Store orders with a driver:** the balance is checked against the order *and* the driver's delivery before anything is taken, so an order is never half paid.
- **Limits:** only verified customers can buy (a balance is stored money, so we need to know who holds it). One customer can hold at most 500 tokens by default (you can change this). Tokens don't expire.
- **Closing an account:** a customer with tokens left is asked to spend them or contact support first, so nobody closes an account and loses money by accident.
- **Records:** every change is a line in a token ledger (bought, spent, given back, changed by an admin). The balance is always worked out from the ledger. Tokens are included in "Download my data", and the Go-Live demo cleanup removes demo accounts' tokens.

## Admin → Tokens (new)

Super admins see it, and so do the customer service and finance teams (they can look but can't change anything).

- **Totals:** tokens customers hold right now (what Trothen owes in future bookings), sales in the last 30 days and all time, bonus tokens given, tokens spent and given back.
- **Settings** (super admin only): turn tokens on or off, allow or block "fee only", set the most one customer can hold, and edit the packs (name, price, tokens). A pack can't have fewer tokens than dollars. Every change is logged.
- **Look up a customer** by email or name to see their balance and history. A super admin can add or take away tokens with a reason. The customer is told, and the change is logged with who made it.
- **Recent activity:** the latest 25 token movements across the platform.

## What I tested (live, on a local copy of the server)

- Buying: refused without the tick box, refused if the price changed, refused over the limit, refused for pro accounts; bonus tokens added correctly.
- Paying: whole amount and fee-only on direct bookings; short balance refused with nothing taken; tokens switched off refused cleanly; normal bookings unchanged.
- Getting tokens back: after a pro declined, after a customer cancelled, and after a dispute split ($25 of a $65.40 job came back as 25 tokens). Running the background check twice afterwards gave nothing extra.
- Extra work: paid normally when the balance was low; fee increase paid with tokens once topped up.
- Job posted with tokens; payment history marks token payments.
- Admin: totals, lookup, adding and removing (can't go below zero), pack validation, limit change.
- In a real browser: the Tokens page, buying a pack, the "Pay with" choice on the booking form and Post a Job, a fee-only booking end to end, the admin page, and the Tokens page at phone width (no sideways scrolling). No errors in the browser console.
- Not tested live: rides and store orders paid with tokens. They use the same payment path I did test, but setting up an approved ride driver and a live store in the test copy was out of reach this round.

## What still needs a business or legal decision (code can't settle these)

1. **Stored-value rules.** A prepaid balance people can top up is regulated in many places. In the US it can count as "stored value" or "prepaid access" (money-transmitter licensing in some states, FinCEN prepaid-access rules, and state gift-card and unclaimed-property law). Liberia's Central Bank and Nigeria's CBN have their own e-money rules. Keeping tokens **closed-loop** (spend on Trothen only, no transfers, no cash-out by default) and **capped** (500 tokens) puts you in the lower-risk shape, but your attorney needs to confirm it for each country before real money flows.
2. **Accounting.** Money paid for tokens is a liability, not revenue, until the tokens are spent. Bonus tokens are a discount Trothen funds. Your accountant should set this up before real sales start.
3. **Refunds of unspent tokens.** I set it up as "not paid out as cash except by arrangement with support", and an admin can remove tokens with a reason when a cash refund is arranged. Whether you must offer cash refunds (some places require it, for example on account closure) is a legal question.
4. **Terms of Service.** The Tokens page explains the rules in plain words, but the customer Terms don't mention tokens yet. Add a tokens section (Admin → Settings → Terms) once your attorney has approved the wording.
5. **Pack prices.** The four packs are placeholders. Set real prices for your markets in Admin → Tokens.
