# Trothen v120: see your offer before you book

## The problem I'm solving
When a customer booked a pro, "Confirm & Pay Securely" sent the booking the moment it was pressed. The offer, the Trothen service fee and the total were in a small box at the top of the form, far above the button, and the customer never saw them together with the date, the place and the way of paying before the booking went to the pro.

## What changed

### 1. A "Check your booking" screen before anything is sent
- The button at the bottom of the booking form now says **Check my booking →**. Pressing it never sends the booking.
- It opens a review screen inside the same window that shows:
  - **Your offer** (or the job amount for an hourly pro: 2 hr × the pro's rate)
  - **Trothen service fee**, worked out the same way the server does it: 9%, $2.99 minimum, $25 maximum, with the member discount (Plus 20%, Pro 40%, Elite 60%, VIP 80%) when the customer has one. It says "None, cash job" for a cash job and "Waived with 25 loyalty points" when points are used.
  - Any goods from the pro's store, the store fee and a materials advance
  - **The total**: "Total to pay", "Total if your offer is accepted", or "You pay the pro after the job" for cash
  - The amount in the customer's own money when they pay in it
  - The pro, the job, the date and time, where, how many photos, and how they pay
  - One plain line saying what happens next. For an offer: nothing is charged now; the money is only taken once the pro accepts.
- Two buttons: **← Change something** goes back to the form with everything still filled in, and **Send my offer** / **Confirm & Pay Securely** / **Confirm cash booking** sends it.
- The review only opens when the form is complete. If the time, the place or the offer is missing, the same message as before appears and the customer stays on the form.

### 2. The price box is right for cash jobs
Choosing "Cash to the pro after the job" used to leave the box at the top still showing the 9% service fee and a "Total charged" with the fee in it. A cash job has no Trothen fee, so the box now says **Service fee: None, cash job** and **Pay the pro after the job: $150.00**. Switching back to Protected puts the normal figures back.

### 3. Hiring from "Responses to Your Job"
- The card said **"undefined% fit"**. The fit score is stored on the match, not on the pro, so the card was reading the wrong place. It now shows the real score, and shows nothing rather than "undefined" if there isn't one.
- The "Select this provider?" question now shows the price, the service fee and the total (for example, "Price: $150.00 + Trothen service fee $13.50 = $163.50 total"), or that it's paid in cash with no fee. If no amount is typed, it uses the job's budget the same way the server does.

## What I did not change
- No server changes. The server still works out and charges the real fee; the review screen only shows the same sum before sending.
- Post a Job is unchanged: it doesn't charge anything or set a price, so there is nothing to review there yet.

## Files
- `public/app/review.js` (new)
- `public/app/trothen.js` (fit score, hire question)
- `public/index.html` (loads review.js, new version tag for trothen.js)

## How I tested it
In a browser against a local copy of the server: an offer booking, a cash offer booking, an hourly booking, a Plus member's discount, going back to change something, an incomplete form (no review opens), and sending from the review (the booking that reached the server had the same amount, offer flag, way of paying and job text that the review showed). No errors in the page.
