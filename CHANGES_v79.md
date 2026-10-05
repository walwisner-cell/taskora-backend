# Trothen v79: sign-up accepts any real email address

## What I asked for
Let the system accept any email at sign-up.

## What I found
There was no list of allowed or blocked email providers. Gmail, Yahoo, Outlook, iCloud, a company address, any country ending (.lr, .ng, .gh, .africa, .io) were all already accepted.

One kind of real address was being turned away: addresses with accented letters or other alphabets, for example josé@correo.es or user@münchen.de.

## What I changed
- Sign-up, changing the email on an account, and the forgot-password form now accept those addresses too.
- Still refused, because they aren't email addresses: spaces, no @, two @ signs, a dot at the start or end of the name, two dots in a row, or no domain ending (me@localhost).

## What still stops a sign-up, on purpose
- **The address is already on an account.** One email is one account. The same person can't hold a customer account and a pro account on the same address.
- **The code step.** Sign-up sends a 6-digit code to the address to prove the person owns it. If the email service can't deliver to that address, sign-up can't finish. That is delivery, not a rule in my code:
  - If SendGrid isn't connected yet, the code shows on screen and any address works.
  - Once SendGrid is connected, a brand-new SendGrid account can be limited until the sending domain is verified. If only some addresses receive codes, that's the place to look (SendGrid → Sender Authentication), not the app.
  - Some email providers still can't receive mail for addresses with accented letters. The app accepts them, but the code may not arrive.

## Tested
- 14 real-style addresses accepted, including accented and non-Latin ones. 14 broken ones refused.
- Started a real sign-up on the server with josé@correo.es and someone@newdomain.africa: both accepted. "first last@gmail.com" refused.


> Note: the byte counts and deploy steps below are from when this version was made. Use the table and steps in CHANGES_v86.md.

## Files (complete replacements; this zip includes v74 to v78)
| File | Bytes |
|---|---|
| server.js | 17429 |
| public\index.html | 1192489 |
| src\platform-settings.js | 21616 |
| src\validators.js | 17730 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2195 |
| src\routes\admin.routes.js | 193015 |
| src\routes\marketplace.routes.js | 121299 |
| src\routes\payments.routes.js | 60259 |
| src\routes\auth.routes.js | 72257 |
| src\routes\misc.routes.js | 55490 |

Only src\validators.js changed in this version. The rest are unchanged from v78.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v86-files.zip.
2. From the unzipped folder (replace the path with my repo folder):
   ```
   set REPO=C:\path\to\trothen-backend
   copy /Y server.js "%REPO%\server.js"
   copy /Y public\index.html "%REPO%\public\index.html"
   copy /Y src\platform-settings.js "%REPO%\src\platform-settings.js"
   copy /Y src\validators.js "%REPO%\src\validators.js"
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
   for %I in (server.js public\index.html src\platform-settings.js src\validators.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js) do @echo %~zI  %I
   ```
   If any number is different, stop and copy again.
4. Push:
   ```
   git add server.js public\index.html src\platform-settings.js src\validators.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md CHANGES_v79.md
   git commit -m "v79: sign-up accepts international email addresses; v74-v78"
   git push
   ```
5. I still do not set PLAN_BILLING_ENABLED (see CHANGES_v78.md).
