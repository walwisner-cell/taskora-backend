# Trothen v169: booking a ride is stable

v169 goes on top of v168. If v166, v167 or v168 isn't live yet, this one package deploys them too.

## What you said
"It seems to be unstable if you book a ride."

## What I did
I ran a whole ride the way real people do it, on two test phones:
- the rider and the driver each on their own phone;
- the browser helper on, as on your site;
- only real taps, and nobody re-opening pages;
- each screen had to change by itself.

I counted every page error, every failed request and every reload. Then I fixed what it found and ran it again.

## 1. The rider's screen reloaded thousands of times during a ride
**What was wrong:** while a ride was open, the rider's page checked for news every 8 seconds. Each check started *another* 8-second timer without stopping the one before, so the number of timers doubled every 8 seconds. In one test ride, the rider's phone reloaded the ride **3,512 times**. It should have been about 20.

That is what "unstable" looked like:
- the screen redrawing all the time;
- the page jumping back to the top;
- taps getting lost (the final "I arrived safely" didn't go through);
- phones slowing down, using data and battery;
- a heavy load on the server.

**Now:**
- There is only ever one timer.
- A check doesn't start while another is still running.
- The screen is redrawn only when something has actually changed, and never while the rider is typing or paying, or while a "Confirm" window is open.
- A redraw keeps the page where the rider had scrolled to.
- A passing network hiccup leaves the page as it is, instead of replacing it with "Could not load".
- The same ride now takes 16 to 21 reloads.

## 2. On a weak connection, the page jumped every 10 seconds
**What was wrong:** when a phone's network drops Trothen's live updates (common on mobile data), Trothen falls back to checking every 10 seconds. Each of those checks redrew the whole Rides page, for the rider and for the driver, and sent it back to the top.

**Now** those checks use the same calm redraw: only when something changed, keeping the scroll position. I tested a whole ride with the live updates blocked on purpose.

## 3. The driver's page during a ride
**Now:**
- A network hiccup no longer replaces the driver's page with "Could not load".
- A redraw keeps the driver where they had scrolled to.
- A redraw waits while a "Confirm" window (such as "End trip?") is open.

The PIN the driver is typing was already protected, and the test checks it again: two digits, a 12-second pause, then the rest.

## 4. "Find drivers near me" could take up to about half a minute
**What was wrong:** if the road-route service didn't answer, Trothen asked it again for every kind of vehicle (motorbike, keke, car, van), waiting up to 7 seconds each time.

**Now** a failed lookup is remembered for a minute, and the trip is estimated straight away.

## 5. Two riders could get the same driver
**What was wrong:** if two riders chose the same driver in the same instant, both could get him. Each request checked he was free before the other one had been saved.

**Now:**
- Only one booking per driver is handled at a time. The second rider is told "That driver has just taken another ride. Choose another from the list."
- A driver can't accept a second ride while one is under way ("Finish the ride you are on before accepting another").

## What the tests check
- **`tride` (new, 14 checks), the whole ride on two phones, with real taps only:**
  - going online; "Find drivers near me"; a double tap books one ride, not two;
  - while waiting, at most one refresh about every 8 seconds;
  - the driver sees the request by itself, and the rider sees "Your driver is coming" by itself;
  - the page doesn't jump while the rider reads it, and a PIN typed slowly isn't wiped;
  - "You are on your way" and "I arrived safely" appear by themselves, and the ride ends with the driver paid;
  - no page errors and no failed requests on either phone.
- **`tride` again with the live updates blocked**, as on a weak phone network.
- **`trace` (new, 4 checks):** two riders at the same instant, and a second ride while one is under way.
- **`tsw`:** maps with the browser helper on.
- **Every earlier suite**, on the file store and on Postgres.

## Files
- `public/app/rides.js` (the rider's and the driver's pages)
- `src/road-route.js` (a failed route lookup is remembered for a minute)
- `src/routes/rides.routes.js` (one booking per driver at a time)
- `src/routes/marketplace.routes.js` (no second ride while one is under way)
- `public/index.html`

No database changes and no new packages.
