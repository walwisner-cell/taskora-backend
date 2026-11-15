# Trothen v145: drivers can accept rides whatever their main trade, and licences follow the work

This one package includes everything since the version on your GitHub `main` before v128: v128 to v144, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
- I couldn't see the Rides section.
- Give me all the files.

## Why Rides didn't show (no code change needed)
Rides has been in the app since v110. The Rides menu only shows for accounts whose country is on the list in **Admin → Rides → Countries where rides are on**. That list is **Liberia** by default, so a US account doesn't see it.
- **As super admin:** Admin → Rides is always in my menu.
- **To see the rider or driver side:** I sign in with a test account whose country is Liberia.
- **What not to do on the live site:** add "United States" to the list. Every US user would then see Rides.

## What I found walking through Rides, and fixed

### 1. A driver whose main trade is licensed couldn't accept a ride
- **The problem:** a plumber who also drives a motorbike was refused with "Plumbing requires a current, verified license on file". The app checked the licence for the pro's **main trade**, not for the work in front of them. Every plumber, electrician, roofer and other licensed pro who also drives was blocked from rides.
- **Now:** the licence check follows the work being done.
  - **Rides, deliveries and store orders** need no trade licence. The driving licence and papers are checked when the team approves the driver.
  - **A plumbing or electrical job** still needs the licence.

### 2. The opposite gap
- **The problem:** a pro whose main trade is unlicensed (cleaning, say) could take an **electrical** job through an extra skill, because the check only looked at "cleaning".
- **Now:** a job in a licensed trade needs a current licence on file, whoever takes it.

### 3. Admin → Rides → Example fares
The amounts ran together ("LRD 200LRD 350"). Each amount is now in its own column, as L$110 · L$200 · L$350.

## What I tested (7 new checks)
- **Rides:** a motorbike driver whose main trade is plumbing, with no plumbing licence, accepts a ride. Before this fix, he was refused.
- **Licensed jobs:**
  - the same driver still can't take a plumbing job without the licence;
  - a cleaner with an Electrical extra skill and no licence can't take an electrical job (before, she could);
  - the same cleaner can take a cleaning job.
- **On screen:** Admin → Rides → Example fares shows L$110, L$200 and L$350, each in its own column.
- **Earlier tests:** all still pass, including v144's Post a Job (listed in the deployment steps).

## Good to know
- **Business:** one licence date is kept per pro, for their main trade. A pro licensed as a plumber who also takes electrical jobs passes the check on that one date. If you want a separate licence per licensed skill, that's a bigger change (an upload and an expiry per skill, checked by the team). Tell me if you want it.
- **Legal (attorney):** which trades need a licence differs by country. The list (Plumbing, Electrical, Roofing, HVAC, General Contracting, Legal Consulting and the others in the code) follows US practice. Check it for Liberia.

## Files
- **Changed:**
  - `src/routes/marketplace.routes.js`
  - `public/app/rides.js`
  - `public/index.html`

**What's needed:** no new packages, database changes or settings.
