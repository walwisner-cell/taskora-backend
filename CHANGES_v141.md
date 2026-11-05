# Trothen v141: paying per job (not only per hour), drivers and motorbikes, and Mobile Money payouts instead of PayPal

This one package includes everything since the version on your GitHub `main` before v128: v128 to v140, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
- In Liberia and Africa we don't always pay per hour. We pay per job, from the job description. Make the system capture that.
- How does the system handle pros who are drivers and commercial motorbikes?
- We don't use PayPal in Africa (the Market money box asked for a PayPal email).

## 1. How pros charge: per job, per hour, per day or per trip
Before, every pro was "$X/hr" and every booking was worked out as 2 hours. That's why James Doe, a car driver, showed "$1/hr".

Now each pro chooses in **Settings → How you charge**. It works the way Thumbtack, Bark, Lynk (Kenya) and SweepSouth (South Africa) do it:

| How they charge | What the card shows | How a customer books |
|---|---|---|
| **Per job** (most work in Liberia) | "From $20 per job", or "Price per job" | Describe the job and ask for a price, or make an offer |
| **Per hour** | "$15/hr" | Choose how many hours |
| **Per day** (masons, labourers, a car with a driver) | "$40/day" | Choose how many days |
| **Per trip** (pick-and-drop, moving a load) | "$5/trip" | Choose how many trips |

Any of these can be combined with:
- **Fixed prices:** up to 20 set jobs a customer can book straight away, without waiting for a quote. For example, "Fix a leaking tap $15" or "Install a ceiling fan $25". They show on the pro's profile, each with its own **Book** button.
- **Offers:** customers can offer their own price. This is always on for per-job pros. The pro accepts, suggests another price, or declines, as before.
- **A minimum:** for example, at least 2 days per booking.

**"Describe the job and ask for a price"** is the heart of paying per job:
1. The customer writes what needs doing, adds photos and says where it is.
2. The request goes to that one pro only. The pro is told: "Jordan asked you for a price".
3. The pro answers with **Send my price** in Job Matches, the same way as for any posted job.
4. The customer accepts the price and pays (Trothen holds the money), or makes a different offer. Nothing is paid until they agree.

To stop spam, a customer can have at most 3 waiting requests with one pro.

**Safety: the server now works out what a booking costs.** Before, the page sent the amount and the server accepted it. Someone could change the page and book an $85/hr pro for $1. Now:
- the server takes the pro's own prices (the fixed price, or the hours, days or trips times the rate);
- only an offer uses the customer's amount, and an offer always waits for the pro to agree;
- the booking records how the amount was reached (for example "3 days × $40"), which helps in a dispute.

**Existing pros:** nothing breaks. Pros on "hourly" read as per hour, pros on "Mutual Agreement" read as per job, and "both" reads as per hour with offers. They can switch in Settings at any time.

## 2. Drivers and commercial motorbikes
This part already existed. Here is how it works:
- **Rides (passengers):**
  - **Who can drive:** a driver applies under Rides, with their licence and vehicle papers for their country and vehicle type: motorbike, keke, car or van. The team approves each driver before they can take a ride.
  - **Motorbikes:** a helmet is required, and the team can switch on a night curfew for motorbikes.
  - **Fares:** these are by distance. Each driver sets a base fee plus a price per kilometre. The rider sees the fare before asking, and can offer a different fare.
  - **Driver Pass:** a driver can buy days with no commission, and take cash rides.
- **Pick & Drop (deliveries):** drivers carry store and Market orders at their own delivery rates.

**What changed:** a driver approved for rides now shows **their ride fare** on their card ("From $1 + $0.50/km") and a **Get a ride** button, which opens Rides. They no longer show a meaningless hourly rate. A driver who is also hired by the day (a car with a driver) or by the trip can set that in How you charge.

**Fix for James Doe:** in Settings → How you charge, he chooses **Per trip** or **Per day**. If he drives passengers, he applies under **Rides**.

## 3. Payouts: Mobile Money and bank, no PayPal in Africa
**Where:**
- **Pros:** Settings → **Where your money is paid** (this replaces the old payout panels, including the made-up "Chase •••• 1123").
- **Market sellers:** Market → Sell → **Your Market money**.

**What's offered:**
- **Across Africa:** **Mobile Money** or **Bank Transfer**. PayPal isn't offered anywhere in Africa, and is refused if an older page asks for it.
- **Everywhere else:** Bank Transfer and PayPal, plus Mobile Money.

**Mobile Money:** the person chooses the network used in their country, then gives the number and the name the wallet is registered in. For example:
- Liberia: Orange Money, MTN Mobile Money.
- Ghana: MTN, Telecel Cash, AT Money.
- Nigeria: OPay, PalmPay, Moniepoint, MTN MoMo PSB.
- Sierra Leone: Orange Money, Africell Money.
- Kenya: M-Pesa, Airtel Money.
- About 30 countries are covered, and "Other" is always there.

**Bank:** bank name, the name on the account, the account number, and the branch and SWIFT code if they have them (needed for money from abroad).

**Privacy and safety:**
- Numbers are stored **encrypted** (with the same key as ID photos, `ID_FILE_ENCRYPTION_KEY`). Everywhere in the app, only the **last 4 digits** show, for example "Orange Money •••• 4567 (James Doe)".
- **No payout without details:** a cash-out with nowhere to send the money is refused with "Add your Mobile Money number first".
- **The 24-hour wait still applies** after a change. Setting details for the first time has no wait.

**For the team:** **Admin → Payments → Payouts being sent** lists each payout waiting to go out and where it goes. **Show full number** reveals the wallet or account number to send to, and every look is recorded in the access log. Super admins and the finance team see it. A custom admin needs the new permission "See payouts being sent, with the full wallet or account number".

## What I tested (57 new checks)
- **Prices:**
  - an older $85/hr pro still reads as "$85/hr";
  - **a page sending $1 is charged the real amount ($170)**;
  - 3 hours at $85 is $255;
  - unknown units, a $0 rate, bad fixed prices and customers setting prices are all refused;
  - per day at $40 with a 2-day minimum (1 day refused, 3 days is $120);
  - a fixed price books at $15 whatever the page sends, and one not on the list is refused;
  - an offer waits for the pro;
  - a materials advance can't exceed the amount;
  - per job reads "From $15 per job", and can't be booked by the hour.
- **Ask for a price:**
  - it goes to that pro only, with the right category, date and time, and the pro is told;
  - a pro in another country can't be asked;
  - a 4th waiting request is refused.
- **Payouts in Liberia:**
  - Mobile Money (Orange, MTN) or bank only, and PayPal is refused (also for money from abroad);
  - no payout without details;
  - a short number is refused;
  - only the last 4 digits come back, and the number is stored encrypted;
  - no wait the first time, a 24-hour wait after a change;
  - bank details work the same way;
  - Admin sees where each payout goes, the full number only on request, and every look is logged;
  - customers can't see it, and the data download shows the last 4 digits only.
- **On screen:**
  - the cards;
  - the driver's card with "Get a ride";
  - the booking choices;
  - the review showing "Fix a leaking tap, fixed price, $15";
  - booking at the fixed price, and asking for a price ("Request sent");
  - 3 hours at $65 showing $195;
  - fixed prices on the profile;
  - the pro switching to $35 per day;
  - a Liberian pro's payout settings with no PayPal anywhere;
  - the Market money box (Orange Money, saved as "•••• 3456");
  - the admin list;
  - the booking on a phone screen.
- **Earlier tests, all still passing:** listed in the deployment steps.

## Good to know
- **Real Mobile Money sending:** payouts still settle in test mode, as before. The code to send MTN Mobile Money in Liberia automatically is already in Trothen (`src/liberia-momo.js`). It's switched off until you have MTN's (Lonestar Cell MTN's) disbursement account and give the go-ahead. Until then, the team sends payouts by hand from the "Payouts being sent" list. Orange Money needs its own agreement with Orange Liberia.
- **Business: the Mobile Money networks list** is in one place (`src/payout-methods.js`) and is easy to add to.
- **Business: fees** are unchanged. The 9% service fee ($2.99 to $25) applies to the agreed amount, whatever the pricing.

## Files
- **New:**
  - `src/pricing.js`
  - `src/payout-methods.js`
  - `public/app/price-units.js`
  - `public/app/payout-details.js`
- **Changed:**
  - `src/routes/marketplace.routes.js`
  - `src/routes/auth.routes.js`
  - `src/routes/payments.routes.js`
  - `src/routes/market.routes.js`
  - `src/routes/admin.routes.js`
  - `src/admin-permissions.js`
  - `src/account-privacy.js`
  - `public/app/trothen.js`
  - `public/app/review.js`
  - `public/app/market.js`
  - `public/index.html`

**What's needed:** no new packages, database changes or environment variables. Set `ID_FILE_ENCRYPTION_KEY` (64 characters) on Render if it isn't set yet, so payout numbers are stored encrypted. Without it they're stored as they are, and still only shown as the last 4 digits.
