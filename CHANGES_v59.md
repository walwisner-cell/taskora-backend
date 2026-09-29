# Trothen v59: works on every screen size

## What was wrong on phones
- **Hidden top-bar links:** "Browse pros" and "Become a Pro" were hidden on phones, with no way to reach them from the top bar.
- **Oversized notice:** the early-access notice took up about a fifth of a phone screen before anything else showed.
- **Cut-off dashboard sections:** on the dashboards, the section list ran off the right edge (for example "Favori…" and "Cus…"), with no sign there was more.
- **Covered pop-ups:** the notice sat on top of the top of pop-up forms (like Post a Job).
- **Zooming text boxes:** on iPhones, tapping a small text box zoomed the whole page in.

## What I changed
- **A Menu button on phones.** Sign In stays in the top bar. "Browse pros" and "Become a Pro" are in a Menu that drops down under it. On the smallest phones the language switcher shows as a globe.
- **Shorter notice on phones.** It shows just the key warning ("payments are simulated, don't enter real card details") with a Details button for the full text. It still updates itself from the server as before.
- **Dashboard sections on phones.**
  - They sit in a bar that scrolls sideways and stays under the top bar while I scroll.
  - A fade on the right edge shows there's more, and disappears at the end.
  - The section I'm in always scrolls into view. This covers customer, provider and admin dashboards.
- **Pop-ups on phones.** They come up from the bottom, use the full screen height, and keep their main button in reach. Nothing sits on top of them.
- **Other phone fixes:**
  - Every text box is at least 16px, so iPhones don't zoom in.
  - Tap targets are bigger.
  - The chat button is smaller and clear of the iPhone home bar.
  - Messages at the bottom of the screen no longer sit under the chat button.
- **Phones held sideways.** The top bar doesn't stay pinned there, so it doesn't take half the screen.
- **Very large screens.** Content gets a little wider instead of leaving large empty margins.
- Spanish text for the new Menu and notice buttons.

The computer view is unchanged, and my logo is still the exact original file.

## Tested
- An automatic check at 320, 360, 390, 414, 768 and 1024 pixels wide on 14 screens: home, sign in, sign up, categories, all pros, pricing, about, contact, careers, terms, Post a Job, customer dashboard, customer settings and admin. It looked for anything running off the edge of the screen and found nothing.
- By hand:
  - Menu opening and closing, and going to the right page.
  - The notice's Details button.
  - The admin dashboard jumping to the right section.
  - The Post a Job form on a 320px phone.
  - A tablet, and a phone held sideways.
- The computer version still passes its earlier tests, with no script errors.

## Byte count
| File | Bytes |
|---|---|
| public\index.html | 1,043,379 |

This replaces the v58 index.html. src\platform-settings.js from v57 has not changed.
