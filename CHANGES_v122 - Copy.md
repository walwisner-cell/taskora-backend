# Trothen v122: agreeing one final price

This version includes v120 and v121. If they aren't deployed yet, deploy only this one; it contains everything.

## The problem I'm solving
When I booked a pro, I never saw a price from the pro. There was nowhere for a pro to give one:
- On a **posted job**, a pro could only press "I'm Interested" and write a note. The customer had to ask "how much?" in the chat and type a number into Hire.
- On a **"Make an Offer" booking**, the pro could only accept or decline the customer's number. They couldn't answer with their own price.

What I wanted is a real back-and-forth that ends with **one final price we both agreed**, before anything is booked or paid.

## How other marketplaces do it, and what I took
- **Thumbtack and Airtasker:** the pro answers a job with a **price** (a quote), not just a message. The customer compares prices side by side and hires at that price. On Airtasker the pro can **update or withdraw** their price until it's accepted, and is asked to explain what the price covers.
- **eBay offers:** each side can **accept, decline, or counter**. There is a **limit of 5 counter-offers each**, and an offer that isn't answered in time **expires**.
- **All of them:** nothing is paid until a price is accepted, and price changes stay **inside the app**, so there's a record if something goes wrong.
- **Airtasker's "increase price"** after a job is agreed is what Trothen already has as **Request Additional Payment**, so I kept that as it is.

## What changed

### 1. A pro's price on a posted job
- When a pro presses **I'm Interested**, they now get a short form:
  - **Your price for the whole job.** The form tells them to include labour, materials they bring and getting there.
  - **What this price covers** (optional), for example "new pipe, fittings and 2 hours".
  - **A note to the customer** (optional).
- A pro who isn't sure yet can leave the price blank and message the customer first.
- The pro can **change their price** until the customer hires someone. The customer is told each time, for example "Aisha changed their price from $135.00 to $125.00".
- On **Responses to Your Job**, each pro's price is shown big and clear in a box, with what it covers and whether Trothen's fee is added (or that it's cash with no fee). Pros with no price yet say so.
- The Hire amount is **filled in with the pro's price**, and the button says **Hire Aisha for $135.00**. If the customer types a different amount, the button changes to match. Before hiring, the question says the pro asked a different price and can confirm or say no.
- If the customer leaves the amount empty, the server now uses the **pro's price** (before the job's budget).

### 2. Back-and-forth on a "Make an Offer" booking
- **The pro** sees the customer's offer with three buttons: **Accept $150.00**, **Suggest a different price**, **Decline**.
- If the pro suggests a price, **the customer** sees **Accept $190.00**, **Suggest a price**, **Cancel**.
- It goes back and forth until one side presses **Accept** on the other's latest price. **That is the final, agreed price** on the contract. Only then is payment taken and held (or the payment code given in Liberia, or the cash job confirmed).
- Both sides see the whole history under the booking, for example:
  You offered $150.00 · Aisha suggested $190.00: "includes the new pipe and fittings"
- Each price can carry a short reason.
- It's always clear whose turn it is. Nobody can answer their own price or suggest twice in a row.
- **Up to 5 prices each** (like eBay). After that, accept the last price or cancel.
- **Each price expires** if the other side doesn't answer in the normal response time. The message says who didn't answer: "You didn't answer Aisha's price of $150.00 in time… Nothing was charged."
- Before the customer accepts the pro's price, they see the agreed price, Trothen's fee (with any member discount, or none for cash), the total, and what happens next.
- If the price changed while the customer was looking, accepting is refused with "The price is now $X. Check it and accept again", so nobody agrees to a price they didn't see.
- Once agreed, the price is **locked**. Changes after that go through Request Additional Payment.
- **Cash offers:** a pro can't suggest a cash price whose commission they couldn't cover with their tokens; they're told how many they need. When the customer accepts, it's checked again.

### 3. Wording
- The booking review (v120) now says the pro "can accept it, suggest a different price, or decline", and that nothing is paid until you both agree one final price.
- Under the status it says **Answer by…** when it's your turn, and **Customer answers by…** for the pro when it's the customer's turn, instead of always "Responds by".

## How I tested it
Against a copy of the server, with US and Liberian customers, pros, and the admin as finance. **38 new checks**, plus every check from v121 again (28 + 26 + 35), all passing:
- A full back-and-forth: customer $150, then pro $200, customer $175, pro $185. The customer accepts $185, so $185 + $16.65 fee is held, the history is kept, and the pro is told. The price is locked, and the job done releases $185.
- The pro accepts the customer's counter: $120 is held.
- The limit of 5 prices each, then the customer can still cancel.
- Liberia: agree $130, then a payment code for LRD 26,923 ($141.70).
- Cash: the pro is refused a $300 price they can't cover (39 tokens) and told why. $140 is agreed and 18.2 tokens are taken.
- Job board: price $135 with what it covers, the customer told, the price changed to $125 and the customer told, Hire with no amount uses $125, and the price can't change after hiring.
- The customer not answering in time: the booking expires, nothing is charged, and both sides get the right message.
- In the browser: the pro's quote form, the pro's suggest-a-price form, the customer's booking row with Accept/Suggest/Cancel and the history, the accept screen with the total, and the response card with the price and "Hire Aisha for $135.00". No page errors.

## Files
- `public/app/pricing.js` (new): the price forms and buttons
- `src/routes/marketplace.routes.js`: suggest a price, accept a price, the pro's job price, limits and checks; the accept steps shared so both ways go through the same payment code
- `src/booking-scheduler.js`: the right message when the customer didn't answer
- `public/app/trothen.js`: price on job responses, Hire uses it, offer rows, "Answer by"
- `public/app/review.js`: wording
- Unchanged from v121 but needed if v121 isn't deployed: `src/tokens.js`, `src/routes/custpay.routes.js`, `public/app/payways.js`
- `public/index.html`: loads pricing.js, new version tags
