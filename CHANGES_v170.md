# Trothen v170: everything re-checked, and Spanish finished

v170 goes on top of v169. If v166 to v169 aren't live yet, this one package deploys them too.

## What you asked
"Make sure everything is perfect and all gaps are fixed, just reverify if we have left anything out."

## What I re-checked
1. **Every request from 15 and 16 November**, against what was built and its test. All 26 are done and tested:
   - receipts and the exact location;
   - the trip-length message;
   - receipts for every transaction;
   - stability, and "Keep me signed in";
   - My fares, chats closing, pros booking rides, going online;
   - the Uber-style ride choice, maps and quick pinning;
   - the screen walkthrough, and Google Maps;
   - the Liberia sign-up, the ID next-steps message, guarantors and membership;
   - place search, grey maps, and ride stability.
2. **Every screen, with your live site's settings:** every section for a customer, a pro and an admin (57 in all), on a phone and on a computer, with the browser helper on as on trothenpro.com, in English and in Spanish.

   On each screen the check looked for page errors, server errors, words like "undefined" or "NaN", and pages wider than the screen. On a phone it also left each screen alone for 12 seconds, counting its requests, to catch any refresh that piles up like the ride one did. **All clean.**
3. **Every payment and booking record left by the tests**, through the data-consistency check. The only flags were records the tests create on purpose. None came from a real ride, delivery or payment.
4. **The code changed in v166 to v169**, for anything left unfinished. None found.

## What the re-check found, and I fixed
### Spanish was missing in many places
Trothen has a Spanish version (the EN/ES button). **754 sentences had no Spanish**, so they showed in English. They were:
- most of the Rides page ("Where to?", "Use my location", "Find drivers near me", the ride steps);
- the driver's screens;
- the payment and checkout windows;
- tokens;
- price offers;
- reviews;
- parts of admin.

The customer's long sentences were already translated, which is why it looked Spanish at a glance.

**Now:**
- All 754 have Spanish.
- So do the new pieces from v166 to v169: the membership cards, the guarantor form and its kinds of guarantor, the driver's document names, and "required/optional".
- On the screens checked, the Spanish pages show no English.
- A new test fails if anyone adds a sentence without Spanish.

A guarantor's relationship chosen in Spanish ("Hermano", "Familiar") is now also recognised as family by the team's checks.

**One limit:** messages written by the server, such as some error messages, emails and notifications, are still in English. Translating those is a bigger piece of work (the server would need to know each person's language). Tell me if your Spanish-speaking users need it.

## Tests
- **`tcrawl2` (new):** every section for customer, pro and admin, on a phone and a computer, with the browser helper on, in English and Spanish. On a phone each screen is also left alone for 12 seconds, counting its refreshes.
- **`tescover` (new):** every sentence in the page code has Spanish.
- **Every earlier suite**, on the file store and on Postgres.

## Files
- `public/app/es-v152.js` (Spanish)
- `public/app/trothen.js` (membership cards and guarantor form set up for translation)
- `src/guarantor-check.js` (Spanish family words)
- `public/index.html`

No database changes and no new packages.

## What is left, and it is yours (not code)
The same list as before, in one place:
- **Maps:**
  - Google Maps Platform: switch on billing and the four map services, restrict the key to them, set a budget alert, then add `GOOGLE_MAPS_API_KEY` on Render;
  - or use Mapbox instead: add `MAPBOX_TOKEN` on Render.
- **Admin → Rides → Places:** pin Red Light, ELWA Junction, Duala, Broad Street and Rehab first.
- **Admin → Rides → Fares:** check the L$ starter fares with Joseph, and add the fuel pump price.
- **Membership prices:** Plus is poor value next to Pro. Consider hiding memberships until real payments are on.
- **Guarantors:** clean up the old ones like "hhgshhs" ("Put back to call" or "Not accepted").
- **Twilio** for text messages (receipts, ID updates), if you want them.
- **Your accountant:** whether receipts need GST/VAT details.
- **A lawyer:** review the Ride Rules, and the papers required from drivers.
