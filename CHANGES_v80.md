# Trothen v80: uploads that work from a phone, and a verification review

## What I asked for
Check the verification part against best practice, and double-check that people can actually upload photos and verification documents.

## What I found when I tested real uploads
I uploaded realistic files to every place a customer or pro can send one.

| What I tried | Before | Now |
|---|---|---|
| ID photo straight off a phone (14MB) | Refused: "File too large" | Accepted |
| Face photo straight off a phone (14MB) | Refused: "File too large" | Accepted |
| Profile photo off a phone (14MB) | Refused (5MB limit) | Accepted |
| Portfolio photo off a phone (14MB) | Refused (5MB limit) | Accepted |
| ID as a WEBP photo | Refused | Accepted |
| ID as a HEIC photo | Refused: "must be JPEG, PNG or PDF" | Still refused, with a message that says what to do |
| ID as a PDF | Accepted | Accepted |
| A file pretending to be a photo | Refused | Refused |

The real problem: a photo taken with a modern phone camera is often 5 to 15MB, and the limits were 10MB for ID and 5MB for profile and portfolio photos. So the most normal thing a person would do, take a photo and send it, was failing with two words of explanation.

## What I changed

**Photos are shrunk in the browser before they're sent.**
- The page turns the photo the right way up, shrinks it (longest side about 2,600 pixels for an ID, which is plenty to read it), and saves it as JPEG. A 14MB photo becomes roughly 1MB, so it uploads quickly on a mobile connection.
- This applies to ID photos, face photos, profile photos, portfolio photos, job photos and dispute evidence. PDFs and videos are sent as they are.
- The file pickers now accept any photo type, not a short fixed list.

**The server limits were raised as a safety net:** 15MB per ID file, 12MB for profile and portfolio photos. If someone still goes over, the message says the limit and what to do.

**The ID form is clearer.**
- Three numbered steps: front of ID, back of ID (optional; for a driver's license or ID card), face photo.
- A preview of each file appears as soon as it's picked, so a blurry or cut-off photo is caught before sending.
- The button says "Preparing your photos…" then "Uploading…" and can't be pressed twice.
- If the connection drops, the message says so and the button comes back.

**Back of the ID.** Reviewers get a "View back of ID" button when one was sent. It has the same protection as the front (verification staff only, own city only, every viewing recorded) and is deleted on the same schedule.

## Verification against best practice: where I stand now

**In place**
- Verified only after a reviewed ID (v75)
- People are asked at sign-in and when they try to book (v75)
- ID front, optional back, and a face photo to compare (v77, v80)
- A person decides; name mismatch goes to manual review; rejection needs a reason; the person can resubmit
- No one can approve their own ID; city admins see only their city; every viewing is logged
- Files are private, never cached, checked to be real image or PDF files, and file names never leave the server
- Files are deleted 90 days after a decision; the record of the check is kept (v77)
- Limit of 3 submissions a day per person (this already existed)
- Admin shows who verified each person, when and how (v75)
- 48-hour review target with an overdue flag

**Not in place, and why**
- **Live selfie / liveness.** A person comparing two photos is not the same as software confirming a live face. Needs a paid Persona account; the code is built and waiting for three keys in Render.
- **Automatic document checks** (forgery, expiry read from the document). Same answer: Persona.
- **HEIC photos.** Refused with a clear message. iPhones convert automatically when uploading through Safari, so this mostly affects files moved from a phone to a computer first.
- **Virus scanning of PDFs.** Not done. The file is checked to be a real PDF and is only ever opened by a reviewer. A scanning service would be a paid add-on.
- **Encryption of stored files by the app itself.** Not done; I rely on the hosting disk. Worth asking Render what their disks provide.
- **Legal items from before:** retention period per country, collecting face photos, and the Terms and privacy policy. Attorney.

## Things I should know
- Shrinking happens in the person's browser. If a very old browser can't do it, the original file is sent and the server limit applies.
- I tested with large test images in a desktop browser at phone size. I did not test on a physical iPhone or Android phone. That's worth doing once after deploy: take an ID photo and a face photo with the phone's camera and submit.
- Customers can upload a profile photo and job photos; pros can upload profile and portfolio photos. All were tested.

## Tested
- Every row in the table above, through the real upload routes.
- In a browser at phone size: HEIC refused with the new message and the button came back; 14MB ID + WEBP back + 14MB face photo submitted and showed "Submitted — awaiting review".
- Reviewer: front, back and face photo all opened; no file names in the reviewer list.
- Profile photo and two portfolio photos (14MB JPEG and a WEBP) uploaded from the pro's dashboard.
- Server on its own (no shrinking): 14MB accepted, 33MB refused with the new message, a fake "back of ID" refused and nothing left behind on disk.
- The 4th submission in a day is still refused by the existing daily limit.
- No script errors.


> Note: the byte counts and deploy steps below are from when this version was made. Use the table and steps in CHANGES_v85.md.

## Files (complete replacements; this zip includes v74 to v79)
| File | Bytes |
|---|---|
| server.js | 17429 |
| public\index.html | 1199108 |
| src\platform-settings.js | 21616 |
| src\validators.js | 17730 |
| src\plan-billing.js | 7530 |
| src\id-retention-scheduler.js | 2249 |
| src\routes\admin.routes.js | 194232 |
| src\routes\marketplace.routes.js | 121299 |
| src\routes\payments.routes.js | 60259 |
| src\routes\auth.routes.js | 72257 |
| src\routes\misc.routes.js | 57142 |
| src\routes\portfolio.routes.js | 12210 |

Changed in this version: public\index.html, src\routes\misc.routes.js, src\routes\admin.routes.js, src\routes\portfolio.routes.js, src\id-retention-scheduler.js.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v85-files.zip.
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
   copy /Y src\routes\portfolio.routes.js "%REPO%\src\routes\portfolio.routes.js"
   copy /Y CHANGES_v7*.md "%REPO%\"
   copy /Y CHANGES_v80.md "%REPO%\"
   ```
3. Check the sizes against the table:
   ```
   cd /d "%REPO%"
   for %I in (server.js public\index.html src\platform-settings.js src\validators.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js) do @echo %~zI  %I
   ```
   If any number is different, stop and copy again.
4. Push:
   ```
   git add server.js public\index.html src\platform-settings.js src\validators.js src\plan-billing.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\auth.routes.js src\routes\misc.routes.js src\routes\portfolio.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md CHANGES_v78.md CHANGES_v79.md CHANGES_v80.md
   git commit -m "v80: phone photos upload reliably; ID front/back/face with previews; v74-v79"
   git push
   ```
5. After Render finishes: on my phone, sign in as a test customer, open Verification, take an ID photo and a face photo with the camera, and submit. Then open Admin → Verification and check I can view all of them.
6. I still do not set PLAN_BILLING_ENABLED (see CHANGES_v78.md).
