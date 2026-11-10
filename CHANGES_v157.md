# Trothen v157: extra work and tips paid the same way as the booking

What Walter asked, after v156: "yes continue to build with international standard and make sure everything is working". This is the second payment step v156 said was missing.

## Why this was needed
Before v156, a tip or approved extra work was added to the pro's payout, but nothing collected it from the customer. On a booking paid by card, payment code or mobile money, Trothen would have paid it out of its own money. v156 turned both off for those payments. v157 brings them back, done properly.

## How it works now
This is the way escrow marketplaces (Upwork, Airtasker) handle money added after booking: the extra amount is a payment of its own. It is paid the same way as the booking, with its own receipt, and the pro is paid only once it has really arrived.

### Extra work
1. The pro asks for more, with a reason (as before).
2. The customer approves.
3. **The customer then pays it the same way they paid for the booking:**
   - the same card page;
   - a payment code for Trothen's Mobile Money number;
   - or a prompt on their own wallet.

   My Bookings shows it at the top: "Waiting for your payment: Extra work: …", with Pay now.
4. **Only once it is paid** does the job's total go up. The pro is told "approved and paid, new total $X".
   - The extra is held with the rest of the booking's money.
   - It is released when the job completes.
   - It is refunded if the booking is cancelled or a dispute is decided for the customer.
5. **If it isn't paid in time,** it's dropped. The job stays at its booked price, and both are told. The booking itself is never affected.
6. **One extra at a time:** a second can't be started while one waits for payment.

### A tip
1. The customer presses Complete and types a tip (as before).
2. The job completes, and the pro's money for the work is released at once.
3. The customer then pays the tip the same way they paid for the booking. The Complete window says so.
4. Once it arrives, the tip goes to the pro's next payout in full, with no commission.

### Where nothing real is paid (test mode)
Tips and extra work work exactly as before: added straight away.

## The money is kept straight
- **Payouts:** the pro's statement shows the extra work as its own line, with commission. The tip is its own line, with none.
- **Refunds:** each extra and tip has its own receipt.
  - A card refund goes back to the right card payment.
  - A payment-code refund shows for finance with its own transaction, in Customer Payments → Refunds to send.
- **Disputes:**
  - A refund to the customer refunds the paid extra too.
  - A release or a split releases it with the job.
  - Reopening a dispute puts it back on hold, as long as it hasn't been paid out.
- **Payment history:**
  - The booking's line includes its paid extra work.
  - A tip has its own line.
  - Extras or tips never paid count as $0.
- **What each person sees:**
  - The pro never sees these payments as separate bookings.
  - The customer sees one only while it waits to be paid.

## What I tested
- **New `t157` (21 checks), on a booking paid by payment code in Liberia:**
  - the pro asks for $20 more and the customer approves, with a code for the extra (the total doesn't change yet);
  - a second extra is refused while one waits;
  - finance confirms the payment: the job is $60, with the extra held;
  - completing with a $5 tip: the job's money and the extra are released, and the tip gets its own code;
  - finance confirms the tip;
  - the pro's payout is $60 of work with commission plus the $5 tip with none;
  - payment history;
  - an extra not paid in time is dropped and the booking carries on;
  - the pro cancels and both payments are refunded;
  - a dispute decided for the customer refunds the extra too, and finance sees its refund to send;
  - on a phone: My Bookings shows "Extra work" waiting with its payment code, and Pay opens it.
- **`t156`** updated to v157's behaviour.
- **Every earlier suite.**

## Files
- **New:**
  - `src/top-ups.js` (the extra-work and tip payments)
  - `CHANGES_v157.md`
- **Changed:**
  - `src/routes/payments.routes.js` (approving extra work, the tip at Complete, completing, cancelling, the timed check, payment history)
  - `src/customer-payments.js` (a paid extra or tip is applied; an unpaid one lapses)
  - `src/routes/admin.routes.js` (disputes move the paid extra with the booking)
  - `src/routes/marketplace.routes.js` (who sees these payments)
  - `public/app/trothen.js` (the Complete window, approving extra work, opening the payment)
  - `public/app/payways.js` (the payment code wording for an extra or a tip)
  - `public/app/es-v152.js` (Spanish)
  - `public/index.html` (fingerprints refreshed)
  - `CHANGES_v156.md` (points here)

No database changes, no new packages, nothing to set on Render.
