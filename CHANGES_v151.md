# Trothen v151: a third recheck, covering privacy, people with disabilities, and attacks on sign-in

What Walter asked: "re-verify everything and make sure everything is working, recheck for all gaps, and if there is something missing please check, to make a perfect system".

## How I rechecked this time
The first two rechecks (v149, v150) tested whether everything works and stays up. This one tests the things a careful outside reviewer or a regulator would look at.

1. **Can one person see or change someone else's things?** Every one of the 187 server routes that names a booking, payment, payout, dispute or account was called by two outsiders (a customer and a pro who had nothing to do with it), using real ids.
   - **Result:** nothing of the owners was seen or changed. The 17 calls that succeeded only showed the caller's own information, or information that is public anyway.
2. **What do pages give away?** 139 read-only routes were read as nobody, a customer and a pro, and every answer was searched for private details (email, phone, address, exact location, ID documents, payout numbers, passwords, codes).
   - **Two gaps were found and fixed.** See "Privacy" below.
3. **Can people with weaker eyesight, or people using a screen reader or only a keyboard, use the app?** I used axe-core, the standard checker for WCAG 2.1 AA (the international accessibility standard), on 46 screens at phone and computer size:
   - home, sign-in and sign-up;
   - the customer's Overview, Bookings, Payments, Messages and Settings;
   - the pro's Overview, Jobs, Earnings, Store and Settings;
   - the admin's Overview, System Check, Users and Payments.
   - **Result:** it found 11 kinds of problem at first, all fixed. It now finds **0**. See "Accessibility" below.
4. **Server security settings and attacks on sign-in.** I checked the security headers, which other websites may use the API, the limits on wrong tries, and how codes are made.
   - **Six gaps were found and fixed.** See "Security" below.
5. **Every earlier test, run again.**

## Privacy
- **A pro's exact location was public.** Anyone could read a pro's exact GPS position (to about 1 metre) from their public profile, and for many pros that's their home.
  - **Now:** the public profile shows the area only, rounded to about 1 km. Distances and "near you" still work.
  - The exact place is shared only as before: with a customer once a booking is confirmed.
- **A pro's postal code was public.** It's no longer on the public profile. "Same community" matching still works, because it's worked out on the server.
  - This follows the data-minimisation rule (GDPR, and Liberia's own data protection direction): share only what's needed.

## Accessibility (WCAG 2.1 AA)
| Problem found | Who it affected | Fixed |
|---|---|---|
| Most form fields weren't linked to their label (Settings, Payments, Earnings and more) | Screen-reader users heard "edit text" instead of "Full Name". Tapping a label didn't put the cursor in the field. | Every label is now linked to its field. Every field without a visible label (date filters, on/off switches, network pickers) has a spoken name. |
| The side menu (Overview, Bookings, Payments…) couldn't be reached with the Tab key | Keyboard-only users couldn't move around the app at all | Every menu item can be reached with Tab and opened with Enter or Space. The open page is announced as "current page". |
| "Buttons" made from boxes (cards, notifications) worked with Enter but not Space | Keyboard users | Enter and Space both work, like a real button. |
| Some green text was too pale (the badges, "Available", "✓ goal met", "Online") | People with weaker eyesight, or on a phone in bright sun | Darkened to meet the 4.5 : 1 contrast standard. In dark mode the badge text is lighter. |
| White initials on some avatar colours (gold) were hard to read | Same | Darkened automatically until readable. |
| The search box, the progress bar, the Messages filter and the "How Trothen checks" cards were described wrongly to screen readers | Screen-reader users | Each one is now described correctly. |
| Wide tables on a phone couldn't be scrolled with the keyboard | Keyboard users | They can now. |

## Security
The headers were already strong. These were already in place, and the test now checks them every time:
- the content security policy;
- HTTPS-only (HSTS);
- no MIME sniffing;
- no framing by other sites;
- the referrer policy;
- the permissions policy;
- no "powered by" header.

The gaps found:
1. **Any website could read the API from a visitor's browser** (the CORS setting was "any site").
   - **Now:** only Trothen's own pages can. This works whichever address is used: trothenpro.com, www.trothenpro.com or the Render address.
   - Payment-provider webhooks, mobile money callbacks and server-to-server calls are unchanged, because they don't come from a browser.
2. **A 6-digit code could be guessed many times.** The sign-in code (two-step sign-in), the sign-up email code and the phone code were only limited per internet address, so someone using many addresses could keep guessing.
   - **Now:** each code allows **5 wrong tries**, then it's finished and a new one is needed. It also says "3 tries left".
   - This is the OWASP and NIST 800-63B rule.
3. **The phone-code check had no limit at all.** Now it does.
4. **Phone codes could be sent over and over.** Each text message costs money, and repeated sending is a known fraud ("SMS pumping").
   - **Now:** one code per 30 seconds, and no more than 5 an hour, for each account.
5. **Codes were made with `Math.random`,** which is not secure for codes. Sign-in, phone and booking codes now use the secure random number generator (`crypto.randomInt`).
6. **The sign-in limit could block real people in Liberia.** Many phones on the same mobile network share one internet address (carrier NAT). The old limits counted everyone behind that address together: 10 sign-ins per 15 minutes, and 8 sign-ups an hour. On a busy afternoon on Orange or MTN, real customers would have been told "too many attempts".
   - **Now:** only *failed* sign-ins count. The limit is 30 per 15 minutes for each address, and 30 sign-ups an hour.
   - Each account still locks itself after a few wrong passwords, as before. So guessing one person's password is just as hard, and guessing across many accounts from one address is still stopped (tested).

## What's still a business step, not code
- **An outside penetration test before you take large volumes of real money.** My tests are thorough, but a licensed security firm's report is what banks, MTN, Orange and the Central Bank of Liberia may ask to see. Plan for this once real payments are live.
- **A data protection notice and contact person.** The app already lets people download and delete their data. Name a person to answer privacy questions, and add their email address to the Privacy page.
- **Accessibility statement (optional but good practice):** a short page saying "Trothen aims to meet WCAG 2.1 AA; contact us if something doesn't work for you".

## What I tested
- **`t151` (17 checks):**
  - the public profile shows only the area, with no postal code, phone or email;
  - another site can't read the API, and Trothen's own page still can;
  - all security headers are present;
  - a sign-in code is finished after 5 wrong tries, and then even the right one fails;
  - the same for the sign-up code and the phone code;
  - phone codes once per 30 seconds and 5 an hour;
  - 35 correct sign-ins from one shared connection are never blocked, while guessing across many accounts is stopped;
  - codes use secure random numbers.
- **`ta11y`:**
  - axe-core WCAG 2.1 AA on 46 screens at phone and computer size finds 0 serious problems;
  - the menu works with the keyboard;
  - a screen reader reads "Full Name" on the Settings field.
- **`tidor`:** 187 routes with ids, called as outsiders. Nothing of the owners was seen or changed.
- **`tleak`:** 139 routes read as nobody, a customer and a pro. Nothing private found.
- **All earlier suites,** including the 4,250-call fuzz test and the every-screen crawl on phone, tablet and computer.

## Files
- **New:**
  - `CHANGES_v151.md`
  - `public/app/a11y.js`
- **Changed:**
  - `server.js` (which websites may read the API)
  - `src/routes/auth.routes.js` (code tries, phone-code limits, secure codes, sign-in limits for shared connections)
  - `src/routes/marketplace.routes.js` (the public profile, secure booking numbers)
  - `public/index.html` (search box, "How Trothen checks" cards, badge contrast, a11y.js added, fingerprints refreshed)
  - `public/app/trothen.js` (menu, date filters, green text)
  - `public/app/checks.js` (progress bar name)
  - `public/app/chats.js` (Messages filter)
  - `public/app/rides.js` (the "Online" colour)
  - `public/app/price-units.js` (green text)
