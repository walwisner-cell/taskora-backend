# Trothen v57: a new front page, a cleaner look everywhere, and motion where it helps

## What I changed

### The whole app
- New typefaces (Barlow for text, Barlow Semi Condensed for headings), one set of button and form styles, and calmer navy and blue colours taken from my logo. This covers the dashboards, sign-in, pop-ups and pricing, not just the front page.
- A flat version of my T-and-check mark in the top bar and footer. My original app icon still shows on the browser tab and phone home screen.
- Fixed 12 places where dark text sat on the blue brand colour and was hard to read.

### The front page
- **New headline:** "Local pros you can check before you hire." The word "pros" changes to plumbers, cleaners, tutors, and so on.
- **Search as a sentence:** "I need help with ___ in ___". As someone types, it suggests my real categories, and understands everyday words (typing "leak" suggests Plumbing).
- **A job ticket beside the headline** that walks through a booking in four steps: ask, agree, payment held, job done. It uses no invented names or prices, and says payments are in test mode during early access.
- **Other sections:**
  - A "Before a pro can take your job" section.
  - A category list that is easy to scan, instead of 60 emoji tiles.
  - Cleaner pro cards.
  - A closing section with one path for customers and one for pros.
- Spanish translations for all the new text.

### Motion, and where it happens
- **When the page opens:** the headline, sentence, search box and job ticket arrive once, in that order. The ticket is "set down" beside the headline. This only plays on the first view, not every time I go back to the home page.
- **The changing word:** the yellow line under it stretches to fit each new word. It pauses when the page is scrolled away or the tab is in the background.
- **The ticket:**
  - It plays through a booking once by itself, with a thin yellow line showing when the next step is coming.
  - It pauses while someone's mouse is on it, stops for good the moment they click it, and stops while they're on another screen.
- **In answer to what someone does:**
  - Search suggestions drop open.
  - A new line "writes" into the ticket.
  - A category row underlines.
  - Search results settle in, with their heading highlighted.
  - FAQ answers fade open.
  - The "What we check" icons draw themselves once when that section is scrolled to.
  - The numbers band counts up when it is actually seen.
- Anyone whose phone or computer is set to reduce motion sees everything finished and still, with nothing playing.

### Problems I fixed along the way
- The category list briefly showed made-up pro counts (48, 92…) while the real list loaded.
- Picking a category with no pros, or a search with no results, used to show every pro in the app under that heading. It now says honestly that there are none yet.
- The category list said every pro is "background-checked." The ID check is real, but the background-check review screen isn't built yet, so it now only claims the ID check.
- Searching scrolled to whichever section happened to be first on the page instead of to the results.

## Tested
- In a browser at desktop and phone sizes: the opening sequence, the word change, the ticket playing and handing control over on a click, search suggestions with mouse and keyboard, and search results.
- The same screens with "reduce motion" switched on.
- The sign-in screen, a customer dashboard, and the Post a Job form with the new styles.
- The whole page in Spanish.
- No script errors on any of it.

## Things I still need to decide
- **My logo** is a glossy 3D-style icon, and that style is widely read as AI-made. A simple logo from a designer would finish this job.
- **The footer default** still says "Atlanta, GA · support@trothen.io". My domain is trothenpro.com. I can change it in Admin → Settings → Footer.
- **The headline on the live site:** if I ever saved my own homepage text in Admin → Settings → Homepage Content, the live site keeps showing that saved text. I'd update it there.

## Byte counts
| File | Bytes |
|---|---|
| public\index.html | 1,029,033 |
| src\platform-settings.js | 16,882 |
