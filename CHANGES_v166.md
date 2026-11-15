# Trothen v166: the exact location on receipts, a receipt for every payment, and rides that explain a wrong pin

What Walter asked:
- With a store receipt: "the location should show the exact location"
- "i dont like how the location is looking on the receipt is there a more professional way with best practice"
- With Joseph's Rides screenshot ("Rides can be up to about 40 km. This trip is further than that."): "fix this"
- "how would the receipt be sent if from the ride app and delivery and everything that has to do with transactions"

(Your receipt screenshot was made before v165. That is why it still shows "—" under the buyer's name and support@trothen.io at the bottom. v165 already fixed both.)

## 1. The location on receipts, in words, laid out like Uber and Amazon
**Before:** the pin showed as a Plus Code (`865QQJJ6+2Q`) and two long numbers, under labels like "PINNED LOCATION". Both point to the exact spot, but nobody can read them.

**Now** each place is one tidy card, the way Uber, Amazon and Jumia print an address:
- **The person's name** (or the store's), in bold.
- **The street address of the pin, as postal lines:** "14 Tubman Boulevard", then "Sinkor, Monrovia, Liberia".
- **What the person called the place,** if they named it ("Home", "Red Light Market").
- **Near:** how far it is from a well-known place on Trothen's own list, within 600 m. For example "110 m from ELWA Junction, Paynesville". That is how people in Liberia give directions.
- **Directions:** the landmark they typed ("Green door next to the pharmacy").
- **One small grey line:** "Plus Code 865QQJJ6+2Q · View on map". The link drops a pin on the exact spot in Google Maps.
- **A small map** on the right with a red pin.

The raw GPS numbers are gone from receipts: the Plus Code and the map link carry the exact spot.

It is the same on the store receipt, the delivery receipt (where it was collected, and where it went), a pro's invoice, and a ride (the pick-up and drop-off, each as a card).

**On the page,** the address in words also shows on:
- the "Booking request sent" screen;
- the courier's delivery card;
- the seller's order;
- the trip screen.

It says "Finding the address…" for a moment, then the address.

**How the address is found:**
- It comes from OpenStreetMap's free address lookup. The server asks it, never the visitor's browser, at most once a second.
- It is saved on the pin the first time, so a receipt always says the same thing.
- If the lookup can't be reached, the receipt still has the Plus Code and the map link. (Tested.)
- **Privacy is unchanged:** only people who could already see the pin see its address, and it goes when the pin goes.

## 2. Joseph's Rides screenshot: "Rides can be up to about 40 km"
His trip wasn't really that long. One of the two places was in the wrong spot. There are two usual causes:
- **A laptop's "Use my location"** guesses from the internet connection, often a different town and sometimes a different country.
- **A place found by name** can be a place with the same name in another country.

Now:
- **Place search only offers places in the person's own country.** Before, it only added the country's name to the search words.
- **The pin shows its address in words** as soon as it is set ("14 Tubman Boulevard, Sinkor…"), so a wrong pin is seen at once.
- **A location that is only a guess is flagged.** If the device can only place the person to within more than 2 km, it says: "This is only a guess, and may be far from where you are. Choose the spot on the map instead, or use your phone."
- **If a trip is too long, the message says what is wrong.** For example:

  "This trip is about 2,180 km. Rides can be up to about 25 mi. The pick-up pin is at 14 Tubman Boulevard, Sinkor, Monrovia, Liberia, and the destination at Matadi, Kongo Central, Democratic Republic of the Congo. The destination is in Democratic Republic of the Congo, not Liberia. Search the destination again by name, or choose it on the map."

  It has buttons, **Change the pick-up** and **Change where I am going**, which clear that pin and take you to its search box.

## 3. A receipt for every money movement, sent at once
**Before:** a store receipt or booking invoice could be downloaded in the app, but nothing was ever sent, and token purchases and refunds had no receipt at all.

**Now**, following Uber, Bolt, Jumia and Amazon:

| When | Who gets it | What |
|---|---|---|
| A ride, delivery, store order, booking, extra work or tip is paid | The customer | **Payment receipt:** what for, the price, Trothen's fee, the total, how they paid, and that Trothen holds the money until the work is done |
| A ride or job paid in cash is completed | The customer | **Receipt:** paid in cash to the driver or pro |
| Money is given back, in full or in part | The customer | **Refund receipt:** how much, where it goes back to, and why |
| Tokens are bought (in the app, by code, or at an office) | The pro | **Receipt:** the tokens added and the price |
| A payout is sent | The pro, driver or seller | **Payout statement:** earnings released, Trothen's commission (with the %), tips, any fees, and what they received, with the transaction reference |

**How it reaches people:**
- **By email, at once,** with a short summary in the email and the receipt attached as a PDF. The subject reads, for example, "Your Trothen receipt TR-NEWE7HX4: $12.00".
  - A receipt is a record, not a notification. So it goes even to people who switched off "Email me updates", and even while they have the app open.
  - If the mail server is down, it is tried again, up to 5 times.
- **By SMS** to people with no email address: one line with the amount, the number and a link. This only works once an SMS service (Twilio) is set up on Render (see below).
- **In the app: Account → Receipts** (customers: after Payments; pros: after Earnings & Payouts).
  - Every receipt, newest first, with filters (Rides, Deliveries, Store orders, Bookings, Refunds, Tokens, Payouts).
  - **Download PDF** and **Email it to me** on each one.
  - The email's **View my receipts** button opens this page (after signing in, if needed).
- Each receipt has its own number (TR- and 8 letters and numbers). It is issued once, and is in "Download a copy of my data".

**Nothing from before this version is emailed.** The first time it runs, it only notes the time, so nobody gets a pile of old receipts the day you deploy.

The store receipt and booking invoice you already had stay as they are, with the new address cards.

## Honest limits, and steps for you
- **Your email must work for receipts to go out.** Your SMTP settings on Render are already in. Nothing else is needed.
- **SMS receipts (your decision):** Twilio charges for each SMS sent. Check its price list for Liberia before switching it on.
  - To switch it on, add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` on Render.
  - Without them, people with no email still see every receipt in Account → Receipts.
- **Street addresses in Liberia are thin on free maps.** Many receipts will only say the area ("Sinkor, Monrovia, Liberia").
  - **Business step:** in **Admin → Rides → Places**, pin the well-known places on the starter list (ELWA Junction, Red Light and the rest). Each pinned place makes the "Near" line work around it.
- **OpenStreetMap's free services are for light use.** That is fine while Trothen is young. When orders grow, set these on Render (no code change needed):
  - `MAPBOX_TOKEN` for the map pictures;
  - `REVERSE_GEOCODE_URL` for addresses, for example LocationIQ: `https://us1.locationiq.com/v1/reverse?key=YOUR_KEY`.
- **Legal:** these receipts are records of payment. Some countries require a formal tax invoice, with a tax number, for businesses registered for VAT or GST (Liberia's GST, Nigeria's VAT). Pros who are registered can already issue their own invoices with their tax number in Business Tools. If Trothen itself registers for GST or VAT, tell me, and I'll add Trothen's tax number and the tax line to the receipts. Ask your accountant whether that applies yet.

## What the tests check
- **`t166` (new, 29 checks):**
  - **Payments:** a store order paid gives a payment receipt with its own number and the right total. It is emailed (HTML and text, PDF attached), even with email updates switched off.
  - **Account → Receipts:**
    - receipts are listed, and the PDF opens;
    - nobody else can open it;
    - "Email it to me" works, but not twice in a minute;
    - the email link opens the page on a phone, with filters and a download.
  - **Refunds:** a full refund and a part refund each get a refund receipt, with the reason. No receipt is issued twice.
  - **The pro side:** a token top-up gives a receipt; a payout gives a statement with the commission (13%) and tips, emailed to the pro.
  - **Old payments:** payments from before the first run are not emailed.
  - **Rides:** a ride of over 1,000 km says where each pin is, and that the destination is in another country.
- **Receipts and the page:**
  - the store and delivery receipts show the address cards and the map;
  - the courier's card shows the address;
  - "Near" gives "110 m from ELWA Junction", "At ELWA Junction", or nothing when no place is within 600 m;
  - with the address lookup down, receipts still work.
- **Every earlier suite**, on the file store and on Postgres.

## Files
- **New:**
  - `src/place-name.js` (a pin in words)
  - `src/map-picture.js` (the small map)
  - `src/receipts.js` (issuing and sending receipts)
  - `src/routes/receipts.routes.js` (Account → Receipts)
  - `public/app/receipts-ui.js`
  - `CHANGES_v166.md`
- **Changed (server):**
  - `server.js`
  - `src/delivery.js` (emails can carry HTML and a PDF)
  - `src/notify.js`
  - `src/account-privacy.js`
  - `src/plus-code.js`
  - `src/pdf-report-builder.js`
  - `src/routes/orders.routes.js`
  - `src/routes/business.routes.js`
  - `src/routes/marketplace.routes.js`
  - `src/routes/rides.routes.js`
- **Changed (page):**
  - `public/index.html`
  - `public/app/trothen.js`
  - `public/app/rides.js`
  - `public/app/where.js`
  - `public/app/es-v152.js`

No database changes and no new packages. The new `receipts` records start empty.
