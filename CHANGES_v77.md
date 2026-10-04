# Trothen v77: closing the remaining verification gaps

## What was still open after v76
1. A reviewer saw a photo of an ID, but nothing showed that the person sending it was the person on it.
2. ID files were kept forever. Nothing deleted them.
3. I couldn't see from Admin whether ID files were being saved to the permanent disk.
4. People already marked Verified without an ID had to be asked one at a time.
5. The Terms of Service said nothing about ID checks or what happens to the documents.

## What I changed

**1. A face photo is now required with every ID.**
- The upload form asks for two things: a photo of the ID, and a photo of the person's face. On a phone, the second one opens the front camera.
- The server refuses a submission without the face photo, and checks that it's a real image file.
- In Admin → Verification, each submission has **View ID** and **View face photo**. The instructions tell the reviewer to compare them and to reject if they can't tell.
- The face photo has the same protection as the ID: verification staff only, their own city only, every viewing recorded, never cached.

**2. ID and face photos are deleted automatically after a decision.**
- Default: **90 days** after a check is approved, rejected, or replaced by a newer upload. Once a day the server deletes the files that are past that.
- The record stays: the type of document, the name on it, the decision, who made it and when. So "Verified" keeps its trail without me holding the document.
- Submissions still waiting for review are never deleted.
- I can change the number in Admin → Verification → "How ID files are kept" (super admin only). 0 means keep until I delete by hand. Making it shorter asks me to confirm first, because deleted files can't be brought back.

**3. Admin shows how files are being kept.**
The same panel shows whether ID files are on the permanent disk (a red warning if not), how long they're kept, and whether the automated check (Persona) is connected.

**4. One button to ask everyone.**
"Ask everyone on this list for their ID" messages every person who is marked Verified with no ID on file and none waiting. It doesn't remove anyone's badge.

**5. The built-in Terms of Service now have a section on ID checks.**
"Identity Checks and Your ID Document": what we ask for, who can see it, that every viewing is recorded, and how long files are kept. The number of days in that sentence comes from the live setting, so the terms and the system can't say different things.

**Also tightened:** the server no longer sends file names of ID documents back to the person who uploaded them or to the reviewer's list. They weren't reachable without admin sign-in anyway, but there was no reason to send them.

## What code can't do. These are mine.
- **A face photo is not a liveness check.** A person compares two photos. It stops someone uploading a found or borrowed ID casually; it won't stop a determined fraudster with a good photo of the real owner. The real fix is Persona (live selfie plus document checks). The code for it is already built. It needs a paid Persona account and three keys set in Render: PERSONA_TEMPLATE_ID, PERSONA_ENVIRONMENT_ID, PERSONA_WEBHOOK_SECRET. I have not tested it against Persona's live service.
- **90 days is my starting number, not legal advice.** The attorney should confirm how long Trothen should keep IDs for each country (US, Nigeria, Ghana, Liberia). When I change the setting, the terms update by themselves.
- **Face photos are sensitive.** Some places have specific laws about collecting them (Illinois in the US is the well-known one). This goes on the attorney's list with the privacy policy.
- **The new terms section only shows if I never edited the terms in Admin.** If I did, my edited version is what people see, and I need to paste the section in myself. Either way the attorney should read it.
- **Backups.** Deleting from the disk doesn't delete from any backup or snapshot Render keeps.
- **People already marked Verified without an ID** are still my decision, person by person: ask, or remove the badge.
- **IDs sent before this version have no face photo.** The reviewer's list says so. I can reject those and ask for a new upload.

## Tested (on a copy of the data, in a real browser)
- Upload form with only an ID: stopped and asked for the face photo. With both: "Submitted — awaiting review".
- Reviewer saw View ID and View face photo; the face photo opened; approval worked.
- Retention: refused 3 days, accepted 30. Moved an approved check's date back and ran the sweep: both files gone from the disk, record still there with the name, decision and reviewer.
- Terms page showed the new section with "deleted 30 days after", matching the setting.
- "Ask everyone" sent the messages. No script errors. 0 known dependency vulnerabilities.


> Note: the byte counts and deploy steps below are from when this version was made. Later versions changed some of the same files. Use the table and steps in CHANGES_v85.md.

## Files (complete replacements; one file is new). This zip includes v74, v75 and v76.
| File | Bytes |
|---|---|
| public\index.html | 1181311 |
| server.js | 16854 |
| src\platform-settings.js | 21350 |
| src\id-retention-scheduler.js | 2195 |
| src\routes\admin.routes.js | 188105 |
| src\routes\marketplace.routes.js | 120846 |
| src\routes\auth.routes.js | 72257 |
| src\routes\misc.routes.js | 55490 |

server.js is the one in the top folder of the repo, next to package.json. src\id-retention-scheduler.js is new.

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v85-files.zip.
2. From the unzipped folder:
   ```
   copy /Y server.js "C:\path\to\trothen-backend\server.js"
   copy /Y public\index.html "C:\path\to\trothen-backend\public\index.html"
   copy /Y src\platform-settings.js "C:\path\to\trothen-backend\src\platform-settings.js"
   copy /Y src\id-retention-scheduler.js "C:\path\to\trothen-backend\src\id-retention-scheduler.js"
   copy /Y src\routes\admin.routes.js "C:\path\to\trothen-backend\src\routes\admin.routes.js"
   copy /Y src\routes\marketplace.routes.js "C:\path\to\trothen-backend\src\routes\marketplace.routes.js"
   copy /Y src\routes\auth.routes.js "C:\path\to\trothen-backend\src\routes\auth.routes.js"
   copy /Y src\routes\misc.routes.js "C:\path\to\trothen-backend\src\routes\misc.routes.js"
   copy /Y CHANGES_v7*.md "C:\path\to\trothen-backend\"
   ```
3. Check the sizes against the table:
   ```
   cd /d "C:\path\to\trothen-backend"
   for %I in (server.js public\index.html src\platform-settings.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\auth.routes.js src\routes\misc.routes.js) do @echo %~zI  %I
   ```
   If any number is different, stop and copy again.
4. Push:
   ```
   git add server.js public\index.html src\platform-settings.js src\id-retention-scheduler.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\auth.routes.js src\routes\misc.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md CHANGES_v77.md
   git commit -m "v77: face photo with ID, automatic deletion of ID files, v74-v76"
   git push
   ```
5. After Render finishes, open Admin → Verification. I should see the panel "How ID files are kept". If it shows a red warning about the permanent disk, set PRIVATE_UPLOADS_DIR in Render before anyone uploads an ID.
6. **Before I deploy:** if there are decided ID files older than 90 days that I want to keep, I should download them first or set the days to 0 straight after deploying. The first clean-up runs about 30 seconds after the server starts.
