# Trothen v58: text that's easier to read on white and light backgrounds

## What was wrong
On white and light-grey areas, much of the secondary text was a light grey, thin and small. It was hard to read, especially on Windows screens and phones outdoors.

## What I changed
- **Darker greys.** Secondary text went from a light grey to a dark slate. The faintest grey (used for small labels) is also much darker now. Every text colour on a light background now passes the standard accessibility contrast test, and most pass the stricter one.
- **Thicker letters.** Normal text now uses the Medium weight of the font instead of Regular, so letters aren't thin.
- **Bigger small text.** Across the whole app, including dashboards and admin screens, the smallest sizes went up: nothing is under 11.5px anymore, and most small labels went up about 1px. On the front page, descriptions, FAQ answers, category names and the job ticket are larger too.
- **Clearer lines.** Borders, dividers, the dotted lines in the category list and tag outlines are darker so the page structure is easy to see.
- **White front page.** The front page sections now sit on clean white, with only the "Before a pro can take your job" band in light grey to separate sections.
- **Gold text fixed.** A few pieces of gold text that were too pale on white now use a darker gold.
- **Banner.** The early-access banner at the top is larger and darker.

My logo is unchanged: still the exact original file.

## Tested
- The front page on a computer and a phone.
- A customer dashboard and the admin Settings screen, to make sure the larger text didn't break any layouts.
- Search, the job ticket, and the reduce-motion setting still work.
- No script errors.

## Byte count
| File | Bytes |
|---|---|
| public\index.html | 1,031,745 |

This replaces the v57.2 index.html. src\platform-settings.js from v57 has not changed.
