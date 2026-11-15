# Trothen v160: a deeper re-verification, and the gaps it found

What Walter asked: "ok please do a much more deeper reverification and fix all the gaps", and then, with two phone screenshots, "please see if there are more gaps to be done. This is not aligned".

The earlier checks tested each step one at a time, through the server. This time I added three new kinds of check:
1. **Everything at once.** The same button pressed several times in the same instant, and the background checks running into each other. Real phones on slow networks do this: a double tap, or a "retry" while the first request is still on its way.
2. **The records agree with each other.** After every one of the 50+ test suites, a new checker reads the whole database and looks for anything that doesn't add up. For example:
   - money still held on a booking that was cancelled or completed;
   - a payment with no booking;
   - the same pro sent the same job twice;
   - a payout missing;
   - a tip recorded as paid that never was;
   - a notice with "NaN" or "undefined" in its text.
3. **Real people, real taps, on a phone.** A customer books a pro and pays. The pro confirms, leaves, arrives and finishes. The customer completes the job with a tip and leaves a review. Every step is a real tap on an iPhone-sized screen, as a person would do it, not a shortcut through the server.

Below is what these found and what I changed.

## Background checks could run twice at the same time
Trothen runs about 46 timed checks in the background, for example:
- sending open jobs to newly available pros;
- the arrival reminders;
- the payment-code reminders;
- the unstarted-booking check.

On a slow moment (a payment provider taking long to answer, say), the next run could start before the last one had finished. Two runs at once could:
- send the same job to the same pro twice;
- send the same reminder twice;
- tell the customer twice.

**Now each check runs only once at a time.** A run that is called while the same check is still going waits for it instead of starting another. This applies to every timed check, not only the ones where I saw the problem.

## A job was sent on and on
A job nobody answered was sent to a few more pros every 10 minutes, with no limit. **A job now goes to at most 15 pros in all,** counting those it was sent to when it was posted. This is the same practice as Thumbtack and Bark: enough choice for the customer, without spraying one job at every pro in the country.

## Pros now also hear about new job matches by email
A lead a pro sees hours late is usually a job lost, so Thumbtack, Bark and TaskRabbit email every lead.
- New job matches are now emailed too, with the same rules as other update emails from v158:
  - not while the pro has Trothen open;
  - at most 8 an hour;
  - never the same email twice;
  - "Email me updates" switches them off.
- The setting's wording for pros now mentions job matches.

## A wrong notice for drivers with a Driver Pass
When a driver with a Driver Pass accepted a cash ride, they were told "NaN tokens of commission were taken … Balance: undefined tokens". A pass means no commission is taken, so there is nothing to report. **That notice is no longer sent when no tokens were taken.** The consistency checker found this one.

## The booking confirmation screen
The real taps on a phone found three things:
- **It said "Booking Confirmed" while the pro hadn't confirmed yet.** The line underneath said "Your pro will confirm shortly". It now reads **"Booking request sent"**, then: "Your pro has been asked to confirm, and we'll tell you as soon as they answer."
- **Long details ran into their labels on a phone,** for example "ServiceFix the kitchen lights" and "Where12 Ring Road". Each label now has clear space, and the value wraps neatly on the right.
- **The only button was "Back to Explore".** There is now a main **"View my booking"** button that opens the booking itself (its status, chat with the pro, paying, cancelling), with "Back to Explore" under it.

## "Leave Now" was offered days before the job
A pro saw "Leave Now" (or "On My Way") two days before the job. A tap by mistake told the customer the pro was on the way, and started a live trip, days early.
- The button now appears from **12 hours before** the job.
- The server also refuses an earlier start, with the job's date in the pro's own time zone.

## The "Install the Trothen app" banner covered pop-ups
On a phone it sat on top of the review form and hid its Submit button. It now stays hidden while any pop-up is open, and comes back after.

## The phone screens Walter sent: lined up
- **A posted job's card in My Bookings** had its text squeezed to one word a line, with the "Materials for this job" button floating over the title.
  - The cause: that button was added after the card's text column instead of under it, so it took a column of its own.
  - It is now in the card's row of buttons.
  - The buttons follow the usual order: **View Responses** first, then **Materials for this job**, then a quieter red **Cancel Request** last.
- **"Live now in" on the home page** sat in uneven, lopsided rows.
  - An older style rule gave every item a wide side margin, including the country chips.
  - Now "Live now in" has its own centred line, and the countries sit under it with even gaps.
- **The welcome card's "My Bookings" button** broke onto two lines. Both buttons are now the same height, on one line each.
- **The chat bubble** stayed exactly where it was let go after being moved, even half off the screen's edge over the words.
  - Like chat bubbles in other apps, it now settles on the nearest side, 16 px in, clear of the top bar and the bottom tabs.
  - A place saved before this update is tidied the same way.

## More gaps found on phones, with a new layout checker
I wrote a checker that opens every page of the customer's and the pro's dashboards, and the home page, on an iPhone 13 and on the smaller iPhone SE. It looks for:
- words squeezed one per line;
- things on top of each other;
- words cut off or shortened with "…";
- anything wider than the screen.

It found, and I fixed:
- **The pro's store:** the status line ("Not set up yet. Give your store a name and press Save.") ran off the card's edge. It now wraps inside the card. The ON/OFF switch's help line also now goes under the switch on a phone.
- **The bottom tabs on an iPhone SE** showed "Messag…". Every tab label now shows in full.
- **Long kinds of work on the home page** were cut to "HVAC & Air Con…". They now take two lines.

After the fixes, the checker's only finding is the location button inside the "in" box, which is meant to be there.

## Paying for extra work at the very moment the job is completed
The everything-at-once check, run on Postgres, found a real gap.
- If the team confirmed a customer's payment for extra work at the same instant the customer pressed Complete:
  - the job's total could include the extra;
  - while the extra's payment was marked as stopped.
- So the records disagreed about money that had arrived.

The money for extra work or a tip is now recorded while its booking is held, so the two can't happen at once.
- **Payment first:** the extra is added, and Complete then pays it to the pro with the job.
- **Complete first:** the late payment is refunded to the customer.
- **Complete and Cancel wait** the second or two this takes, instead of answering "try again".

## What the consistency checker found that was not a fault
Some findings came from records the tests themselves write directly into the database to set up a situation (for example, money already held on a booking the test marks as cancelled). I checked each one against the test that made it:
- tc, tc2 and tc3;
- t147, tchecks and t149;
- tfares and tlic;
- t158.

None of them came from a path in the app.

## Other checks that came back clean
- **Pressing the same button many times at once, all handled once each:**
  - approving the same extra work 5 times;
  - confirming the same payment 3 times;
  - Complete with a tip 4 times;
  - the same booking sent 4 times;
  - paying extra work at the very moment the job is completed: the money is either added and paid, or refunded, never lost.
- **Access between accounts.** 17 places the access test marked "to review" were all safe: each one shows only the person's own records, or a public profile.

## What I tested
- **New `trace160` (10 checks):** everything at once, as above.
- **New `tlayout`:** every dashboard page and the home page on an iPhone 13 and an iPhone SE, as above.
- **New `tjourney` (18 checks):** the full phone journey with real taps, as above, including:
  - no "Leave Now" two days ahead;
  - the server refusing an early start;
  - no install banner over the review form;
  - no page errors on either phone.
- **The new consistency checker,** run after every suite.
- **Every earlier suite,** on the file store and on Postgres. The end-to-end booking test (`te2e`) now moves the job to within the hour before the pro presses "On my way", as the new 12-hour rule needs.

## Files
- **New:**
  - `src/single-flight.js` (a check never runs twice at once)
  - `CHANGES_v160.md`
- **Changed:**
  - `server.js` (every timed check runs once at a time)
  - `src/job-backfill.js` (at most 15 pros per job; job matches emailed)
  - `src/email-notify.js` (job matches can be emailed)
  - `src/arrival-time.js` (reminders run once at a time)
  - `src/customer-payments.js` (reminders run once at a time; extra-work and tip payments recorded while the booking is held)
  - `src/routes/marketplace.routes.js` (the Driver Pass notice)
  - `src/routes/payments.routes.js` ("Leave Now" from 12 hours before; Complete and Cancel wait for a payment being recorded)
  - `src/contract-locks.js` (holding a booking while the money for its extra work or tip is recorded)
  - `public/app/market.js` (the Materials button in the job card's row of buttons)
  - `public/app/trothen.js` (the "On My Way" button from 12 hours before; the email setting's wording; the posted-job card; the chat bubble settling on a side; the store's status line)
  - `public/app/arrival.js` (the "Leave Now" button from 12 hours before)
  - `public/app/es-v152.js` (Spanish for the new wording)
  - `public/index.html` (the confirmation screen, the install banner, the phone alignment fixes, fingerprints refreshed)

No database changes, no new packages.

## For you (not code)
- **Set APP_URL on Render to https://trothenpro.com** (if it isn't already), so links in emails point to the right place.
- **Job-match emails add to the number of emails sent.** If Namecheap's per-mailbox sending limit is reached as Trothen grows, move to a sending service (SendGrid is already supported).
