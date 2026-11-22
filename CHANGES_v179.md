# Trothen v179: help videos with a natural voice, much more detail, and a laptop version of each

v179 goes on top of v178.

## What you asked
- "The narration looks too much like AI." I sent six samples of a newer voice, and you chose **A**: a warm American woman's voice.
- "Let the videos be extended and very much in detail, so the user understands."
- "What if a person is using a laptop?"
- "Can you do videos for everything?"
- "When describing an item, mention the full words, or abbreviate if that is the standard."

## What I changed

### 1. A new narrator voice
- **The voice is now Kokoro,** a newer free text-to-speech model. Its "Heart" voice sounds much closer to a real person than the old one (Piper).
- It still runs on the recording computer, so nothing is sent to an outside company and there is nothing to pay.
- **The pace is a little slower than the voice's natural speed,** with a short breath between sentences. Each sentence is read as a whole, so the voice keeps its natural rise and fall.

### 2. Longer, more detailed videos
Every video was rewritten. Each one now:
- **says at the start what you will do,** and what you need ready (for example your ID, or a phone camera);
- **explains every box and button** on the screen, not just the ones tapped;
- **says what happens next** after each step (who is told, how long it takes, what you see);
- **gives the safety points:** never pay outside Trothen, give your ride PIN only when the plate matches, report a problem, and so on.

For example, "Post a job" now goes through all four steps of the form:
1. what you need, the photos and the materials;
2. when and where;
3. the price and how you pay;
4. the final check.

### 3. A laptop version of every video for people
- **Each of the 13 videos for people is now recorded twice:** on a phone, and on a laptop.
  - On a phone, Trothen's menu is at the bottom.
  - On a laptop, it is on the left.
  - So the two look different, and each person now sees their own screen.
- **The app chooses by itself.** A screen wider than 760 pixels, where Trothen shows its menu on the left, gets the laptop version. A phone gets the phone version.
- **The words follow the device.** On a laptop the captions and the narration say "Click", and on a phone they say "Tap".
- **Phones never download the laptop videos,** and laptops never download the phone ones.
- The 5 team videos in Admin are recorded on a computer, as before.

### 4. The Help videos page
- **The videos are grouped by topic:** Getting started, Customers, Rides, Market, and Pros.
- **There is a search box.** It searches the titles and every word said in the videos. For example, "mobile money" finds the payments video. If nothing matches, it says so and points to the support chat.

### 5. Units and short forms said in full
- **On screen, units keep their international symbols,** written the way the SI standard (ISO 80000) writes them: a number, a space, then the symbol. For example 256 GB, 650 W, 50 kg and 12 km.
- **The narrator always says them in full,** for example "256 gigabytes", "650 watts" and "a 50-kilogram bag".
  - When a unit comes before a noun, it is said in the singular, the way people speak: "a 50-kilogram bag", "a 2-metre pipe".
  - The same applies to currencies and percentages: "Liberian dollars", "US dollars", "25 percent".
  - Short forms like "e.g." become "for example", and "&" becomes "and".
- **Standard abbreviations are kept.** These are the ones everyone uses as words: PIN, ID, SIM, PDF, 4G, Mobile Money.
- **Informal short forms are gone.** "10am" is now "10:00 in the morning", and the demo goods are written out properly ("1-year warranty", "hand wash in cold water").

### 6. Credit and licence
- **Kokoro and its voices are licensed Apache 2.0,** which allows commercial use.
- The credit line under the Help videos now reads "Narration voice: Kokoro (Apache 2.0)", in English and Spanish.
- `public/help/CREDITS.txt` credits Kokoro, and the kokoro-onnx project (MIT licence) that the model files come from.

### 7. Recording safely
- **If an earlier recording was stopped and left its demo copy of Trothen running,** the recorder now says so and does not start. Before, it could record the old copy.
- **When a recording is stopped,** its demo copy of Trothen now stops with it.

## What is business, not code
- **It is still a computer voice,** just a much better one. If you later want a real person, or a local Liberian voice, that needs a voice artist and a contract that allows use in the app. The recording script can then be changed to use their recordings.
- **Video storage.** With the laptop versions, the videos now add up to about 59 MB, and the next batches will add more. Every re-recording adds that much again to the GitHub history. Before the next batch, please decide whether to keep them in cloud storage instead, for example Cloudflare R2 (free up to 10 GB) or Amazon S3. That needs an account on your side, and then one setting in the code.

## Still to come
- **v180:** the rest of the videos for people, so every part of the app has one. That covers sign-in and two-step sign-in, finding and comparing pros, quotes, bookings, reviews, favourites, receipts, store orders, and, for pros, job matches, contracts, earnings and payouts, tokens, portfolio and driving.
- **v181:** a video for every part of Admin.

## Files changed
- `scripts/help-videos/narrate.js`: the new voice; units and short forms said in full
- `scripts/help-videos/flows.js`: every video rewritten in more detail; one way of opening each part that works on a phone and on a laptop
- `scripts/help-videos/film.js`: records the phone and laptop versions; "Click" on a laptop; the safety checks for a stopped recording
- `scripts/help-videos/demo.js`: the demo goods written out properly
- `scripts/help-videos/README.md`: how to install and choose the voice
- `public/help/`: the 13 phone videos, the 13 new laptop videos, their cover pictures, the list and the credits
- `help-admin/`: the 5 team videos, re-recorded
- `public/app/help-videos.js`: plays the right version for the screen; topics and search
- `public/app/es-v152.js`: the new words in Spanish
- `public/index.html`: new version numbers on the changed app files, so phones load them fresh
