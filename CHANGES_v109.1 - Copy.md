# Trothen v109.1: notifications on a phone

What was wrong on a phone:
- The list opened on top of the menu bar, half covering it.
- Tapping anywhere inside the list closed it.
- The ✕ to remove a notice was tiny and faint.
- Older notices did nothing when tapped.
- The chat button sat on top of the bottom of the list.

What it does now:
- The list opens just under the menu bar, the full width of the screen, and scrolls if it is long.
- Every notice can be tapped and opens the page it is about, for example bookings, messages, payments, earnings or verification. Each one says "Open →".
- New notices are marked with a blue dot and a light blue background.
- The ✕ is a proper button. It removes that one notice and the list stays open.
- There is a Close button at the top. Tapping outside the list still closes it too.
- The list sits above the chat button.
- "Notifications", "Clear all" and "Open" are in Spanish when Spanish is chosen.

On a computer it looks and works the same as before, with the same improvements.

Tested on a phone screen as a customer and as a pro, and on a computer: 26 new checks. Every earlier browser check passed again. The server is unchanged from v109.

Files changed: `public\index.html` (only the version tag on the script line), `public\app\trothen.js`.

This package includes everything from v86 onward, including v109.
