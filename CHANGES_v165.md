# Trothen v165: drivers can go online again, sign-in with Google, and more gaps fixed

What Walter asked:
- "ok reverify and fix any gaps left"
- With two screenshots: signing in showed "can't access property "name", data.user is undefined", and on the Rides page, "is not coming online" / "not working".

## 1. Drivers could not see themselves online (my mistake in v164)
**What happened:** pressing **Go online** did put the driver online on the server, but the Rides page went on saying "You are offline" with a **Go online** button. So it looked as if nothing worked, and there was no way to go offline from the page.

**Why:** in v164, when I added the delivery distance to the driver's details, I put a code comment in the middle of a line. A comment runs to the end of its line, so everything after it was switched off, including the part that tells the page "you are online". My tests checked the online state on the server, not on the driver's screen, so they missed it.

**Fixed.** I also checked every other line I changed in v164 and v165 for the same mistake. This was the only one.

A new test now checks the driver's screen: after **Go online**, the page says "You are online" and the button becomes **Go offline**, and **Go offline** works.

## 2. "Go online" now says what it is doing, and why it can't
On a laptop, finding your location can take several seconds, and a blocked location only flashed a short message. Now:
- **The button says what it is doing:** "Finding your location…", then "Going online…". Once you are online: "You are online. Riders nearby can find you."
- **If it can't go online, the reason stays on the page with what to do:**
  - **Location blocked in the browser:** click the lock icon next to trothenpro.com, set Location to Allow, and press Go online again.
  - **No location found** (common on laptops): turn on Location services in Windows (Settings → Privacy & security → Location) or on a Mac. Better still, drive with Trothen on your phone, which has GPS.
  - **Any other reason from the server** (for example the night pause below) shows there too.
- **The "Before you go online" window carries on by itself.** When it asks you to turn on notifications and you do, it now goes online straight away. Before, the button just changed to "Done" and the window stayed open, so going online looked broken.

## 3. The motorbike night pause uses the driver's own time
If the team switches on "no motorbike rides at night", the hours were checked in UTC. That is right in Liberia, but in Nigeria it was an hour off, and in Kenya three hours off. Now the hours are the driver's (and rider's) local time.

The message now gives the hours, for example: "Motorbike rides are paused from 20:00 to 06:00 (your local time). You can go online again after that."

## 4. Signing in with Google (your first screenshot)
Every admin account uses a sign-in code (two-step sign-in). When an admin used the **Sign in as Walter** Google button, the server correctly answered "a code is needed", but the page treated that answer as a finished sign-in and showed "data.user is undefined".

Now the Google button shows the code step, exactly as signing in with email and password does. Email-and-password sign-in was not affected.

## 5. More gaps found in this pass, and fixed
### The Market, for visitors
The Market was only inside the signed-in dashboards, so a visitor could not look at it at all. Marketplaces like Jiji, Jumia and Facebook Marketplace let anyone look and only ask you to sign in to buy or sell. Now:
- **Market** is in the top bar for visitors (and in the phone menu).
- **It opens a Market page anyone can browse:** search, categories, a country choice (only countries with goods for sale), and sort.
- **Add to cart works** for a visitor. Buying a person's listing asks them to sign in.
- **A signed-in customer or pro** pressing it goes to the Market in their own dashboard.
- **The empty cart's button is now "Browse the Market"** for everyone.

### Stopping a seller
- **A stop for a set time now ends by itself.** Before, when 7 or 30 days were over, the seller's listings stayed hidden and their store stayed shut until someone pressed "Allow selling again". Now the regular Market check lifts it: listings go back on sale, the store opens again if it was open before, and the seller is told.
- **Lifting a stop puts the store back as it was.** If it was open, it opens again; the seller no longer has to switch it back on.
- **Nothing can undo a stop through the back door.** While a seller is stopped:
  - reopening their store under Stores & Skills is refused, with a message saying where to lift the stop;
  - putting one of their listings back on sale is refused;
  - nobody can buy from them.
- **The "Stop selling" and "Take it down" buttons are red,** as for other serious actions, and the seller row says "1 listing on sale", not "1 listings".
- **Admins are now pointed to Admin → Market → To check** for held or reported listings, instead of Stores & Skills.

## 6. What the tests check now
- **`tonline` (14 checks, new):**
  - location blocked, with the reason on the page;
  - going online, and the page showing it;
  - going offline;
  - the night pause in local time (Liberia paused, the same hours in Kenya not);
  - the Google button showing the code step.
- **`t165` (24 checks, new):**
  - a timed stop ending by itself, with the store open again;
  - the three refusals while a stop lasts;
  - an admin stopping and allowing a seller by tapping;
  - the visitor's Market on a phone: country, category, Add to cart, and buying asking to sign in;
  - a signed-in customer taken to their own Market.
- **Every earlier suite**, on the file store and on Postgres.

## Files
- **Changed (server):**
  - `src/routes/rides.routes.js`
  - `src/market.js`
  - `src/routes/market-admin.routes.js`
  - `src/routes/market.routes.js`
  - `src/routes/store.routes.js`
- **Changed (page):**
  - `public/index.html`
  - `public/app/trothen.js`
  - `public/app/rides.js`
  - `public/app/checks.js`
  - `public/app/market.js`
  - `public/app/market-admin.js`
  - `public/app/cart.js`
- **New:** `CHANGES_v165.md`

No database changes, no new packages.
