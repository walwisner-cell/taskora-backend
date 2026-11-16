# Trothen v168: maps no longer grey

v168 goes on top of v167. If v166 or v167 isn't live yet, this one package deploys them too.

## 1. Grey maps on the live site
**What you saw:** the "Where is the job?" map was an empty grey box, with only the pin, the zoom buttons and "Leaflet | © OpenStreetMap".

**Why:** Trothen installs a small helper in the browser, called a service worker. It is what lets Trothen send notifications when the page is closed. It was set to pass *every* request through itself, including the map pictures, which come from another website (OpenStreetMap, or Mapbox or Google once they're set up).

The site's own security rules allow the helper to connect only to trothenpro.com and Google sign-in. So the browser refused every map picture, quietly, and the map stayed grey. Fonts from Google were refused the same way. This affected every map in Trothen (Rides, Deliveries, job locations, tracking) for anyone who had opened the site before. My tests ran with the helper switched off, so they never saw it.

I proved it on a test server: with the helper running, the helper itself reports "connect-src blocked tile.openstreetmap.org".

**Now:**
- The helper only handles Trothen's own pages and data.
- Map pictures, fonts and anything else from another site go straight from the page, as if the helper wasn't there.
- With the helper running, all 8 map pictures in the test load.

**After you deploy:** open the site and press **Ctrl+F5** once on each computer. On a phone, close the tab and open it again. The browser picks up the new helper by itself within a visit or two.

## 2. The map window says what it's for
**What you saw:** the window opened from Rides still said "Where is the job?".

**Now it says:**
- "Where should the driver pick you up?" for the pick-up;
- "Where are you going?" for the destination;
- "Where are you now?" when a driver goes online from the map;
- "Where is this place?" when pinning a place in Admin;
- "Where is the job?" for jobs, as before.

All of these are in Spanish too.

## Tests
- **`tsw` (new):** the helper running, as on the live site; all 8 map pictures in the map window load.
- **Run again:**
  - tmaps (49 checks)
  - t148 (38)
  - tsignup (18)
  - tfares (45)
  - tproui (9)
  - tpin (4)

## Files
- `public/sw.js`
- `public/app/trothen.js`
- `public/app/es-v152.js`
- `public/index.html`

No database changes and no new packages.
