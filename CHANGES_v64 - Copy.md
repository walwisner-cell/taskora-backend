# Trothen v64: identity verification, checked against best practice

## Short answer
No, not before this update. The foundations were good, but two problems meant my "ID checked" badge could appear on a pro whose ID nobody had actually looked at. This update fixes the code side. Some of the rest needs a business decision from me, listed at the end.

## What was already good
- ID files are stored in a private folder that is never publicly reachable.
- Uploads are checked by their actual bytes, not by what the file claims to be, and are limited to 10 MB.
- The ID types offered depend on the person's country.
- The name typed from the ID is compared with the account name, and mismatches are flagged.
- There's a 48-hour review deadline, and a rejection must include a reason the applicant sees.
- Reviewers are limited by department and by city.
- Persona messages are checked with a proper signature.

## What was wrong, and what I fixed

1. **Approving an account put the "ID checked" badge on a pro.** "User Approvals" set the same flag the badge uses, even when no ID had been submitted or opened. That's most likely how current pros got their badge.
   - **Now:** a provider only gets the badge from an ID that was actually reviewed (approved in the Verification Queue, or passed by Persona).
   - Approving a provider's account lets them in and tells them to verify their ID next.
   - Customers work as before.

2. **The Verification Queue had no working buttons.** Approve and Reject only appeared for a status the queue never contains, so reviewers could never act on a submitted ID from there. There was also no way to open the ID, and no view of the name typed from it.
   - **Now each row shows:** the applicant, the name on the ID with a "Matches / Doesn't match account" tag, a **View ID** button, the date submitted, the status (with an overdue tag after 48 hours), and working Approve / Reject buttons.
   - A short checklist sits at the top: real document, not expired, readable, name matches.

3. **New panel: "ID checked" with no reviewed ID.** It lists every provider who carries the badge without an approved ID on file. For each, I can press **Ask for ID** (sends them a message) or **Remove badge until checked**.

4. **Opening someone's ID is now recorded.** The access log keeps who opened it, when, and which submission. The file is also sent with "don't cache" instructions, so it isn't left in a browser or proxy cache.

5. **Decisions are safer and recorded.**
   - Only a submission that's still waiting can be decided, so an old replaced upload can't be approved from a stale screen.
   - Nobody can review their own verification.
   - Each decision stores who made it and when.

6. **A verified pro's name is tied to their ID.** Before, a verified pro could rename their account to anyone and keep the badge. Now small edits that still match the ID are allowed (adding a middle name, fixing a typo); anything else goes through support.

7. **Limit on uploads:** at most 5 ID submissions per account per day.

8. **Persona (automated ID + selfie check), hardened for when I switch it on.**
   - A message older than 5 minutes is refused, so an old "approved" message can't be replayed.
   - The same message arriving twice is only acted on once.
   - Before putting the badge on, the name Persona read from the ID is compared with the account name. A mismatch goes to a person instead of approving automatically.
   - Failed Persona checks now actually appear in the review queue. Before, they were saved with a status the queue never showed.

## Tested
I ran 20 end-to-end checks on my own computer, and all 20 passed:
- Account approval alone no longer verifies a provider.
- The queue shows the ID and the names.
- Opening the ID works for an admin, is logged, and is refused for the provider.
- Approving verifies the provider and records the reviewer; deciding twice is refused.
- The rename lock works both ways.
- The "no reviewed ID" list and "Remove badge" work.
- The sixth upload in a day is refused.
- Persona: a name mismatch goes to review; a duplicate message is ignored; a replayed old message is refused; a matching name verifies; a failure lands in the queue.
- Customer approval works as before.

## What needs my decision (not code)
1. **My current pros probably have the badge without a reviewed ID** (likely Joseph and priya). After deploying, open Admin → Verification Queue and look at the new panel. Ask each one to submit their ID, then approve it in the queue.
2. **No selfie or liveness check in the manual flow.** Someone could upload a photo of another person's genuine ID. This is the biggest remaining gap. There are two ways to close it:
   - Turn on Persona, which is already built in. It needs a Persona account (paid per check) and three settings on Render: `PERSONA_TEMPLATE_ID`, `PERSONA_ENVIRONMENT_ID`, `PERSONA_WEBHOOK_SECRET`.
   - Or ask Claude to add a required "selfie holding your ID" photo to the manual upload.
3. **How long to keep ID images.** Right now they're kept indefinitely. I should decide a retention period with my lawyer, because data protection laws in the countries Trothen serves expect data to be kept no longer than needed. Once I decide, deleting ID images after that period can be automated.
4. **Selfie and face checks are biometric data.** If I turn on Persona's selfie check, my privacy policy and consent wording must say so. Some US states (for example Illinois) have strict biometric laws. This needs lawyer review.
5. **Storage on Render.** Check that `PRIVATE_UPLOADS_DIR` is set to a path on my persistent disk. Without it, uploaded IDs disappear on every deploy. I should also ask Render whether that disk is encrypted at rest; if I want extra protection, file-level encryption can be added in code.
6. **"ID checked" is not a background check.** If Trothen ever runs criminal background checks on US pros, US federal law (the FCRA) requires using a licensed background-check company and following its consent rules. The guarantor calls are reference checks, not background checks.

## Files and byte counts
| File | Bytes |
|---|---|
| public\index.html | 1,117,162 |
| src\persona-verification.js | 4,248 |
| src\routes\admin.routes.js | 180,604 |
| src\routes\misc.routes.js | 53,952 |
| src\routes\auth.routes.js | 72,093 |

src\routes\marketplace.routes.js is unchanged since v63.
