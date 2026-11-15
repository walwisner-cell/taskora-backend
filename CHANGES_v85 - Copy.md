# Trothen v85: seeing the ID documents

## What I asked for
Make sure I can see the documents when I verify someone.

## What was in the way
- Documents opened in a new browser tab. Browsers often block that as a pop-up, so pressing "View ID" could look like nothing happened.
- Each file opened separately, so comparing the face photo with the ID meant flipping between tabs.
- Once I approved or rejected someone, their row left the queue and there was no screen to open those documents again, even though the files are kept for 90 days.
- An empty queue just said "Verification queue is empty", with nothing to say where documents would appear.

## What I changed

**1. Documents open inside the page, side by side.**
Pressing **View documents** opens one window showing the front of the ID, the back (if there is one) and the face photo next to each other. No pop-up is involved. Clicking a picture opens it full size. A PDF shows inside the window, with a link to open it in a new tab.

**2. A "Past checks" panel under the queue.**
It lists every ID already approved, rejected or replaced, newest first, with the person, the document type, the name on the ID, the decision, who decided and when. Each row has **View documents** for as long as the files exist, and shows the date they'll be deleted. After that it shows the date they were deleted. There's a search box for the name.

**3. A clearer empty queue.**
It now says that new submissions appear there with a View documents button, and that earlier decisions are under Past checks.

## Rules that haven't changed
- Only verification staff, city admins for their own city, and the super admin can open ID files or see Past checks.
- Every file opened is written to the access log. Opening the window opens up to three files, so it writes up to three entries.
- Files are never cached by the browser.
- Files are deleted 90 days after a decision (or whatever I set). After that only the record remains.

## Things to know
- **Old records have no files.** Anyone verified before real uploads existed, or before v77 added the face photo, shows "No files on record" or no face photo.
- **A PDF may not display inside the window on some phones.** The "Open the PDF in a new tab" link is there for that.
- I can't review my own ID. I need a second account to test with.

## Tested (in a real browser, with ID encryption switched on)
- Submitted an ID photo, a PDF back and a face photo as a customer.
- As super admin: the queue row showed View documents; the window showed the front (1000×630), the PDF back and the face photo (700×900) together.
- Approved it: the queue emptied with the new message, and the check appeared at the top of Past checks with the reviewer's name, the date and the deletion date.
- Opened the documents again from Past checks: all three shown.
- Search with no match shows "No one matches that name".
- A city admin can see Past checks; an HR admin and a customer can't.
- Nothing blocked by the security policy. No script errors.


> Note: the byte counts and deploy steps below are from when this version was made. Use the table and steps in CHANGES_v86.md.

## Files (complete replacements; this zip includes v74 to v84)
| File | Bytes |
|---|---|
| server.js | 20194 |
| public\index.html | 1221104 |
| src\auth.js | 9391 |
| src\platform-settings.js | 21616 |
| src\validators.js | 17730 |
| src\terms.js | 1245 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2249 |
| src\file-crypto.js | 2776 |
| src\backup-scheduler.js | 2385 |
| src\account-privacy.js | 8577 |
| src\routes\admin.routes.js | 208143 |
| src\routes\marketplace.routes.js | 122338 |
| src\routes\payments.routes.js | 60475 |
| src\routes\auth.routes.js | 80421 |
| src\routes\misc.routes.js | 58805 |
| src\routes\portfolio.routes.js | 12210 |

Changed in this version: public\index.html and src\routes\admin.routes.js.

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
   git add server.js public\index.html src\auth.js src\platform-settings.js src\validators.js src\terms.js src\plan-billing.js src\id-retention-scheduler.js src\file-crypto.js src\backup-scheduler.js src\account-privacy.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md CHANGES_v79.md CHANGES_v80.md CHANGES_v81.md CHANGES_v82.md CHANGES_v83.md CHANGES_v84.md CHANGES_v85.md
   git commit -m "v85: in-page ID document viewer and Past checks; v74-v84"
   git push
   ```
5. To see it working: sign in as a test customer (not my admin account), submit an ID photo and a face photo under Verification, then open Admin → Verification Queue as admin and press View documents.
6. I still do not set PLAN_BILLING_ENABLED (see CHANGES_v78.md).
