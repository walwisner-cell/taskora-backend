# Trothen v74: I can edit a lot more wording from Admin

## What I asked for
The "Before a pro can take your job" section was already editable (since v72). I asked for the other similar sections to be editable from Admin too.

## What I can edit now that I couldn't before
It all lives in the same place: **Admin → Settings → Front page wording** (super admin only). The editor went from 85 pieces of text to 187.

**New groups**
- **Provider Plans page.** The title and the line under it, and for each of the four plans (Starter, Pro, Super Pro, Custom): the name, the line under the name, every tick line, the grey notes, the "Most Popular" badge and the buttons.
- **Trust list on a pro's profile.** The five lines (ID checked, written agreement, payment held, fraud screening, two-step sign-in).
- **Pro quick-view.** The badges, labels, buttons and messages in the pop-up card.
- **Careers page.** Title, paragraph, form heading, Send button.
- **Contact page.** Title, paragraph, Send button.
- **"Add to your phone" prompt.** The button, the iPhone steps and the messages.

**Existing groups that got more boxes**
- **Common questions.** All six questions. Each one also has an Answer box. If I leave the Answer box blank, the answer is the same one the support chat gives (as before). If I type something, the front page shows my text and the chat keeps its own answer.
- **Top pros.** The "Top Rated Pros" heading and the line under it. These only show before someone searches; after a search the page writes its own heading (for example "Plumbing"), and my wording doesn't interfere with that.
- **Menu and footer** (was "Footer"). The browse link, "Become a Pro", the phone Menu button, and the four footer links.
- **Search box.** The heading over the suggestions and the "Show all / Show fewer" links.
- **Every kind of work.** The count wording and the empty-category messages.
- **Before a pro can take your job.** The "Close" button on the open panel.

## Rules (same as v72)
- English only. Spanish visitors keep the built-in Spanish. The pages that were English-only before (Provider Plans, Careers, Contact) are still English-only.
- Super admin only. Every save is in the access log.
- Plain text, 600 characters per box, no < or >.
- Reset per box, or reset everything.

## What I deliberately left out
- **The "Early access: payments are simulated. Don't enter real card details." banner.** That's a safety notice, not marketing wording. It stays fixed in code until real payments are live.
- **Prices and commission rates as numbers.** Those are still set in their own Admin screens. The plan cards only describe them in words.
- **The six shortcut links under the search box** (Plumbing, Cleaning...). Each one is wired to a real category, so changing just the word would send people to the wrong place.
- **Icons, colours, how many cards there are, and their order.** Words only.

## Things I need to keep straight myself (not code)
- The plan cards say "13% / 12% / 10% commission". If I change the real rates in Admin, I must change these words too, and the other way round. The code doesn't link them.
- The support chat's own answer about pricing also names those prices and rates. That text is still in code.
- The trust list, the plan cards ("Escrow-protected payouts", "Same-day payout option") and the questions make promises to customers and pros. Payments are still simulated, so whatever I write has to match what the platform really does. Anything about money held, refunds or guarantees is worth running past the attorney along with the Stripe sign-off.

## Tested
- Saved changes to a plan line, a question, an answer, the Top pros heading, a trust line and the Careers title through the real admin address. A fresh English visitor saw all of them. A Spanish visitor saw none of them.
- Ran a category search after changing the Top pros heading: the heading correctly changed to "Plumbing" and stayed that way.
- Opened the real editor: 19 groups, 187 boxes, "changed" counts correct. Saved an answer from the editor and it showed on the front page straight away.
- Refused as expected: an unknown text name, text with < or >, and a save with no admin sign-in.
- No script errors in the browser.

## Files changed (complete replacements)
| File | Bytes |
|---|---|
| public\index.html | 1169953 |
| src\platform-settings.js | 19826 |

## Deploy (cmd.exe, not PowerShell)
1. Unzip trothen-v74-files.zip.
2. Copy the two files over the old ones in my repo folder, keeping the folders:
   ```
   copy /Y public\index.html "C:\path\to\trothen-backend\public\index.html"
   copy /Y src\platform-settings.js "C:\path\to\trothen-backend\src\platform-settings.js"
   copy /Y CHANGES_v74.md "C:\path\to\trothen-backend\CHANGES_v74.md"
   ```
3. Check the sizes match the table above:
   ```
   cd /d "C:\path\to\trothen-backend"
   for %I in (public\index.html src\platform-settings.js) do @echo %~zI  %I
   ```
   I should see 1169953 and 19826. If either number is different, stop and copy again.
4. Push:
   ```
   git add public\index.html src\platform-settings.js CHANGES_v74.md
   git commit -m "v74: more wording editable from Admin"
   git push
   ```
5. Wait for Render to finish, then open Admin → Settings → Front page wording and confirm I see the "Provider Plans page" group.
