# Trothen v173: signing out when idle

v173 goes on top of v172, which is live.

## What you asked
"Can we have the session close after 5 minutes of not being active, or best practice?"

## What was there before
- The page signed a person out after 20 minutes without activity, for everyone.
- Only the page checked it. If someone closed the tab on a shared computer, or left a laptop asleep, the session stayed valid on the server for up to 7 days. Opening Trothen again in the same browser session could come straight back into the account.
- The "Signed out after 20 minutes" message was hidden by the plain "Signed out" message, so people didn't see why.

## What I did, and why not 5 minutes for everyone
Five minutes for everyone would sign out a driver waiting for a ride request, a pro writing a long quote, or a customer filling in Post a Job. The standards set the time by how much is at risk:
- OWASP (the web security standard) recommends 2 to 5 minutes for high-value systems and 15 to 30 for lower-risk ones.
- PCI DSS (the card payment standard) says 15 minutes at most.
- NIST SP 800-63B (the US government's sign-in standard) says sign in again at least every 12 hours for accounts like admins.

So:
- **Admins: 5 minutes.** Admins see ID documents, money and everyone's data. This is the 5 minutes you asked for, where it matters most.
- **Customers and pros: 15 minutes.**
- **Admins sign in again every 12 hours,** even if they're active the whole time.
- **One minute before**, a "Still there?" box appears with a countdown and a **Stay signed in** button. Moving the mouse, tapping or typing also keeps the session.
- **The server now checks it too.** Background updates (new messages, live ride updates) don't count as activity. Only the person touching, typing or scrolling does, and the page tells the server at most once a minute. A tab closed on a shared computer, or a laptop left asleep, can't come back to an open account. Opening it later finds the account signed out.
- **Not counted as idle:**
  - being on a call;
  - a ride or job with location on (the driver waiting online, a pro on the way, a customer sharing their location);
  - "Keep me signed in" ticked on a personal phone. It's ticked by itself on phones and the installed app, as with Uber or a bank's app. It **never** applies to admins.
- **You can change it:** Admin → Settings → **Signing out when idle** (super admin only).
  - Admins: 2 to 30 minutes.
  - Customers and pros: 5 to 120 minutes.
  - Each change is written in the access log.
- **Nobody is signed out by the deploy itself.** Sessions from before v173 start counting from the person's next touch.
- The warning and the sign-out message are in Spanish for Spanish users.

## Tests
- `t173` (new), 29 checks:
  - the 5 and 15 minute limits;
  - the server refusing an idle session and deleting it;
  - background requests not keeping a session open;
  - "Keep me signed in" respected for customers and pros but not admins;
  - admins signed out after 12 hours;
  - old sessions not signed out by the deploy;
  - only the super admin can change the limits, within range, and each change is logged.
  - In the browser: the "Still there?" countdown, Stay signed in, the sign-out with the reason, a tab reopened 40 minutes later staying signed out, the warning in Spanish, and the admin setting.
- Every earlier suite, on the file store and on Postgres.

## Files
- `src/auth.js` (the server check)
- `src/routes/auth.routes.js` (the "person is here" signal)
- `src/routes/admin.routes.js` (the setting)
- `src/platform-settings.js` (the limits)
- `public/app/trothen.js` (the timer, the warning, the setting panel)
- `public/app/calls.js` (a call counts as activity)
- `public/app/es-v152.js` (Spanish)
- `public/index.html`

No database changes and no new packages.

## What is yours to do (not code)
- Nothing is required. If 5 minutes turns out too short for your admin team, raise it in Admin → Settings → Signing out when idle (10 to 15 is still within best practice).
- Tell admins that Trothen now asks them to sign in again after 5 minutes without use and every 12 hours, so they aren't surprised.
- Your Privacy Policy or Terms can say that sessions end after a period without activity. That's optional, and no lawyer is needed for it.
