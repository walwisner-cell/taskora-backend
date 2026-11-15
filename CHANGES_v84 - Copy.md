# Trothen v84: the areas I hadn't checked. Disputes had a real money problem.

## What I asked for
Check the areas the last review said it hadn't covered: disputes, organization accounts, advertising and promotions.

## How I checked
I ran the server and used it as a customer, a pro, a city admin, an HR admin, a Sales admin and the super admin. I ran one dispute from start to finish and tried to make the money go wrong. I planted hostile text in every field of those areas and opened and clicked through every screen.

## Disputes: three problems, all about money

**1. A mistyped decision paid the pro.**
The server treated anything other than "refund the customer" as "release to the pro". A typo, or no decision at all, sent the money to the pro. The buttons on the page always send a proper decision, so this needed a direct request to trigger, but a money decision should never have a silent default.
*Now:* the decision must be one of the two, spelled out, or nothing happens.

**2. A dispute could be decided again and again, moving the money each time.**
I resolved one dispute for the pro, then for the customer, then for the pro again; it accepted all three. Then the pro cashed out, and I resolved it for the customer once more. The system marked the payment "refunded" even though the pro had already been paid. That is the same money given out twice. An old, long-resolved dispute could be flipped the same way.
*Now:*
- A dispute is decided once. Deciding it again needs a super admin to reopen it first.
- A refund is refused once the pro has been paid out. The message says it has to be settled by hand.
- A release is refused if the customer was already refunded.
- Reopening is only possible while the money is still inside Trothen (released to the pro's balance but not cashed out). Reopening puts it back on hold. If the customer was refunded or the pro was paid, reopening is refused.

**3. A booking stayed "disputed" forever.**
After a dispute was settled, the booking never moved on. That kept it out of the pro's completed jobs and would have stopped either person from ever closing their account.
*Now:* refund → the booking is cancelled. Release → the booking is completed and counts as a job done. If a super admin rejects or closes a dispute without a decision, the booking goes back to active with the payment still held, so the normal route (complete or cancel) works again.

## Hostile text: two more ways in, both closed

**4. Text typed into a public form could run in an admin's browser.**
The Sales enquiry form is open to anyone. The contact name and email typed there are copied onto the organization when Sales converts the enquiry, and the Organizations screen printed them raw. So a stranger could plant code that ran when a Sales or super admin opened that screen. The Fraud screen had the same weakness in its details column.
*Now:* both are shown safely. I also wrapped the 31 remaining form-field and image-label spots across the page that printed stored values without protection.

**5. Apostrophes and backticks inside buttons.**
Seven buttons put a stored value inside their click instruction and tried to protect it by hand. That can be broken out of. Two mattered: the "copy email" button on enquiries (an email address may legally contain an apostrophe and a backtick, which is enough to run code) and the file name of dispute evidence (chosen by whoever uploads it).
*Now:* one helper (jsArg) writes any value into a button safely, and all of those buttons use it.

After these fixes I re-ran the full sweep three times until nothing ran: hostile text in promotions, ads, organizations, all four enquiry types, disputes, evidence names, audit notes, fraud flags, announcements, reviews, messages and notifications; every section opened as visitor, customer, pro, Sales admin and super admin; every affected button clicked.

## Organizations
- **Seat limit** "lots" was saved as "no limit", and -5 was saved as -5. Now it must be a whole number from 1 to 10,000 (or empty), and can't be set below the seats already in use.
- **Billing email and name** weren't checked. Now they are.
- **Account manager** could be set to any id. Now it must be an admin.
- **A suspended organization's pros kept its discounted commission rate.** Now they pay their normal plan rate until it's active again. Tested: 4% organization rate, suspended, the pro's payout used 13%.
- **Changes to an organization's commission rate or status are now in the access log.**
- Already safe: only Sales and the super admin can see or change organizations; invites respect their use limit, the seat limit, revoking and expiry; a customer can't redeem one; a pro can't join twice.

## Advertising
- **A pro could submit an ad whose link runs code.** The page already refused to open such a link and the approval step already checked it, so it couldn't fire, but it was being stored. Now it's refused when submitted.
- **A pro whose ID hasn't been reviewed could submit an ad.** Now refused.
- Already safe: the price comes from the server, not from what the pro sends; one ad at a time; a pro can target only their own city or the whole platform; only a super admin can approve a platform-wide ad; a city admin only their city's; department admins can't; the public ad shows no contact details.

## Promotions
- **End date** accepted anything. Now it must be a real date in the future.
- **Image** accepted any address. Now it must be an image uploaded through the upload button.
- Already safe: department admins can't create them; a city admin's promotion is always limited to their own city whatever they send; admins can only edit or remove their own; customers and pros only see ones meant for them and their city.

## What this does not change
- **Disputes already decided on the live site are left as they are.** If any were decided twice before this version, the records show the last decision; the audit log on each dispute shows every decision that was made.
- **A dispute where the pro was already paid** can't be refunded by the system. That was always true in reality; the system now says so instead of pretending.
- There is still no split outcome (part refund, part release).

## Still worth an outside security test
This round covered the four areas I had flagged. Between v81 and v84 I have now probed sign-in, sign-up, passwords, permissions, uploads, verification, bookings, disputes, messages, payouts, organizations, advertising and promotions, and swept every screen I could reach for hostile text. I'm one reviewer testing my own code on demo data. Before real money moves, a paid outside test is still the right call.

## Tested
- Dispute, start to finish: mistyped and missing decisions refused; release worked and the booking became completed; a second decision refused; reopen put the payment back on hold; decided again; pro cashed out; reopen and refund both refused after that; the job count went up by exactly one.
- Old resolved dispute: can't be re-decided.
- Rejected dispute: booking went back to active and the customer could complete it.
- Refund: payment refunded, pro can't cash it out, reopen refused.
- Every organization, advertising and promotion case listed above.
- Hostile-text sweep clean on the third run. Normal-data pass: every section opened for every kind of user with no errors and nothing blocked by the security policy.


> Note: the byte counts and deploy steps below are from when this version was made. Use the table and steps in CHANGES_v86.md.

## Files (complete replacements; this zip includes v74 to v83)
| File | Bytes |
|---|---|
| server.js | 20194 |
| public\index.html | 1214264 |
| src\auth.js | 9391 |
| src\platform-settings.js | 21616 |
| src\validators.js | 17730 |
| src\terms.js | 1245 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2249 |
| src\file-crypto.js | 2776 |
| src\backup-scheduler.js | 2385 |
| src\account-privacy.js | 8577 |
| src\routes\admin.routes.js | 206076 |
| src\routes\marketplace.routes.js | 122338 |
| src\routes\payments.routes.js | 60475 |
| src\routes\auth.routes.js | 80421 |
| src\routes\misc.routes.js | 58805 |
| src\routes\portfolio.routes.js | 12210 |

Changed in this version: public\index.html, src\routes\admin.routes.js, src\routes\misc.routes.js, src\routes\payments.routes.js.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v86-files.zip.
2. From the unzipped folder (replace the path with my repo folder):
   ```
   set REPO=C:\path\to\trothen-backend
   copy /Y server.js "%REPO%\server.js"
   copy /Y public\index.html "%REPO%\public\index.html"
   copy /Y src\auth.js "%REPO%\src\auth.js"
   copy /Y src\platform-settings.js "%REPO%\src\platform-settings.js"
   copy /Y src\validators.js "%REPO%\src\validators.js"
   copy /Y src\terms.js "%REPO%\src\terms.js"
   copy /Y src\plan-billing.js "%REPO%\src\plan-billing.js"
   copy /Y src\id-retention-scheduler.js "%REPO%\src\id-retention-scheduler.js"
   copy /Y src\file-crypto.js "%REPO%\src\file-crypto.js"
   copy /Y src\backup-scheduler.js "%REPO%\src\backup-scheduler.js"
   copy /Y src\account-privacy.js "%REPO%\src\account-privacy.js"
   copy /Y src\routes\admin.routes.js "%REPO%\src\routes\admin.routes.js"
   copy /Y src\routes\marketplace.routes.js "%REPO%\src\routes\marketplace.routes.js"
   copy /Y src\routes\payments.routes.js "%REPO%\src\routes\payments.routes.js"
   copy /Y src\routes\auth.routes.js "%REPO%\src\routes\auth.routes.js"
   copy /Y src\routes\misc.routes.js "%REPO%\src\routes\misc.routes.js"
   copy /Y src\routes\portfolio.routes.js "%REPO%\src\routes\portfolio.routes.js"
   copy /Y CHANGES_v7*.md "%REPO%\"
   copy /Y CHANGES_v8*.md "%REPO%\"
   ```
3. Check the sizes against the table:
   ```
   cd /d "%REPO%"
   for %I in (server.js public\index.html src\auth.js src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\file-crypto.js src\backup-scheduler.js src\account-privacy.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js) do @echo %~zI  %I
   ```
   If any number is different, stop and copy again.
4. Push:
   ```
   git add server.js public\index.html src\auth.js src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\file-crypto.js src\backup-scheduler.js src\account-privacy.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md CHANGES_v79.md CHANGES_v80.md CHANGES_v81.md CHANGES_v82.md CHANGES_v83.md CHANGES_v84.md
   git commit -m "v84: disputes decided once and money can't move twice; org, ad and promotion checks; v74-v83"
   git push
   ```
5. Go through the after-deploy checklist in CHANGES_v83.md, and add one: Admin → Disputes, open a dispute, and confirm both decision buttons still work on a test booking.
6. I still do not set PLAN_BILLING_ENABLED (see CHANGES_v78.md).
