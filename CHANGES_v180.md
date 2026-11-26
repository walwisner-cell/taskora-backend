# Trothen v180: Rentals in the Market (stays by the night, homes by the month)

v180 goes on top of v179.

## What you asked
"For the market place, can we implement apartment rentals and Airbnb, where people can book." You chose:
- **both kinds:** short stays booked by the night (like Airbnb), and homes rented by the month;
- **payment in the app,** held by Trothen until the guest has moved in.

## What I built

### 1. Market → Rentals
There's a new **Rentals** tab in the Market, next to Browse, Sell and My orders. Visitors who aren't signed in see it too, as **"Places to stay and rent"**. It has three parts.

**Find a place**
- **Choose the kind of rental:** "Stays by the night" or "Homes by the month".
- **Search by:**
  - the area (for example "Sinkor");
  - the dates (check-in and check-out, or the move-in day);
  - the number of guests.
- **Each place shows:**
  - its photos and its kind (apartment, house, room in a home, studio, guesthouse, duplex);
  - the bedrooms and bathrooms, and how many people it takes;
  - the price, in US dollars and in Liberian dollars;
  - its rating.
- **Opening a place shows:**
  - all its photos and the description;
  - what it has: electricity, generator, solar power, running water, water tank, air conditioning, Wi-Fi, security guard, fenced compound, parking and so on;
  - the house rules and the cancellation rule;
  - the host: first name and initial, ID verified, how many stays they have hosted, and whether they are new;
  - the reviews.
- **A calendar of the free days.** Taken days are crossed out. The guest taps the check-in day, then the check-out day. The price appears straight away:
  - each line, for example "3 nights × $40.00";
  - the cleaning fee;
  - Trothen's service fee;
  - the total, in US dollars and in Liberian dollars.
- **The address stays private until the host accepts.** Before that, guests only see the community, and a map point rounded to about a kilometre.

**My trips** (for the guest)
- **Every booking, with what happens next in plain words**, for example: "The host has until Fri 27 November, 1:32 PM, to accept. If they don't, you get everything back."
- **Once the host accepts:**
  - the full address and an "Open in Google Maps" link appear;
  - the guest can message the host.
- **The buttons:**
  - **Pay now**, if the payment is still waiting;
  - **Cancel**. Before anything happens, it says exactly how much comes back.
  - **All good: pay the host now**, once check-in time has come;
  - **Report a problem**;
  - **Rate your stay**, after check-out.

**Hosting** (for the host)
- **List a place** with a form in five parts:
  1. the place;
  2. where it is;
  3. photos (3 to 12);
  4. what it has, and the house rules;
  5. prices.
- **Prices:** by the night, by the month, or both, in US dollars or Liberian dollars.
  - **By the night:** a cleaning fee, the shortest and longest stay, the check-in and check-out times, and a cancellation rule.
  - **By the month:** the months paid at the start (for example 6, as is usual in Monrovia) and the shortest rental.
- **The host must tick a declaration:** "I own this place, or I have the owner's written permission to rent it out. The photos and the description are true. I will only take payment through Trothen."
- **Requests:** Accept or Decline, the guest's message, and the time left to answer. It also shows what the host will get, for example "You get $126.10 (price $130.00 less the host fee $3.90)".
- **A calendar** to close days, for example when the family uses the place.
- **Pause, Edit and Delete.** A place with open bookings can't be deleted, only paused.

### 2. How the money works
1. **The guest pays the whole booking through Trothen,** by card, code or Mobile Money, the same ways as everything else. Trothen holds it.
2. **The host has 24 hours to accept.** If they decline, or don't answer, the guest is refunded in full.
3. **The money goes to the host 24 hours after check-in** (48 hours after move-in for a monthly rental), unless the guest reports a problem first.
   - A reported problem keeps the money held for the Disputes team.
   - A guest who arrives and finds all is well can press **All good** to pay the host straight away.
4. **Fees:**
   - **The guest pays a 5% Trothen service fee on top of the price.**
   - **The host pays 3%, taken from the price when the guest books.**
   - **There is no other commission when the host cashes out.** The payout statement says so on each rental line.
   - Example: 3 nights at $40 + $10 cleaning = $130. The guest pays $136.50, the host gets $126.10, and Trothen keeps $10.40.
5. **New hosts:** the money from a host's first 3 bookings can be cashed out 3 days after it is released. This gives a guest time to report a fake listing. New Market sellers already work this way.

### 3. Cancelling
**The host chooses one cancellation rule for each place.** The guest sees it before paying.

| Rule | Free cancellation until | After that |
|---|---|---|
| Flexible | 24 hours before check-in | the first night is not refunded; the other nights are |
| Moderate | 5 days before check-in | half the price of the nights is refunded |
| Strict | 14 days before check-in | half is refunded from 14 to 7 days before; nothing is refunded in the last 7 days |
| By the month | 7 days before move-in | the first month is not refunded; the other months are |

The rules for everyone:
- **The cleaning fee is always refunded** if the guest cancels before check-in.
- **Trothen's service fee is refunded only when the cancellation is free.**
- **A change of mind is free:** a booking cancelled within 48 hours of paying, with check-in at least 14 days away, is refunded in full, as on Airbnb.
- **When the host cancels, the guest always gets everything back.**
  - Those dates close in the host's calendar, so the place can't be let to someone else for more money.
  - A host who cancels 3 times in 90 days is flagged to the Fraud & Safety team.
- **After check-in, nobody can cancel.** The guest reports a problem and the Disputes team decides.
- **The old Cancel button in My Bookings can't skip these rules.** Rental bookings stay in Market → Rentals.

### 4. Safety
- **Hosts and guests both need a verified ID.**
- **The team checks every new place before anyone can see it** (Admin → Market → Rentals). The check list is on the page:
  - the photos look like one real place;
  - the area and the address match;
  - the price is normal for the area;
  - the host's ID is verified.
- **Rejecting or taking down a place always gives the host the reason.** Every decision is written to the access log.
- **A new address, pin or photos on an approved place sends it back to the team.** This stops a known scam: get approved, then swap in another house.
- **3 reports from different people hide a place** until the team has looked at it.
- **A host and guest with the same phone number can't book each other.** The attempt is flagged, the same as in the Market.
- **Every place shows the warning:** "Pay only through Trothen. A host who asks you to pay by phone, transfer or cash before you arrive is breaking the rules: report them."
- **Messages already watch for scam words** (paying outside Trothen, gift cards and so on). Guests can now message a host about a place before booking.

### 5. Admin → Market → Rentals
- **The lists:** To check, Shown, Paused, Turned down, Taken down, and All, with how many in each.
- **For each place:**
  - the photos, the private address and the pin;
  - the prices;
  - the host's name, phone and ID status;
  - the ownership declaration, any reports, and any host cancellations.
- **The buttons:** Approve, Turn down (with a reason), Take down (with a reason), and Show it again.
- **Custom admins** can be given "Approve, reject or take down rental places" under Market.

### 6. Spanish
Every word on the Rentals screens is in Spanish too: 294 new entries.

## Tests
- `t180` (new, 79 checks): listing a place, the team's check, browsing, prices, booking, the host's answer, every cancellation rule, the money released after check-in, a reported problem holding the money, "All good", ratings, monthly rentals, reports, a new address being checked again, the calendar, pausing, and a stopped host.
- `t180ui` (new, 30 checks): the screens on a phone and a laptop, for a guest, a host, the team and a visitor, and in Spanish. It includes the "Keep it" button really keeping the booking.
- Every earlier suite, on the file store and on Postgres.

## What is business, not code
I'm not a lawyer. Please have these checked:
- **The Terms of Service need a rentals section:**
  - that Trothen is not the landlord and not a party to the rental;
  - the host's duties (safety, the law, true listings);
  - the guest's duties (damage, house rules);
  - the cancellation rules above;
  - what happens to the money in a dispute.
  When the Terms change, everyone is asked to accept them again before their next booking.
- **Landlord and tenant law in Liberia.** A monthly rental is a tenancy. Leases, notice periods and the rights of tenants are set by law. Trothen should tell hosts they are responsible for following it.
- **Tax.** Hosts may owe tax on rental income, and Trothen may have to report or collect tax on its fees. Ask the Liberia Revenue Authority or an accountant.
- **Proof of ownership.** For now, the host declares it and the team checks the listing. If you want more, the next step is asking for a title deed, a lease, or the owner's signed permission. I can add that upload.
- **Security deposits are not handled.** Many Monrovia landlords ask for one. Holding deposits for months, and deciding damage claims, is a legal and money-handling decision. Tell me if you want it.
- **The fees (5% and 3%) are settings** (rentalGuestFeePercent and rentalHostFeePercent). There's no screen for them yet. Tell me the numbers you want, or ask me to add them to Admin → Market → Fees.

## Not done yet
- **Paying the next months of a monthly rental through Trothen.** For now, a monthly booking covers the months paid at the start. After that the days open again, so the host should close them in the calendar while the tenant stays.
- **The help videos for Rentals.** These come in v181, with the animated explainers you chose (like sample 3) for every part of the app.

## Also worth knowing
**GitHub has old copies of the whole project.** These are the folders and files ending in " - Copy" (for example "node_modules - Copy", "src - Copy", ".git - Copy", "data - Copy"), and they have been there since v110. They aren't served to visitors and they hold no passwords, but they make the project much bigger and could confuse a developer. I can give you the commands to remove them safely when you're ready.

## Files
**New:**
- `src/rentals.js` (the rules)
- `src/routes/rentals.routes.js` (the API)
- `public/app/rentals.js` (the screens)

**Changed:**
- `server.js` (the new routes, and the check that releases money after check-in)
- `src/customer-payments.js` (the messages when a rental payment arrives)
- `src/routes/payments.routes.js`: the general Cancel and Complete send rentals to their own buttons, and the "booking never started" sweep leaves rentals alone
- `src/routes/marketplace.routes.js` (rentals are kept out of My Bookings)
- `src/booking-scheduler.js` (the messages when a host doesn't answer in time)
- `src/contact-rules.js` (a guest can message a host about a place)
- `src/commission-statement.js` (no commission on rentals at payout)
- `src/admin-permissions.js` (the new admin pages and the new permission)
- `src/platform-settings.js` (the two fee settings)
- `public/app/market.js` (the Rentals tab, and "Places to stay and rent" for visitors)
- `public/app/market-admin.js` (Admin → Market → Rentals)
- `public/app/payways.js` (the payment code screen for a rental booking)
- `public/app/es-v152.js` (Spanish)
- `public/index.html` (new version numbers on the changed app files)

No database changes are needed: the new records (rental places and reviews) are stored like everything else. There's nothing new for Render to install.
