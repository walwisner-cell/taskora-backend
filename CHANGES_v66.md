# Trothen v66: the "Live in" strip is easy to see

## What was wrong
The line under the front page's top section ("Live in Liberia · United States — expanding globally") was small grey text on white, faded at both ends, and always scrolling sideways. With only two countries, it scrolled the same short line past over and over and was hard to read.

## What I changed
- **A solid navy band with white text.** It now starts with a green pulsing "live" dot and "Live now in", then shows each country as its own chip, then "More countries coming soon" in yellow.
- **It only moves when it has to.** With a short list (up to four countries, or whenever everything fits), it sits still in the middle of the screen. On a phone it wraps neatly onto two lines. Only a long list scrolls.
- **Before the server answers,** the band stays hidden instead of showing an old hard-coded list of countries.
- The countries still come from my admin settings, exactly as before.
- Spanish text is included. Anyone whose device is set to reduce motion sees the dot without the pulse.

## Tested
- With two countries and with ten, on a computer and a phone.
- Nothing runs off the edge of the screen.
- Search still works, with no script errors.

## Byte count
| File | Bytes |
|---|---|
| public\index.html | 1,126,815 |

This replaces the v65 index.html.
