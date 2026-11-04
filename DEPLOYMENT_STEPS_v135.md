# Trothen v135: deployment steps (includes v128 to v134)

This one package holds everything since the version on your GitHub `main` before v128: v128 (past chats, job locations), v129 (arrival times, Leave Now, the trip screen, phone, tablet and laptop layouts), v130 (professional wording), v131 (icon colours), v132 (how commission is paid), v133 (pros customers can find), v134 (commission before accepting, categories by country) and v135 (custom admin permissions). Deploy only this one. It works whether or not v128 is already live: a file that is already up to date is simply unchanged.

49 files, plus `CHANGES_v128.md` to `CHANGES_v135.md` and this file. No new packages, environment variables or database changes.

## 1. Files and byte counts

"New" means the file did not exist before v128.

| File | Status | Bytes |
|---|---|---|
| `public\app\acceptquote.js` | **new** | 18,387 |
| `public\app\arrival.js` | **new** | 23,934 |
| `public\app\categories.js` | **new** | 8,323 |
| `public\app\chats.js` | **new** | 20,771 |
| `public\app\commission.js` | **new** | 31,926 |
| `public\app\listing.js` | **new** | 2,648 |
| `public\app\permissions.js` | **new** | 15,205 |
| `public\app\polish.js` | **new** | 48,447 |
| `public\app\tokens.js` | changed | 62,296 |
| `public\app\trothen.js` | changed | 1,502,551 |
| `public\app\where.js` | **new** | 39,268 |
| `public\index.html` | changed | 257,137 |
| `server.js` | changed | 29,488 |
| `src\account-privacy.js` | changed | 17,690 |
| `src\admin-permissions.js` | **new** | 12,312 |
| `src\arrival-time.js` | **new** | 14,465 |
| `src\auth.js` | changed | 9,382 |
| `src\category-groups.js` | **new** | 2,106 |
| `src\commission-statement.js` | **new** | 24,131 |
| `src\commission.js` | changed | 6,291 |
| `src\currency-data.js` | changed | 6,973 |
| `src\customer-payments.js` | changed | 26,295 |
| `src\document-expiry-scheduler.js` | changed | 3,642 |
| `src\document-upload-reminder-scheduler.js` | changed | 2,431 |
| `src\fraud-detection.js` | changed | 12,153 |
| `src\go-live.js` | changed | 18,106 |
| `src\liberia-momo.js` | changed | 14,015 |
| `src\listing.js` | **new** | 943 |
| `src\live.js` | changed | 7,261 |
| `src\location-retention-scheduler.js` | changed | 5,125 |
| `src\loyalty.js` | changed | 2,262 |
| `src\membership.js` | changed | 3,164 |
| `src\platform-settings.js` | changed | 47,126 |
| `src\provider-score-scheduler.js` | changed | 6,587 |
| `src\provider-score.js` | changed | 17,973 |
| `src\routes\admin.routes.js` | changed | 243,131 |
| `src\routes\auth.routes.js` | changed | 82,699 |
| `src\routes\business.routes.js` | changed | 43,724 |
| `src\routes\custpay.routes.js` | changed | 8,755 |
| `src\routes\marketplace.routes.js` | changed | 187,666 |
| `src\routes\misc.routes.js` | changed | 69,437 |
| `src\routes\payments.routes.js` | changed | 87,036 |
| `src\routes\portfolio.routes.js` | changed | 12,133 |
| `src\routes\rides.routes.js` | changed | 67,544 |
| `src\routes\store.routes.js` | changed | 63,203 |
| `src\routes\tokens.routes.js` | changed | 24,844 |
| `src\search-synonyms.js` | changed | 5,862 |
| `src\tokens.js` | changed | 56,721 |
| `src\validators.js` | changed | 17,727 |

## 2. Put the files in place and check them
Use Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v135-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir public\app\acceptquote.js
dir public\app\arrival.js
dir public\app\categories.js
dir public\app\chats.js
dir public\app\commission.js
dir public\app\listing.js
dir public\app\permissions.js
dir public\app\polish.js
dir public\app\tokens.js
dir public\app\trothen.js
dir public\app\where.js
dir public\index.html
dir server.js
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
dir src\membership.js
dir src\platform-settings.js
dir src\provider-score-scheduler.js
dir src\provider-score.js
dir src\routes\admin.routes.js
dir src\routes\auth.routes.js
dir src\routes\business.routes.js
dir src\routes\custpay.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\misc.routes.js
dir src\routes\payments.routes.js
dir src\routes\portfolio.routes.js
dir src\routes\rides.routes.js
dir src\routes\store.routes.js
dir src\routes\tokens.routes.js
dir src\search-synonyms.js
dir src\tokens.js
dir src\validators.js
```

Each size must match the table exactly. If one is different, copy that file out of the zip again. The easiest way is `deploy_v135.bat`, which checks all of them for you.

## 3. Commit on its own branch (nothing goes live yet)

```
git checkout main
git pull
git checkout -b v135-admin-permissions
git add public\app\acceptquote.js
git add public\app\arrival.js
git add public\app\categories.js
git add public\app\chats.js
git add public\app\commission.js
git add public\app\listing.js
git add public\app\permissions.js
git add public\app\polish.js
git add public\app\tokens.js
git add public\app\trothen.js
git add public\app\where.js
git add public\index.html
git add server.js
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
git add src\membership.js
git add src\platform-settings.js
git add src\provider-score-scheduler.js
git add src\provider-score.js
git add src\routes\admin.routes.js
git add src\routes\auth.routes.js
git add src\routes\business.routes.js
git add src\routes\custpay.routes.js
git add src\routes\marketplace.routes.js
git add src\routes\misc.routes.js
git add src\routes\payments.routes.js
git add src\routes\portfolio.routes.js
git add src\routes\rides.routes.js
git add src\routes\store.routes.js
git add src\routes\tokens.routes.js
git add src\search-synonyms.js
git add src\tokens.js
git add src\validators.js
git add CHANGES_v128.md CHANGES_v129.md CHANGES_v130.md CHANGES_v131.md CHANGES_v132.md CHANGES_v133.md CHANGES_v134.md CHANGES_v135.md DEPLOYMENT_STEPS_v135.md
git status
git commit -m "v135: custom admin permissions (includes v128 to v134)"
git push -u origin v135-admin-permissions
```

`git status` should list **55 files** if v128 is already live, or **58 files** if it is not. Any other number means something is off: stop and send me a screenshot.

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
- Admin → Locations & Admins → New Admin → Role has "Custom permissions", and each team member has a Permissions button.

Press Ctrl+C when you're done.

## 5. Make it live

```
git checkout main
git merge v135-admin-permissions
git push
```

Render deploys after this push.

## 6. After it's live
- **First:** Admin → Categories & Countries → Sync Latest Categories & Countries, so the 60 standard categories (Landscaping included) are on the live site.
- Ask any pro with a red "with no profile photo" count on the admin Categories page to add a profile photo, so customers can find them.
- Admin → Tokens → Settings: untick "TEST SITES ONLY" once real money starts. Decide whether to turn on "Cash jobs" (see `CHANGES_v132.md`).
- If you edited About Us in Admin before, paste the new text from `CHANGES_v130.md` into Admin → Settings → About Us.
- Run the two-phone arrival-time test in section 6 of `DEPLOYMENT_STEPS_v129.md`.
