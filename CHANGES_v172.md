# Trothen v172: finding the rider where map apps are not exact

v172 goes on top of v171, and this package includes v171 (the ride maps, and private calls and texts). If v166 to v171 aren't live yet, this one package deploys them too.

## What you asked
"Google Maps are not working to give accuracy." Then: "Yes, implement all this to be perfect."

## The honest part first
I can't fix Google's map of Monrovia. Google has few street names there, and some roads are missing or in the wrong place. No app can change that from the outside.

What Trothen can do is rely on Google less. The rider's exact GPS pin is the truth, and Trothen now gets the driver to it in four ways that don't need a good map.

## What I added

### 1. The driver's own guide to the exact pin
Above the driver's map there is now a guide box, worked out from the driver's own GPS. It doesn't use Google, so it works where Google doesn't know the roads.
- **How far:** "0.3 mi to the pick-up", or "350 m" (in the units each country uses), updating as the driver moves.
- **Which way:** a blue arrow pointing to the pin.
  - While driving, the arrow turns with the driver: "ahead on your right", "behind you".
  - Standing still, it points by the compass, matching the map ("to the south-west").
- **When they're there:** it turns green: "You are at the pick-up. Press 'I have arrived' so the rider knows, then look for them." It also shows the rider's note ("blue gate").
- After pick-up, the same guide leads to the destination, and says "You are at the destination."
- If the driver's own GPS is rough, it says so: "Your GPS is rough (about 120 m)."

### 2. More map apps on "Navigate"
Besides Google Maps and Waze (and Apple Maps on iPhone), Navigate now offers:
- **Other map app (OsmAnd, Organic Maps…)** on Android. It opens whichever map app the driver has.
- **Organic Maps** on iPhone.
- **OpenStreetMap (in the browser)** on any phone, with nothing to install.

These apps use OpenStreetMap, which volunteers mapped in detail in Monrovia, so it often has roads Google lacks. OsmAnd and Organic Maps are free and work offline. A line in the window tells drivers to try them where Google isn't exact.

### 3. A photo of the pick-up spot
- The rider can press **"📷 Add a photo of where you are"** on the "Where to meet your driver" card and take a photo of the gate, shop or sign.
- The driver sees it on their trip card and can tap it to see it bigger. They also get a notification.
- **Privacy:**
  - only the rider and that driver can open the photo, and only while the ride is open;
  - it's deleted, file and all, when the ride ends;
  - it's stored in the private folder (encrypted when your encryption key is set) and never cached;
  - before sending, the phone redraws the photo, which removes the hidden location and camera details (EXIF) and makes it small enough for a weak connection;
  - the server checks it really is a photo.

### 4. "Meet me where I am now"
If the rider's pin is wrong, or she walks to a better spot, she presses **"📍 Meet me where I am now"**.
- The meeting point moves to her phone's GPS. The driver is told at once, and their map and guide go to the new spot.
- **Limits, so it can't be abused:**
  - only while the driver is on the way, and only by the rider;
  - up to 500 m from where she booked, so the fare stays right;
  - only with an exact GPS fix (within 150 m). A rough fix would make things worse, so it asks her to step outside;
  - 3 moves at most per ride.
- The fare doesn't change.

### 5. Rough pins are caught before booking
- Phones indoors, and laptops, can be 100 m to several km off. If the rider's pick-up pin is rougher than 100 m, pressing "Find drivers near me" now warns her before booking: "Your pick-up pin may be up to 400 m from where you really are…". She can press **"Check the pin on the map"**, which opens the map to put the pin on the right spot, or **"Find drivers anyway"**.
- The pin's accuracy is now saved with the ride:
  - the driver sees "The rider's pin may be up to 180 m off. Look around the spot, or send a message", and a light blue circle on the map shows the area;
  - the rider sees "Your pin may be up to 180 m off. Step outside and press 'Meet me where I am now', or add a photo."

### Spanish
Everything new has Spanish, including the directions ("delante, a tu derecha", "al suroeste").

## Tests
- **`t172` (new), 42 checks:**
  - the accuracy saved with the pin;
  - the photo: only real photos, the driver can't add one, only the two of them can open it, encrypted, a new one replaces the old one, deleted when the ride ends;
  - the move: only the rider, not with rough GPS, not beyond 500 m, measured from where she booked, 3 at most, the driver told, the fare unchanged;
  - in the browser, on two phones:
    - the driver's distance and arrow, the warning, the photo on the trip card, and "You are at the pick-up" when he drives up;
    - the new map apps on Navigate;
    - the rider pressing "Meet me where I am now" and adding a photo from her phone;
    - a rough pin caught before booking, and "Check the pin on the map" opening the map.
- **`tride`** (a whole ride on two phones, with location on and blocked), **`tcomm`** (calls and texts), and the Spanish check pass.
- **Every earlier suite**, on the file store and on Postgres.

## Files
- `src/routes/rides.routes.js` (the pin's accuracy; the photo; moving the meeting point)
- `public/app/rides.js` (the driver's guide; the photo; "Meet me where I am now"; the rough-pin check)
- `public/app/maps.js` (more map apps on Navigate)
- `public/app/trothen.js` (a confirmation window can now name its second button)
- `public/app/es-v152.js` (Spanish)
- `public/index.html`

No database changes and no new packages. Photos go in a `ride-photos` folder inside your private uploads folder, which is created by itself.

## What is yours to do (not code)
- **Tell drivers** about OsmAnd or Organic Maps (free, in the Play Store and App Store). Suggest they download the Liberia map in the app once, on Wi-Fi, so it works without data.
- **Make OpenStreetMap better in Monrovia.** Anyone can add a missing road or place at openstreetmap.org, and Trothen's own map uses the same data. A morning with a few people from the team would make every map better for your drivers. The Humanitarian OpenStreetMap Team (hotosm.org) also runs mapping days in West Africa.
- **Pin the well-known places** in Admin → Rides → Places, as before. Riders who search "ELWA Junction" then get an exact pin, not a rough GPS one.
- **Privacy policy:** add that a rider may share a photo of the pick-up spot with their driver, and that it's deleted when the ride ends. A lawyer should check the wording.
- **On your iPhone:** allow location for Safari (Settings → Privacy & Security → Location Services → Safari Websites → While Using the App). Without it, neither the guide nor "Meet me where I am now" can work.
