# Trothen v146: calls stop getting stuck, Admin → Call health, and a Rides switch for each country

This one package includes everything since the version on your GitHub `main` before v128: v128 to v145, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
- Calls were working fine, but now they aren't, and I don't know why.
- Can Rides (the rider and driver side) be available in the countries that are active, with a switch to turn it on or off for each country?

## Calls

### The bug I found: one dropped call blocked calls for up to 4 hours
- **What happened:** when a call ends normally, the phone tells the server. But if a phone lost signal, its battery died, or Trothen was swiped away mid-call, it couldn't say goodbye. The server kept the call as "in progress" **for up to 4 hours**.
- **Why calls then failed:** for that whole time, both people got "You are already in a call", and anyone calling them got "… is on another call". So calls worked, then stopped for hours, with no clear reason. This is the most likely cause of what I saw.
- **Now:**
  - during a call, each phone tells the server every 15 seconds that it's still there;
  - if one side goes quiet for 90 seconds, the server ends the call and tells the other person;
  - a quiet call never counts as "busy".
- **Pages still running the older app** keep the old rule until they're reloaded, so nobody is cut off by the update itself.

### Two other reasons a call can fail (settings, not code)
1. **No relay (TURN) server.** Without one, calls connect on some networks but fail on others, often mobile data (MTN, Orange, Lonestar) and some Wi-Fi. The call is answered, but there's no sound and it ends with "could not connect". **To fix it,** add `TURN_API_URL` on Render. Metered's free Open Relay gives 20 GB a month.
2. **No phone push.** A web app can only ring while Trothen is open on the other person's phone. If it's closed, they only see a notification the next time they open Trothen. **To fix it,** add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on Render (Admin → Go-Live explains how). A closed Trothen then still gets a notification on the phone.

### New: Admin → Call health (super admin)
- **Set-up:** whether the relay server and phone push are set.
- **What to fix,** in order, based on what actually happened this week. For example: "1 call this week was answered but the sound never connected: add TURN_API_URL".
- **The last 7 days:** talked, didn't ring (Trothen not open), answered but the sound never connected, cut off, rang with no answer, declined, caller hung up first.
- **The last 50 calls:** who called whom, when, and what happened in plain words. Calls are never recorded; only times and outcomes are kept.

So next time a call fails, I can look in Call health and see why.

## Rides: a switch for each country
- **Admin → Rides → Rides by country** now has an **On/Off switch per country**, in place of the box where I typed country names.
  - **Each row shows** the country's drivers (approved, waiting, online now) and whether Trothen fares are set there.
  - **When it takes effect:** straight away, and every switch is written in Access Logs.
  - **Switching off:** stops new ride requests in that country; rides already under way finish normally. If drivers are online there, it asks first.
- **Only live countries can be switched on** (Admin → Categories & Countries). A country that isn't live on Trothen can't have Rides.
- **Many live countries:** the countries that matter (Rides on, or drivers there) get a row. Any other live country can be switched on from **Switch Rides on in another live country**.
- **Liberia stays on** as it is. Other countries start **off** until I switch them on. That's on purpose: before switching on a country, check its transport rules (which papers drivers need, whether motorbike taxis are allowed) and set its fares.

## Also
The Call health page has its own phone icon in the Admin menu.

## What I tested (31 new checks)
- **Rides by country:**
  - every live country is listed, with Liberia on and the others off;
  - switching Nigeria on gives a Nigerian customer Rides at once, and switching it off takes it away again;
  - a country that isn't live can't be switched on;
  - only a super admin can switch;
  - each switch is logged.
- **Rides on screen:** with 196 live countries, only the ones that matter get a row. Ghana is switched on from the picker, then gets its own row and switch; ticking it off works too.
- **Calls:**
  - a quiet call no longer blocks a new one (before, "already in a call" for 4 hours) and is closed by itself as "cut off";
  - a call from a page on the older app still counts, so nobody is cut off by the update;
  - only the two people on a call can send its heartbeat;
  - a call records whether it rang.
- **A real call between two pages:** both send the heartbeat, and it records that it rang and connected. When one page disappears without hanging up (like a phone losing signal), the server ends the call and the other person's screen is told.
- **Call health:** only a super admin can open it. It shows the week's totals, each call in plain words, and the fixes (relay first, then push).
- **Earlier tests:** all still pass (listed in the deployment steps).

## Good to know
- **Business:** whether to switch Rides on in Nigeria, Ghana or the US is your call, after checking each country's transport rules with someone local. For Liberia, nothing changes.
- **Render settings to add for calls:** `TURN_API_URL` (relay), plus `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (push). After deploying, Admin → Call health shows whether they're working.

## Files
- **New:** `public/app/callhealth.js`
- **Changed:**
  - `src/routes/calls.routes.js`
  - `src/routes/rides.routes.js`
  - `public/app/calls.js`
  - `public/app/rides.js`
  - `public/app/polish.js`
  - `public/index.html`

**What's needed:** no new packages or database changes. The settings above are recommended.
