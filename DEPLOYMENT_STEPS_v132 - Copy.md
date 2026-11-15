# Trothen v132: deployment steps (commission statement; includes v128 to v131)

This one package holds everything since the version on your GitHub `main` before v128: v128 (past chats, job locations), v129 (arrival times, Leave Now, the trip screen, phone, tablet and laptop layouts), v130 (professional wording), v131 (icon colours) and v132 (how commission is paid). Deploy only this one. It works whether or not v128 is already live: a file that is already up to date is simply unchanged.

39 files, plus `CHANGES_v128.md` to `CHANGES_v132.md` and this file. No new packages, environment variables or database changes.

## 1. Files and byte counts

"New" means the file did not exist before v128.

| File | Status | Bytes |
|---|---|---|
| `public\app\arrival.js` | **new** | 23,934 |
| `public\app\chats.js` | **new** | 20,771 |
| `public\app\commission.js` | **new** | 31,770 |
| `public\app\polish.js` | **new** | 48,447 |
| `public\app\tokens.js` | changed | 62,323 |
| `public\app\trothen.js` | changed | 1,485,326 |
| `public\app\where.js` | **new** | 39,268 |
| `public\index.html` | changed | 256,914 |
| `server.js` | changed | 29,258 |
| `src\account-privacy.js` | changed | 17,690 |
| `src\arrival-time.js` | **new** | 14,465 |
| `src\auth.js` | changed | 9,382 |
| `src\commission-statement.js` | **new** | 21,260 |
| `src\commission.js` | changed | 6,291 |
| `src\currency-data.js` | changed | 6,973 |
| `src\document-expiry-scheduler.js` | changed | 3,642 |
| `src\document-upload-reminder-scheduler.js` | changed | 2,431 |
| `src\fraud-detection.js` | changed | 12,153 |
| `src\go-live.js` | changed | 18,106 |
| `src\liberia-momo.js` | changed | 14,015 |
| `src\live.js` | changed | 7,261 |
| `src\location-retention-scheduler.js` | changed | 5,125 |
| `src\loyalty.js` | changed | 2,262 |
| `src\membership.js` | changed | 3,164 |
| `src\platform-settings.js` | changed | 47,126 |
| `src\provider-score-scheduler.js` | changed | 6,504 |
| `src\provider-score.js` | changed | 17,973 |
| `src\routes\admin.routes.js` | changed | 238,209 |
| `src\routes\auth.routes.js` | changed | 82,021 |
| `src\routes\business.routes.js` | changed | 43,724 |
| `src\routes\marketplace.routes.js` | changed | 185,928 |
| `src\routes\misc.routes.js` | changed | 69,100 |
| `src\routes\payments.routes.js` | changed | 84,750 |
| `src\routes\portfolio.routes.js` | changed | 12,133 |
| `src\routes\rides.routes.js` | changed | 67,489 |
| `src\routes\store.routes.js` | changed | 63,148 |
| `src\routes\tokens.routes.js` | changed | 24,829 |
| `src\tokens.js` | changed | 56,821 |
| `src\validators.js` | changed | 17,727 |

## 2. Put the files in place and check them
Use Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v132-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir public\app\arrival.js
dir public\app\chats.js
dir public\app\commission.js
dir public\app\polish.js
dir public\app\tokens.js
dir public\app\trothen.js
dir public\app\where.js
dir public\index.html
dir server.js
dir src\account-privacy.js
dir src\arrival-time.js
dir src\auth.js
dir src\commission-statement.js
dir src\commission.js
dir src\currency-data.js
dir src\document-expiry-scheduler.js
dir src\document-upload-reminder-scheduler.js
dir src\fraud-detection.js
dir src\go-live.js
dir src\liberia-momo.js
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
dir src\routes\marketplace.routes.js
dir src\routes\misc.routes.js
dir src\routes\payments.routes.js
dir src\routes\portfolio.routes.js
dir src\routes\rides.routes.js
dir src\routes\store.routes.js
dir src\routes\tokens.routes.js
dir src\tokens.js
dir src\validators.js
```

Each size must match the table exactly. If one is different, copy that file out of the zip again. The easiest way is `deploy_v132.bat`, which checks all of them for you.

## 3. Commit on its own branch (nothing goes live yet)

```
git checkout main
git pull
git checkout -b v132-commission-statement
git add public\app\arrival.js
git add public\app\chats.js
git add public\app\commission.js
git add public\app\polish.js
git add public\app\tokens.js
git add public\app\trothen.js
git add public\app\where.js
git add public\index.html
git add server.js
git add src\account-privacy.js
git add src\arrival-time.js
git add src\auth.js
git add src\commission-statement.js
git add src\commission.js
git add src\currency-data.js
git add src\document-expiry-scheduler.js
git add src\document-upload-reminder-scheduler.js
git add src\fraud-detection.js
git add src\go-live.js
git add src\liberia-momo.js
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
git add src\routes\marketplace.routes.js
git add src\routes\misc.routes.js
git add src\routes\payments.routes.js
git add src\routes\portfolio.routes.js
git add src\routes\rides.routes.js
git add src\routes\store.routes.js
git add src\routes\tokens.routes.js
git add src\tokens.js
git add src\validators.js
git add CHANGES_v128.md CHANGES_v129.md CHANGES_v130.md CHANGES_v131.md CHANGES_v132.md DEPLOYMENT_STEPS_v132.md
git status
git commit -m "v132: how commission is paid, and tokens pay it first (includes v128 to v131)"
git push -u origin v132-commission-statement
```

`git status` should list **42 files** if v128 is already live, or **45 files** if it is not. Any other number means something is off: stop and send me a screenshot.

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

Press Ctrl+C when you're done.

## 5. Make it live

```
git checkout main
git merge v132-commission-statement
git push
```

Render deploys after this push.

## 6. After it's live
- Admin → Tokens → Settings: untick "TEST SITES ONLY" once real money starts. Decide whether to turn on "Cash jobs" (see `CHANGES_v132.md`).
- If you edited About Us in Admin before, paste the new text from `CHANGES_v130.md` into Admin → Settings → About Us.
- Run the two-phone arrival-time test in section 6 of `DEPLOYMENT_STEPS_v129.md`.
