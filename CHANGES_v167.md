# Trothen v167: sign-up that fits Liberia, next steps after sending an ID, guarantors organized, membership that says what it gives

v167 goes on top of v166. If v166 isn't live yet, this one package deploys both.

## 1. Sign-up: the address follows each country's own format
**What you saw:** with Liberia chosen, the form still asked for a "Zip / Postal Code". It called the counties "State / Region", and suggested "e.g. Philadelphia" for the city.

**The standard:** Android, Chrome and most checkout forms use Google's address data for every country (libaddressinput), which follows the Universal Postal Union's formats. That data says what a country's divisions are called and whether postal codes are used. I followed it.

**Now, for Liberia:**
- No postal code box at all, and the city box takes the whole row. Liberia has 4-digit codes on paper, but nobody uses them day to day: post goes to P.O. boxes. Ride and delivery apps there don't ask for one either.
- "County", with "Select your county".
- "City or town", with "e.g. Monrovia".
- Once you pick a county, the city box suggests its towns. Montserrado suggests Monrovia, Paynesville, Brewerville, Bensonville, Careysburg, Gardnersville and Johnsonville; Margibi suggests Kakata, Harbel, Marshall and Dolo Town; and so on for all 15 counties. Any other town can still be typed.

**Other countries:**
- The US asks for a "ZIP code", the UK for a "Postcode" and India for a "PIN code".
- Nigeria and Kenya show the postal code as optional, because most people there don't use one.
- Ghana, Sierra Leone and about 60 other countries without postal codes in daily use show no box at all.
- Regions are called by their own names: Region in Ghana, Province in Canada, County in Kenya, Parish in Jamaica, and so on.
- The customer's Settings page follows the same rules.

**A bug fixed on the way:** some town names exist in two countries, like Greenville (South Carolina, and Sinoe County). Such a town could be refused for one of them. Both are now accepted.

## 2. After sending an ID: a message with the next steps
**What you saw:** "Submitted, awaiting review" and nothing else. The person was told nothing; only the reviewers were.

**Now, as soon as the ID is sent, the person gets:**
- **An email**, "We received your ID: what happens next", which says:
  1. We check the ID against their photo, usually within 48 hours, with the day and time it will be done by.
  2. We tell them when it's done, by email and in Trothen.
  3. What opens once approved: booking pros and posting jobs for a customer; "ID checked" and search for a pro.
  4. If something needs fixing, we say exactly what, and they send it again from the same page.

  It also says what they can do while they wait, has a safety line (Trothen never asks for an ID or password by phone, WhatsApp or email), and gives support@trothenpro.com.
- **A notice in Trothen** with the same short message.
- **A text message**, once Twilio is set up.
- **The same steps on the Verification page itself**, under "Submitted, awaiting review".

If the name on the ID doesn't match the account name, the email says a person will look closely and it may take a little longer.

**When the team decides:**
- **Approved:** an email "Your ID is verified", with what they can do now. A pro without a photo is told to add one.
- **Not approved:** an email with the reason the reviewer typed and how to take better photos, with a button to send the ID again.

These emails go out whatever the person's email settings are, because they are about their own account, not marketing. They replace the short automatic email, so nobody gets two.

## 3. Guarantors to Call, organized
**What you saw:** one long table, with the pro's name only on their first row. Numbers had no country code ("088900998"), so tapping one from outside Liberia dialled the wrong country. Entries like "hhgshhs" / "ssddffdd" were marked verified, with no way to see who had checked them or what was said.

**Now:**
- **Tabs with counts:** To call, Verified, Not accepted and All, plus a search box. The people still waiting for a call come first.
- **One card per pro:** name, trade, town and country, "1 of 3 verified", and whether their ID is verified. A note shows if all their guarantors are family.
- **Each number in international form**, written in groups the way it is read out (+231 88 900 998), with **Call** and **WhatsApp** buttons that work from any phone, in any country.
- **Things to check before calling**, said plainly:
  - a name that isn't a full name;
  - a number too short for the country;
  - an unclear relationship.

  These come on top of the existing warnings: the pro's own number or name, or a guarantor shared with other pros.
- **Marking one Verified or Not accepted asks what was said on the call.** For example: "Former boss, 4 years, would trust him in her home." That note, who marked it and the date show on the card. Each change is kept, the last 10.
- **"Put back to call"** undoes a mistake.
- **On a phone**, each guarantor's details stack in one column.

**For the pros:** when they enter guarantors, Trothen now asks for:
- a full name (first and last);
- a number with all its digits for their country, or written with its own +country code;
- how the person knows them, chosen from the usual kinds (past employer, client, landlord, pastor or imam, community leader, teacher, co-worker, neighbour, friend, family member) or typed.

The form explains that at least one guarantor should not be family. That is standard reference-check practice: family vouching for family proves little. A changed name on a saved guarantor now counts as a new person to call, instead of keeping the old "verified".

**Your step:** the guarantors already marked verified with names like "hhgshhs" now show the checks in amber. Use "Put back to call", or "Not accepted" with the reason, so the pro is asked for a real person.

## 4. Trothen Membership: real figures, and what it really gives
**What you saw:** Plus at L$720 "about $9.99". L$720 is about US$3.80, not $9.99. The "about $" figure was typed into the page and never followed the real price. The cards also promised "priority features", "premium support" and "maximum customer benefits", none of which exist in Trothen.

**What a membership actually does (and always did):** it takes a share off Trothen's service fee on bookings with pros. That fee is 9% of the job, at least US$2.99 and at most US$25. Plus takes 20% off, Pro 40%, Elite 60% and VIP 80%. The pro is paid the same either way.

**Now each card shows:**
- the price in the customer's own money (L$), and "about US$…" worked out from that same price;
- "20% off the service fee" (or 40%, or 60%);
- "Pays for itself if you spend about L$… a month on bookings with pros", so a customer can judge whether it's worth it;
- a line saying where the discount applies (bookings with pros) and where it doesn't (rides, deliveries, Market goods, cash bookings, which have no fee).

The welcome notice after subscribing says the same, in L$. Consumer-protection rules for subscriptions (the US FTC's, the EU's) require exactly this: say plainly what is bought, at what price, and how to cancel.

**On the admin side:**
- Admin → pricing shows what each tier gives, and how to work out when it pays for itself.
- A price that would make Pro cheaper than Plus, or Elite cheaper than Pro, is refused, with the reason.

**Business decision for you (not code):** at the prices on your screen, Plus is poor value next to Pro. Plus needs about L$41,800 of bookings a month to pay for itself, while Pro needs only about L$26,600, because Pro doubles the discount for only a little more money. Two common fixes:
- price each tier in step with its discount (for example L$500, L$1,000 and L$1,500);
- or drop Plus.

Separately, while payments are in test mode, choosing a membership charges nothing but already gives the discount. Consider hiding memberships until real payments are on.

## 5. Place search forgives how people type
**What you saw:** "Redlight neezo" gave "Not found".

**Why there were two causes:**
- The search wanted the exact spelling, "Red Light".
- The starter places (Red Light, ELWA Junction and the rest) have no pin on the map yet. Until a place is pinned, Trothen can't send a driver to it.

**Now:**
- Each typed word also matches a name written as one word ("Redlight"), the start of a word ("Neezo" for Neezoe), or a word one or two letters off ("ELWA Junktion").
- "Redlight neezo" finds Red Light.
- When the place is known but not pinned yet, the page says so ("Trothen knows this place, but it is not on the map yet: Red Light, Paynesville. Choose it on the map once…") instead of "Not found".
- Neezoe (Paynesville) is added to the starter list.

**Your step:** pin the starter places in **Admin → Rides → Places**, starting with the busiest ones: Red Light, ELWA Junction, Duala, Broad Street and Rehab. Each one takes a minute. Until then, riders have to choose those places on the map.

**About your screenshot:** the screens from v166 (choosing a ride like Uber, the map) aren't on your phone yet, because your site still runs the first v166 from this morning. They appear after this deploy, once you press "Find drivers near me". "Location is switched off for this site" is an iPhone setting. Go to Settings → Privacy & Security → Location Services → Safari Websites → While Using the App, then in Safari tap **aA** → Website Settings → Location → Allow.

## What the tests check
- **`t167` (new, 31 checks), on a phone and a computer:**
  - Liberia: no postal code box, "County", "City or town", "e.g. Monrovia", and Margibi suggests Kakata and Harbel.
  - The US shows "ZIP code" and "State"; Nigeria shows the postal code as optional.
  - A Liberian signs up with no postal code, all the way through the email code.
  - Sending an ID: one email with the next steps (how long, what opens, what if wrong, the safety line, support), in HTML too; a notice in Trothen; the steps on the page.
  - Not approved: an email with the reason and how to resend. Approved: an email with what is open now.
- **`tguar` (new, 22 checks):**
  - A pro can't save a guarantor without a full name, a complete number or a relationship.
  - Saved numbers are kept in international form.
  - The team sees one card per pro, tabs with counts, numbers with the country code, Call and WhatsApp, and the checks.
  - Verified asks for the call note and keeps who and when; "Put back to call" works.
  - The page fits a phone; the pro's form shows +231 and the kinds of guarantor.
- **`tmem` (new, 16 checks):**
  - The real price, discount and break-even come from the server, and no promises of things that don't exist.
  - The card shows "about US$3.79", not $9.99.
  - Prices out of order are refused.
  - The welcome notice is in L$.
  - "Redlight neezo", "redlight" and "ELWA junktion" find their places; once pinned, Red Light comes with its pin.
- **Every earlier suite**, on the file store and on Postgres.

## Files
- **New:**
  - `src/address-format.js` (each country's address format)
  - `src/verification-messages.js` (the next-steps messages)
- **Changed (server):**
  - `src/validators.js` (Liberia: no postal code; optional where rarely used)
  - `src/geo-data.js` (Liberia's towns by county; town names in two countries)
  - `src/guarantor-check.js` (international numbers and the checks)
  - `src/membership.js` (what each tier gives, the break-even, the price order)
  - `src/places.js` (forgiving search, Neezoe)
  - `src/routes/marketplace.routes.js` (/geo sends the address formats and towns)
  - `src/routes/misc.routes.js` (sending an ID, guarantors, membership)
  - `src/routes/admin.routes.js` (decisions, guarantors, membership prices)
  - `src/routes/rides.routes.js` (known places not pinned yet)
- **Changed (page):**
  - `public/index.html`
  - `public/app/trothen.js`
  - `public/app/rides.js`
  - `public/app/es-v152.js` (Spanish)

No database changes and no new packages.
