# Trothen v72: I can edit the front page wording from Admin

## What was missing
From Admin I could only change the main headline, the sentence under it, the "why Trothen exists" text and the photos. Everything added since v57 (the search box, the job ticket, the four checks and their "how it works" steps, section headings, the closing boxes, the footer line) could only be changed in code.

## What I changed
- **New editor: Admin → Settings → "Front page wording".** It sits just under "Homepage Content" and covers about 90 pieces of text, grouped by section:
  - search box
  - job ticket
  - "Live now in" strip
  - numbers band
  - "Before a pro can take your job", including each card's three "how it works" steps and the yellow note
  - Popular right now
  - Recent work
  - Every kind of work
  - Top pros
  - What customers say
  - Common questions
  - closing boxes
  - footer
- **How the editor works:**
  - Each box has a plain-English label (for example "Card 2, step 3") and starts with the words visitors see now.
  - A box I've changed turns light yellow and is marked "changed". Each group shows how many changes it has.
  - **Reset** beside a box puts that one back to the built-in wording. **Reset everything to built-in** puts all of it back.
  - **Save wording** makes it live straight away for every visitor, with no deploy.
- **Rules:**
  - This changes the English words. Visitors who choose Spanish still see the built-in Spanish.
  - Only the super admin can change it, and every save is recorded in the access log.
  - Text only, up to 600 characters per box, and no < or > characters, so nothing can be used to inject code into the page.

## Server changes
- `src/platform-settings.js`: stores the changed wording and the list of text that's allowed to be edited.
- `src/routes/marketplace.routes.js`: a public address, `/api/content-overrides`, that sends visitors the changed wording.
- `src/routes/admin.routes.js`: the admin addresses to read and save it, checked as described above.

## Tested
- Changed the search button to "Search now" and the section heading, and saved. A fresh visitor saw both, and a Spanish visitor still saw the Spanish.
- "Reset everything" put it all back.
- Unknown text names and text with < or > are refused, and someone not signed in as admin is refused.
- Nothing runs off the edge of the screen, with no script errors.

## Byte counts
| File | Bytes |
|---|---|
| public\index.html | 1,165,262 |
| src\platform-settings.js | 18,428 |
| src\routes\marketplace.routes.js | 118,830 |
| src\routes\admin.routes.js | 182,507 |

These replace the earlier versions. v64's misc.routes.js, auth.routes.js and persona-verification.js are unchanged.
