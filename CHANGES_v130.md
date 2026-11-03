# Trothen v130: professional wording and presentation across the whole app

Built on v129 and includes it. If v129 is not deployed yet, deploy only this one.

## What I asked for
Make the text very standard, like most professional software, across the entire app, and not like AI-generated software.

## What made it look AI-generated
I went through every piece of text people see, in the customer and pro dashboards, the admin area, the public pages, notifications, emails and error messages. The patterns that give software a generated feel were everywhere:
- **Long dashes in about 400 sentences** ("Booking cancelled — escrow refunded", "Could not load — please try again").
- **Filler words**: "Real conversations, tied to your actual bookings", "Real submissions from…", "a real click from a real admin", "genuinely", "actually", "just".
- **Emoji on buttons, menus, badges, headings and notices** (📋 Additional Requests, 🚗 On the way, 👋 Welcome back).
- **Dates in computer format** ("2026-11-03").
- **Chatty or overexcited phrasing**: "You're almost there", "Say hello", "Let's talk", exclamation marks, "Here's what's happening with your bookings".
- **Inconsistent capitals**: buttons sometimes in Title Case, sometimes not.

## What changed
- **Wording.** About 650 pieces of text were rewritten in a plain, formal business style:
  - short, complete sentences, without long dashes or filler words;
  - "Please try again." for errors;
  - no exclamation marks;
  - the same terms used throughout.

  The meaning of every message is unchanged. Examples:
  - "Booking cancelled — escrow refunded" → "Booking cancelled. Your payment has been refunded."
  - "Real conversations, tied to your actual bookings" → "Conversations with the people you have bookings with"
  - "You're almost there — customers only ever book verified pros…" → "One more step: customers can only book verified pros. Upload a government ID to be reviewed, usually within one business day."
  - "Every contract is auto-generated and stored per booking" → "All contracts and their status"
  - "Let's talk" (Custom plan price) → "Custom pricing"
- **No emoji in the interface.**
  - Menus for customers, pros and admins now use clean, consistent line icons (Lucide, a free icon set with an ISC licence).
  - Buttons, labels, badges, headings, tables, notices and pop-ups have no emoji.
  - Where an emoji was the whole button, such as the notification bell, it is now a proper icon.
  - What people type themselves (messages, reviews, job descriptions) is shown exactly as written.
  - Useful symbols such as ✓ ✕ ★ ▾ → stay.
- **Dates read like dates.** "2026-11-03" now shows as "Nov 3, 2026" everywhere on screen. Form fields are not changed.
- **Buttons use Title Case consistently**, as most of the app already did: Leave Now, I Have Arrived, Track Arrival, Agree Arrival Time, Save Chat.
- **The "Live data" badge is removed** from page headings; it only made sense to developers.
- **Emails.** The welcome emails were rewritten in a standard format ("How it works: …", closing with "Kind regards, The Trothen Team"). The identity-verification reminder was rewritten the same way.
- **Server messages.** About 220 error and notification messages were rewritten the same way. For example, "Enter a real name — letters…" → "Enter a valid name using letters, spaces, hyphens and apostrophes only".
- **About page.** The default About text was rewritten as a plain company description.
- **Spanish.** The 171 pieces of text on the screens added in v128 to v130 now have Spanish translations; before, they showed in English. Spanish translations for the rewritten English text continue to match.

## What I deliberately did not change
- **The homepage wording.** It was already plain and human, and it is editable from Admin → Settings → Front page wording. Only its dashes were removed.
- **The Terms of Service, Privacy Policy and the ride and store rules.** These are legal documents. They should only be changed together with your lawyer, not by a style pass.
- **Programmer messages that only appear in the server log.**
- **Notifications already sent before this update** keep the wording they were saved with.
- **About Us, if you have already edited it in Admin.** The saved version is shown instead of the new default. To use the new text, paste it in Admin → Settings → About Us.

## What I tested
- All 40 checks from v128, the 25 arrival-time checks from v129, the 22 phone checks and the 35 checks across five screen sizes pass.
- Every customer, pro and admin page I opened showed no emoji outside what people typed, and no dates in "2026-11-03" format.
- No page errors and no server errors. Every changed file passes a syntax check.
- I confirmed that only text changed: the changes were made inside the text pieces themselves, never in program logic, and I reviewed the riskier files line by line.

## Files
New: `public/app/polish.js`, `CHANGES_v130.md`, `DEPLOYMENT_STEPS_v130.md`
Changed since v128: the 7 v129 files plus every file whose wording changed (listed with byte counts in `DEPLOYMENT_STEPS_v130.md`).
No new packages, settings or database changes.
