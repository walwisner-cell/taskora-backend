# Trothen v156: bookings, checked from start to finish

What Walter asked: "go through everything and fix the bookings to make sure everything is working."

## How I checked it
I followed a booking through every path, as a customer, a pro and the team:
- **How it starts:** booking a pro directly, making an offer and going back and forth on the price, and hiring from a posted job.
- **Payment:** paying (in test mode, and by payment code, card or mobile money), the pro confirming or declining, and an unanswered booking running out.
- **The job itself:** agreeing an arrival time, On my way, Arrived, extra work, "I've finished the job", Complete with or without a tip, and the review.
- **When it goes wrong:** cancelling at each stage, Report a Problem and the team's decision, and the payment history and its PDF.

For each step I read the code, then tested it against the server. I wrote a new test for every gap I found, checked that the test failed before the fix, then fixed it.

## What I found, and what changed

### Making a booking
- **A booking could be made for a day that had already passed,** or with a "date" like "next week".
  - The server now takes only a real date, from today up to 12 months ahead.
  - The booking form's calendar starts at today, and in the customer's own time zone (it used to start at the server's date).
- **A suspended, closed or paused pro could still be booked, and still showed in search.** Search, the homepage counts, job matching and the pro's public page now leave out:
  - a suspended account;
  - a closed account;
  - an account paused for review.

  The server refuses a booking for any of them, or for a pro who hasn't passed the ID check, with a plain reason.
- **The same booking could be made twice by a double tap or a slow connection that retried,** with two payments. The same booking sent again within 2 minutes is now made only once: "You have just made this booking. It's in My Bookings."
- **The time was saved however the page sent it** ("9:00 AM", "14:30" or "Morning").
  - The arrival reminders read "9:00 AM" and "2:30 PM" as no time at all, and read "10:00 PM" as 10 in the morning.
  - The time is now saved one way (24-hour, 22:00) and shown in the person's own style (10:00 PM).
  - Older bookings with "9:00 AM" are read correctly too.
- **How long a pro has to answer** now always ends before the job starts, even with a time like "Morning". The same applies once a booking paid by code is confirmed.

### Seeing your bookings
- **My Bookings and My Contracts showed the day the booking was made, not when the job is.** A pro deciding whether to accept couldn't see the date and time in the list. Both lists now have a **When** column, for example "Tue, Nov 10 · 2:30 PM", or "To agree".
- **A booking made from a posted job had no date or time at all,** even when the customer had picked one. It also dropped the job's photos and "what I already have". Hiring from a posted job, a price offer on one, and the automatic offer to the next pro now all carry the job's:
  - date and time;
  - photos;
  - "what I already have";
  - currency.
- **When a new arrival time was agreed, the booking kept its old date.** The list, the PDF and "the booking day" disagreed. The booking now moves to the agreed day and time.

### Cancelling
- **A customer could cancel for a full refund after the pro had arrived, or after the pro said the work was finished.** Work may have been done, so after that point a person decides.
  - Cancel is replaced by Report a Problem (Mark Complete is still there).
  - The pro can still cancel, and the customer is refunded.
- **When a booking made from a posted job was cancelled, the job stayed "matched" to a booking that no longer existed.**
  - The job now opens again, so the customer can choose another pro who replied, or cancel it.
  - If the pro cancelled, the customer is told.
- **A confirmed job whose day came and went with nothing happening** (the pro never set off, arrived or said it was finished) **kept the customer's money held for good.**
  - Two days after the booking day, both are asked what happened.
  - A week after it, the booking is cancelled and the customer refunded.
  - Pressing any button in between stops this: Mark Complete, I've finished the job, or Report a Problem.

### Money
- **A tip or extra work on a booking paid by card, payment code or mobile money was added to the pro's payout, although nothing collected it from the customer.** Trothen would have paid it out of its own money.
  - Until tips and extra work can be paid that way, a booking really paid by card, code or wallet:
    - has no tip box ("If you would like to tip your pro, give it to them directly");
    - can't have extra work added ("ask the customer to book you again for the extra work").
  - In a test-mode country both still work as before.
- **Payment history added up the price of every booking,** including bookings declined, expired or cancelled before any payment. The same went for its PDF ("Total Paid").
  - Each booking now shows what was really paid: the price plus the service fee, "Not paid", or "Cash to the pro".
  - It also shows what came back if it was refunded.
  - The totals count only real payments.

### What I checked and found working
- Agreeing a price back and forth.
- A pro declining.
- An unanswered booking expiring.
- Paying by code, card or wallet.
- On my way, Arrived and the trip map.
- I've finished the job, and completing by itself after 3 days.
- Report a Problem and the team's three decisions (refund, release, split), and reopening.
- The review.
- The contract PDF.

The fourth recheck (v153) had already made all of these safe against double taps.

## What I tested
- **New `t156` (34 checks):**
  - every gap above, against the server;
  - the timed check with the clock moved on;
  - in the browser: the When column for the customer and the pro, no Cancel once the pro has arrived, no tip box for a card payment, and "Not paid" in the payment history.
- **Every earlier suite,** including the full booking and ride walkthrough, the race tests and every screen on a phone, a tablet and a computer.

## Files
- **New:**
  - `src/booking-rules.js` (the booking rules in one place)
  - `CHANGES_v156.md`
- **Changed:**
  - `src/routes/marketplace.routes.js` (booking checks, posted-job bookings, the PDF time)
  - `src/routes/payments.routes.js` (cancelling, tips, extra work, payment history and its PDF, the timed check)
  - `src/arrival-time.js` (the agreed time moves the booking)
  - `src/customer-payments.js` (the answer deadline after payment)
  - `src/listing.js` (who shows in search)
  - `public/app/trothen.js` (the When column, payment history, the tip box, Cancel, the booking form's date)
  - `public/app/arrival.js` (reading the booked time)
  - `public/app/es-v152.js` (Spanish for the new words)
  - `public/index.html` (fingerprints refreshed)

No database changes, no new packages, nothing to set on Render.

## For you to decide (business, not code)
- **Tips and extra work by card, code or mobile money:** built in v157. They're now paid the same way as the booking. See `CHANGES_v157.md`.
- **The 7-day rule for a job nobody started** is my choice, in line with how TaskRabbit and Airtasker treat a task nobody finished. If you want it shorter or longer, it's one number.
