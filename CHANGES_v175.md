# Trothen v175: Messages on a phone

v175 goes on top of v174. If v174 isn't live yet, this package deploys both.

## What you sent
A screenshot of Messages on your iPhone. The top of the chat was squeezed:
- the name and "Pro · Delivery…" were one word per line;
- the Call, Video and Block buttons ran off the right edge;
- the message box and Send were hidden behind the keyboard.

## What was wrong
1. The name, the details and all the buttons (Call, Video, Block, Save Chat) were on one line. On a phone the buttons kept their full width, so the name was left with about 30 pixels.
2. iPhones don't shrink the page when the keyboard opens. The chat kept its full height, so its bottom (the message box) ended up under the keyboard.
3. The message box used 14 px text. iPhones zoom the whole page in when you tap a box with text smaller than 16 px.

## What I changed
- **On a phone, the name gets the whole first line:**
  - the details sit under it on a single line, ending in "…" if they're too long;
  - the buttons sit on their own line underneath, at least 40 px tall so they're easy to tap (Apple asks for 44 points, Google for 48 dp; 40 px plus the gap between them meets both in practice);
  - if they don't all fit (a small iPhone SE), that line slides sideways instead of going off the screen;
  - "Save Chat" shows just its icon on a phone;
  - on a very narrow phone, "‹ All Chats" becomes a large ‹ (it still says "All conversations" to screen readers).
- **The keyboard:** when it opens on a phone, the chat shrinks to the space above it, the page scrolls so the chat is in view, and the latest message stays at the bottom. The message box and Send stay visible while you type. When the keyboard closes, it goes back to normal.
- **The message box uses 16 px text on a phone,** so the iPhone no longer zooms in when you start typing.
- **On a computer** nothing changes: the buttons stay beside the name, with their words.

The key, card and pin buttons above your keyboard in the screenshot are the iPhone's own AutoFill bar, not Trothen's.

## Tests
- `t175` (new), 19 checks, on an iPhone 13, an iPhone SE, a Pixel 7 and a computer:
  - the name has room and stays on one line;
  - the buttons sit on their own line;
  - nothing is wider than the phone;
  - the buttons are big enough to tap;
  - the message box text is 16 px;
  - no page errors;
  - on a computer, everything stays on one line.
- Every earlier suite, on the file store.

## Files
- `public/app/chats.js`
- `public/index.html`

No server changes.
