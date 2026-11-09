# Trothen v149: a full recheck for gaps

What Walter asked: "recheck everything and fix all the gaps".

## How I rechecked
1. **Every action that changes data is protected.** I went through every route that saves, changes or deletes something and checked it needs a signed-in person with the right role. They all do: the ones that looked open are protected for the whole admin area, or by a team gate.
2. **Every screen opens cleanly.** A new automatic test opens every section for a customer, a pro (with a store, and driving) and the super admin, on a phone and on a computer: 106 sections in all. On each one it checks for:
   - page errors;
   - server errors;
   - "undefined", "NaN" or "[object Object]" on screen;
   - sideways scrolling;
   - empty sections.

   All clean.
3. **Money totals** (Admin finance and by-region): only money that really arrived is counted. Unpaid, expired and refunded payments are left out.
4. **Packages:** `npm audit` reports 0 known security problems.
5. **Every earlier test, run again:** all 36 earlier test suites, from v128 to v148. All pass.

## Gaps found and fixed
- **A seller could see an unpaid goods order in their Bookings list.** It was already hidden from their store orders, but not from the general Bookings list. It is now hidden everywhere until it is paid.
- **One receipt could have confirmed two payments.** If two finance staff pressed Confirm at the same moment, on two different codes, with the same transaction ID, both could pass the "already used" check. Now only one confirmation runs at a time for a code or a transaction ID. The other is told someone else is confirming it.
- **New System Check: "Money and bookings agree".** If a step ever stops halfway (the server restarts in the middle of it, or an error), the booking and its money can go different ways. Nothing checked for this before. Every 15 minutes it now looks for:
  - money still held on a booking that was cancelled, declined, expired or completed;
  - a booking going ahead when its money was refunded or never paid;
  - money held while the booking still says "waiting for payment";
  - two payments held for one booking.

  When it finds one, the super admins and finance are alerted with the booking numbers, the likely cause, and what to do.

## What I tested
- **`t149`, the gaps above (8 checks):**
  - an unpaid order is hidden from the seller everywhere;
  - two simultaneous confirmations with one receipt: exactly one goes through;
  - System Check finds money stuck on a cancelled booking, and a booking going ahead with its money refunded, gives the cause and fix, and alerts the super admin.
- **`tcrawl`, every section for 3 roles on a phone and a computer (6 checks, 106 sections).**
- **All 36 earlier suites.**

## Files
- **New:** `CHANGES_v149.md`
- **Changed:**
  - `src/routes/marketplace.routes.js`
  - `src/customer-payments.js`
  - `src/system-check.js`
