# Trothen v154: the phone view, made to work like a phone app

What Walter asked: "please work on the mobile view on the mobile phone, let it work perfectly and with international standards and best practice so the app works very well without distractions and very easy to use."

## How I checked it
I opened every section as a customer and as a pro, plus the home, sign-in and All pros pages, on a phone. Each one was measured against the published standards:
- **Touch targets:** every button or field you tap is at least 44 x 44 px. This comes from Apple's design guidelines (44 points), Google's Material design (48 dp) and the accessibility standard WCAG 2.5.8 (24 px at the very least).
- **Text boxes:** text at least 16 px, so the iPhone doesn't zoom the page in when you tap one.
- **The keyboard:** the right one appears for phone numbers, email addresses and codes.
- **Nothing floating over the page,** and nothing that pops up while you're doing something.
- **No sideways scrolling, and small print no smaller than 12 px.**

I also tested the new test suite on an iPhone 13 and a Pixel 7 as emulated by the browser (screen size, touch and how they report themselves), with real taps.

## What I found
- **Finding your way around was hard.** The sections were a strip of buttons under the top bar that had to be scrolled sideways: "Overview, My Bookings, Rides, Market…". You couldn't see where things were, and the top of every screen was taken up by the notice, the top bar and this strip, about a quarter of the screen.
- **A floating chat button sat over the page,** covering buttons and the last line of lists.
- **620 buttons and fields were too small to tap reliably.** Most were the section buttons, "Save Changes", "Close my account", the notification bell, the theme buttons and the chat filters.
- **6 boxes showed the wrong keyboard:** letters for a phone number, or no @ key for an email.
- **The customer's phone number field was filled with a made-up US number (+1 404 555 0148)** when no number was saved. Pressing Save would have saved it.
- **The install card ("Install the Trothen app") popped up 6 seconds after opening a page,** covered a third of the screen, and on the dashboard it covered the menu.
- **The early-access notice came back on every page load,** even after you closed it.
- **Settings → "What you do on Trothen" said "Sell goods only…"** under the choice even when "Offer my services" was selected.

## What changed
### A tab bar at the bottom (customers and pros, on phones)
The pattern Apple, Google and most large apps use: the main places at the bottom of the screen, where your thumb is.
- **Customers:** Home, Bookings, Messages, Payments, More.
- **Pros:** Home, Jobs, Contracts, Messages, More.
- **More** opens a sheet from the bottom with every other place (Market, Rides, Earnings & Payouts, Tokens, Portfolio, My Store, Business Tools, Verification, Settings) and **Help & support**. Tap outside it, or ✕, to close it.
- **Telling where you are:** the place you're on is lit up. A red dot shows something new, for example an unread message.
- **The sideways strip is gone on phones.** On tablets wider than 760 px and on computers, the side menu is exactly as before.
- **The tab bar steps aside when you need the whole screen:**
  - in an open conversation, so the message box is never covered;
  - in any pop-up, such as a booking form or confirming a payment;
  - during a live trip;
  - while the keyboard is open.
- **It sits clear of the iPhone's home bar** (the safe area), and the end of every page can be scrolled clear of it.
- **It's in Spanish too:** Inicio, Reservas, Trabajos, Contratos, Mensajes, Más.

### Fewer distractions
- **No floating chat button on the dashboards.** Help is in More → Help & support, and opens as a full-width sheet. The public pages keep the chat button for visitors.
- **The install card:**
  - waits 15 seconds instead of 6;
  - never appears while you're typing, in a conversation or in a pop-up;
  - sits above the tab bar, not over it;
  - is smaller, with shorter wording.
  - "Not now" still hides it for 14 days, as before.
- **The early-access notice stays closed** once you close it. It comes back only if its wording changes.
- **"Complete your profile" on a phone** shows the Required items and the single most useful recommended one. "Show more" opens the rest.
- **The top bar on the dashboards is slimmer** (60 px instead of 72).

### Easy to tap and type
- **Touch targets:** every button, field, dropdown, tab and the notification bell is at least 44 px tall on a phone. The small on/off switches have a 44 px tap area around them. Checkboxes are 24 px with a taller row.
  - **Too-small taps:** 620 before, 127 after. Almost all that remain are hidden copies of a button (counted at 0 px), links inside a sentence (which the standard exempts) and a few links on the public pages at 40 px.
- **The notification bell is now a real button,** so it works with a keyboard and a screen reader says "Notifications (new)".
- **The right keyboard everywhere:**
  - number keypad for phone numbers;
  - @ key for email addresses;
  - number pad, with the phone offering to fill in the code, for sign-in codes.

  That's 21 fields in all, including payout numbers, guarantors, support contacts and admin email fields.
- **The made-up phone number is gone.** The field is empty, saying "Your phone number", until you fill it in.
- **Quicker taps:** phones no longer wait for a possible double-tap (`touch-action: manipulation`).

### Smaller fixes
- **"What you do on Trothen":** the line under the choice now describes the choice that is selected.

## What I tested
- **`t154` (33 checks), on an iPhone 13 and a Pixel 7:**
  - no tab bar on the public pages;
  - the right five tabs for a pro and for a customer, at the very bottom edge, with the strip and the chat button gone;
  - tapping Jobs opens Job Matches and lights up;
  - More lists everything plus Help;
  - choosing Earnings opens it and closes More;
  - tapping outside closes More;
  - Help opens as a full-width sheet;
  - an open conversation and a pop-up both hide the tab bar, and going back brings it back;
  - every button and field on all 12 customer sections is at least 44 px tall;
  - nothing scrolls sideways, and no page errors;
  - the notice stays closed after a reload;
  - on a computer, the side menu as before;
  - Spanish labels.
- **The measurements:** all customer and pro sections, before and after. Too-small taps went from 620 to 127, boxes that zoomed the page stayed at 0, wrong keyboards went from 6 to 0, and nothing scrolls sideways.
- **Accessibility (axe-core, WCAG 2.1 AA):** still 0 problems.
- **Every earlier suite,** including every section on a phone, a tablet and a computer.

## Files
- **New:**
  - `CHANGES_v154.md`
  - `public/app/mobile.js` (the tab bar, More, hiding the tab bar when needed, and the notice staying closed)
- **Changed:**
  - `public/index.html` (the phone styles, and fingerprints refreshed)
  - `public/app/trothen.js` (the bell as a button, keyboards, the made-up phone number, the install card's timing)
  - `public/app/checks.js` (one recommended item on a phone)
  - `public/app/market.js` (the "What you do" line)
  - `public/app/es-v152.js` (Spanish for the new labels)

No server changes, no database changes, no new packages.
