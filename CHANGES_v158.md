# Trothen v158: more gaps found and fixed

What Walter asked: "ok is there more gaps you can find".

I looked beyond the booking steps themselves, at what happens around them:
- how people hear about a booking;
- the reminders;
- the money reports;
- posted jobs;
- the extra-work and tip payments from v157;
- closing an account.

Below is what I found and what I changed.

## People only heard about a booking if they had Trothen open
Booking updates went only inside Trothen, and as a push message if switched on (an iPhone allows those only for an installed app). A pro never heard about a new booking until they opened the app. A customer who booked and closed the page never heard that:
- the pro had confirmed;
- a payment code was waiting;
- the booking was cancelled and refunded.

**Now these also come by email,** using the SMTP mailbox already set up on Render:
- **What is emailed:** booking updates (requests, confirmations, payments, cancellations, refunds, reminders), payout alerts, and account notices.
- **What is never emailed:** chat messages, new job matches or promotions.

So it never becomes noise:
- **Not while the person has Trothen open.** They see it there.
- **At most 8 an hour per person,** and never the same email twice in 30 minutes.
- **"Email me updates"** is a new switch in Settings → Notifications (on by default). It stops them all. Sign-in codes and password emails still come.
- **Every email has a link** that opens the right part of Trothen (for example Payments). It also says how to switch these emails off, and that Trothen never asks for a password, PIN or payment to a personal number by email.

## Reminders
- **Reminders only started once the customer opened the booking.** A booking confirmed while the customer was away had no arrival time set, so neither the customer nor the pro got the 1-hour, time-to-leave or late reminders.
  - The server now sets the time itself once the booking is confirmed. It reads the time in the customer's time zone, which is now saved when they book, or the pro's, or the country's.
  - A part of the day like "Morning" is never turned into an exact time.
- **A reminder the day before:** "Coming up: …", to both people, once.
- **A reminder before a payment code or card page runs out.**
  - It comes once, about a quarter of the way before the end, and at least 30 minutes before.
  - It includes the code.
  - Before, a customer who meant to pay later just found the booking cancelled.

## Times in notices were in the server's clock
"Respond by Nov 10, 2:00 AM" was the server's time (UTC), 5 hours off for someone in New York, with no time zone shown. Times in these notices are now in that person's own time zone, with its name ("2:00 PM EST"):
- the pro's "respond by";
- "confirm by" after a payment;
- a driver's "collect by".

## Posted jobs
- **A cancelled job stayed in every pro's Job Matches,** and they could still reply. The customer was then told a pro was interested in a job they had cancelled.
  - Cancelling now removes the job from every pro's list.
  - Pros who had replied are told it's closed.
  - A closed job can't be answered any more.

## The extra-work and tip payments (v157)
- **They're no longer counted as jobs or cancellations.** Their records used the same "completed" and "cancelled" labels as bookings, so they could have:
  - added to a pro's completed-job count and badges;
  - counted against a customer as cancellations;
  - been reviewed as if they were jobs.

  They now have their own labels: paid and held, paid to the pro, refunded, not paid.
- **Closing an account:** they no longer count as "bookings in progress". A pro's unpaid-out tips now count as earnings to cash out first.

## Money reports
- **GMV (gross bookings) added up every booking,** including declined, expired, cancelled and never-paid ones. This affected:
  - the admin dashboard;
  - Reports & Analytics by category;
  - the bookings report;
  - the transactions PDF.

  They now count only bookings that went ahead: paid or confirmed, in progress, done, or under dispute. Paid extra work isn't counted twice, and tips carry no estimated commission.

## Spam
- **A customer could make hundreds of bookings or job posts an hour.** Each one notifies (and now emails) a pro.
  - The limits are now 40 bookings and 20 job posts an hour, far above real use.
  - A refused request doesn't count towards them.

## What I tested
- **New `t158` (22 checks):**
  - the update emails, received by a test mail server: sent when away, not while in the app, never for chat, "Email me updates" off, at most 8 an hour, no repeats;
  - the server setting the arrival time in a New York customer's time zone, but not for "Morning";
  - the day-before reminder;
  - the payment-code reminder, sent once and with the code;
  - extra-work and tip records can't be reviewed, and don't count when closing an account;
  - the "respond by" time in the pro's own time zone;
  - the booking limit;
  - cancelling a posted job, and a closed job refusing replies;
  - GMV;
  - in the browser: a link from an email opens Payments, and "Email me updates" is in Settings.
- **`t157`** updated for the new labels.
- **Every earlier suite.**

## Files
- **New:**
  - `src/email-notify.js` (the update emails)
  - `CHANGES_v158.md`
- **Changed:**
  - `src/notify.js` (sends the email in the background)
  - `src/booking-rules.js` (time zones, what counts in GMV)
  - `src/arrival-time.js` (the server sets the time, the day-before reminder)
  - `src/customer-payments.js` (the payment reminder, labels, "confirm by" time)
  - `src/top-ups.js` (labels)
  - `src/routes/marketplace.routes.js` (time zone at booking, limits, posted jobs, "respond by" time)
  - `src/routes/payments.routes.js` (labels, GMV)
  - `src/routes/admin.routes.js` (GMV)
  - `src/routes/orders.routes.js` (the driver's time)
  - `src/routes/misc.routes.js` (in the app = no email)
  - `src/account-privacy.js` (closing an account)
  - `public/app/trothen.js` (the email switch, email links, labels, the booking form sends the time zone)
  - `public/index.html` (fingerprints refreshed)

No database changes, no new packages.

## For you (not code)
- **Update emails use the SMTP mailbox already on Render** (noreply@trothenpro.com). Namecheap's Private Email has a sending limit per mailbox (check the current figure in your Namecheap account). If Trothen grows past it, move to a sending service: SendGrid's paid plan is already supported, or Amazon SES or Postmark would need a small change.
- **Set APP_URL on Render to https://trothenpro.com** (if it isn't already) so the links in emails point at the right place. Without it they still use trothenpro.com.
