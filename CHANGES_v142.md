# Trothen v142: Trothen proposes ride fares by distance, and drivers are listed like any pro

This one package includes everything since the version on your GitHub `main` before v128: v128 to v141, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
- For rides, can the system propose prices per distance (per km)? How would we do it for a country like Liberia?
- How do drivers go live? Can we also make them like pros?

## 1. Trothen proposes the fare
Before, each driver typed their own starting fare and price per km, in US$. The distance was a straight line times 1.3.

Now Trothen works out every fare, the way Bolt, Yango and inDrive do in African cities, and the way the Ministry of Transport sets fares in Liberia:

- **In the country's own money:** L$ in Liberia, shown with the US$ amount beside it, for example "L$205 ($1.08)".
- **Per vehicle:** motorbike, keke, car and van each have their own:
  - starting fare;
  - price per km;
  - price per minute (in Monrovia traffic, time matters as much as distance);
  - lowest fare.
- **Fare = starting fare + km × price per km + minutes × price per minute**, never below the lowest fare. It's rounded to the nearest L$5 so cash is easy.
- **Linked to fuel, like the government's fares:**
  - the team enters the pump price the fares were set at, and today's price;
  - fares only move once the price has changed by more than a threshold (10% by default);
  - they then move by the share of a fare that is fuel (40% by default), not the whole change. For example, fuel up 20% means fares up 8%;
  - drivers are told when fares move.
- **No surge pricing.** It would clash with government fare freezes. The only extra is an optional night extra the team sets, shown up front.
- **Drivers stay close to the fare:** each driver can choose to be up to 20% above or below the Trothen fare, never more. A newer car can charge a little more; a driver who wants more riders can charge a little less.
- **Riders can still bargain, but fairly:** an offer (or counter-offer) can't be below 70% of the fare. Riders can type their offer in L$.
- **What the rider sees:**
  - the trip's distance and time;
  - the Trothen fare for each vehicle;
  - each driver's fare in L$ and US$, marked "10% below" or "10% above" where it differs.

**Where it's set:** Admin → Rides → **Fares**, per country. Only a super admin can change fares; other admins can see them. While editing, the page shows example fares for 2, 5 and 10 km, including the effect of a fuel change, before you save. It also shows what riders actually paid per km in the last 30 days, so you can check the numbers are right.

**A country with no fares set** keeps working as before, with each driver's own rates.

**Real road distance:**
- **How:** set `ROUTING_URL` on Render to an OSRM routing service, which is free and open source and built on OpenStreetMap. Trothen then uses the real road distance and time.
- **Without it,** or if the service doesn't answer within 3 seconds, Trothen estimates: the straight line × 1.3, at typical city speeds (motorbike 24 km/h, car 20, keke and van 18).
- **Note:** OSRM's public demo server is fine for testing but its usage policy doesn't allow live apps. For real use, run your own OSRM (a small server) or use a paid service.

**Short rides under $1 are now allowed:** a L$150 motorbike ride is about $0.80, and the old $1 minimum on fares blocked it. The lowest is now $0.25.

## Are fares automatic, and how does cash work?
**Fares are worked out automatically for every trip** from the distance, time and vehicle. You set the rates once per country, and nothing else is needed per ride. Two numbers stay manual, because there's no reliable live feed for them in Liberia:
- **The pump price:** enter it when the Liberia Petroleum Refining Company or the Ministry of Commerce announces a change. Fares then move by themselves, only if the change passes the threshold.
- **The L$ to US$ exchange rate**, in Admin. A live exchange-rate feed can be connected later (there's a place for it in the code).

**Cash rides:**
- **When cash is allowed:** cash rides work only when cash is switched on for rides (Admin → Rides), the driver says they take cash, and the driver has an active Driver Pass. The pass is paid up front, so Trothen has nothing to collect from a cash ride: no commission, and no Trothen fee for the rider.
- **New: the exact amount in L$.** The rider is told to pay exactly that amount (for example "Pay the driver exactly L$185"), and the driver is told to collect exactly that, no more. Fares are rounded to L$5 so change is easy.
- **Problems:** if a driver asks for more, the rider presses Report a Problem. The team is told at once and can pause the driver. Trothen can't refund cash it never held.

## 2. How drivers go live
Nothing changed here:
1. A pro applies under **Rides** with their licence and vehicle papers.
2. The team approves them.
3. The driver presses **Go online**, which shares their location so riders nearby can see them.
4. They stay online while the page is open, up to 12 hours, and their position refreshes as they move.
5. A ride request comes in. They accept, go to the rider, and start the trip only with the rider's 4-digit PIN.

## 3. Drivers are pros too
A driver is already a pro: the same account, with Rides added. Now they're also **listed like any pro:**
- There's a new kind of work, **Driver for Hire**, under Moving & delivery, for hiring a driver by the trip or by the day.
- When the team approves a driver for rides, they get Driver for Hire on their profile automatically, since their licence and vehicle were just checked. They show in the pro search with their ride fare and a **Get a ride** button, and can be booked per trip or per day (v141).
- Searching for "driver", "keke", "motorbike", "pen-pen", "taxi" or "okada" finds them.
- If their driving is paused, so is that listing.
- Drivers approved before this update get it the first time they go online.
- Someone who only drives can sign up as a pro with **Driver for Hire** as their main kind of work, then apply under Rides.

## What I tested (45 new checks)
- **Fares:**
  - before any fares are set, each driver's own rates apply, as before;
  - only a super admin sets fares; bad numbers are refused;
  - the formula, the rounding to L$5 and the US$ amount are right;
  - a driver at 10% above, and one choosing 10% below (30% refused);
  - fuel up 5% doesn't move fares, fuel up 20% moves them 8%, and drivers are told;
  - the night extra applies only in its hours;
  - an offer at 50% is refused, at 80% it goes to the driver, and the rider can't counter far below the fare either;
  - a stale fare is caught;
  - a booking records the fare in L$, the km, the minutes and how it was worked out, and the driver's request shows L$;
  - Admin sees what riders paid per km.
- **Road distance:** with a routing service, the real road distance (5.2 km) is used; when it's down, the estimate is used.
- **Drivers as pros:** an approved keke driver gets Driver for Hire, shows in the search under it and for "keke", and is paused with their driving.
- **On screen:**
  - the rider's list with fares in L$, above or below, and the lowest offer;
  - a cash ride telling the rider and the driver the exact amount in L$;
  - an offer typed in L$;
  - the driver's fares page with examples, and changing their setting;
  - Admin → Rides → Fares with the fuel preview;
  - a phone screen.
- **Earlier tests, all still passing:** listed in the deployment steps.

## Good to know
- **Business: the starting numbers are yours to set.** As a starting point to check with drivers, I used L$50 to start + L$25 per km + L$2 per minute for motorbikes (lowest L$100), and L$100 + L$40/km + L$3/min for cars (lowest L$200). Set them with a few drivers from each vehicle type, checked against what people pay today.
- **Legal:** the Ministry of Transport's fares are for shared, per-seat routes. A private point-to-point ride is different. Before launch, a lawyer or a meeting with the Ministry should confirm how ride apps are treated, and whether Trothen's fares must stay at or below the official fares where they exist.
- **Exchange rate:** L$ fares are turned into US$ with the rate in Admin (approximate until live rates are connected). Keep it up to date.

## Files
- **New:**
  - `src/ride-fares.js`
  - `src/road-route.js`
- **Changed:**
  - `src/routes/rides.routes.js`
  - `src/routes/marketplace.routes.js`
  - `src/platform-settings.js`
  - `src/admin-permissions.js`
  - `src/sync-reference-data.js`
  - `src/seed.js`
  - `src/category-groups.js`
  - `src/search-synonyms.js`
  - `public/app/rides.js`
  - `public/index.html`

**What's needed:** no new packages or database changes.
- **Optional setting:** `ROUTING_URL` (an OSRM routing service, for real road distances).
- **After deploying:** Admin → Categories & Countries → **Sync Latest Categories & Countries** adds Driver for Hire.
