# Trothen v61: colour bands instead of plain white

## What was wrong
Below the hero, the front page was section after section of plain white, so it felt flat and empty.

## What I changed
Each section now has its own full-width background, so the page has a rhythm as I scroll:

| Section | Background |
|---|---|
| Popular right now | Light blue "blueprint" grid paper, a nod to the trades. The cards are white with a soft shadow so they stand off the paper. |
| Every kind of work on Trothen | Deep navy with a faint dot pattern. Category names are white, the counts sit in gold pills, a gold line runs across the top, and a category turns gold on hover. |
| Top Rated Pros | Soft blue, with white pro cards and shadows. The location note is a white box. |
| Why Trothen exists | White, marked with a thick yellow bar down the left side. |
| Common questions | The same blueprint grid paper, with the questions on a white card. |

The hero, the numbers band, "Before a pro can take your job", the two closing boxes and the footer are the same as before. My logo is unchanged.

## Tested
- On a computer and on a phone.
- Nothing runs off the side of the screen at any phone width.
- The slide-in animation still plays as each band scrolls into view.
- Search and suggestions still work, with no script errors.

## Byte count
| File | Bytes |
|---|---|
| public\index.html | 1,064,071 |

This replaces the v60 index.html. src\platform-settings.js from v57 has not changed.
