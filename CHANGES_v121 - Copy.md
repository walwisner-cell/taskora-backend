# Trothen v121: every payment path tested, and cash jobs no longer get stuck

This version includes v120 (see your offer before you book). If v120 isn't deployed yet, deploy this instead; it contains everything.

## What I tested
I ran every way money can move through Trothen against a copy of the real server, start to finish, with real accounts: a US customer, a Liberian customer, US and Liberian pros, and the super admin as the finance team. Over 100 server checks, plus the screens in a real browser, all passing on the final run.

**Protected by Trothen, test-mode countries (like the US)**
- Book and pay: the job price plus the 9% fee is held. The pro accepts, the customer marks it done, and the money is released.
- The pro declines: the customer is refunded.
- The customer cancels before the pro answers: refunded.
- An offer: nothing is charged until the pro accepts. Then the money is held and released when the job is done.
- The pro never answers: the booking expires and the money is refunded.

**Protected by Trothen with a payment code (Liberia, once switched on)**
- The code is made by the server (for example TKCQ6TG7), and the amount is in LRD as a whole number.
- The pro can't accept until finance confirms the payment.
- "I have sent it" works, and can't be pressed twice.
- Finance sees it in Customer Payments. A short payment is refused, the same transaction ID can't be used twice, and the same code can't be confirmed twice.
- The pro declines after payment: the refund appears in "Refunds to send", and leaves the list once marked sent.
- Finance rejects a payment: the booking is cancelled.
- The customer cancels before paying: nothing to refund.
- Nobody pays within 24 hours: the booking cancels itself and the customer is told.
- An accepted offer: the customer is then asked to pay by code (not test money).
- Hiring from a posted job gives a code too.

**Cash to the pro after the job**
- No service fee and nothing held. When the pro accepts, 13% commission is taken from their tokens. The customer marks it done and enters the cash paid.
- The booking is cancelled after the pro accepted: the pro gets the tokens back.
- Cash with a materials advance is refused, and cash is refused when you switch cash jobs off.

**Job board (Post a Job, then Hire)**, US and Liberia, protected and cash: all work end to end, and the fit score shows correctly.

## The one real problem I found, now fixed
A customer could book a **cash** job with a pro who didn't have enough tokens to cover Trothen's commission. The booking was accepted, but the pro could never press Accept. The customer waited for hours, then got "didn't confirm in time". This is very likely what you saw.

Now:
- **On the booking form**, as soon as the customer picks "Cash to the pro after the job", Trothen checks whether this pro can take a cash job at this price. If not, a red line says so: "Aisha can't take cash jobs at the moment. Choose 'Protected by Trothen', or book another pro." The review screen won't open for cash until that's sorted.
- **The server refuses it too**, so it can't slip through from an old page.
- **On "Responses to Your Job"** for a cash job, a pro who can't take it shows that line instead of a Hire button. Hiring them is refused with the same message.
- **The automatic hand-on** (when the hired pro doesn't answer and the job goes to the next candidate) skips pros who can't take the cash job. If nobody can, the job reopens for the customer.
- **The pro is told** what happened and how many tokens they need. They're told at most once every 6 hours, so they aren't flooded. For example: "A customer wanted to book you for a $100.00 cash job, but Trothen's commission on it is 13 tokens and you have 0. Buy tokens on your Tokens page… Protected bookings don't need tokens."
- The customer only ever gets a yes or no. They never see the pro's token balance.

## Smaller fixes
- When a job moved to the next candidate, the customer's message named the **new** pro as the one who failed ("Bola wasn't able to confirm your original pick…"). Now it reads: "Your first pick didn't confirm in time, so your job … was offered to the next candidate, Bola Ade, at the same price."
- In a payment-code country, the review screen now says what comes next: you get a payment code, send it by mobile money, and your pro is asked once we see it. The button says **Book and get my payment code**.
- Names ending in a full stop ("Aisha K.") no longer show a double full stop on the review screen.
- The local amount on the review screen is written the same way as on the payment code screen (LRD 26,923).

## What still needs you (not code)
- In the US and every country not switched to payment codes, protected payments are still **test money**. Real card payments need Stripe Connect and your attorney's sign-off.
- Payment codes are checked against Trothen's mobile money statement **by a person**. Automatic checking waits on the MTN Mobile Money approval.
- Whether new pros get some free starter tokens, so their first cash job works, is your call. It's commission you'd be giving up.

## Files
- `src/tokens.js`: the cash readiness check and the pro's message
- `src/routes/marketplace.routes.js`: check on booking, on hire, on hand-on, and on the candidates list; customer message fix
- `src/routes/custpay.routes.js`: new yes/no check the booking form asks
- `public/app/review.js`: from v120, plus the cash check, payment-code wording, name fix
- `public/app/payways.js`: shares how protected payments work in this country with the review screen
- `public/app/trothen.js`: from v120, plus the candidate card note
- `public/index.html`: new version tags
