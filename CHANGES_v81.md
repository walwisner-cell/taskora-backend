# Trothen v81: gap check. One serious hole closed, five smaller ones.

## What I asked for
Check for any more gaps.

## How I checked
I ran the server and attacked it the way an outsider or a curious user would: calling it directly instead of through the page, as a customer, a pro, a city admin, and with no sign-in at all.

## The serious one: anyone could take over any account

**What was wrong.** While no email service is connected, "Forgot password" sent the working reset code straight back to the page instead of emailing it. So anyone could type an email address (mine, a customer's, the super admin's), press the button, and set a new password for that account. No access to the mailbox needed. I confirmed it worked against the super admin account.

**Is my live site affected?** If the yellow banner at the top says "Email sending isn't connected", yes, until this version is deployed.

**What I changed.**
- On the live site, with no email service, Forgot password now issues nothing. It tells the person to contact support.
- The super admin gets a **Reset password** button on each person in Admin → People. It creates a one-time password, shown once, signs the person out everywhere, and makes them choose a new password at their next sign-in. It's written to the access log. It can't be used on a super admin account, and other admins can't use it.
- When SendGrid is connected, Forgot password goes back to emailing a link, as designed.

**What I should do after deploying.**
1. Change my own super admin password, in case anyone used this before today.
2. On Render, look at the data file passwordResets.json (or ask me how). Any reset I don't recognise for an admin account means I should also check Admin → Access Log for that period.

## The five smaller ones

| Gap | What could happen | Fixed how |
|---|---|---|
| Sign-up kept the typed password on disk, readable, until the code was entered (and forever if it never was) | Anyone with access to the server's files could read people's passwords | The password is scrambled the moment sign-up starts. Unfinished sign-ups are deleted when they expire. |
| "Resend code" had no limit | One sign-up could be used to flood someone's inbox and run up the email bill | 30 seconds between sends, 5 per sign-up |
| Contact, Careers, Advertising and Sales forms had no limit | A script could bury the admin inbox | 6 an hour per connection |
| Agreeing to the terms was only checked by the page | Someone calling the server directly could post a job or take a booking without ever agreeing | The server now refuses posting a job, booking, accepting work and cashing out until the account has agreed. The page opens the agreement if that happens. |
| Abandoned sign-ups piled up forever | Clutter, and old personal details kept for no reason | Cleared every hour |

## What I tested that was already safe
- A customer can't make themselves verified, an admin, or a higher plan by editing their profile.
- A customer can't read another customer's contract.
- A city admin can't read access logs, change another country's prices, suspend users in another city, see users from other cities, or switch plan billing.
- Only the last four digits of a card are stored. No full numbers, no security codes.
- Sign-in gives the same message for a wrong password and an unknown email, and blocks after 10 tries in 15 minutes.
- Pros who aren't ID-checked don't appear in search.

## Gaps that are still open, and why

**Fixed only by connecting services (my action, not code)**
- **Sign-up codes show on screen** while email isn't connected. So an email address isn't really proven to belong to the person. Connecting SendGrid fixes it.
- **Sign-in codes (two-step) show on screen** while SMS and email aren't connected. So two-step sign-in adds no protection yet. Connecting Twilio or SendGrid fixes it.

**Known and left for now**
- **No content security policy header.** The page is one large file with its code inside it, and the strict header would block it. Adding one properly is a larger rebuild.
- **Sign-in attempts are limited per connection, not per account.** Someone using many connections could keep guessing at one account. Strong passwords and two-step sign-in are the protection.
- **The Postgres database option is not up to date** with newer features. I run on the file store, so this doesn't affect me today.

**Not covered by this check**
I did not go through every screen and route. Not checked this round: the dispute flow end to end, organization accounts, advertising, promotions, and whether every piece of user-typed text is shown safely on every screen. A proper outside security test before real money moves is worth paying for.

## Tested
- Server in live-site mode with no email service: Forgot password returned no code and created no reset record. On a developer machine the on-screen code still works.
- Sign-up: password not readable on disk; sign-up still completes and the password works; second resend within 30 seconds refused; an expired unfinished sign-up was removed.
- Terms: an account that never agreed was refused when posting a job, and accepted after agreeing.
- Reset password: refused for a city admin and for a super admin target; worked for a customer, their old session stopped working, and the one-time password signed them in with "must change password" set.
- 7th public form in an hour refused.
- Checked the Forgot password message and the Reset password dialog in a real browser. No script errors.


> Note: the byte counts and deploy steps below are from when this version was made. Use the table and steps in CHANGES_v85.md.

## Files (complete replacements; this zip includes v74 to v80)
| File | Bytes |
|---|---|
| server.js | 18252 |
| public\index.html | 1201425 |
| src\platform-settings.js | 21616 |
| src\validators.js | 17730 |
| src\terms.js | 1245 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2249 |
| src\routes\admin.routes.js | 195977 |
| src\routes\marketplace.routes.js | 121480 |
| src\routes\payments.routes.js | 60300 |
| src\routes\auth.routes.js | 74139 |
| src\routes\misc.routes.js | 57621 |
| src\routes\portfolio.routes.js | 12210 |

Changed in this version: server.js, public\index.html, src\routes\auth.routes.js, src\routes\misc.routes.js, src\routes\admin.routes.js, src\routes\marketplace.routes.js, src\routes\payments.routes.js. New: src\terms.js.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v85-files.zip.
2. From the unzipped folder (replace the path with my repo folder):
   ```
   set REPO=C:\path\to\trothen-backend
   copy /Y server.js "%REPO%\server.js"
   copy /Y public\index.html "%REPO%\public\index.html"
   copy /Y src\platform-settings.js "%REPO%\src\platform-settings.js"
   copy /Y src\validators.js "%REPO%\src\validators.js"
   copy /Y src\terms.js "%REPO%\src\terms.js"
   copy /Y src\plan-billing.js "%REPO%\src\plan-billing.js"
   copy /Y src\id-retention-scheduler.js "%REPO%\src\id-retention-scheduler.js"
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
   for %I in (server.js public\index.html src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js) do @echo %~zI  %I
   ```
   If any number is different, stop and copy again.
4. Push:
   ```
   git add server.js public\index.html src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md CHANGES_v79.md CHANGES_v80.md CHANGES_v81.md
   git commit -m "v81: close password-reset takeover; sign-up, forms and terms hardening; v74-v80"
   git push
   ```
5. After Render finishes: on the live site, press Forgot password with my own email. I should see "Password reset by email isn't switched on yet" and no reset box. Then change my super admin password.
6. I still do not set PLAN_BILLING_ENABLED (see CHANGES_v78.md).
