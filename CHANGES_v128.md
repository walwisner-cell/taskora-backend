# Trothen v128: my old chats, and finding each other on a job

Built on v127, the version I uploaded on 2 November 2026.

## What I asked for
1. A way to see my previous chats.
2. I couldn't see where the pro was properly.
3. The pro couldn't track my location properly.

## Why the location didn't work
- **Most of my bookings had no location pin.** In my test, only "fix my pipe" had one (that's the "Open in Maps" link). "house pipe", "my pipe is leaking" and "My Sink is broken" had none. Posting a job didn't ask where it was, so the pro had nowhere to go, and the trip map said "No distance".
- **The pro could only ever see a pin, never where I actually was.** I also had no way to add or fix the location after booking.
- **The whole page reloaded every few seconds during a trip.** Each time the pro's phone sent its position, both dashboards reloaded and redrew, which is slow on a phone.
- **Computers guess.** A laptop or desktop works out its location from Wi-Fi and can be kilometres off. A phone with Location on is accurate. Testing with two accounts on computers will always look wrong. Nothing showed when a position was only a rough guess.
- **The dot jumped around.** When the phone briefly fell back to a rough guess indoors, the pro's dot jumped kilometres away and back.

## What changed

### Messages: every conversation, old and new
- The Messages page lists every conversation I've had on Trothen, newest first. That includes pros who answered a job I posted but whom I didn't hire. Before, I could only see people I had a booking with.
- Each conversation shows the last message and when it was sent, how many I haven't read, and the bookings and jobs it's about (for example "#926189 · house pipe · Active").
- The **Messages** menu item shows how many unread messages I have.
- **Search** finds a conversation by name, booking number, service or job. **Unread** shows only the conversations with new messages.
- Inside a chat:
  - date lines ("Today", "Yesterday", "Sat, Oct 31");
  - a note when the chat is about a particular job;
  - **Seen** under my last message once they've opened it;
  - the bookings with that person at the top.
- **Save chat** downloads the whole conversation as a text file, for my records or a dispute.
- On a phone, the list fills the screen. Tapping a chat opens it, and **‹ All chats** goes back.
- Opening a chat marks it as read. Nothing is ever deleted.
- Messages sent before this update count as already read, so nobody suddenly gets a pile of "unread" messages from months ago. They don't show "Seen", though, because nobody actually opened them.

### Location: the pro can always find me
- **Posting a job now needs a location.** I can pin it, choose it on a map, or describe a landmark (at least 5 characters). Direct bookings already needed this.
- **On My Bookings**, a booking with no pin shows "No location pin. Your pro can't navigate to you." with a **Set the job location** button. Bookings that have a pin get **Change location**. Either one works until the pro arrives. The pro is told straight away, and their trip map moves to the new spot.
- **Share my live location.** When the pro is on the way, **Track your pro** has a **Share my live location** button. It works like waiting for a ride:
  - only the pro on that booking sees where I am;
  - I can stop at any time;
  - it's deleted when they arrive.

  If the booking has no pin, the distance and the pro's **Get directions** link use where I am now.
- **The pro is warned and asked.** If a pro taps **On My Way** on a booking with no pin, I'm told at once and asked to share my location or set the pin. The pro's trip map says what's missing and has a **Message the customer** button.
- **The trip map shows all three:** the job pin (red), the pro (blue) and me (green, if I'm sharing). Distances and directions are given to the pin, or to me when there is no pin.
- **Honest warnings for rough positions.** If a position is worse than about 500 m, the map says so plainly. The pro is told to use their phone with Location on, outdoors if they can.
- **No more jumping dot.** A rough guess (worse than 1 km) doesn't replace a good GPS position from the last 2 minutes. The phone and the server both check this.
- **No more reloading during a trip.** Position updates no longer make the dashboards reload. The trip map updates itself every 6 seconds (it was 8). Changing the job location still updates the pro's page live, because that matters.
- **"Pin my current location" is quicker.** It now asks the phone for its current position straight away, as well as waiting for a better one.

### Fixes found while doing this
- When a job was passed to the next pro (the first one didn't confirm), the job's location was dropped. The next pro now gets it.
- On a phone, the floating help button covered the **Send** button in Messages. It no longer does.
- Live positions (the pro's and mine) are cleared within 10 minutes of a trip ending any other way (cancelled, or completed without tapping Arrived). They used to wait for the daily 90-day sweep. Closing an account clears my shared position too.

## What I tested (on a copy of my uploaded repo)
40 automated checks, all passing:
- A job with no location is refused; one with a landmark or a pin posts.
- Conversations:
  - A pro who answered my job but wasn't hired shows up.
  - The newest conversation is first.
  - Unread counts are right, and they drop when I open the chat.
  - A message from before the update isn't counted as unread.
  - The pro sees **Seen**.
  - Both sides see the conversation.
- **On My Way** with no pin: I'm told and asked to share or set the location.
- The pro's rough 3 km guess straight after a good fix is ignored.
- Position updates (the pro's and mine) don't send any "reload" notes to the page. Setting the job location does.
- Sharing my location:
  - The pro sees me and the distance (3.6 miles in the test).
  - A pro can't post my position or change the job location.
- Setting the pin moves the distance to the pin, and the pro is told.
- **Arrived** wipes both positions, and sharing and location changes are then refused.
- A cancelled trip's positions are cleared by the 10-minute sweep.

In a real browser (customer and pro, on a computer and a phone):
- the new Messages page;
- the warning on My Bookings;
- sharing my location from **Track your pro**;
- setting the location from the trip window;
- the pro's trip map showing me and the pin.

There were no page errors, no server errors, and no sideways scrolling on the phone.

**Not tested here:** the map pictures themselves. This test computer can't reach OpenStreetMap, so the screenshots show the dots on a grey background. On the live site the streets show as before.

## Honest limits
- **A web page can only share location while it's open.** The pro and I both have to keep the Trothen page open with the screen on. Background tracking needs an installed phone app.
- **Distances are a straight line, not the road.** Real road routes and arrival times would need a paid routing service (for example Google Maps Platform).
- **Accuracy depends on the device.** A computer, or a phone indoors, can be hundreds of metres or kilometres off. The app now says so instead of hiding it.

## Files
New: `public/app/chats.js`, `public/app/where.js`
Changed:
- `public/app/trothen.js`, `public/index.html`
- `src/routes/misc.routes.js`, `src/routes/payments.routes.js`, `src/routes/marketplace.routes.js`
- `src/live.js`, `src/location-retention-scheduler.js`, `src/account-privacy.js`
- `server.js`
- `CHANGES_v128.md`, `DEPLOYMENT_STEPS_v128.md`

No new packages, settings or database changes.
