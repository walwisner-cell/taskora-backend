# Trothen v73: hunting down anything that still sounded AI-written

## What I did
Went through every piece of text a visitor actually sees — the whole front page, every button, every error and empty-state message, the whole app — looking specifically for the words and patterns that give AI-written copy away: "seamless," "elevate," "unlock your potential," "leverage," "robust," "cutting-edge," "game-changing," vague superlatives, and that generic motivational-poster tone.

## What I found
Less than I expected, and that's worth saying plainly rather than inventing problems to look busy: the real redesign work already done (v57 through v72) had already moved this copy a long way from anything that reads as AI-generated. It's concrete, plain, and specific almost everywhere — "You pay Trothen, not the pro, and the money waits while the work gets done" is the kind of sentence a person writes, not a template.

Two real things were still worth fixing:

- **One genuinely vague line.** The phone verification screen said "Verify your phone to build trust and unlock full account features" — true in a technical sense, but vague about what it's actually for. Changed to say the real thing: "Verify your phone so we can reach you by text about bookings and sign-in codes."
- **Dead, leftover wording from before the redesign.** Nine old text keys (`how_title`, `step1_title`, `step1_desc`, and their siblings — the old "How Trothen Works, 3 simple steps" section) were still sitting in every language's translation file, genuinely unused anywhere on the actual page since the job-ticket section replaced them back in v57. Removed all 63 occurrences (9 keys × 7 languages) — not AI-sounding specifically, just stale clutter nobody could see, cleaned out rather than left to confuse the next pass through this file.

## What I didn't touch
The front-page wording system from v72 — the ~90 pieces of text editable from Admin — was already in good shape, so none of those needed real edits. I'd rather tell you that honestly than rewrite good copy just to show work.

## Tested
- Full syntax check across the whole file — clean.
- Real boot, real homepage load in an actual browser — renders correctly, nothing broken by the cleanup.
- Confirmed the removed keys were never referenced anywhere on the actual page before taking them out — nothing visible changed because of the removal itself.

## Byte count
| File | Bytes |
|---|---|
| public/index.html | 1,158,914 |

This replaces the v72 index.html. No server files changed this round.
