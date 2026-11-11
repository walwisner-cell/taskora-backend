# Trothen v161: everything checked in more ways, and fixed

What Walter asked: "Ok can we fix everything and make sure it's working well".

v160's layout checker looked at phones, in English, in light mode, for customers and pros. This time I ran it every way people actually use Trothen:
- **in Spanish;**
- **in dark mode;**
- **on an iPhone 13, the small iPhone SE, an iPad and a laptop;**
- **for the admin dashboard too.**

I also gave it two new checks:
- **text too faint for its background** (the accessibility contrast standard, WCAG);
- **every phrase that stays in English when Trothen is set to Spanish.**

Below is what it found and what I changed.

## Real problems found

### The four checks on the home page showed a dot instead of an icon
The four "Every time" cards ("Their ID is checked", "The job is written down", "Your money waits", "We review every job") have an icon that draws itself in. In Chrome, and so on Android phones, each line ended up as a 1 px dash, leaving a stray dot.
- The icon lines are now measured and drawn in over their real length.
- The drawing leaves nothing behind when it ends, so the icons can never be left hidden.
- Before that section is on screen, the icons show whole.

### In dark mode, every card heading in the dashboards was invisible
One rule turned card headings white in dark mode. It was meant for the pages that really go dark (like Contact), but it reached the customer's and pro's dashboards, which stay light. So headings like "Profile", "Location" and "Complete your account" were white on white.
- The rule now applies only to the dark pages.

### The admin's tables on a phone were cut at the card's edge
Wide tables (disputes, verification, people) squeezed their columns and cut off what didn't fit:
- "In Review" read "In Revie";
- the verification buttons read "Ask I…" and "Rem… bac…".

On a phone they now turn into labelled cards, as the customer's and pro's tables already do (v129). Every badge and button is whole. On an iPad and a computer they stay as tables, which suit admin work. Tables you type into keep their columns.

### The motorbike night-hours rule (Admin, Rides) ran off a phone's screen
"No motorbike rides between [20] and [6] o'clock (Liberia time)" now wraps onto a second line.

### Spanish: about 150 phrases were still in English
They were in:
- the customer's Settings and Payments;
- the pro's Settings, Home, Earnings, Tokens and Verification;
- the bottom tab "Payments";
- the posted-job card's buttons;
- four answers in the home page's questions.

All are now in Spanish, using the same words as the rest of the app (profesional, reserva, pago retenido). Phrases with numbers translate too, for example:
- "# pending";
- "Guarantor 2";
- "License valid until …";
- "4h ago".

I found them by recording every visible phrase on every page in English and in Spanish, and listing the ones that came out the same. What's left the same is right as it is: names, places, plan names (Starter, Plus, Elite), and words that are the same in Spanish (Tokens, Mini, Catering). The admin dashboard stays in English, as before.

### Welcome card on the smallest phones, in Spanish
"+ Publicar un trabajo" was too long for half the width of a 320 px phone and pushed the page sideways. My own v160 change had kept these buttons to one line. They now take two balanced lines only when needed. The posted-job card's buttons do the same.

### Dark mode: links too faint
These read 2.3 to 2.9 : 1 on the navy, below the 4.5 : 1 standard:
- "See how it works" on the four checks;
- "Read more";
- "Verified ID" on pro cards;
- the "/hr" after a price;
- "Chat with us".

Each now has a light shade of its colour that reads clearly. The "Saved to your account" badge was the dark-mode mint on the light dashboard; it's now the normal green there.

### The payments answer in the support chat said "Payments are currently in test mode"
That would be wrong once real payments are switched on. It now explains how paying works:
- you pay through Trothen when you book, in the ways offered in your country;
- Trothen holds the money until you confirm the job is done.

The early-access banner still says when a country is in test mode.

## What the checker reports now
- **iPhone 13 and iPhone SE, English and Spanish, light and dark, customer, pro and admin:**
  - nothing cut off, nothing wider than the screen, no buttons sliced;
  - the only "overlap" is the location button inside the "in" box, which is meant to be there;
  - what remains under "squeezed" is ordinary wrapping, such as a three-word label on two lines in a half-width card.
- **iPad and laptop:** the same.
- **Contrast in dark mode:** from 356 findings to none that are real. The few left are on dark sections the checker can't see behind (I checked them by eye).

## What I tested
- The layout checker (`tlayout`): every page of the customer's, pro's and admin's dashboards and the home page, on 4 screen sizes in English, and on the two phones in Spanish and in dark mode.
- The English and Spanish phrase comparison.
- The four checks' icons, photographed while drawing and after.
- The admin tables as cards on a phone, by photograph.
- Every earlier suite, on the file store and on Postgres.

## Files
- **New:** `CHANGES_v161.md`
- **Changed:**
  - `public/app/trothen.js` (the four checks' icons; the payments answer; the "Chat with us" link)
  - `public/app/arrival.js` (the admin's tables as cards on a phone)
  - `public/app/rides.js` (the night-hours rule wraps)
  - `public/app/es-v152.js` (the Spanish)
  - `public/index.html` (dark mode, the welcome card, the posted-job card, fingerprints refreshed)

No server changes, no database changes, no new packages.
