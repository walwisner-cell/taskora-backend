# Trothen help videos

The help videos are recorded from the real Trothen screens by a script, so they always match the app.

There are two sets:

- **For people using Trothen** (customers, pros, visitors): in `public/help/`, in a phone version (`help-<name>.mp4`) and a laptop version (`help-<name>-computer.mp4`). They play from "Help videos" (the account menu, the support chat and the site footer) and from the "Watch how it works" buttons.
- **For the team**: in `help-admin/`. They play only in Admin → Help videos.
  - They are never on the public site.
  - Each one plays through a private link that works for 30 minutes.
  - An admin sees only the videos for the parts of Admin they can open.

## When a screen changes

1. Run the check. It runs every step of every video against the app, records nothing, and takes a few minutes:

   ```
   npm run help-videos:check
   ```

   If a screen changed (a button moved or was renamed), it names the video and the step. Change that step in `scripts/help-videos/flows.js`.

2. Record the videos again. This records all of them:

   ```
   npm run help-videos
   ```

   Each video for people is recorded twice, on a phone and on a laptop (the app plays the one for the screen it is on). Add `--phone` or `--computer` to record only one of the two.

   To record one video only, name it:

   ```
   node scripts/help-videos/film.js rides
   ```

3. Commit the new files in `public/help/` and `help-admin/` with the change.

## The animated explainers (v181)

Most subjects also have an **animated explainer**: drawn pictures, a narrator and subtitles that explain the subject simply, before the step-by-step video shows it on the real screens. In "Help videos", the explainer plays first, and a switch above the video changes between "Explained simply" and "Step by step on the screen".

- Each explainer is one file in `scripts/help-videos/explainers/` (for example `rentals.js`). It is a list of scenes; each scene has its sentences ("beats"), and each picture appears with its sentence.
- The name of the file matches the step-by-step video on the same subject (`key`), so the two are shown together.
- They are made into `public/help/explain-<name>.mp4` (tall, for phones) and `explain-<name>-computer.mp4` (wide, for laptops), with a `.jpg` cover each, and added to `help-videos.json`.

To make them:

```
node scripts/help-videos/explain.js              every explainer, both versions
node scripts/help-videos/explain.js rentals      one explainer
node scripts/help-videos/explain.js --check      one picture of each scene, to look at; makes no video
```

Add `--tall` or `--wide` to make only one of the two versions. The explainers don't use the app, so they don't need the demo copy of Trothen; they need the same Kokoro voice, Playwright and ffmpeg as the step-by-step videos.

When a fact changes in the app (a fee, a time limit, a button name), change the sentence in the explainer as well as in `flows.js`, and make both again.

## Narration
Each caption is also spoken aloud by Kokoro, a free text-to-speech model that runs on the recording computer. It uses the "Heart" voice (`af_heart`, a warm American woman's voice), licensed Apache 2.0 and credited in `public/help/CREDITS.txt`.

- The first time, the voice is downloaded (about 350 MB).
- To use another Kokoro voice, set `TROTHEN_VOICE` (for example `bf_emma`, a British woman's voice, or `am_michael`, an American man's voice).
- To make it slower or faster, set `TROTHEN_VOICE_PACE` (default 0.92; lower is slower).
- To record without a voice, add `--no-voice`.

## What it needs

It needs a computer, not the server:

- Node.js
- ffmpeg
- Kokoro: `pip install kokoro-onnx soundfile`
- Playwright, installed once with:

  ```
  npm install --no-save playwright && npx playwright install chromium
  ```

The recording uses a throw-away demo copy of Trothen with demo people in Monrovia. It never touches the real database.

## Adding a video

Add an entry to `flows.js` with:

- a `key`;
- the `group`: `public` or `admin`;
- who it is recorded as;
- a title;
- its steps (`tap`, `type`, `choose`, `files`, `show`, `say`).

Each step's caption is what the viewer reads, so write it as a short instruction: "Tap Rides."
