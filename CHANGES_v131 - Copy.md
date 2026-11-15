# Trothen v131: standard colours for icons

Built on v130 and includes it, and v129 too. If v130 is not deployed yet, deploy only this one.

## What I asked for
The icons that replaced the emoji should have standard colours.

## What changed
In v130 every icon was drawn in plain grey. In v131 each icon has a colour that matches its meaning, the way most business software uses colour:

| Colour | Used for | Examples |
|---|---|---|
| Green | Money and success | Payments, Earnings, Pricing, "approved" notices |
| Red | Alerts, fraud, location pins | Fraud & Safety, Locations, Go Live, Matches |
| Amber | Warnings, waiting and reminders | Disputes, Provider Scores, Announcements, the notification bell, arrival-time reminders |
| Blue | Messages, people and information | Overview, Messages, Customers & Providers, Referrals |
| Indigo | Documents and records | My Bookings, Contracts, Reports, Organizations |
| Orange | Orders, rides and deliveries | Store Orders, Rides, Deliveries, Stores |
| Purple | Promotions and rewards | Portfolio, Promotions, Advertising |
| Teal | Verification and checks | Verification, User Approvals, Categories |
| Gold | Tokens and star ratings | Tokens; stars are filled gold |
| Rose | Favourites | Favorite Pros; a full heart is filled |
| Grey | Neutral tools | Settings, Quotes & Invoices, Access Logs, Data Cleanup |

- **Menus.** Every menu icon for customers, pros and admins is coloured. The selected item is still highlighted in blue.
- **Notifications.** Each notification now shows an icon that fits what it is about: a green check for an approval, an amber clock for an arrival time, a green wallet for a payment, a blue speech bubble for a message. Before, they all showed the same grey megaphone.
- **Other icons**, such as the bell, stars and hearts, use the same colours.

Nothing else changed. The wording, layouts and features are the same as v130.

## What I tested
- I checked the customer, pro and admin pages and the notification list at laptop size.
- No page errors, no emoji left on screen, and no dates in "2026-11-03" format.

## Files
Changed: `public/app/polish.js`, `public/index.html`. New: `CHANGES_v131.md`, `DEPLOYMENT_STEPS_v131.md`.
No new packages, settings or database changes.
