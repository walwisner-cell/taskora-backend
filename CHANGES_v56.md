# Trothen v56: getting ready for real people

## What I found when I looked deeper
- **My only super admin was the demo account.** That's superadmin@trothen.io, and its password (trothen123) is written in the app's code on GitHub. There was no way anywhere in the app to create a real super admin.
- **Every ID document people uploaded was erased on each deploy.** The setting that puts them on the permanent disk (PRIVATE_UPLOADS_DIR) was never set.
- **The demo people were still in the live database.** The "clean everything" tool I ran before deliberately skips demo accounts and anything with a booking. So the 17 demo accounts (fake pros, customers and admins), with their fake bookings, reviews, payouts and disputes, were all still there. The demo admins could be signed into with the published password.
- **All 197 countries were marked "live."** The homepage said Trothen operates in every country on earth, and anyone anywhere could sign up.
- **Made-up data was built into the screens:**
  - If a real customer's bookings failed to load once, they saw fake bookings under "Jordan Diaz." Providers had the same problem with fake contracts and payouts.
  - A Verification-team admin saw fake disputes, 1,243 fake users and $12,400 of fake escrow.
  - Dashboards said "Verified ✓" before checking.
  - The demo passwords were sent to every visitor's browser.
- **`npm run seed` on the live server** would have wiped every real account.
- **A brand-new empty server** would have created all the demo accounts again, with the published password.

## What I fixed
- **New Go-Live screen** (Admin → Go-Live, super admin only):
  - A live readiness checklist, read from the running server.
  - **Step 1:** create my real super admin. The password I type is temporary; I must set my own at first sign-in, and two-factor is on from the start.
  - **Step 2:** remove all demo data. This removes every demo account and everything attached to them. Real accounts are never touched. It needs the typed phrase "REMOVE ALL DEMO DATA" and refuses to run while I'm signed in as the demo admin, so I can't lock myself out.
  - **Step 3:** choose exactly which countries are live. Nothing is deleted.
  - A permanent history of all three steps.
- **Anyone signing in with trothen123 on the live server** must change their password first. That password can never be chosen again.
- **A brand-new empty live server** creates no demo people. It sets only my four countries live, and can create my first super admin from two Render settings.
- **`npm run seed` refuses to run** on the live server.
- **render.yaml** now puts ID documents on the permanent disk and lists the SendGrid, Google and APP_URL settings.
- **All made-up providers, bookings, payouts, reviews, notifications and admin numbers are gone.** Empty now means empty, and a loading failure says "please refresh" instead of showing fake data. No provider is assumed to be in Atlanta anymore.
- **New countries added by the reference-list sync** now start as "planned," not "live."

## Tested
- A full go-live rehearsal on a copy running in production mode, with demo data present. I started from the demo admin: forced password change, created a real super admin, a real provider signed up, then I removed the demo data by clicking through the screen.
- Afterward: only real accounts remained, no leftover records pointed at removed accounts, categories and countries were kept, and the demo admin can no longer sign in.
- A brand-new server, a restart, the seed guard, and local development all behave correctly.
- Step 3 by clicking: signup and the homepage then showed only the chosen countries.
- All of last round's browser tests still pass, and there are 0 dependency vulnerabilities.
