# Trothen v143: deployment steps (includes v128 to v142)

This one package holds everything since the version on your GitHub `main` before v128: v128 (past chats, job locations), v129 (arrival times, Leave Now, the trip screen, phone, tablet and laptop layouts), v130 (professional wording), v131 (icon colours), v132 (how commission is paid), v133 (pros customers can find), v134 (commission before accepting, categories by country), v135 (custom admin permissions), v136 (voice and video calls, instant updates, permissions by action) v137 (voice messages, calls that reconnect, call hours, blocking, call history for disputes) v138 (one "Download a copy of my data" file with everything) v139 (the Market, pros as store owners, and the pro sign-up fix) v140 (safety and anti-fraud, materials for a job, trade prices, calls that don't hang, ringtones) v141 (paying per job, per day or per trip, asking a pro for a price, drivers' ride fares, and Mobile Money payouts instead of PayPal), v142 (Trothen proposes ride fares by distance and time in L$, linked to fuel, and drivers listed like any pro) and v143 (the store complete: returns, sizes and colours, sales, discount codes, product reviews, saved goods, delivery by distance). Deploy only this one. It works whether or not v128 is already live: a file that is already up to date is simply unchanged.

77 files, plus `CHANGES_v128.md` to `CHANGES_v143.md` and this file. No new packages or database changes. Calls work without any new setting; the optional TURN settings are in section 6.

## 1. Files and byte counts

"New" means the file did not exist before v128.

| File | Status | Bytes |
|---|---|---|
| `public\app\acceptquote.js` | **new** | 18,387 |
| `public\app\arrival.js` | **new** | 23,934 |
| `public\app\calls.js` | **new** | 35,615 |
| `public\app\categories.js` | **new** | 8,323 |
| `public\app\chats.js` | **new** | 21,950 |
| `public\app\commission.js` | **new** | 31,926 |
| `public\app\instant.js` | **new** | 5,213 |
| `public\app\listing.js` | **new** | 2,648 |
| `public\app\live.js` | changed | 12,129 |
| `public\app\market.js` | **new** | 69,271 |
| `public\app\payout-details.js` | **new** | 13,944 |
| `public\app\permissions.js` | **new** | 20,454 |
| `public\app\polish.js` | **new** | 48,839 |
| `public\app\price-units.js` | **new** | 26,107 |
| `public\app\review.js` | changed | 19,893 |
| `public\app\rides.js` | changed | 109,009 |
| `public\app\sounds.js` | **new** | 4,867 |
| `public\app\store-plus.js` | **new** | 48,460 |
| `public\app\tokens.js` | changed | 62,296 |
| `public\app\trothen.js` | changed | 1,510,003 |
| `public\app\voice.js` | **new** | 28,964 |
| `public\app\where.js` | **new** | 39,268 |
| `public\index.html` | changed | 258,159 |
| `server.js` | changed | 30,233 |
| `src\account-export-zip.js` | **new** | 20,814 |
| `src\account-privacy.js` | changed | 20,388 |
| `src\admin-permissions.js` | **new** | 19,251 |
| `src\arrival-time.js` | **new** | 14,465 |
| `src\auth.js` | changed | 9,382 |
| `src\category-groups.js` | **new** | 2,113 |
| `src\commission-statement.js` | **new** | 24,561 |
| `src\commission.js` | changed | 6,291 |
| `src\currency-data.js` | changed | 6,973 |
| `src\customer-payments.js` | changed | 26,296 |
| `src\document-expiry-scheduler.js` | changed | 3,642 |
| `src\document-upload-reminder-scheduler.js` | changed | 2,431 |
| `src\fraud-detection.js` | changed | 12,153 |
| `src\go-live.js` | changed | 18,486 |
| `src\liberia-momo.js` | changed | 14,015 |
| `src\listing.js` | **new** | 1,207 |
| `src\live.js` | changed | 8,232 |
| `src\location-retention-scheduler.js` | changed | 5,125 |
| `src\loyalty.js` | changed | 2,262 |
| `src\market.js` | **new** | 15,052 |
| `src\membership.js` | changed | 3,164 |
| `src\payout-methods.js` | **new** | 9,439 |
| `src\platform-settings.js` | changed | 47,416 |
| `src\pricing.js` | **new** | 7,877 |
| `src\provider-score-scheduler.js` | changed | 6,587 |
| `src\provider-score.js` | changed | 17,973 |
| `src\ride-fares.js` | **new** | 8,889 |
| `src\road-route.js` | **new** | 2,784 |
| `src\routes\admin.routes.js` | changed | 245,690 |
| `src\routes\auth.routes.js` | changed | 91,341 |
| `src\routes\business.routes.js` | changed | 43,724 |
| `src\routes\calls.routes.js` | **new** | 30,012 |
| `src\routes\custpay.routes.js` | changed | 8,756 |
| `src\routes\market.routes.js` | **new** | 51,318 |
| `src\routes\marketplace.routes.js` | changed | 192,203 |
| `src\routes\misc.routes.js` | changed | 71,432 |
| `src\routes\orders.routes.js` | changed | 66,029 |
| `src\routes\payments.routes.js` | changed | 91,911 |
| `src\routes\portfolio.routes.js` | changed | 12,133 |
| `src\routes\rides.routes.js` | changed | 77,905 |
| `src\routes\store.routes.js` | changed | 82,269 |
| `src\routes\tokens.routes.js` | changed | 24,845 |
| `src\search-synonyms.js` | changed | 6,181 |
| `src\seed.js` | changed | 32,030 |
| `src\stolen-goods.js` | **new** | 7,332 |
| `src\store-extras.js` | **new** | 8,038 |
| `src\store-order-sweep.js` | changed | 2,710 |
| `src\store-orders.js` | changed | 11,902 |
| `src\store.js` | changed | 28,136 |
| `src\sync-reference-data.js` | changed | 8,194 |
| `src\tokens.js` | changed | 56,722 |
| `src\validators.js` | changed | 17,727 |
| `src\zip-stream.js` | **new** | 3,787 |

## 2. Put the files in place and check them
Use Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v143-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir public\app\acceptquote.js
dir public\app\arrival.js
dir public\app\calls.js
dir public\app\categories.js
dir public\app\chats.js
dir public\app\commission.js
dir public\app\instant.js
dir public\app\listing.js
dir public\app\live.js
dir public\app\market.js
dir public\app\payout-details.js
dir public\app\permissions.js
dir public\app\polish.js
dir public\app\price-units.js
dir public\app\review.js
dir public\app\rides.js
dir public\app\sounds.js
dir public\app\store-plus.js
dir public\app\tokens.js
dir public\app\trothen.js
dir public\app\voice.js
dir public\app\where.js
dir public\index.html
dir server.js
dir src\account-export-zip.js
dir src\account-privacy.js
dir src\admin-permissions.js
dir src\arrival-time.js
dir src\auth.js
dir src\category-groups.js
dir src\commission-statement.js
dir src\commission.js
dir src\currency-data.js
dir src\customer-payments.js
dir src\document-expiry-scheduler.js
dir src\document-upload-reminder-scheduler.js
dir src\fraud-detection.js
dir src\go-live.js
dir src\liberia-momo.js
dir src\listing.js
dir src\live.js
dir src\location-retention-scheduler.js
dir src\loyalty.js
dir src\market.js
dir src\membership.js
dir src\payout-methods.js
dir src\platform-settings.js
dir src\pricing.js
dir src\provider-score-scheduler.js
dir src\provider-score.js
dir src\ride-fares.js
dir src\road-route.js
dir src\routes\admin.routes.js
dir src\routes\auth.routes.js
dir src\routes\business.routes.js
dir src\routes\calls.routes.js
dir src\routes\custpay.routes.js
dir src\routes\market.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\misc.routes.js
dir src\routes\orders.routes.js
dir src\routes\payments.routes.js
dir src\routes\portfolio.routes.js
dir src\routes\rides.routes.js
dir src\routes\store.routes.js
dir src\routes\tokens.routes.js
dir src\search-synonyms.js
dir src\seed.js
dir src\stolen-goods.js
dir src\store-extras.js
dir src\store-order-sweep.js
dir src\store-orders.js
dir src\store.js
dir src\sync-reference-data.js
dir src\tokens.js
dir src\validators.js
dir src\zip-stream.js
```

Each size must match the table exactly. If one is different, copy that file out of the zip again. The easiest way is `deploy_v143.bat`, which checks all of them for you.

## 3. Commit on its own branch (nothing goes live yet)

```
git checkout main
git pull
git checkout -b v143-store
git add public\app\acceptquote.js
git add public\app\arrival.js
git add public\app\calls.js
git add public\app\categories.js
git add public\app\chats.js
git add public\app\commission.js
git add public\app\instant.js
git add public\app\listing.js
git add public\app\live.js
git add public\app\market.js
git add public\app\payout-details.js
git add public\app\permissions.js
git add public\app\polish.js
git add public\app\price-units.js
git add public\app\review.js
git add public\app\rides.js
git add public\app\sounds.js
git add public\app\store-plus.js
git add public\app\tokens.js
git add public\app\trothen.js
git add public\app\voice.js
git add public\app\where.js
git add public\index.html
git add server.js
git add src\account-export-zip.js
git add src\account-privacy.js
git add src\admin-permissions.js
git add src\arrival-time.js
git add src\auth.js
git add src\category-groups.js
git add src\commission-statement.js
git add src\commission.js
git add src\currency-data.js
git add src\customer-payments.js
git add src\document-expiry-scheduler.js
git add src\document-upload-reminder-scheduler.js
git add src\fraud-detection.js
git add src\go-live.js
git add src\liberia-momo.js
git add src\listing.js
git add src\live.js
git add src\location-retention-scheduler.js
git add src\loyalty.js
git add src\market.js
git add src\membership.js
git add src\payout-methods.js
git add src\platform-settings.js
git add src\pricing.js
git add src\provider-score-scheduler.js
git add src\provider-score.js
git add src\ride-fares.js
git add src\road-route.js
git add src\routes\admin.routes.js
git add src\routes\auth.routes.js
git add src\routes\business.routes.js
git add src\routes\calls.routes.js
git add src\routes\custpay.routes.js
git add src\routes\market.routes.js
git add src\routes\marketplace.routes.js
git add src\routes\misc.routes.js
git add src\routes\orders.routes.js
git add src\routes\payments.routes.js
git add src\routes\portfolio.routes.js
git add src\routes\rides.routes.js
git add src\routes\store.routes.js
git add src\routes\tokens.routes.js
git add src\search-synonyms.js
git add src\seed.js
git add src\stolen-goods.js
git add src\store-extras.js
git add src\store-order-sweep.js
git add src\store-orders.js
git add src\store.js
git add src\sync-reference-data.js
git add src\tokens.js
git add src\validators.js
git add src\zip-stream.js
git add CHANGES_v128.md CHANGES_v129.md CHANGES_v130.md CHANGES_v131.md CHANGES_v132.md CHANGES_v133.md CHANGES_v134.md CHANGES_v135.md CHANGES_v136.md CHANGES_v137.md CHANGES_v138.md CHANGES_v139.md CHANGES_v140.md CHANGES_v141.md CHANGES_v142.md CHANGES_v143.md DEPLOYMENT_STEPS_v143.md
git status
git commit -m "v143: the store complete: returns, sizes, sales, codes, reviews, saved (includes v128 to v142)"
git push -u origin v143-store
```

`git status` should list **92 files** if v128 is already live, or **94 files** if it is not. Any other number means something is off: stop and send me a screenshot.

## 4. Test on your computer

```
npm install
set PORT=3001
node server.js
```

Open http://localhost:3001 and check:
- As a pro, Earnings & Payouts shows "How Your Commission Is Paid" and the Commission Statement.
- As an admin, Payments shows "Commission Received".
- Menus show coloured line icons, and dates read like "Nov 3, 2026".
- Admin → Categories & Countries shows "Customers Can Find" and "Offered In" columns.
- As a pro, tapping Confirm Booking shows the price, Trothen's commission and what you receive.
- Post a Job has a search box and the categories in groups.
- Admin → Locations & Admins → New Admin → Role has "Custom permissions". Set one section to Custom: its tick boxes open, one per action.
- Open two browsers (one normal, one private window). Sign in as a customer in one and a pro in the other. When the pro sends a price, a pop-up appears for the customer within a second, and the job card shows "1 pro responded · best price".
- In Messages, press Call: the other window shows "Incoming call". Answer, and you hear each other (allow the microphone when asked).
- In Messages, press the microphone next to Send, record a few seconds, and Send. It appears in the other window, and plays.
- Call again and press Decline in the other window: the caller sees "Leave a voice message".
- Settings shows "Calls & Voice Messages" with call hours and the blocked list.
- Settings → Your data and your account → Download a copy of my data: enter the password, and a .zip downloads. Unzip it and open "Start here.html".
- Sign up as a new pro by email (offering a service): it reaches the code screen. (This was broken from v134 to v138.)
- Market in the menu: Browse shows store goods. Sell → Sell an item (needs a verified account), add a photo, put it on sale. In another browser, open it and Buy with Trothen protection.
- Admin → Stores & Skills shows "Market fees and timing".
- Settings → Calls & Voice Messages → Sounds: pick a ringtone and press Play.
- As a pro, send a message that says "pay me by Western Union": the customer's window shows a warning under it.
- As a pro, Settings → How you charge: choose Per job, add a fixed price ("Fix a leaking tap", 15) and Save. The pro's card now reads "From $15 per job".
- As a customer, Book that pro: the window offers "A fixed price", "Make an offer" and "Describe the job and ask for a price". Ask for a price: the pro sees "asked you for a price" in Job Matches.
- As a pro in Liberia, Settings → Where your money is paid: Mobile Money (Orange Money, MTN Mobile Money) or Bank Transfer, and no PayPal.
- As a pro with a store: My Store → Store options → Returns, and Discount codes. Edit a good: add sizes and a sale. As a customer, open the store: the sale, the size choice, ♡ to save; at checkout enter the code.
- As the super admin, Admin → Rides → Fares: choose Liberia, enter L$ fares for motorbike and car, and see the example fares change as you type. Save.

Press Ctrl+C when you're done.

## 5. Make it live

```
git checkout main
git merge v143-store
git push
```

Render deploys after this push.

## 6. After it's live
- **First:** Admin → Categories & Countries → Sync Latest Categories & Countries, so the 61 standard categories (Landscaping included) are on the live site.
- Ask any pro with a red "with no profile photo" count on the admin Categories page to add a profile photo, so customers can find them.
- Admin → Tokens → Settings: untick "TEST SITES ONLY" once real money starts. Decide whether to turn on "Cash jobs" (see `CHANGES_v132.md`).
- If you edited About Us in Admin before, paste the new text from `CHANGES_v130.md` into Admin → Settings → About Us.
- Run the two-phone arrival-time test in section 6 of `DEPLOYMENT_STEPS_v129.md`.
- **Calls:** try a call between two phones on mobile data (not the same Wi-Fi). If it connects, you're fine for most people. If it says it couldn't connect, add a relay (TURN) service: sign up with a provider (Twilio, Cloudflare Calls, Metered or others), then add `TURN_URLS`, `TURN_USERNAME` and `TURN_CREDENTIAL` in Render → Environment. Render restarts by itself.
- If any team member has custom permissions, open their Permissions once. Each section can now be set to Custom with one tick box per action.
- **Phone test for calls and voice messages:** two phones, one on Wi-Fi and one on mobile data. Make a call, then walk the Wi-Fi phone out of Wi-Fi range mid-call: it should show "Reconnecting…" and carry on. Send a voice message from an Android phone to an iPhone and back, and check both play.
- **Calls on every network (recommended now):** sign up for Metered's free Open Relay (metered.ca/tools/openrelay, 20 GB a month), copy your credentials link (`https://<yourapp>.metered.live/api/v1/turn/credentials?apiKey=<key>`) and add it in Render → Environment as `TURN_API_URL`. Admin → Go-Live then shows "Calls work on every network". Until then, calls through a VPN or strict Wi-Fi may not connect; they now end with that reason after 30 seconds instead of hanging.
- **Market fees:** store goods now carry 8% (at least $0.50) paid by the seller, instead of the $5 the buyer paid. Change it in Admin → Stores & Skills → Market fees and timing if you prefer.
- Pros with a store: ask them to choose their Market categories (Market → Sell → "Your store in the Market").
- If you edited the privacy policy in Admin before, change section 7 there to name "Download a copy of my data" (see `CHANGES_v138.md`).
- Render → Environment: check `PRIVATE_UPLOADS_DIR` is set (Admin → Go-Live shows it). Voice messages are kept there, like ID documents.
- **Pricing (v141):** tell your pros about Settings → How you charge. Most should choose Per job, with a few fixed prices for their common jobs. Drivers like James Doe choose Per trip or Per day, and apply under Rides to carry passengers.
- **Market (v143):** tell people about "Register a stolen item" in the Market, and that phones, laptops and vehicles now need their IMEI or serial number. Decide with an attorney how to answer police requests about a seller.
- **Store (v143):** tell sellers about returns (at least 7 days for faulty goods), sizes and colours, sales and discount codes. Their money for an order is paid after its return window. Change the 7 days in Admin → Stores & Skills → Store returns.
- **Ride fares (v142):** Admin → Categories & Countries → Sync Latest Categories & Countries adds "Driver for Hire". Then Admin → Rides → Fares → Liberia: set the L$ fares with a few drivers from each vehicle type, and enter today's pump price. For real road distances, set `ROUTING_URL` on Render to an OSRM routing service (see `CHANGES_v142.md`).
- **Payout details (v141):** pros and sellers must add their Mobile Money number or bank account before they can cash out. Render → Environment: make sure `ID_FILE_ENCRYPTION_KEY` is set (Admin → Go-Live shows it), so the numbers are stored encrypted. The team sends payouts from Admin → Payments → Payouts being sent.
