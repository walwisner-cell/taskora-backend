# Trothen v124: messages show the date and time

## What I asked for
On "Responses to Your Job", the messages ("You: how much") had no date or time, so I couldn't tell when anything was said.

## What changed
Every message now shows when it was sent, in the reader's own time zone:
- **Today, 4:32 PM** for today
- **Yesterday, 9:10 AM** for yesterday
- **Oct 28, 4:32 PM** for earlier this year
- **Dec 24, 2025, 9:00 AM** for an earlier year

Hovering over the time shows the full date, for example "Sunday, November 1, 2026 at 4:47 PM".

It's in all three places messages appear:
1. The customer's **Responses to Your Job** window, after each message.
2. The main **Messages** page, at the bottom of each bubble. On my own dark bubbles it's in a light colour so it's easy to read.
3. The pro's **Message [customer]** window for a posted job.

New messages arrive instantly (v123), with their time.

## How I tested it
In a browser as the customer and as the pro: the Responses window, the pro's job chat and the Messages page all show "Today, 4:47 PM", and the hover shows the full date. "Yesterday", earlier this year and an earlier year all came out right. No page errors.

## Files
- `public/app/trothen.js`
- `public/index.html` (style for the time on dark bubbles, new version tag)
