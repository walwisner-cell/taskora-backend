# Trothen v166: the exact location on receipts, a receipt for every payment, rides that explain a wrong pin, and a steadier site

What Walter asked:
- With a store receipt: "the location should show the exact location"
- "i dont like how the location is looking on the receipt is there a more professional way with best practice"
- With Joseph's Rides screenshot ("Rides can be up to about 40 km. This trip is further than that."): "fix this"
- "how would the receipt be sent if from the ride app and delivery and everything that has to do with transactions"
- "the system is sometimes not stable"
- With his Rides page: "it signs in automatically, is that the best?"
- With "My fares" (Starting fare US$1, plus US$0 for each mile): "how does this work? Give me best practice and international standard, also fix all gaps. It's not working well"

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
| A Driver Pass is bought, or an ad is paid with tokens | The driver or pro | **Receipt:** what was bought, until when, and how it was paid |
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

## 4. "The system is sometimes not stable"
You didn't say what you see when it happens, so I went for the most likely causes on your setup. Your setup: the Render Starter plan (512 MB, half a processor), with the data in files on its disk, not in Postgres.

**The main cause: the server re-read its files all the time.**
- Every read of the data opened its file and read all of it, and every change wrote all of it back.
- Every open page asks for notifications and messages every few seconds, and the background checks scan bookings and payments.
- As the data grew, the small server spent most of its time re-reading the same files. Pages slowed down, and when it was very busy, Render's health check could time out and restart the server.

**Fixed:**
- The data is now kept in memory after the first read. It is only read from the disk again if the file changed, and checking that costs almost nothing.
- Every change is still written to the disk at once, safely, so nothing is held only in memory.
- Files are now written compactly: about half the size, and faster to write.
- **Tested** on one processor, with 30,000 notifications and 15,000 messages and 40 people at once:
  - before: half the requests took over 0.48 s, and the slowest 5% over 0.7 s;
  - now: 0.14 s and 0.23 s. That is about 3 times faster, with no errors.

**When the server restarts** (each deploy, or if Render restarts it), the site is unreachable for up to a minute. Before, every page action in that time failed with "Failed to fetch". Now:
- **Reading things** (pages, lists, your account) waits and tries again by itself (after 1, 2, 4 and 8 seconds). A small "Reconnecting to Trothen…" note shows, then goes away when the server is back.
- **Changes** (a booking, a payment) are never sent twice by themselves. If the server can't be reached, it says: "Could not reach Trothen. Check your internet connection and try again."
- **Tested:** the server stopped while a page was open; the note showed, the page carried on when the server came back, and a change was not resent.

**Steps for you, which code can't do:**
- **Tell me what you see when it is unstable:** a slow first page, being signed out, an error message, or something missing. Also when it happened. In Render → trothen-api → **Events**, a "Server unhealthy", "Instance failed" or "out of memory" line at that time tells us exactly what happened. Send me a screenshot of the Events and the **Metrics** (memory and CPU) pages.
- **Deploys cause a short outage.** A service with a disk can't be deployed without stopping it for a minute or so (Render's rule). Deploy at quiet times, for example late evening in Liberia.
- **Get told when it is down:** a free monitor such as UptimeRobot can check `https://trothenpro.com/api/health` every 5 minutes and email you when it stops answering.
- **The next step up, when you have more users:** move the data to Render Postgres (set `DATABASE_URL`; the code already supports it). That also allows a second server and deploys with no outage. I can do the move with you when you are ready. Your data must be copied across first, so it is a planned step, not a switch.

## 5. Staying signed in
**Your question: is signing in automatically the best?** On your own phone, yes: Uber, Bolt, Jumia and the banks' apps all keep you signed in. On a shared or public computer (an office, a cyber café), no: the next person would be in your account.

**Before:** everyone stayed signed in for up to 7 days on any device. And anyone who didn't touch the page for 20 minutes was signed out, **even a driver waiting online for riders.** A driver who went online and waited lost the sign-in, and riders could no longer reach him. That was likely part of "not stable".

**Now**, the way Google and Microsoft do it:
- **Signing in asks "Keep me signed in"**, with "Untick this on a shared or public computer" under it.
  - It starts **ticked on a phone or the installed app**, and **unticked on a computer**.
- **Ticked:** you stay signed in on that device until you sign out (7 days at most, then you sign in again). You aren't signed out for being idle.
- **Not ticked:** the sign-in lasts until the browser is closed. You are signed out after 20 minutes without use (with the 1-minute warning, as before).
- **Admin accounts** are always signed out after 20 minutes without use, whatever was chosen.
- **Never signed out while working**, whatever was chosen: while a driver is online, a pro is on the way with live tracking, a courier is carrying goods, or a customer shares their location.

**What you will see:** your current sign-in stays as it is. The next time you sign in on a computer, the box is unticked unless you tick it.

## 6. Ride fares ("My fares")
**How it works, and the international standard.** Every big ride app (Uber, Bolt, Yango, and in Africa Gozem and SafeBoda) works the same way:
- **The platform sets the fare,** for each city and kind of vehicle, in the country's own money. It is a **starting fare**, plus a **price per km (or mile)**, plus a **price per minute** (traffic), with a **minimum fare**.
- **The rider sees the price before booking,** and the driver sees it before accepting.
- **The driver can't set a fare that loses money,** or that cheats riders.
- **Some apps let the price move a little:**
  - inDrive lets the rider offer and the driver answer;
  - Trothen allows a band of 20% above or below its fare, and rider offers down to 70% of it.

**Trothen was built this way (v142), but only once the team saves a fare table** in Admin → Rides → Fares. None had been saved for Liberia. So the page fell back to letting each driver type their own fare **in US dollars**, and nothing stopped "US$1 to start, plus US$0 for each mile". With that, every trip cost US$1, however long. That is what your screenshot shows.

**Fixed:**
- **Liberia now always has a fare table, in L$.** Until the team saves its own, these starter fares are used:

  | Vehicle | Starting fare | Per km | Per minute | Minimum |
  |---|---|---|---|---|
  | Motorbike | L$50 | L$25 | L$2 | L$75 |
  | Keke | L$60 | L$25 | L$2 | L$100 |
  | Car | L$150 | L$50 | L$4 | L$250 |
  | Van | L$250 | L$70 | L$5 | L$400 |

  For example, a 5 km car trip of about 15 minutes is L$460 (about US$2.40), and a 3 km motorbike trip is about L$140. Fares are rounded to L$5 for cash.
- **"My fares" on your Rides page now shows Trothen's fare** with examples ("2 mi, 5 mi, 10 mi"). You choose how far above or below it you want to be, within 20%.
- **Deliveries use the same fares.** In Liberia, deliveries by motorbike, keke, car or van are now priced from the same fares as a ride of that distance, as Trothen was designed to do once fares exist (v143). Each courier still chooses up to 20% above or below. Bicycle and on-foot couriers keep their own delivery prices.
- **Admin → Rides → Fares shows these as "Starter fares: check them".** Once the team presses Save, they are the team's own fares.
- **In a country with no fare table** (Rides isn't open in any yet), a driver's own price per km or mile can no longer be 0.
- **The delivery distances button** now says "Save delivery distances", so it isn't confused with saving fares.

**Business step for you and Joseph:** the starter fares are my estimate for Monrovia, not official fares. Before many rides happen:
1. Check them in **Admin → Rides → Fares** against what riders pay motorbikes, keke and taxis today.
2. Enter the fuel pump price there too, so fares follow fuel the way the Ministry of Transport's fares do.
3. Press **Save**.

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
  - **The pro side:** a token top-up and a Driver Pass bought with tokens each give a receipt; a payout gives a statement with the commission (13%) and tips, emailed to the pro.
  - **Old payments:** payments from before the first run are not emailed.
  - **Rides:** a ride of over 1,000 km says where each pin is, and that the destination is in another country.
- **Receipts and the page:**
  - the store and delivery receipts show the address cards and the map;
  - the courier's card shows the address;
  - "Near" gives "110 m from ELWA Junction", "At ELWA Junction", or nothing when no place is within 600 m;
  - with the address lookup down, receipts still work.
- **`trestart` (new):** the server stops while a page is open; the "Reconnecting" note shows, the page carries on when the server is back, and a change is not resent.
- **The data store:** a record given to code can't change the stored data by accident, a file changed by something else is seen, and changes are on disk at once.
- **`tkeep` (new):** "Keep me signed in" starts unticked on a computer and ticked on a phone; not ticked lasts for the browser session and ends after 20 minutes idle; ticked is kept and isn't ended for being idle; signing out removes it; while the position is followed (online, on a trip), nobody is signed out.
- **Fares:** Liberia gets the starter L$ fares, and a 0 per-distance fare is refused.
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
  - `src/db-json.js` (the data kept in memory, checked against the files)
  - `src/delivery.js` (emails can carry HTML and a PDF)
  - `src/notify.js`
  - `src/account-privacy.js`
  - `src/plus-code.js`
  - `src/pdf-report-builder.js`
  - `src/routes/orders.routes.js`
  - `src/routes/business.routes.js`
  - `src/routes/marketplace.routes.js`
  - `src/routes/rides.routes.js`
  - `src/ride-fares.js` (starter fares for Liberia)
- **Changed (page):**
  - `public/index.html`
  - `public/app/trothen.js`
  - `public/app/rides.js`
  - `public/app/where.js`
  - `public/app/es-v152.js`

No database changes and no new packages. The new `receipts` records start empty.
