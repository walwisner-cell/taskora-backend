# Trothen v108.1: customer ID upload, and the chat button on phones

A small release with two fixes. Following Joseph's latest list I only did what is needed now; the rest is listed at the end with my reasons.

## 1. Customers could not upload an ID ("all is green")

What Joseph saw was real. Some customer accounts were approved by the team before v75. Back then, approving an account also switched on "verified", even though no ID had been looked at. Since v75 approving no longer does that, but those older accounts kept the flag. So:

- the Verification page showed every step green and had no upload, because it thought the person was done, and
- those customers could book without ever showing an ID.

What I changed: when the server starts, any customer marked verified who has **no approved ID** goes back to unverified. They get a notice asking them to upload their ID, and the next time they sign in they are asked again and taken straight to the upload. Bookings they already made are not touched. Customers whose ID was approved keep their badge.

Pros are not changed by this. Some pro accounts may be in the same position; the Verification Queue's "Waiting on the person" list does not show them, because they count as verified. Whether to apply the same rule to pros is my decision. Applying it would take their profiles off the site until their ID is approved.

Tested end to end on a phone-sized screen: the account goes back to unverified, booking is refused, the customer is asked to verify, uploads the ID and a face photo, the ID reaches the Verification Queue, an admin approves it, and the customer is verified.

## 2. The chat button did nothing on a phone

On a computer it worked. On a phone a tap did nothing. The button can be dragged, and after a tap the drag code nudged it half its width. The phone's click then landed on the hidden notice box at the bottom of the screen instead of the button. Now:

- A tap opens and closes the chat. A real drag moves the button. A small finger wobble still counts as a tap.
- A moved button stays exactly where it was put. Before, it came back half a button out.
- The hidden notice box no longer catches taps meant for whatever is under it, anywhere on the site.
- The button works with the keyboard and is announced as a button to screen readers.
- Visitors were told the smart answers needed "a real API key added as an environment variable on the server". That was a note for me. They now get the offer of a real person.

**The chat only answers set questions** (escrow, verification, disputes, payments and the like) **until an Anthropic API key is added on Render** (`ANTHROPIC_API_KEY`). That is a cost decision, not a bug.

## What was tested

407 server checks and 245 browser checks, 31 of them new. All passed.

## What I did not do from Joseph's list, and why

- **Phone notifications.** The code is there. They are off because two settings are missing on Render: `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. To make them, open the web service's Shell in Render and run `npx web-push generate-vapid-keys`, then paste the two values into Environment. Do not paste the private key into chat or email.
- **Ringtone.** Phones only let a website play a sound while it is open on screen and after the person has touched the page. A ringtone with the site closed needs a phone app. Nothing to fix in the website for that.
- **Customer subscription (free, 3, 6 and 12 months).** There is already a customer membership. Changing it to these lengths and deciding the benefits is a business decision first: what each length costs and what it gives. I can build it once those are decided. With payments still simulated it earns nothing yet.
- **Redesign the front end, less writing.** v107 shortened the home page. A full redesign for the US market is a separate project. Worth doing before marketing in the US, not as part of a bug fix.
- **Provider score not displaying.** It shows on my copy. v108 removed one way it could fail on the live site. If it is still missing after v108 is deployed, I need a screenshot.

## Files

New: `src\customer-id-rule.js`.

Changed: `public\index.html` (only the version tag on the script line), `public\app\trothen.js`, `server.js`.

This package includes everything from v86 onward, including v108. If v108 was not deployed yet, deploy this instead.
