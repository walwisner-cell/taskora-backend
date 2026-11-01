# Trothen v125: Full Deployment (jobs and rides)

The whole project as it should be after v125 (includes v120 to v124). It leaves out `data\`, `uploads\`, `private-uploads\`, `node_modules\` and `.env`, so unzipping over your project never touches your real data or secrets.

## Before you deploy: what changes for customers the moment it's live
Unless you set up a real way to pay, **"Protected by Trothen" is no longer offered**, and jobs are paid in cash. That's on purpose: no pretend payments on the live site. To offer it, do at least one of these first (or straight after), as explained in CHANGES_v125.md:
- add the **Stripe keys** on Render (card payments), or
- add **Trothen's accounts** for a country in Admin → Tokens → Countries, and set Protected payments to "Pay to Trothen's account with a code".

Liberia already has an account and code set, so it keeps working as before.

## 1. Unzip over your project (cmd.exe, not PowerShell)

Change the first line if your folder is different. The zip is assumed to be in Downloads.

```
cd /d C:\path\to\trothen-backend
git checkout main
git pull
tar -xf "%USERPROFILE%\Downloads\trothen-v125-FULL.zip"
```

## 2. Check the byte counts

```
dir server.js
dir src\stripe-pay.js
dir src\customer-payments.js
dir src\platform-settings.js
dir src\go-live.js
dir src\tokens.js
dir src\routes\marketplace.routes.js
dir src\routes\custpay.routes.js
dir src\routes\tokens.routes.js
dir src\routes\payments.routes.js
dir src\routes\rides.routes.js
dir public\app\trothen.js
dir public\app\review.js
dir public\app\payways.js
dir public\app\pricing.js
dir public\app\live.js
dir public\app\tokens.js
dir public\app\rides.js
dir public\index.html
```

| File | Bytes |
|---|---|
| server.js | 28,642 |
| src\stripe-pay.js | 5,843 |
| src\customer-payments.js | 25,976 |
| src\platform-settings.js | 47,190 |
| src\go-live.js | 17,994 |
| src\tokens.js | 55,647 |
| src\routes\marketplace.routes.js | 178,430 |
| src\routes\custpay.routes.js | 8,546 |
| src\routes\tokens.routes.js | 24,450 |
| src\routes\payments.routes.js | 84,144 |
| src\routes\rides.routes.js | 67,487 |
| public\app\trothen.js | 1,485,816 |
| public\app\review.js | 18,798 |
| public\app\payways.js | 27,442 |
| public\app\pricing.js | 31,843 |
| public\app\live.js | 10,951 |
| public\app\tokens.js | 61,972 |
| public\app\rides.js | 92,061 |
| public\index.html | 239,481 |

`FILE_LIST_v125.txt` has the byte count of every file in the package. If a number is different, unzip again.

## 3. Commit and push

```
git checkout -b v125-pay
git add -A
git status
```

Check the list: there must be nothing under `data\`, `uploads\` or `node_modules\`, and no `.env`. Then:

```
git commit -m "v125: agreed price and pay step for jobs and rides, real payments (card + pay-to-account), instant fix"
git push -u origin v125-pay
git checkout main
git merge v125-pay
git push origin main
```

Render deploys on its own. Wait for **Live**, then press **Ctrl+F5** on trothenpro.com.

## 4. Switch on real payments (Render and Admin, no code)
- **Cards:** on Render, open trothen-api → Environment and add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `PUBLIC_BASE_URL` = `https://trothenpro.com`. In Stripe, the webhook goes to `https://trothenpro.com/api/webhooks/stripe` (events `checkout.session.completed` and `checkout.session.async_payment_succeeded`). Full steps are in CHANGES_v125.md.
- **Accounts:** Admin → Tokens → Countries → the country → "Pay to Trothen's account with a code" → add the accounts → Save.
- **Check:** Admin → Tokens shows "Card payments (Stripe): on". Each country page says how customers in that country pay right now.
- Make sure **"Test payments"** in Admin → Tokens → Settings is **not ticked** on the live site.

## 5. Checks (two browsers: a customer and a pro, no refreshing)
1. As the customer, post a job. As the pro, open the match and press **Message**. A **"Your price for this job"** box shows above the chat. Send 75 with what it covers.
2. In the customer's **View Responses**, the pro's card shows **$75.00** and **Accept and pay $75.00**, without refreshing. Put your cursor in the message box: new messages from the pro still appear.
3. Press **Accept and pay**. The checkout shows the price, the fee and the total, and how you'll pay (card, code, or not available).
4. On another job, type an amount in **Offer a price** and press **Send offer**. A message says "Offer sent". The pro sees it in My Contracts and can accept or suggest a price. If the pro accepts, the customer gets **Pay $…**.
5. Message times show (for example "Today, 4:47 PM").
6. **Rides:** as a rider, open **Rides**, pin where you are and where you're going, and press **Find drivers**. Type a fare in **Or offer your own fare** and press **Offer**. As the driver (online, on the Rides page), the offer appears within a second, with Accept, Suggest a fare and Decline. Suggest a fare: the rider sees **Accept $…** at once. Accepting opens the checkout, and with cards on, the Stripe page. The driver is only told to go once it's paid.

## 6. If something goes wrong

```
git checkout main
git revert -m 1 HEAD
git push
```

This puts the previous version back. Your data isn't touched.
