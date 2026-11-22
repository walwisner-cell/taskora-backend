# Trothen v178: help videos inside the app, recorded from the real screens

v178 goes on top of v177.

## What you asked
"Can you do the videos, with animations." Then: they should be part of the app, so anyone who is stuck can watch them. They must be real videos of the real screens, not slides. When the app changes, the videos must change too and match it exactly. Nothing from administration should be in them: the team's videos go in the Admin section, as a separate set.

## What I built

### 1. Help videos for everyone (13 videos)
Each one is the real Trothen app recorded on a phone screen:
- real taps, real typing, real scrolling;
- a pulsing circle on each tap;
- a short caption for each step ("Tap Rides", "Type where you are going").

For everyone (10):
1. Create your account.
2. Verify your identity.
3. Post a job.
4. Add Mobile Money.
5. Book a ride.
6. Find and buy in the Market.
7. Your cart and checkout.
8. Sell an item.
9. Messages and calls.
10. Your data and your account.

For pros only (3):
11. Add a good to your store.
12. Deliver for stores and the Market.
13. Business tools.

Where people find them:
- **"Help videos"** in the account menu, in the support chat and in the site footer. Visitors who aren't signed in can watch them too.
- **"Watch how it works"** on the screens where people get stuck: Rides, Post a Job, My Store, adding a good, the Market, selling an item, Deliveries, Verification and the cart. One tap plays the right video there and then.

How they play:
- **Every step is written out under each video** ("Read it instead"), for anyone who can't play sound or video. The page works with a keyboard and a screen reader, and closes with Escape.
- **They're light on data.** Each video is under 3 MB, and nothing downloads until someone presses play. Videos stream in parts, so a phone can skip ahead without downloading the whole file.
- **The page is in Spanish too.**

### 2. Videos for the team, only in Admin → Help videos
1. Check a good before it goes on sale.
2. Check a held Market listing.
3. Approve new people.
4. System Check.
5. Ride and delivery fares.

They're recorded on a computer screen, with every step listed beside the video.

How they're protected:
- **Never on the public site.** They're kept in `help-admin/`, outside the public folder.
- **They play through a private link** that works only for a signed-in admin and expires after 30 minutes. A copied link stops working, and it can't be changed to open another file.
- **Each admin sees only the videos for the parts of Admin they can open.** A Disputes admin doesn't see the store or fares videos.
- **No public "Watch how it works" buttons appear inside Admin.**

### 3. The videos always match the app
The videos are made by a script kept in Trothen (`scripts/help-videos/`). It:
- starts its own copy of Trothen on a throw-away demo database (never the real one);
- signs in as demo people in Monrovia;
- does every step for real while recording.

Two commands:
- `npm run help-videos` records all the videos again.
- `npm run help-videos:check` records nothing. It does every step of every video and says which video and which step no longer match the app.

The check now runs with the other tests. If a change to a screen breaks a video, the tests fail and name it, so an out-of-date video can't slip through. `scripts/help-videos/README.md` explains it in plain words.

### 4. Spoken narration
You asked for narration. Every video now speaks each step aloud as the circle shows it ("Tap More at the bottom", "Tap Rides"). The captions stay on screen too, for anyone watching with the sound off.

- **The voice is Piper,** a free text-to-speech program. It runs on the recording computer, so nothing is sent to an outside company.
  - It uses the "LibriTTS" English voice, licensed CC BY 4.0. That allows commercial use with credit. The credit is at the bottom of the Help videos page and in `public/help/CREDITS.txt`.
  - Two other popular Piper voices (Lessac, Ryan) are licensed for research or non-commercial use only, so I did not use them.
- **The narration is re-spoken automatically** when the videos are recorded again, so it always matches the screens.
- **You chose from 8 sample voices** (4 women, 4 men). Until you pick one, the videos use voice 1. Changing it is one setting (`TROTHEN_VOICE_SPEAKER`) and one re-record.
- **Each video waits for the narrator to finish a sentence** before the next tap, so voice and screen stay together.

### 4. Also fixed
- **"Watch how it works" is 44 pixels tall,** like every other button in Trothen. That's the touch size Apple and Google ask for. The phone layout test caught it at 36 pixels, and I recorded the videos again so they show the button as it really is.
- For admins in the Verification and Customer Service departments, **"Market" appeared twice in the Admin menu.** Now it appears once.
- **Videos now play properly on iPhones.** The app's background helper (the service worker) used to handle every download. It now leaves videos to the browser, because iPhones only stream a video when the browser fetches it itself.

## Tests
- `t178` (new):
  - the 13 videos served, streamable and small, with nothing about Admin in them;
  - the Admin videos refused to customers and to people signed out;
  - private links that play, and that are refused when changed, used for another video, or expired;
  - no way to reach other files through them;
  - on an iPhone:
    - a visitor sees the 10 videos for everyone;
    - nothing downloads before play, and a video plays upright;
    - the written steps, Escape to close;
  - "Watch how it works" on the cart plays the cart video;
  - a pro sees all 13, and the button on My Store appears once;
  - Admin has its own "Help videos" with the team videos;
  - no public buttons appear in Admin;
  - a Disputes admin sees only their videos;
  - Spanish.
- The videos check: every step of all 18 videos still matches the app.
- The admin permissions test now lists "Admin → Help videos" as open to every admin (each one still sees only the videos for their parts of Admin).
- Every earlier suite, on the file store and on Postgres.

## Files
**New:**
- `public/app/help-videos.js`
- `public/help/` (13 videos, their pictures and `help-videos.json`)
- `help-admin/` (5 videos, their pictures and `admin-help-videos.json`)
- `src/help-media.js` (the private links)
- `scripts/help-videos/film.js`, `flows.js`, `demo.js`, `narrate.js`, `README.md`
- `public/help/CREDITS.txt` (the credit for the voice)

**Changed:**
- `src/routes/admin.routes.js` (the list of team videos)
- `src/routes/misc.routes.js` (playing them through a private link)
- `src/admin-permissions.js` (every admin may open the list; it shows only their parts)
- `server.js` (how long browsers keep the videos)
- `public/sw.js` (videos left to the browser)
- `public/app/trothen.js` (the menu item; Market once)
- `public/app/es-v152.js` (Spanish)
- `public/index.html`
- `package.json` (the two commands only; no new packages for the server)

No database changes, and nothing new for Render to install. Playwright is needed only on the computer that records the videos.

## What is yours to do (not code)
- **Tell people the videos are there.** Put a line in your welcome message and on social media: "Stuck? Tap Help videos."
- **When you change a screen, record the videos again.** Ask me, or run `npm run help-videos` on a computer with Playwright. The check will remind you.
- **Choose the narrator** from the 8 samples I sent. The voice is a computer voice: clear, but not as natural as a person. A more human voice means a paid service (ElevenLabs, Google or Microsoft, priced per use) or a person reading the captions as a script. That's a cost decision for you, and the same goes for narration in Spanish.
