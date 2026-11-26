# Trothen v181: animated help videos for every subject, and help videos for Rentals

v181 goes on top of v180.

## What you asked
"I love this style of video [sample 3, animated]. Can you implement this and expand everything? Also please make sure to expand videos in more detail, so an ordinary person can understand." You chose **both**: an animated video that explains each subject simply, and the step-by-step video on the real screens.

## What I built

### 1. An animated explainer for every subject
There are now **15 animated explainers**, in the style of sample 3: drawn pictures, a phone that shows each step, a warm narrator, and the words on screen.

**For everyone:**
- Create your account
- Verify your identity
- Post a job
- Add Mobile Money
- Book a ride
- Find and buy in the Market
- Your cart and checkout
- Sell an item
- Messages and calls
- Your account, settings and data
- Book a place to stay (new)
- Rent out your place (new)

**For pros:**
- Add a good to your store
- Deliver for stores and the Market
- Business tools

**They explain the "why", not only the "how".** The step-by-step videos show which buttons to press. The explainers also say, in plain words:
- why Trothen asks for your ID, and what happens to your photos;
- how your money is held by Trothen until the job is done, the goods arrive, or the guest checks in;
- what to do when something goes wrong;
- the signs of a scam, and the safety rules.

**They are longer and more detailed:** from 1 minute 17 seconds (Business tools) to almost 4 minutes (Book a place to stay, and Rent out your place). Together they run about 37 minutes.

**Each explainer has two versions,** like the step-by-step videos:
- a tall one for phones, so the words are big enough to read;
- a wide one for laptops.

### 2. Help videos: "Explained simply" or "Step by step on the screen"
- **The animated explainer plays first.** A switch above the video changes between "Explained simply" and "Step by step on the screen".
- **"Read it instead"** under the video always shows the words of the one that is playing.
- **The search** now also finds words said in the explainers (for example "host fee").
- **There's a new Rentals group,** after Market.
- **The switch is in Spanish too.**
- **On a laptop, "Read it instead" now shows the laptop words** ("Click", not "Tap"). Before, it could show the phone words.
- **The subtitles in the phone version sit above the video's play bar,** so they stay readable when the controls show.

### 3. Help videos for Rentals, on the real screens
- **Book a place to stay** (2 minutes 45 seconds): search, open a place, choose your dates on the calendar, see the full price, and how the money is held.
- **Rent out your place** (2 minutes 26 seconds): Hosting, your places, and the form to list one (I don't send it in the video).

### 4. A correction to the ride video
**The old ride video said "neither of you sees the other's phone number". That isn't right.** Your Ride Rules (section 5) say that while a ride is open, the rider and the driver can each see the other's number. I corrected the words and recorded the ride video again. The new explainer also says:
- that the fare is held by Trothen and paid when you arrive;
- that you get it back if no driver answers or you cancel before the trip starts;
- how to use SOS;
- to wear the helmet on a motorbike.

### 5. Smaller files
**I changed the voice track to 24 kHz, 64 kbit/s, in mono.** That's still clear for a voice. It makes each new video about a third smaller, so it uses less mobile data. A phone explainer is about 2.6 MB on average.

## Tests
- `t181` (new, 24 checks):
  - every subject has an explainer in both versions, with sound, at the right length and size;
  - Rentals is in Help videos;
  - the switch works on a phone and a laptop, and in Spanish;
  - search finds explainer words;
  - the ride and hosting facts match the app.
- `t178` and `t179` now expect 15 videos and the Rentals group, and choose "Step by step" before checking the real-screen video.
- Every earlier suite, on the file store and on Postgres.

## What is business, not code
- **The narrator is still the American voice "Heart" (Kokoro).** You asked about an African voice. The options I gave are still open:
  - Microsoft Azure's Nigerian English voices;
  - a Liberian voice artist;
  - a cloned voice with the speaker's written consent.

  I can change all the videos once you choose. The explainers are made from text, so a new voice takes one command.
- **Storage.** The help videos are now about 134 MB in total, in GitHub. That works, but every new version adds to the size of the project. Moving them to cloud storage (Cloudflare R2 or Amazon S3) is still worth deciding.
- **The Admin videos are still screen recordings only.** Tell me if you want animated ones for the team too.

## Files
**New:**
- `scripts/help-videos/explain.js` (makes the animated videos)
- `scripts/help-videos/explain-icons.js` (the drawn icons)
- `scripts/help-videos/explainers/*.js` (15 files: the scenes and words of each explainer)
- `public/help/explain-*.mp4` and `.jpg` (30 videos and their covers)
- `public/help/help-rentals*` and `help-hosting*` (the two new step-by-step videos)

**Changed:**
- `public/help/help-videos.json` (the list)
- `public/help/help-rides*` (recorded again)
- `public/app/help-videos.js` (the switch, the Rentals group, and search)
- `public/app/es-v152.js` (Spanish)
- `public/index.html` (new version numbers)
- `scripts/help-videos/flows.js` (the two Rentals videos and the ride correction)
- `scripts/help-videos/demo.js` (demo places to stay)
- `scripts/help-videos/narrate.js` (the smaller voice track)
- `scripts/help-videos/README.md`
- `package.json` (adds `npm run help-explainers`; nothing new to install on Render)
