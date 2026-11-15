# Trothen v137: voice messages, and calls built the way the big marketplaces do it

This one package includes everything since the version on your GitHub `main` before v128: v128 to v136, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
Make the call feature best practice for Trothen, and add voice messages.

## 1. Voice messages
- **In every chat:** a microphone button next to Send.
  - Tap it, then tap the red button to record (up to 2 minutes).
  - Listen back, then choose Send, Record again or Discard.
- **Playing:** voice messages play right in the chat, with a play button, a progress bar and the time. A chat that refreshes live doesn't cut off a message that's playing.
- **When a call doesn't go through,** the caller sees **"Leave a voice message"**. This covers:
  - the call is declined;
  - nobody answers;
  - the person is busy or outside their call hours;
  - the person has turned calls off.
  
  An unanswered call or a dropped line also offers **Call again**.
- **The other person is notified:** "Jordan sent you a voice message (0:23)."
- **Deleting:** the sender can delete their own voice message. It's then gone for both people, and the file is erased.
- **Private:**
  - voice messages are kept in the private folder, never in the public one;
  - only the two people in the chat can play them;
  - with `ID_FILE_ENCRYPTION_KEY` set on Render, they're stored encrypted, the same as ID documents;
  - when an account is erased, its voice messages are erased too.
- **Small files.** About 24 kbps, so a 1-minute message is roughly 180 KB. That matters on paid mobile data.

## 2. Calls that cope with real networks
- **Reconnects by itself.** If the network drops or changes mid-call (Wi-Fi to mobile data, a dead spot), the call shows "Reconnecting…" and finds a new route without hanging up. If it can't within 25 seconds, it ends with "The connection dropped. Call again when you have a better signal", and offers Call again or a voice message.
- **Data saver.**
  - **Speech** is capped at about 32 kbps, with Opus's own repair for lost sound and silence saving switched on. Calls stay clear on weak 3G and use little data.
  - **Video** is capped for 3G/4G (360p, up to 20 frames a second).
- **A connection bar** in the call: three bars, and "Weak connection" when the line is poor. People can then tell it's the network, not Trothen.

## 3. Rules that protect people
- **Call window.** Calls and voice messages are open while a customer and a pro have something going on:
  - a booking that's still open;
  - an open job they're talking about;
  - a conversation where **both** have written in the last 7 days.
  
  They stay open for 7 days after a booking ends. After that, only text messages work. Before, anyone who had ever messaged could call forever.
- **Block.** Every chat header has a Block button.
  - **Blocked people:** can't call you or send you voice messages, and they aren't told they're blocked. They see "isn't taking calls or voice messages from you".
  - **Text messages still work,** so a booking can still be finished and the record stays complete for disputes.
  - **Unblock** from the same button, or in Settings.
- **Spam limits.**
  - At most 3 unanswered calls to the same person in an hour. The 4th attempt is offered a voice message instead.
  - At most 20 calls in an hour in total.
  - At most 10 voice messages a minute.
- **Call settings (Settings → Calls & Voice Messages)**, for both customers and pros:
  - take calls on Trothen (on or off);
  - take voice messages (on or off);
  - **only take calls at set times:** from and to, which days, in your own time zone (saved automatically). Hours can cross midnight, for example 8 PM to 2 AM. Outside them, callers see "Marcus takes calls 9:00 AM to 6:00 PM, Monday to Friday (their time)" and can leave a voice message;
  - the people you've blocked, with Unblock.
- **Checked before anything rings.** The rules are checked before the microphone is even requested, so people get a clear answer straight away.

## 4. Call history for disputes
- **In the dispute window:** Admin → Disputes → open a dispute now shows **"Calls and voice messages between them"**:
  - every call, with who called, voice or video, and whether it was answered, declined or missed;
  - how long it lasted, and whether it dropped because of the connection;
  - every voice message, with its length, whether it was played, and whether it was deleted.
- **Times and lengths only.** Calls are never recorded, and admins can't play voice messages. That settles "he never called me" without anyone listening in.
- **Permissions:** this is a new tick box under Disputes: "See when the two sides called or sent voice messages (times only)". A custom admin needs it ticked.

## What I tested
- **The new features (67 checks):**
  - the call window (a one-way message isn't enough; both sides writing opens it; it closes after 7 days, and 7 days after a booking ends);
  - Block and Unblock, with text messages still working;
  - call settings: calls off, voice messages off, call hours, the time zone, crossing midnight, bad input refused;
  - the 3-unanswered-calls limit;
  - voice messages:
    - non-audio files, over-length and empty recordings are refused;
    - stored encrypted, and not reachable from any public address;
    - only the two people can play them, and only after signing in;
    - the playback is exactly what was recorded;
    - marked as played, with the notification sent;
    - only the sender can delete one, and the file is then erased;
  - the dispute call history, and the permission tick for it;
  - on screen:
    - recording 3 seconds in the browser, sending it, and it arriving live in the other chat and playing to the end;
    - "Leave a voice message" after a declined call;
    - the outside-hours screen;
    - the connection bar, with data saver confirmed in the call settings;
    - reconnecting mid-call without hanging up;
    - Block from the chat header;
    - the settings panel;
    - the recorder on a phone screen;
    - the admin dispute window.
- **Earlier tests, all still passing:**
  - calls (22);
  - instant updates (all 7 steps about half a second);
  - permissions (95);
  - all 177 admin addresses and the 14 disguised addresses;
  - commission (25 + 8), categories (22), accepting jobs (27), listed pros (16).

## Good to know
- **Reconnecting.** In my test I forced a reconnect mid-call and the call carried on. I can't unplug a real network from here, so the Wi-Fi-to-mobile-data case should be tried on two real phones (see the deploy steps).
- **Storage.** Voice messages are kept in `PRIVATE_UPLOADS_DIR`, the same permanent disk as ID documents. If that isn't set on Render, they disappear on each deploy, like ID documents would. The Go-Live checklist already flags it.
- **Encryption.** With `ID_FILE_ENCRYPTION_KEY` set, voice messages are encrypted too. The same warning applies: keep a copy of that key somewhere safe.
- **iPhone.** Safari records in a different format (M4A) from Chrome and Android (WebM). Both are accepted.
  - **Android and computers** play both formats.
  - **iPhones on a recent iOS** should play both. An older iPhone may not play a message recorded on Android.
  - **Not tested on a real iPhone.** I couldn't from here, so please try one in the phone test.
- **Still true from v136:**
  - for calls on every network, add a relay (TURN) service;
  - calls ring only while Trothen is open; otherwise there's a notification.
- **What would make it better still:** masked phone calls (the Uber method: rings the real phone even when the app is closed, with numbers hidden). That needs a provider and a per-minute budget.

## Files
- **New:**
  - `public/app/voice.js`: the recorder, playback, settings, Block, and the dispute call history.
- **Changed:**
  - `src/routes/calls.routes.js`: the call window, blocks, call hours, spam limits, voice messages.
  - `public/app/calls.js`: reconnecting, data saver, the connection bar, the leave-a-voice-message screen.
  - `public/app/chats.js`: voice messages in the chat, the microphone button, Block in the header.
  - `src/routes/admin.routes.js`: the dispute call history.
  - `src/admin-permissions.js`: the new Disputes tick box.
  - `src/account-privacy.js`: voice messages erased with an account.
  - `public/index.html`

No new packages, environment variables or database changes.
