# Trothen v109: a full audit, and everything it found fixed

I had the whole site checked three ways at the same time: the security of every web address, the money in every kind of booking and order, and a click-through of every screen as a visitor, a customer, a pro and five kinds of admin, on a phone and on a computer (282 screens). Below is everything that was found, and what I did. Everything listed under "Fixed" is tested.

## Fixed: money

1. **A materials advance could be paid twice.** The pro was paid the advance, then the booking was cancelled and the customer got the full amount back. Now, once an advance has been paid out, the booking can't simply be cancelled. Either side is sent to "Report a Problem", where a person decides what is owed.
2. **Cancelling after the goods were handed over gave a full refund, and the customer kept the goods.** That applied to pick-ups and to driver deliveries, and the driver's money was refunded too. Now, once a pick-up or drop-off is recorded, cancelling is refused and "Report a Problem" is offered instead.
3. **Extra work (an additional request) didn't update the fee.** A $40 job that grew to $200 kept a $3.60 service fee, and the amount paid in local money stayed the same. Now the work part, the service fee and the local amount all follow. Extra work can't be added to a store order.
4. **"Amount paid in local money" left out the service fee.** Receipts, payment history and the contract PDF showed less local money than was paid. Fixed.
5. **The price charged could differ from the price shown.** If the seller changed a price or their delivery charge, or the exchange rate moved, while the customer was at the checkout, the new price was charged. Now nothing is charged; the customer is shown the new total and approves it.
6. **Loyalty points.**
   - Points spent on a booking that was declined, expired or cancelled were lost. Now they come back.
   - A point was earned just for booking, so booking and cancelling over and over collected points for free. Now the point is earned when the job is completed.
7. **Finance reports counted service fees from refunded bookings as income.** They no longer do.
8. **Smaller ones:**
   - The pro's "available to pay out" figure included an advance already paid. Fixed.
   - Goods priced in local money lost value when bought in quantity: 99 × ₦100 came to ₦9,207. Fixed.
   - Some payout amounts and notices showed numbers like $30.299999999999997. Fixed.
   - Money is only released or refunded if it is still being held, so it can never be moved twice.

## Fixed: who can see what

1. **The admin report builder** (all bookings, names and amounts) could be opened by any team admin, for example customer service, HR or sales, for the whole platform. Now only finance and legal can open it, and an area admin sees only their own area.
2. **Contract PDFs** could be downloaded by any admin, for any booking anywhere. Now only the people on the booking, the admin for that area, and the teams that handle bookings (disputes, finance, legal, customer service) can.
3. **Fraud flags** were shown to every area admin for the whole platform. Now each area admin sees only their own area.
4. **Messages from the Contact form** were readable by every team. Now only customer service, legal and the area admins can read them.

The security check found no way for a customer or pro to see another person's bookings, messages, ID documents or money. It found no way to bypass two-factor sign-in, and no injected-code hole.

## Fixed: screens

1. **The chat stopped opening after any pop-up or after visiting the sign-in screen.** This is likely what Joseph saw as "stuck". Fixed.
2. **Signed-in people saw a "Sign In" button on the pro list, profiles, categories, plans, careers, contact, about and terms.** Pressing it showed the sign-in form again. Those screens now show the signed-in menu.
3. **After booking from a pro's profile, the profile stayed on screen under "Booking Confirmed".** Fixed.
4. **On a phone the notifications panel was cut off on the left.** It now fits the screen.
5. **On a computer, the right side of the admin "Customers & Providers" table was cut off and unreachable** (the Reset password and Suspend buttons). Fixed.
6. **Spanish on the main customer screens.** The home page, the list of pros, a pro's profile, the booking form, the confirmation and the customer's account are now in Spanish when Spanish is chosen. Names, reviews and anything a person wrote stay as written.
7. **Small buttons on phones** (account menu, back links, show password, sign-in links, footer links, tick boxes in My Store and Settings) are now big enough to press.
8. **Sign-up said "Please fill in all fields" whatever was missing.** It now names the missing field and puts the cursor on it.

## What was tested

- 447 checks on the server, 40 of them new for this release.
- 295 checks in a real browser, 25 of them new.

All passed.

## Left for me to decide (not code)

These are the same as before, plus three the audit raised:

- **Are service fees refundable?** Today a cancelled booking refunds the customer's fee too. Nothing written tells customers either way.
- **The 9% on a seller's own delivery charge has no upper limit.** A $900 delivery charge carries an $86 fee. Normal jobs stop at $25.
- **Two requests at exactly the same moment.** On the current file storage this cannot cause a problem. If I move to Postgres, the order and delivery steps should be checked again under load.
- **From before:** the delivery fee rule; how many days before an order releases automatically; whether pros need an approved ID like customers; driver licence and insurance checks; customer subscription lengths and benefits; the smart chat key; phone notification keys; Stripe; the attorney and the accountant.

## Files

Changed: `public\index.html` (only the version tag on the script line), `public\app\trothen.js`, `src\store.js`, `src\loyalty.js`, `src\booking-scheduler.js`, `src\routes\payments.routes.js`, `src\routes\marketplace.routes.js`, `src\routes\admin.routes.js`, `src\routes\orders.routes.js`.

This package includes everything from v86 onward, including v108, v108.1 and v108.2.
