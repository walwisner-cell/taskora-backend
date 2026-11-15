# Trothen v140: deployment steps (includes v128 to v139)

This one package holds everything since the version on your GitHub `main` before v128: v128 (past chats, job locations), v129 (arrival times, Leave Now, the trip screen, phone, tablet and laptop layouts), v130 (professional wording), v131 (icon colours), v132 (how commission is paid), v133 (pros customers can find), v134 (commission before accepting, categories by country), v135 (custom admin permissions), v136 (voice and video calls, instant updates, permissions by action) v137 (voice messages, calls that reconnect, call hours, blocking, call history for disputes) v138 (one "Download a copy of my data" file with everything) v139 (the Market, pros as store owners, and the pro sign-up fix) and v140 (safety and anti-fraud, materials for a job, trade prices, calls that don't hang, ringtones). Deploy only this one. It works whether or not v128 is already live: a file that is already up to date is simply unchanged.

63 files, plus `CHANGES_v128.md` to `CHANGES_v140.md` and this file. No new packages or database changes. Calls work without any new setting; the optional TURN settings are in section 6.

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
| `public\app\market.js` | **new** | 61,838 |
| `public\app\permissions.js` | **new** | 20,454 |
| `public\app\polish.js` | **new** | 48,839 |
| `public\app\sounds.js` | **new** | 4,867 |
| `public\app\tokens.js` | changed | 62,296 |
| `public\app\trothen.js` | changed | 1,507,784 |
| `public\app\voice.js` | **new** | 28,964 |
| `public\app\where.js` | **new** | 39,268 |
| `public\index.html` | changed | 257,986 |
| `server.js` | changed | 30,233 |
| `src\account-export-zip.js` | **new** | 20,814 |
| `src\account-privacy.js` | changed | 20,046 |
| `src\admin-permissions.js` | **new** | 18,759 |
| `src\arrival-time.js` | **new** | 14,465 |
| `src\auth.js` | changed | 9,382 |
| `src\category-groups.js` | **new** | 2,106 |
| `src\commission-statement.js` | **new** | 24,440 |
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
| `src\platform-settings.js` | changed | 47,263 |
| `src\provider-score-scheduler.js` | changed | 6,587 |
| `src\provider-score.js` | changed | 17,973 |
| `src\routes\admin.routes.js` | changed | 245,393 |
| `src\routes\auth.routes.js` | changed | 87,091 |
| `src\routes\business.routes.js` | changed | 43,724 |
| `src\routes\calls.routes.js` | **new** | 30,012 |
| `src\routes\custpay.routes.js` | changed | 8,756 |
| `src\routes\market.routes.js` | **new** | 46,664 |
| `src\routes\marketplace.routes.js` | changed | 188,516 |
| `src\routes\misc.routes.js` | changed | 71,432 |
| `src\routes\orders.routes.js` | changed | 48,492 |
| `src\routes\payments.routes.js` | changed | 87,876 |
| `src\routes\portfolio.routes.js` | changed | 12,133 |
| `src\routes\rides.routes.js` | changed | 67,544 |
| `src\routes\store.routes.js` | changed | 67,309 |
| `src\routes\tokens.routes.js` | changed | 24,845 |
| `src\search-synonyms.js` | changed | 5,862 |
| `src\store-orders.js` | changed | 10,255 |
| `src\store.js` | changed | 22,100 |
| `src\tokens.js` | changed | 56,722 |
| `src\validators.js` | changed | 17,727 |
| `src\zip-stream.js` | **new** | 3,787 |

## 2. Put the files in place and check them
Use Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v140-files.zip` over your project folder, then:

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
dir public\app\permissions.js
dir public\app\polish.js
dir public\app\sounds.js
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
dir src\platform-settings.js
dir src\provider-score-scheduler.js
dir src\provider-score.js
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
dir src\store-orders.js
dir src\store.js
dir src\tokens.js
dir src\validators.js
dir src\zip-stream.js
```

Each size must match the table exactly. If one is different, copy that file out of the zip again. The easiest way is `deploy_v140.bat`, which checks all of them for you.

## 3. Commit on its own branch (nothing goes live yet)

```
git checkout main
git pull
git checkout -b v140-safety
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
git add public\app\permissions.js
git add public\app\polish.js
git add public\app\sounds.js
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
git add src\platform-settings.js
git add src\provider-score-scheduler.js
git add src\provider-score.js
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
git add src\store-orders.js
git add src\store.js
git add src\tokens.js
git add src\validators.js
git add src\zip-stream.js
git add CHANGES_v128.md CHANGES_v129.md CHANGES_v130.md CHANGES_v131.md CHANGES_v132.md CHANGES_v133.md CHANGES_v134.md CHANGES_v135.md CHANGES_v136.md CHANGES_v137.md CHANGES_v138.md CHANGES_v139.md CHANGES_v140.md DEPLOYMENT_STEPS_v140.md
git status
git commit -m "v140: safety and anti-fraud, Market phase 2, calls, ringtones (includes v128 to v139)"
git push -u origin v140-safety
```

`git status` should list **75 files** if v128 is already live, or **77 files** if it is not. Any other number means something is off: stop and send me a screenshot.

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

Press Ctrl+C when you're done.

## 5. Make it live

```
git checkout main
git merge v140-safety
git push
```

Render deploys after this push.

## 6. After it's live
- **First:** Admin → Categories & Countries → Sync Latest Categories & Countries, so the 60 standard categories (Landscaping included) are on the live site.
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
