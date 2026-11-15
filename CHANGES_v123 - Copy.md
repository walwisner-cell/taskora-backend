# Trothen v123: changes show up instantly, no refresh

This version includes v120, v121 and v122. If they aren't deployed yet, deploy only this one; it contains everything.

## The problem I'm solving
When a pro accepted, suggested a price, or anything else changed, the other person didn't see it until they refreshed the page. Only the notification bell checked for news, every 5 seconds. The bookings list, offers, prices and job responses stayed as they were.

## How it works now
This is how apps like Uber and the big marketplaces do it: the server tells the open page the moment something changes, and the page quietly redraws only that part.
- When I'm signed in, my page keeps one connection open to Trothen. It's a standard browser feature called Server-Sent Events: no new packages, it works on Render, and it reconnects by itself.
- When something is saved that concerns me, the server sends my page a tiny note within about a quarter of a second, for example "your bookings changed". That covers a booking, an offer, a price, a payment, a job response, a message, a notice or my tokens.
- My page reloads that data the normal way, signed in with all the usual checks, and redraws the screen I'm on. My scroll position stays where it was.
- The bell updates (with its sound, if switched on) at the same moment.
- An open **Responses to Your Job** window updates in place too: new responses, new prices, and a price change follows into the Hire box. Anything I've typed there is kept.

## Care taken
- **It never redraws under someone who is typing.** If I'm in the middle of typing on the page, it waits until I click away, then catches up.
- **Only the people involved hear about a change.** In my test, a different customer heard nothing.
- **No booking details travel over the live connection**, only "this part changed". The page fetches the details through the normal signed-in requests.
- **The sign-in token is never put in a web address.** The page asks for a one-time pass that works once, within 60 seconds, so the token can't end up in server logs.
- **If the live connection can't be opened or drops** (a weak phone signal, a strict office network), the page checks for changes every 20 seconds until it's back. When I come back to the tab or the phone screen, it catches up at once.
- A person can have up to 6 tabs or devices connected; after that the oldest one is closed.

## How I tested it
- **Server:** the pro was told about a new offer in 282 ms, and the customer about the pro's price in 283 ms. Several saves at once arrived as one note. A different customer heard nothing. A pass works only once, a made-up pass is refused, and a pass needs sign-in.
- **Two real browsers side by side, a customer and a pro, no refreshing:**
  - The customer makes an offer, and it appears on the pro's Contracts screen in 0.65 seconds.
  - The pro suggests $190, and the customer's booking shows "Accept $190.00" with the history in 0.7 seconds.
  - The customer accepts, and the pro's row turns Active in 0.7 seconds.
  - The pro sends a price on a posted job, and it appears in the customer's open Responses window in 0.65 seconds. The customer's half-typed message is kept.
  - The pro changes the price, and the Hire box follows.
  - While typing on the page, nothing is redrawn. After clicking away, it caught up in 0.3 seconds.
  - With the live connection deliberately blocked, the page still updated by itself, in 15 seconds.
- Every earlier check (payments, payment codes, cash, job board, price back-and-forth) passed again: 127 of 127. There were no page errors.

## Honest limits
- **One server.** The list of open connections lives in the server's memory. That's right for Trothen today (one Render service). If you ever run more than one copy of the server at the same time, this needs a shared message service such as Redis, so a change on one server reaches pages connected to another. I'd do that when it's needed, not before.
- **When the app is closed**, the page can't be told anything. That's still the job of the phone push notifications you already have, which need the VAPID keys set on Render.
- **Admin screens:** the bell is live everywhere, and the **Customer Payments** page redraws live. Other admin pages still update when you open them.

## Files
- `src/live.js` (new): the live connection, the one-time passes, and noticing every save
- `server.js`: switches live updates on when the server starts
- `public/app/live.js` (new): the page side: connect, redraw, typing guard, 20-second backup
- `public/index.html`: loads live.js, new version tags
- Everything from v120–v122: `src/tokens.js`, `src/routes/marketplace.routes.js`, `src/routes/custpay.routes.js`, `src/booking-scheduler.js`, `public/app/pricing.js`, `public/app/review.js`, `public/app/payways.js`, `public/app/trothen.js`
