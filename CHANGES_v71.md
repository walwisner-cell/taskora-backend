# Trothen v71: "Before a pro can take your job" is interactive

## What I changed
- **Tap any card to see how it works.** Each of the four cards now has a "See how it works" link. Tapping the card (or pressing Enter or Space on a keyboard) opens a panel with:
  - three short numbered steps explaining how that check really happens on Trothen;
  - a small moving drawing:
    - ID: a card is scanned by a yellow line, then a green tick pops up.
    - Agreement: the lines of the agreement write themselves, then it's signed.
    - Payment: a coin drops into a lockbox and the lock closes.
    - Fraud screening: a radar sweeps a shield and a warning dot blinks.
- **How the panel opens and closes.** One panel is open at a time. The open card lifts and points down to its panel, and the other cards fade back. Tapping the same card again, or the X, closes it. On a computer the panel opens under the whole row; on a phone it opens right under the card that was tapped.
- **The payment panel says plainly** that during early access, payments are in test mode and no real money moves.
- **Honest wording on fraud screening.** Trothen flags anything suspicious for a person to review, and only the most serious signs pause an account straight away, so the card and panel now say exactly that. The old card text said everything suspicious is paused, which wasn't accurate.
- Dark mode, Spanish, and reduced motion (drawings still, nothing animating) are all included.

## Tested
- On a computer and a phone:
  - Each card opens its own panel.
  - Tapping it again closes it.
  - The keyboard works.
  - Card colours stay correct when the panel opens between cards on a phone.
- Nothing runs off the edge of the screen, with no script errors.

## Byte count
| File | Bytes |
|---|---|
| public\index.html | 1,151,878 |

This replaces the v70 index.html.
