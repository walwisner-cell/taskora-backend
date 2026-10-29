# Trothen v119 — Deployment Steps (cash jobs, Pro token commission, protected payments by code)

v119 includes the v118.1 urgent fix. If v118.1 isn't deployed yet, deploy only this one. 28 files (10 new: 3 code files, plus the 6 payment logos and their NOTICE.txt in `public\img\pay`), plus CHANGES_v119.md, this file and the guide `Trothen_Payments_and_Tokens_Guide.pdf` (the guide is for reading only and doesn't need to go in the repo). No new packages, environment variables or database migration.

## 1. Files and byte counts

| File | Status | Bytes |
|---|---|---|
| `src\tokens.js` | modified | 53,624 |
| `src\customer-payments.js` | **new** | 15,118 |
| `src\platform-settings.js` | modified | 47,045 |
| `src\store-orders.js` | modified | 10,142 |
| `src\store-order-sweep.js` | modified | 2,496 |
| `src\booking-scheduler.js` | modified | 4,607 |
| `src\ride-sweep.js` | modified | 9,902 |
| `src\account-privacy.js` | modified | 17,665 |
| `src\routes\payments.routes.js` | modified | 83,775 |
| `src\routes\admin.routes.js` | modified | 236,323 |
| `src\routes\orders.routes.js` | modified | 45,470 |
| `src\routes\rides.routes.js` | modified | 64,489 |
| `src\routes\tokens.routes.js` | modified | 23,989 |
| `src\routes\custpay.routes.js` | **new** | 6,140 |
| `src\routes\marketplace.routes.js` | modified | 151,610 |
| `public\app\trothen.js` | modified | 1,479,981 |
| `public\app\tokens.js` | modified | 60,513 |
| `public\app\payways.js` | **new** | 25,502 |
| `public\app\rides.js` | modified | 80,585 |
| `public\index.html` | modified | 239,170 |
| `public\img\pay\visa.svg` | **new** | 1,383 |
| `public\img\pay\mastercard.svg` | **new** | 3,246 |
| `public\img\pay\amex.svg` | **new** | 4,734 |
| `public\img\pay\discover.svg` | **new** | 2,287 |
| `public\img\pay\paypal.svg` | **new** | 4,242 |
| `public\img\pay\applepay.svg` | **new** | 2,637 |
| `public\img\pay\NOTICE.txt` | **new** | 729 |
| `server.js` | modified | 27,774 |

## 2. cmd.exe steps

Open Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v119-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir src\tokens.js
dir src\customer-payments.js
dir src\platform-settings.js
dir src\store-orders.js
dir src\store-order-sweep.js
dir src\booking-scheduler.js
dir src\ride-sweep.js
dir src\account-privacy.js
dir src\routes\payments.routes.js
dir src\routes\admin.routes.js
dir src\routes\orders.routes.js
dir src\routes\rides.routes.js
dir src\routes\tokens.routes.js
dir src\routes\custpay.routes.js
dir src\routes\marketplace.routes.js
dir public\app\trothen.js
dir public\app\tokens.js
dir public\app\payways.js
dir public\app\rides.js
dir public\index.html
dir public\img\pay\visa.svg
dir public\img\pay\mastercard.svg
dir public\img\pay\amex.svg
dir public\img\pay\discover.svg
dir public\img\pay\paypal.svg
dir public\img\pay\applepay.svg
dir public\img\pay\NOTICE.txt
dir server.js
```

Check each byte count against the table. If any differs, copy that file again.

**Step A: put it on its own branch (nothing goes live yet)**

```
git checkout -b v119-cash-jobs
git add src\tokens.js
git add src\customer-payments.js
git add src\platform-settings.js
git add src\store-orders.js
git add src\store-order-sweep.js
git add src\booking-scheduler.js
git add src\ride-sweep.js
git add src\account-privacy.js
git add src\routes\payments.routes.js
git add src\routes\admin.routes.js
git add src\routes\orders.routes.js
git add src\routes\rides.routes.js
git add src\routes\tokens.routes.js
git add src\routes\custpay.routes.js
git add src\routes\marketplace.routes.js
git add public\app\trothen.js
git add public\app\tokens.js
git add public\app\payways.js
git add public\app\rides.js
git add public\index.html
git add public\img\pay\visa.svg public\img\pay\mastercard.svg public\img\pay\amex.svg public\img\pay\discover.svg public\img\pay\paypal.svg public\img\pay\applepay.svg public\img\pay\NOTICE.txt
git add server.js
git add CHANGES_v119.md DEPLOYMENT_STEPS_v119.md
git status
git commit -m "v119: cash jobs with token commission, protected payments by code"
git push -u origin v119-cash-jobs
```

`git status` should list exactly these 30 files to be committed.

**Step B: test it on your computer before it's live**

```
npm install
set PORT=3001
node server.js
```

Open http://localhost:3001 and try the checks in section 3. On your own computer you can tick the **TEST SITES ONLY** box in Admin → Tokens, so you can buy test tokens "in the app" without paying.

**Step C: make it live**

```
git checkout main
git merge v119-cash-jobs
git push
```

Render deploys after this push. Store orders and app-paid rides start working again from this moment.

## 3. Straight after it's live (in this order)

1. **Admin → Tokens → Settings:**
   - Make sure **TEST SITES ONLY** is **off**.
   - Tick **LIVE SITE: pay out only money Trothen really received**.
   - Leave **Cash jobs are on** ticked, unless you're not ready to offer cash jobs.
   - Press **Save settings**.
2. **Admin → Tokens → Countries → Liberia → Show:**
   - Enter Trothen's official mobile money number (network, number, account name).
   - Set **Protected payments** to **Payment code**.
   - Press **Save Liberia**.
   - Do the same for each country you operate in.
3. **Test a protected booking as a customer in Liberia:**
   - Book a pro with **Protected by Trothen**. You get a code.
   - Send a small real payment from a phone with the code in the reference, then press **I have sent it**.
   - In **Admin → Customer Payments**, find the code, enter Trothen's transaction ID and the amount received, and press **Confirm payment**. The pro is then asked to confirm.
4. **Test token purchase and a cash job as a pro:**
   - On **Tokens**, choose **Mini**, then **Send mobile money myself: get a payment code**.
   - Pay it, then confirm it in **Admin → Tokens → Mobile money payment codes**.
   - Accept a cash booking. The commission is taken from tokens.
   - As the customer, mark the job done and enter the cash paid.
5. **Check the fix:** place a store order (pickup) and cancel it. Both should work.
