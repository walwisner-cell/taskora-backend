# Trothen v75: customers are asked for their ID, and "Verified" means an ID was reviewed

## What happened
My customer account showed "Identity Verified — government ID confirmed" and I never verified it.

## Why
- When an admin pressed **Approve** on a customer in Pending Users, the account was marked Verified straight away. No ID was needed. (Providers were fixed for this in v64. Customers were not.)
- The Verification screen printed "government ID confirmed" for anyone marked Verified, even with no ID on file.
- The "verify your identity" prompt appeared only once, right after signing up with email. If I closed it, signed up with Google, or was approved by an admin first, I was never asked again.

## What I changed
1. **Approving a customer's account no longer makes them Verified.** Only a reviewed ID does (a person on the team approving it in the Verification Queue, or Persona's automated check). Same rule as providers now.
2. **The prompt now appears at sign-in** for any customer or provider who isn't verified and has no ID waiting for review. It shows once per browser session, can still be closed with "Maybe Later", and comes back next sign-in. Google signups get it too.
3. **Trying to post a job or book a pro without a reviewed ID opens the same prompt.** The message used to say "pending admin approval". Now it says an ID is needed, or, if one is already waiting, that it's being reviewed.
4. **The Verification screen tells the truth.** If an account is marked Verified with no approved ID on file, it says "Account approved by our team. No ID has been reviewed for this account yet."
5. **Admin can see how each person was verified.** In the People list, under the Verified badge: "ID reviewed by (name), (date)", "Automated ID check", or "Account approved by (name), (date). No ID on file".
6. **Admin → Verification now lists customers too** under "Verified with no reviewed ID", with the same two buttons: Ask for ID, or Remove badge until checked.

## Three bugs I found and fixed along the way
- **"Verify Now" did nothing visible for customers.** Customers sit on the homepage after sign-in, and the button loaded the Verification page behind it without showing it. The link in the "verify your identity" email had the same problem.
- **"Submitted — awaiting review" never showed.** After uploading an ID and reloading, the screen went back to asking for an upload, because the page was looking for a status name the server doesn't use.
- **Google signups never saw the prompt.**

## What this does NOT change by itself
- **Customers who are already marked Verified without an ID stay that way** (including my own test account). Nothing is taken off anyone automatically. They're listed in Admin → Verification, and I decide per person: ask for an ID, or remove the badge until it's checked.
- **A customer whose badge I remove can't post a job or book** until their ID is reviewed. That's the point, but I should expect it.

## A decision that is mine, not the code's
Requiring a government ID from every customer before their first booking is the stricter choice. It matches what the Verification page already tells customers ("Required for every customer"). The trade-off is that some customers will leave rather than upload an ID, and every one needs a person to review it within the 48-hour window. Many marketplaces ID-check the pros and only check the customer's email, phone and payment card. If I'd rather do that, it's a small change, but the page wording has to change with it. Collecting customer IDs also means holding more sensitive documents, which belongs on the list for the attorney and the privacy policy.

## Tested (on a copy of the data, in a real browser)
- Approved a new customer's account in admin: stayed unverified, got the "next, verify your identity" message.
- Signed in as that customer: prompt appeared. Reloaded in the same session: didn't nag again.
- Tried to post a job: refused with the new message and the prompt opened.
- Pressed Verify Now: landed on the real upload form. Uploaded an ID: screen showed "Submitted — awaiting review", prompt stopped, and posting a job said the ID is being reviewed.
- A customer verified the old way: screen showed the honest "No ID has been reviewed" line; admin list showed "Account approved by ..., No ID on file"; appeared in the gaps list; "Remove badge" worked.
- No script errors.


> Note: the byte counts and deploy steps below are from when this version was made. Later versions changed some of the same files. Use the table and steps in CHANGES_v86.md.

## Files changed (complete replacements; this zip also includes v74)
| File | Bytes |
|---|---|
| public\index.html | 1173188 |
| src\platform-settings.js | 19826 |
| src\routes\admin.routes.js | 184309 |
| src\routes\marketplace.routes.js | 119842 |

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v86-files.zip.
2. From the unzipped folder, copy the files over the old ones, keeping the folders:
   ```
   copy /Y public\index.html "C:\path\to\trothen-backend\public\index.html"
   copy /Y src\platform-settings.js "C:\path\to\trothen-backend\src\platform-settings.js"
   copy /Y src\routes\admin.routes.js "C:\path\to\trothen-backend\src\routes\admin.routes.js"
   copy /Y src\routes\marketplace.routes.js "C:\path\to\trothen-backend\src\routes\marketplace.routes.js"
   copy /Y CHANGES_v74.md "C:\path\to\trothen-backend\CHANGES_v74.md"
   copy /Y CHANGES_v75.md "C:\path\to\trothen-backend\CHANGES_v75.md"
   ```
3. Check the sizes match the table:
   ```
   cd /d "C:\path\to\trothen-backend"
   for %I in (public\index.html src\platform-settings.js src\routes\admin.routes.js src\routes\marketplace.routes.js) do @echo %~zI  %I
   ```
   I should see 1173188, 19826, 184309 and 119842. If any number is different, stop and copy again.
4. Push:
   ```
   git add public\index.html src\platform-settings.js src\routes\admin.routes.js src\routes\marketplace.routes.js CHANGES_v74.md CHANGES_v75.md
   git commit -m "v75: customers need a reviewed ID; verify prompt at sign-in; v74 wording editor"
   git push
   ```
5. After Render finishes: open Admin → Verification and look at "Verified with no reviewed ID". My own customer account should be listed there.
