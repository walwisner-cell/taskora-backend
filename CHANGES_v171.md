# Trothen v171: maps on the ride screens, and private calls and texts

v171 goes on top of v170. If v166 to v170 aren't live yet, this one package deploys them too.

## What you asked
- "Am not seeing the map" (the driver's Trip in progress screen).
- "The customer was not seeing the map to see the driver coming, and the location was not showing on how you meet the person."
- "Please fix how the call to the driver is done in the app, and the text messages. Use best practice and international standards. Fix all the gaps."

## What was wrong
1. **The driver's trip screen had no map.** It showed only "Pickup → Destination" in words. If the pick-up had no street name, it said just "Pickup".
2. **The rider had no map on her own page.** The map was hidden behind a button. There was also no clear "where to meet" card.
3. **The rider's map was wiped every few seconds.** Every live update redrew the whole Rides page, so the map started again from nothing. I found this while testing the new map.
4. **The driver's position was slow to appear.** The driver's phone sent its first position only after its next regular check, up to a minute later. If the driver's phone blocked location, the rider saw nothing at all.
5. **Calling and texting used everyone's real phone number.** "Call" and "SMS" opened the phone's own dialer with the other person's number, so both saw each other's number. Ride apps don't do that, because it puts riders (above all women riding alone) and drivers at risk after the ride. There were also no quick messages, and nothing for someone with no data.

## What I changed

### The driver's screen
- **A map on the trip card**, before pick-up and during the trip. It shows:
  - the pick-up (a blue dot) and the destination (a black square);
  - the driver's own vehicle, moving as they drive;
  - the road between them.
- **The pick-up and destination in words**: the place name, street, area and the rider's note. "Pickup" on its own is replaced with the real address.
- **One big button: "Navigate to the pick-up"**, then "Navigate to the destination" after the trip starts. It opens Google Maps or Apple Maps with directions.
- **If the phone blocks location**, the map still shows the last known position and says plainly that location is blocked and asks the driver to allow it.

### The rider's screen
- **A live map right on her page** (no button to press). It shows:
  - her driver's vehicle moving towards her, then towards the destination;
  - the road;
  - "About 4 min away" or "About 12 min to your destination", and the distance.
- **"Where to meet your driver"**: the pick-up in words, with her note for the driver. When the driver arrives, the card turns green: "Your driver has arrived and is waiting for you here. Check the plate before you get in, then give the driver your PIN."
- **The map stays put.** The page is no longer redrawn from scratch by live updates. The map moves by itself every 6 seconds, and the page doesn't jump while she reads.
- **If the driver's phone isn't sending its position**, she sees where the driver last was, with honest words: "This is where they were 3 min ago." She is never shown an old position as if it were live.
- "Full screen map" is still there for a bigger view.

### The driver's position appears at once
- The driver's phone sends its position the moment the trip screen opens and as soon as it gets a location fix, not up to a minute later.

### Calls and texts, done the way ride apps do it
Phone numbers stay private on both sides, which is the standard at Uber, Bolt and Lyft. It also follows privacy law (GDPR "data minimisation", and Liberia's and Ghana's data-protection rules).

1. **📞 Call (in the app).** Rings the other person inside Trothen over the internet. It's free over data, and neither of you sees the other's number. This is now the main button.
2. **💬 Message.** Opens the chat with that person.
3. **Quick messages, one tap:**
   - rider: "I'm at the pick-up point.", "I'm coming out now.", "Please wait 2 minutes.", "Where are you now?";
   - driver: "I'm on my way.", "I have arrived.", "I can't find you. Where exactly are you?", "I'm running a few minutes late."
4. **☎️ Phone call via Trothen**, for weak data. Trothen rings your own phone, and when you answer you are connected to the other person. Both of you see only Trothen's number, never each other's. This is called "number masking". It is set up so that:
   - it only works while the ride is under way, and stops when the ride ends;
   - each person can make at most 6 calls per ride, so it can't be abused or run up costs;
   - a call is cut off after 20 minutes;
   - each call is recorded with the ride (who, when), but there is no recording of what was said.
   - It shows only once you've set up Twilio (see below).
5. **Texts when someone isn't on the app.** If you send a message during a ride and the other person isn't on Trothen at that moment, they also get it as a text from Trothen's number: `Trothen ride #391487: your driver Emeka says "I have arrived." Reply in the Trothen app, not by text.`
   - At most one text every 3 minutes per person, to keep costs down and avoid flooding.
   - Only during the ride, only between the two people on it.
   - It works only once Twilio is set up; until then, messages stay in the app as before.
6. **The old way is still there, but tucked away.** "Other ways (shares your phone number)" opens your own phone call, SMS and WhatsApp. It says plainly that these show your number. They're for when nothing else works.
7. **After the ride ends**, the contact buttons disappear, as before.

### Spanish
All the new words have Spanish. The text message sent by Trothen's number is in English for now, like the server's other messages.

## Tests
- **`tcomm` (new):**
  - contact details carry the person and whether masked calls are on;
  - the last-known position is shown, marked as approximate;
  - a masked call: the instructions sent to Twilio connect the two people, both see only Trothen's number, with a time limit;
  - the 6-call limit;
  - texts sent when someone isn't on the app, and the 3-minute limit;
  - no calls once the ride is over;
  - no contact details after the ride.
  - All 8 pass.
- **`tride` (extended),** a full ride on two phones, in the browser:
  - the driver's map before pick-up and during the trip;
  - the rider's live map, "Where to meet", "minutes away";
  - the map not being wiped while she reads;
  - the call and message buttons, and a quick message arriving.
  - It runs twice: once with the driver's location on (23 checks) and once with it blocked (24 checks).
- **Every earlier suite**, on the file store and on Postgres.

## Files
- `src/routes/rides.routes.js` (the driver's last position, private contact details, masked phone call)
- `src/routes/misc.routes.js` (texts when someone isn't on the app)
- `src/delivery.js` (one setting, used only by the tests)
- `public/app/rides.js` (the driver's map, the rider's map and "Where to meet", calls and messages)
- `public/app/live.js` (live updates no longer redraw the Rides page)
- `public/app/es-v152.js` (Spanish)
- `public/index.html`

No database changes and no new packages.

## What is yours to do (not code)
### On your own iPhone, right now
Your screenshot showed "location blocked". On the iPhone: **Settings → Privacy & Security → Location Services → Safari Websites → While Using the App**, then reload trothenpro.com. If you added Trothen to your home screen, also check **Settings → Safari → Location**. Drivers will need to do the same.

### Twilio, for masked calls and texts (optional, but recommended)
Without it, in-app calls, messages and quick messages all work. You only lose the "Phone call via Trothen" button and the texts to people who aren't on the app.
1. Open an account at twilio.com, registered to Trothen Tech Group as a business.
2. **Buy a phone number with Voice and SMS.**
   - Twilio may not sell Liberian (+231) numbers. A US number works for calls to Liberia, but costs more per minute, and some people don't answer foreign numbers.
   - Ask Twilio about a local number or a "Sender ID" (texts showing "Trothen" instead of a number), which Liberia allows after registration.
3. **Console → Voice → Settings → Geo permissions:** tick Liberia (and any other country you serve). Do the same under **Messaging → Settings → Geo permissions**. Without this, calls and texts to Liberia are blocked.
4. **On Render → Environment**, add:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER` (the number, written as +1…).
5. **Costs:** check Twilio's current price list for Liberia before going live. Calls to Liberian mobiles are much dearer than texts. Each masked call is two legs (Trothen to the caller, then Trothen to the other person), so it costs about twice a normal call per minute. The 6-calls-per-ride and 20-minute limits cap this. Set a spending alert in the Twilio console.
6. **Your Privacy Policy** should say that calls and texts in a ride go through Trothen and a provider (Twilio), and that phone numbers are kept private. A lawyer should check the wording.

### The rest, as before
Maps (Google key or Mapbox), pinning the main places, the L$ fares with Joseph, membership prices, guarantor clean-up, your accountant on GST/VAT, and a lawyer on the Ride Rules.
