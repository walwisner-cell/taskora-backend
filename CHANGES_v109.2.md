# Trothen v109.2: open one notification, get cleared ones back, and tidy admin tables

## 1. Tap a notification to open it on its own
Tapping a notification now shows only that one, with the full date and time and two buttons:
- **Go to the page**: the booking, message, payment and so on that it is about.
- **Clear**: puts it away.

"← All notifications" goes back to the list.

## 2. Cleared notifications are kept and can be brought back
Before, the ✕ and **Clear all** deleted notifications for good. Now they are put away, not deleted:
- At the bottom of the list there is **Cleared notifications**. It lists what was cleared, newest first.
- Each cleared notification can be opened and read, or put back in the list with **Bring back**.
- **Bring all back** returns them all at once.
- Each person keeps their last 300 cleared notifications. Older cleared ones are removed.

**Honest note:** anything cleared before this release was deleted for good under the old rule and can't be brought back. From this release on, nothing cleared is lost.

## 3. Admin tables: the Action column lined up again
In Provider Scores, and in every other admin table with buttons, the Action column did not line up with the rest of each row. Its lines and height were out of step. The cause was one style that stopped those cells from behaving as table cells. Fixed everywhere at once.

Pages also leave room at the bottom, so the chat button no longer covers the last rows.

## Tested
- 51 notification checks on a phone, as a customer and as a pro, and on a computer.
- Every row of the admin tables lines up at 1440, 1280 and 390 pixels wide. With the old style, all 14 Provider Scores rows were out of line.
- All 447 server checks and every earlier browser check passed again.

## Files changed
`public\index.html` (only the version tag on the script line), `public\app\trothen.js`, `src\routes\misc.routes.js`.

This package includes everything from v86 onward, including v109 and v109.1.
