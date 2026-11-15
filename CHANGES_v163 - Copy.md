# Trothen v163: more gaps found and fixed

What Walter asked: "ok please look through and see if you can fix anyother gaps".

Earlier checks covered booking a pro, the layout, Spanish, dark mode, access between accounts, and things happening at the same moment. Three things people do every day had never been walked through with real taps on a phone:
1. **A store order from start to finish, on two phones.** The buyer adds goods and checks out from the cart. The seller packs the order. The buyer confirms they have it, rates the good, and asks to return one. The seller accepts, the buyer sends it back, and the seller confirms they have it, which refunds the buyer.
2. **A brand-new person signing up,** on the smallest iPhone, then signing out.
3. **Forgetting a password** and setting a new one.

Below is what they found and what I changed.

## What I found, and fixed
### 1. "View cart" didn't show in a store until something else happened
After tapping + on a good, the store's footer should offer **View cart**. It only appeared on the next redraw, because it waited for the server's answer. The count now comes straight from what's been picked, so it's there at once, and the store window refreshes when the server answers.

### 2. A message could sit on top of a pop-up's main button
A message already on screen when a pop-up opened (for example "Thank you for your review", just before opening **Return goods**) stayed at the bottom, over the pop-up's **Ask for the return** button, for several seconds. In v159 I moved messages in front of pop-ups, but only messages that started after the pop-up opened. Now any message moves to the top whenever a pop-up is open.

### 3. The star rating for a good couldn't be used without a mouse or finger
Its stars were marked for screen readers as choices, but didn't respond to Enter, Space or the arrow keys, and didn't say which was chosen. Now they do, as a set of choices should (WCAG).

### 4. Signing up
**A street address was required, but nothing said so.** Pressing **Sign Up** without it only flashed "Enter your address" at the bottom of the screen for a few seconds.

**The street address is now optional,** and the form says so:
- Nothing in Trothen uses the account's street address. Each job has its own place: a landmark or a pin on the map, added in v92 because in much of Liberia there is no street address to type.
- Marketplaces like TaskRabbit and Thumbtack ask only for a town and postcode at sign-up.
- Keeping no personal data that isn't needed is the rule in data-protection law (GDPR's "data minimisation").
- Anyone can still add an address in Settings.
- The server accepts an empty one. One that is typed still has to be 3 to 200 characters.

**A missing or wrong field is now said under the field itself, in red,** as GOV.UK and WCAG 3.3.1 ask:
- The field gets a red border, and screen readers read the message with it.
- The message goes as soon as the person types there.
- Every sign-up check works this way: name, email, password, phone, city, postcode, and a pro's skills. The short message at the bottom still shows too.

**Country and state now tell phones what they are,** so autofill can complete them (WCAG 1.3.5).

### 5. Signing out left things on screen
- The **"Before you book"** agreement window stayed open after signing out, now facing whoever picks up the phone next.
- The signed-out person's **dashboards stayed in the page** (hidden), and the **sign-up form kept their name, phone and home address.** On a shared phone, the next person opening Sign Up would have seen them.

Signing out now:
- closes every window;
- empties the customer's, pro's and admin's dashboards;
- clears the sign-in, sign-up and password-reset forms.

### 6. The "Install the Trothen app" banner covered forms
On a small phone it sat over the password-reset form, hiding the email box and the **Send Reset Link** button, and over the sign-in and sign-up forms. It no longer shows:
- on the sign-in or reset screens;
- while anyone is typing in a box anywhere.

It still offers itself at other times, and **Not now** still works.

### Also
The two new-password boxes on the reset screen now have their labels linked to them in the page itself. (a11y.js already linked them when the page loaded.)

## What the journeys check now
- **The store order (`torder`, 16 checks):** every step above, with no page errors on either phone and nothing wider than the screen.
- **Signing up and resetting (`tsignup`, 18 checks):**
  - Sign In, then creating an account;
  - a missing postcode said under its field, and gone when typed, while the street address is optional;
  - the email code, and the account being made and signed in;
  - signing out with nothing of hers left on screen, in the page or in the forms;
  - Forgot password with no banner in the way, the reset link, and the new password working;
  - the pro's sign-up asking for the kind of work;
  - no page errors.

Both now run with every earlier suite, on the file store and on Postgres.

## Files
- **New:** `CHANGES_v163.md`
- **Changed:**
  - `src/routes/auth.routes.js` (a street address is optional at sign-up, including with Google)
  - `public/app/cart.js` (View cart at once)
  - `public/app/store-plus.js` (the star rating by keyboard and screen reader)
  - `public/app/trothen.js` (sign-up field messages, the street address optional; a clean sign-out)
  - `public/index.html` (messages above pop-ups, no install banner over forms, the field error style, autofill labels; fingerprints refreshed)

No database changes, no new packages.
