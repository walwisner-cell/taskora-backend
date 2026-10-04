# Trothen v78: the monthly plan fee is built and waiting for real payments

## What I found
The Provider Plans page shows a monthly price (Starter $12, and so on), but nothing in the system ever charged it. The "13% commission" line was just typed text, not connected to the real rate.

## What I asked for
Have the charging in place now, so that when real payments begin it can be switched on.

## What is built

**The monthly fee, switched off.**
- Once a month, each billable pro gets one invoice for their plan's price in their country. It's the same price the Plans page shows, from the same place (Admin → Plans & Pricing).
- **Nothing is charged to a card.** Open invoices come out of the pro's own payouts when they cash out, oldest first.
- **Never more than half of one payout.** Whatever is left carries over to the next payout.
- A pro with no earnings just carries a balance. Nothing suspends them automatically.
- Not billed: pros who aren't ID-checked yet, suspended accounts, and pros inside an organization (those are on the Custom plan, billed by agreement).
- Nothing is ever back-billed for months before the switch.

**Two locks. Both have to be open.**
1. On the server: PLAN_BILLING_ENABLED must be set to true in Render. Without it the switch in Admin refuses to turn on.
2. In Admin → Plans & Pricing → "Charging the monthly plan fee": the super admin presses Switch on.

**Notice period.** When I switch it on, every billable pro is told straight away, and the first invoices are not created until the notice period has passed (30 days by default; I can set 14 to 180). A brand-new pro gets the same number of days before their first invoice.

**What I can see in Admin (super admin only):** both locks, what a month of billing would come to right now (pros and dollars per plan), every invoice, how much has been taken from payouts, how much is still open, and a Waive button per invoice. Switching on, switching off and waiving are all written to the access log.

**What a pro sees (Earnings → Monthly plan fee):** their plan, the price, whether it's being charged yet, the start date once it's switched on, what's owed, and their invoices. Their payout message says how much went to plan fees.

**The Plans page now tells the truth by itself.**
- The three commission lines show the real rate the payout code uses. If the rate changes in code, the page follows. In the wording editor these lines contain {starter_commission}, {pro_commission} and {superpro_commission}; if I retype a line and leave that part out, it goes back to being plain text.
- A note under the cards says "The monthly fee isn't being charged during early access" while billing is off, and switches by itself to "comes out of your payouts, never a card" once it's on. Both sentences are editable.
- The support chat's pricing answer no longer quotes fixed prices ($15 / $20 / $27) that could be wrong. It gives the real commission rates and points to the Plans page for the price.

## Decisions I made that are really mine to confirm
- **Collected from payouts, not a card.** It needs no card on file and works in every country I'm in. The downside: a pro who never earns never pays.
- **Half of a payout at most.** Changing this is one number in src\plan-billing.js.
- **30 days' notice.**
- **Only ID-checked pros are billed.**

## What code can't do. Before I switch it on:
1. **Real payments first.** Taking a fee out of simulated payouts means nothing. That is why the server lock exists.
2. **The provider Terms of Service must mention the fee.** Today they only talk about commission. Charging a fee that isn't in the terms is the kind of thing that gets disputed. Attorney, then update the terms and bump the agreement version so every pro re-agrees.
3. **Tax.** A recurring platform fee may be taxable (sales tax in some US states, VAT in Nigeria and Ghana). Accountant.
4. **Do I actually want to charge it?** Many marketplaces charge commission only while they're growing. If I decide not to, I should take the prices off the Plans page instead of switching this on.
5. **Accounting.** The fee is kept by Trothen by paying out less. When the payment processor is connected, that has to be recorded as platform revenue the same way commission is. Whoever connects Stripe needs to know this exists.

## Limits I know about
- This works with the file-based data store I run on Render today. If I ever move to the Postgres option, a table for plan invoices has to be added first.
- I tested the money maths against the built-in demo data, not live data.

## Tested
- Server lock closed (the default): switch refused; payout unchanged ($140 earned, 13% commission, $121.80 paid, $0 plan fee); a non-admin can't open the admin panel.
- Server lock open: notice period under 14 days refused; switched on with 14 days, 8 pros told; nothing invoiced during the notice period.
- After the notice period: 8 invoices created, running it again the same month created 0, the 2 pros who aren't ID-checked got none.
- A pro owing $120 cashed out $220: exactly $110 was taken (half), oldest months first, 7 invoices paid in full and one part-paid, $10 left owing.
- Waive worked once and refused the second time. Switch off worked.
- Plans page, pro panel and admin panel checked in a real browser. No script errors.


> Note: the deploy steps below are from when this version was made. v79 adds one more file. Use the table and steps in CHANGES_v83.md.

## Files (complete replacements; this zip includes v74 to v77)
| File | Bytes |
|---|---|
| server.js | 17429 |
| public\index.html | 1192489 |
| src\platform-settings.js | 21616 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2195 |
| src\routes\admin.routes.js | 193015 |
| src\routes\marketplace.routes.js | 121299 |
| src\routes\payments.routes.js | 60259 |
| src\routes\auth.routes.js | 72257 |
| src\routes\misc.routes.js | 55490 |

New files: src\plan-billing.js (this version) and src\id-retention-scheduler.js (v77). server.js is the one in the top folder, next to package.json.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v83-files.zip.
2. From the unzipped folder (replace the path with my repo folder):
   ```
   set REPO=C:\path\to\trothen-backend
   copy /Y server.js "%REPO%\server.js"
   copy /Y public\index.html "%REPO%\public\index.html"
   copy /Y src\platform-settings.js "%REPO%\src\platform-settings.js"
   copy /Y src\plan-billing.js "%REPO%\src\plan-billing.js"
   copy /Y src\id-retention-scheduler.js "%REPO%\src\id-retention-scheduler.js"
   copy /Y src\routes\admin.routes.js "%REPO%\src\routes\admin.routes.js"
   copy /Y src\routes\marketplace.routes.js "%REPO%\src\routes\marketplace.routes.js"
   copy /Y src\routes\payments.routes.js "%REPO%\src\routes\payments.routes.js"
   copy /Y src\routes\auth.routes.js "%REPO%\src\routes\auth.routes.js"
   copy /Y src\routes\misc.routes.js "%REPO%\src\routes\misc.routes.js"
   copy /Y CHANGES_v7*.md "%REPO%\"
   ```
3. Check the sizes against the table:
   ```
   cd /d "%REPO%"
   for %I in (server.js public\index.html src\platform-settings.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js) do @echo %~zI  %I
   ```
   If any number is different, stop and copy again.
4. Push:
   ```
   git add server.js public\index.html src\platform-settings.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md
   git commit -m "v78: monthly plan fee built and locked off; real commission on plans page; v74-v77"
   git push
   ```
5. After Render finishes, open Admin → Plans & Pricing and scroll to the bottom. I should see "Charging the monthly plan fee" with Lock 1 showing Locked and the switch showing Off. **I do not set PLAN_BILLING_ENABLED now.**

## The day real payments are live
1. Terms updated and reviewed, tax question answered.
2. In Render → Environment, add PLAN_BILLING_ENABLED = true and redeploy.
3. Admin → Plans & Pricing: check the "If billing ran today" numbers, set the notice days, press Switch on.
4. To stop at any time: press Switch off. Nothing already recorded is lost.
