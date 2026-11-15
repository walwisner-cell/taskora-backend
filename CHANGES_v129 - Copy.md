# Trothen v129: agreed arrival times, "Leave now" that works, and a professional, phone-first trip screen

Built on v128 (which my screenshot shows is live).

## What I asked for
1. Change the text format to a very professional one.
2. From the pro's side, tapping to leave did nothing.
3. Let the pro and the customer decide on a time, and act when it's time.
4. Make it work very well on a mobile phone.

## Why "On My Way" did nothing on a phone
- **The location bar covered the confirmation.** On a phone, "Tell the customer you're on the way?" slides up from the bottom of the screen. The dark "Sharing your location" bar was layered on top of it and covered its buttons, so tapping did nothing. That bar stays up whenever an earlier trip was never marked **Arrived**, which is what happened in my tests.
- **It was slow.** After confirming, it waited up to 12 seconds for a location before telling the customer, with only a small message on screen.
- **A blocked location gave no clear explanation.** If the phone blocked location, the customer saw "Waiting for their phone to send a position" forever (my screenshot), and the pro got no clear instructions.

## What changed

### "Leave now" works every time
- The location bar now sits under every window and confirmation. It also hides while a window is open. It's smaller, and has its own **View trip** and **Arrived** buttons, so an old open trip can be closed in one tap.
- **On My Way** is now called **Leave now**. It tells the customer at once, opens the trip straight away (in about 0.1 seconds in my test), and the position follows.
- **If the phone blocks location,** the trip screen says so in red. It explains how to allow it on iPhone and Android and has **Try again**. The customer is still told the pro has left.
- **Arrived** asks for a quick confirmation, so it can't be tapped by accident, and it's quick too.
- If an earlier trip is still open, the confirmation says so, and location sharing moves to the new trip.

### Agreeing an arrival time, and reminders when it's time
- On every open booking, the pro or the customer can tap **Agree arrival time** and pick a date and time. There are Today, Tomorrow and next-day shortcuts, plus an optional note such as "Please call when you reach the gate".
- The other person sees **"James Doe proposed Tomorrow, 4:30 PM"** with **Accept** and **Propose another time**. Either person can change an agreed time until the pro leaves. After that it's fixed.
- **A direct booking already has a date and time,** and that time is used as the agreed arrival time automatically.
- **Time zones are handled.** Each person sees the time in their own time zone, and reminders are written in theirs.
- **Reminders** go out automatically, in the bell and as phone notifications for anyone who switched those on:

  | When | The pro | The customer |
  |---|---|---|
  | 1 hour before | "You are due at Walter Wisner's at 3:00 PM." | "James Doe is due at 3:00 PM." |
  | Time to leave | "Time to leave… tap Leave now." | "James Doe should be leaving now." |
  | At the time, not set off | "You are due now…" | "James Doe has not set off yet." |
  | 30 minutes late | "Please message the customer and agree a new time." | Told they can message, agree a new time or cancel. |

  - "Time to leave" is 30 minutes before. If the pro's last known position is far from the job, it comes earlier (up to 2 hours).
  - A late pro is recorded for the team, because reliability matters.
  - Each reminder is sent once, and none are sent once the pro has left.

### A "next job" card
- At the top of the pro's **Overview** and **My Contracts** there is one card with the one thing that matters now:
  - **Trip in progress**: I have arrived / View trip;
  - **Time to leave**: Leave now / Directions;
  - **Next job**: due in 2 h;
  - **Action needed**: accept a proposed time, or agree one.
- The customer sees the same card on **Overview** and **My Bookings**: James Doe is en route / Track arrival, the upcoming arrival, or a time to accept.
- The countdown updates by itself every 30 seconds.

### A professional trip screen
- A header with the booking number and service, then a status line: **Scheduled · 10:48 AM → En route → Arrived**.
- A clear headline ("James Doe is 4.2 mi away" / "4.2 mi to destination").
- Three figures: **Distance**, **Est. arrival** (shown as a range, marked approximate) and **Last update** (with accuracy).
- Plain notices for anything that needs attention.
- Action buttons: I have arrived, Directions, Message, Share my location, Change location.
- Then the map, and a details list: scheduled arrival, departed, job location, landmark, shared location.
- Wording is formal and consistent throughout ("Location required.", "Your customer has been notified.").
- Names show properly: "JAMES DOE" and "walter wisner" now read "James Doe" and "Walter Wisner" on the dashboards, the trip screen and the notifications. Services start with a capital letter.

### Laptops and tablets too
I asked whether this was only for phones. It isn't: every screen adapts to phones, tablets and laptops.
- **Laptop:**
  - **The trip screen** uses the width: the details are on the left and a large map on the right (about 650 × 520 pixels on a 1366 × 768 laptop), all on one screen without scrolling.
  - **The next-job card** has its words on the left and its buttons on the right.
  - **My Bookings and My Contracts** stay as full tables.
- **Tablet:**
  - **Bookings and contracts** show as cards, two per row, in portrait and landscape.
  - **The trip screen** is side by side in landscape, and a full-width map with the details below in portrait.
- **Touch screens of any size** (tablets, touch laptops) get larger buttons.
- **Names** in the side panel and on the account button show properly too ("James Doe", "Walter").

### Built for phones
- On a phone, the trip screen fills the whole screen and respects the iPhone notch and home bar.
- Pop-up forms (arrival time, job location) slide up from the bottom, with large touch targets and the phone's own date and time pickers.
- On a phone, **My Bookings** and **My Contracts** are no longer squeezed tables. Each booking is a card with labelled lines (Booking #, Pro, Service, Date, Status…) and full-width buttons.
- No sideways scrolling, checked on a 390-pixel-wide phone screen.

## What I tested (on a copy of my repo)
- **25 new automated checks for arrival times:**
  - past times are refused;
  - propose, then accept (the proposer can't accept their own time);
  - the notification is in the right time zone, with tidied names;
  - all four reminders arrive, each only once, and none after the pro leaves;
  - lateness is recorded;
  - a direct booking's time becomes the agreed time (only by the customer, only that exact time);
  - a pro far from the job is told to leave earlier.
- **All 40 checks from v128 still pass.**
- **22 checks on a phone-sized screen in a real browser:**
  - with an old trip left open, **Arrived** and **Leave now** both open a visible, tappable confirmation;
  - the trip opens in about 0.1 seconds and fills the screen;
  - a blocked location shows the red message with **Try again**;
  - contracts and bookings show as cards;
  - proposing and accepting a time works from the phone;
  - the customer's trip screen shows the figures;
  - no sideways scrolling.
- **35 checks across five screen sizes:** laptop 1366 × 768 and 1280 × 800, tablet landscape 1024 × 768, tablet portrait 768 × 1024, and phone 390 × 844.
  - No sideways scrolling anywhere.
  - Tables on laptops, cards on tablets (two per row) and phones.
  - The trip screen fits the screen every time, with the map beside the details on wide screens.
  - The arrival-time form fits.
- **No page errors and no server errors.**

## Honest limits
- **A web page can only share location while it's open on the phone.** If the pro locks the phone or switches apps, updates pause until they come back (the screen says so). Tracking in the background needs an installed app.
- **Reminders reach a phone that is closed or locked only if push notifications are set up and the person allowed them.** Otherwise they appear in the bell the next time Trothen is opened.
- **Estimated arrival is a straight-line estimate shown as a range.** A real road ETA needs a paid routing service such as Google Maps.

## Files
New: `src/arrival-time.js`, `public/app/arrival.js`
Changed: `public/app/where.js`, `public/index.html`, `src/routes/payments.routes.js`, `src/routes/marketplace.routes.js`, `server.js`
Docs: `CHANGES_v129.md`, `DEPLOYMENT_STEPS_v129.md`

No new packages, settings or database changes.
