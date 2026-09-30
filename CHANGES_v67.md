# Trothen v67: the "Live now in" strip is animated

## What I wanted
The navy "Live now in" strip was easy to read after v66, but it sat still. I wanted it to move and catch the eye.

## What I changed
- **It glides sideways like a news ticker.** The whole line ("Live now in · Liberia · United States · More countries coming soon") scrolls smoothly across the band at a steady, readable speed, and repeats with no gap or jump. It pauses while the mouse is over it, so it's easy to read.
- **Each country chip lights up in turn.** It turns yellow with a soft glow and a quick shine across it, then goes back, and the next country lights up.
- **The green "live" dot pulses** and sends out a ring.
- **"More countries coming soon"** gently fades in and out.
- **Nothing flashes quickly.** Each light-up takes over a second and comes round every few seconds. Fast flashing (more than three times a second) can trigger seizures in some people, so I kept well clear of that.
- **Reduced motion:** anyone whose phone or computer is set to reduce motion sees the strip still, with everything shown and nothing moving.
- The countries still come from my admin settings.

## Tested
- On a computer and a phone: the strip moves, the chips light up one after another, and the dot pulses.
- With reduce-motion on, it sits still.
- Nothing runs off the edge of the screen, with no script errors.

## Byte count
| File | Bytes |
|---|---|
| public\index.html | 1,130,228 |

This replaces the v66 index.html.
