# Trothen v76: a simple checkbox agreement at sign-in

## What was wrong
The agreement screen at sign-in was hard to use. It showed a list with green ticks that weren't clickable, a greyed-out checkbox I couldn't check, and a "step 1 / step 2" bar. I had to open the full Terms of Service first to unlock the checkbox, and nothing made that obvious.

## What I changed
- **One checkbox per promise, then one for the Terms of Service.** Customers get 6 boxes, pros get 7. Each is a big row I can tap anywhere on.
- **The screen tells me what's left.** Beside the button it says "Check all 6 boxes to continue", then "2 boxes left to check", then "All checked. You can continue." The button stays in view at the bottom the whole time, on phones too.
- **Nothing is locked.** The full Terms of Service are one tap away ("Read the full terms", right beside the last checkbox), but I'm no longer forced to open them before I can agree.
- **The wording is plain and matches what Trothen really does:**
  - a person on the team reviews a government ID (before a customer's first booking; before a pro appears in search)
  - every booking has a short written agreement: what, when, how much
  - the customer pays Trothen and the money is held until they mark the job complete
  - a person reviews every disagreement
  - while the early-access banner is showing, the payment box also says payments are in test mode and no real money moves yet. That sentence goes away by itself when the banner does.
- **Respect now covers everyone, both ways.** The customer side had no line about harassment or discrimination; only pros did. Both now promise "no harassment and no discrimination, whatever someone's race, religion, gender, age, disability or background."
- **I removed the word "insurance"** from "off the platform there is no payment protection and no insurance". It implied Trothen provides insurance on the platform, and it doesn't.
- **The placeholder date is hidden.** The built-in terms start with "Last updated: [set this date when you actually publish these terms]" and visitors could see that. The line is now left out until a real date is typed in.
- **Everyone is asked to agree again, once.** I moved the agreement version from v1-2026 to v2-2026 because customers are now told an ID is required. Every existing customer and pro sees the new screen at their next sign-in.

## What the server records
The time, the version, and whether the person opened the full terms (true or false, honestly). It refuses to save the agreement unless every box was checked.

## Things only I (and the attorney) can fix. Not code.
1. **Forced reading is gone.** A checkbox right beside a clear link to the terms is the normal way sites do this, but I should have the attorney confirm it's enough for Trothen.
2. **The full Terms of Service still need a legal pass.** I did not rewrite them; that's attorney work. What I noticed:
   - no real "Last updated" date yet (set it in Admin → Settings → Terms of Service)
   - they say payment "is held in escrow". Payments are still simulated.
   - the customer terms don't say customers must verify their ID
   - both still contain "no payment protection and no insurance" off the platform
   - nothing on privacy or how ID documents are stored, no governing law, no refund specifics
   - they name "Trothen Tech Group" and support@trothen.io; my domain is trothenpro.com. These need to be the real legal name and a mailbox that works.
3. **If I edited the terms in Admin**, my edited version is what people see, not the built-in one.
4. **Spanish:** this screen is English only, as it was before.

## About "make the system perfect"
I can't honestly promise that. What I did this round: rebuilt this screen, re-ran sign-in → agreement → ID prompt for a customer and a pro in a real browser (desktop and phone size), confirmed no script errors, and re-ran the dependency security check (0 known vulnerabilities). The open business items are unchanged: real payments, the attorney review above, and hosting region.

## Tested
- Customer (desktop) and pro (phone): screen appears at sign-in, button is off until every box is checked, the counter is right at each step.
- "Read the full terms" opens them and "Back" keeps my checks.
- The server refuses an agreement sent without the boxes checked.
- After agreeing: screen closes, doesn't come back on reload, and an unverified customer goes straight to the "verify your identity" prompt.


> Note: the byte counts and deploy steps below are from when this version was made. Later versions changed some of the same files. Use the table and steps in CHANGES_v86.md.

## Files changed (complete replacements; this zip also includes v74 and v75)
| File | Bytes |
|---|---|
| public\index.html | 1175586 |
| src\platform-settings.js | 19826 |
| src\routes\admin.routes.js | 184309 |
| src\routes\marketplace.routes.js | 120208 |
| src\routes\auth.routes.js | 72257 |

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v86-files.zip.
2. From the unzipped folder:
   ```
   copy /Y public\index.html "C:\path\to\trothen-backend\public\index.html"
   copy /Y src\platform-settings.js "C:\path\to\trothen-backend\src\platform-settings.js"
   copy /Y src\routes\admin.routes.js "C:\path\to\trothen-backend\src\routes\admin.routes.js"
   copy /Y src\routes\marketplace.routes.js "C:\path\to\trothen-backend\src\routes\marketplace.routes.js"
   copy /Y src\routes\auth.routes.js "C:\path\to\trothen-backend\src\routes\auth.routes.js"
   copy /Y CHANGES_v7*.md "C:\path\to\trothen-backend\"
   ```
3. Check the sizes:
   ```
   cd /d "C:\path\to\trothen-backend"
   for %I in (public\index.html src\platform-settings.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\auth.routes.js) do @echo %~zI  %I
   ```
   I should see 1175586, 19826, 184309, 120208 and 72257. If any number is different, stop and copy again.
4. Push:
   ```
   git add public\index.html src\platform-settings.js src\routes\admin.routes.js src\routes\marketplace.routes.js src\routes\auth.routes.js CHANGES_v74.md CHANGES_v75.md CHANGES_v76.md
   git commit -m "v76: checkbox agreement at sign-in; v75 customer ID rule; v74 wording editor"
   git push
   ```
5. After Render finishes, sign in as a customer. I should see "Before you book" with six checkboxes.
