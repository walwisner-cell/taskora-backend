# Trothen v83: people's own data, leaving Trothen, and the last code-only items

## What I asked for
Improve on everything.

## What I added

**1. Download my data.**
Customers and pros get a "Your data and your account" panel in Settings. "Download my data" gives them one file with everything Trothen holds about their account: profile, jobs, bookings, held payments, payouts, plan invoices, saved payment methods (last four digits only), reviews, disputes, messages, notifications and identity-check records. It never includes passwords, ID file names, or Trothen's internal notes. Privacy laws expect this to exist.

**2. Close my account.**
- The person confirms with their password (or types CLOSE if they only ever sign in with Google).
- It's refused, with the reasons listed, while they have a booking in progress, an open dispute, a held payment, a posted job, or (for a pro) earnings not yet cashed out or a payout in process.
- When it goes through, the account stops working at once and they're signed out everywhere. Signing in again says the account was closed at its owner's request.

**3. Admin → People → "Accounts closed by their owners" (super admin).**
For each closed account I can:
- **Reopen** it, if the person changes their mind.
- **Erase details.** This removes the name, email, phone, address, photos and ID files for good. Their bookings, payments, reviews and disputes stay on record and show "Closed account". It can't be undone.
Nothing is erased automatically. Both actions are in the access log.

**4. The sign-in pause now survives a restart.** It's stored under a scrambled form of the email, never the email itself.

**5. Dispute evidence gets the same optional encryption as ID files** when the encryption key is set, and is now served with the same no-caching protection.

**6. More areas checked.** I tried, as an outsider and as the wrong user: reading and adding to someone else's dispute, completing or cancelling someone else's booking, a different pro acting on a booking, reading other people's messages, deleting other people's photos and payment methods. Every one was refused. Nothing needed fixing there.

## What I tried and did not ship: HEIC photos
I built it two ways and tested both.
- **Converting in the browser** needs the security policy loosened to allow a kind of code execution ("unsafe-eval") for every visitor. Not worth it.
- **Converting on the server** worked, but a normal 12-megapixel phone photo took about 500MB of memory for a few seconds. On a small Render plan that could crash the whole site.
So HEIC stays as it was: refused with a clear message telling the person to retake the photo or save it as JPEG. iPhones normally hand over JPEG when uploading through the browser anyway.

## Decisions here that are really mine
- **What "erase" keeps.** I kept every booking, payment, review and dispute, and removed the person. That's the cautious choice for money records, but the attorney should confirm it per country.
- **How long to wait before erasing.** There's no timer. The panel shows how many days ago each account was closed. A common approach is 30 days, to allow for a change of mind and any late dispute.
- **The privacy policy has to say all of this.** Attorney.

## Where things stand
The list of improvements that code alone can deliver is now close to used up. What's left needs something from outside the code:
- **Paid services:** Persona (live selfie and ID checks), SendGrid and Twilio (so codes stop appearing on screen), virus scanning, off-server backups, an outside security test.
- **A rebuild:** a strict security policy, which means splitting the single page file apart.
- **Attorney and accountant:** Terms, privacy policy, retention periods, tax on the plan fee.
- **Real payments:** Stripe.

## The most useful next step is not more code
Versions v74 to v83 are ten rounds of changes and, as far as I know, none of them is on the live site yet. That includes the fix for the account-takeover hole in v81. Everything was tested here on a copy of the demo data, in a desktop browser. It has not been tested on the real site, with real data, on a real phone. I should deploy this, go through the checklist below, and tell Claude what I find before adding anything else.

## After-deploy checklist
1. The site loads and looks normal (fonts, images).
2. Sign in with email and password. Sign in with Google.
3. As a customer on my phone: the agreement screen with checkboxes appears; then the ID prompt; take an ID photo and a face photo with the camera and submit.
4. As super admin: Admin → Verification shows that submission; View ID, View back, View face photo all open.
5. Forgot password shows "isn't switched on yet" (if email isn't connected). Then change my super admin password.
6. Admin → People: "Reset password" buttons and the "Accounts closed by their owners" panel are there.
7. Admin → Settings: "Data backups" shows today's date.
8. Admin → Plans & Pricing: "Charging the monthly plan fee" shows Locked and Off.
9. Customer Settings: "Download my data" downloads a file.

## Tested
- Download: only my own records, no password, no file names; refused for staff accounts.
- Closing: refused with three clear reasons for an account with a live booking; wrong password refused; right password closed it; old session and new sign-in both refused with the "closed" message.
- Admin: a city admin can't see the list; reopen worked and the person could sign in; erase blanked the name, email, phone, address and city; erasing twice and reopening after erase were both refused.
- With an erased account in the data, every admin section still opened with no errors.
- Evidence: stored scrambled when a key is set; the other party downloaded it identical to the original.
- Sign-in pause: still in force after restarting the server; the stored record contains no email address.


> Note: the byte counts and deploy steps below are from when this version was made. Use the table and steps in CHANGES_v85.md.

## Files (complete replacements; this zip includes v74 to v82)
| File | Bytes |
|---|---|
| server.js | 20194 |
| public\index.html | 1213403 |
| src\auth.js | 9391 |
| src\platform-settings.js | 21616 |
| src\validators.js | 17730 |
| src\terms.js | 1245 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2249 |
| src\file-crypto.js | 2776 |
| src\backup-scheduler.js | 2385 |
| src\account-privacy.js | 8577 |
| src\routes\admin.routes.js | 199481 |
| src\routes\marketplace.routes.js | 122338 |
| src\routes\payments.routes.js | 60300 |
| src\routes\auth.routes.js | 80421 |
| src\routes\misc.routes.js | 58042 |
| src\routes\portfolio.routes.js | 12210 |

Changed in this version: public\index.html, src\auth.js, src\routes\auth.routes.js, src\routes\admin.routes.js, src\routes\marketplace.routes.js. New: src\account-privacy.js.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v85-files.zip.
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
   git add server.js public\index.html src\auth.js src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\file-crypto.js src\backup-scheduler.js src\account-privacy.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md CHANGES_v79.md CHANGES_v80.md CHANGES_v81.md CHANGES_v82.md CHANGES_v83.md
   git commit -m "v83: data download, account closing and erasure; v74-v82"
   git push
   ```
5. Go through the after-deploy checklist above.
6. I still do not set PLAN_BILLING_ENABLED (see CHANGES_v78.md).
