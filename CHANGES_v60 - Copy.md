# Trothen v60: the front page moves, and the plain sections have more life

## What was wrong
- **The ticket stopped:** the "What happens when you book" ticket played once and then stopped, and it froze whenever the mouse was over it. On my screen it sat still on step 2.
- **Faint lines:** the lines not filled in yet were faint grey bars.
- **Plain sections:** "Popular right now" was plain white boxes with just a name and price, and the space between sections felt empty.

## What I changed

### The job ticket now runs on a loop
- It moves step 1 → 2 → 3 → 4 by itself, rests on "Job done", then starts again. It keeps going while the mouse is over it. It only holds still while the pointer is on its two buttons, while someone is using it with the keyboard, or when it's off screen.
- If a visitor clicks a step or "Next step", it goes to that step and waits. After about 9 quiet seconds it carries on by itself.
- **A status chip** in the corner changes with each step: Finding pros (blue), Agreed (navy), Payment held (yellow), Complete (green).
- **The steps:** the step in progress has a pulsing ring, finished steps turn into ticks, and the blue line between them fills as it goes.
- **The lines:** lines still to come shimmer so they read as "filling in", and each new line is written in with a yellow highlight.
- **A green "Job done" stamp** lands on the ticket at the last step.
- A thicker yellow timer line along the bottom shows when the next step is coming.

### "Popular right now"
- Each card now has:
  - a drawn icon for that kind of work (a tile with the initials if there's no matching icon);
  - the starting price;
  - how many checked pros are ready;
  - a "See pros" link.
- Cards lift with a coloured edge on hover.
- With only a few categories, the cards stretch to fill the row instead of leaving empty space.
- Category names are now escaped properly, a small safety fix.

### The rest of the page
- Sections and cards slide in the first time they scroll into view: section headings, cards, category rows, pro cards, FAQ questions and the numbers band. Cards come in one after another, not all at once.
- Pro cards lift on hover, and photos get a soft ring.
- The "Showing pros from across all locations" note is now a clear blue info box instead of a dashed gold box.
- Category counts sit in small pills.
- Less empty space between sections, with a thin line between white sections.

Anyone whose phone or computer is set to reduce motion still sees everything finished and still. My logo is unchanged.

## Tested
- Left alone for 18 seconds with the mouse over the ticket, it went 1 → 2 → 3 → 4 → back to 1.
- After a click, it waited about 9 seconds and carried on.
- The stamp, status chip and ticks show at the right steps.
- The Popular cards and hover work on a computer and a phone.
- Nothing runs off the edge at any phone width.
- Search, suggestions and the reduce-motion setting still work, with no script errors.

## Byte count
| File | Bytes |
|---|---|
| public\index.html | 1,060,172 |

This replaces the v59 index.html. src\platform-settings.js from v57 has not changed.
