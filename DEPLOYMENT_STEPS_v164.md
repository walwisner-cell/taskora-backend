# Trothen v164: deployment steps (includes v128 to v163)

This one package holds everything since the version on your GitHub `main` before v128: v128 (past chats, job locations), v129 (arrival times, Leave Now, the trip screen, phone, tablet and laptop layouts), v130 (professional wording), v131 (icon colours), v132 (how commission is paid), v133 (pros customers can find), v134 (commission before accepting, categories by country), v135 (custom admin permissions), v136 (voice and video calls, instant updates, permissions by action) v137 (voice messages, calls that reconnect, call hours, blocking, call history for disputes) v138 (one "Download a copy of my data" file with everything) v139 (the Market, pros as store owners, and the pro sign-up fix) v140 (safety and anti-fraud, materials for a job, trade prices, calls that don't hang, ringtones) v141 (paying per job, per day or per trip, asking a pro for a price, drivers' ride fares, and Mobile Money payouts instead of PayPal), v142 (Trothen proposes ride fares by distance and time in L$, linked to fuel, and drivers listed like any pro) v143 (the store complete: returns, sizes and colours, sales, discount codes, product reviews, saved goods, delivery by distance) v144 (Post a Job redesigned: 5 short steps, "pros send me their prices" or a real price in L$ or US$, when it's needed, who brings materials, and jobs that close by themselves) v145 (drivers can accept rides whatever their main trade, and a licence is checked for the work being done) v146 (calls no longer get stuck after a dropped call, Admin → Call health, and a Rides switch for each country), v147 (sign-in emails through your own mailbox, Mobile Money done properly and ready for MTN, payouts only when really sent, calls only once a booking is confirmed, Liberia ride places, team managers, "I've finished the job", and a full booking and ride walkthrough), v148 (Market goods paid before the seller is told, cash rides with commission from tokens, maps, GPS and navigation like other apps, Admin → System Check with alerts, and "Get ready" checks for every user), v149 (a full recheck: every screen opened on a phone and a computer, two gaps fixed, and a new check that money and bookings agree) v150 (a deeper recheck, the app starting about three times faster on a slow connection, a clearer "Finish setting up your account" that goes straight to each issue, and the Mobile Money network picked from the number) v151 (a third recheck: a pro's exact location no longer public, the app usable with a screen reader or keyboard to the WCAG 2.1 AA standard, other websites can't read the API, codes can't be guessed, and sign-in limits that suit shared mobile connections) v152 (professional wording across the app: short help lines, the same names everywhere, a compact "Complete your profile" card, and figures that agree between pages) v153 (a fourth recheck: a double-tap or two staff pressing at once can no longer do anything twice, the timed jobs never clash with a person, the All pros search by skill works, and the pro's dashboard is in Spanish for Spanish users), v154 (the phone view: a tab bar at the bottom like other phone apps, every button big enough to tap, the right keyboard for numbers and emails, and fewer things popping up), v155 (the phone view lined up: one edge for everything, an even top bar, one-colour tab icons, and tidy cards, filters and buttons), v156 (bookings checked from start to finish: real dates only, no booking of suspended pros, no cancelling for a refund once the pro has arrived, no tips or extra work that nobody collects, a payment history that counts only real payments, posted-job bookings with their date and time, and jobs nobody started refunded after a week), v157 (extra work and tips on a booking paid by card, payment code or mobile money are paid the same way as the booking, with their own receipt, before the pro gets them), v158 (booking updates by email when you are away from Trothen, reminders the day before and before a payment code runs out, times shown in each person's own time zone, GMV that counts only bookings that went ahead, and cancelled jobs leaving the pros' lists) v159 (messages show in front of pop-ups, and a job posted with no pro nearby stays open, is sent to new pros as they join, and offers the customer next steps, while the team sees where customers are waiting), v160 (a deeper recheck: background checks that never run twice at once, a job sent to at most 15 pros, job matches emailed to pros, a clear "Booking request sent" screen with View my booking, Leave Now only from 12 hours before the job, the install banner never over a pop-up, the phone screens lined up (a posted job's card, Live now in, the welcome card, the chat bubble, the store's status, the tab labels), and extra-work payments that can't clash with completing the job), v161 (checked in Spanish, dark mode, on 4 screen sizes and for admin: the four checks' icons drawn whole, dashboard headings visible in dark mode, admin tables as cards on phones, about 150 Spanish phrases added, clearer dark-mode links), v162 (a shopping cart: one cart across every store, kept on the account and for visitors, a cart icon and count in the top bar, a cart page with save for later, Add to cart in the Market, and checkout one store at a time; goods with sizes or colours now show in the Market) v163 (gaps found by walking store orders, sign-up and password reset with real taps: messages kept off pop-up buttons, sign-up errors shown under each field and the street address optional, nothing of an account left after signing out, no install banner over forms) and v164 (everything re-checked: carts changed at the same moment, the pinned location as a Plus Code on every receipt and the booking screen, Admin → Market to regulate the Market, bicycle deliveries and each driver's distance range, tokens from L$50 in Liberia, a free first week of the Driver Pass, a clearer empty cart, and a delivery walked through on three phones). Deploy only this one. It works whether or not v128 is already live: a file that is already up to date is simply unchanged.

119 files, plus `CHANGES_v128.md` to `CHANGES_v164.md` and this file. Two new packages (nodemailer, and compression in v150), which Render installs by itself from `package.json`. No database changes. For sign-in emails, add the four `SMTP_` settings in section 6 **before** you deploy.

## 1. Files and byte counts

"New" means the file did not exist before v128.

| File | Status | Bytes |
|---|---|---|
| `package-lock.json` | changed | 67,674 |
| `package.json` | changed | 958 |
| `public\app\a11y.js` | **new** | 5,700 |
| `public\app\acceptquote.js` | **new** | 18,387 |
| `public\app\arrival.js` | **new** | 25,120 |
| `public\app\callhealth.js` | **new** | 5,579 |
| `public\app\calls.js` | **new** | 36,358 |
| `public\app\cart.js` | **new** | 28,270 |
| `public\app\categories.js` | **new** | 8,323 |
| `public\app\chats.js` | **new** | 22,031 |
| `public\app\checks.js` | **new** | 19,575 |
| `public\app\commission.js` | **new** | 31,522 |
| `public\app\es-v152.js` | **new** | 46,286 |
| `public\app\instant.js` | **new** | 10,353 |
| `public\app\listing.js` | **new** | 2,662 |
| `public\app\live.js` | changed | 12,129 |
| `public\app\maps.js` | **new** | 20,729 |
| `public\app\market-admin.js` | **new** | 21,113 |
| `public\app\market.js` | **new** | 73,411 |
| `public\app\mobile.js` | **new** | 11,714 |
| `public\app\paymethods.js` | **new** | 9,394 |
| `public\app\payout-details.js` | **new** | 19,764 |
| `public\app\payways.js` | changed | 31,010 |
| `public\app\permissions.js` | **new** | 20,498 |
| `public\app\polish.js` | **new** | 49,124 |
| `public\app\postjob.js` | **new** | 25,576 |
| `public\app\price-units.js` | **new** | 26,023 |
| `public\app\pricing.js` | changed | 35,730 |
| `public\app\review.js` | changed | 19,893 |
| `public\app\rides.js` | changed | 134,620 |
| `public\app\sounds.js` | **new** | 4,867 |
| `public\app\store-plus.js` | **new** | 49,166 |
| `public\app\teams.js` | **new** | 6,193 |
| `public\app\tokens.js` | changed | 61,193 |
| `public\app\trothen.js` | changed | 1,539,120 |
| `public\app\voice.js` | **new** | 28,883 |
| `public\app\where.js` | **new** | 40,061 |
| `public\index.html` | changed | 287,799 |
| `public\manifest.json` | changed | 780 |
| `public\sw.js` | changed | 3,368 |
| `server.js` | changed | 36,513 |
| `src\account-export-zip.js` | **new** | 20,814 |
| `src\account-privacy.js` | changed | 20,699 |
| `src\admin-permissions.js` | **new** | 20,196 |
| `src\arrival-time.js` | **new** | 18,305 |
| `src\auth.js` | changed | 9,382 |
| `src\booking-contact.js` | **new** | 1,623 |
| `src\booking-rules.js` | **new** | 7,651 |
| `src\booking-scheduler.js` | changed | 5,932 |
| `src\cart.js` | **new** | 14,764 |
| `src\category-groups.js` | **new** | 2,113 |
| `src\commission-statement.js` | **new** | 24,561 |
| `src\commission.js` | changed | 6,291 |
| `src\contact-scrub.js` | **new** | 757 |
| `src\contract-locks.js` | changed | 2,424 |
| `src\currency-data.js` | changed | 6,973 |
| `src\customer-payments.js` | changed | 38,666 |
| `src\delivery.js` | changed | 12,293 |
| `src\document-expiry-scheduler.js` | changed | 3,642 |
| `src\document-upload-reminder-scheduler.js` | changed | 2,431 |
| `src\email-notify.js` | **new** | 4,286 |
| `src\fraud-detection.js` | changed | 12,116 |
| `src\go-live.js` | changed | 19,290 |
| `src\job-backfill.js` | **new** | 8,228 |
| `src\job-details.js` | **new** | 6,610 |
| `src\liberia-momo.js` | changed | 14,015 |
| `src\listing.js` | **new** | 1,500 |
| `src\live.js` | changed | 8,232 |
| `src\location-retention-scheduler.js` | changed | 5,125 |
| `src\loyalty.js` | changed | 2,262 |
| `src\market.js` | **new** | 15,052 |
| `src\membership.js` | changed | 3,164 |
| `src\mobile-money.js` | **new** | 5,472 |
| `src\notify.js` | changed | 2,797 |
| `src\payout-methods.js` | **new** | 10,675 |
| `src\payout-sending.js` | **new** | 6,943 |
| `src\payout-settlement-scheduler.js` | changed | 2,489 |
| `src\pdf-report-builder.js` | changed | 8,224 |
| `src\places.js` | **new** | 9,654 |
| `src\platform-settings.js` | changed | 47,843 |
| `src\plus-code.js` | **new** | 2,199 |
| `src\pricing.js` | **new** | 7,877 |
| `src\provider-score-scheduler.js` | changed | 6,587 |
| `src\provider-score.js` | changed | 17,973 |
| `src\readiness.js` | **new** | 11,600 |
| `src\request-queue.js` | **new** | 4,741 |
| `src\ride-fares.js` | **new** | 8,889 |
| `src\ride-pass.js` | changed | 8,812 |
| `src\road-route.js` | **new** | 4,415 |
| `src\routes\admin.routes.js` | changed | 254,669 |
| `src\routes\auth.routes.js` | changed | 96,367 |
| `src\routes\business.routes.js` | changed | 44,173 |
| `src\routes\calls.routes.js` | **new** | 37,291 |
| `src\routes\cart.routes.js` | **new** | 3,943 |
| `src\routes\custpay.routes.js` | changed | 9,743 |
| `src\routes\market-admin.routes.js` | **new** | 20,466 |
| `src\routes\market.routes.js` | **new** | 53,461 |
| `src\routes\marketplace.routes.js` | changed | 205,981 |
| `src\routes\misc.routes.js` | changed | 71,542 |
| `src\routes\orders.routes.js` | changed | 74,551 |
| `src\routes\payments.routes.js` | changed | 118,782 |
| `src\routes\portfolio.routes.js` | changed | 12,133 |
| `src\routes\rides.routes.js` | changed | 89,795 |
| `src\routes\store.routes.js` | changed | 83,196 |
| `src\routes\tokens.routes.js` | changed | 25,314 |
| `src\search-synonyms.js` | changed | 6,181 |
| `src\seed.js` | changed | 32,030 |
| `src\single-flight.js` | **new** | 1,162 |
| `src\stolen-goods.js` | **new** | 7,332 |
| `src\store-extras.js` | **new** | 8,038 |
| `src\store-order-sweep.js` | changed | 3,755 |
| `src\store-orders.js` | changed | 16,083 |
| `src\store.js` | changed | 29,668 |
| `src\sync-reference-data.js` | changed | 8,194 |
| `src\system-check.js` | **new** | 23,031 |
| `src\tokens.js` | changed | 58,112 |
| `src\top-ups.js` | **new** | 9,429 |
| `src\validators.js` | changed | 18,187 |
| `src\zip-stream.js` | **new** | 3,787 |

## 2. Put the files in place and check them
Use Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v164-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir package-lock.json
dir package.json
dir public\app\a11y.js
dir public\app\acceptquote.js
dir public\app\arrival.js
dir public\app\callhealth.js
dir public\app\calls.js
dir public\app\cart.js
dir public\app\categories.js
dir public\app\chats.js
dir public\app\checks.js
dir public\app\commission.js
dir public\app\es-v152.js
dir public\app\instant.js
dir public\app\listing.js
dir public\app\live.js
dir public\app\maps.js
dir public\app\market-admin.js
dir public\app\market.js
dir public\app\mobile.js
dir public\app\paymethods.js
dir public\app\payout-details.js
dir public\app\payways.js
dir public\app\permissions.js
dir public\app\polish.js
dir public\app\postjob.js
dir public\app\price-units.js
dir public\app\pricing.js
dir public\app\review.js
dir public\app\rides.js
dir public\app\sounds.js
dir public\app\store-plus.js
dir public\app\teams.js
dir public\app\tokens.js
dir public\app\trothen.js
dir public\app\voice.js
dir public\app\where.js
dir public\index.html
dir public\manifest.json
dir public\sw.js
dir server.js
dir src\account-export-zip.js
dir src\account-privacy.js
dir src\admin-permissions.js
dir src\arrival-time.js
dir src\auth.js
dir src\booking-contact.js
dir src\booking-rules.js
dir src\booking-scheduler.js
dir src\cart.js
dir src\category-groups.js
dir src\commission-statement.js
dir src\commission.js
dir src\contact-scrub.js
dir src\contract-locks.js
dir src\currency-data.js
dir src\customer-payments.js
dir src\delivery.js
dir src\document-expiry-scheduler.js
dir src\document-upload-reminder-scheduler.js
dir src\email-notify.js
dir src\fraud-detection.js
dir src\go-live.js
dir src\job-backfill.js
dir src\job-details.js
dir src\liberia-momo.js
dir src\listing.js
dir src\live.js
dir src\location-retention-scheduler.js
dir src\loyalty.js
dir src\market.js
dir src\membership.js
dir src\mobile-money.js
dir src\notify.js
dir src\payout-methods.js
dir src\payout-sending.js
dir src\payout-settlement-scheduler.js
dir src\pdf-report-builder.js
dir src\places.js
dir src\platform-settings.js
dir src\plus-code.js
dir src\pricing.js
dir src\provider-score-scheduler.js
dir src\provider-score.js
dir src\readiness.js
dir src\request-queue.js
dir src\ride-fares.js
dir src\ride-pass.js
dir src\road-route.js
dir src\routes\admin.routes.js
dir src\routes\auth.routes.js
dir src\routes\business.routes.js
dir src\routes\calls.routes.js
dir src\routes\cart.routes.js
dir src\routes\custpay.routes.js
dir src\routes\market-admin.routes.js
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
dir src\single-flight.js
dir src\stolen-goods.js
dir src\store-extras.js
dir src\store-order-sweep.js
dir src\store-orders.js
dir src\store.js
dir src\sync-reference-data.js
dir src\system-check.js
dir src\tokens.js
dir src\top-ups.js
dir src\validators.js
dir src\zip-stream.js
```

Each size must match the table exactly. If one is different, copy that file out of the zip again. The easiest way is `deploy_v164.bat`, which checks all of them for you.

## 3. Commit on its own branch (nothing goes live yet)

```
git checkout main
git pull
git checkout -b v164-verify
git add package-lock.json
git add package.json
git add public\app\a11y.js
git add public\app\acceptquote.js
git add public\app\arrival.js
git add public\app\callhealth.js
git add public\app\calls.js
git add public\app\cart.js
git add public\app\categories.js
git add public\app\chats.js
git add public\app\checks.js
git add public\app\commission.js
git add public\app\es-v152.js
git add public\app\instant.js
git add public\app\listing.js
git add public\app\live.js
git add public\app\maps.js
git add public\app\market-admin.js
git add public\app\market.js
git add public\app\mobile.js
git add public\app\paymethods.js
git add public\app\payout-details.js
git add public\app\payways.js
git add public\app\permissions.js
git add public\app\polish.js
git add public\app\postjob.js
git add public\app\price-units.js
git add public\app\pricing.js
git add public\app\review.js
git add public\app\rides.js
git add public\app\sounds.js
git add public\app\store-plus.js
git add public\app\teams.js
git add public\app\tokens.js
git add public\app\trothen.js
git add public\app\voice.js
git add public\app\where.js
git add public\index.html
git add public\manifest.json
git add public\sw.js
git add server.js
git add src\account-export-zip.js
git add src\account-privacy.js
git add src\admin-permissions.js
git add src\arrival-time.js
git add src\auth.js
git add src\booking-contact.js
git add src\booking-rules.js
git add src\booking-scheduler.js
git add src\cart.js
git add src\category-groups.js
git add src\commission-statement.js
git add src\commission.js
git add src\contact-scrub.js
git add src\contract-locks.js
git add src\currency-data.js
git add src\customer-payments.js
git add src\delivery.js
git add src\document-expiry-scheduler.js
git add src\document-upload-reminder-scheduler.js
git add src\email-notify.js
git add src\fraud-detection.js
git add src\go-live.js
git add src\job-backfill.js
git add src\job-details.js
git add src\liberia-momo.js
git add src\listing.js
git add src\live.js
git add src\location-retention-scheduler.js
git add src\loyalty.js
git add src\market.js
git add src\membership.js
git add src\mobile-money.js
git add src\notify.js
git add src\payout-methods.js
git add src\payout-sending.js
git add src\payout-settlement-scheduler.js
git add src\pdf-report-builder.js
git add src\places.js
git add src\platform-settings.js
git add src\plus-code.js
git add src\pricing.js
git add src\provider-score-scheduler.js
git add src\provider-score.js
git add src\readiness.js
git add src\request-queue.js
git add src\ride-fares.js
git add src\ride-pass.js
git add src\road-route.js
git add src\routes\admin.routes.js
git add src\routes\auth.routes.js
git add src\routes\business.routes.js
git add src\routes\calls.routes.js
git add src\routes\cart.routes.js
git add src\routes\custpay.routes.js
git add src\routes\market-admin.routes.js
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
git add src\single-flight.js
git add src\stolen-goods.js
git add src\store-extras.js
git add src\store-order-sweep.js
git add src\store-orders.js
git add src\store.js
git add src\sync-reference-data.js
git add src\system-check.js
git add src\tokens.js
git add src\top-ups.js
git add src\validators.js
git add src\zip-stream.js
git add CHANGES_v128.md CHANGES_v129.md CHANGES_v130.md CHANGES_v131.md CHANGES_v132.md CHANGES_v133.md CHANGES_v134.md CHANGES_v135.md CHANGES_v136.md CHANGES_v137.md CHANGES_v138.md CHANGES_v139.md CHANGES_v140.md CHANGES_v141.md CHANGES_v142.md CHANGES_v143.md CHANGES_v144.md CHANGES_v145.md CHANGES_v146.md CHANGES_v147.md CHANGES_v148.md CHANGES_v149.md CHANGES_v150.md CHANGES_v151.md CHANGES_v152.md CHANGES_v153.md CHANGES_v154.md CHANGES_v155.md CHANGES_v156.md CHANGES_v157.md CHANGES_v158.md CHANGES_v159.md CHANGES_v160.md CHANGES_v161.md CHANGES_v162.md CHANGES_v163.md CHANGES_v164.md DEPLOYMENT_STEPS_v164.md
git status
git commit -m "v164: everything re-checked, pins on receipts, Admin Market, bicycle and distance ranges, L$50 tokens, free Driver Pass week, deliveries end to end (includes v128 to v163)"
git push -u origin v164-verify
```

`git status` should list **155 files** if v128 is already live, **157 files** if it is not, or **27 files** if you already deployed v163 (25 code files, `CHANGES_v164.md` and this file). Any other number means something is off: stop and send me a screenshot.

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
- As a customer, + Post a New Job: 5 steps (What, Details, When & where, Price, Check). Type "plumb" and choose Plumbing; describe the job; choose who brings materials; choose a date; choose "My price is…" and type an amount in L$ (for a Liberian account) to see the US$ amount; check, and Post my job. The job card in My Bookings shows the date, materials and price.
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
- As the super admin: Admin → Call health shows the set-up and the last calls. Admin → Rides → Rides by country shows Liberia On; switch another live country on and off.
- With a test account set to Liberia, Rides shows in the menu. A driver whose main trade is Plumbing can accept a ride.
- **v147:** as the super admin, Admin → Go-Live → "Send a test email" (needs the `SMTP_` settings in your local environment, or it says plainly what is missing).
- **v147:** as a Liberian customer, Payments → Add Payment Method: Mobile Money comes first, with Orange Money and MTN Mobile Money, and no PayPal. Type 0886 123 456 with MTN: it saves and shows only the last 4 digits. Type 0777 123 456 with MTN: it says that number is Orange.
- **v147:** book a pro, then try Call in Messages before the pro confirms: it says the booking must be confirmed first. After the pro confirms, Call works.
- **v147:** as the pro on an active booking, press "I've finished the job". As the customer, the booking says when it completes by itself; press Mark Complete.
- **v147:** as the super admin, Admin → Locations & Admins → New Admin: tick "Team manager". That admin sees My Team and can add people to their own department only.
- **v147:** Admin → Rides → Places shows the 57 starter places of Monrovia, waiting for a pin.
- **v148:** as the super admin, Admin → System Check: each check shows green, orange or red, with the likely cause and what to do. "Copy report" copies it all.
- **v148:** as a pro or driver, the Overview shows "Get ready" with anything missing (payout details, documents, tokens). As a driver with an expired document, "Go online" says what to fix first.
- **v148:** open any map (a ride's Live tracking, or Arrived on a job): Satellite and "my location" buttons, the route drawn, and it stays whole when you turn the phone or resize the window. "Directions" offers Google Maps or Waze.
- **v148:** with "Real payments only" on in a test copy, buy something in the Market: it asks for payment first ("Pay to confirm your order"), and the seller sees nothing until it is confirmed.
- **v164:** open Trothen on a phone without signing in and tap the cart: an empty cart offers Browse pros and their stores and Sign in to see your cart. Book a pro with a pin: the "Booking request sent" screen shows the address, the landmark and the pin as a Plus Code with Open in Maps. As admin, open Market: At a glance, To check, Listings, Store goods, Sellers, Orders, Stolen items, Team activity and Fees. As a pro with Pick & Drop, open Deliveries: Bicycle is the second choice, with "How far I go on one delivery". Download a store receipt: it shows the pin's Plus Code.
- **v163:** sign up on a phone and leave the postcode empty: the message shows in red under that box, and the street address is marked optional. Sign in, then sign out: the sign-in form is empty again.
- **v162:** open a pro's store and tap + on a good: the cart icon in the top bar shows 1. Refresh the page: it still shows 1. Tap the icon: your cart lists the good with + and −, Save for later and Remove, and Check out with this store opens the usual checkout. In the Market, a store good has Add to cart.
- **v161:** on a phone, the four "Every time" cards on the home page show their icons (an ID card, a document, a lock). Switch to dark mode: the headings in your dashboard are visible. Switch to ES: Settings and the bottom tabs are in Spanish. As admin on a phone, Verification shows each person as a card with whole buttons.
- **v160:** book a pro: the screen after booking says "Booking request sent" and has View my booking, which opens the booking. As a pro, a booking two days away has no Leave Now button yet. On a phone, a posted job in My Bookings reads across the card with View Responses, Materials for this job and Cancel Request under it, and Live now in on the home page is centred with the countries evenly spaced.
- **v159:** open Post a Job and press Next without filling a step: the message shows at the top, in front. Post a job in a kind of work nobody offers in your city: the new screen explains what happens next, with See all pros and Invite a pro you know.
- **v158:** sign out of Trothen, then make a booking for a pro from another account: the pro gets an email about it. Settings → Notifications has "Email me updates".
- **v157:** in a country paying by code or card, as a pro ask for extra work on a job, then as the customer approve it: My Bookings shows "Extra work" waiting with Pay now, and the job total goes up only after the payment is confirmed.
- **v156:** as a customer, open My Bookings: the When column shows the job's day and time. Try to book a pro for yesterday: it is refused. In Payments, a cancelled booking you never paid says "Not paid".
- **v155:** on your phone, open a few sections as a customer and as a pro: titles, boxes and buttons all start the same distance from the edge, the top bar shows the logo then EN, the bell and your name at the same size, and the bottom bar's icons are grey with the one you're on in blue.
- **v154:** on your phone, sign in as a customer and as a pro: a bar at the bottom shows Home, Bookings or Jobs, Messages and More; More opens the rest. On a computer the side menu is as before.
- **v153:** on the home page open All pros and search for a skill such as "plumbing" or "pipe": the list filters with no error. In Render → trothen-api → Environment, note whether `DATABASE_URL` is set (Postgres) or not (file store).
- **v152:** as a pro, the Overview starts with "Welcome back", then "Complete your profile" with Required and Recommended items and "Show more". The payout box shows the same amount as Earnings → Available for Payout.
- **v151:** in Settings, tap a label such as "Full Name": the cursor goes into that field. On a computer, press Tab: the side menu items light up one by one, and Enter opens one.
- **v151:** sign in to the live site from your phone on mobile data and from a computer: both work as before.
- **v150:** open the site on your phone twice: the second time it should appear almost at once.
- **v150:** as a pro, the Overview shows "Finish setting up your account". Each line is an action marked Needed or Recommended, and each button takes you straight to the field and highlights it. In Settings → Where your money is paid, typing 0886… picks MTN Mobile Money by itself.
- **v149:** Admin → System Check has "Money and bookings agree" (green).
- **v148:** the side menu shows "📍 Account in …" under your name. As a pro, Settings → Extra skills says "Tick up to 10 more" (25 with a business name). As a customer, Payments → Add Payment Method → Mobile Money asks "Whose number is it?".
- As the super admin, Admin → Rides → Fares: choose Liberia, enter L$ fares for motorbike and car, and see the example fares change as you type. Save.

Press Ctrl+C when you're done.

## 5. Make it live

```
git checkout main
git merge v164-verify
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
- **Market fees:** store goods now carry 8% (at least $0.50) paid by the seller, instead of the $5 the buyer paid. Change it in Admin → Market → Fees if you prefer (it moved there in v164).
- Pros with a store: ask them to choose their Market categories (Market → Sell → "Your store in the Market").
- If you edited the privacy policy in Admin before, change section 7 there to name "Download a copy of my data" (see `CHANGES_v138.md`).
- Render → Environment: check `PRIVATE_UPLOADS_DIR` is set (Admin → Go-Live shows it). Voice messages are kept there, like ID documents.
- **Pricing (v141):** tell your pros about Settings → How you charge. Most should choose Per job, with a few fixed prices for their common jobs. Drivers like James Doe choose Per trip or Per day, and apply under Rides to carry passengers.
- **Calls (v146):** add TURN_API_URL (relay, so calls connect on every network) and VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (phone push) on Render. Admin → Call health then shows whether calls connect, and why any didn't.
- **Rides (v145, v146):** the Rides menu only shows for accounts in a country switched on in Admin → Rides → Rides by country (Liberia). To see the rider and driver side, use a test account set to Liberia.
- **Post a Job (v144):** jobs now close by themselves after 14 days (or the day after their date), and customers are told. Keep the L$ exchange rate in Admin current: an L$ price is kept in US$ at that rate.
- **Market (v143):** tell people about "Register a stolen item" in the Market, and that phones, laptops and vehicles now need their IMEI or serial number. Decide with an attorney how to answer police requests about a seller.
- **Store (v143):** tell sellers about returns (at least 7 days for faulty goods), sizes and colours, sales and discount codes. Their money for an order is paid after its return window. Change the 7 days in Admin → Stores & Skills → Store returns.
- **Ride fares (v142):** Admin → Categories & Countries → Sync Latest Categories & Countries adds "Driver for Hire". Then Admin → Rides → Fares → Liberia: set the L$ fares with a few drivers from each vehicle type, and enter today's pump price. For real road distances, set `ROUTING_URL` on Render to an OSRM routing service (see `CHANGES_v142.md`).
- **Sign-in emails (v147, do this first):** Render → Environment, add `SMTP_HOST` = `mail.privateemail.com`, `SMTP_PORT` = `465`, `SMTP_USER` = `noreply@trothenpro.com`, `SMTP_PASS` = that mailbox's password. Emails show as from "Trothen". Then Admin → Go-Live → "Send a test email" to yourself.
- **Places (v147):** ask someone in Monrovia to pin the 57 starter places in Admin → Rides → Places, on the satellite view (about 30 minutes). Riders can search only pinned places. Places riders keep typing appear there as suggestions.
- **Payouts (v147):** payouts no longer turn to "paid" by themselves once "Real payments only" is on. Finance sends each one and presses "Mark as sent" with the transaction ID, in Admin → Payments → Payouts being sent.
- **MTN MoMo (v147, when MTN gives you the keys):** add the six `LCMMMI_COLLECTIONS_*` and `LCMMMI_DISBURSEMENT_*` keys, `LCMMMI_BASE_URL`, `LCMMMI_TARGET_ENVIRONMENT`, `LCMMMI_CALLBACK_URL` = `https://trothenpro.com/api/webhooks/mtn-momo`, and last `LCMMMI_INTEGRATION_ENABLED` = `true`. Test with about $1 each way first. See `CHANGES_v147.md`.
- **Maps (v148, before many people use it):** Render → Environment, add `MAPBOX_TOKEN` (free from mapbox.com, public token starting `pk.`, limited to trothenpro.com). Every map, satellite included, then uses Mapbox, which allows business use.
- **System Check (v148):** look at Admin → System Check after deploying, and fix anything red. Alerts arrive in your notifications from then on.
- **Real payments (v148):** "Real payments only" now refuses to switch on until customers have a way to pay (Trothen's Mobile Money number in Admin → Tokens → Countries) and email works. Market purchases are then paid before the seller is told.
- **Payout details (v141):** pros and sellers must add their Mobile Money number or bank account before they can cash out. Render → Environment: make sure `ID_FILE_ENCRYPTION_KEY` is set (Admin → Go-Live shows it), so the numbers are stored encrypted. The team sends payouts from Admin → Payments → Payouts being sent.
- **Tokens from L$50 (v164):** if you ever saved the Liberia packs in Admin → Tokens → Countries → Liberia, add two packs there yourself: "L$50" (price US$0.26, tokens 0.26, fixed local price 50) and "L$100" (US$0.52, 0.52, 100). If you never saved them, they are already there.
- **Free first week (v164):** Admin → Rides → settings → "Free first pass for new drivers" is 7 days. Tell drivers to press "Start my free week" when they are ready to drive. Set it to 0 to stop offering it.
- **Couriers (v164):** tell drivers and couriers about "How far I go on one delivery" under Deliveries (and on the Rides page for ride drivers). Bicycle couriers add "Pick & Drop" to their skills; they don't use the ride-driver form.
- **Market (v164):** Admin → Market is where the team now checks reported listings, stops sellers who break the rules and closes stolen-item reports. Give custom admins the new "Market" permission if they should do this.
