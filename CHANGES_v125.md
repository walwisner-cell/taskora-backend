# Trothen v125: one clear way to agree a price and pay, with real payments

This version includes v124 (message dates and times).

## What I saw that was wrong
1. When James sent a message on my posted job, it didn't appear until I refreshed.
2. James typed "5000" as a chat message, so no price ever showed. A pro had no obvious place to put a price.
3. When I hired at $100, it went "behind" the window. Nothing in front of me said what happened or what came next.
4. I never saw a place to pay. And Trothen isn't a test anymore: payments have to happen for real.

## What it does now

### One way to agree a price, everywhere
Every pro's card in **Responses to Your Job** has a **price box** at the bottom that always says where things stand and what to press next:
- **The pro gave a price:** "Aisha's price: $75.00, new trap and washer", with **Accept and pay $75.00**, or *Or offer a different price*.
- **No price yet:** "Aisha hasn't given a price yet", with **Ask Aisha for a price** (sends her a message asking for one), or *Offer a price*.
- **I offered a price:** the same back-and-forth as Make an Offer. The pro can accept, suggest a different price, or decline, and I can accept, suggest another, or cancel. The history shows in the box, and nothing is paid until we both agree one price.
- **Price agreed:** "Pay $87.20". Nothing is booked until I pay.
- **Paid:** "Waiting for Aisha to confirm", then "Booked".

When a price is agreed with one pro, the job is taken: the other pros are told, and any other price talk for that job is closed.

**The pro's side:** the pro's chat window now has a **"Your price for this job"** box above the messages, with **Send my price**. It explains that the price goes there, not in a chat message, so the customer can accept it with one press. If the customer offered a price, the box links to it in My Contracts.

### A clear pay step
Before any money moves, the same **checkout** screen shows the price, Trothen's fee (with any member discount) and the total, and says exactly how the payment works here:
- **Card:** "Continue to secure payment · $81.75". I pay on Stripe's own secure page and come straight back to "Payment received".
- **Pay to Trothen's account:** "Get my payment code". I get the code, the exact amount and Trothen's account details.
- **Cash:** "Confirm". Nothing is paid now; I pay the pro after the work.

If the **pro** accepts my price, I'm asked to pay ("Aisha accepted your price of $80.00. Pay $87.20 to confirm it."). Nothing is booked silently. A price that isn't paid within 24 hours is cancelled, nothing is charged, and the job opens again.

After each step, a message in front of me says what happened and what's next: "Offer sent", "Paid", "Booked", "Payment received", "Payment not finished".

### Real payments, no pretend money
Trothen now takes real money in two ways:
1. **Card payments (Stripe).** Built and ready. They switch on by themselves when the Stripe keys are added on Render (see below).
   - Card details are typed on Stripe's page and never touch Trothen.
   - A booking is marked paid **only** when Stripe confirms it, through a signed message from Stripe that is checked so nobody can fake it, or by asking Stripe directly when I come back.
   - **Refunds to the card happen automatically** (pro declines, booking cancelled, a dispute goes my way), and can never be sent twice.
   - If someone pays after their booking was cancelled, the card page is closed and the money is refunded at once.
2. **Pay to Trothen's account with a code.** This works today in **any country** and with **any kind of account**: MTN MoMo, Orange Money, Zelle (email or phone), Cash App ($cashtag) or a bank account. The finance team confirms each payment in Admin → Customer Payments, as before.

**No pretend payments on the live site.** Where neither card nor an account is set up for a country, "Protected by Trothen" is simply **not offered** there; jobs are cash until it is. Test payments only happen if "Test payments" is ticked in Admin → Tokens → Settings, which is for test sites only.

The **banner at the top** now says what's really true: nothing about payments once cards are on, which countries can pay to Trothen's account, or "jobs are paid in cash for now". The **Go-Live checklist** does the same.

### Instant, for real
The window no longer waits when the cursor is just sitting in an empty message box. James's "5000" appeared for me in about a second with my cursor still in the box, and text I'd half-typed was kept.

## Rides: the same, built for a trip that can't wait
Everything above applies to rides too, adjusted for speed.
- **The rider can accept the driver's fare or offer their own.** The driver list shows each driver's fare, with **Request · pay by card** (or **Pay cash**), and *Or offer your own fare: [$] Offer*.
- **The driver** sees "A rider offers a fare", with **Accept $5.00**, **Suggest a fare** and **Decline**, and the minutes left to answer. The rider sees the driver's answer straight away, with **Accept $6.50**, **Suggest a fare** and **Cancel**.
- **It's quick:** each side can name a fare up to 3 times, and each answer is due in the ride answer time (minutes, set in Admin → Rides), not hours.
- **Pay step:** the checkout shows the fare, the ride fee (Admin → Rides fee %) and the total. With cards on, the rider pays on Stripe first, and **the driver is only asked after the payment is confirmed**. This closes a gap where an unpaid ride could reach a driver. If the driver accepts the rider's fare, the rider is asked to **Pay** before the driver sets off.
- **Cash rides** work as before: no fee, paid to the driver at the end, covered by the driver's ride pass. No tokens are taken.
- **Real payments only:** paying in the app for a ride means a card (or a test payment on a test site). A ride can't wait for finance to check a payment code by hand, so codes aren't used for rides. Where cards aren't on, rides are cash, and the driver list says so plainly.
- **Instant:** the Rides page updates by itself for both rider and driver: offers, answers, payment, the driver accepting, and "Go to your rider". A rider still filling in "Where to?" is never redrawn under them, and a driver typing the rider's PIN isn't interrupted.
- A ride's card page runs out after about half an hour, not a day.

Tested: a fixed fare and an offered fare in test mode, card mode and no-payment mode. That covers the back-and-forth, the 3-fare limit, the driver not being asked before a card payment, card payments recorded and flagged as a ride, a cash offer with no tokens taken, and in-app rides refused (cash still works) where no real payment exists. In the browser, with rider and driver side by side and no refreshing: the driver saw the rider's $5 offer in about 1 second; the rider saw "Accept $6.50" in about 1.2 seconds; then checkout, the card page, back to "Payment received", the driver got "Go to your rider", and the rider saw the plate and PIN.

## Switching on card payments (business steps; nothing in the code needs changing)
1. Create a Stripe account for Trothen as a business at stripe.com and finish its verification.
2. In Stripe: **Developers → API keys**, and copy the **Secret key** (starts `sk_live_`).
3. In Stripe: **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://trothenpro.com/api/webhooks/stripe`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Then copy the **Signing secret** (starts `whsec_`).
4. On Render, open **trothen-api → Environment** and add:
   - `STRIPE_SECRET_KEY` = the secret key
   - `STRIPE_WEBHOOK_SECRET` = the signing secret
   - `PUBLIC_BASE_URL` = `https://trothenpro.com`
5. Save. Render restarts, and Admin → Tokens shows "Card payments (Stripe): on".

To try cards first without real money, use Stripe's **test mode** keys (`sk_test_…`) on a test site.

## Adding Trothen's accounts for a country
Admin → Tokens → Countries → pick the country:
- **Protected payments:** "Pay to Trothen's account with a code".
- **Trothen's accounts:** for example `Zelle | pay@trothenpro.com | Trothen Inc`, or `MTN MoMo | 0880000000 | Trothen Liberia Inc`. Up to 4 per country.
- **Save**.

Only use accounts registered to Trothen as a business.

## Honest limits, needing business or legal action, not code
- **Holding customers' money and paying it on to pros** (escrow) can be regulated (money transmission rules in the US; similar rules elsewhere). Have your attorney confirm how Trothen should hold and pay out funds before you take card payments at scale. Stripe Connect is the usual route; I have **not** built Connect payouts.
- **Pros are still paid out by your finance team**, not automatically. With "LIVE SITE: pay out only money Trothen really received" ticked, payouts include card-paid and code-paid bookings, and leave out anything else.
- **Mobile money by card page** (MTN/Orange directly in the app) needs the MTN approval or a provider such as Flutterwave or Paystack. That isn't built.

## How I tested it
- **Live-site rules:** with no card and no account, Protected isn't offered and protected bookings, offers and job posts are refused with a clear message. Adding a Zelle (email) and a Cash App ($cashtag) account for the US gives a code for $109.
- **Cards,** against a stand-in that answers exactly like Stripe's API:
  - the booking waits for payment and the Stripe page is for exactly $141.70
  - the pro can't accept before payment
  - a fake confirmation with the wrong signature is refused and changes nothing
  - the real one holds the money and keeps Stripe's receipt; receiving it twice changes nothing
  - coming back before the confirmation still records the payment
  - pressing Pay twice goes back to the same page
  - the pro declining refunds the card automatically, never twice
  - a card page left unpaid runs out
  - a payment after cancelling is refunded at once
- **Prices on posted jobs:** offer, the pro suggests, accept and pay. Two pros, one agreed, the other's talk closed and told. Accepting the pro's own price takes one press. The pro accepting means the customer must pay, and an unpaid agreed price runs out after 24 hours.
- **Every earlier check passes again:** payments, payment codes, cash, job board, price back-and-forth.
- **In the browser, as customer and pro side by side:** your exact case (cursor in the empty box, the pro's message appears in about a second), the pro's price box, "Accept and pay $75.00", the checkout, the trip to the card page and back to "Payment received", and the offer back-and-forth. No page errors.

## Files
New: `src/stripe-pay.js`.
Changed: `server.js`, `src/routes/rides.routes.js`, `src/tokens.js`, `public/app/rides.js`, `src/customer-payments.js`, `src/platform-settings.js`, `src/go-live.js`, `src/routes/marketplace.routes.js`, `src/routes/custpay.routes.js`, `src/routes/tokens.routes.js`, `src/routes/payments.routes.js`, `public/app/trothen.js`, `public/app/review.js`, `public/app/payways.js`, `public/app/pricing.js`, `public/app/live.js`, `public/app/tokens.js`, `public/index.html`.
