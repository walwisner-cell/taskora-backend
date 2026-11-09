# Trothen v155: the phone view, lined up

What Walter asked: "work on the alignment of the mobile interface to look very professional."

## How I checked it
I went through every customer and pro section, the More sheet, the home page, sign-in and All pros on a phone screen. On each one I looked for things that didn't line up: edges, spacing, sizes, colours and wrapping. Then I measured the same things in a test, so they stay lined up.

## What I found
- **The edges didn't match.** Titles, boxes, the early-access notice and the top bar each started a different distance from the side of the screen (12, 14, 16, 18 or 22 px). On the sign-in page and All pros the gap was different again.
- **The notice at the top took three lines.** "Details" sat on a line of its own.
- **The top bar's buttons were different sizes.** The language button said "English" as plain text, the bell was a square and the account button was smaller, and they didn't sit on one line.
- **The tab bar icons were in several colours:** Home blue, Jobs red, Contracts purple. Apps normally use one colour, plus a highlight for where you are.
- **Lists shown as cards had a frame inside a frame,** so the cards sat 28 px in from the edge.
- **A contract's PDF button was a small box on the left,** and the line above it only ran across the button. An older rule was keeping that cell as a table cell.
- **"Saved to your account" in Settings** dropped onto its own line, 6 px further in than the text above it.
- **Payment history's date filter** stacked the two dates, then "Clear" beside the second date, then "Download PDF" on its own line.
- **An odd number of figure boxes** (Earnings: three) left an empty gap beside the last one.
- **All pros:** the two dropdowns were each 200 px wide whatever the screen, so the right-hand side stayed empty.
- **"What you do on Trothen":** the dropdown was narrower than the box, with Save floating beside it.
- **"Saved" in More used a plain circle,** because it had no icon of its own.
- **Sign-in:** the form floated in the middle of the screen with a large empty space above it.

## What changed
- **One edge:** every title, box, list and button now starts and ends 16 px from the side of the screen. That is the standard phone margin, and it's the same on every section, the sign-in page and All pros.
- **The notice:** one tidy row, with the "!" icon, the text, "Details" and ✕ lined up. It's two lines at most.
- **The top bar:**
  - the logo, then the language (shown as "EN" / "ES"), the bell and your name;
  - all three are 44 px tall, centred in a 64 px bar and evenly spaced;
  - a screen reader still says the full language name.
- **The tab bar:**
  - every icon is one colour (grey);
  - the place you're on is blue, with a soft highlight behind its icon;
  - the icons in More are grey too, with the open one in blue.
- **Section titles:** a 26 px title, a 15 px line under it and the same space before the first box, on every section.
- **Boxes:** 16 px inside every box. A box inside another box loses its own border, so there's no frame inside a frame.
- **Figure boxes:** two side by side. If there's an odd one out at the end, it takes the full width.
- **Lists shown as cards:**
  - the cards sit straight on the page;
  - the labels and values are in two even columns;
  - the buttons at the bottom of each card span the card, under a line that crosses the whole card.
- **"Saved to your account":** on its own line, lined up with the text above it, on every Settings page.
- **Date filters:** from and to side by side, then Clear and Download PDF side by side, each the full width.
- **A form's single main button** (for example "Add Profile Photo") fills the width, like the fields above it.
- **All pros:**
  - the search box is full width, with "Best match" and "All countries" side by side under it;
  - the kind-of-work chips keep their size but have a 44 px tap area.
- **"What you do on Trothen":** the dropdown fills the row, with Save beside it.
- **More → Saved:** a bookmark icon.
- **Sign-in:** the form sits near the top, 16 px from each side.

None of this changes a tablet or a computer. Every rule only applies to screens up to 760 px wide.

## What I tested
- **New `t155` (18 checks), on an iPhone 13 and a Pixel 7:**
  - the top bar's buttons are the same height (at least 44 px) and centred;
  - the tab bar icons are one colour and the selected one stands out;
  - on all 13 pro sections and all 12 customer sections, the title and every box start (and, for the pro sections, end) 16 px from the edge;
  - a contract's PDF button and its line span the card;
  - "Saved to your account" lines up with the text above it;
  - Payment history's dates and buttons each sit side by side;
  - All pros has the search full width and the dropdowns side by side;
  - there are no page errors.
- **`t154`** (the tab bar, More, the 44 px tap sizes) still passes.
- **The phone measurements:**
  - nothing scrolls sideways;
  - no text box makes the iPhone zoom in;
  - no wrong keyboards.
- **Accessibility (axe-core, WCAG 2.1 AA):** still 0 problems.
- **Every earlier suite,** including every section on a phone, a tablet and a computer.

## Files
- **New:** `CHANGES_v155.md`
- **Changed:**
  - `public/index.html` (the alignment styles for phones, and fingerprints refreshed)
  - `public/app/trothen.js` (the "EN" language button, the date-filter rows)
  - `public/app/arrival.js` (a cell that holds only buttons becomes the card's action row)
  - `public/app/polish.js` (the "Saved" icon)

No server changes, no database changes, no new packages.
