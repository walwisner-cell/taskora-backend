# Trothen v82: the remaining best-practice items that code can deliver

## What I asked for
Improve everything that isn't there yet but is best practice.

## What I added

**1. Text people type can no longer run as code on someone else's screen.**
I planted script-injection text in 111 places across the data (names, addresses, cities, job descriptions, messages, reviews, reasons, business names) and then opened every screen as a visitor, a customer, two pros, a city admin and the super admin. It ran in three kinds of place:
- form boxes in Settings that showed a saved address, name, city or business name
- the "Provider:" line in a customer's Payments
- several admin tables (admin names, cities)

All fixed: 27 form boxes, 28 table cells and 6 other spots now show the text safely. I re-ran the whole sweep and nothing ran anywhere.

**2. A content security policy is switched on.**
The browser is now told the only outside places this site may load code, styles, fonts or frames from (Google sign-in and Google Fonts), that no plugins may run, that no other site may put Trothen inside a frame, and that forms may only be sent to Trothen. I browsed every section as each kind of user with it on: nothing was blocked.
- Honest limit: because the whole page is one file with its code inside it, the policy still has to allow that inline code. So this stops outside scripts being pulled in; it does not by itself stop injected inline code. Item 1 is the protection for that.
- If something ever looks broken after deploy, setting CSP_REPORT_ONLY to true in Render makes the browser report instead of block.

**3. Sign-in is paused per account after repeated wrong passwords.**
Before, wrong tries were only counted per connection, so someone guessing from many connections was never slowed. Now 8 wrong passwords for the same email in 15 minutes pauses sign-in for that email for 15 minutes, wherever the tries come from. The real owner gets a notice. Emails with no account are counted the same way, so the message doesn't reveal which emails exist.
- Trade-off I accepted: someone could deliberately lock a person out for 15 minutes by typing wrong passwords for their email.

**4. Optional extra encryption for ID files.**
When I set ID_FILE_ENCRYPTION_KEY on the server, every new ID photo, back of ID and face photo is scrambled (AES-256) before it rests on the disk and unscrambled only when a reviewer opens it. Admin → Verification shows whether it's on.
- It is off until I set the key. Nothing changes until then.
- Files stored before the key was set stay as they are and still open.
- **If I lose or change the key, every file encrypted with it is gone for good.** I must keep a copy of the key somewhere that isn't Render.
- Not covered: dispute evidence files and public photos (profile, portfolio, job photos).

**5. Nightly backup of the records.**
Once a day the server copies every data file into a dated folder and keeps the newest 14 days. Admin → Settings (super admin) shows the copies and has a "Take a copy now" button for just before a risky change.
- These copies are on the same disk as the data. They protect against a bad change, a bug or a mistaken delete. They do not protect against losing the disk. For that I need Render's own disk snapshots (check they're on) or a copy kept somewhere else.
- Uploaded photos and ID files are not included.
- To restore, the files are copied back by hand on the server. There is no restore button; a wrong restore would be worse than none.

**6. Clearer password message.** Common passwords were already refused; the message now says so instead of only "8-72 characters".

## Best practice that is still not there, and why

**Needs a paid service or account (my decision)**
- **Live selfie and automatic ID checks.** Persona. The code is built and waits for three keys.
- **Email and text delivery.** SendGrid and Twilio. Until they're connected, sign-up codes and two-step sign-in codes appear on screen and prove nothing.
- **Virus scanning of uploaded PDFs.**
- **Backups kept off the server.**
- **An outside security test** before real money moves. My own sweep is not a substitute.

**Needs a decision from me, then code**
- **Delete my account / download my data** for customers and pros. This is expected under privacy laws (for example Nigeria's and Ghana's data protection laws, and some US states). It isn't simple, because bookings, payments and disputes have to be kept for a period even after someone leaves. I need to decide what gets deleted, what's kept and for how long, with the attorney. Tell me the rule and I'll build it.
- **HEIC photos.** Converting them in the browser needs a third-party library added to the page.

**Needs a larger rebuild**
- **A strict content security policy** (no inline code allowed). That means splitting the single page file into separate files.
- **Lockout counters that survive a restart.** They're kept in memory today.

**Legal (attorney)**
- Terms of Service and privacy policy: the fee, ID and face photos, retention period, governing law.

## Tested
- Injection sweep: 111 planted payloads, 6 kinds of user, 71 screens. Before: ran in customer Payments and Settings and in admin tables. After: zero.
- Security header: present on the page; browsed every section as visitor, customer, pro and super admin with nothing blocked and no script errors. **Not tested here: Google sign-in on the live site** (this test machine can't reach Google). I should try it once after deploy.
- Lockout: 7 wrong passwords gave "invalid", the 8th paused the account, with the right message.
- Encryption with a key set: all three files on disk were scrambled; the reviewer opened front, back (PDF) and face photo; the face photo came back identical to the original, byte for byte.
- Backups: "Take a copy now" copied 26 data files; the list shows it; the panel appears in Admin → Settings.

## Switching on ID file encryption (optional, when I'm ready)
1. On my computer, in cmd.exe, inside the repo folder:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Copy the 64-character result. Save it somewhere safe that isn't Render (a password manager).
3. In Render → Environment, add ID_FILE_ENCRYPTION_KEY with that value. Redeploy.
4. Admin → Verification should now say "Extra encryption: on".


> Note: the byte counts and deploy steps below are from when this version was made. Use the table and steps in CHANGES_v83.md.

## Files (complete replacements; this zip includes v74 to v81)
| File | Bytes |
|---|---|
| server.js | 20194 |
| public\index.html | 1204489 |
| src\platform-settings.js | 21616 |
| src\validators.js | 17730 |
| src\terms.js | 1245 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2249 |
| src\file-crypto.js | 2776 |
| src\backup-scheduler.js | 2385 |
| src\routes\admin.routes.js | 197158 |
| src\routes\marketplace.routes.js | 121480 |
| src\routes\payments.routes.js | 60300 |
| src\routes\auth.routes.js | 76535 |
| src\routes\misc.routes.js | 58042 |
| src\routes\portfolio.routes.js | 12210 |

Changed in this version: server.js, public\index.html, src\routes\auth.routes.js, src\routes\misc.routes.js, src\routes\admin.routes.js. New: src\file-crypto.js, src\backup-scheduler.js.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v83-files.zip.
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
   copy /Y src\file-crypto.js "%REPO%\src\file-crypto.js"
   copy /Y src\backup-scheduler.js "%REPO%\src\backup-scheduler.js"
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
   for %I in (server.js public\index.html src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\file-crypto.js src\backup-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js) do @echo %~zI  %I
   ```
   If any number is different, stop and copy again.
4. Push:
   ```
   git add server.js public\index.html src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\file-crypto.js src\backup-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md CHANGES_v79.md CHANGES_v80.md CHANGES_v81.md CHANGES_v82.md
   git commit -m "v82: escape stored text everywhere, CSP, account lockout, optional ID encryption, nightly backups; v74-v81"
   git push
   ```
5. After Render finishes, check four things on the live site:
   - Sign in with Google works (the new security header is the thing to watch).
   - Admin → Verification: open an ID. It should still display.
   - Admin → Settings: the "Data backups" panel shows today's date within a couple of minutes.
   - The pages look normal (fonts, images).
   If Google sign-in or anything else is blocked, set CSP_REPORT_ONLY = true in Render and tell me what broke.
6. I still do not set PLAN_BILLING_ENABLED (see CHANGES_v78.md).
