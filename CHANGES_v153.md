# Trothen v153: a fourth, deeper recheck before people start using it

What Walter asked: "do a recheck and full verification once more to fix all remaining gaps that might have been overlooked … look very deep into each line and code to make sure everything is aligned and perfect so people can start using the system."

## Where I looked this time
The first four rechecks covered these areas:
- **v149:** payments.
- **v150:** bad input, every screen and speed.
- **v151:** privacy, accessibility and sign-in security.
- **v152:** wording.

This one went where those didn't.

1. **Every line read by a code checker.** I used ESLint, the standard tool. It reads all the code, about 26,000 lines in the app's screens plus all of the server, looking for:
   - names that don't exist;
   - code that can never run;
   - the same key written twice;
   - other mistakes a person reading line by line would miss.

   I also checked that each of the 1,207 buttons and links in the app calls something that exists.
2. **The same button pressed many times at once.** Double-taps, a weak signal that sends a request twice, the same account open on two phones, and two staff members pressing at the same moment. All of these were tested on money actions: accept, complete with a tip, payout, payout sent, review, extra charge, loyalty points, token payment, and complete against cancel.
3. **The live database type.** Every earlier test ran on the simple file store. Your Render server can run on **Postgres** instead (when `DATABASE_URL` is set). So I installed Postgres 16 here and ran **every test suite again on Postgres**, including:
   - the 4,256-call bad-input test;
   - every screen at three sizes;
   - accessibility;
   - privacy and security.
4. **The timed jobs, with the clock moved forward:**
   - expire unanswered bookings;
   - auto-complete finished jobs;
   - the day-before reminder;
   - cancel unpaid bookings;
   - and 12 more.

   Each one ran twice, to prove a second run never does anything twice.
5. **The app in Spanish,** every section, on a phone.
6. **Duplicate screen element names** (the cause of an old bug where Sign Out only worked from the home page), on every screen for every role.

## What I found and fixed
### 1. On Postgres, a double-tap could do some things twice (the important one)
On the file store, one request always finishes before the next starts, so these never showed up. On Postgres, requests really run side by side, and the race test found three that went through more than once:
- **A review sent 6 times at once:** 6 reviews were saved, and 4 extra loyalty points were given.
- **25 loyalty points used on 3 bookings at once:** all 3 got the free service fee.
- **A payout marked "sent" 6 times at once:** the pro got the "your payout was sent" message 6 times.

Two staff confirming the same token payment at once also caused a server error.

**The fix has two parts:**
- **One change at a time for each account.** When the same account sends two changes at the same moment, the second waits until the first has finished. It then sees the first one's result and answers "already done", as if it had been sent a second later.
  - This covers every action in the app at once, not just the ones I tested.
  - Different people never wait for each other, and pages that only show information never wait.
  - Nobody waits more than 20 seconds.
  - Calls and live location are left out, because they need to be instant.
- **One staff member at a time on shared items.** If two staff press at the same moment on the same item, the second is told "someone else is working on this right now". This covers:
  - token payment codes;
  - customer payment codes and refunds;
  - disputes;
  - store returns;
  - payouts.

**After the fix:** all 10 race tests pass on Postgres and on the file store.

### 2. The timed jobs could clash with a person
- **What could clash:**
  - "Complete by itself" could run at the same moment the customer pressed Complete or Cancel.
  - "Expire unanswered booking" could run at the moment the pro pressed Accept.
  - "Cancel unpaid booking" could run while finance was confirming that payment, or while the customer was saying they had paid.
- **Now:** each timed job locks the booking and reads it again first, so it acts on how things are at that moment.
  - If a person is changing that booking right then, the timed job leaves it for its next round (5 to 60 minutes later).
- **Tested:**
  - each job runs once and tells people once;
  - running it again changes nothing;
  - a booking someone is answering is left alone;
  - a reported problem stops auto-complete;
  - "I've paid" stops the unpaid-booking cancellation.

### 3. Searching "All pros" could break
On the All pros page, a search word that wasn't part of a pro's name, job title or tags stopped the search with an error ("needle is not defined"). Searching by skill, for example "pipe" or "wiring", didn't work. The code checker found it, and a new test proves it: the test fails on the old code and passes now.

### 4. The pro's dashboard was half in English for Spanish users
The customer's dashboard had a Spanish translation layer; the pro's didn't. It now has one, and the 72 lines that were still in English on either dashboard now have Spanish.
- **Before:** 72 English lines on a Spanish dashboard.
- **After:** 1 (a phone-number hint).

### 5. Smaller fixes
- **Payout messages:** a payout message could say "MTN Mobile Money •••• undefined" if the last 4 digits were missing. It now leaves them out.
- **Token confirmation:** if a token payment was confirmed twice, the second answer caused a server error. It now gives a clear "already confirmed".

## What was checked and found clean
- **Server code:** the code checker found no real mistakes, such as a missing name, code that can never run, or a key written twice.
- **The app's screens:** 1 real mistake, the search above. The other warnings were the app's normal way of extending its own functions.
- **Buttons and links:** all 1,207 call something that exists.
- **Duplicate element names:** none on any screen, for the customer, the pro or the admin.
- **Postgres:** every suite passes. The one exception is a test that edits the file store directly, so it can't run on Postgres.

## What's still yours to do (not code)
- **One server.** The "one at a time" protection works inside one server, which is how Trothen runs on Render now. If you ever scale to two or more servers, tell me first: the locks then need to move into Postgres.
- **Which database the live site uses.** Check Render → trothen-api → Environment. If `DATABASE_URL` is set, you're on Postgres, and this version's double-tap fix matters most. If it isn't set, you're on the file store; the fix is still in place for when you move.
- **From the earlier lists:**
  - the footer support address;
  - the homepage support number;
  - your lawyer's review of the Terms and Privacy Policy;
  - a penetration test before large real payments.

## What I tested
- **`trace` (10 checks)** is the same-moment test. It runs on Postgres and on the file store:
  - accept;
  - complete with a tip;
  - payout;
  - payout sent;
  - review;
  - extra charge;
  - loyalty points;
  - a token payment confirmed by two staff;
  - complete against cancel;
  - and System Check confirming every booking's money still matches afterwards.
- **`tsweep` (10 checks):** the timed jobs with the clock moved forward, run twice, on both databases.
- **`t153`:**
  - searching All pros by skill;
  - a word that matches nobody;
  - the pro's Earnings page in Spanish.
- **Every earlier suite,** on the file store and again on Postgres.

## Files
- **New:**
  - `CHANGES_v153.md`
  - `src/request-queue.js` (one change at a time per account; one staff member at a time on shared items)
- **Changed:**
  - `server.js` (turns those on)
  - `src/contract-locks.js` (a shared "wait until free" helper for timed jobs)
  - `src/booking-scheduler.js`, `src/customer-payments.js` and `src/routes/payments.routes.js` (timed jobs lock the booking; the payout lock)
  - `src/routes/custpay.routes.js` ("I've paid" locks the booking)
  - `src/routes/tokens.routes.js` (no error on a repeated confirm)
  - `src/payout-methods.js` (no "•••• undefined")
  - `public/app/trothen.js` (the All pros search)
  - `public/app/es-v152.js` (Spanish for the pro's dashboard)
  - `public/index.html` (fingerprints refreshed)

No database changes, no new packages and no new settings.
